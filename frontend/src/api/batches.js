import { api } from './client.js';

export async function listBatches(params = {}) {
  const { data } = await api.get('/api/batches', { params });
  return data.items;
}

export async function getExpirySummary(params = {}) {
  const { data } = await api.get('/api/batches/expiry-summary', { params });
  return data.summary;
}
