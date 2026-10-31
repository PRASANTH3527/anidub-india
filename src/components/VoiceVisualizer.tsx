import React from 'react';
import { motion } from 'motion/react';
import { Mic, Sparkles, X } from 'lucide-react';

interface VoiceVisualizerProps {
  isListening: boolean;
  transcript?: string;
  onClose?: () => void;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isListening, transcript, onClose }) => {
  if (!isListening) return null;

  return (
    <>
      {/* Semi-transparent Backdrop for focus */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-[2px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-md"
      >
        {/* Cinematic Background Glow */}
        <div className="absolute inset-0 bg-purple-600/20 blur-[100px] -z-10 rounded-full animate-pulse" />

        <div className="bg-[#0f1420]/95 backdrop-blur-3xl border border-purple-500/40 rounded-[32px] p-6 shadow-[0_20px_80px_rgba(168,85,247,0.4)] flex flex-col items-center gap-4 relative">
          
          {/* Close / Cancel Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Animated Sound Waves / Ripples */}
          <div className="relative">
            <motion.div
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.6, 0, 0.6],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 bg-purple-500/30 rounded-full"
            />
            <motion.div
              animate={{
                scale: [1, 2.4, 1],
                opacity: [0.4, 0, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.4,
                ease: "easeInOut",
              }}
              className="absolute inset-0 bg-purple-500/10 rounded-full"
            />
            
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-purple-500/50 ring-2 ring-white/20">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Mic size={28} strokeWidth={2.5} />
              </motion.div>
            </div>
          </div>

          {/* Status & Transcript */}
          <div className="text-center space-y-2 w-full">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
              <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase italic">
                System Active
              </span>
            </div>
            
            <div className="min-h-[3rem] flex items-center justify-center px-4">
              <p className="text-neutral-100 text-base font-bold line-clamp-2 leading-relaxed tracking-tight">
                {transcript ? `"${transcript}"` : "Speak now, searching for anime..."}
              </p>
            </div>
          </div>

          {/* Visual Wavebars */}
          <div className="flex items-center gap-1.5 h-10">
            {[...Array(16)].map((_, i) => (
              <motion.div
                key={`wave-${i}`}
                animate={{
                  height: [10, Math.random() * 24 + 10, 10],
                }}
                transition={{
                  duration: 0.3 + Math.random() * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className={`w-1 rounded-full ${i % 2 === 0 ? 'bg-purple-500' : 'bg-pink-500'}`}
              />
            ))}
          </div>

          <div className="w-full h-px bg-white/10" />

          <div className="flex items-center gap-2 text-[9px] text-neutral-500 font-black uppercase tracking-[0.2em]">
            <span>Indian Regional Dialect Active</span>
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </motion.div>
    </>
  );
};
