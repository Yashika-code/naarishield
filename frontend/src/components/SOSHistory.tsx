import React from 'react';
import { History, ShieldAlert, CheckCircle, Clock, Radio, PhoneCall } from 'lucide-react';
import type { SOSEvent } from '../types';

interface SOSHistoryProps {
  events: SOSEvent[];
  onSelectEvent?: (event: SOSEvent) => void;
}

export const SOSHistory: React.FC<SOSHistoryProps> = ({ events }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-700" />
          <h3 className="font-semibold text-slate-900 text-sm md:text-base">
            Incident & Alert Log
          </h3>
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
            {events.length} records
          </span>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto max-h-[350px]">
        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700">No distress alerts recorded</p>
            <p className="text-xs">Your safety record is clean and monitoring is on standby.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {event.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full animate-pulse">
                        <ShieldAlert className="w-3 h-3" /> Active Alert
                      </span>
                    ) : event.status === 'cancelled' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> User Marked Safe
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                        Resolved
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                      {event.triggerSource === 'voice' ? (
                        <>
                          <Radio className="w-3 h-3 text-indigo-500" /> Voice Trigger
                        </>
                      ) : (
                        <>
                          <PhoneCall className="w-3 h-3 text-red-500" /> Manual Button
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(event.createdAt || event.timestamp || Date.now()).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  {event.coordinates ? (
                    <p className="text-[11px] font-mono text-slate-500">
                      📍 Lat: {event.coordinates.latitude.toFixed(4)}, Long: {event.coordinates.longitude.toFixed(4)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No GPS coordinates attached</p>
                  )}

                  {event.notifications && event.notifications.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Dispatched Notifications ({event.notifications.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {event.notifications.map((n, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                            {n.name} ({n.channel} • {n.status})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
