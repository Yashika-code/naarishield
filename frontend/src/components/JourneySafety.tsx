import React, { useState, useEffect } from 'react';
import { Navigation, CheckCircle2, ShieldCheck, Play } from 'lucide-react';
import { api } from '../services/api';
import type { Journey, TrustedContact } from '../types';

interface JourneySafetyProps {
  contacts?: TrustedContact[];
  currentCoordinates: { latitude: number; longitude: number; accuracy?: number } | null;
}

export const JourneySafety: React.FC<JourneySafetyProps> = ({ currentCoordinates }) => {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [destination, setDestination] = useState('');
  const [etaMinutes, setEtaMinutes] = useState(30);
  const [selectedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const fetchJourneys = async () => {
    try {
      const res = await api.getJourneys();
      if (res.success) {
        setJourneys(res.journeys || []);
      }
    } catch (e) {
      console.warn('Could not load journeys:', e);
    }
  };

  useEffect(() => {
    fetchJourneys();
  }, []);

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError('Please enter a journey destination');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const arrival = new Date(Date.now() + etaMinutes * 60000).toISOString();
      const res = await api.createJourney({
        destination: destination.trim(),
        expectedArrivalTime: arrival,
        sharedContacts: selectedContacts,
        coordinates: currentCoordinates || undefined
      });

      if (res.success) {
        setDestination('');
        fetchJourneys();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start journey');
    } finally {
      setLoading(false);
    }
  };

  const handleEndTrip = async (journeyId: string) => {
    try {
      const res = await api.endJourney(journeyId);
      if (res.success) {
        fetchJourneys();
      }
    } catch (err: any) {
      console.error('Failed to end journey:', err);
    }
  };

  const activeJourney = journeys.find((j) => j.status === 'ACTIVE');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900 text-sm md:text-base">Live Journey & Trip Safety</h3>
        </div>
        {activeJourney && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full animate-pulse">
            Active Journey
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {activeJourney ? (
        <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs uppercase font-bold text-indigo-700">Heading to:</p>
                <h4 className="text-lg font-bold text-slate-900">{activeJourney.destination}</h4>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase">Expected Arrival</p>
                <p className="text-xs font-semibold text-indigo-900">
                  {new Date(activeJourney.expectedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="mt-3 p-2.5 bg-white rounded-lg border border-indigo-100 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Live location shared with {activeJourney.sharedContacts?.length || 'all'} emergency contacts</span>
              </div>
              {currentCoordinates && (
                <p className="text-[11px] font-mono text-slate-400">
                  📍 Last update: {currentCoordinates.latitude.toFixed(4)}, {currentCoordinates.longitude.toFixed(4)}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => handleEndTrip(activeJourney.id)}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>I have Arrived (End Trip)</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleStartTrip} className="space-y-3 flex-1">
          <p className="text-xs text-slate-600">
            Share continuous journey checkpoints with your trusted contacts until you arrive safely at your destination.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Destination Address or Landmark</label>
            <input
              type="text"
              placeholder="e.g. Rajiv Chowk Metro Station"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Travel Time (Minutes)</label>
            <select
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none"
            >
              <option value={15}>15 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={45}>45 Minutes</option>
              <option value={60}>1 Hour</option>
              <option value={90}>1.5 Hours</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{loading ? 'Starting...' : 'Start Safe Journey'}</span>
          </button>
        </form>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
        Continuous location tracking remains active only while granted. Permissions automatically terminate when your journey ends.
      </div>
    </div>
  );
};
