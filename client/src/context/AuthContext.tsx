import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  changePassword as apiChangePassword,
  getSessionUser,
  loginUser,
  logoutUser,
  type AuthUser,
} from '../api.js'
import { AuthContext } from './auth-context.js'

// Server-side session authentication (Lab 3 Issue 3/4, BR-04).
// Holds the real authenticated user from the session cookie — replaces the
// Lab 2 simulated Requester selection. Identity is never stored client-side.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Session restore on mount/refresh (GET /me; 401 = not signed in).
  useEffect(() => {
    let cancelled = false
    getSessionUser()
      .then(({ user }) => {
        if (!cancelled) setUser(user)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await loginUser(email, password)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
    }
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiChangePassword(currentPassword, newPassword)
    // Server clears mustChangePassword but keeps the session — refresh the
    // user so the gate unblocks immediately without a reload.
    const { user } = await getSessionUser()
    setUser(user)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}
