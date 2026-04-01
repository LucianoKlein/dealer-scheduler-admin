import { Dealer, TimeOffRequest, CarpoolGroup, WeeklyProjection, WeeklySchedule, WeeklyAvailability, AvailabilitySubmission, AvailabilityRequest, RideShareRequest, ShiftType, ShiftPreference } from '../types';
import dayjs from 'dayjs';

const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley',
  'Paul', 'Dorothy', 'Andrew', 'Kimberly', 'Joshua', 'Emily', 'Kenneth', 'Donna',
  'Kevin', 'Michelle', 'Brian', 'Carol', 'George', 'Amanda', 'Timothy', 'Melissa',
  'Ronald', 'Deborah', 'Edward', 'Stephanie', 'Jason', 'Rebecca', 'Jeffrey', 'Sharon',
  'Ryan', 'Laura', 'Jacob', 'Cynthia',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDealers(count: number): Dealer[] {
  const types: Dealer['type'][] = ['tournament', 'cash', 'restart'];
  const typeWeights = [0.5, 0.35, 0.15];
  const dealers: Dealer[] = [];
  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    const type = rand < typeWeights[0] ? types[0] : rand < typeWeights[0] + typeWeights[1] ? types[1] : types[2];

    dealers.push({
      id: `D${String(i + 1).padStart(4, '0')}`,
      name: `${randomFrom(firstNames)} ${randomFrom(lastNames)}`,
      type,
      employment: Math.random() < 0.7 ? 'full_time' : 'part_time',
      carpoolGroupId: undefined,
      phone: `702-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      email: undefined,
    });
  }
  return dealers;
}

function generateCarpoolGroups(dealers: Dealer[]): CarpoolGroup[] {
  const groups: CarpoolGroup[] = [];
  const ungrouped = dealers.filter((_, i) => i % 5 === 0).slice(0, 60);

  for (let i = 0; i < ungrouped.length; i += 3) {
    const members = ungrouped.slice(i, i + 3);
    if (members.length < 2) break;
    const groupId = `CP${String(groups.length + 1).padStart(3, '0')}`;
    members.forEach(m => m.carpoolGroupId = groupId);
    groups.push({
      id: groupId,
      name: `Carpool Group ${groups.length + 1}`,
      memberIds: members.map(m => m.id),
    });
  }
  return groups;
}

function generateTimeOffRequests(dealers: Dealer[]): TimeOffRequest[] {
  const requests: TimeOffRequest[] = [];
  const nextMonday = dayjs().startOf('week').add(1, 'week').add(1, 'day');

  const selected = dealers.filter(() => Math.random() < 0.05);
  selected.forEach((dealer, i) => {
    const dayOffset = Math.floor(Math.random() * 7);
    const start = nextMonday.add(dayOffset, 'day');
    const duration = Math.random() < 0.7 ? 1 : 2;
    const end = start.add(duration - 1, 'day');
    requests.push({
      id: `TO${String(i + 1).padStart(4, '0')}`,
      dealerId: dealer.id,
      dealerName: dealer.name,
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      reason: randomFrom(['Personal', 'Medical', 'Family', 'Vacation', 'Other']),
    });
  });
  return requests;
}

function generateProjection(): WeeklyProjection {
  // Find next Friday as week start
  let nextFriday = dayjs();
  while (nextFriday.day() !== 5) {
    nextFriday = nextFriday.add(1, 'day');
  }
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = nextFriday.add(i, 'day');
    days.push({
      date: date.format('YYYY-MM-DD'),
      slots: [],
    });
  }
  return { weekStart: nextFriday.format('YYYY-MM-DD'), days };
}

function generateAvailabilities(dealers: Dealer[]): WeeklyAvailability[] {
  const nextMonday = dayjs().startOf('week').add(1, 'week').add(1, 'day');
  const weekStart = nextMonday.format('YYYY-MM-DD');
  const avails: WeeklyAvailability[] = [];
  const submitted = dealers.filter(() => Math.random() < 0.3);
  submitted.forEach(dealer => {
    const slots: string[] = [];
    for (let i = 0; i < 7; i++) {
      if (Math.random() < 0.7) {
        slots.push(nextMonday.add(i, 'day').format('YYYY-MM-DD'));
      }
    }
    avails.push({
      dealerId: dealer.id,
      weekStart,
      slots,
      submittedAt: dayjs().subtract(Math.floor(Math.random() * 48), 'hour').toISOString(),
    });
  });
  return avails;
}

function generateSubmissions(dealers: Dealer[]): AvailabilitySubmission[] {
  const nextMonday = dayjs().startOf('week').add(1, 'week').add(1, 'day');
  const weekStart = nextMonday.format('YYYY-MM-DD');
  const submissions: AvailabilitySubmission[] = [];
  const selected = dealers.filter(() => Math.random() < 0.08);
  selected.forEach((dealer, i) => {
    const dates: string[] = [];
    for (let d = 0; d < 7; d++) {
      if (Math.random() < 0.6) {
        dates.push(nextMonday.add(d, 'day').format('YYYY-MM-DD'));
      }
    }
    submissions.push({
      id: `SUB${String(i + 1).padStart(4, '0')}`,
      dealerId: dealer.id,
      dealerName: dealer.name,
      weekStart,
      dates,
      submittedAt: dayjs().subtract(Math.floor(Math.random() * 24), 'hour').toISOString(),
      status: 'pending',
    });
  });
  return submissions;
}

// Generate all mock data
export const mockDealers: Dealer[] = generateDealers(200);
export const mockCarpoolGroups: CarpoolGroup[] = generateCarpoolGroups(mockDealers);
export const mockTimeOffRequests: TimeOffRequest[] = generateTimeOffRequests(mockDealers);
export const mockProjection: WeeklyProjection = generateProjection();
export const mockSchedules: WeeklySchedule[] = [];
export const mockAvailabilities: WeeklyAvailability[] = generateAvailabilities(mockDealers);
export const mockSubmissions: AvailabilitySubmission[] = generateSubmissions(mockDealers);

function generateAvailabilityRequests(dealers: Dealer[]): AvailabilityRequest[] {
  let nextFriday = dayjs();
  while (nextFriday.day() !== 5) nextFriday = nextFriday.add(1, 'day');
  const weekStart = nextFriday.format('YYYY-MM-DD');
  const shifts: ShiftType[] = ['day', 'swing', 'mixed'];
  const prefs: ShiftPreference[] = ['prefer_day', 'prefer_swing', 'no_preference'];
  const selected = dealers.filter(() => Math.random() < 0.15);
  return selected.map((d, i) => {
    // 随机选2天作为期望休息日
    const day1 = Math.floor(Math.random() * 7);
    let day2 = Math.floor(Math.random() * 7);
    while (day2 === day1) day2 = Math.floor(Math.random() * 7);
    return {
      id: `AR${String(i + 1).padStart(4, '0')}`,
      dealerId: d.id,
      dealerName: d.name,
      weekStart,
      shift: randomFrom(shifts),
      preference: randomFrom(prefs),
      preferredDaysOff: [day1, day2].sort(),
      submittedAt: dayjs().subtract(Math.floor(Math.random() * 48), 'hour').toISOString(),
      status: 'pending' as const,
    };
  });
}

function generateRideShareRequests(dealers: Dealer[]): RideShareRequest[] {
  let nextFriday = dayjs();
  while (nextFriday.day() !== 5) nextFriday = nextFriday.add(1, 'day');
  const weekStart = nextFriday.format('YYYY-MM-DD');
  const selected = dealers.filter(() => Math.random() < 0.06);
  const results: RideShareRequest[] = [];
  let idx = 0;
  selected.forEach(d => {
    const partnerCount = 2 + Math.floor(Math.random() * 4); // 2-5 partners
    for (let p = 0; p < partnerCount; p++) {
      idx++;
      results.push({
        id: `RS${String(idx).padStart(4, '0')}`,
        dealerId: d.id,
        dealerName: d.name,
        weekStart,
        partnerName: `${randomFrom(firstNames)} ${randomFrom(lastNames)}`,
        departureTime: randomFrom(['7:00 AM', '7:30 AM', '8:00 AM', '3:00 PM', '3:30 PM']),
        createdAt: dayjs().subtract(Math.floor(Math.random() * 72), 'hour').toISOString(),
        active: true,
        status: 'pending' as const,
      });
    }
  });
  return results;
}

export const mockAvailabilityRequests: AvailabilityRequest[] = generateAvailabilityRequests(mockDealers);
export const mockRideShareRequests: RideShareRequest[] = generateRideShareRequests(mockDealers);
