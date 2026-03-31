import axios from 'axios';
import axiosRetry from 'axios-retry';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const IS_MOCK_MODE = process.env.NEXT_PUBLIC_MOCK === 'true';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10s enforced timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Configure Axios Retry Strategies
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response ? error.response.status >= 500 : false);
  }
});

api.interceptors.request.use(
  (config) => {
    // Intercept with Mock Mode in non-prod
    if (IS_MOCK_MODE && process.env.NODE_ENV !== 'production') {
       console.log(`[MOCK API] Suppressing real network call to ${config.url}`);
       config.adapter = async () => ({
         data: { success: true, message: 'Mocked Response', data: {} },
         status: 200,
         statusText: 'OK',
         headers: {},
         config,
         request: {}
       }) as any;
       return config;
    }

    const token = Cookies.get('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // Adapter intercept resolves differently, standardize it
    if (IS_MOCK_MODE && process.env.NODE_ENV !== 'production' && response.config.adapter) {
        return response.data;
    }
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (!error.config.url?.includes('verify-token') && !error.config.url?.includes('login')) {
        toast.error('Session expired. Please log in again.');
        Cookies.remove('token');
      }
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Network request timed out (10s). Re-establishing connection...');
    } else {
      const message = error.response?.data?.message || 'An unexpected error occurred';
      if (!error.config.url?.includes('/report')) {
        toast.error(message);
      }
    }
    return Promise.reject(error);
  }
);
