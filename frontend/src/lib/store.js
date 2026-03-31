import { create } from 'zustand';
import Cookies from 'js-cookie';
import { authAPI, notificationAPI } from './api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: Cookies.get('parkguard_token') || null,
  loading: true,
  stats: null,

  setUser: (user) => set({ user, loading: false }),
  setToken: (token) => {
    if (token) {
      Cookies.set('parkguard_token', token, { expires: 7 });
    } else {
      Cookies.remove('parkguard_token');
    }
    set({ token });
  },

  login: async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { user, token } = res.data.data;
    Cookies.set('parkguard_token', token, { expires: 7 });
    set({ user, token, loading: false });
    return res.data;
  },

  register: async (data) => {
    const res = await authAPI.register(data);
    const { user, token } = res.data.data;
    Cookies.set('parkguard_token', token, { expires: 7 });
    set({ user, token, loading: false });
    return res.data;
  },

  fetchProfile: async () => {
    try {
      const token = Cookies.get('parkguard_token');
      if (!token) {
        set({ user: null, loading: false });
        return;
      }
      const res = await authAPI.profile();
      set({ user: res.data.data.user, stats: res.data.data.stats, loading: false });
    } catch {
      Cookies.remove('parkguard_token');
      set({ user: null, token: null, loading: false });
    }
  },

  logout: async () => {
    try { await authAPI.logout(); } catch {}
    Cookies.remove('parkguard_token');
    set({ user: null, token: null, stats: null });
  },
}));

export const useCartStore = create((set, get) => ({
  items: JSON.parse(localStorage.getItem('parkguard_cart') || '[]'),

  addItem: (product, quantity = 1) => {
    const items = [...get().items];
    const idx = items.findIndex((i) => i.id === product.id);
    if (idx >= 0) {
      items[idx].quantity += quantity;
    } else {
      items.push({ ...product, quantity });
    }
    localStorage.setItem('parkguard_cart', JSON.stringify(items));
    set({ items });
  },

  removeItem: (productId) => {
    const items = get().items.filter((i) => i.id !== productId);
    localStorage.setItem('parkguard_cart', JSON.stringify(items));
    set({ items });
  },

  updateQuantity: (productId, quantity) => {
    const items = get().items.map((i) => i.id === productId ? { ...i, quantity: Math.max(1, quantity) } : i);
    localStorage.setItem('parkguard_cart', JSON.stringify(items));
    set({ items });
  },

  clearCart: () => {
    localStorage.removeItem('parkguard_cart');
    set({ items: [] });
  },

  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await notificationAPI.list({ limit: 20 });
      set({ notifications: res.data.data.notifications, unreadCount: res.data.data.unreadCount, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    await notificationAPI.markRead(id);
    const notifications = get().notifications.map((n) => n.id === id ? { ...n, is_read: true } : n);
    set({ notifications, unreadCount: Math.max(0, get().unreadCount - 1) });
  },

  markAllRead: async () => {
    await notificationAPI.markAllRead();
    const notifications = get().notifications.map((n) => ({ ...n, is_read: true }));
    set({ notifications, unreadCount: 0 });
  },

  addNotification: (notif) => {
    set({
      notifications: [notif, ...get().notifications],
      unreadCount: get().unreadCount + 1,
    });
  },
}));
