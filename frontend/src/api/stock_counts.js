import { api } from './client.js';

export async function listStockCounts(params = {}) {
  const { data } = await api.get('/api/stock-counts', { params });
  return data.items;
}

export async function getStockCount(id) {
  const { data } = await api.get(`/api/stock-counts/${id}`);
  return data.stockCount;
}

export async function startStockCount(payload = {}) {
  const { data } = await api.post('/api/stock-counts', payload);
  return data.stockCount;
}

export async function submitStockCount(id, payload) {
  const { data } = await api.post(`/api/stock-counts/${id}/submit`, payload);
  return data.stockCount;
}

export async function cancelStockCount(id) {
  const { data } = await api.post(`/api/stock-counts/${id}/cancel`);
  return data.stockCount;
}
