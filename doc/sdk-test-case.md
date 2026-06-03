# Tài liệu kiểm thử ForensisChat Blockchain SDK (Exhaustive Suite)

## 1.1. Danh sách các Test Case tổng quát

### A. Khởi tạo & Cấu hình (Initialization & Configuration)

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 1 | SDK-TC-INIT-01 | SDK Init | Khởi tạo thành công với đầy đủ cấu hình (RPC, Key, Address, ABI). |
| 2 | SDK-TC-INIT-02 | SDK Init | Cảnh báo khi thiếu `RPC_URL`. |
| 3 | SDK-TC-INIT-03 | SDK Init | Cảnh báo khi thiếu `RELAYER_PRIVATE_KEY`. |
| 4 | SDK-TC-INIT-04 | SDK Init | Cảnh báo khi thiếu `CONTRACT_ADDRESS`. |
| 5 | SDK-TC-INIT-05 | SDK Init | Lỗi khi file ABI không tồn tại hoặc không hợp lệ. |
| 6 | SDK-TC-INIT-06 | Provider | Kiểm tra kết nối tới mạng blockchain qua `RPC_URL`. |

### B. Quản lý Room & Thành viên (Room & Participant Management)

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 7 | SDK-TC-ROOM-01 | Create Room | Tạo room mới thành công với danh sách participant hợp lệ. |
| 8 | SDK-TC-ROOM-02 | Create Room | Thất bại khi `roomId` đã tồn tại trên chain. |
| 9 | SDK-TC-ROOM-03 | Create Room | Thất bại khi danh sách `participants` rỗng. |
| 10 | SDK-TC-ROOM-04 | Add Participant | Master thêm thành công một participant mới. |
| 11 | SDK-TC-ROOM-05 | Add Participant | Thất bại khi người thêm không phải Master. |
| 12 | SDK-TC-ROOM-06 | Add Participant | Thất bại khi participant đã tồn tại trong room. |
| 13 | SDK-TC-ROOM-07 | Remove Participant | Master xóa thành công một participant. |
| 14 | SDK-TC-ROOM-08 | Remove Participant | Thất bại khi xóa Master khỏi room (Master cannot remove self). |
| 15 | SDK-TC-ROOM-09 | Remove Participant | Thất bại khi xóa người không phải participant. |
| 16 | SDK-TC-ROOM-10 | Transfer Master | Chuyển quyền Master cho một participant khác thành công. |
| 17 | SDK-TC-ROOM-11 | Transfer Master | Thất bại khi chuyển quyền cho người không phải participant. |

### C. Cấu hình & Timelock (Configuration & Timelocks)

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 18 | SDK-TC-CONF-01 | Propose Config | Master đề xuất disputeWindow mới thành công. |
| 19 | SDK-TC-CONF-02 | Veto Config | Participant (không phải Master) thực hiện veto thành công. |
| 20 | SDK-TC-CONF-03 | Veto Config | Thất bại khi veto khi không có proposal nào đang chờ. |
| 21 | SDK-TC-CONF-04 | Execute Config | Thực thi thay đổi config thành công sau 1 ngày timelock. |
| 22 | SDK-TC-CONF-05 | Execute Config | Thất bại khi thực thi trước khi hết hạn timelock. |

### D. Logic Merkle Tree & Forensics (Merkle Tree & Merkle Root)

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 23 | SDK-TC-MKL-01 | Build Tree | Tạo Merkle Tree cục bộ thành công từ danh sách tin nhắn nhỏ. |
| 24 | SDK-TC-MKL-02 | Build Tree | Xử lý mảng tin nhắn lớn (ví dụ: 10,000 tin nhắn) để kiểm tra performance. |
| 25 | SDK-TC-MKL-03 | Build Tree | Đảm bảo tính nhất quán của Root Hash khi mảng tin nhắn có tin trùng lặp. |
| 26 | SDK-TC-MKL-04 | Propose Root | Propose Merkle Root lên chain thành công bởi participant. |
| 27 | SDK-TC-MKL-05 | Propose Root | Tự động confirm root cũ khi propose root mới sau khi window kết thúc. |
| 28 | SDK-TC-MKL-06 | Dispute Root | Dispute thành công một root đang trong window. |
| 29 | SDK-TC-MKL-07 | Dispute Root | Thất bại khi Proposer tự dispute root của chính mình. |
| 30 | SDK-TC-MKL-08 | Dispute Root | Thất bại khi dispute root sau khi window đã đóng. |
| 31 | SDK-TC-MKL-09 | Confirm Root | Xác nhận root thủ công thành công sau khi window kết thúc. |
| 32 | SDK-TC-MKL-10 | Verify Proof | Xác minh thành công một tin nhắn hợp lệ với proof từ SDK. |
| 33 | SDK-TC-MKL-11 | Verify Proof | Thất bại khi xác minh tin nhắn bị sửa đổi (Tampered Message). |

