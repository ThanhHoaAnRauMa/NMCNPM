export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function createApiClient(getSession, setSession) {
  async function refreshSession() {
    const session = getSession()
    if (!session?.refreshToken) return false
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
    if (!response.ok) return false
    const payload = await response.json()
    setSession({ ...session, accessToken: payload.accessToken, refreshToken: payload.refreshToken })
    return true
  }

  async function request(path, options = {}, canRetry = true) {
    const session = getSession()
    const headers = new Headers(options.headers || {})
    if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    })

    if (response.status === 401 && canRetry && !path.startsWith('/auth/')) {
      if (await refreshSession()) return request(path, options, false)
    }

    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json') ? await response.json() : await response.text()
    if (!response.ok) {
      const message = payload?.message || payload?.error || `Request failed (${response.status})`
      throw new ApiError(message, response.status, payload)
    }
    return payload
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
    upload: (path, formData) => request(path, { method: 'POST', body: formData }),
  }
}
