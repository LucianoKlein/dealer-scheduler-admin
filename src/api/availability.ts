import client from './client';

export const availabilityApi = {
  list: (params?: { dealer_id?: string; week_start?: string }) =>
    client.get('/availability', { params }),

  create: (data: { eeNumber: string; weekStart: string; shift: string; preferredDaysOff?: number[] }) =>
    client.post('/availability', data),

  delete: (id: number) => client.delete(`/availability/${id}`),
};
