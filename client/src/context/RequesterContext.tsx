import { useState, type ReactNode } from 'react'
import {
  RequesterContext,
  type RequesterContextValue,
  type SelectedRequester,
} from './requester-context.js'

// Lab 2 testing mechanism only — NOT authentication.
// Holds which Development Requester is currently simulated as the logged-in user.
// See ui-spec.md §3.1/§3.2.

const STORAGE_KEY = 'toktickit.selectedRequester'

function readStoredRequester(): SelectedRequester | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SelectedRequester
    if (parsed && typeof parsed.id === 'number' && typeof parsed.name === 'string') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequesterState] = useState<SelectedRequester | null>(() =>
    readStoredRequester()
  )

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

  const value: RequesterContextValue = {
    requester,
    isLoading: false,
    setRequester,
    clearRequester,
  }

  return <RequesterContext.Provider value={value}>{children}</RequesterContext.Provider>
}