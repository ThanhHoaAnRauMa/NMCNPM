# Tài liệu kiểm thử Database / DevOps / AI - Nguyễn Ngọc Tuân

## 1.1. Phạm vi kiểm thử

Tài liệu này mô tả các test case thuộc phạm vi vai trò của Nguyễn Ngọc Tuân:

| Nhóm | Phạm vi |
| :-- | :-- |
| Database | Mongoose models, MongoDB indexes, cursor pagination, search collection, MerkleCommit metadata |
| DevOps | Health endpoint, Docker healthcheck, Docker Compose config, GitHub Actions CI |
| AI Integration | `POST /ai/summarize`, `POST /ai/moderate`, summary cache, moderation fallback |

Các phần không thuộc phạm vi tài liệu này:

| Khu vực | Trạng thái |
| :-- | :-- |
| Frontend/Vercel | Blocked vì frontend app và Vercel config không có trong repository |
| Blockchain contract logic | Có tài liệu kiểm thử riêng của Blockchain owner |
| Chat Service trong `src/backend/*` | Thuộc Backend/Chat owner |

---

## 1.2. Môi trường kiểm thử

| Thành phần | Giá trị |
| :-- | :-- |
| Runtime | Node.js 24 |
| Test runner | `node --test` |
| HTTP test client | `supertest` |
| Database integration test | `mongodb-memory-server` |
| ODM | Mongoose |
| CI/CD | GitHub Actions |
| Container validation | Docker Compose config, Docker build trong CI |

Lệnh kiểm thử:

```bash
npm test
npm run test:integration
docker compose config
```

---

## 1.3. Danh sách các Test Case tổng quát

### A. Health & Deployment

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 1 | TUAN-TC-HEALTH-01 | Health API | Xác minh `GET /health` trả đúng contract production. |
| 2 | TUAN-TC-HEALTH-02 | Backward Compatibility | Xác minh `GET /healthz` vẫn hoạt động sau khi thêm `/health`. |
| 3 | TUAN-TC-DEPLOY-01 | Docker Compose | Xác minh `docker compose config` hợp lệ. |
| 4 | TUAN-TC-DEPLOY-02 | Docker Healthcheck | Xác minh Dockerfile và Compose dùng `GET /health`. |
| 5 | TUAN-TC-DEPLOY-03 | GitHub Actions | Xác minh CI chạy backend tests, Docker validation, Docker build và Foundry job. |

### B. Database Models

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 6 | TUAN-TC-DB-USER-01 | User CRUD | Tạo, đọc, cập nhật, xóa User trên MongoDB Memory Server. |
| 7 | TUAN-TC-DB-USER-02 | Password Hash | Xác minh password được hash và `comparePassword` hoạt động. |
| 8 | TUAN-TC-DB-CONV-01 | Conversation CRUD | Tạo, đọc, cập nhật, xóa Conversation. |
| 9 | TUAN-TC-DB-MSG-01 | Message CRUD | Tạo, đọc, cập nhật, xóa Message ciphertext-only. |
| 10 | TUAN-TC-DB-MSG-02 | Content Hash | Xác minh `contentHash` được sinh từ `encryptedContent`. |
| 11 | TUAN-TC-DB-MERKLE-01 | MerkleCommit CRUD | Tạo, đọc, cập nhật, xóa MerkleCommit metadata. |
| 12 | TUAN-TC-DB-INDEX-01 | Model Indexes | Xác minh các index Week 2 và TTL cache/search tồn tại. |

### C. Pagination & Search

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 13 | TUAN-TC-PAGE-01 | Cursor Pagination | Xác minh phân trang message bằng cursor không dùng `skip`. |
| 14 | TUAN-TC-PAGE-02 | Cursor Validation | Xác minh query từ chối ObjectId/cursor sai định dạng. |
| 15 | TUAN-TC-SEARCH-01 | Search API | Xác minh `POST /messages/search` chạy MongoDB text search thật. |
| 16 | TUAN-TC-SEARCH-02 | Search Filters | Xác minh search lọc theo `conversationId` và `senderId`. |
| 17 | TUAN-TC-SEARCH-03 | Highlight | Xác minh response có `highlightedSnippet` và escape HTML an toàn. |
| 18 | TUAN-TC-SEARCH-04 | Index Snippet | Xác minh `/messages/index-snippet` upsert snippet tạm thời. |

