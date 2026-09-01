import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Lab 2 testing mechanism only — NOT authentication.
// Holds which Development Requester is currently simulated as the logged-in user.
// See ui-spec.md §3.1/§3.2.

export interface SelectedRequester {
  id: number
  name: string
}

interface RequesterContextValue {
  requester: SelectedRequester | null
  /** true until the persisted selection (if any) has been read from storage */
  isLoading: boolean
  setRequester: (requester: SelectedRequester) => void
  clearRequester: () => void
}

const STORAGE_KEY = 'toktickit.selectedRequester'

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined)

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequesterState] = useState<SelectedRequester | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as SelectedRequester
        if (parsed && typeof parsed.id === 'number' && typeof parsed.name === 'string') {
          setRequesterState(parsed)
        }
      }
    } catch {
      // Malformed/blocked storage — treat as no Requester selected.
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setRequester = (next: SelectedRequester) => {
    setRequesterState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage unavailable — selection still works for this session via state.
    }
  }

  const clearRequester = () => {
    setRequesterState(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore.
    }
  }

  return (
    <RequesterContext.Provider value={{ requester, isLoading, setRequester, clearRequester }}>
      {children}
    </RequesterContext.Provider>
  )
}

export function useRequester() {
  const ctx = useContext(RequesterContext)
  if (!ctx) {
    throw new Error('useRequester must be used within a <RequesterProvider>')
  }
  return ctx
}