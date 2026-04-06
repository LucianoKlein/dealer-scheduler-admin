import client from './client';

export const rideShareApi = {
  list: (params?: { dealer_id?: string }) =>
    client.get('/ride-share', { params }),

  create: (data: { eeNumber: string; partners: { partnerName: string; partnerEENumber?: string }[] }) =>
    client.post('/ride-share', data),

  cancel: (id: string) => client.put(`/ride-share/${id}/cancel`),
  delete: (id: string) => client.delete(`/ride-share/${id}`),
};
