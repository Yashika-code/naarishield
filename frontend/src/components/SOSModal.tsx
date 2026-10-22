import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, CheckCircle2, PhoneCall, Radio, Phone, ExternalLink } from 'lucide-react';
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
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-red-600 p-5 text-white flex items-center justify-between shrink-0">
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
        <div className="p-6 overflow-y-auto flex-1">
          {activeEvent && (activeEvent.status === 'active' || activeEvent.status === 'ALERTS_SENT' || activeEvent.status === 'PARTIALLY_FAILED' || activeEvent.status === 'CREATED' || activeEvent.status === 'LOCATION_ACQUIRED' || activeEvent.status === 'ALERTS_QUEUED') ? (
            <div className="text-center py-2">
              <div className="inline-flex p-3 rounded-full bg-red-100 text-red-600 mb-2 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">EMERGENCY SOS IS ACTIVE</h3>
              <p className="text-xs text-slate-600 mb-4">
                Distress alert registered. Real-time GPS location and message dispatched to emergency contacts.
              </p>

              {/* Status & Lifecycle badge */}
              <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-200 text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Incident ID:</span>
                  <span className="font-mono font-medium text-slate-800">{activeEvent.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lifecycle Status:</span>
                  <span className="font-bold text-red-600 uppercase">{activeEvent.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trigger Source:</span>
                  <span className="font-semibold text-slate-800 uppercase">{activeEvent.triggerSource}</span>
                </div>
                {activeEvent.locationLink && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Live Map:</span>
                    <a
                      href={activeEvent.locationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-red-600 hover:underline font-semibold"
                    >
                      <span>Open Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Outbound Supported Call Action */}
              {activeEvent.callWorkflow && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-red-900">Supported Emergency Call</p>
                      <p className="text-[11px] text-red-700">
                        {activeEvent.callWorkflow.primaryContactName} ({activeEvent.callWorkflow.primaryContactPhone})
                      </p>
                    </div>
                    {activeEvent.callWorkflow.supportedAction && (
                      <a
                        href={activeEvent.callWorkflow.supportedAction}
                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition shadow-sm"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Place Call</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Instant WhatsApp & SMS Trigger for Emergency Contacts */}
              {activeEvent.notifications && activeEvent.notifications.length > 0 && (
                <div className="mb-4 text-left">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Direct Emergency Dispatch</span>
                    <span className="text-[10px] text-emerald-600 font-semibold lowercase">instant delivery</span>
                  </h4>
                  <div className="space-y-2">
                    {activeEvent.notifications.map((n, idx) => {
                      const cleanPhone = (n.phoneNumber || n.phone || '').replace(/[^0-9]/g, '');
                      const alertText = encodeURIComponent(
                        `🚨 EMERGENCY SOS ALERT! I need urgent help! My Live Location: ${activeEvent.locationLink || 'Unavailable'}. Please check on me or contact 112 immediately!`
                      );
                      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${alertText}`;
                      const smsUrl = `sms:${n.phoneNumber || n.phone}?body=${alertText}`;

                      return (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{n.name}</p>
                            <p className="text-[11px] text-slate-500">{n.phoneNumber || n.phone}</p>
                          </div>
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1.5 rounded-lg transition shadow-xs"
                            >
                              <span>Send WhatsApp</span>
                            </a>
                            <a
                              href={smsUrl}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-900 text-white font-semibold px-2.5 py-1.5 rounded-lg transition shadow-xs"
                            >
                              <span>Send SMS</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Individual Provider Status List */}
              {activeEvent.notifications && activeEvent.notifications.length > 0 && (
                <div className="mb-4 text-left">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Carrier Gateway Status
                  </h4>
                  <div className="space-y-1.5">
                    {activeEvent.notifications.map((n, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{n.name}</p>
                          <p className="text-[10px] text-slate-500">{n.phoneNumber || n.phone} • {n.provider}</p>
                        </div>
                        <div>
                          {n.status === 'DELIVERED' || n.status === 'delivered' ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                              Delivered
                            </span>
                          ) : n.status === 'DEMO_DISPATCHED' ? (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full" title={n.details || 'Demo Simulation'}>
                              Demo Dispatched
                            </span>
                          ) : (
                            <span className="text-[10px] bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded-full" title={n.details || undefined}>
                              {n.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                Broadcasts alert message with live coordinates to registered emergency contacts immediately when counter reaches zero.
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
                      <div className="text-xs text-red-100 font-normal">Immediate alert to all verified emergency contacts</div>
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
                      <div className="text-sm font-semibold">Voice Trigger Simulation</div>
                      <div className="text-xs text-slate-400 font-normal">Triggers SOS using emergency keywords</div>
                    </div>
                  </div>
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">Test Pipe</span>
                </button>
              </div>

              <div className="mt-5 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500">
                <p className="font-semibold text-slate-700 mb-0.5">Privacy & Safety Notice:</p>
                In production, notifications are routed through certified SMS/WhatsApp providers with carrier delivery confirmation. Demo mode is clearly labeled to prevent simulated false positives.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

