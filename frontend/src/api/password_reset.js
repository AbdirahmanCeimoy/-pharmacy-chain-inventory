import { api } from './client.js';

export async function requestPasswordReset(email) {
  const { data } = await api.post('/api/auth/forgot-password', { email });
  return data;
}

export async function verifyPasswordOtp(email, otp) {
  const { data } = await api.post('/api/auth/verify-otp', { email, otp });
  return data;
}

export async function resetPassword({ email, resetToken, newPassword }) {
  const { data } = await api.post('/api/auth/reset-password', {
    email,
    resetToken,
    newPassword,
  });
  return data;
}