### E. Quản trị & Trạng thái (Admin & State)

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 34 | SDK-TC-ADM-01 | Pause | Owner pause contract thành công. |
| 35 | SDK-TC-ADM-02 | Unpause | Owner unpause contract thành công. |
| 36 | SDK-TC-ADM-03 | Read State | `getRoomDetails` trả về dữ liệu chính xác tuyệt đối so với trên chain. |
| 37 | SDK-TC-ADM-04 | Read State | `isUserParticipant` trả về kết quả đúng cho cả trường hợp true và false. |

### F. Hạ tầng & Xử lý lỗi (Infrastructure & Error Handling)

| STT | Mã Test Case | Tính năng | Mô tả |
| :-- | :-- | :-- | :-- |
| 38 | SDK-TC-ERR-01 | Network | Xử lý lỗi khi RPC Server không phản hồi (Timeout). |
| 39 | SDK-TC-ERR-02 | Gas | Thất bại khi Relayer không đủ balance để trả phí gas. |
| 40 | SDK-TC-ERR-03 | Nonce | Xử lý lỗi khi gửi nhiều giao dịch đồng thời (concurrency). |
| 41 | SDK-TC-ERR-04 | Input | Kiểm tra SDK validation cho các input sai định dạng. |

---

## 1.2. Chi tiết các Test Case (Specifications)

### A. Khởi tạo & Cấu hình

#### 1.2.1. SDK-TC-INIT-01: Khởi tạo SDK hợp lệ

- **Tính năng:** SDK Initialization
- **Bối cảnh:** Môi trường đầy đủ biến.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Các đối tượng `provider`, `wallet`, `contract` được khởi tạo thành công.
- **Các bước kiểm thử:**
  1. Import SDK và kiểm tra log khởi tạo.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-INIT-01: should initialize correctly with full environment
```

- **Kết quả:** PASSED

#### 1.2.2. SDK-TC-INIT-02: Cảnh báo thiếu RPC_URL

- **Tính năng:** SDK Initialization
- **Bối cảnh:** Thiếu biến môi trường `RPC_URL`.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** SDK in cảnh báo "SDK initialized without full configuration".
- **Các bước kiểm thử:**
  1. Xóa `RPC_URL` và khởi tạo SDK.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-INIT-02: should warn about missing RPC_URL
```

- **Kết quả:** PASSED

#### 1.2.3. SDK-TC-INIT-03: Cảnh báo thiếu RELAYER_PRIVATE_KEY

- **Tính năng:** SDK Initialization
- **Bối cảnh:** Thiếu biến môi trường `RELAYER_PRIVATE_KEY`.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** SDK in cảnh báo về cấu hình không đầy đủ.
- **Các bước kiểm thử:**
  1. Xóa `RELAYER_PRIVATE_KEY` và khởi tạo SDK.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-INIT-03: should warn about missing RELAYER_PRIVATE_KEY
```

- **Kết quả:** PASSED

#### 1.2.4. SDK-TC-INIT-04: Cảnh báo thiếu CONTRACT_ADDRESS

- **Tính năng:** SDK Initialization
- **Bối cảnh:** Thiếu biến môi trường `CONTRACT_ADDRESS`.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** SDK in cảnh báo về cấu hình không đầy đủ.
- **Các bước kiểm thử:**
  1. Xóa `CONTRACT_ADDRESS` và khởi tạo SDK.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-INIT-04: should warn about missing CONTRACT_ADDRESS
```

- **Kết quả:** PASSED

#### 1.2.5. SDK-TC-INIT-05: Lỗi file ABI không hợp lệ

- **Tính năng:** SDK Initialization
- **Bối cảnh:** File ABI tại đường dẫn `out/` bị xóa hoặc hỏng.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** SDK in lỗi "Could not load ABI" và cảnh báo cấu hình.
- **Các bước kiểm thử:**
  1. Di chuyển file ABI sang chỗ khác. Khởi tạo SDK.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-INIT-05: should fail if ABI file is missing or invalid
