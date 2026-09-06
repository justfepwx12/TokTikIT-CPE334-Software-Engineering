import { useContext } from 'react'
import { RequesterContext } from '../context/requester-context.js'

export function useRequester() {
  const ctx = useContext(RequesterContext)
  if (!ctx) {
    throw new Error('useRequester must be used within a <RequesterProvider>')
  }
  return ctx
}
