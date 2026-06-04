import { createSecurityMiddleware } from '../../backend/middleware/security.js';

const security = createSecurityMiddleware({
  rateLimit: { max: 2, windowMs: 60_000 },
});

function mockReq(body = {}) {
  return {
    ip: '127.0.0.1',
    body,
    query: {},
    params: {},
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; },
  };
}

const req = mockReq({
  email: 'user@example.com',
  password: 'strong-password',
  username: '<script>alice</script>',
});
const res = mockRes();
const next = () => {};

security.securityHeaders(req, res, next);
security.sanitizeInput(req, res, next);
security.validateAuthPayload(req, res, next);

console.log({ sanitizedBody: req.body, responseHeaders: res.headers, statusCode: res.statusCode });