```

- **Kết quả:** PASSED

#### 1.2.6. SDK-TC-INIT-06: Kiểm tra kết nối mạng

- **Tính năng:** Provider Connectivity
- **Bối cảnh:** `RPC_URL` hợp lệ.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** SDK có thể lấy được block number hiện tại.
- **Các bước kiểm thử:**
  1. Gọi `provider.getBlockNumber()`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-INIT-06: should connect to the blockchain provider
```

- **Kết quả:** PASSED

### B. Quản lý Room & Thành viên

#### 1.2.7. SDK-TC-ROOM-01: Create Room thành công

- **Tính năng:** Room Management
- **Bối cảnh:** ID chưa tồn tại.
- **Dữ liệu đầu vào:** `roomId`, `participants`, `disputeWindow`.
- **Kết quả mong đợi:** Trả về transaction receipt.
- **Các bước kiểm thử:**
  1. Gọi `createRoomOnChain`. Đợi giao dịch hoàn tất.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-01: should create a room successfully (4260ms)
```

- **Kết quả:** PASSED

#### 1.2.8. SDK-TC-ROOM-02: Thất bại khi ID trùng

- **Tính năng:** Room Management
- **Bối cảnh:** Room ID đã tồn tại trên chain.
- **Dữ liệu đầu vào:** ID cũ.
- **Kết quả mong đợi:** Giao dịch bị revert với lỗi "Room already exists".
- **Các bước kiểm thử:**
  1. Gọi `createRoomOnChain` với ID đã có.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-02: should fail when creating a duplicate room (53ms)
```

- **Kết quả:** PASSED

#### 1.2.9. SDK-TC-ROOM-03: Thất bại khi danh sách người tham gia rỗng

- **Tính năng:** Room Management
- **Bối cảnh:** ID hợp lệ.
- **Dữ liệu đầu vào:** `participants = []`.
- **Kết quả mong đợi:** Revert với lỗi "No participants provided".
- **Các bước kiểm thử:**
  1. Gọi `createRoomOnChain`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-03: should fail when creating room with empty participants (39ms)
```

- **Kết quả:** PASSED

#### 1.2.10. SDK-TC-ROOM-04: Thêm Participant thành công

- **Tính năng:** Participant Management
- **Bối cảnh:** Room tồn tại, Relayer là Master.
- **Dữ liệu đầu vào:** Address mới.
- **Kết quả mong đợi:** Transaction receipt trả về, sự kiện phát ra.
- **Các bước kiểm thử:**
  1. Gọi `addParticipantOnChain`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-04: should add a participant successfully (4203ms)
```

- **Kết quả:** PASSED

#### 1.2.11. SDK-TC-ROOM-05: Thất bại khi người thêm không phải Master

- **Tính năng:** Participant Management
- **Bối cảnh:** Relayer không phải là Master của room.
- **Dữ liệu đầu vào:** Address mới.
- **Kết quả mong đợi:** Revert với lỗi "Not the room master".
- **Các bước kiểm thử:**
  1. Dùng ví không phải master gọi `addParticipantOnChain`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-05: should fail if non-master adds participant (51ms)
```

- **Kết quả:** PASSED

#### 1.2.12. SDK-TC-ROOM-06: Thất bại khi thêm người đã có

- **Tính năng:** Participant Management
- **Bối cảnh:** Participant đã ở trong room.
- **Dữ liệu đầu vào:** Address cũ.
- **Kết quả mong đợi:** Revert với lỗi "Already a participant".
- **Các bước kiểm thử:**
  1. Thêm một người hai lần.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-06: should fail when adding an existing participant
```

- **Kết quả:** PASSED

#### 1.2.13. SDK-TC-ROOM-07: Xóa Participant thành công

- **Tính năng:** Participant Management
- **Bối cảnh:** Relayer là Master.
- **Dữ liệu đầu vào:** Address participant.
- **Kết quả mong đợi:** Giao dịch thành công.
- **Các bước kiểm thử:**
  1. Gọi `removeParticipantOnChain`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-07: should remove a participant successfully (4169ms)
```

- **Kết quả:** PASSED

#### 1.2.14. SDK-TC-ROOM-08: Thất bại khi Master tự xóa mình

- **Tính năng:** Participant Management
- **Bối cảnh:** Relayer là Master.
- **Dữ liệu đầu vào:** Address của Relayer.
- **Kết quả mong đợi:** Revert với lỗi "Room master cannot remove themselves".
- **Các bước kiểm thử:**
  1. Alice (Master) gọi `removeParticipantOnChain(Alice)`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-08: should fail if master tries to remove themselves
```

