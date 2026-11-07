import { api } from './client.js';

export async function listSuppliers(params = {}) {
  const query = {};
  if (params.q) query.q = params.q;
  if (params.active) query.active = 'true';
  if (params.limit) query.limit = params.limit;
  const { data } = await api.get('/api/suppliers', { params: query });
  return data.items;
}

export async function createSupplier(payload) {
  const { data } = await api.post('/api/suppliers', payload);
  return data.supplier;
}

export async function deactivateSupplier(id) {
  const { data } = await api.post(`/api/suppliers/${id}/deactivate`);
  return data.supplier;
}

export async function reactivateSupplier(id) {
  const { data } = await api.post(`/api/suppliers/${id}/reactivate`);
  return data.supplier;
}
