// ==============================================================================
// AniDub India — Native Voice Search Bar Component
// Integrates browser Web Speech API (SpeechRecognition / webkitSpeechRecognition)
// ==============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Mic, MicOff, X, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

export interface VoiceSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  disabled?: boolean;
}

export const VoiceSearchBar: React.FC<VoiceSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  placeholder = 'Search dubbed anime (e.g., Jujutsu Kaisen, Naruto, Solo Leveling)...',
  className = '',
  onFocus,
  onBlur,
  onClear,
  disabled = false,
}) => {
  const toast = useToast();
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // Check Web Speech API availability
  const isSpeechSupported = typeof window !== 'undefined' && 
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      const msg = 'Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.';
      setSpeechError(msg);
      toast.info('Voice Search Unsupported', msg);
      return;
    }

    setSpeechError(null);

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;
      // 'en-IN' optimizes recognition for Indian English & Anime pronunciations
      recognition.lang = 'en-IN';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
        toast.info('Voice Search Active', 'Listening... Speak the anime title clearly.');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        const recognizedText = (final || interim).trim();
        if (recognizedText) {
          // Automatically populate the search input and trigger filtering function
          onSearchChange(recognizedText);
        }

        if (final) {
          const cleanFinal = final.trim();
          onSearchChange(cleanFinal);
          toast.success('Voice Recognized', `Searching for: "${cleanFinal}"`);
          stopListening();
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        setInterimTranscript('');

        const errorCode = event?.error;
        let errorMessage = 'Voice search encountered an issue. Please try again.';

        if (errorCode === 'not-allowed' || errorCode === 'permission-denied') {
          errorMessage = 'Microphone access denied. Please allow microphone permission in your browser.';
        } else if (errorCode === 'no-speech') {
          errorMessage = 'No voice detected. Please speak closer to your microphone.';
        } else if (errorCode === 'audio-capture') {
          errorMessage = 'No microphone was found. Please ensure your microphone is connected.';
        } else if (errorCode === 'network') {
          errorMessage = 'Network connection issue with speech service.';
        }

        if (errorCode !== 'no-speech') {
          setSpeechError(errorMessage);
          toast.info('Voice Search', errorMessage);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      const msg = 'Could not access microphone. Please check browser permissions.';
      setSpeechError(msg);
      toast.info('Voice Search Error', msg);
    }
  }, [onSearchChange, stopListening, toast]);

  const toggleVoiceSearch = () => {
    if (disabled) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleClear = () => {
    if (isListening) {
      stopListening();
    }
    onSearchChange('');
    onClear?.();
  };

  return (
    <div className={`relative group w-full ${className}`}>
      {/* Left Search / Audio Pulse Icon */}
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-accent-theme transition-colors">
        {isListening ? (
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        ) : (
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </div>

      {/* Main Search Input */}
      <input
        type="text"
        value={interimTranscript || searchQuery}
        onChange={(e) => {
          if (isListening) stopListening();
          onSearchChange(e.target.value);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={
          isListening
            ? 'Listening... Speak anime title (e.g., "Naruto", "Solo Leveling")...'
            : placeholder
        }
        className={`w-full bg-[#121829]/95 border rounded-2xl py-3.5 sm:py-4 pl-11 sm:pl-12 pr-24 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all duration-200 shadow-xl backdrop-blur-md ${
          isListening
            ? 'border-red-500/80 ring-4 ring-red-500/20 bg-red-950/20 text-white placeholder-red-300 animate-pulse'
            : 'border-neutral-700/80 group-hover:border-neutral-600 focus:border-accent-theme focus:ring-2 focus:ring-[var(--primary-ring)]'
        }`}
      />

      {/* Right Controls: Clear + Native Voice Search Mic */}
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
        {/* Clear search text */}
        {(searchQuery || interimTranscript) && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Native Web Speech Microphone Button */}
        <button
          type="button"
          onClick={toggleVoiceSearch}
          disabled={disabled}
          className={`p-2 rounded-xl transition-all duration-300 cursor-pointer active:scale-90 flex items-center justify-center relative ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 ring-4 ring-red-500/30 animate-pulse scale-105'
              : !isSpeechSupported
              ? 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800/50'
              : 'text-neutral-400 hover:text-accent-theme hover:bg-neutral-800/80'
          }`}
          title={
            isListening
              ? 'Listening to speech... Click to stop'
              : !isSpeechSupported
              ? 'Voice search unsupported in this browser'
              : 'Search with your voice (Web Speech API)'
          }
          aria-label={isListening ? 'Stop voice listening' : 'Start voice search'}
        >
          {isListening ? (
            <MicOff className="w-4 h-4 animate-bounce" />
          ) : (
            <Mic className="w-4 h-4" />
          )}

          {/* Glowing pulse indicator when listening */}
          {isListening && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          )}
        </button>
      </div>

      {/* Floating active voice transcription preview */}
      {isListening && interimTranscript && (
        <div className="absolute left-0 right-0 top-full mt-1.5 p-2.5 bg-red-950/90 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2 shadow-2xl backdrop-blur-md z-40 animate-in fade-in">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400 shrink-0" />
          <span>Heard: <strong className="text-white">"{interimTranscript}"</strong></span>
        </div>
      )}
    </div>
  );
};

export default VoiceSearchBar;
