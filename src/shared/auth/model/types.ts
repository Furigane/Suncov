export type Role = 'admin' | 'user';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  role: Role;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
}

