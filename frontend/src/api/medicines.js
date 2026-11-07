import { api } from './client.js';

export async function listMedicines(params = {}) {
  const query = {};
  if (params.q) query.q = params.q;
  if (params.active) query.active = 'true';
  if (params.limit) query.limit = params.limit;
  if (params.offset) query.offset = params.offset;
  const { data } = await api.get('/api/medicines', { params: query });
  return data.items;
}

export async function getMedicine(id) {
  const { data } = await api.get(`/api/medicines/${id}`);
  return data.medicine;
}

export async function createMedicine(payload) {
  const { data } = await api.post('/api/medicines', payload);
  return data.medicine;
}

export async function updateMedicine(id, payload) {
  const { data } = await api.patch(`/api/medicines/${id}`, payload);
  return data.medicine;
}

export async function deactivateMedicine(id) {
  const { data } = await api.post(`/api/medicines/${id}/deactivate`);
  return data.medicine;
}

export async function reactivateMedicine(id) {
  const { data } = await api.post(`/api/medicines/${id}/reactivate`);
  return data.medicine;
}
