import React, { createContext, useContext, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { toFriday, getWeekLabel } from '../utils/week';

interface WeekContextValue {
  weekStart: dayjs.Dayjs;
  setWeekStart: (date: dayjs.Dayjs) => void;
  weekStartStr: string;
  weekEndStr: string;
  weekLabel: { week: number; month: string; range: string };
}

const WeekContext = createContext<WeekContextValue | null>(null);

export const WeekProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [weekStart, setWeekStartRaw] = useState<dayjs.Dayjs>(() => toFriday(dayjs()));

  const setWeekStart = (date: dayjs.Dayjs) => setWeekStartRaw(toFriday(date));

  const weekStartStr = weekStart.format('YYYY-MM-DD');
  const weekEndStr = weekStart.add(6, 'day').format('YYYY-MM-DD');
  const weekLabel = useMemo(() => getWeekLabel(weekStart), [weekStart]);

  return (
    <WeekContext.Provider value={{ weekStart, setWeekStart, weekStartStr, weekEndStr, weekLabel }}>
      {children}
    </WeekContext.Provider>
  );
};

export function useWeek(): WeekContextValue {
  const ctx = useContext(WeekContext);
  if (!ctx) throw new Error('useWeek must be used within WeekProvider');
  return ctx;
}
