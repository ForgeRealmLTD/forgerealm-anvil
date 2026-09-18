import { motion, AnimatePresence } from 'framer-motion';
import { currentMonth, shiftMonth, monthLabel } from '../utils/useMonth';

interface MonthSelectorProps {
  value: string;
  onChange: (month: string) => void;
}

// Shared ‹ Month Year › control for the Mini Mall and Expenses tabs.
// Big Lora label so the month reads like part of the dashboard, not a filter.
export default function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const atCurrent = value >= currentMonth();

  const arrow = (dir: -1 | 1, disabled: boolean) => (
    <button
      onClick={() => !disabled && onChange(shiftMonth(value, dir))}
      disabled={disabled}
      aria-label={dir === -1 ? 'Previous month' : 'Next month'}
      className={`w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center border transition-all duration-200
        ${disabled
          ? 'border-white/[0.04] text-gray-700 cursor-default'
          : 'border-white/[0.08] text-gray-400 hover:text-gold hover:border-gold/40 hover:shadow-glow-gold-sm active:scale-95'}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d={dir === -1 ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {arrow(-1, false)}
      <div className="relative w-44 md:w-52 text-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="block font-display text-xl md:text-2xl font-semibold text-white"
          >
            {monthLabel(value)}
          </motion.span>
        </AnimatePresence>
      </div>
      {arrow(1, atCurrent)}
    </div>
  );
}