- **Kết quả:** PASSED

#### 1.2.15. SDK-TC-ROOM-09: Thất bại khi xóa người không tham gia

- **Tính năng:** Participant Management
- **Bối cảnh:** Charlie không ở trong room.
- **Dữ liệu đầu vào:** Address Charlie.
- **Kết quả mong đợi:** Revert với lỗi "Not a participant".
- **Các bước kiểm thử:**
  1. Gọi `removeParticipantOnChain(Charlie)`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-09: should fail when removing a non-participant
```

- **Kết quả:** PASSED

#### 1.2.16. SDK-TC-ROOM-10: Chuyển quyền Master thành công

- **Tính năng:** Room Master Management
- **Bối cảnh:** Relayer là Master. NewMaster là participant.
- **Dữ liệu đầu vào:** Address NewMaster.
- **Kết quả mong đợi:** `roomMaster` thay đổi.
- **Các bước kiểm thử:**
  1. Gọi `transferRoomOwnershipOnChain`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-10: should transfer room ownership successfully (12575ms)
```

- **Kết quả:** PASSED

#### 1.2.17. SDK-TC-ROOM-11: Thất bại khi chuyển quyền cho người ngoài

- **Tính năng:** Room Master Management
- **Bối cảnh:** Charlie không phải participant.
- **Dữ liệu đầu vào:** Address Charlie.
- **Kết quả mong đợi:** Revert với lỗi "New master must be a participant".
- **Các bước kiểm thử:**
  1. Gọi `transferRoomOwnershipOnChain(Charlie)`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ROOM-11: should fail when transferring ownership to a non-participant (50ms)
```

- **Kết quả:** PASSED

### C. Cấu hình & Timelock

#### 1.2.18. SDK-TC-CONF-01: Propose Config thành công

- **Tính năng:** Configuration
- **Bối cảnh:** Relayer là Master.
- **Dữ liệu đầu vào:** `disputeWindow = 7200`.
- **Kết quả mong đợi:** Trạng thái pending được cập nhật trên chain.
- **Các bước kiểm thử:**
  1. Gọi `proposeRoomConfig`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-CONF-01: should propose a new configuration successfully (4182ms)
```

- **Kết quả:** PASSED

#### 1.2.19. SDK-TC-CONF-02: Veto Config thành công

- **Tính năng:** Configuration
- **Bối cảnh:** Đang có proposal pending. Relayer là participant.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Proposal bị hủy.
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Bob (participant) gọi `vetoRoomConfig`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-CONF-02: should veto a configuration proposal successfully (4198ms)
```

- **Kết quả:** PASSED

#### 1.2.20. SDK-TC-CONF-03: Thất bại khi veto không đúng lúc

- **Tính năng:** Configuration
- **Bối cảnh:** Không có proposal nào đang pending.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "No config proposal pending".
- **Các bước kiểm thử:**
  1. Gọi `vetoRoomConfig`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-CONF-03: should fail to veto when no proposal exists
```

- **Kết quả:** PASSED

#### 1.2.21. SDK-TC-CONF-04: Execute Config thành công

- **Tính năng:** Configuration
- **Bối cảnh:** Proposal pending và đã qua 24 giờ.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Window mới được áp dụng.
- **Các bước kiểm thử:**
  1. Propose.
  2. Skip 1 day.
  3. Gọi `executeRoomConfig`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-CONF-04: should execute configuration successfully after timelock (8381ms)
```

- **Kết quả:** PASSED

#### 1.2.22. SDK-TC-CONF-05: Thất bại khi thực thi sớm

- **Tính năng:** Configuration
- **Bối cảnh:** Proposal pending nhưng chưa đủ 24 giờ.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Timelock not met".
- **Các bước kiểm thử:**
  1. Propose.
  2. Skip 23 giờ.
  3. Gọi `executeRoomConfig`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-CONF-05: should fail if executing configuration before timelock expiry (4224ms)
```

- **Kết quả:** PASSED

### D. Logic Merkle Tree & Forensics

#### 1.2.23. SDK-TC-MKL-01: Build Tree quy mô nhỏ

- **Tính năng:** Merkle Tree Logic
- **Bối cảnh:** Chạy cục bộ.
- **Dữ liệu đầu vào:** Mảng 5 tin nhắn.
- **Kết quả mong đợi:** Root Hash tính toán khớp with các công cụ Merkle chuẩn.
- **Các bước kiểm thử:**
  1. Gọi `buildMerkleTree`.
  2. Kiểm tra root.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-01: should build a valid tree from a small message list
