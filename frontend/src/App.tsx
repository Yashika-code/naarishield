import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  RefreshCw, 
  ExternalLink,
  Info,
  LogIn,
  LogOut,
  Database,
  Timer,
  FileText,
  Users,
  Navigation,
  Sparkles
} from 'lucide-react';
import { api, BACKEND_URL } from './services/api';
import type { UserProfile, TrustedContact, SOSEvent } from './types';
import { SafetyMap } from './components/SafetyMap';
import { ContactManager } from './components/ContactManager';
import { SOSHistory } from './components/SOSHistory';
import { SOSModal } from './components/SOSModal';
import { AuthModal } from './components/AuthModal';
import { EmergencySiren } from './components/EmergencySiren';
import { SafetyCheckInTimer } from './components/SafetyCheckInTimer';
import { IncidentReports } from './components/IncidentReports';
import { SafetyCircle } from './components/SafetyCircle';
import { EmergencyResources } from './components/EmergencyResources';
import { AISafetyPlanner } from './components/AISafetyPlanner';
import { auth, signOut, onAuthStateChanged, type User } from './firebase';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const apiDocUrl = BACKEND_URL || 'http://localhost:5000';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [activeSOS, setActiveSOS] = useState<SOSEvent | null>(null);
  const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
  const [, setIsLoading] = useState(true);
  const [backendHealth, setBackendHealth] = useState<{ database?: string; firebaseInitialized?: boolean } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'checkin' | 'incidents' | 'circle' | 'resources' | 'planner'>('dashboard');

  // Geolocation
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>({
    latitude: 28.6139,
    longitude: 77.2090,
    accuracy: 12
  });
  const [locationStatus, setLocationStatus] = useState<'available' | 'denied' | 'requesting' | 'unavailable'>('available');

  useEffect(() => {
    let unsubscribe = () => {};
    if (auth) {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        fetchAppData();
      });
    }
    return () => unsubscribe();
  }, []);

  const fetchAppData = async () => {
    try {
      setIsLoading(true);
      const [profileRes, contactsRes, historyRes, healthRes] = await Promise.all([
        api.getProfile(),
        api.getContacts(),
        api.getSOSHistory(),
        api.getHealth().catch(() => null)
      ]);

      if (healthRes) {
        setBackendHealth(healthRes);
      }

      if (profileRes?.success) setProfile(profileRes.profile);
      if (contactsRes?.success) setContacts(contactsRes.contacts);
      if (historyRes?.success) {
        setSosEvents(historyRes.events);
        const active = historyRes.events.find(e => e.status === 'active');
        setActiveSOS(active || null);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setStatusMessage({ text: 'Unable to connect to backend server. Running in fallback mode.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppData();
    requestBrowserLocation();
  }, []);

  const requestBrowserLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
        setLocationStatus('available');
      },
      () => {
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleTriggerSOS = async (triggerSource: 'manual' | 'voice'): Promise<SOSEvent | null> => {
    try {
      const idempotencyKey = `sos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await api.triggerSOS({
        idempotencyKey,
        triggerSource,
        coordinates,
        notes: triggerSource === 'voice' ? 'Triggered via voice keyword simulation' : 'Manual button activation'
      });

      if (res.success) {
        setActiveSOS(res.sosEvent);
        setSosEvents(prev => [res.sosEvent, ...prev]);
        setStatusMessage({ text: `SOS Alert successfully dispatched via ${triggerSource.toUpperCase()}`, type: 'success' });
        return res.sosEvent;
      }
      return null;
    } catch (err: any) {
      setStatusMessage({ text: 'Failed to dispatch SOS alert.', type: 'error' });
      return null;
    }
  };

  const handleCancelSOS = async (id: string) => {
    try {
      const res = await api.cancelSOS(id, 'User confirmed safe via web dashboard');
      if (res.success) {
        setActiveSOS(null);
        setSosEvents(prev => prev.map(e => e.id === id ? res.event : e));
        setStatusMessage({ text: 'SOS alert cancelled. Safety status restored.', type: 'info' });
        setIsSOSModalOpen(false);
      }
    } catch (err) {
      setStatusMessage({ text: 'Could not cancel alert.', type: 'error' });
    }
  };

  const handleAddContact = async (contact: { name: string; phone?: string; phoneNumber?: string; relationship?: string; priority?: number }) => {
    const res = await api.addContact({
      name: contact.name,
      phoneNumber: contact.phoneNumber || contact.phone,
      relationship: contact.relationship,
      priority: contact.priority
    });
    if (res.success) {
      setContacts(prev => [...prev, res.contact]);
      setStatusMessage({ text: `Added ${res.contact.name} to emergency contacts.`, type: 'success' });
    } else {
      throw new Error(res.error || 'Failed to add contact');
    }
  };

  const handleDeleteContact = async (id: string) => {
    const res = await api.deleteContact(id);
    if (res.success) {
      setContacts(prev => prev.filter(c => c.id !== id));
      setStatusMessage({ text: 'Emergency contact removed.', type: 'info' });
    }
  };

  const handleResetDemo = async () => {
    try {
      await api.resetDemo();
      await fetchAppData();
      setStatusMessage({ text: 'Demo environment reset to baseline.', type: 'success' });
    } catch {
      setStatusMessage({ text: 'Failed to reset demo.', type: 'error' });
    }
  };

  const handleSignOut = async () => {
    try {
      if (auth) await signOut(auth);
      setCurrentUser(null);
      await fetchAppData();
      setStatusMessage({ text: 'Signed out successfully.', type: 'info' });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Banner Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-xl shadow-md">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight">NariShield<span className="text-red-500">.ai</span></span>
              <span className="hidden sm:inline-block ml-2 text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                SafeTech Suite
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 hidden md:inline">
                  {currentUser.displayName || currentUser.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-red-400 px-3 py-1.5 rounded-lg border border-slate-700 transition font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            )}

            <a
              href={`${apiDocUrl}/api-docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <span>Swagger Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={handleResetDemo}
              className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition flex items-center gap-1"
              title="Reset Demo Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* Safety Notice Strip */}
      <div className="bg-slate-900/95 text-slate-300 text-xs px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {backendHealth?.firebaseInitialized ? (
                <strong className="text-emerald-400">Firebase Firestore Active: Real cloud storage enabled.</strong>
              ) : (
                <><strong>Safe Demo Mode Active:</strong> In-memory storage active. Siren and offline safety features fully functional.</>
              )}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-indigo-400" />
              Database: <strong className="text-indigo-300">{backendHealth?.database || 'Firestore'}</strong>
            </span>
            <span>REST API: <strong className="text-emerald-400">v1.2.0</strong></span>
          </div>
        </div>
      </div>

      {/* Feature Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Emergency SOS & Map
          </button>

          <button
            onClick={() => setActiveTab('checkin')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'checkin'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            Safety Check-in Timer
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'incidents'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Incident Reports & PDF
          </button>

          <button
            onClick={() => setActiveTab('circle')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'circle'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Safety Circle
          </button>

          <button
            onClick={() => setActiveTab('resources')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'resources'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            Nearby Resources
          </button>

          <button
            onClick={() => setActiveTab('planner')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'planner'
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Safety Planner
          </button>
        </div>
      </div>

      {/* Status Toasts */}
      {statusMessage && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-3">
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="ml-2 font-bold opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        {/* Top Emergency Trigger Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden border border-slate-800">
          <div className="space-y-1.5 text-center md:text-left z-10">
            <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 text-xs font-bold px-3 py-0.5 rounded-full border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              SAFETY SHIELD ACTIVE
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Emergency Distress & Guardian Broadcast
            </h1>
            <p className="text-xs text-slate-300 max-w-lg">
              Broadcasts real-time GPS coordinates to your registered emergency contacts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 z-10 w-full sm:w-auto">
            <button
              onClick={() => setIsSOSModalOpen(true)}
              className={`w-full sm:w-auto px-7 py-4 rounded-xl font-black text-base tracking-wider uppercase transition shadow-2xl flex items-center justify-center gap-2 cursor-pointer ${
                activeEventIsActive(activeSOS)
                  ? 'bg-red-600 hover:bg-red-700 text-white sos-pulse-btn'
                  : 'bg-red-600 hover:bg-red-700 active:scale-95 text-white hover:shadow-red-600/40'
              }`}
            >
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              {activeEventIsActive(activeSOS) ? 'ACTIVE SOS (OPEN)' : 'TRIGGER SOS'}
            </button>
          </div>
        </div>

        {/* Tab 1: Dashboard (Siren, Map, Contacts, History) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Feature 1: Emergency Siren Sound */}
            <EmergencySiren />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1 & 2: Map & Contacts */}
              <div className="lg:col-span-2 space-y-6 flex flex-col">
                <div className="h-[360px]">
                  <SafetyMap
                    coordinates={coordinates}
                    locationStatus={locationStatus}
                    onRequestLocation={requestBrowserLocation}
                    isSimulated={locationStatus !== 'available'}
                  />
                </div>

                <div className="flex-1 min-h-[300px]">
                  <ContactManager
                    contacts={contacts}
                    onAddContact={handleAddContact}
                    onDeleteContact={handleDeleteContact}
                  />
                </div>
              </div>

              {/* Column 3: Incident History & System Readiness */}
              <div className="space-y-6 flex flex-col">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-600" />
                    System Readiness
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Active User:</span>
                      <span className="font-medium text-slate-900">
                        {currentUser?.displayName || currentUser?.email || profile?.displayName || 'Guest User (Not Signed In)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Firestore Persistence:</span>
                      <span className={`font-semibold px-2 py-0.5 rounded ${
                        backendHealth?.firebaseInitialized ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                      }`}>
                        {backendHealth?.firebaseInitialized ? 'Connected' : 'Demo Memory'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">GPS Accuracy:</span>
                      <span className="text-slate-800 font-medium">
                        {coordinates ? `±${coordinates.accuracy || 10} meters` : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <SOSHistory events={sosEvents} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Feature 2: Safety Check-In Timer */}
        {activeTab === 'checkin' && (
          <div className="max-w-3xl mx-auto">
            <SafetyCheckInTimer />
          </div>
        )}

        {/* Tab 3: Feature 3: Incident Reports & PDF Export */}
        {activeTab === 'incidents' && (
          <div className="max-w-4xl mx-auto">
            <IncidentReports />
          </div>
        )}

        {/* Tab 4: Feature 4: Safety Circle */}
        {activeTab === 'circle' && (
          <div className="max-w-3xl mx-auto">
            <SafetyCircle />
          </div>
        )}

        {/* Tab 5: Feature 5: Nearby Emergency Resources */}
        {activeTab === 'resources' && (
          <div className="max-w-4xl mx-auto">
            <EmergencyResources />
          </div>
        )}

        {/* Tab 6: Feature 6: AI Safety Planner */}
        {activeTab === 'planner' && (
          <div className="max-w-3xl mx-auto">
            <AISafetyPlanner />
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={fetchAppData}
      />

      {/* SOS Modal Workflow */}
      <SOSModal
        isOpen={isSOSModalOpen}
        onClose={() => setIsSOSModalOpen(false)}
        onConfirmTrigger={handleTriggerSOS}
        activeEvent={activeSOS}
        onCancelActiveSOS={handleCancelSOS}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© 2026 NariShield.ai Smart Women's Safety Web Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href={`${apiDocUrl}/api-docs`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              API Docs (/api-docs)
            </a>
            <a href={`${apiDocUrl}/api-docs.json`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              OpenAPI Spec (/api-docs.json)
            </a>
            <a href={`${apiDocUrl}/api/v1/health`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              Health Check (/api/v1/health)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function activeEventIsActive(event: SOSEvent | null): boolean {
  return !!event && event.status === 'active';
}

export default App;
