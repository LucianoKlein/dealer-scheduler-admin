import client from './client';

export interface GenerateResult {
  scheduleId: number;
  totalAssignments: number;
  unfilledSlots: number;
  solverStatus: string;
  solveTimeMs: number;
}

export const scheduleApi = {
  generate: (data: { weekStart: string; dealerType?: string }) =>
    client.post<GenerateResult>('/schedules/generate', data),

  list: (params?: { week_start?: string; dealer_type?: string }) =>
    client.get('/schedules', { params }),

  getEntries: (scheduleId: number) =>
    client.get(`/schedules/${scheduleId}/entries`),

  publish: (scheduleId: number) =>
    client.put(`/schedules/${scheduleId}/publish`),

  exportUrl: (weekStart: string, dealerType: string = 'tournament') =>
    `http://localhost:8000/api/v1/schedules/export?week_start=${weekStart}&dealer_type=${dealerType}`,

  downloadExcel: (weekStart: string, dealerType: string = 'tournament') =>
    client.get('/schedules/export', {
      params: { week_start: weekStart, dealer_type: dealerType },
      responseType: 'blob',
    }),
};

export const adminRequestsApi = {
  summary: (weekStart: string) =>
    client.get('/admin/requests/summary', { params: { week_start: weekStart } }),

  availability: (weekStart: string) =>
    client.get('/admin/requests/availability', { params: { week_start: weekStart } }),

  timeOff: (weekStart: string, status?: string) =>
    client.get('/admin/requests/time-off', { params: { week_start: weekStart, status } }),

  rideShare: () => client.get('/admin/requests/ride-share'),
};
