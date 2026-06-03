## 1.1. Danh sách các Test Case

| STT | Test Case                   | Tính năng            | Mô tả                                                                                                           |
| :-- | :-------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------- |
| 1   | TC-01: Revert Initialized   | Initialization         | Đảm bảo contract không thể được initialized nhiều hơn một lần.                                        |
| 2   | TC-02: Pause/Unpause        | Administrative         | Xác minh owner có thể pause và unpause contract.                                                              |
| 3   | TC-03: Pause Not Owner      | Administrative         | Đảm bảo người không phải owner không thể pause hoặc unpause contract.                                   |
| 4   | TC-04: Upgrade Not Owner    | Administrative         | Đảm bảo người không phải owner không thể upgrade implementation của contract.                           |
| 5   | TC-05: Upgrade Success      | Administrative         | Xác minh owner có thể upgrade thành công contract thông qua UUPS.                                           |
| 6   | TC-06: Create Room Success  | Room Management        | Xác minh việc tạo room thành công với các participant.                                                     |
| 7   | TC-07: Room Already Exists  | Room Management        | Đảm bảo việc tạo room với ID đã tồn tại sẽ revert.                                                     |
| 8   | TC-08: No Participants      | Room Management        | Đảm bảo việc tạo room mà không có participant sẽ revert.                                                 |
| 9   | TC-09: Room Not Found       | Modifiers              | Đảm bảo các hành động trên room không tồn tại sẽ revert.                                              |
| 10  | TC-10: Not Participant      | Modifiers              | Đảm bảo người không phải participant không thể thực hiện các hành động chỉ dành cho participant. |
| 11  | TC-11: Not Room Master      | Modifiers              | Đảm bảo người không phải master không thể thực hiện các hành động chỉ dành cho master.           |
| 12  | TC-12: Add Participant      | Participant Management | Xác minh Room Master có thể thêm participant mới.                                                            |
| 13  | TC-13: Add Existing         | Participant Management | Đảm bảo việc thêm participant đã tồn tại sẽ revert.                                                     |
| 14  | TC-14: Remove Participant   | Participant Management | Xác minh Room Master có thể remove participant.                                                                |
| 15  | TC-15: Remove Non-existent  | Participant Management | Đảm bảo việc remove một người không phải participant sẽ revert.                                         |
| 16  | TC-16: Master Remove Self   | Participant Management | Đảm bảo Room Master không thể tự remove chính mình.                                                       |
| 17  | TC-17: Transfer Ownership   | Room Master Management | Xác minh việc chuyển giao vai trò room master thành công.                                                   |
| 18  | TC-18: Transfer Zero Addr   | Room Master Management | Đảm bảo việc chuyển giao tới address(0) sẽ revert.                                                         |
| 19  | TC-19: Transfer Non-part    | Room Master Management | Đảm bảo việc chuyển giao tới một người không phải participant sẽ revert.                              |
| 20  | TC-20: Propose & Execute    | Configuration          | Xác minh timelock 1 ngày và việc execute thay đổi config.                                                   |
| 21  | TC-21: Veto No Proposal     | Configuration          | Đảm bảo việc veto khi không có proposal nào đang chờ sẽ revert.                                         |
| 22  | TC-22: Veto Success         | Configuration          | Xác minh bất kỳ participant nào cũng có thể veto một config proposal.                                     |
| 23  | TC-23: Execute No Proposal  | Configuration          | Đảm bảo việc execute khi không có proposal nào đang chờ sẽ revert.                                      |
| 24  | TC-24: Execute Before Time  | Configuration          | Đảm bảo việc execute trước khi timelock hết hạn sẽ revert.                                               |
| 25  | TC-25: Propose Root         | Merkle Root            | Xác minh việc propose Merkle root thành công bởi một participant.                                           |
| 26  | TC-26: Auto-confirm Root    | Merkle Root            | Xác minh một proposal mới sẽ tự động confirm một pendingRoot đã hết hạn.                              |
| 27  | TC-27: Confirm Root         | Merkle Root            | Xác minh việc confirm thủ công một root sau khi dispute window kết thúc.                                   |
| 28  | TC-28: Confirm No Root      | Merkle Root            | Đảm bảo việc confirm khi không có pendingRoot tồn tại sẽ revert.                                         |
| 29  | TC-29: Confirm Window Act   | Merkle Root            | Đảm bảo việc confirm trong khi dispute window vẫn đang hoạt động sẽ revert.                             |
| 30  | TC-30: Dispute Success      | Merkle Root            | Xác minh việc dispute một pendingRoot thành công.                                                            |
| 31  | TC-31: Dispute No Root      | Merkle Root            | Đảm bảo việc dispute khi không có pendingRoot tồn tại sẽ revert.                                         |
| 32  | TC-32: Dispute Window Clo   | Merkle Root            | Đảm bảo việc dispute sau khi dispute window đóng sẽ revert.                                                |
| 33  | TC-33: Dispute Own Root     | Merkle Root            | Đảm bảo proposer không thể dispute root của chính họ.                                                     |
| 34  | TC-34: Verify Proof Success | Forensic Verify        | Xác minh proof Merkle hợp lệ đối với confirmedRoot.                                                         |
| 35  | TC-35: Verify Proof False   | Forensic Verify        | Đảm bảo leaf/proof không hợp lệ trả về false.                                                             |
| 36  | TC-36: Verify No Root       | Forensic Verify        | Đảm bảo việc verify sẽ revert nếu không có root nào được confirmed.                                   |

