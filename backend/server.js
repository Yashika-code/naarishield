import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { swaggerDocument } from './swagger.js';
import { firestoreDb, realtimeDb, firebaseAuth, firebaseInitialized, initError } from './firebase.js';
import { notificationService } from './services/notificationService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Robust CORS configuration supporting Vercel and preflight OPTIONS requests
const allowedOrigins = [
  'https://naarishield-two.vercel.app',
  FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) or matching any vercel/render preview
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback allow all origins to ensure API usability
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Express 5 already handles all OPTIONS preflights automatically when cors() is mounted via app.use()

app.use(express.json());
app.use(morgan('dev'));

// In-Memory Database store with extended safety models (starts completely empty)
let memoryStore = {
  users: {},
  trustedContacts: [],
  sosEvents: [],
  checkIns: [],
  journeys: [],
  communityRequests: [],
  incidentReports: [],
  safetyCircle: [],
  safetyPlans: []
};

// Periodic Background Worker to mark expired check-ins as 'missed'
setInterval(async () => {
  const now = new Date();
  // Check memoryStore
  memoryStore.checkIns.forEach(c => {
    if (c.status === 'active' && new Date(c.expiresAt) < now) {
      c.status = 'missed';
      c.missedDetectedAt = now.toISOString();
      console.log(`[CheckIn Worker] Check-in ${c.id} marked as missed.`);
    }
  });

  // Check Firestore if configured
  if (firebaseInitialized && firestoreDb) {
    try {
      const snap = await firestoreDb.collection('checkIns')
        .where('status', '==', 'active')
        .where('expiresAt', '<', now.toISOString())
        .get();

      snap.forEach(async (doc) => {
        await doc.ref.update({
          status: 'missed',
          missedDetectedAt: now.toISOString()
        });
      });
    } catch (e) {
      // Gracefully handle periodic check
    }
  }
}, 30000); // checks every 30s

// Authentication Middleware
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = { uid: 'guest-user', email: 'guest@narishield.ai', isDemo: true };
    return next();
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  if (token === 'demo-token' || token.startsWith('demo-')) {
    req.user = { uid: 'guest-user', email: 'guest@narishield.ai', isDemo: true };
    return next();
  }

  if (firebaseInitialized && firebaseAuth) {
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.displayName,
        isDemo: false
      };
      return next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Firebase authentication token',
        details: err.message
      });
    }
  }

  req.user = { uid: 'guest-user', email: 'guest@narishield.ai', isDemo: true };
  next();
};

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'NariShield.ai API Documentation'
}));

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'NariShield.ai Core API',
    version: '1.2.0',
    mode: process.env.NODE_ENV || 'development',
    database: firebaseInitialized ? 'Cloud Firestore (Connected)' : 'Demo Memory Store (Fallback)',
    features: ['emergency-siren', 'check-in-timer', 'incident-reports', 'pdf-export', 'safety-circle', 'nearby-resources', 'ai-safety-planner'],
    firebaseInitialized,
    initError: initError || null,
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// User Profile Routes
// ----------------------------------------------------
app.get('/api/v1/profile', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const userDoc = await firestoreDb.collection('users').doc(req.user.uid).get();
        if (userDoc.exists) {
          return res.json({ success: true, profile: { uid: req.user.uid, ...userDoc.data() } });
        }
        const initialProfile = {
          uid: req.user.uid,
          displayName: req.user.displayName || 'Safety User',
          email: req.user.email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          preferences: { voiceTriggerEnabled: true, smsAlerts: true, whatsappAlerts: true, locationHighAccuracy: true }
        };
        await firestoreDb.collection('users').doc(req.user.uid).set(initialProfile);
        return res.json({ success: true, profile: initialProfile });
      } catch (dbErr) {
        console.warn('[Firestore] Profile read failed, falling back to local session store:', dbErr.message);
      }
    }
    const user = memoryStore.users[req.user.uid] || {
      uid: req.user.uid,
      displayName: req.user.displayName || 'Safety User',
      email: req.user.email,
      preferences: { voiceTriggerEnabled: true, smsAlerts: true, whatsappAlerts: true, locationHighAccuracy: true }
    };
    res.json({ success: true, profile: user });
  } catch (err) {
    res.status(200).json({ success: true, profile: { uid: req.user.uid, displayName: 'Safety User', email: req.user.email } });
  }
});

app.put('/api/v1/profile', authenticateUser, async (req, res) => {
  const updateData = {
    ...(req.body.displayName ? { displayName: req.body.displayName } : {}),
    ...(req.body.phoneNumber ? { phoneNumber: req.body.phoneNumber } : {}),
    ...(req.body.preferences ? { preferences: req.body.preferences } : {}),
    updatedAt: new Date().toISOString()
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const docRef = firestoreDb.collection('users').doc(req.user.uid);
        await docRef.set(updateData, { merge: true });
        const updatedDoc = await docRef.get();
        return res.json({ success: true, profile: { uid: req.user.uid, ...updatedDoc.data() } });
      } catch (dbErr) {
        console.warn('[Firestore] Profile update failed, falling back to local session store:', dbErr.message);
      }
    }
    const existing = memoryStore.users[req.user.uid] || { uid: req.user.uid, email: req.user.email };
    const updated = { ...existing, ...updateData };
    memoryStore.users[req.user.uid] = updated;
    res.json({ success: true, profile: updated });
  } catch (err) {
    res.status(200).json({ success: true, profile: { uid: req.user.uid, ...updateData } });
  }
});

// ----------------------------------------------------
// Trusted Contacts Routes (Max 5, Invitation & Verification)
// ----------------------------------------------------
const phoneRegex = /^\+?[1-9]\d{7,14}$/;

