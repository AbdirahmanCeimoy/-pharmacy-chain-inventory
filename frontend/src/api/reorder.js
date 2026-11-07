import { api } from './client.js';

export async function getReorderSuggestions(params = {}) {
  const { data } = await api.get('/api/reorder-suggestions', { params });
  return data;
}
