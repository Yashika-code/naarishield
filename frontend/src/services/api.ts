import type { UserProfile, TrustedContact, SOSEvent } from '../types';
import { auth } from '../firebase';

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_BASE = `${BACKEND_URL}/api/v1`;
export { BACKEND_URL, API_BASE };

const safeJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return { success: res.ok };
  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: false, error: text || 'Invalid JSON response from server' };
  }
};

const getHeaders = async () => {
  let token = 'demo-token';
  try {
    if (auth?.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
  } catch (err) {
    console.warn('[API Service] Failed getting Firebase ID token, using fallback:', err);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return safeJson(res);
  },

  async getProfile(): Promise<{ success: boolean; profile: UserProfile }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/profile`, { headers });
    return safeJson(res);
  },

  async updateProfile(data: Partial<UserProfile>): Promise<{ success: boolean; profile: UserProfile }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    return safeJson(res);
  },


  async getContacts(): Promise<{ success: boolean; count: number; contacts: TrustedContact[] }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts`, { headers });
    return safeJson(res);
  },

  async addContact(contact: { name: string; phoneNumber?: string; phone?: string; relationship?: string; priority?: number }): Promise<{ success: boolean; contact: TrustedContact; error?: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...contact,
        phoneNumber: contact.phoneNumber || contact.phone
      })
    });
    return safeJson(res);
  },

  async updateContact(id: string, contact: Partial<TrustedContact>): Promise<{ success: boolean; contact: TrustedContact; error?: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(contact)
    });
    return safeJson(res);
  },

  async deleteContact(id: string): Promise<{ success: boolean; removedId: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'DELETE',
      headers
    });
    return safeJson(res);
  },

  async triggerSOS(data: {
    idempotencyKey: string;
    triggerSource: 'manual' | 'voice';
    coordinates?: { latitude: number; longitude: number; accuracy?: number } | null;
    batteryLevel?: number;
    notes?: string;
  }): Promise<{ success: boolean; message: string; duplicatePrevented?: boolean; sosEvent: SOSEvent }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/sos/trigger`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return safeJson(res);
  },

  async getSOSHistory(): Promise<{ success: boolean; count: number; events: SOSEvent[] }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/sos/history`, { headers });
    return safeJson(res);
  },


  async cancelSOS(id: string, reason?: string): Promise<{ success: boolean; message: string; event: SOSEvent }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/sos/${id}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: reason || 'User marked safe' })
    });
    return res.json();
  },

  // Check-In API endpoints
  async getCheckIns() {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/check-ins`, { headers });
    return res.json();
  },

  async createCheckIn(data: { durationMinutes: number; destination?: string; notes?: string; notifyOnMissed?: boolean }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/check-ins`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async confirmCheckIn(id: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/check-ins/${id}/confirm`, {
      method: 'POST',
      headers
    });
    return res.json();
  },

  async extendCheckIn(id: string, addedMinutes: number) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/check-ins/${id}/extend`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ addedMinutes })
    });
    return res.json();
  },

  async cancelCheckIn(id: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/check-ins/${id}/cancel`, {
      method: 'POST',
      headers
    });
    return res.json();
  },

  // Incident Reports
  async getIncidents() {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/incidents`, { headers });
    return res.json();
  },

  async createIncident(data: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/incidents`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteIncident(id: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      method: 'DELETE',
      headers
    });
    return res.json();
  },

  // Safety Circle
  async getSafetyCircle() {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/safety-circle`, { headers });
    return res.json();
  },

  async inviteCircleMember(data: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/safety-circle/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async revokeCircleMember(id: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/safety-circle/${id}`, {
      method: 'DELETE',
      headers
    });
    return res.json();
  },

  async updateCirclePermissions(id: string, permissions: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/safety-circle/${id}/permissions`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(permissions)
    });
    return res.json();
  },

  // Resources Directory
  async getNearbyResources(latitude: number, longitude: number, type?: string) {
    const res = await fetch(`${API_BASE}/resources/nearby?lat=${latitude}&lng=${longitude}&type=${type || 'all'}`);
    return res.json();
  },

  // Safety Plans
  async getSafetyPlans() {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/safety-plans`, { headers });
    return res.json();
  },

  async generateSafetyPlan(data: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/safety-plans/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async inviteContact(contactId: string): Promise<{ success: boolean; message: string; result: any }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts/${contactId}/invite`, {
      method: 'POST',
      headers
    });
    return res.json();
  },

  async verifyContact(contactId: string, token?: string): Promise<{ success: boolean; message: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts/${contactId}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token })
    });
    return res.json();
  },

  async getIncidentEvents(incidentId: string): Promise<{ success: boolean; timeline: any[]; notifications: any[] }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/events`, { headers });
    return res.json();
  },

  async acknowledgeIncident(incidentId: string, contactId?: string, responderName?: string): Promise<{ success: boolean; message: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/acknowledge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactId, responderName })
    });
    return res.json();
  },

  // Journey Sharing (Master §10)
  async getJourneys() {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/journeys`, { headers });
    return res.json();
  },

  async createJourney(data: { destination: string; expectedArrivalTime?: string; sharedContacts?: string[]; coordinates?: { latitude: number; longitude: number; accuracy?: number } }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/journeys`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateJourneyLocation(journeyId: string, coordinates: { latitude: number; longitude: number; accuracy?: number }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/journeys/${journeyId}/location`, {
      method: 'POST',
      headers,
      body: JSON.stringify(coordinates)
    });
    return res.json();
  },

  async endJourney(journeyId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/journeys/${journeyId}/end`, {
      method: 'POST',
      headers
    });
    return res.json();
  },

  // Community Assistance (Master §7)
  async getCommunityRequests() {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/community/requests`, { headers });
    return res.json();
  },

  async createCommunityRequest(data: { category?: string; description: string; radiusKm?: number; coordinates: { latitude: number; longitude: number } }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/community/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async acceptCommunityRequest(requestId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/community/requests/${requestId}/accept`, {
      method: 'POST',
      headers
    });
    return res.json();
  },

  async resetDemo(): Promise<{ success: boolean; message: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/demo/reset`, {
      method: 'POST',
      headers
    });
    return res.json();
  }
};

