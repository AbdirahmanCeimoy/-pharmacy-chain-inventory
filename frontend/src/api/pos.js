import { api } from './client.js';

export async function createSale(payload) {
  const { data } = await api.post('/api/pos/sales', payload);
  return data.sale;
}

export async function getSale(id) {
  const { data } = await api.get(`/api/pos/sales/${id}`);
  return data.sale;
}

export async function listSales(params = {}) {
  const { data } = await api.get('/api/pos/sales', { params });
  return data.items;
}

export async function getSaleByReceipt(receiptNo, params = {}) {
  const { data } = await api.get(`/api/pos/receipts/${encodeURIComponent(receiptNo)}`, {
    params,
  });
  return data.sale;
}
