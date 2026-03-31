import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { api } from './api';

export type UserRole = 'user' | 'admin' | 'moderator';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isVerified: boolean;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      
      login: (user, token) => {
        // Hardened js-cookie settings to prevent XSS leakage and enforce HTTPS requirement in prod
        Cookies.set('token', token, { 
          expires: 7, 
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
        set({ user, token: null, isAuthenticated: true, isLoading: false });
      },
      
      logout: () => {
        Cookies.remove('token');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      },
      
      checkAuth: async () => {
        const token = Cookies.get('token');
        if (!token) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          return;
        }

        try {
          const response: any = await api.get('/api/auth/verify-token');
          if (response.success && response.data.user) {
            set((state) => ({ 
              user: { ...state.user, ...response.data.user }, 
              token: null, // Strictly keeping token purely in cookie, not in zustand state
              isAuthenticated: true, 
              isLoading: false 
            }));
          } else {
            Cookies.remove('token');
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          Cookies.remove('token');
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null
        }));
      }
    }),
    {
      name: 'auth-storage',
      // DO NOT serialize token parameter to LocalStorage
      partialize: (state) => ({ user: state.user }),
    }
  )
);

// Cart Store
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => {
        const existingItem = state.items.find((i: CartItem) => i.id === item.id);
        if (existingItem) {
          return {
            items: state.items.map((i: CartItem) => 
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            )
          };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((i: CartItem) => i.id !== id)
      })),
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i: CartItem) => i.id === id ? { ...i, quantity } : i)
      })),
      clearCart: () => set({ items: [] }),
      cartTotal: () => get().items.reduce((total: number, item: CartItem) => total + (item.price * item.quantity), 0)
    }),
    { name: 'cart-storage' }
  )
);
