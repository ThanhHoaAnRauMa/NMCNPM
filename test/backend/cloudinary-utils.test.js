import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { getCloudinaryConfig } = require('../../src/backend/src/utils/cloudinary.utils.js')

test('Cloudinary configuration is read lazily from the current environment', () => {
  const env = {
    CLOUDINARY_CLOUD_NAME: 'cloud-name',
    CLOUDINARY_API_KEY: 'api-key',
    CLOUDINARY_API_SECRET: 'api-secret',
  }

  assert.deepEqual(getCloudinaryConfig(env), {
    cloud_name: 'cloud-name',
    api_key: 'api-key',
    api_secret: 'api-secret',
  })
})

test('Cloudinary configuration rejects missing credentials', () => {
  assert.throws(
    () => getCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: 'cloud-name' }),
    /credentials are not configured/
  )
})
