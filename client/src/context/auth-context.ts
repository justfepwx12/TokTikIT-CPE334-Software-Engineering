import { createContext } from 'react'
import type { AuthUser } from '../api.js'

export interface AuthContextValue {
  user: AuthUser | null
  /** true until the initial session restore (GET /me) has completed */
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
