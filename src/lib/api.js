const axios = require('axios');
const { readConfig, writeConfig, clearConfig } = require('./config');

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

function getApi() {
  const config = readConfig();
  const baseURL = process.env.HOOKSWING_API_URL || config?.apiUrl || 'https://hookswing.com';
  const token = config?.accessToken;

  const instance = axios.create({
    baseURL: `${baseURL}/api`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  // Response interceptor: auto-refresh on 401
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Only handle 401s that haven't been retried yet
      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for the refresh to finish, then retry
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(instance(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const cfg = readConfig();
        if (!cfg?.refreshToken) {
          throw new Error('No refresh token');
        }

        const refreshRes = await axios.post(`${baseURL}/api/auth/refresh`, {
          refreshToken: cfg.refreshToken,
        });

        const newAccessToken = refreshRes.data.accessToken;

        // Save new token (rotate refresh token if server returns one)
        writeConfig({
          apiUrl: cfg.apiUrl,
          accessToken: newAccessToken,
          refreshToken: refreshRes.data.refreshToken || cfg.refreshToken,
        });

        // Update default header for future requests
        instance.defaults.headers.Authorization = `Bearer ${newAccessToken}`;

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        onRefreshed(newAccessToken);
        isRefreshing = false;

        return instance(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        refreshSubscribers = [];

        // Refresh failed — clear config and force re-login
        clearConfig();
        const msg =
          'Your session has expired. Please run `hookswing login` again.';
        return Promise.reject(new Error(msg));
      }
    }
  );

  return instance;
}

module.exports = { getApi };
