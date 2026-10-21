import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, MicOff, X, Sparkles } from 'lucide-react';

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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onChange(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onChange]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your current browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition start error:', err);
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
        placeholder={isListening ? 'Listening in English / Hindi / Tamil...' : placeholder}
        className={`w-full bg-[#121829]/95 border rounded-2xl py-3.5 sm:py-4 pl-11 sm:pl-12 pr-24 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all duration-200 shadow-xl backdrop-blur-md ${
          isListening
            ? 'border-red-500/80 ring-4 ring-red-500/20 bg-red-950/20 text-white placeholder-red-300 animate-pulse'
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
          onClick={toggleListening}
          className={`relative p-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 ring-4 ring-red-500/30 animate-pulse scale-105'
              : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white'
          }`}
          title={isListening ? 'Stop voice recognition' : 'Start voice search'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-primary-theme" />}
          {isListening && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          )}
        </button>
      </div>

      {/* FLOATING PREVIEW WHEN LISTENING */}
      {isListening && (
        <div className="absolute left-0 right-0 top-full mt-1.5 p-2.5 bg-red-950/90 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2 shadow-2xl backdrop-blur-md z-40 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-red-400 animate-spin shrink-0" />
          <span className="font-bold">Listening for voice query... Speak now!</span>
        </div>
      )}

    </div>
  );
};
