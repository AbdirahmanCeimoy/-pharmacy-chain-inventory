import { api } from './client.js';

export async function listBranches() {
  const { data } = await api.get('/api/branches');
  return data.items;
}