### D. AI Integration

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 19 | TUAN-TC-AI-SUM-01 | Summary Validation | Xác minh `/ai/summarize` bắt buộc client gửi plaintext opt-in. |
| 20 | TUAN-TC-AI-SUM-02 | Summary Cache | Xác minh summary được cache 1 giờ và không lưu plaintext. |
| 21 | TUAN-TC-AI-SUM-03 | Cache Hit | Xác minh cache hit không gọi Gemini lại. |
| 22 | TUAN-TC-AI-MOD-01 | Moderation Block | Xác minh harmful content bị block với HTTP 422. |
| 23 | TUAN-TC-AI-MOD-02 | Moderation Fallback | Xác minh Gemini unavailable thì allow và trả `is_moderated: false`. |

---

## 1.4. Chi tiết các Test Case

### 1.4.1. TUAN-TC-HEALTH-01: Production Health Endpoint

- **Tính năng:** Health API
- **Bối cảnh:** Backend cần endpoint production cho Render/Docker healthcheck.
- **Dữ liệu đầu vào:** `GET /health`
- **Kết quả mong đợi:** HTTP 200, body có `status`, `uptime`, `timestamp`.
- **Các bước kiểm thử:**
  1. Khởi tạo Express app test.
  2. Gọi `GET /health`.
  3. Kiểm tra response contract.
- **Kết quả thực tế:**

```bash
✔ GET /health returns production health contract while /healthz remains compatible
```

- **Kết quả:** Passed

### 1.4.2. TUAN-TC-HEALTH-02: Backward Compatible Healthz

- **Tính năng:** Backward Compatibility
- **Bối cảnh:** Docker/CI cũ từng dùng `/healthz`.
- **Dữ liệu đầu vào:** `GET /healthz`
- **Kết quả mong đợi:** HTTP 200, body `{ ok: true, env: "test" }`.
- **Các bước kiểm thử:**
  1. Khởi tạo Express app test với `env = test`.
  2. Gọi `GET /healthz`.
  3. So sánh body response.
- **Kết quả thực tế:**

```bash
✔ GET /health returns production health contract while /healthz remains compatible
```

- **Kết quả:** Passed

### 1.4.3. TUAN-TC-DEPLOY-01: Docker Compose Config

- **Tính năng:** Docker Compose
- **Bối cảnh:** Compose phải parse được service `app`, `mongo`, env và healthcheck.
- **Dữ liệu đầu vào:** `docker-compose.yml`
- **Kết quả mong đợi:** `docker compose config` exit code 0.
- **Các bước kiểm thử:**
  1. Chạy `docker compose config`.
  2. Xác minh Compose render service `app` và `mongo`.
- **Kết quả thực tế:**

```bash
docker compose config
# Exit code: 0
```

- **Kết quả:** Passed

### 1.4.4. TUAN-TC-DEPLOY-02: Docker Healthcheck

- **Tính năng:** Docker Healthcheck
- **Bối cảnh:** Week 4 yêu cầu health endpoint production là `GET /health`.
- **Dữ liệu đầu vào:** `Dockerfile`, `docker-compose.yml`
- **Kết quả mong đợi:** Healthcheck trỏ tới `/health`.
- **Các bước kiểm thử:**
  1. Kiểm tra `HEALTHCHECK` trong `Dockerfile`.
  2. Kiểm tra `services.app.healthcheck` trong `docker-compose.yml`.
- **Kết quả thực tế:**

```text
Dockerfile: wget --spider http://127.0.0.1:${PORT:-3000}/health
docker-compose.yml: wget --spider http://127.0.0.1:$${PORT:-3000}/health
```

- **Kết quả:** Passed

### 1.4.5. TUAN-TC-DEPLOY-03: GitHub Actions CI