---

## 1.2. Chi tiết các Test Case

### 1.2.1. TC-01: Revert Initialized

- **Tính năng:** Initialization
- **Bối cảnh:** contract đã được initialized trong hàm `setUp`.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Giao dịch revert với lỗi "Initializable: contract is already initialized".
- **Các bước kiểm thử:**
  1. Gọi hàm `chat.initialize(owner)`.
  2. Xác nhận giao dịch bị revert.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_Initialize_RevertAlreadyInitialized() (gas: 18525)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.26ms (130.20µs CPU time)
```

- **Kết quả:** Passed

### 1.2.2. TC-02: Pause/Unpause

- **Tính năng:** Administrative
- **Bối cảnh:** Trạng thái ban đầu là unpaused.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** `paused()` trả về true sau khi pause, false sau khi unpause. Các hành động sẽ revert khi đang paused.
- **Các bước kiểm thử:**
  1. Gọi hàm `pause()`. Xác nhận trạng thái.
  2. Thử thực hiện một cuộc gọi thay đổi trạng thái (ví dụ: `createRoom`). Xác nhận revert.
  3. Gọi hàm `unpause()`. Xác nhận trạng thái.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_PauseUnpause() (gas: 198946)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.30ms (181.70µs CPU time)
```

- **Kết quả:** Passed

### 1.2.3. TC-03: Pause Not Owner

