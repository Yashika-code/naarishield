import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Eye, MapPin } from 'lucide-react';
import { api } from '../services/api';

export interface CircleMember {
  id: string;
  contactName: string;
  contactEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  shareLiveLocation: boolean;
  shareJourneyStatus: boolean;
  shareSosAlerts: boolean;
  createdAt: string;
}

export const SafetyCircle: React.FC = () => {
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [shareJourneyStatus, setShareJourneyStatus] = useState(true);
  const [shareSosAlerts, setShareSosAlerts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCircle = async () => {
    try {
      setLoading(true);
      const res = await api.getSafetyCircle();
      if (res.success) {
        setMembers(res.circle || []);
      }
    } catch (e: any) {
      console.warn('Failed to load safety circle:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCircle();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) {
      setError('Contact name and email are required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.inviteCircleMember({
        contactName,
        contactEmail,
        shareLiveLocation,
        shareJourneyStatus,
        shareSosAlerts
      });
      if (res.success) {
        setShowInviteForm(false);
        setContactName('');
        setContactEmail('');
        fetchCircle();
      } else {
        setError(res.error || 'Failed to send invitation');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke access for this safety circle contact?')) return;
    try {
      const res = await api.revokeCircleMember(id);
      if (res.success) {
        setMembers(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePermission = async (id: string, field: 'shareLiveLocation' | 'shareJourneyStatus' | 'shareSosAlerts', currentVal: boolean) => {
    try {
      const res = await api.updateCirclePermissions(id, { [field]: !currentVal });
      if (res.success) {
        setMembers(prev => prev.map(m => m.id === id ? { ...m, [field]: !currentVal } : m));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">
              Safety Circle & Guardians
            </h3>
            <span className="text-[11px] text-slate-500">
              Consent-Based Peer Protection
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg transition shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5" />
          {showInviteForm ? 'Cancel' : 'Invite Member'}
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
          {error}
        </div>
      )}

      {showInviteForm && (
        <form onSubmit={handleInvite} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Invite Trusted Guardian
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Guardian Name</label>
              <input
                type="text"
                placeholder="Full Name (e.g. Maya Sharma)"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="guardian@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-200">
            <span className="text-[11px] font-bold text-slate-700 block">Granular Sharing Permissions:</span>
            
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={shareJourneyStatus}
                onChange={(e) => setShareJourneyStatus(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Share Check-In journey start/finish status</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={shareSosAlerts}
                onChange={(e) => setShareSosAlerts(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Receive real-time distress SOS alerts</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={shareLiveLocation}
                onChange={(e) => setShareLiveLocation(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-700">Authorize continuous real-time GPS location sharing</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      )}

      {/* Members List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
        {members.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-slate-600">No safety circle members yet</p>
            <p className="text-xs">Invite trusted friends or relatives for reciprocal journey monitoring.</p>
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{member.contactName}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                      member.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{member.contactEmail}</span>
                </div>

                <button
                  onClick={() => handleRevoke(member.id)}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition"
                >
                  Revoke
                </button>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-2 text-[11px] pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleTogglePermission(member.id, 'shareJourneyStatus', member.shareJourneyStatus)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition ${
                    member.shareJourneyStatus
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Journey Status {member.shareJourneyStatus ? '✓' : '✗'}
                </button>

                <button
                  onClick={() => handleTogglePermission(member.id, 'shareSosAlerts', member.shareSosAlerts)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition ${
                    member.shareSosAlerts
                      ? 'bg-rose-50 border-rose-200 text-rose-700 font-medium'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  SOS Alerts {member.shareSosAlerts ? '✓' : '✗'}
                </button>

                <button
                  onClick={() => handleTogglePermission(member.id, 'shareLiveLocation', member.shareLiveLocation)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition ${
                    member.shareLiveLocation
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  Live GPS {member.shareLiveLocation ? '✓' : '✗'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
