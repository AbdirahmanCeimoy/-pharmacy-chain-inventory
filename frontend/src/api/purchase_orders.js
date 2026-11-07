import { api } from './client.js';

export async function listPurchaseOrders(params = {}) {
  const query = {};
  if (params.status) query.status = params.status;
  if (params.branchId) query.branchId = params.branchId;
  if (params.q) query.q = params.q;
  if (params.limit) query.limit = params.limit;
  const { data } = await api.get('/api/purchase-orders', { params: query });
  return data.items;
}

export async function getPurchaseOrder(id) {
  const { data } = await api.get(`/api/purchase-orders/${id}`);
  return data.purchaseOrder;
}

export async function createPurchaseOrder(payload) {
  const { data } = await api.post('/api/purchase-orders', payload);
  return data.purchaseOrder;
}

export async function submitPurchaseOrder(id) {
  const { data } = await api.post(`/api/purchase-orders/${id}/submit`);
  return data.purchaseOrder;
}

export async function approvePurchaseOrder(id) {
  const { data } = await api.post(`/api/purchase-orders/${id}/approve`);
  return data.purchaseOrder;
}

export async function cancelPurchaseOrder(id) {
  const { data } = await api.post(`/api/purchase-orders/${id}/cancel`);
  return data.purchaseOrder;
}

export async function receivePurchaseOrder(id, payload) {
  const { data } = await api.post(`/api/purchase-orders/${id}/receive`, payload);
  return data.purchaseOrder;
}