- **Tính năng:** Administrative
- **Bối cảnh:** Alice (không phải owner) cố gắng pause contract.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi `OwnableUnauthorizedAccount`.
- **Các bước kiểm thử:**
  1. `vm.prank(alice)`.
  2. Gọi hàm `chat.pause()`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_PauseUnpause_NotOwner() (gas: 27320)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.78ms (343.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.4. TC-04: Upgrade Not Owner

- **Tính năng:** Administrative
- **Bối cảnh:** Alice cố gắng upgrade implementation.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Giao dịch revert.
- **Các bước kiểm thử:**
  1. Deploy `newImpl`.
  2. `vm.prank(alice)`.
  3. Gọi hàm `upgradeToAndCall`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_Upgrade_RevertNonOwner() (gas: 3274419)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.82ms (487.20µs CPU time)
```

- **Kết quả:** Passed

### 1.2.5. TC-05: Upgrade Success

- **Tính năng:** Administrative
- **Bối cảnh:** owner upgrade implementation.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** implementation được cập nhật thông qua UUPS.
- **Các bước kiểm thử:**
  1. Deploy `newImpl`.
  2. Gọi hàm `upgradeToAndCall`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_Upgrade_OwnerSuccess() (gas: 3273994)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 934.20µs (161.50µs CPU time)
```

- **Kết quả:** Passed

### 1.2.6. TC-06: Create Room Success

- **Tính năng:** Room Management
- **Bối cảnh:** Alice tạo một room mới.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Trạng thái room được khởi tạo chính xác. Alice là master. Alice và Bob là các participant.
- **Các bước kiểm thử:**
  1. Alice gọi hàm `createRoom`.
  2. Xác minh `rooms(roomId)` tồn tại và khớp với dữ liệu đầu vào.
  3. Xác minh `isParticipant` cho Alice và Bob.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_CreateRoom() (gas: 195185)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.92ms (261.00µs CPU time)
```

- **Kết quả:** Passed

### 1.2.7. TC-07: Room Already Exists

- **Tính năng:** Room Management
- **Bối cảnh:** Room 1 đã được tạo.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Room already exists".
- **Các bước kiểm thử:**
  1. Tạo Room 1.
  2. Thử tạo lại Room 1 lần nữa.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_CreateRoom_AlreadyExists() (gas: 200829)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.44ms (299.30µs CPU time)
```

- **Kết quả:** Passed

### 1.2.8. TC-08: No Participants

- **Tính năng:** Room Management
- **Bối cảnh:** Alice tạo một room với danh sách participant trống.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "No participants provided".
- **Các bước kiểm thử:**
  1. Gọi hàm `createRoom` với mảng trống.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_CreateRoom_NoParticipants() (gas: 26885)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.87ms (261.90µs CPU time)
```

- **Kết quả:** Passed

### 1.2.9. TC-09: Room Not Found

- **Tính năng:** Modifiers
- **Bối cảnh:** Gọi hàm phụ thuộc vào room với một ID chưa được đăng ký.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Room does not exist".
- **Các bước kiểm thử:**
  1. Gọi hàm `executeConfig` với ID 999.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_RoomDoesNotExist() (gas: 20770)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.11ms (83.90µs CPU time)
```

- **Kết quả:** Passed

### 1.2.10. TC-10: Not Participant

- **Tính năng:** Modifiers
- **Bối cảnh:** Charlie (không phải participant) cố gắng veto.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Not a room participant".
- **Các bước kiểm thử:**
  1. Tạo Room 1 (Alice & Bob).
  2. Charlie gọi hàm `vetoConfig`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_NotParticipant() (gas: 203508)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.32ms (379.20µs CPU time)
```

- **Kết quả:** Passed

### 1.2.11. TC-11: Not Room Master

- **Tính năng:** Modifiers
- **Bối cảnh:** Bob (participant) cố gắng propose thay đổi config.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Not the room master".
- **Các bước kiểm thử:**
  1. Bob gọi hàm `proposeConfig`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_NotRoomMaster() (gas: 199774)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 903.30µs (200.20µs CPU time)
```

- **Kết quả:** Passed

### 1.2.12. TC-12: Add Participant

- **Tính năng:** Participant Management
- **Bối cảnh:** Alice (master) thêm Charlie.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Charlie được thêm vào.
- **Các bước kiểm thử:**
  1. Alice gọi hàm `addParticipant`.
  2. Xác minh `isParticipant(1, Charlie)`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_AddParticipant_Success() (gas: 228192)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.08ms (181.90µs CPU time)
```

- **Kết quả:** Passed

### 1.2.13. TC-13: Add Existing

- **Tính năng:** Participant Management
- **Bối cảnh:** Bob đã ở trong room.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Already a participant".
- **Các bước kiểm thử:**
  1. Gọi hàm `addParticipant` cho Bob.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_AddParticipant_AlreadyParticipant() (gas: 200261)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.48ms (284.80µs CPU time)
```

- **Kết quả:** Passed

### 1.2.14. TC-14: Remove Participant

- **Tính năng:** Participant Management
- **Bối cảnh:** Alice remove Bob.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Bob bị remove.
- **Các bước kiểm thử:**
  1. Alice gọi hàm `removeParticipant`.
  2. Xác minh `isParticipant(1, Bob)` là false.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_RemoveParticipant_Success() (gas: 184362)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.31ms (232.40µs CPU time)
```

- **Kết quả:** Passed

### 1.2.15. TC-15: Remove Non-existent

- **Tính năng:** Participant Management
- **Bối cảnh:** Charlie không có trong room.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Not a participant".
- **Các bước kiểm thử:**
  1. Gọi hàm `removeParticipant` cho Charlie.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_RemoveParticipant_NotParticipant() (gas: 204304)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 4.41ms (838.70µs CPU time)
```

- **Kết quả:** Passed

### 1.2.16. TC-16: Master Remove Self

- **Tính năng:** Participant Management
- **Bối cảnh:** Alice cố gắng tự remove chính mình.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Room master cannot remove themselves".
- **Các bước kiểm thử:**
  1. Alice gọi hàm `removeParticipant(1, Alice)`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_RemoveParticipant_MasterRemoveSelf() (gas: 200316)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.21ms (212.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.17. TC-17: Transfer Ownership

- **Tính năng:** Room Master Management
- **Bối cảnh:** Alice chuyển giao cho Bob.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Bob là `roomMaster` mới.
- **Các bước kiểm thử:**
  1. Alice gọi hàm `transferRoomOwnership`.
  2. Xác minh `roomMaster == Bob`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_TransferOwnership_Success() (gas: 208696)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.95ms (212.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.18. TC-18: Transfer Zero Addr

- **Tính năng:** Room Master Management
- **Bối cảnh:** Alice chuyển giao tới 0x0.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Invalid address".
- **Các bước kiểm thử:**
  1. Gọi hàm transfer với zero address.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_TransferOwnership_ZeroAddress() (gas: 199886)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.28ms (227.80µs CPU time)
```

- **Kết quả:** Passed

### 1.2.19. TC-19: Transfer Non-part

- **Tính năng:** Room Master Management
- **Bối cảnh:** Alice chuyển giao tới Charlie (không có trong room).
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "New master must be a participant".
- **Các bước kiểm thử:**
  1. Gọi hàm transfer cho Charlie.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_TransferOwnership_NotParticipant() (gas: 204403)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.08ms (240.30µs CPU time)
```

- **Kết quả:** Passed

### 1.2.20. TC-20: Propose & Execute

- **Tính năng:** Configuration
- **Bối cảnh:** Master thay đổi dispute window.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** dispute window được cập nhật sau timelock 1 ngày.
- **Các bước kiểm thử:**
  1. Alice propose 2h.
  2. Bỏ qua 1 ngày.
  3. Gọi hàm `executeConfig`.
  4. Xác minh window là 2h.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_ProposeConfigAndExecute() (gas: 215047)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.26ms (230.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.21. TC-21: Veto No Proposal

- **Tính năng:** Configuration
- **Bối cảnh:** Bob cố gắng veto khi không có gì.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "No config proposal pending".
- **Các bước kiểm thử:**
  1. Gọi hàm `vetoConfig`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_VetoConfig_NoProposal() (gas: 199706)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 3.58ms (999.70µs CPU time)
```

- **Kết quả:** Passed

### 1.2.22. TC-22: Veto Success

- **Tính năng:** Configuration
- **Bối cảnh:** Alice propose, Bob veto.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** proposal bị hủy bỏ.
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Bob gọi hàm `vetoConfig`.
  3. Xác minh `isConfigPending` là false.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_VetoConfig_Success() (gas: 214614)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.13ms (194.80µs CPU time)
```

- **Kết quả:** Passed

### 1.2.23. TC-23: Execute No Proposal

- **Tính năng:** Configuration
- **Bối cảnh:** execute mà không có config đang chờ.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "No config proposal pending".
- **Các bước kiểm thử:**
  1. Gọi hàm `executeConfig`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_ExecuteConfig_NoProposal() (gas: 198439)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.67ms (312.60µs CPU time)
```

- **Kết quả:** Passed

### 1.2.24. TC-24: Execute Before Time

- **Tính năng:** Configuration
- **Bối cảnh:** execute trong thời gian timelock.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Timelock not met".
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Bỏ qua 23h.
  3. Gọi hàm `executeConfig`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_ExecuteConfig_BeforeTimelock() (gas: 266181)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.39ms (271.80µs CPU time)
```

- **Kết quả:** Passed

### 1.2.25. TC-25: Propose Root

- **Tính năng:** Merkle Root
- **Bối cảnh:** Bob propose một root.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** `pendingRoot` được lưu trữ. Proposer được thiết lập. Timestamp được thiết lập.
- **Các bước kiểm thử:**
  1. Bob gọi hàm `proposeRoot`.
  2. Xác minh `pendingRoot` và `pendingRootProposer`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_ProposeRoot_Success() (gas: 268470)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.04ms (164.60µs CPU time)
```

- **Kết quả:** Passed

### 1.2.26. TC-26: Auto-confirm Root

- **Tính năng:** Merkle Root
- **Bối cảnh:** Các proposal được chuỗi sau khi hết hạn.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** root của Bob được confirmed; root của Alice là pending.
- **Các bước kiểm thử:**
  1. Bob propose Root 1.
  2. Bỏ qua 1h + 1s.
  3. Alice propose Root 2.
  4. Xác minh `confirmedRoot == Root 1`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_ProposeRoot_AutoConfirmsPrevious() (gas: 298745)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.01ms (210.60µs CPU time)
```

- **Kết quả:** Passed

### 1.2.27. TC-27: Confirm Root

- **Tính năng:** Merkle Root
- **Bối cảnh:** confirm thủ công sau khi hết hạn.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** root chuyển sang `confirmedRoot`.
- **Các bước kiểm thử:**
  1. Bob propose.
  2. Bỏ qua window.
  3. Alice gọi hàm `confirmRoot`.
  4. Xác minh `confirmedRoot`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_ConfirmRoot_Success() (gas: 236416)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.06ms (234.80µs CPU time)
```

- **Kết quả:** Passed

### 1.2.28. TC-28: Confirm No Root

- **Tính năng:** Merkle Root
- **Bối cảnh:** confirm mà không có proposal.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "No pending root".
- **Các bước kiểm thử:**
  1. Gọi hàm `confirmRoot`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_ConfirmRoot_NoPendingRoot() (gas: 199722)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.68ms (374.20µs CPU time)
```

- **Kết quả:** Passed

### 1.2.29. TC-29: Confirm Window Act

- **Tính năng:** Merkle Root
- **Bối cảnh:** confirm trong khi window đang hoạt động.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Dispute window still active".
- **Các bước kiểm thử:**
  1. Bob propose.
  2. Alice gọi hàm `confirmRoot`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_ConfirmRoot_WindowActive() (gas: 266656)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.33ms (257.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.30. TC-30: Dispute Success

- **Tính năng:** Merkle Root
- **Bối cảnh:** Bob dispute root của Alice trong window.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** `pendingRoot` được reset về không.
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Bob gọi hàm `disputeRoot`.
  3. Xác minh `pendingRoot == 0`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_DisputeRoot_Success() (gas: 215919)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.47ms (320.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.31. TC-31: Dispute No Root

- **Tính năng:** Merkle Root
- **Bối cảnh:** dispute mà không có proposal.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "No pending root to dispute".
- **Các bước kiểm thử:**
  1. Gọi hàm `disputeRoot`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_DisputeRoot_NoPendingRoot() (gas: 199721)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.60ms (313.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.32. TC-32: Dispute Window Clo

- **Tính năng:** Merkle Root
- **Bối cảnh:** dispute muộn.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Dispute window has already closed".
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Bỏ qua 1h.
  3. Bob gọi hàm `disputeRoot`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_DisputeRoot_WindowClosed() (gas: 268266)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 3.10ms (702.10µs CPU time)
```

- **Kết quả:** Passed

### 1.2.33. TC-33: Dispute Own Root

- **Tính năng:** Merkle Root
- **Bối cảnh:** Proposer cố gắng tự hủy bỏ thông qua dispute.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "Proposer cannot dispute their own root".
- **Các bước kiểm thử:**
  1. Alice propose.
  2. Alice gọi hàm `disputeRoot`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_DisputeRoot_OwnRoot() (gas: 265925)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.93ms (605.20µs CPU time)
```

- **Kết quả:** Passed

### 1.2.34. TC-34: Verify Proof Success

- **Tính năng:** Forensic Verify
- **Bối cảnh:** Kiểm tra leaf trong confirmedRoot.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Trả về true.
- **Các bước kiểm thử:**
  1. confirm một root (ví dụ: leaf là root).
  2. Gọi hàm `verifyProof` với leaf tương ứng.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_VerifyProof_Success() (gas: 233665)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.85ms (432.40µs CPU time)
```

- **Kết quả:** Passed

### 1.2.35. TC-35: Verify Proof False

- **Tính năng:** Forensic Verify
- **Bối cảnh:** leaf không hợp lệ.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Trả về false.
- **Các bước kiểm thử:**
  1. confirm một root.
  2. Gọi hàm `verifyProof` với leaf không chính xác.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] test_VerifyProof_False() (gas: 233760)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.19ms (214.50µs CPU time)
```

- **Kết quả:** Passed

### 1.2.36. TC-36: Verify No Root

- **Tính năng:** Forensic Verify
- **Bối cảnh:** Gọi verify trước khi bất kỳ root nào được confirmation.
- **Dữ liệu đầu vào:** None
- **Kết quả mong đợi:** Revert với lỗi "No confirmed root for this room".
- **Các bước kiểm thử:**
  1. Tạo room.
  2. Gọi hàm `verifyProof`.
- **Kết quả thực tế:**

```bash
Ran 1 test for test/ForensisChat.t.sol:ForensisChatTest
[PASS] testRevert_VerifyProof_NoConfirmedRoot() (gas: 199239)
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.11ms (317.40µs CPU time)
```

- **Kết quả:** Passed