```

- **Kết quả:** PASSED

#### 1.2.24. SDK-TC-MKL-02: Xử lý mảng lớn

- **Tính năng:** Performance
- **Bối cảnh:** Mảng 10,000 tin nhắn.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Xử lý nhanh, không treo máy.
- **Các bước kiểm thử:**
  1. Tạo 10,000 tin nhắn
  2. Chạy `buildMerkleTree`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-02: should handle performance check with a large message list
```

- **Kết quả:** PASSED

#### 1.2.25. SDK-TC-MKL-03: Tính nhất quán với dữ liệu trùng

- **Tính năng:** Merkle Tree Logic
- **Bối cảnh:** Dữ liệu có duplicate.
- **Dữ liệu đầu vào:** `[{A}, {A}]`.
- **Kết quả mong đợi:** Tree vẫn hợp lệ, root khớp với tính toán sortPairs.
- **Các bước kiểm thử:**
  1. Kiểm tra root của mảng có tin trùng.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-03: should maintain consistency with duplicate messages
```

- **Kết quả:** PASSED

#### 1.2.26. SDK-TC-MKL-04: Propose Merkle Root thành công

- **Tính năng:** Merkle Root Lifecycle
- **Bối cảnh:** Relayer là participant.
- **Dữ liệu đầu vào:** messagesArray.
- **Kết quả mong đợi:** `pendingRoot` được cập nhật trên chain.
- **Các bước kiểm thử:**
  1. Gọi `proposeMerkleRoot`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-04: should propose a Merkle Root successfully (4196ms)
```

- **Kết quả:** PASSED

#### 1.2.27. SDK-TC-MKL-05: Tự động confirm root cũ

- **Tính năng:** Merkle Root Lifecycle
- **Bối cảnh:** Root cũ đã hết window.
- **Dữ liệu đầu vào:** Root mới.
- **Kết quả mong đợi:** Root cũ chuyển vào `confirmedRoot`.
- **Các bước kiểm thử:**
  1. Propose R1.
  2. Skip 1h.
  3. Propose R2.
  4. Kiểm tra `confirmedRoot == R1`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-05: should auto-confirm previous root when proposing new one (4263ms)
```

- **Kết quả:** PASSED

#### 1.2.28. SDK-TC-MKL-06: Dispute Root thành công

- **Tính năng:** Merkle Root Lifecycle
- **Bối cảnh:** Root đang trong window. Relayer không phải proposer.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Pending root bị xóa.
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Bob gọi `disputeMerkleRoot`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-06: should dispute a root successfully (8344ms)
```

- **Kết quả:** PASSED

#### 1.2.29. SDK-TC-MKL-07: Thất bại khi tự dispute

- **Tính năng:** Merkle Root Lifecycle
- **Bối cảnh:** Relayer vừa propose root.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Proposer cannot dispute their own root".
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Alice gọi `disputeMerkleRoot`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-07: should fail if proposer attempts to dispute their own root (4209ms)
```

- **Kết quả:** PASSED

#### 1.2.30. SDK-TC-MKL-08: Thất bại khi dispute muộn

- **Tính năng:** Merkle Root Lifecycle
- **Bối cảnh:** Dispute window đã hết.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Dispute window has already closed".
- **Các bước kiểm thử:**
  1. Propose.
  2. Skip 1h.
  3. Gọi `disputeMerkleRoot`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-08: should fail when disputing after window closure (83ms)
```

- **Kết quả:** PASSED

#### 1.2.31. SDK-TC-MKL-09: Confirm Root thủ công

- **Tính năng:** Merkle Root Lifecycle
- **Bối cảnh:** Window đã hết.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** `confirmedRoot` cập nhật.
- **Các bước kiểm thử:**
  1. Propose.
  2. Skip 1.1h.
  3. Gọi `confirmMerkleRoot`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-09: should confirm root manually successfully (8413ms)
```

- **Kết quả:** PASSED

#### 1.2.32. SDK-TC-MKL-10: Verify Message Proof thành công

- **Tính năng:** Forensic Verification
- **Bối cảnh:** Đã có confirmed root.
- **Dữ liệu đầu vào:** leafHash, proof.
- **Kết quả mong đợi:** Trả về true.
- **Các bước kiểm thử:**
  1. Tạo proof cục bộ.
  2. Gọi `verifyMessageProof`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-10: should verify valid message proof successfully
```

