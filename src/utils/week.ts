import dayjs from 'dayjs';

export function toFriday(date: dayjs.Dayjs): dayjs.Dayjs {
  const d = date.day();
  const offset = d >= 5 ? d - 5 : d - 5 + 7;
  return date.subtract(offset, 'day');
}

export function getWeekLabel(friday: dayjs.Dayjs): { week: number; month: string; range: string } {
  const monthName = friday.format('MMMM');
  let count = 0;
  let d = friday.startOf('month');
  while (!d.isAfter(friday, 'day')) {
    if (d.day() === 5) count++;
    d = d.add(1, 'day');
  }
  const end = friday.add(6, 'day');
  const range = `${friday.format('MMM D')} - ${end.format('MMM D')}`;
  return { week: count, month: monthName, range };
}
