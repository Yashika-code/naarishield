import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, AlertOctagon, Play, Square, Info } from 'lucide-react';

export const EmergencySiren: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);

  const stopSiren = () => {
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (lfoRef.current) {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
        lfoRef.current = null;
      }
      if (lfoGainRef.current) {
        lfoGainRef.current.disconnect();
        lfoGainRef.current = null;
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
        gainRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping siren audio:', e);
    }
    setIsPlaying(false);
  };

  const startSiren = async () => {
    setError(null);
    stopSiren(); // Prevent overlapping instances

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Master Gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainRef.current = masterGain;

      // Primary Tone Oscillator (750 Hz center frequency)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      oscRef.current = osc;

      // LFO for characteristic police wailing sweep (modulates pitch between ~600Hz and ~1200Hz)
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.6, ctx.currentTime); // 0.6 Hz wail cycle
      lfoRef.current = lfo;

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(320, ctx.currentTime);
      lfoGainRef.current = lfoGain;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(masterGain);

      lfo.start();
      osc.start();
      setIsPlaying(true);
    } catch (err: any) {
      console.error('Failed to start emergency siren:', err);
      setError(err?.message || 'Audio playback restricted by browser permissions.');
      setIsPlaying(false);
    }
  };

  // Adjust volume dynamically
  useEffect(() => {
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setValueAtTime(
        isMuted ? 0 : volume,
        audioCtxRef.current.currentTime
      );
    }
  }, [volume, isMuted]);

  // Cleanup on unmount or tab switch
  useEffect(() => {
    return () => {
      stopSiren();
    };
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">
              Emergency Siren Sound
            </h3>
            <span className="text-[11px] text-slate-500">
              Acoustic Deterrent Tool
            </span>
          </div>
        </div>

        {isPlaying && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2.5 py-1 rounded-full animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            Siren Blaring
          </span>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Audio Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
        <div className="w-full sm:w-auto flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={startSiren}
              className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm"
              aria-label="Play emergency siren"
            >
              <Play className="w-4 h-4 fill-white" />
              Play Siren
            </button>
          ) : (
            <button
              onClick={stopSiren}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm animate-pulse"
              aria-label="Stop emergency siren"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Siren
            </button>
          )}
        </div>

        {/* Volume & Mute */}
        <div className="w-full flex-1 flex items-center gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-700" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            aria-label="Siren volume control"
            className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <span className="text-xs font-mono text-slate-600 w-10 text-right">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>

      {/* Safety Notice & Disclaimer */}
      <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Simulated Audible Deterrent Notice:</p>
          <p className="text-amber-800">
            Playing this siren generates high-volume acoustic audio locally in your device speakers to draw immediate attention. It does <strong>not</strong> contact emergency police services or guarantee rescue.
          </p>
        </div>
      </div>
    </div>
  );
};
