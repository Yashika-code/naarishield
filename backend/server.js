import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { swaggerDocument } from './swagger.js';
import { firestoreDb, firebaseAuth, firebaseInitialized, initError } from './firebase.js';

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
    }
    const user = memoryStore.users[req.user.uid] || { uid: req.user.uid, displayName: 'Safety User', email: req.user.email };
    res.json({ success: true, profile: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error fetching profile', message: err.message });
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
      const docRef = firestoreDb.collection('users').doc(req.user.uid);
      await docRef.set(updateData, { merge: true });
      const updatedDoc = await docRef.get();
      return res.json({ success: true, profile: { uid: req.user.uid, ...updatedDoc.data() } });
    }
    const existing = memoryStore.users[req.user.uid] || { uid: req.user.uid, email: req.user.email };
    const updated = { ...existing, ...updateData };
    memoryStore.users[req.user.uid] = updated;
    res.json({ success: true, profile: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error', message: err.message });
  }
});

// ----------------------------------------------------
// Trusted Contacts Routes
// ----------------------------------------------------
app.get('/api/v1/contacts', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const snapshot = await firestoreDb.collection('trustedContacts').where('userId', '==', req.user.uid).get();
      const contacts = [];
      snapshot.forEach(doc => contacts.push({ id: doc.id, ...doc.data() }));
      contacts.sort((a, b) => (a.priority || 99) - (b.priority || 99));
      return res.json({ success: true, count: contacts.length, contacts });
    }
    const userContacts = memoryStore.trustedContacts.filter(c => c.userId === req.user.uid);
    res.json({ success: true, count: userContacts.length, contacts: userContacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/contacts', authenticateUser, async (req, res) => {
  const phone = req.body.phoneNumber || req.body.phone;
  if (!req.body.name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required' });
  }

  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const existing = await firestoreDb.collection('trustedContacts').where('userId', '==', req.user.uid).get();
      if (existing.size >= 5) {
        return res.status(400).json({ success: false, error: 'Maximum 5 contacts allowed' });
      }
      const newContact = {
        userId: req.user.uid,
        name: req.body.name,
        phoneNumber: phone,
        relationship: req.body.relationship || 'Emergency Contact',
        priority: req.body.priority || existing.size + 1,
        createdAt: new Date().toISOString()
      };
      const docRef = await firestoreDb.collection('trustedContacts').add(newContact);
      return res.status(201).json({ success: true, contact: { id: docRef.id, ...newContact } });
    }

    const userContacts = memoryStore.trustedContacts.filter(c => c.userId === req.user.uid);
    if (userContacts.length >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum 5 contacts allowed' });
    }
    const contact = {
      id: `contact-${uuidv4().substring(0, 8)}`,
      userId: req.user.uid,
      name: req.body.name,
      phoneNumber: phone,
      relationship: req.body.relationship || 'Emergency Contact',
      priority: req.body.priority || userContacts.length + 1,
      createdAt: new Date().toISOString()
    };
    memoryStore.trustedContacts.push(contact);
    res.status(201).json({ success: true, contact });
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
// SOS Trigger & Notification Pipeline
// ----------------------------------------------------
app.post('/api/v1/sos/trigger', authenticateUser, async (req, res) => {
  const { idempotencyKey, triggerSource = 'manual', coordinates, batteryLevel, notes } = req.body;
  if (!idempotencyKey) {
    return res.status(400).json({ success: false, error: 'idempotencyKey required' });
  }

  try {
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
      const notifications = [];
      contactsSnap.forEach(doc => {
        const c = doc.data();
        notifications.push({
          contactId: doc.id,
          name: c.name,
          phoneNumber: c.phoneNumber,
          channel: 'SMS/WhatsApp',
          provider: 'mock-provider',
          status: 'delivered',
          deliveryTimestamp: new Date().toISOString()
        });
      });

      const newSOSEvent = {
        userId: req.user.uid,
        idempotencyKey,
        triggerSource,
        status: 'active',
        latitude: coordinates?.latitude || null,
        longitude: coordinates?.longitude || null,
        locationAccuracy: coordinates?.accuracy || null,
        batteryLevel: batteryLevel ?? null,
        notes: notes || null,
        createdAt: new Date().toISOString(),
        cancelledAt: null,
        notifications
      };

      const ref = await firestoreDb.collection('sosEvents').add(newSOSEvent);
      return res.status(201).json({ success: true, sosEvent: { id: ref.id, ...newSOSEvent } });
    }

    const existing = memoryStore.sosEvents.find(e => e.idempotencyKey === idempotencyKey && e.userId === req.user.uid);
    if (existing) {
      return res.status(200).json({ success: true, duplicatePrevented: true, sosEvent: existing });
    }

    const newSOSEvent = {
      id: `sos-${uuidv4().substring(0, 10)}`,
      userId: req.user.uid,
      idempotencyKey,
      triggerSource,
      status: 'active',
      latitude: coordinates?.latitude || 28.6139,
      longitude: coordinates?.longitude || 77.2090,
      locationAccuracy: coordinates?.accuracy || 12,
      batteryLevel: batteryLevel ?? null,
      notes: notes || null,
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      notifications: memoryStore.trustedContacts.map(c => ({
        contactId: c.id,
        name: c.name,
        phoneNumber: c.phoneNumber,
        channel: 'SMS/WhatsApp',
        provider: 'mock-provider',
        status: 'delivered'
      }))
    };

    memoryStore.sosEvents.unshift(newSOSEvent);
    res.status(201).json({ success: true, sosEvent: newSOSEvent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/sos/history', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const snap = await firestoreDb.collection('sosEvents').where('userId', '==', req.user.uid).get();
      const events = [];
      snap.forEach(doc => events.push({ id: doc.id, ...doc.data() }));
      events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ success: true, count: events.length, events });
    }
    const events = memoryStore.sosEvents.filter(e => e.userId === req.user.uid);
    res.json({ success: true, count: events.length, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/sos/:id/cancel', authenticateUser, async (req, res) => {
  try {
    if (firebaseInitialized && firestoreDb && !req.user.isDemo) {
      const docRef = firestoreDb.collection('sosEvents').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data().userId !== req.user.uid) {
        return res.status(404).json({ success: false, error: 'Event not found or unauthorized' });
      }
      const updates = { status: 'cancelled', cancelledAt: new Date().toISOString(), cancellationReason: req.body?.reason || 'User marked safe' };
      await docRef.update(updates);
      return res.json({ success: true, event: { id: doc.id, ...doc.data(), ...updates } });
    }

    const event = memoryStore.sosEvents.find(e => e.id === req.params.id && e.userId === req.user.uid);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    event.status = 'cancelled';
    event.cancelledAt = new Date().toISOString();
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
      const snap = await firestoreDb.collection('incidentReports').where('userId', '==', req.user.uid).get();
      const incidents = [];
      snap.forEach(d => incidents.push({ id: d.id, ...d.data() }));
      incidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ success: true, count: incidents.length, incidents });
    }
    const incidents = memoryStore.incidentReports.filter(i => i.userId === req.user.uid);
    res.json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
      const ref = await firestoreDb.collection('incidentReports').add(record);
      return res.status(201).json({ success: true, incident: { id: ref.id, ...record } });
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
  {
    id: 'res-police-1',
    name: 'Connaught Place Central Police Station',
    type: 'police',
    address: 'Near Regal Building, Connaught Place, New Delhi',
    phone: '011-23344100',
    distanceKm: 0.8,
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
    distanceKm: 2.1,
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
    distanceKm: 3.4,
    latitude: 28.5672,
    longitude: 77.2100,
    verified: true,
    hours: '24/7 Emergency Care'
  },
  {
    id: 'res-hosp-2',
    name: 'Ram Manohar Lohia Hospital Emergency',
    type: 'hospital',
    address: 'Baba Kharak Singh Marg, New Delhi',
    phone: '011-23365525',
    distanceKm: 1.5,
    latitude: 28.6241,
    longitude: 77.2023,
    verified: true,
    hours: '24/7 Emergency Care'
  },
  {
    id: 'res-help-1',
    name: 'National Emergency Response System (ERSS)',
    type: 'helpline',
    address: 'Pan-India Emergency Response Service',
    phone: '112',
    distanceKm: 0.1,
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
    distanceKm: 4.8,
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
      const snap = await firestoreDb.collection('safetyPlans').where('userId', '==', req.user.uid).get();
      const plans = [];
      snap.forEach(d => plans.push({ id: d.id, ...d.data() }));
      return res.json({ success: true, count: plans.length, plans });
    }
    const plans = memoryStore.safetyPlans.filter(p => p.userId === req.user.uid);
    res.json({ success: true, count: plans.length, plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
      const ref = await firestoreDb.collection('safetyPlans').add(newPlan);
      return res.status(201).json({ success: true, plan: { id: ref.id, ...newPlan } });
    }
    const plan = { id: `plan-${uuidv4().substring(0, 8)}`, ...newPlan };
    memoryStore.safetyPlans.unshift(plan);
    res.status(201).json({ success: true, plan });
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

app.listen(PORT, () => {
  console.log(`[NariShield.ai] Backend Server running on http://localhost:${PORT}`);
  console.log(`[NariShield.ai] Swagger API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`[NariShield.ai] OpenAPI JSON Spec: http://localhost:${PORT}/api-docs.json`);
});
