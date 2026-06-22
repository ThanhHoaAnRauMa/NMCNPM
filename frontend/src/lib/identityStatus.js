function canonicalBundle(value) {
  if (!value) return null
  const bundle = typeof value === 'string' ? JSON.parse(value) : value
  if (bundle?.v !== 1 || !bundle.encryption || !bundle.signing) return null
  return JSON.stringify(bundle)
}

export function publicBundlesEqual(left, right) {
  try {
    const normalizedLeft = canonicalBundle(left)
    const normalizedRight = canonicalBundle(right)
    return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
  } catch (_error) {
    return false
  }
}

export function identityStatus(identity, serverPublicKey) {
  if (!identity && !serverPublicKey) return 'missing'
  if (!identity) return 'remote-only'
  if (!serverPublicKey) return 'local-only'
  return publicBundlesEqual(identity.publicBundle, serverPublicKey) ? 'ready' : 'mismatch'
}

