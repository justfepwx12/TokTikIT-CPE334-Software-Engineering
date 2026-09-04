import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRequester } from '../context/RequesterContext'

/**
 * Use at the top of any Requester-facing page (My Tickets, Create Ticket,
 * Ticket Detail). Redirects to the Development Requester Selection screen
 * if no Requester is currently simulated, preserving the intended
 * destination so Continue can send the user back here (ui-spec.md §3.1).
 */
export function useRequireRequester() {
  const { requester, isLoading } = useRequester()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && !requester) {
      const redirect = encodeURIComponent(location.pathname)
      navigate(`/select-requester?redirect=${redirect}`, { replace: true })
    }
  }, [isLoading, requester, location.pathname, navigate])

  return { requester, isLoading }
}