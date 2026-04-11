export type DealerType = 'cash' | 'tournament' | 'restart';
export type Employment = 'full_time' | 'part_time';

export interface Dealer {
  id: string;
  name: string;
  type: DealerType;
  employment: Employment;
  carpoolGroupId?: string;
  phone?: string;
  email?: string;
}

export interface TimeOffRequest {
  id: string;
  dealerId: string;
  dealerName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  reason: string;
}

export interface CarpoolGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export interface TimeSlot {
  time: string; // e.g. "12 PM"
  dealersNeeded: number;
}

export interface DailyProjection {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
}

export interface WeeklyProjection {
  weekStart: string; // YYYY-MM-DD (Friday)
  days: DailyProjection[];
}

export interface GameEvent {
  date: string;       // e.g. "May 26 12:00 PM"
  eventNum: string;
  title: string;
  buyIn: string;
  chips: string;
  clock: string;
  lateReg: string;
  format: string;
}

export interface ScheduleEntry {
  dealerId: string;
  date: string;
  time?: string; // e.g. "9:00 AM"
}

export interface WeeklySchedule {
  weekStart: string;
  dealerType: DealerType;
  entries: ScheduleEntry[];
}

export const DEALER_TYPE_KEYS: Record<DealerType, string> = {
  cash: 'dealerType.cash',
  tournament: 'dealerType.tournament',
  restart: 'dealerType.restart',
};
export const EMPLOYMENT_KEYS: Record<Employment, string> = {
  full_time: 'employment.full_time',
  part_time: 'employment.part_time',
};

export interface WeeklyAvailability {
  dealerId: string;
  weekStart: string;
  slots: string[]; // "YYYY-MM-DD" date array
  submittedAt: string;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface AvailabilitySubmission {
  id: string;
  dealerId: string;
  dealerName: string;
  weekStart: string;
  dates: string[]; // available dates list
  submittedAt: string;
  status: SubmissionStatus;
}

// Employee request management - matches user-side submission model
export type ShiftType = 'day' | 'swing' | 'night' | 'mixed';
export type ShiftPreference = 'prefer_day' | 'prefer_swing' | 'no_preference';

export interface AvailabilityRequest {
  id: string;
  dealerId: string;
  dealerName: string;
  weekStart: string;
  shift: ShiftType;
  preference: ShiftPreference;
  preferredDaysOff: number[]; // 0=Sun..6=Sat, preferred days off
  submittedAt: string;
  status: SubmissionStatus;
}

export interface RideShareRequest {
  id: string;
  dealerId: string;
  dealerName: string;
  weekStart: string;
  partnerName: string;
  departureTime: string;
  createdAt: string;
  active: boolean;
  status: SubmissionStatus;
}
