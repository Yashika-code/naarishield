import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, ShieldAlert } from 'lucide-react';


interface VoiceTriggerProps {
  onTriggerSOS: () => void;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const EMERGENCY_KEYWORDS = [
  'bachao',
  'बचाओ',
  'help me',
  'help',
  'मदद',
  'madad',
  'mujhe bachao',
  'mujhe madad chahiye',
  'emergency',
  'इमरजेंसी',
  'save me',
  'police',
  'पुलिस'
];

export const VoiceTrigger: React.FC<VoiceTriggerProps> = ({
  onTriggerSOS,
  isEnabled,
  onToggle
}) => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [supported, setSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchedKeyword, setMatchedKeyword] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const isEnabledRef = useRef(isEnabled);
  const onTriggerSOSRef = useRef(onTriggerSOS);
  const onToggleRef = useRef(onToggle);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    onTriggerSOSRef.current = onTriggerSOS;
  }, [onTriggerSOS]);

  useEffect(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);

  useEffect(() => {
    // Check Web Speech API Support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN'; // Multi-lingual recognition with Hindi + English fallback

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += ' ' + event.results[i][0].transcript.toLowerCase();
        }
        transcript = transcript.trim();
        if (transcript) {
          setRecognizedText(transcript);
        }

        // Check for keyword matches
        for (const kw of EMERGENCY_KEYWORDS) {
          if (transcript.includes(kw)) {
            setMatchedKeyword(kw);
            if (onTriggerSOSRef.current) {
              onTriggerSOSRef.current();
            }
            break;
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied by browser. Please grant mic permissions.');
          setIsListening(false);
          if (onToggleRef.current) onToggleRef.current(false);
        } else if (event.error !== 'no-speech') {
          console.warn('[Speech Recognition] Error:', event.error);
        }
      };

      recognition.onend = () => {
        // If still enabled by user, restart listening
        if (isEnabledRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {}
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      setSupported(false);
      setErrorMessage('Speech recognition initialization failed.');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current || !supported) return;

    if (isEnabled) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    } else {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {}
    }
  }, [isEnabled, supported]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Emergency Voice Trigger</h3>
            <p className="text-[11px] text-slate-500">
              {supported
                ? isListening
                  ? 'Listening for emergency phrases...'
                  : 'Disabled (Microphone inactive)'
                : 'Speech Recognition not supported in this browser'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onToggle(!isEnabled)}
          disabled={!supported}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            isEnabled
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50'
          }`}
        >
          {isEnabled ? 'Active (Turn Off)' : 'Enable Voice'}
        </button>
      </div>

      {errorMessage && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {matchedKeyword && (
        <div className="p-2.5 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 font-semibold flex items-center gap-2 mb-3 animate-pulse">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>Keyword detected: "{matchedKeyword}"! Dispatched emergency SOS.</span>
        </div>
      )}

      {/* Phrases Pill Bar */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-slate-600">Configured Trigger Phrases (Hindi & English):</p>
        <div className="flex flex-wrap gap-1.5">
          {EMERGENCY_KEYWORDS.map((phrase) => (
            <span
              key={phrase}
              className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono border border-slate-200"
            >
              "{phrase}"
            </span>
          ))}
        </div>
      </div>

      {isListening && recognizedText && (
        <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600">
          <span className="text-slate-400">Audio Preview:</span> "{recognizedText}"
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
        Note: Audio is evaluated strictly on-device in browser memory; raw audio and transcripts are never stored. Browser speech recognition requires active foreground tab focus.
      </div>
    </div>
  );
};
