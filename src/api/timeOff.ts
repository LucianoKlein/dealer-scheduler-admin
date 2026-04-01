import client from './client';

export const timeOffApi = {
  list: (params?: { week_start?: string; dealer_id?: string; status?: string }) =>
    client.get('/time-off', { params }),

  create: (data: { dealerId: string; startDate: string; endDate: string; reason?: string }) =>
    client.post('/time-off', data),

  approve: (id: string) => client.put(`/time-off/${id}/approve`),
  reject: (id: string) => client.put(`/time-off/${id}/reject`),
  delete: (id: string) => client.delete(`/time-off/${id}`),
};
