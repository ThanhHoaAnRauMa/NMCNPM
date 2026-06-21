import { describe, expect, it } from 'vitest'
import { generateIdentity } from './crypto.js'
import { createIdentityBackup, restoreIdentityBackup } from './keyBackup.js'

describe('encrypted device-key backups', () => {
  it('round-trips an identity for the same account', async () => {
    const identity = await generateIdentity()
    const backup = await createIdentityBackup('user-1', identity, 'correct horse battery staple')
    expect(await restoreIdentityBackup(backup, 'correct horse battery staple', 'user-1')).toEqual(identity)
    expect(backup).not.toContain(identity.encryptionPrivate.d)
  })

  it('rejects a wrong password and a different account', async () => {
    const identity = await generateIdentity()
    const backup = await createIdentityBackup('user-1', identity, 'correct horse battery staple')
    await expect(restoreIdentityBackup(backup, 'incorrect password value', 'user-1')).rejects.toThrow('Cannot decrypt backup')
    await expect(restoreIdentityBackup(backup, 'correct horse battery staple', 'user-2')).rejects.toThrow('different account')
  })
})