- **Tính năng:** CI/CD
- **Bối cảnh:** Week 4 yêu cầu integration tests pass trong GitHub Actions.
- **Dữ liệu đầu vào:** `.github/workflows/test.yml`
- **Kết quả mong đợi:** Backend job và Foundry job đều success.
- **Các bước kiểm thử:**
  1. Push branch.
  2. Chờ GitHub Actions chạy `CI`.
  3. Kiểm tra trạng thái jobs.
- **Kết quả thực tế:**

```text
Backend database and API: success
Foundry contracts: success
```

- **Kết quả:** Passed

### 1.4.6. TUAN-TC-DB-USER-01: User CRUD

- **Tính năng:** User Model
- **Bối cảnh:** Database schema v1 phải hỗ trợ CRUD User.
- **Dữ liệu đầu vào:** `username`, `email`, `password`, `publicKey`
- **Kết quả mong đợi:** Có thể create, read, update `kycStatus`, delete User.
- **Các bước kiểm thử:**
  1. Tạo User trên MongoDB Memory Server.
  2. Cập nhật `kycStatus`.
  3. Xóa User.
  4. Xác minh document không còn tồn tại.
- **Kết quả thực tế:**

```bash
✔ User CRUD stores password hashes and supports credential comparison
```

- **Kết quả:** Passed

### 1.4.7. TUAN-TC-DB-USER-02: Password Hash

- **Tính năng:** User Security
- **Bối cảnh:** Password không được lưu plaintext.
- **Dữ liệu đầu vào:** `password = "strong-password"`
- **Kết quả mong đợi:** Saved password khác plaintext và `comparePassword` trả true.
- **Các bước kiểm thử:**
  1. Tạo User.
  2. Query lại với `.select("+password")`.
  3. So sánh password hash.
  4. Gọi `comparePassword`.
- **Kết quả thực tế:**

```bash
✔ User CRUD stores password hashes and supports credential comparison
```

- **Kết quả:** Passed

### 1.4.8. TUAN-TC-DB-CONV-01: Conversation CRUD

- **Tính năng:** Conversation Model
- **Bối cảnh:** Conversation lưu members, type, mode, createdBy.
- **Dữ liệu đầu vào:** 2 User ObjectId
- **Kết quả mong đợi:** Conversation được tạo, query theo member, update `name`, delete thành công.
- **Các bước kiểm thử:**
  1. Tạo Alice và Bob.
  2. Tạo Conversation direct.
  3. Query theo `members`.
  4. Update `name`.
  5. Delete Conversation.
- **Kết quả thực tế:**

```bash
✔ Conversation CRUD persists member metadata
```

- **Kết quả:** Passed

### 1.4.9. TUAN-TC-DB-MSG-01: Message CRUD Ciphertext-Only

- **Tính năng:** Message Model
- **Bối cảnh:** Message không được lưu plaintext.
- **Dữ liệu đầu vào:** `encryptedContent`, `signature`, `senderId`, `conversationId`
- **Kết quả mong đợi:** Message lưu ciphertext metadata, không có field `content` hoặc `plaintext`.
- **Các bước kiểm thử:**
  1. Tạo User và Conversation.
  2. Tạo Message.
  3. Kiểm tra `encryptedContent` và `signature`.
  4. Kiểm tra không có `content`/`plaintext`.
  5. Update và delete Message.
- **Kết quả thực tế:**

```bash
✔ Message CRUD stores ciphertext metadata without plaintext
```

- **Kết quả:** Passed

### 1.4.10. TUAN-TC-DB-MSG-02: Content Hash

- **Tính năng:** Message Integrity
- **Bối cảnh:** `contentHash` dùng để kiểm tra integrity metadata.
- **Dữ liệu đầu vào:** `encryptedContent = "ciphertext"`
- **Kết quả mong đợi:** `contentHash` tự sinh SHA-256 hex 64 ký tự.
- **Các bước kiểm thử:**
  1. Tạo Message không truyền `contentHash`.
  2. Xác minh `contentHash` match regex SHA-256.
- **Kết quả thực tế:**

```bash
✔ Message CRUD stores ciphertext metadata without plaintext
```

- **Kết quả:** Passed