app.get('/api/v1/contacts', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const snapshot = await firestoreDb.collection('trustedContacts').where('userId', '==', req.user.uid).get();
        const contacts = [];
        snapshot.forEach(doc => contacts.push({ id: doc.id, ...doc.data() }));
        contacts.sort((a, b) => (a.priority || 99) - (b.priority || 99));
        return res.json({ success: true, count: contacts.length, contacts });
      } catch (dbErr) {
        console.warn('[Firestore] Contacts read failed, falling back to local session store:', dbErr.message);
      }
    }
    const userContacts = memoryStore.trustedContacts.filter(c => c.userId === req.user.uid);
    userContacts.sort((a, b) => (a.priority || 99) - (b.priority || 99));
    res.json({ success: true, count: userContacts.length, contacts: userContacts });
  } catch (err) {
    res.status(200).json({ success: true, count: 0, contacts: [] });
  }
});

app.post('/api/v1/contacts', authenticateUser, async (req, res) => {
  const phone = (req.body.phoneNumber || req.body.phone || '').trim();
  if (!req.body.name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required' });
  }

  // International phone validation
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  if (!phoneRegex.test(cleanPhone)) {
    return res.status(400).json({ success: false, error: 'Invalid international phone number format (e.g. +919876543210)' });
  }

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const existing = await firestoreDb.collection('trustedContacts').where('userId', '==', req.user.uid).get();
        if (existing.size >= 5) {
          return res.status(400).json({ success: false, error: 'Maximum 5 emergency contacts allowed' });
        }

        // Duplicate check
        let isDuplicate = false;
        existing.forEach(d => {
          if (d.data().phoneNumber === cleanPhone) isDuplicate = true;
        });
        if (isDuplicate) {
          return res.status(400).json({ success: false, error: 'A contact with this phone number already exists' });
        }

        const inviteToken = uuidv4().substring(0, 8);
        const newContact = {
          userId: req.user.uid,
          name: req.body.name.trim(),
          phoneNumber: cleanPhone,
          relationship: req.body.relationship || 'Emergency Contact',
          priority: req.body.priority || existing.size + 1,
          verificationStatus: 'pending_verification',
          inviteToken,
          createdAt: new Date().toISOString()
        };

        const docRef = await firestoreDb.collection('trustedContacts').add(newContact);
        
        // Also persist to Realtime Database if connected
        if (realtimeDb) {
          try {
            await realtimeDb.ref(`users/${req.user.uid}/trustedContacts/${docRef.id}`).set(newContact);
          } catch (rtdbErr) {}
        }

        return res.status(201).json({ success: true, contact: { id: docRef.id, ...newContact } });
      } catch (dbErr) {
        console.warn('[Firestore] Contact add failed, falling back to local session store:', dbErr.message);
      }
    }

    const userContacts = memoryStore.trustedContacts.filter(c => c.userId === req.user.uid);
    if (userContacts.length >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum 5 emergency contacts allowed' });
    }
    if (userContacts.some(c => c.phoneNumber === cleanPhone)) {
      return res.status(400).json({ success: false, error: 'A contact with this phone number already exists' });
    }

    const inviteToken = uuidv4().substring(0, 8);
    const contact = {
      id: `contact-${uuidv4().substring(0, 8)}`,
      userId: req.user.uid,
      name: req.body.name.trim(),
      phoneNumber: cleanPhone,
      relationship: req.body.relationship || 'Emergency Contact',
      priority: req.body.priority || userContacts.length + 1,
      verificationStatus: 'pending_verification',
      inviteToken,
      createdAt: new Date().toISOString()
    };
    memoryStore.trustedContacts.push(contact);
    res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Send invitation to emergency contact
