import axios from 'axios';
import { changeSession, csrfToken, sessionVersion, signedOut } from './session';

const baseURL = import.meta.env.VITE_API_URL || '/api';
export const apiOrigin = new URL(baseURL, window.location.origin).origin;
export const sameOriginApi = apiOrigin === window.location.origin;

const api = axios.create({
  baseURL,
  adapter: 'fetch',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  config.paperloomSessionVersion = sessionVersion();
  config.withCredentials = sameOriginApi && (!signedOut() || config.allowSessionCookies) ? 'same-origin' : 'omit';
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  if (sameOriginApi) {
    config.headers['X-Paperloom-Session'] = 'cookie';
    if (!config.headers['X-CSRF-TOKEN']) config.headers['X-CSRF-TOKEN'] = csrfToken();
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !signedOut() &&
        error.config?.paperloomSessionVersion === sessionVersion() &&
        !error.config?.skipSessionExpiry &&
        error.config?.url !== '/auth/login') {
      changeSession(true);
      window.dispatchEvent(new Event('paperloom:session-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
