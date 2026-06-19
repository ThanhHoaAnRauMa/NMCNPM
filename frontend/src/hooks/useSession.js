import { useCallback, useMemo, useRef, useState } from 'react'
import { API_URL, ApiError, createApiClient } from '../lib/api.js'

const SESSION_KEY = 'secure-chat-session'

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY))
  } catch (_error) {
    return null
  }
}

export function useSession() {
  const [session, setSessionState] = useState(readSession)
  const sessionRef = useRef(session)

  const setSession = useCallback((nextSession) => {
    sessionRef.current = nextSession
    setSessionState(nextSession)
    if (nextSession) sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
    else sessionStorage.removeItem(SESSION_KEY)
  }, [])

  const api = useMemo(() => createApiClient(() => sessionRef.current, setSession), [setSession])

  const authenticate = useCallback(async (mode, credentials) => {
    const response = await fetch(`${API_URL}/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(payload.message || 'Không thể xác thực.', response.status, payload)
    setSession({ user: payload.user, accessToken: payload.accessToken, refreshToken: payload.refreshToken })
    return payload
  }, [setSession])

  const logout = useCallback(async () => {
    try {
      if (sessionRef.current) await api.post('/auth/logout', {})
    } catch (_error) {
      // Local logout must still work when the server is unavailable.
    } finally {
      setSession(null)
    }
  }, [api, setSession])

  return { session, setSession, api, authenticate, logout }
}