- **Kết quả:** PASSED

#### 1.2.33. SDK-TC-MKL-11: Thất bại khi verify dữ liệu giả

- **Tính năng:** Forensic Verification
- **Bối cảnh:** Tin nhắn bị sửa đổi.
- **Dữ liệu đầu vào:** leafHash giả.
- **Kết quả mong đợi:** Trả về false.
- **Các bước kiểm thử:**
  1. Dùng proof cũ cho dữ liệu mới.
  2. Gọi `verifyMessageProof`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-MKL-11: should fail verification for tampered data
```

- **Kết quả:** PASSED

### E. Quản trị & Trạng thái

#### 1.2.34. SDK-TC-ADM-01: Pause contract thành công

- **Tính năng:** Emergency
- **Bối cảnh:** Relayer là owner.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** `paused()` trả về true.
- **Các bước kiểm thử:**
  1. Gọi `pauseContract()`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ADM-01: should pause the contract successfully (4222ms)
```

- **Kết quả:** PASSED

#### 1.2.35. SDK-TC-ADM-02: Unpause contract thành công

- **Tính năng:** Emergency
- **Bối cảnh:** Contract đang paused.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** `paused()` trả về false.
- **Các bước kiểm thử:**
  1. Gọi `unpauseContract()`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ADM-02: should unpause the contract successfully (4204ms)
```

- **Kết quả:** PASSED

#### 1.2.36. SDK-TC-ADM-03: Kiểm tra tính toàn vẹn dữ liệu

- **Tính năng:** Read Helpers
- **Bối cảnh:** Room tồn tại.
- **Dữ liệu đầu vào:** roomId.
- **Kết quả mong đợi:** Dữ liệu JS object khớp với Solidity struct.
- **Các bước kiểm thử:**
  1. Gọi `getRoomDetails`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ADM-03: should read accurate room details from chain
```

- **Kết quả:** PASSED

#### 1.2.37. SDK-TC-ADM-04: Kiểm tra trạng thái participant

- **Tính năng:** Read Helpers
- **Bối cảnh:** Bob trong room, Charlie không.
- **Dữ liệu đầu vào:** Address.
- **Kết quả mong đợi:** Trả về true cho Bob, false cho Charlie.
- **Các bước kiểm thử:**
  1. Gọi `isUserParticipant` cho hai address.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ADM-04: should check participant status accurately (49ms)
```

- **Kết quả:** PASSED

### F. Hạ tầng & Xử lý lỗi

#### 1.2.38. SDK-TC-ERR-01: Xử lý Network Timeout

- **Tính năng:** Resilience
- **Bối cảnh:** Ngắt kết nối mạng hoặc RPC sập.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** SDK throw timeout error, không treo app.
- **Các bước kiểm thử:**
  1. Ngắt mạng và gọi `getRoomDetails`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ERR-01: should handle network/RPC timeout resilience
```

- **Kết quả:** PASSED

#### 1.2.39. SDK-TC-ERR-02: Thất bại do thiếu Gas

- **Tính năng:** Error Handling
- **Bối cảnh:** Wallet có 0 ETH.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Lỗi "insufficient funds for gas".
- **Các bước kiểm thử:**
  1. Dùng ví rỗng gọi `createRoomOnChain`.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ERR-02: should fail gracefully when relayer has insufficient gas (51ms)
```

- **Kết quả:** PASSED

#### 1.2.40. SDK-TC-ERR-03: Xử lý Nonce trùng lặp

- **Tính năng:** Concurrency
- **Bối cảnh:** Gửi 5 giao dịch cùng lúc.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** SDK tự động tăng nonce và thực thi cả 5.
- **Các bước kiểm thử:**
  1. Chạy `Promise.all` cho 5 tác vụ thay đổi state.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ERR-03: should handle sequential transaction nonces reliably (8435ms)
```

- **Kết quả:** PASSED

#### 1.2.41. SDK-TC-ERR-04: Kiểm tra định dạng đầu vào

- **Tính năng:** Input Validation
- **Bối cảnh:** Input không phải hex.
- **Dữ liệu đầu vào:** `roomId = "abc"`.
- **Kết quả mong đợi:** SDK báo lỗi trước khi gửi transaction.
- **Các bước kiểm thử:**
  1. Gọi hàm với input sai.
- **Kết quả thực tế:**

```bash
✔ SDK-TC-ERR-04: should catch invalid input format locally
```

- **Kết quả:** PASSED
