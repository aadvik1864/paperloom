import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const currentToken = localStorage.getItem('token');
    if (error.response?.status === 401 && currentToken &&
        error.config?.headers?.Authorization === `Bearer ${currentToken}` &&
        error.config?.url !== '/auth/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('paperloom:session-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
