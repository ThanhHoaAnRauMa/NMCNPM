import { describe, expect, it } from 'vitest'
import { identityStatus, publicBundlesEqual } from './identityStatus.js'

const bundle = (x = 'one') => JSON.stringify({ v: 1, encryption: { kty: 'RSA', n: x }, signing: { kty: 'EC', x } })

describe('device identity status', () => {
  it('recognizes equivalent local and server bundles', () => {
    const local = { publicBundle: bundle() }
    expect(identityStatus(local, bundle())).toBe('ready')
    expect(publicBundlesEqual(local.publicBundle, JSON.parse(bundle()))).toBe(true)
  })

  it('distinguishes missing and conflicting key states', () => {
    expect(identityStatus(null, null)).toBe('missing')
    expect(identityStatus(null, bundle())).toBe('remote-only')
    expect(identityStatus({ publicBundle: bundle() }, null)).toBe('local-only')
    expect(identityStatus({ publicBundle: bundle('old') }, bundle('new'))).toBe('mismatch')
  })
})

