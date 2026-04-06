import client from './client';

export interface GenerateResult {
  scheduleId: number;
  totalAssignments: number;
  unfilledSlots: number;
  solverStatus: string;
  solveTimeMs: number;
  stats?: ScheduleStats | null;
}

export interface ScheduleStats {
  fullySatisfied: number;
  partiallySatisfied: number;
  unsatisfied: number;
  totalWithPreference: number;
  unfilledBreakdown: { date: string; shift: string; needed: number; assigned: number; gap: number }[];
}

export interface TaskStartResult {
  taskId: string;
}

export interface TaskStatusResult {
  taskId: string;
  status: string;
  progress: number;
  phase: string;
  result: GenerateResult | null;
  error: string | null;
}

export const scheduleApi = {
  generate: (data: { weekStart: string; dealerType?: string }) =>
    client.post<TaskStartResult>('/schedules/generate', data),

  taskStatus: (taskId: string) =>
    client.get<TaskStatusResult>(`/schedules/tasks/${taskId}`),

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

  delete: (weekStart: string, dealerType: string = 'tournament') =>
    client.delete('/schedules', {
      params: { week_start: weekStart, dealer_type: dealerType },
    }),
};

export const adminRequestsApi = {
  summary: (weekStart: string) =>
    client.get('/admin/requests/summary', { params: { week_start: weekStart } }),

  availability: (weekStart: string, page?: number, size?: number) =>
    client.get('/admin/requests/availability', { params: { week_start: weekStart, page, size } }),

  timeOff: (weekStart: string, page?: number, size?: number) =>
    client.get('/admin/requests/time-off', { params: { week_start: weekStart, page, size } }),

  rideShare: (weekStart: string, page?: number, size?: number) =>
    client.get('/admin/requests/ride-share', { params: { week_start: weekStart, page, size } }),
};

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  scheduleId: number | null;
}

export const notificationApi = {
  list: () => client.get<NotificationItem[]>('/notifications'),
  unreadCount: () => client.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: number) => client.put(`/notifications/${id}/read`),
  markAllRead: () => client.put('/notifications/read-all'),
};