### 1.4.11. TUAN-TC-DB-MERKLE-01: MerkleCommit CRUD

- **Tính năng:** MerkleCommit Model
- **Bối cảnh:** Database phải lưu metadata phục vụ blockchain compatibility.
- **Dữ liệu đầu vào:** `conversationId`, `rootHash`, `txHash`, `leafCount`, `committedBy`
- **Kết quả mong đợi:** Tạo commit `proposed`, update `confirmed`, query theo conversation, delete được.
- **Các bước kiểm thử:**
  1. Tạo Conversation.
  2. Tạo MerkleCommit.
  3. Update `status` và `blockNumber`.
  4. Query theo `conversationId`.
  5. Delete MerkleCommit.
- **Kết quả thực tế:**

```bash
✔ MerkleCommit CRUD persists on-chain commit metadata
```

- **Kết quả:** Passed

### 1.4.12. TUAN-TC-DB-INDEX-01: Model Indexes

- **Tính năng:** Database Indexing
- **Bối cảnh:** Week 2 yêu cầu compound index cho chat/sender history và text index cho search.
- **Dữ liệu đầu vào:** Mongoose schemas
- **Kết quả mong đợi:** Indexes tồn tại trên schema.
- **Các bước kiểm thử:**
  1. Đọc `Message.schema.indexes()`.
  2. Đọc `MessageSearch.schema.indexes()`.
  3. Đọc `AISummaryCache.schema.indexes()`.
  4. Xác minh compound/text/TTL indexes.
- **Kết quả thực tế:**

```bash
✔ Message stores ciphertext metadata only and has Week 2 history indexes
✔ MessageSearch is text indexed and TTL-cleaned after 24 hours
✔ AISummaryCache stores summaries only and expires after one hour
```

- **Kết quả:** Passed

### 1.4.13. TUAN-TC-PAGE-01: Cursor Pagination

- **Tính năng:** Pagination
- **Bối cảnh:** Week 2 yêu cầu cursor-based pagination, không dùng skip/limit offset.
- **Dữ liệu đầu vào:** 3 Message cùng Conversation
- **Kết quả mong đợi:** Page 1 trả 2 message mới nhất, page 2 trả message còn lại.
- **Các bước kiểm thử:**
  1. Insert 3 Message với timestamp tăng dần.
  2. Gọi `getMessagesByCursor({ limit: 2 })`.
  3. Dùng `nextCursor` gọi page tiếp theo.
  4. Xác minh `hasMore`.
- **Kết quả thực tế:**

```bash
✔ Cursor pagination returns chat history without skip/limit offsets
```

- **Kết quả:** Passed

### 1.4.14. TUAN-TC-PAGE-02: Cursor Validation

- **Tính năng:** Pagination Validation
- **Bối cảnh:** Query helper phải từ chối identifier sai định dạng.
- **Dữ liệu đầu vào:** `conversationId = "invalid"`
- **Kết quả mong đợi:** Throw lỗi `valid ObjectId`.
- **Các bước kiểm thử:**
  1. Gọi `getMessagesByCursor` với `conversationId` sai.
  2. Xác minh lỗi.
- **Kết quả thực tế:**

```bash
✔ cursor query rejects invalid identifiers before accessing MongoDB
```

- **Kết quả:** Passed

### 1.4.15. TUAN-TC-SEARCH-01: MongoDB Text Search

- **Tính năng:** Search API
- **Bối cảnh:** Search chạy trên `MessageSearch`, không search ciphertext.
- **Dữ liệu đầu vào:** Snippet chứa `forensic`
- **Kết quả mong đợi:** `POST /messages/search` trả 1 result.
- **Các bước kiểm thử:**
  1. Tạo User, Conversation, Message.
  2. Tạo `MessageSearch` snippet.
  3. Gọi `/messages/search` với keyword.
  4. Kiểm tra result.
- **Kết quả thực tế:**

```bash
✔ Search API performs MongoDB text search with filters and highlights
```

- **Kết quả:** Passed

### 1.4.16. TUAN-TC-SEARCH-02: Search Filters

