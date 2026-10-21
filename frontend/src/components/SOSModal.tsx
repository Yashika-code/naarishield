import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, CheckCircle2, PhoneCall, Radio } from 'lucide-react';
import type { SOSEvent } from '../types';

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmTrigger: (triggerSource: 'manual' | 'voice') => Promise<SOSEvent | null>;
  activeEvent: SOSEvent | null;
  onCancelActiveSOS: (id: string) => Promise<void>;
}

export const SOSModal: React.FC<SOSModalProps> = ({
  isOpen,
  onClose,
  onConfirmTrigger,
  activeEvent,
  onCancelActiveSOS,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'manual' | 'voice'>('manual');

  if (!isOpen) return null;

  const startCountdown = (source: 'manual' | 'voice') => {
    setSelectedSource(source);
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) {
          clearInterval(interval);
          return null;
        }
        if (prev <= 1) {
          clearInterval(interval);
          executeTrigger(source);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const abortCountdown = () => {
    setCountdown(null);
  };

  const executeTrigger = async (source: 'manual' | 'voice') => {
    setIsSubmitting(true);
    try {
      await onConfirmTrigger(source);
    } finally {
      setIsSubmitting(false);
      setCountdown(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative">
        {/* Header */}
        <div className="bg-red-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <h2 className="text-lg font-bold">Emergency SOS Dispatch</h2>
          </div>
          <button
            onClick={onClose}
            disabled={countdown !== null || isSubmitting}
            className="p-1.5 rounded-full hover:bg-red-700/60 transition text-white/90 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeEvent && activeEvent.status === 'active' ? (
            <div className="text-center py-3">
              <div className="inline-flex p-3 rounded-full bg-red-100 text-red-600 mb-3 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">EMERGENCY SOS IS ACTIVE</h3>
              <p className="text-sm text-slate-600 mb-4">
                Alert notifications and GPS coordinates have been broadcast to your trusted emergency contacts.
              </p>

              <div className="bg-slate-50 rounded-xl p-3 mb-5 border border-slate-200 text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Event ID:</span>
                  <span className="font-mono font-medium text-slate-800">{activeEvent.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trigger Source:</span>
                  <span className="font-semibold text-red-600 uppercase">{activeEvent.triggerSource}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Triggered At:</span>
                  <span className="text-slate-700">{new Date(activeEvent.createdAt || activeEvent.timestamp || Date.now()).toLocaleTimeString()}</span>
                </div>
              </div>

              <button
                onClick={() => onCancelActiveSOS(activeEvent.id)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                I am Safe (Cancel Alert)
              </button>
            </div>
          ) : countdown !== null ? (
            <div className="text-center py-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-red-600 mb-2">
                Dispatching SOS via {selectedSource.toUpperCase()} trigger
              </p>
              <div className="text-7xl font-black text-red-600 mb-4 animate-bounce">
                {countdown}
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Broadcasts alert message with live coordinates to all 3 emergency contacts immediately when counter reaches zero.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={abortCountdown}
                  className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition"
                >
                  Cancel Immediately
                </button>
                <button
                  onClick={() => executeTrigger(selectedSource)}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition"
                >
                  Send Now
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600 mb-5">
                Choose an emergency action to dispatch instant distress alerts with your real-time coordinates to trusted contacts.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => startCountdown('manual')}
                  disabled={isSubmitting}
                  className="w-full p-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-bold flex items-center justify-between shadow-lg shadow-red-500/20 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/50 rounded-lg group-hover:scale-110 transition">
                      <PhoneCall className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-base font-bold">Manual SOS Dispatch</div>
                      <div className="text-xs text-red-100 font-normal">Immediate alert to all 3 emergency contacts</div>
                    </div>
                  </div>
                  <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">5s Grace</span>
                </button>

                <button
                  onClick={() => startCountdown('voice')}
                  disabled={isSubmitting}
                  className="w-full p-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold flex items-center justify-between border border-slate-700 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700 rounded-lg group-hover:scale-110 transition">
                      <Radio className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold">Simulate Voice Keyword Trigger</div>
                      <div className="text-xs text-slate-400 font-normal">Android companion client trigger simulation</div>
                    </div>
                  </div>
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">Test Pipe</span>
                </button>
              </div>

              <div className="mt-5 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500">
                <p className="font-semibold text-slate-700 mb-0.5">Privacy & Safety Notice:</p>
                In production, notifications are routed through certified SMS/WhatsApp providers with carrier delivery confirmation.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
