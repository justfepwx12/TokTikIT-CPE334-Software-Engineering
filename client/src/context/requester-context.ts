import { createContext } from 'react'

export interface SelectedRequester {
  id: number
  name: string
}

export interface RequesterContextValue {
  requester: SelectedRequester | null
  /** true until the persisted selection (if any) has been read from storage */
  isLoading: boolean
  setRequester: (requester: SelectedRequester) => void
  clearRequester: () => void
}

export const RequesterContext = createContext<RequesterContextValue | undefined>(undefined)