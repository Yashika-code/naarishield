import React, { useState, useEffect } from 'react';
import { Timer, CheckCircle, PlusCircle, AlertTriangle, Clock, XCircle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface CheckInRecord {
  id: string;
  userId: string;
  durationMinutes: number;
  destination?: string;
  notes?: string;
  status: 'active' | 'completed' | 'missed' | 'cancelled';
  notifyOnMissed: boolean;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
}

export const SafetyCheckInTimer: React.FC = () => {
  const [activeCheckIn, setActiveCheckIn] = useState<CheckInRecord | null>(null);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [duration, setDuration] = useState<number>(15);
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyOnMissed, setNotifyOnMissed] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckIns = async () => {
    try {
      const res = await api.getCheckIns();
      if (res.success) {
        setHistory(res.checkIns || []);
        const current = (res.checkIns || []).find((c: CheckInRecord) => c.status === 'active');
        setActiveCheckIn(current || null);
      }
    } catch (e) {
      console.warn('Failed to fetch check-ins:', e);
    }
  };

  useEffect(() => {
    fetchCheckIns();
  }, []);

  // Countdown timer logic
  useEffect(() => {
    if (!activeCheckIn || activeCheckIn.status !== 'active') {
      setRemainingSeconds(null);
      return;
    }

    const updateTimer = () => {
      const expiry = new Date(activeCheckIn.expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        // Re-check with backend to get missed status update
        fetchCheckIns();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeCheckIn]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.createCheckIn({
        durationMinutes: duration,
        destination,
        notes,
        notifyOnMissed
      });
      if (res.success) {
        setActiveCheckIn(res.checkIn);
        setDestination('');
        setNotes('');
        fetchCheckIns();
      } else {
        setError(res.error || 'Failed to start check-in timer');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSafe = async () => {
    if (!activeCheckIn) return;
    setLoading(true);
    try {
      const res = await api.confirmCheckIn(activeCheckIn.id);
      if (res.success) {
        setActiveCheckIn(null);
        fetchCheckIns();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async (addedMinutes: number) => {
    if (!activeCheckIn) return;
    setLoading(true);
    try {
      const res = await api.extendCheckIn(activeCheckIn.id, addedMinutes);
      if (res.success) {
        setActiveCheckIn(res.checkIn);
        fetchCheckIns();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeCheckIn) return;
    setLoading(true);
    try {
      const res = await api.cancelCheckIn(activeCheckIn.id);
      if (res.success) {
        setActiveCheckIn(null);
        fetchCheckIns();
      }
    } finally {
      setLoading(false);
    }
  };

  const formatSeconds = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">
              Safety Check-In Timer
            </h3>
            <span className="text-[11px] text-slate-500">
              Automated Journey & Departure Monitor
            </span>
          </div>
        </div>

        {activeCheckIn && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Monitoring Journey
          </span>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
          {error}
        </div>
      )}

      {activeCheckIn ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-4">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            {activeCheckIn.destination ? `En Route to ${activeCheckIn.destination}` : 'Active Journey Check-In'}
          </div>

          <div className="text-5xl sm:text-6xl font-black font-mono text-slate-900 tracking-tight">
            {remainingSeconds !== null ? formatSeconds(remainingSeconds) : '--:--'}
          </div>

          <div className="text-xs text-slate-500 max-w-sm mx-auto">
            {remainingSeconds !== null && remainingSeconds > 0
              ? 'Please confirm you are safe before the countdown expires. Server will notify emergency contacts if missed.'
              : 'Timer reached expiry. Server grace period active.'}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={handleConfirmSafe}
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <CheckCircle className="w-4 h-4" />
              I'm Safe
            </button>

            <button
              onClick={() => handleExtend(15)}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs flex items-center gap-1 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              +15 Mins
            </button>

            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs flex items-center gap-1 transition"
            >
              <XCircle className="w-3.5 h-3.5" />
              End Journey
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStart} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Check-in Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setDuration(mins)}
                  className={`py-2 text-xs font-bold rounded-xl border transition ${
                    duration === mins
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Destination (e.g., Home, Metro Station)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Optional Route Note (e.g., Auto #DL01AB)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnMissed}
                onChange={(e) => setNotifyOnMissed(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Notify emergency contacts if check-in is missed</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
            >
              Start Timer
            </button>
          </div>
        </form>
      )}

      {/* Recent Check-Ins History Preview */}
      {history.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Recent Check-In Status
          </span>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {history.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  {item.status === 'completed' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ) : item.status === 'missed' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span className="font-medium text-slate-800">
                    {item.destination || `${item.durationMinutes}m Journey`}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                    item.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.status === 'missed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
