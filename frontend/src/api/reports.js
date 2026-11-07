import { api } from './client.js';

export async function getProfit(params = {}) {
  const { data } = await api.get('/api/reports/profit', { params });
  return data;
}

export async function getExpiryLoss(params = {}) {
  const { data } = await api.get('/api/reports/expiry-loss', { params });
  return data;
}

export async function getDashboard() {
  const { data } = await api.get('/api/reports/dashboard');
  return data;
}
