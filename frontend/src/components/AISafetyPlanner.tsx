import { useState, useEffect } from 'react';
import { Sparkles, CheckSquare, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export interface SafetyPlan {
  id: string;
  journeyType: string;
  destination: string;
  departureTime: string;
  transportMode: string;
  checklist: string[];
  recommendations: string[];
  isAiGenerated: boolean;
  createdAt: string;
}

export const AISafetyPlanner: React.FC = () => {
  const [, setPlans] = useState<SafetyPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SafetyPlan | null>(null);
  const [journeyType, setJourneyType] = useState('Night Commute');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState('21:00');
  const [transportMode, setTransportMode] = useState('Metro / Public Transit');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      const res = await api.getSafetyPlans();
      if (res.success) {
        setPlans(res.plans || []);
        if (res.plans?.length > 0 && !currentPlan) {
          setCurrentPlan(res.plans[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch safety plans:', e);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError('Please provide a destination.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.generateSafetyPlan({
        journeyType,
        destination,
        departureTime,
        transportMode
      });
      if (res.success) {
        setCurrentPlan(res.plan);
        setPlans(prev => [res.plan, ...prev]);
      } else {
        setError(res.error || 'Failed to generate plan');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error generating plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-violet-100 text-violet-700 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">
              AI Safety Planner
            </h3>
            <span className="text-[11px] text-slate-500">
              Predictive Commute & Journey Safety Checklists
            </span>
          </div>
        </div>

        {currentPlan && (
          <span className="text-[11px] bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-full border border-violet-200">
            {currentPlan.isAiGenerated ? 'AI Assisted' : 'Curated Safety Model'}
          </span>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleGenerate} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Commute Type</label>
            <select
              value={journeyType}
              onChange={(e) => setJourneyType(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="Night Commute">Night Commute</option>
              <option value="Solo Travel">Solo Outstation Travel</option>
              <option value="Cab Ride">Late Night Cab / Rideshare</option>
              <option value="Walking">Walking Through Unfamiliar Area</option>
              <option value="Public Transit">Subway / Bus Commute</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Destination</label>
            <input
              type="text"
              placeholder="e.g. South Delhi, Airport Terminal 3"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Estimated Departure</label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mode of Transport</label>
            <select
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="Metro / Public Transit">Metro / Rapid Transit</option>
              <option value="Ride-hailing (Uber/Ola)">Ride-hailing (Uber/Ola/Cab)</option>
              <option value="Personal Vehicle">Personal Vehicle</option>
              <option value="Walking">Walking / On Foot</option>
              <option value="Auto-Rickshaw">Auto-Rickshaw</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loading ? 'Synthesizing...' : 'Generate Checklist'}
          </button>
        </div>
      </form>

      {/* Generated Plan Display */}
      {currentPlan && (
        <div className="p-4 rounded-xl border border-violet-100 bg-violet-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">
              Custom Safety Plan: {currentPlan.destination} ({currentPlan.journeyType})
            </h4>
            <span className="text-[11px] text-slate-500">
              Est: {currentPlan.departureTime} • {currentPlan.transportMode}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-violet-800 block mb-1.5">
              Recommended Pre-Departure Checklist:
            </span>
            <div className="space-y-1.5">
              {currentPlan.checklist.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
              Tactical Precaution Measures:
            </span>
            <div className="space-y-1.5">
              {currentPlan.recommendations.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                  <ArrowRight className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span>
          Safety plans are recommendations generated for situational awareness. In immediate life safety situations, activate the SOS trigger or dial 112 directly.
        </span>
      </div>
    </div>
  );
};
