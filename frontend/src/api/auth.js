import { api, setToken, clearToken } from './client.js';

export async function loginRequest(email, password) {
  const { data } = await api.post('/api/auth/login', { email, password });
  setToken(data.token);
  return data.user;
}

export async function meRequest() {
  const { data } = await api.get('/api/auth/me');
  return data.user;
}

export function logoutRequest() {
  clearToken();
}
