import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, MicOff, X, Sparkles } from 'lucide-react';
import { MicPermissionBottomSheet } from './MicPermissionBottomSheet';
import { VoiceVisualizer } from './VoiceVisualizer';

export interface VoiceSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const VoiceSearchBar: React.FC<VoiceSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search 100+ anime titles, genres, or studios...',
  className = ''
}) => {
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [isPermanentlyBlocked, setIsPermanentlyBlocked] = useState(false);
  const recognitionRef = useRef<any>(null);


  const initRecognition = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI && !recognitionRef.current) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceTranscript('');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setVoiceTranscript(transcript);
          onChange(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          setIsPermanentlyBlocked(true);
          setShowBottomSheet(true);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      return recognition;
    }
    return recognitionRef.current;
  };

  useEffect(() => {
    initRecognition();
  }, [onChange]);

  const startActualListening = () => {
    const rec = initRecognition();
    if (!rec) return;

    try {
      rec.start();
      setIsListening(true);
      setShowBottomSheet(false);
    } catch (err) {
      console.warn('Speech recognition start error:', err);
      setIsListening(false);
    }
  };

  const handleMicClick = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      // 1. Explicitly trigger the browser's native "Allow / Deny" prompt first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. If we reach here, permission was granted. Stop the test stream immediately.
      stream.getTracks().forEach(track => track.stop());
      
      // 3. Proceed with actual Speech Recognition
      startActualListening();
    } catch (err: any) {
      console.warn('Microphone permission interaction failed:', err.name, err.message);
      
      // 4. Handle permanent block / denial (NotAllowedError / DOMException)
      // This happens if the user previously selected "Deny" permanently
      if (
        err.name === 'NotAllowedError' || 
        err.name === 'PermissionDeniedError' || 
        err.name === 'SecurityError' ||
        (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError'))
      ) {
        setIsPermanentlyBlocked(true);
        setShowBottomSheet(true);
      } else {
        // Fallback for other errors (e.g. device not found)
        console.error('Unexpected mic error:', err);
      }
    }
  };

  return (
    <div className={`relative group w-full ${className} font-sans`}>
      
      {/* LEFT SEARCH / AUDIO PULSE ICON */}
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-accent-theme transition-colors">
        {isListening ? (
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
          </span>
        ) : (
          <Search className="w-4 h-4" />
        )}
      </div>

      {/* MAIN SEARCH INPUT */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isListening ? 'Listening for your query...' : placeholder}
        className={`w-full bg-[#121829]/95 border rounded-2xl py-3.5 sm:py-4 pl-11 sm:pl-12 pr-24 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all duration-200 shadow-xl backdrop-blur-md ${
          isListening
            ? 'border-purple-500/80 ring-4 ring-purple-500/20 bg-purple-950/20 text-white placeholder-purple-300 animate-pulse'
            : 'border-neutral-700/80 group-hover:border-neutral-600 focus:border-accent-theme focus:ring-2 focus:ring-[var(--primary-ring)]'
        }`}
      />

      {/* RIGHT CONTROLS (CLEAR & MIC) */}
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={handleMicClick}
          className={`relative p-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
            isListening
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 ring-4 ring-purple-500/30 animate-pulse scale-105'
              : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white'
          }`}
          title={isListening ? 'Stop voice recognition' : 'Start voice search'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-primary-theme" />}
          {isListening && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-ping" />
          )}
        </button>
      </div>

      {/* PERMISSION BOTTOM SHEET */}
      <MicPermissionBottomSheet 
        isOpen={showBottomSheet}
        isPermanentlyBlocked={isPermanentlyBlocked}
        onClose={() => setShowBottomSheet(false)}
        onAllow={() => {
          // If they say they updated settings, reset the "blocked" state to try again
          if (isPermanentlyBlocked) {
            setIsPermanentlyBlocked(false);
          }
          handleMicClick();
        }}
      />

      {/* ACTIVE VOICE VISUALIZER */}
      <VoiceVisualizer 
        isListening={isListening}
        transcript={voiceTranscript}
        onClose={() => {
          if (recognitionRef.current) recognitionRef.current.stop();
          setIsListening(false);
        }}
      />

    </div>
  );
};
