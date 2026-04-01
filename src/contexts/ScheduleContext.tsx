import React, { createContext, useContext, useState } from 'react';
import { ScheduleEntry } from '../types';

interface ScheduleContextValue {
  entries: ScheduleEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  return (
    <ScheduleContext.Provider value={{ entries, setEntries }}>
      {children}
    </ScheduleContext.Provider>
  );
};

export function useSchedule(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
