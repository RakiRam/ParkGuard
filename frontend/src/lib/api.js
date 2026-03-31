import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('parkguard_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('parkguard_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register' && window.location.pathname !== '/' && !window.location.pathname.startsWith('/scan')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/update-profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  verifyToken: () => api.get('/auth/verify-token'),
  logout: () => api.post('/auth/logout'),
};

// Vehicles
export const vehicleAPI = {
  list: (params) => api.get('/vehicles', { params }),
  get: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  deactivate: (id) => api.put(`/vehicles/${id}/deactivate`),
  delete: (id) => api.delete(`/vehicles/${id}`),
};

// QR Codes
export const qrAPI = {
  scan: (code) => api.get(`/qr-codes/scan/${code}`),
  validate: (code) => api.get(`/qr-codes/validate/${code}`),
  products: (params) => api.get('/qr-codes/products', { params }),
  product: (id) => api.get(`/qr-codes/products/${id}`),
};

// Incidents
export const incidentAPI = {
  report: (data) => api.post('/incidents/report', data),
  myReports: (params) => api.get('/incidents/my-reports', { params }),
  get: (id) => api.get(`/incidents/${id}`),
  acknowledge: (id) => api.put(`/incidents/${id}/acknowledge`),
  resolve: (id) => api.put(`/incidents/${id}/resolve`),
  stats: (params) => api.get('/incidents/stats/summary', { params }),
};

// Contact
export const contactAPI = {
  initiateCall: (data) => api.post('/contact/initiate-call', data),
  callStatus: (sid) => api.get(`/contact/call-status/${sid}`),
};

// Orders
export const orderAPI = {
  createCheckout: (data) => api.post('/orders/create-checkout', data),
  myOrders: (params) => api.get('/orders/my-orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
};

// Notifications
export const notificationAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// Admin
export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  orders: (params) => api.get('/admin/orders', { params }),
  updateOrderStatus: (id, data) => api.put(`/admin/orders/${id}/status`, data),
  products: () => api.get('/admin/products'),
};

export default api;
