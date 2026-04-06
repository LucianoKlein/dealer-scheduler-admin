import client from './client';

export const projectionApi = {
  get: (weekStart: string) => client.get(`/projections/${weekStart}`),

  save: (weekStart: string, data: { days: { date: string; slots: { time: string; dealersNeeded: number }[] }[] }) =>
    client.put(`/projections/${weekStart}`, data),

  delete: (weekStart: string) => client.delete(`/projections/${weekStart}`),
};
