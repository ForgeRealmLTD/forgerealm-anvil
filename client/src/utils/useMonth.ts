import { useState, useCallback } from 'react';

// Shared month selection for the Mini Mall and Expenses tabs. Persisted in
// sessionStorage so switching tabs keeps you on the same month.

const KEY = 'anvil:selected-month';

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function useMonth(): [string, (m: string) => void] {
  const [month, setMonthState] = useState<string>(() => {
    const saved = sessionStorage.getItem(KEY);
    return saved && /^\d{4}-\d{2}$/.test(saved) ? saved : currentMonth();
  });
  const setMonth = useCallback((m: string) => {
    sessionStorage.setItem(KEY, m);
    setMonthState(m);
  }, []);
  return [month, setMonth];
}
