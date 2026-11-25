import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Tv, Globe2 } from 'lucide-react';
import { translate, SupportedLanguage } from '../utils/i18n';

interface AnimatedStatsProps {
  totalAnime: number;
  totalVotes?: number;
  totalLanguages?: number;
  currentLang?: string;
}

const Counter: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 900;
    const frameDuration = 1000 / 60;
    const totalFrames = Math.round(duration / frameDuration);
    const easeOutQuad = (t: number) => t * (2 - t);

    let frame = 0;
    const counter = setInterval(() => {
      frame++;
      const progress = easeOutQuad(frame / totalFrames);
      const currentCount = Math.round(value * progress);
      setCount(currentCount);

      if (frame === totalFrames) {
        clearInterval(counter);
        setCount(value);
      }
    }, frameDuration);

    return () => clearInterval(counter);
  }, [value, isInView]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
};

export const AnimatedStats: React.FC<AnimatedStatsProps> = ({
  totalAnime,
  totalLanguages = 8,
  currentLang = 'en',
}) => {
  const lang = (currentLang as SupportedLanguage) || 'en';
  const stats = [
    {
      label: translate('stats.anime', lang),
      value: totalAnime,
      suffix: '+',
      icon: <Tv className="w-5 h-5 text-purple-400" />,
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      label: translate('stats.languages', lang),
      value: totalLanguages,
      suffix: '',
      icon: <Globe2 className="w-5 h-5 text-cyan-400" />,
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 my-4 max-w-xl mx-auto">
      {stats.map((stat, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: idx * 0.08 }}
          className="relative bg-[#131926]/80 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5"
        >
          <div className={`w-10 h-10 rounded-xl border ${stat.bg} flex items-center justify-center shrink-0`}>
            {stat.icon}
          </div>
          <div className="text-left min-w-0">
            <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
              <Counter value={stat.value} suffix={stat.suffix} />
            </div>
            <div className="text-xs font-semibold text-neutral-400 truncate">
              {stat.label}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
