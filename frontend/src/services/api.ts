import type { UserProfile, TrustedContact, SOSEvent } from '../types';
import { auth } from '../firebase';

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';
export { BACKEND_URL, API_BASE };

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
    return res.json();
  },

  async getProfile(): Promise<{ success: boolean; profile: UserProfile }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/profile`, { headers });
    return res.json();
  },

  async updateProfile(data: Partial<UserProfile>): Promise<{ success: boolean; profile: UserProfile }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getContacts(): Promise<{ success: boolean; count: number; contacts: TrustedContact[] }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts`, { headers });
    return res.json();
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
    return res.json();
  },

  async updateContact(id: string, contact: Partial<TrustedContact>): Promise<{ success: boolean; contact: TrustedContact; error?: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(contact)
    });
    return res.json();
  },

  async deleteContact(id: string): Promise<{ success: boolean; removedId: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'DELETE',
      headers
    });
    return res.json();
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
    return res.json();
  },

  async getSOSHistory(): Promise<{ success: boolean; count: number; events: SOSEvent[] }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/sos/history`, { headers });
    return res.json();
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

  async resetDemo(): Promise<{ success: boolean; message: string }> {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/demo/reset`, {
      method: 'POST',
      headers
    });
    return res.json();
  }
};
