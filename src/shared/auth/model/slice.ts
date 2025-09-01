import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, AuthUser } from './types';

const AUTH_KEY = 'auth_state_v1';
const USERS_KEY = 'auth_users_v1';

const loadAuth = (): AuthState => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { isAuthenticated: false, user: null };
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return { isAuthenticated: false, user: null };
  }
};

const initialState: AuthState = loadAuth();

const persistAuth = (state: AuthState) => {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  } catch {}
};

export const loadUsers = (): AuthUser[] => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuthUser[];
  } catch {
    return [];
  }
};

export const saveUsers = (users: AuthUser[]) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {}
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticated(state, action: PayloadAction<AuthUser | null>) {
      state.isAuthenticated = !!action.payload;
      state.user = action.payload;
      persistAuth(state);
    },
    loginWithCode(state, action: PayloadAction<string>) {
      const code = (action.payload || '').trim();
      const users = loadUsers();
      const user = users.find((u) => u.code === code) || null;
      state.isAuthenticated = !!user;
      state.user = user;
      persistAuth(state);
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      persistAuth(state);
    },
    bootstrapAdmin(
      state,
      action: PayloadAction<Pick<AuthUser, 'firstName' | 'lastName' | 'code'>>,
    ) {
      const users = loadUsers();
      if (users.length > 0) return;
      const admin: AuthUser = {
        id: crypto.randomUUID(),
        firstName: action.payload.firstName,
        lastName: action.payload.lastName,
        code: action.payload.code,
        role: 'admin',
      };
      saveUsers([admin]);
      state.isAuthenticated = true;
      state.user = admin;
      persistAuth(state);
    },
    addUser(state, action: PayloadAction<Omit<AuthUser, 'id'>>) {
      const users = loadUsers();
      const exists = users.some((u) => u.code === action.payload.code);
      if (exists) return;
      const newUser: AuthUser = { id: crypto.randomUUID(), ...action.payload };
      saveUsers([...users, newUser]);
      // do not auto-login
      persistAuth(state);
    },
    updateUser(state, action: PayloadAction<AuthUser>) {
      const users = loadUsers();
      const updated = users.map((u) => (u.id === action.payload.id ? action.payload : u));
      saveUsers(updated);
      if (state.user && state.user.id === action.payload.id) {
        state.user = action.payload;
        persistAuth(state);
      }
    },
    deleteUser(state, action: PayloadAction<string>) {
      const users = loadUsers();
      const updated = users.filter((u) => u.id !== action.payload);
      saveUsers(updated);
      if (state.user && state.user.id === action.payload) {
        state.user = null;
        state.isAuthenticated = false;
        persistAuth(state);
      }
    },
  },
});

export const { reducer: authReducer, actions: authActions } = authSlice;
