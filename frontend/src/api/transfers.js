import { api } from './client.js';

export async function listTransfers(params = {}) {
  const { data } = await api.get('/api/transfers', { params });
  return data.items;
}

export async function getTransfer(id) {
  const { data } = await api.get(`/api/transfers/${id}`);
  return data.transfer;
}

export async function createTransfer(payload) {
  const { data } = await api.post('/api/transfers', payload);
  return data.transfer;
}

export async function approveTransfer(id) {
  const { data } = await api.post(`/api/transfers/${id}/approve`);
  return data.transfer;
}

export async function dispatchTransfer(id) {
  const { data } = await api.post(`/api/transfers/${id}/dispatch`);
  return data.transfer;
}

export async function receiveTransfer(id, payload) {
  const { data } = await api.post(`/api/transfers/${id}/receive`, payload);
  return data.transfer;
}

export async function cancelTransfer(id) {
  const { data } = await api.post(`/api/transfers/${id}/cancel`);
  return data.transfer;
}
