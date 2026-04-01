import client from './client';

export interface DealerDTO {
  id: string;
  eeNumber: string | null;
  firstName: string;
  lastName: string;
  type: string;
  employment: string;
  preferredShift: string;
  daysOff: number[];
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const dealersApi = {
  list: (params?: { type?: string; employment?: string; search?: string; page?: number; size?: number }) =>
    client.get<{ total: number; page: number; size: number; data: DealerDTO[] }>('/dealers', { params }),

  get: (id: string) => client.get<DealerDTO>(`/dealers/${id}`),

  create: (data: { id: string; firstName: string; lastName: string; type: string; employment: string; preferredShift?: string; daysOff?: number[]; phone?: string }) =>
    client.post('/dealers', data),

  update: (id: string, data: Partial<{ firstName: string; lastName: string; type: string; employment: string; preferredShift: string; daysOff: number[]; phone: string; email: string }>) =>
    client.put(`/dealers/${id}`, data),

  delete: (id: string) => client.delete(`/dealers/${id}`),

  availability: (dealerId: string, weekStart: string) =>
    client.get(`/dealers/${dealerId}/availability`, { params: { week_start: weekStart } }),
};
