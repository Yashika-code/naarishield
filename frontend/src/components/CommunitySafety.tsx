import React, { useState, useEffect } from 'react';
import { Users2, HandHeart, Shield } from 'lucide-react';
import { api } from '../services/api';

import type { CommunityRequest } from '../types';

interface CommunitySafetyProps {
  currentCoordinates: { latitude: number; longitude: number; accuracy?: number } | null;
}

export const CommunitySafety: React.FC<CommunitySafetyProps> = ({ currentCoordinates }) => {
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
  const [optInConsent, setOptInConsent] = useState(false);
  const [description, setDescription] = useState('');
  const [radiusKm, setRadiusKm] = useState(2);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchCommunityRequests = async () => {
    try {
      const res = await api.getCommunityRequests();
      if (res.success) {
        setRequests(res.requests || []);
      }
    } catch (e) {
      console.warn('Could not fetch community requests:', e);
    }
  };

  useEffect(() => {
    fetchCommunityRequests();
  }, []);

  const handlePostRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCoordinates) {
      setStatusMessage('Active GPS location required to broadcast a community safety request.');
      return;
    }

    if (!optInConsent) {
      setStatusMessage('Please check the consent box to broadcast anonymous assistance requests.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.createCommunityRequest({
        category: 'Distress Assistance',
        description: description.trim() || 'Assistance requested nearby',
        radiusKm,
        coordinates: currentCoordinates
      });

      if (res.success) {
        setDescription('');
        setStatusMessage('Community request broadcasted to verified opt-in helpers nearby.');
        fetchCommunityRequests();
      }
    } catch (err: any) {
      setStatusMessage(err?.message || 'Failed to broadcast request.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      const res = await api.acceptCommunityRequest(requestId);
      if (res.success) {
        setStatusMessage('Thank you for offering assistance! Incident details shared.');
        fetchCommunityRequests();
      }
    } catch (err: any) {
      setStatusMessage(err?.message || 'Failed accepting request.');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900 text-sm md:text-base">
            Nearby Community Assistance (Opt-In)
          </h3>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {requests.length} Active Requests
        </span>
      </div>

      {statusMessage && (
        <div className="mb-3 p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Broadcast Request Form */}
      <form onSubmit={handlePostRequest} className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Request Community Helper</h4>
        <input
          type="text"
          placeholder="Brief situation (e.g. Broken vehicle, feel unsafe waiting alone)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />

        <div className="flex items-center justify-between text-xs">
          <label className="text-slate-600">Search Radius:</label>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="p-1 rounded border border-slate-300 bg-white text-xs"
          >
            <option value={1}>1 km radius</option>
            <option value={2}>2 km radius</option>
            <option value={5}>5 km radius (Max)</option>
          </select>
        </div>

        <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={optInConsent}
            onChange={(e) => setOptInConsent(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>I consent to sharing approximate incident details with verified community helpers. Exact personal identity remains private.</span>
        </label>

        <button
          type="submit"
          disabled={loading || !optInConsent}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition"
        >
          {loading ? 'Broadcasting...' : 'Broadcast Assistance Request'}
        </button>
      </form>

      {/* Active Requests Feed */}
      <div className="flex-1 overflow-y-auto space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Active Requests Nearby</h4>
        {requests.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <HandHeart className="w-8 h-8 mx-auto mb-1 opacity-40 text-slate-400" />
            <p className="text-xs">No active community distress alerts in your radius.</p>
          </div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {r.category}
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-1">{r.description}</p>
                </div>
                <span className="text-[10px] text-slate-400">
                  Radius: {r.radiusKm}km
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <span className="text-[11px] text-slate-500">
                  {r.responders?.length || 0} helpers responding
                </span>
                <button
                  onClick={() => handleAccept(r.id)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Offer Assistance
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
        Community alerts are opt-in and rate-limited. Exact live locations are never published to public maps.
      </div>
    </div>
  );
};