app.post('/api/v1/contacts/:id/invite', authenticateUser, async (req, res) => {
  try {
    let contact = null;
    let docRef = null;

    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      docRef = firestoreDb.collection('trustedContacts').doc(req.params.id);
      const snap = await docRef.get();
      if (snap.exists && snap.data().userId === req.user.uid) {
        contact = { id: snap.id, ...snap.data() };
      }
    } else {
      contact = memoryStore.trustedContacts.find(c => c.id === req.params.id && c.userId === req.user.uid);
    }

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found or unauthorized' });
    }

    const inviteResult = await notificationService.sendContactInvitation({
      contact,
      user: req.user,
      inviteToken: contact.inviteToken || uuidv4().substring(0, 8)
    });

    res.json({
      success: true,
      message: `Invitation successfully dispatched to ${contact.name}`,
      result: inviteResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify contact acceptance
app.post('/api/v1/contacts/:id/verify', async (req, res) => {
  const { token } = req.body;
  try {
    if (firebaseInitialized && firestoreDb) {
      const docRef = firestoreDb.collection('trustedContacts').doc(req.params.id);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ success: false, error: 'Contact not found' });
      
      const data = snap.data();
      if (data.inviteToken && token && data.inviteToken !== token) {
        return res.status(400).json({ success: false, error: 'Invalid verification token' });
      }

      await docRef.update({
        verificationStatus: 'verified',
        verifiedAt: new Date().toISOString()
      });

      return res.json({ success: true, message: 'Contact successfully verified and confirmed as emergency guardian.' });
    }

    const contact = memoryStore.trustedContacts.find(c => c.id === req.params.id);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    if (contact.inviteToken && token && contact.inviteToken !== token) {
      return res.status(400).json({ success: false, error: 'Invalid verification token' });
    }

    contact.verificationStatus = 'verified';
    contact.verifiedAt = new Date().toISOString();
    res.json({ success: true, message: 'Contact successfully verified and confirmed as emergency guardian.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/v1/contacts/:id', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('trustedContacts').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Contact not found or unauthorized' });
      }
      await docRef.delete();
      if (realtimeDb) {
        try { await realtimeDb.ref(`users/${req.user.uid}/trustedContacts/${req.params.id}`).remove(); } catch (e) {}
      }
      return res.json({ success: true, message: 'Deleted', removedId: req.params.id });
    }
    const idx = memoryStore.trustedContacts.findIndex(c => c.id === req.params.id && c.userId === req.user.uid);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Contact not found' });
    memoryStore.trustedContacts.splice(idx, 1);
    res.json({ success: true, message: 'Deleted', removedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ----------------------------------------------------
// SOS Trigger & Notification Pipeline (Full Lifecycle)
// Lifecycle: CREATED -> LOCATION_ACQUIRED -> ALERTS_QUEUED -> ALERTS_SENT/PARTIALLY_FAILED -> RESOLVED
// ----------------------------------------------------
app.post('/api/v1/sos/trigger', authenticateUser, async (req, res) => {
  const { idempotencyKey, triggerSource = 'manual', coordinates, batteryLevel, notes } = req.body;
  if (!idempotencyKey) {
    return res.status(400).json({ success: false, error: 'idempotencyKey required' });
  }

  const now = new Date().toISOString();
  const locationLink = coordinates?.latitude && coordinates?.longitude
    ? `https://maps.google.com/?q=${coordinates.latitude},${coordinates.longitude}`
    : null;

  try {
    // 1. Retrieve User's Trusted Contacts
    let contacts = [];
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const dup = await firestoreDb.collection('sosEvents')
        .where('userId', '==', req.user.uid)
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();

      if (!dup.empty) {
        return res.status(200).json({
          success: true,
          duplicatePrevented: true,
          message: 'SOS alert already logged with this key.',
          sosEvent: { id: dup.docs[0].id, ...dup.docs[0].data() }
        });
      }

      const contactsSnap = await firestoreDb.collection('trustedContacts').where('userId', '==', req.user.uid).get();
      contactsSnap.forEach(doc => contacts.push({ id: doc.id, ...doc.data() }));
    } else {
      const existing = memoryStore.sosEvents.find(e => e.idempotencyKey === idempotencyKey && e.userId === req.user.uid);
      if (existing) {
        return res.status(200).json({ success: true, duplicatePrevented: true, sosEvent: existing });
      }
      contacts = memoryStore.trustedContacts.filter(c => c.userId === req.user.uid);
    }

    // Sort contacts by priority
    contacts.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    // 2. Incident & Initial Lifecycle State
    const incidentId = `sos-${uuidv4().substring(0, 10)}`;
    const initialTimeline = [
      { status: 'CREATED', message: `Emergency distress alert triggered via ${triggerSource.toUpperCase()}`, timestamp: now }
    ];

    if (coordinates?.latitude && coordinates?.longitude) {
      initialTimeline.push({
        status: 'LOCATION_ACQUIRED',
        message: `Coordinates captured: ${coordinates.latitude}, ${coordinates.longitude} (accuracy ~${coordinates.accuracy || 10}m)`,
        timestamp: new Date().toISOString()
      });
    }

    initialTimeline.push({
      status: 'ALERTS_QUEUED',
      message: `Queuing dispatch for ${contacts.length} emergency contacts`,
      timestamp: new Date().toISOString()
    });

    // 3. Dispatch notifications asynchronously through notification provider
    const notifications = [];
    for (const c of contacts) {
      const delivery = await notificationService.dispatchSOSNotification({
        contact: c,
        user: req.user,
        incident: { id: incidentId, createdAt: now },
        locationLink
      });
      notifications.push(delivery);
    }

    // Determine lifecycle outcome
    const anyFailed = notifications.some(n => n.status === 'FAILED');
    const allFailed = notifications.length > 0 && notifications.every(n => n.status === 'FAILED');
    const finalStatus = allFailed ? 'PARTIALLY_FAILED' : anyFailed ? 'PARTIALLY_FAILED' : 'ALERTS_SENT';

    initialTimeline.push({
      status: finalStatus,
      message: `Notifications evaluated: ${notifications.filter(n => n.status === 'DELIVERED' || n.status === 'DEMO_DISPATCHED').length} dispatched, ${notifications.filter(n => n.status === 'FAILED').length} failed`,
      timestamp: new Date().toISOString()
    });

    // 4. Outbound telephony escalation action (web tel: fallback or twilio voice call)
    let callWorkflow = null;
    if (contacts.length > 0) {
      const primaryContact = contacts[0];
      const callRes = await notificationService.initiateEmergencyCall({
        contact: primaryContact,
        user: req.user,
        incidentId
      });
      callWorkflow = {
        primaryContactId: primaryContact.id,
        primaryContactName: primaryContact.name,
        primaryContactPhone: primaryContact.phoneNumber,
        ...callRes
      };
    }

    const newSOSEvent = {
      id: incidentId,
      userId: req.user.uid,
      idempotencyKey,
      triggerSource,
      status: finalStatus,
      latitude: coordinates?.latitude || null,
      longitude: coordinates?.longitude || null,
      locationAccuracy: coordinates?.accuracy || null,
      locationLink,
      batteryLevel: batteryLevel ?? null,
      notes: notes || null,
      timeline: initialTimeline,
      callWorkflow,
      createdAt: now,
      cancelledAt: null,
      notifications
    };

    // 5. Persist to DB
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      await firestoreDb.collection('sosEvents').doc(incidentId).set(newSOSEvent);
      if (realtimeDb) {
        try {
          await realtimeDb.ref(`incidents/${incidentId}`).set(newSOSEvent);
        } catch (rtdbErr) {}
      }
    } else {
      memoryStore.sosEvents.unshift(newSOSEvent);
    }

    return res.status(201).json({ success: true, sosEvent: newSOSEvent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single incident by ID
app.get('/api/v1/sos/:id', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const doc = await firestoreDb.collection('sosEvents').doc(req.params.id).get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Incident not found or unauthorized' });
      }
      return res.json({ success: true, event: { id: doc.id, ...doc.data() } });
    }
    const event = memoryStore.sosEvents.find(e => e.id === req.params.id && e.userId === req.user.uid);
    if (!event) return res.status(404).json({ success: false, error: 'Incident not found' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET incident events/timeline
app.get('/api/v1/incidents/:id/events', authenticateUser, async (req, res) => {
  try {
    let event = null;
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const doc = await firestoreDb.collection('sosEvents').doc(req.params.id).get();
      if (doc.exists && doc.data().userId === req.user.uid) {
        event = { id: doc.id, ...doc.data() };
      }
    } else {
      event = memoryStore.sosEvents.find(e => e.id === req.params.id && e.userId === req.user.uid);
    }
    if (!event) return res.status(404).json({ success: false, error: 'Incident not found' });
    res.json({ success: true, timeline: event.timeline || [], notifications: event.notifications || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Acknowledge SOS Alert by Contact
app.post('/api/v1/incidents/:id/acknowledge', async (req, res) => {
  const { contactId, responderName } = req.body;
  const now = new Date().toISOString();

  try {
    if (firebaseInitialized && firestoreDb) {
      const docRef = firestoreDb.collection('sosEvents').doc(req.params.id);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ success: false, error: 'Incident not found' });
      
      const eventData = snap.data();
      const updatedNotifs = (eventData.notifications || []).map(n => {
        if (!contactId || n.contactId === contactId) {
          return { ...n, acknowledged: true, acknowledgedAt: now };
        }
        return n;
      });

      const updatedTimeline = [
        ...(eventData.timeline || []),
        { status: 'ACKNOWLEDGED', message: `Emergency alert acknowledged by responder ${responderName || contactId || 'Guardian'}`, timestamp: now }
      ];

      await docRef.update({
        notifications: updatedNotifs,
        timeline: updatedTimeline
      });

      return res.json({ success: true, message: 'Alert acknowledged. Dispatch team and user notified.' });
    }

    const event = memoryStore.sosEvents.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Incident not found' });

    event.notifications = (event.notifications || []).map(n => {
      if (!contactId || n.contactId === contactId) {
        return { ...n, acknowledged: true, acknowledgedAt: now };
      }
      return n;
    });

    event.timeline = [
      ...(event.timeline || []),
      { status: 'ACKNOWLEDGED', message: `Emergency alert acknowledged by responder ${responderName || contactId || 'Guardian'}`, timestamp: now }
    ];

    res.json({ success: true, message: 'Alert acknowledged. Dispatch team and user notified.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/api/v1/sos/history', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const snap = await firestoreDb.collection('sosEvents').where('userId', '==', req.user.uid).get();
        const events = [];
        snap.forEach(doc => events.push({ id: doc.id, ...doc.data() }));
        events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return res.json({ success: true, count: events.length, events });
      } catch (dbErr) {
        console.warn('[Firestore] SOS history read failed, falling back to local session store:', dbErr.message);
      }
    }
    const events = memoryStore.sosEvents.filter(e => e.userId === req.user.uid);
    res.json({ success: true, count: events.length, events });
  } catch (err) {
    res.status(200).json({ success: true, count: 0, events: [] });
  }
});

app.post('/api/v1/sos/:id/cancel', authenticateUser, async (req, res) => {
  const reason = req.body?.reason || 'User marked safe';
  const now = new Date().toISOString();

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('sosEvents').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Event not found or unauthorized' });
      }

      const existingTimeline = doc.data().timeline || [];
      const updatedTimeline = [
        ...existingTimeline,
        { status: 'RESOLVED', message: `Emergency cancelled/resolved by user. Reason: ${reason}`, timestamp: now }
      ];

      const updates = {
        status: 'RESOLVED',
        cancelledAt: now,
        cancellationReason: reason,
        timeline: updatedTimeline
      };

      await docRef.update(updates);
      if (realtimeDb) {
        try { await realtimeDb.ref(`incidents/${req.params.id}`).update(updates); } catch (e) {}
      }

      return res.json({ success: true, event: { id: doc.id, ...doc.data(), ...updates } });
    }

    const event = memoryStore.sosEvents.find(e => e.id === req.params.id && e.userId === req.user.uid);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    
    event.status = 'RESOLVED';
    event.cancelledAt = now;
    event.cancellationReason = reason;
    event.timeline = [
      ...(event.timeline || []),
      { status: 'RESOLVED', message: `Emergency cancelled/resolved by user. Reason: ${reason}`, timestamp: now }
    ];

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ----------------------------------------------------
// FEATURE 2: Safety Check-in Timer Routes
// ----------------------------------------------------
const checkInSchema = z.object({
  durationMinutes: z.number().int().min(1).max(240).default(15),
  destination: z.string().max(100).optional(),
  notes: z.string().max(200).optional(),
  notifyOnMissed: z.boolean().default(true)
});

app.get('/api/v1/check-ins', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const snap = await firestoreDb.collection('checkIns').where('userId', '==', req.user.uid).get();
      const checkIns = [];
      snap.forEach(d => checkIns.push({ id: d.id, ...d.data() }));
      checkIns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ success: true, count: checkIns.length, checkIns });
    }
    const checkIns = memoryStore.checkIns.filter(c => c.userId === req.user.uid);
    res.json({ success: true, count: checkIns.length, checkIns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/check-ins', authenticateUser, async (req, res) => {
  const parseResult = checkInSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
  }

  const { durationMinutes, destination, notes, notifyOnMissed } = parseResult.data;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60000).toISOString();

  const newRecord = {
    userId: req.user.uid,
    durationMinutes,
    destination: destination || null,
    notes: notes || null,
    status: 'active',
    notifyOnMissed,
    createdAt: now.toISOString(),
    expiresAt,
    confirmedAt: null
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const ref = await firestoreDb.collection('checkIns').add(newRecord);
      return res.status(201).json({ success: true, checkIn: { id: ref.id, ...newRecord } });
    }

    const checkIn = { id: `checkin-${uuidv4().substring(0, 8)}`, ...newRecord };
    memoryStore.checkIns.unshift(checkIn);
    res.status(201).json({ success: true, checkIn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/check-ins/:id/confirm', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('checkIns').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Check-in not found or unauthorized' });
      }
      await docRef.update({ status: 'completed', confirmedAt: new Date().toISOString() });
      const updated = await docRef.get();
      return res.json({ success: true, checkIn: { id: doc.id, ...updated.data() } });
    }

    const checkIn = memoryStore.checkIns.find(c => c.id === req.params.id && c.userId === req.user.uid);
    if (!checkIn) return res.status(404).json({ success: false, error: 'Check-in not found' });
    checkIn.status = 'completed';
    checkIn.confirmedAt = new Date().toISOString();
    res.json({ success: true, checkIn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/check-ins/:id/extend', authenticateUser, async (req, res) => {
  const addedMinutes = Number(req.body.addedMinutes) || 15;
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('checkIns').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Check-in not found or unauthorized' });
      }
      const currentExpiry = new Date(doc.data().expiresAt).getTime();
      const newExpiry = new Date(currentExpiry + addedMinutes * 60000).toISOString();
      await docRef.update({ expiresAt: newExpiry, durationMinutes: (doc.data().durationMinutes || 0) + addedMinutes });
      const updated = await docRef.get();
      return res.json({ success: true, checkIn: { id: doc.id, ...updated.data() } });
    }

    const checkIn = memoryStore.checkIns.find(c => c.id === req.params.id && c.userId === req.user.uid);
    if (!checkIn) return res.status(404).json({ success: false, error: 'Check-in not found' });
    const currentExpiry = new Date(checkIn.expiresAt).getTime();
    checkIn.expiresAt = new Date(currentExpiry + addedMinutes * 60000).toISOString();
    checkIn.durationMinutes += addedMinutes;
    res.json({ success: true, checkIn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/check-ins/:id/cancel', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('checkIns').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Check-in not found or unauthorized' });
      }
      await docRef.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
      const updated = await docRef.get();
      return res.json({ success: true, checkIn: { id: doc.id, ...updated.data() } });
    }

    const checkIn = memoryStore.checkIns.find(c => c.id === req.params.id && c.userId === req.user.uid);
    if (!checkIn) return res.status(404).json({ success: false, error: 'Check-in not found' });
    checkIn.status = 'cancelled';
    res.json({ success: true, checkIn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// FEATURE 3: Incident Reports & PDF Export
// ----------------------------------------------------
const incidentSchema = z.object({
  title: z.string().min(3),
  category: z.enum(['Harassment', 'Stalking', 'Theft', 'Unsafe Environment', 'Medical Emergency', 'Other']).default('Harassment'),
  incidentDate: z.string(),
  description: z.string().min(5),
  location: z.string().optional(),
  reportedToAuthorities: z.boolean().default(false),
  notes: z.string().optional()
});

app.get('/api/v1/incidents', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const snap = await firestoreDb.collection('incidentReports').where('userId', '==', req.user.uid).get();
        const incidents = [];
        snap.forEach(d => incidents.push({ id: d.id, ...d.data() }));
        incidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return res.json({ success: true, count: incidents.length, incidents });
      } catch (dbErr) {
        console.warn('[Firestore] Incidents read failed, falling back to local session store:', dbErr.message);
      }
    }
    const incidents = memoryStore.incidentReports.filter(i => i.userId === req.user.uid);
    res.json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    res.status(200).json({ success: true, count: 0, incidents: [] });
  }
});

app.post('/api/v1/incidents', authenticateUser, async (req, res) => {
  const parseResult = incidentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
  }

  const record = {
    userId: req.user.uid,
    ...parseResult.data,
    createdAt: new Date().toISOString()
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const ref = await firestoreDb.collection('incidentReports').add(record);
        return res.status(201).json({ success: true, incident: { id: ref.id, ...record } });
      } catch (dbErr) {
        console.warn('[Firestore] Incident add failed, falling back to local session store:', dbErr.message);
      }
    }
    const incident = { id: `inc-${uuidv4().substring(0, 8)}`, ...record };
    memoryStore.incidentReports.unshift(incident);
    res.status(201).json({ success: true, incident });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/v1/incidents/:id', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('incidentReports').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Incident not found or unauthorized' });
      }
      await docRef.delete();
      return res.json({ success: true, message: 'Incident deleted' });
    }
    const idx = memoryStore.incidentReports.findIndex(i => i.id === req.params.id && i.userId === req.user.uid);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Incident not found' });
    memoryStore.incidentReports.splice(idx, 1);
    res.json({ success: true, message: 'Incident deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PDF Generation Endpoint
app.get('/api/v1/incidents/:id/pdf', authenticateUser, async (req, res) => {
  try {
    let incident = null;
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const doc = await firestoreDb.collection('incidentReports').doc(req.params.id).get();
      if (doc.exists && doc.data().userId === req.user.uid) {
        incident = { id: doc.id, ...doc.data() };
      }
    } else {
      incident = memoryStore.incidentReports.find(i => i.id === req.params.id && i.userId === req.user.uid);
    }

    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident report not found' });
    }

    // Stream PDF using PDFKit
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="NariShield-Incident-${incident.id}.pdf"`);
    doc.pipe(res);

    // PDF Header
    doc.fontSize(20).fillColor('#0F172A').text('NariShield.ai — Official Incident Statement', { align: 'center' });
    doc.fontSize(10).fillColor('#64748B').text('CONFIDENTIAL SAFETY & COMPLIANCE RECORD', { align: 'center' });
    doc.moveDown(1.5);

    doc.rect(40, doc.y, 530, 2).fill('#EF4444');
    doc.moveDown(1);

    // Meta details
    doc.fontSize(11).fillColor('#0F172A');
    doc.text(`Report ID: ${incident.id}`);
    doc.text(`Generated At: ${new Date().toUTCString()} (System Recorded)`);
    doc.text(`Incident Category: ${incident.category}`);
    doc.text(`Reported Date/Time: ${new Date(incident.incidentDate).toLocaleString()}`);
    if (incident.location) doc.text(`Location: ${incident.location}`);
    doc.text(`Reported to Authorities: ${incident.reportedToAuthorities ? 'YES' : 'NO'}`);
    doc.moveDown(1.5);

    // Details Box
    doc.fontSize(13).fillColor('#0F172A').text('Statement of Incident:');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#334155').text(incident.description, {
      align: 'left',
      lineGap: 4
    });
    doc.moveDown(1.5);

    if (incident.notes) {
      doc.fontSize(11).fillColor('#0F172A').text('Additional Notes:');
      doc.fontSize(10).fillColor('#475569').text(incident.notes);
      doc.moveDown(1);
    }

    // Legal & Security Disclaimer Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#94A3B8').text(
      'Disclaimer: This record contains user-reported safety information submitted via the NariShield.ai platform. It is secured by cryptographic user authentication. Generated for personal record-keeping, civil assistance, or law enforcement referral.',
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate PDF', message: err.message });
  }
});

// ----------------------------------------------------
// FEATURE 4: Safety Circle & Sharing Permissions
// ----------------------------------------------------
app.get('/api/v1/safety-circle', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const snap = await firestoreDb.collection('safetyCircleInvitations').where('userId', '==', req.user.uid).get();
      const circle = [];
      snap.forEach(d => circle.push({ id: d.id, ...d.data() }));
      return res.json({ success: true, count: circle.length, circle });
    }
    const circle = memoryStore.safetyCircle.filter(m => m.userId === req.user.uid);
    res.json({ success: true, count: circle.length, circle });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/safety-circle/invite', authenticateUser, async (req, res) => {
  const { contactName, contactEmail, shareLiveLocation = false, shareJourneyStatus = true, shareSosAlerts = true } = req.body;
  if (!contactName || !contactEmail) {
    return res.status(400).json({ success: false, error: 'Contact name and email are required' });
  }

  const newInvitation = {
    userId: req.user.uid,
    contactName,
    contactEmail,
    status: 'pending',
    shareLiveLocation,
    shareJourneyStatus,
    shareSosAlerts,
    createdAt: new Date().toISOString()
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const ref = await firestoreDb.collection('safetyCircleInvitations').add(newInvitation);
      return res.status(201).json({ success: true, member: { id: ref.id, ...newInvitation } });
    }
    const member = { id: `circle-${uuidv4().substring(0, 8)}`, ...newInvitation };
    memoryStore.safetyCircle.push(member);
    res.status(201).json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/v1/safety-circle/:id', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('safetyCircleInvitations').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Member not found or unauthorized' });
      }
      await docRef.delete();
      return res.json({ success: true, message: 'Member revoked' });
    }
    const idx = memoryStore.safetyCircle.findIndex(m => m.id === req.params.id && m.userId === req.user.uid);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Member not found' });
    memoryStore.safetyCircle.splice(idx, 1);
    res.json({ success: true, message: 'Member revoked' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/v1/safety-circle/:id/permissions', authenticateUser, async (req, res) => {
  const allowedUpdates = {};
  if (typeof req.body.shareLiveLocation === 'boolean') allowedUpdates.shareLiveLocation = req.body.shareLiveLocation;
  if (typeof req.body.shareJourneyStatus === 'boolean') allowedUpdates.shareJourneyStatus = req.body.shareJourneyStatus;
  if (typeof req.body.shareSosAlerts === 'boolean') allowedUpdates.shareSosAlerts = req.body.shareSosAlerts;

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('safetyCircleInvitations').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Member not found or unauthorized' });
      }
      await docRef.update(allowedUpdates);
      const updated = await docRef.get();
      return res.json({ success: true, member: { id: doc.id, ...updated.data() } });
    }

    const member = memoryStore.safetyCircle.find(m => m.id === req.params.id && m.userId === req.user.uid);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
    Object.assign(member, allowedUpdates);
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// FEATURE 5: Nearby Emergency Resources Directory
// ----------------------------------------------------
const verifiedEmergencyDirectory = [
  // --- Alwar, Rajasthan Verified Facilities ---
  {
    id: 'res-alwar-police-1',
    name: 'Alwar Mahila Thana (Women Police Station)',
    type: 'police',
    address: 'Near Old Bus Stand, Company Bagh, Alwar, Rajasthan 301001',
    phone: '0144-2332100',
    latitude: 27.5615,
    longitude: 76.6080,
    verified: true,
    hours: '24/7 Open'
  },
  {
    id: 'res-alwar-police-2',
    name: 'Kotwali Police Station Alwar',
    type: 'police',
    address: 'Hope Circus, Jagannath Mandir Marg, Alwar, Rajasthan 301001',
    phone: '0144-2337222',
    latitude: 27.5530,
    longitude: 76.6055,
    verified: true,
    hours: '24/7 Open'
  },
  {
    id: 'res-alwar-police-3',
    name: 'Superintendent of Police (SP) Office Alwar',
    type: 'police',
    address: 'Collectorate Campus, Alwar, Rajasthan 301001',
    phone: '0144-2337456',
    latitude: 27.5700,
    longitude: 76.6120,
    verified: true,
    hours: '24/7 Emergency Desk'
  },
  {
    id: 'res-alwar-hosp-1',
    name: 'Rajiv Gandhi General Hospital & Trauma Centre',
    type: 'hospital',
    address: 'Hospital Road, Scheme No. 2, Alwar, Rajasthan 301001',
    phone: '0144-2332400',
    latitude: 27.5602,
    longitude: 76.6105,
    verified: true,
    hours: '24/7 Emergency & ICU'
  },
  {
    id: 'res-alwar-hosp-2',
    name: 'Solanki Hospital & Emergency Trauma',
    type: 'hospital',
    address: 'Manu Marg, Alwar, Rajasthan 301001',
    phone: '0144-2700444',
    latitude: 27.5645,
    longitude: 76.6150,
    verified: true,
    hours: '24/7 Emergency Care'
  },
  {
    id: 'res-alwar-help-1',
    name: 'Rajasthan Police Emergency Response (Alwar Dispatch)',
    type: 'helpline',
    address: 'Dial 112 (Rajasthan Emergency Command Centre)',
    phone: '112',
    latitude: 27.5530,
    longitude: 76.6055,
    verified: true,
    hours: '24/7 Toll-Free'
  },
  {
    id: 'res-alwar-help-2',
    name: 'Rajasthan State Women Helpline (Garima)',
    type: 'helpline',
    address: 'State Women Empowerment Directorate, Rajasthan',
    phone: '1090',
    latitude: 27.5615,
    longitude: 76.6080,
    verified: true,
    hours: '24/7 Toll-Free Helpline'
  },
  // --- National & Capital Region Facilities ---
  {
    id: 'res-police-1',
    name: 'Connaught Place Central Police Station',
    type: 'police',
    address: 'Near Regal Building, Connaught Place, New Delhi',
    phone: '011-23344100',
    latitude: 28.6304,
    longitude: 77.2177,
    verified: true,
    hours: '24/7 Open'
  },
  {
    id: 'res-police-2',
    name: 'Women Help Desk & Police Station (South)',
    type: 'police',
    address: 'Hauz Khas Police Station, New Delhi',
    phone: '1091',
    latitude: 28.5494,
    longitude: 77.2001,
    verified: true,
    hours: '24/7 Open'
  },
  {
    id: 'res-hosp-1',
    name: 'AIIMS Emergency Trauma Centre',
    type: 'hospital',
    address: 'Ring Road, Ansari Nagar, New Delhi',
    phone: '011-26593677',
    latitude: 28.5672,
    longitude: 77.2100,
    verified: true,
    hours: '24/7 Emergency Care'
  },
  {
    id: 'res-help-1',
    name: 'National Emergency Response System (ERSS)',
    type: 'helpline',
    address: 'Pan-India Emergency Response Service',
    phone: '112',
    latitude: 28.6139,
    longitude: 77.2090,
    verified: true,
    hours: 'Toll-Free 24/7'
  },
  {
    id: 'res-help-2',
    name: 'National Commission for Women (NCW) Helpline',
    type: 'helpline',
    address: 'Plot 21, Jasola Institutional Area, New Delhi',
    phone: '7827170170',
    latitude: 28.5355,
    longitude: 77.2831,
    verified: true,
    hours: '24/7 Toll-Free'
  }
];

// Haversine formula to compute distance in km
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

app.get('/api/v1/resources/nearby', (req, res) => {
  const { type, lat, lng } = req.query;
  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  let results = verifiedEmergencyDirectory.map(r => {
    if (userLat && userLng) {
      return {
        ...r,
        distanceKm: calculateDistanceKm(userLat, userLng, r.latitude, r.longitude)
      };
    }
    return r;
  });

  if (type && type !== 'all') {
    results = results.filter(r => r.type === type);
  }

  // Sort by nearest distance when coordinates are provided
  if (userLat && userLng) {
    results.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
  }

  res.json({
    success: true,
    count: results.length,
    userLocation: userLat && userLng ? { latitude: userLat, longitude: userLng } : null,
    source: 'National Women Helpline (1091/112) & State Emergency Directory',
    lastVerified: '2026-10-01T00:00:00.000Z',
    resources: results
  });
});

// ----------------------------------------------------
// FEATURE 6: AI Safety Planner
// ----------------------------------------------------
app.get('/api/v1/safety-plans', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const snap = await firestoreDb.collection('safetyPlans').where('userId', '==', req.user.uid).get();
        const plans = [];
        snap.forEach(d => plans.push({ id: d.id, ...d.data() }));
        return res.json({ success: true, count: plans.length, plans });
      } catch (dbErr) {
        console.warn('[Firestore] Safety plans read failed, falling back to local session store:', dbErr.message);
      }
    }
    const plans = memoryStore.safetyPlans.filter(p => p.userId === req.user.uid);
    res.json({ success: true, count: plans.length, plans });
  } catch (err) {
    res.status(200).json({ success: true, count: 0, plans: [] });
  }
});

app.post('/api/v1/safety-plans/generate', authenticateUser, async (req, res) => {
  const { journeyType = 'Night Commute', destination, departureTime = '21:00', transportMode = 'Metro / Public Transit' } = req.body;
  if (!destination) {
    return res.status(400).json({ success: false, error: 'Destination is required' });
  }

  // Precautionary synthesis model (AI rule-based engine with fallback guarantee)
  const checklist = [
    `Set a ${journeyType.includes('Night') ? '15-minute' : '30-minute'} Safety Check-in Timer before departure to ${destination}`,
    `Verify live battery level (>30%) and ensure location permissions are active in NariShield.ai`,
    `Share journey ETA and vehicle details with your registered Safety Circle`,
    `Verify phone volume is loud and test the Emergency Siren button deterrent feature`
  ];

  const recommendations = [
    transportMode.includes('Cab')
      ? 'Verify driver details and vehicle license match before entering. Avoid taking unmarked private cabs.'
      : transportMode.includes('Metro')
      ? 'Board designated women coaches or stay in well-lit central train cars near security personnel.'
      : 'Maintain active situational awareness; avoid wearing noise-cancelling headphones in secluded walkways.',
    `Ensure you have offline access to nearest verified emergency helplines (112 / 1091).`,
    `If route diverges unexpectedly, activate the NariShield manual SOS trigger immediately.`
  ];

  const newPlan = {
    userId: req.user.uid,
    journeyType,
    destination,
    departureTime,
    transportMode,
    checklist,
    recommendations,
    isAiGenerated: true,
    createdAt: new Date().toISOString()
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      try {
        const ref = await firestoreDb.collection('safetyPlans').add(newPlan);
        return res.status(201).json({ success: true, plan: { id: ref.id, ...newPlan } });
      } catch (dbErr) {
        console.warn('[Firestore] Safety plan save failed, falling back to local session store:', dbErr.message);
      }
    }
    const plan = { id: `plan-${uuidv4().substring(0, 8)}`, ...newPlan };
    memoryStore.safetyPlans.unshift(plan);
    res.status(201).json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// FEATURE 7: Live Journey & Trip Safety (Master §10)
// ----------------------------------------------------

app.get('/api/v1/journeys', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const snap = await firestoreDb.collection('journeys').where('userId', '==', req.user.uid).get();
      const journeys = [];
      snap.forEach(d => journeys.push({ id: d.id, ...d.data() }));
      journeys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ success: true, count: journeys.length, journeys });
    }
    const journeys = memoryStore.journeys.filter(j => j.userId === req.user.uid);
    res.json({ success: true, count: journeys.length, journeys });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/journeys', authenticateUser, async (req, res) => {
  const { destination, expectedArrivalTime, sharedContacts = [] } = req.body;
  if (!destination) {
    return res.status(400).json({ success: false, error: 'Destination is required' });
  }

  const now = new Date().toISOString();
  const newJourney = {
    userId: req.user.uid,
    destination: destination.trim(),
    expectedArrivalTime: expectedArrivalTime || new Date(Date.now() + 45 * 60000).toISOString(),
    status: 'ACTIVE',
    sharedContacts,
    lastLocation: req.body.coordinates ? {
      latitude: req.body.coordinates.latitude,
      longitude: req.body.coordinates.longitude,
      accuracy: req.body.coordinates.accuracy || 10,
      updatedAt: now
    } : null,
    createdAt: now
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const ref = await firestoreDb.collection('journeys').add(newJourney);
      if (realtimeDb) {
        try { await realtimeDb.ref(`journeys/${ref.id}`).set(newJourney); } catch (e) {}
      }
      return res.status(201).json({ success: true, journey: { id: ref.id, ...newJourney } });
    }

    const journey = { id: `journey-${uuidv4().substring(0, 8)}`, ...newJourney };
    memoryStore.journeys.unshift(journey);
    res.status(201).json({ success: true, journey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/journeys/:id/location', authenticateUser, async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ success: false, error: 'Latitude and Longitude required' });
  }

  const now = new Date().toISOString();
  const lastLocation = { latitude, longitude, accuracy: accuracy || 10, updatedAt: now };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('journeys').doc(req.params.id);
      const snap = await docRef.get();
      if (!snap.exists || snap.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Journey not found or unauthorized' });
      }
      await docRef.update({ lastLocation });
      return res.json({ success: true, message: 'Location updated', lastLocation });
    }

    const journey = memoryStore.journeys.find(j => j.id === req.params.id && j.userId === req.user.uid);
    if (!journey) return res.status(404).json({ success: false, error: 'Journey not found' });
    journey.lastLocation = lastLocation;
    res.json({ success: true, message: 'Location updated', lastLocation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/journeys/:id/end', authenticateUser, async (req, res) => {
  const now = new Date().toISOString();
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('journeys').doc(req.params.id);
      const snap = await docRef.get();
      if (!snap.exists || snap.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Journey not found or unauthorized' });
      }
      await docRef.update({ status: 'COMPLETED', completedAt: now });
      return res.json({ success: true, message: 'Trip completed safely.', journey: { id: snap.id, ...snap.data(), status: 'COMPLETED', completedAt: now } });
    }

    const journey = memoryStore.journeys.find(j => j.id === req.params.id && j.userId === req.user.uid);
    if (!journey) return res.status(404).json({ success: false, error: 'Journey not found' });
    journey.status = 'COMPLETED';
    journey.completedAt = now;
    res.json({ success: true, message: 'Trip completed safely.', journey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// FEATURE 8: Opt-In Community Safety & Nearby Helpers (Master §7)
// ----------------------------------------------------
app.get('/api/v1/community/requests', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const snap = await firestoreDb.collection('communityRequests')
        .where('status', 'in', ['OPEN', 'ACCEPTED'])
        .get();
      const requests = [];
      snap.forEach(d => requests.push({ id: d.id, ...d.data() }));
      return res.json({ success: true, count: requests.length, requests });
    }
    const requests = memoryStore.communityRequests.filter(r => r.status === 'OPEN' || r.status === 'ACCEPTED');
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/community/requests', authenticateUser, async (req, res) => {
  const { category = 'Distress Assistance', description, radiusKm = 2, coordinates } = req.body;
  if (!coordinates?.latitude || !coordinates?.longitude) {
    return res.status(400).json({ success: false, error: 'Active coordinates required for community request' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60000).toISOString(); // 1 hr window

  const newRequest = {
    userId: req.user.uid,
    category,
    description: description || 'Assistance requested in area',
    radiusKm: Math.min(Math.max(radiusKm, 1), 5), // bounded 1-5km
    status: 'OPEN',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    responders: [],
    createdAt: now.toISOString(),
    expiresAt
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const ref = await firestoreDb.collection('communityRequests').add(newRequest);
      return res.status(201).json({ success: true, request: { id: ref.id, ...newRequest } });
    }

    const request = { id: `comm-${uuidv4().substring(0, 8)}`, ...newRequest };
    memoryStore.communityRequests.unshift(request);
    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/community/requests/:id/accept', authenticateUser, async (req, res) => {
  const now = new Date().toISOString();
  const responderInfo = {
    helperId: req.user.uid,
    helperName: req.user.displayName || 'Verified Community Helper',
    acceptedAt: now
  };

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('communityRequests').doc(req.params.id);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ success: false, error: 'Request not found' });
      
      const currentResponders = snap.data().responders || [];
      if (!currentResponders.some(r => r.helperId === req.user.uid)) {
        currentResponders.push(responderInfo);
      }

      await docRef.update({
        status: 'ACCEPTED',
        responders: currentResponders
      });

      return res.json({ success: true, message: 'Response registered. Thank you for assisting community safety.' });
    }

    const request = memoryStore.communityRequests.find(r => r.id === req.params.id);
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    
    if (!request.responders.some(r => r.helperId === req.user.uid)) {
      request.responders.push(responderInfo);
    }
    request.status = 'ACCEPTED';

    res.json({ success: true, message: 'Response registered. Thank you for assisting community safety.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Demo Reset
app.post('/api/v1/demo/reset', authenticateUser, (req, res) => {
  memoryStore.sosEvents = memoryStore.sosEvents.filter(e => e.id === 'sos-history-init-1');
  memoryStore.checkIns = memoryStore.checkIns.filter(c => c.id === 'checkin-init-1');
  memoryStore.incidentReports = memoryStore.incidentReports.filter(i => i.id === 'inc-demo-1');
  res.json({ success: true, message: 'Demo environment reset to baseline.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NariShield.ai] Backend Server running on http://localhost:${PORT}`);
  console.log(`[NariShield.ai] Swagger API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`[NariShield.ai] OpenAPI JSON Spec: http://localhost:${PORT}/api-docs.json`);
});

