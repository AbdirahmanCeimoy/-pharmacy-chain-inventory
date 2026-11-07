import { api } from './client.js';

export async function listReturns(params = {}) {
  const { data } = await api.get('/api/returns', { params });
  return data.items;
}

export async function createReturn(payload) {
  const { data } = await api.post('/api/returns', payload);
  return data.return;
}

export async function getReturn(id) {
  const { data } = await api.get(`/api/returns/${id}`);
  return data.return;
}