- **Tính năng:** Search Filtering
- **Bối cảnh:** Search phải lọc được theo conversation và sender.
- **Dữ liệu đầu vào:** `conversationId`, `senderId`
- **Kết quả mong đợi:** Chỉ trả snippet đúng filter.
- **Các bước kiểm thử:**
  1. Tạo snippet có `conversationId` và `senderId`.
  2. Gửi request filter theo cả hai field.
  3. Xác minh result length.
- **Kết quả thực tế:**

```bash
✔ Search API performs MongoDB text search with filters and highlights
```

- **Kết quả:** Passed

### 1.4.17. TUAN-TC-SEARCH-03: Highlight & Escape HTML

- **Tính năng:** Search Highlight
- **Bối cảnh:** Highlight không được render HTML nguy hiểm.
- **Dữ liệu đầu vào:** Snippet chứa HTML và keyword `hello`
- **Kết quả mong đợi:** HTML được escape, keyword được bọc `<em>`.
- **Các bước kiểm thử:**
  1. Stub aggregate result chứa `<script>alert(1)</script> hello`.
  2. Gọi `/messages/search`.
  3. Kiểm tra `highlightedSnippet`.
- **Kết quả thực tế:**

```bash
✔ POST /messages/search caps results and escapes untrusted snippets
```

- **Kết quả:** Passed

### 1.4.18. TUAN-TC-SEARCH-04: Index Snippet Upsert

- **Tính năng:** Search Indexing
- **Bối cảnh:** Client có thể opt-in upload plaintext snippet tạm thời.
- **Dữ liệu đầu vào:** `messageId`, `conversationId`, `senderId`, `snippet`
- **Kết quả mong đợi:** Snippet được trim và upsert theo `messageId`.
- **Các bước kiểm thử:**
  1. Gửi `POST /messages/index-snippet`.
  2. Kiểm tra update payload trim snippet.
  3. Kiểm tra option `upsert = true`.
- **Kết quả thực tế:**

```bash
✔ POST /messages/index-snippet upserts one trimmed ephemeral snippet per message
```

- **Kết quả:** Passed

### 1.4.19. TUAN-TC-AI-SUM-01: Summary Requires Plaintext Opt-In

- **Tính năng:** AI Summary Validation
- **Bối cảnh:** Backend không decrypt ciphertext, client phải gửi plaintext tạm thời.
- **Dữ liệu đầu vào:** Request thiếu `messages`
- **Kết quả mong đợi:** HTTP 400, báo thiếu plaintext messages.
- **Các bước kiểm thử:**
  1. Gửi `POST /ai/summarize` chỉ có `conversationId` và `messageIds`.
  2. Kiểm tra status 400.
- **Kết quả thực tế:**

```bash
✔ POST /ai/summarize requires opt-in plaintext messages
```

- **Kết quả:** Passed

### 1.4.20. TUAN-TC-AI-SUM-02: Summary Cache Without Plaintext

- **Tính năng:** AI Summary Cache
- **Bối cảnh:** Summary được cache 1 giờ, không lưu plaintext source.
- **Dữ liệu đầu vào:** `conversationId`, `messageIds`, `messages[].text`
- **Kết quả mong đợi:** Cache document có `summary`, `expiresAt`, không có field `messages`.
- **Các bước kiểm thử:**
  1. Stub MessageModel verify message thuộc conversation.
  2. Stub Gemini response.
  3. Gọi `/ai/summarize`.
  4. Kiểm tra cache update payload.
- **Kết quả thực tế:**

```bash
✔ POST /ai/summarize verifies message ids and stores summary without plaintext
```

- **Kết quả:** Passed

### 1.4.21. TUAN-TC-AI-SUM-03: Summary Cache Hit

- **Tính năng:** AI Summary Cache
- **Bối cảnh:** Tránh gọi Gemini lại để giảm rate limit.
- **Dữ liệu đầu vào:** Cached summary còn hạn.
- **Kết quả mong đợi:** Response `cached = true`, không gọi Gemini.
- **Các bước kiểm thử:**
  1. Stub `SummaryCacheModel.findOne` trả cached summary.
  2. Gọi `/ai/summarize`.
  3. Xác minh `generateText` không được gọi.
