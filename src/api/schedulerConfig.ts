import client from './client';

export const schedulerConfigApi = {
  list: () => client.get('/scheduler-config'),
  batchUpdate: (configs: { key: string; value: number }[]) =>
    client.put('/scheduler-config', { configs }),
  reset: () => client.post('/scheduler-config/reset'),
};