- **Kết quả thực tế:**

```bash
✔ POST /ai/summarize returns cached summary without calling Gemini
```

- **Kết quả:** Passed

### 1.4.22. TUAN-TC-AI-MOD-01: Block Harmful Content

- **Tính năng:** Content Moderation
- **Bối cảnh:** Gemini phát hiện nội dung harmful trước khi encrypt/send.
- **Dữ liệu đầu vào:** Plaintext harmful text.
- **Kết quả mong đợi:** HTTP 422, body có `message_blocked` và warning.
- **Các bước kiểm thử:**
  1. Stub moderation result `allowed = false`.
  2. Gọi `/ai/moderate`.
  3. Kiểm tra response.
- **Kết quả thực tế:**

```bash
✔ POST /ai/moderate blocks harmful content and warns sender
```

- **Kết quả:** Passed

### 1.4.23. TUAN-TC-AI-MOD-02: Moderation Fallback

- **Tính năng:** Content Moderation Fallback
- **Bối cảnh:** Nếu Gemini unavailable/timeout, hệ thống không chặn message.
- **Dữ liệu đầu vào:** Plaintext message.
- **Kết quả mong đợi:** Request được allow, `is_moderated = false`.
- **Các bước kiểm thử:**
  1. Stub moderation unavailable result.
  2. Gọi middleware.
  3. Xác minh route tiếp theo vẫn chạy.
- **Kết quả thực tế:**

```bash
✔ moderation middleware allows messages when Gemini is unavailable
```

- **Kết quả:** Passed

---

## 1.5. Kết quả chạy kiểm thử tổng hợp

### Backend Unit + Integration Tests

```bash
npm test
```

Kết quả:

```text
tests 23
pass 23
fail 0
```

### Integration Tests

```bash
npm run test:integration
```

Kết quả:

```text
tests 7
pass 7
fail 0
```

### Docker Compose Validation

```bash
docker compose config
```

Kết quả:

```text
Exit code: 0
```

### GitHub Actions

Kết quả trên branch Week 4:

```text
Backend database and API: success
Foundry contracts: success
```

---

## 1.6. Traceability Matrix

| Deliverable | Test Case liên quan | Trạng thái |
| :-- | :-- | :-- |
| Database Schema v1.0 | TUAN-TC-DB-USER-01 đến TUAN-TC-DB-MERKLE-01 | Covered |
| Message ciphertext-only | TUAN-TC-DB-MSG-01 | Covered |
| Compound indexes | TUAN-TC-DB-INDEX-01 | Covered |
| Cursor pagination | TUAN-TC-PAGE-01, TUAN-TC-PAGE-02 | Covered |
| Search API | TUAN-TC-SEARCH-01 đến TUAN-TC-SEARCH-04 | Covered |
| AI Summary API | TUAN-TC-AI-SUM-01 đến TUAN-TC-AI-SUM-03 | Covered |
| Content Moderation | TUAN-TC-AI-MOD-01, TUAN-TC-AI-MOD-02 | Covered |
| Production Health | TUAN-TC-HEALTH-01, TUAN-TC-HEALTH-02 | Covered |
| Docker/Compose | TUAN-TC-DEPLOY-01, TUAN-TC-DEPLOY-02 | Covered |
| GitHub Actions CI | TUAN-TC-DEPLOY-03 | Covered |
| Vercel Deployment | Not covered | Blocked: frontend/Vercel config not found |
| Render live deployment | Partially covered | Workflow exists; real deployment depends on repository secrets |

---

## 1.7. Rủi ro còn lại

| Rủi ro | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Auth/authorization cho search và AI routes | Chưa hoàn tất trong root backend | Thuộc phần backend integration sau này |
| Vercel deployment | Blocked | Repository không có frontend app/config |
| Render production health thật | Phụ thuộc external config | Cần `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `MONGO_URI`, `GEMINI_API_KEY` |
| Gemini live quota/rate limit | Chưa test live trong CI | CI dùng stub để tránh lộ secret và tránh quota |
