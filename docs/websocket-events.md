# WebSocket Events — SecureChat

## Kết nối

```javascript
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL, {
  auth: { token: accessToken },
});
```

---

## Events CLIENT → SERVER (client gửi lên)

| Event                  | Payload                                                                     | Mô tả                                   |
| ---------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| `user_online`          | `{ userId }`                                                                | Gửi sau khi đăng nhập để đăng ký socket |
| `join_conversation`    | `{ conversationId }`                                                        | Vào room khi mở cuộc hội thoại          |
| `leave_conversation`   | `{ conversationId }`                                                        | Rời room khi đóng                       |
| `send_message`         | `{ conversationId, encryptedContent, signature, msgType, replyTo, tempId }` | Gửi tin nhắn thường (KYC mode)          |
| `send_private_message` | `{ conversationId, encryptedContent, signature, tempId }`                   | Gửi tin nhắn Privacy Mode               |
| `ack_private_message`  | `{ tempId }`                                                                | Xác nhận đã nhận tin nhắn Privacy Mode  |
| `mark_seen`            | `{ messageId, conversationId }`                                             | Đánh dấu đã đọc                         |
| `typing`               | `{ conversationId }`                                                        | Đang gõ chữ                             |
| `stop_typing`          | `{ conversationId }`                                                        | Dừng gõ                                 |

---

## Events SERVER → CLIENT (server gửi xuống)

| Event                  | Payload                                                                                                       | Mô tả                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `new_message`          | `{ _id, conversationId, senderId, encryptedContent, signature, msgType, status, replyTo, createdAt, tempId }` | Tin nhắn mới trong room                 |
| `new_private_message`  | `{ tempId, conversationId, senderId, encryptedContent, signature, createdAt }`                                | Tin nhắn Privacy Mode                   |
| `private_message_sent` | `{ tempId }`                                                                                                  | Confirm đã relay tin nhắn Privacy Mode  |
| `message_status`       | `{ messageId, status, seenBy? }`                                                                              | Cập nhật trạng thái SENT/DELIVERED/SEEN |
| `message_error`        | `{ tempId?, error }`                                                                                          | Lỗi khi gửi tin nhắn                    |
| `user_typing`          | `{ userId, conversationId }`                                                                                  | Người kia đang gõ                       |
| `user_stop_typing`     | `{ userId, conversationId }`                                                                                  | Người kia dừng gõ                       |
| `user_status`          | `{ userId, isOnline, lastSeen? }`                                                                             | Trạng thái online/offline của user khác |

---

## Luồng gửi tin nhắn thường (KYC Mode)

---

## Cập nhật tuần 4 — SCRUM-130: Error codes và Offline handling

### Event server → client: `socket_error`

Khi có lỗi trong bất kỳ event nào, server emit `socket_error` với format thống nhất:

```javascript
socket.on("socket_error", ({ event, code, message, ...extra }) => {
  console.error(`[Socket Error] ${event}: ${code} — ${message}`);
  switch (code) {
    case "NOT_AUTHENTICATED":
    case "TOKEN_EXPIRED":
      redirectToLogin();
      break;
    case "ACCOUNT_LOCKED":
      showLockMessage(extra.remainingMin);
      break;
    case "NOT_A_MEMBER":
    case "CONVERSATION_NOT_FOUND":
      showErrorToast(message);
      break;
    case "USE_PRIVATE_EVENT":
      usePrivateMessageEvent();
      break;
    default:
      showErrorToast(message);
  }
});
```

### Tất cả error codes

| Code                      | HTTP tương đương | Ý nghĩa                           |
| ------------------------- | ---------------- | --------------------------------- |
| `MISSING_REQUIRED_FIELDS` | 400              | Thiếu field bắt buộc              |
| `NOT_AUTHENTICATED`       | 401              | Chưa emit user_online             |
| `NOT_A_MEMBER`            | 403              | Không có quyền trong conversation |
| `CONVERSATION_NOT_FOUND`  | 404              | Conversation không tồn tại        |
| `USE_PRIVATE_EVENT`       | 422              | Dùng sai event cho Privacy Mode   |
| `SERVER_ERROR`            | 500              | Lỗi server không xác định         |
| `BLOCKED_BY_RECEIVER`     | 403              | Người nhận đã block bạn           |

### Event: `get_missed_messages` (reconnect)

```javascript
socket.on("connect", () => {
  const lastMessageTime = localStorage.getItem("lastMessageTime");
  if (lastMessageTime) {
    socket.emit("get_missed_messages", {
      conversationId: currentConvId,
      since: lastMessageTime,
    });
  }
});

socket.on("missed_messages", ({ conversationId, messages, count }) => {
  mergeMessages(messages);
});
```

---

## REST API — Danh sách Conversation (Sidebar màn hình chính)

### GET /conversations/all

Trả về TẤT CẢ conversation (DIRECT + GROUP) của user hiện tại, sort theo `updatedAt` mới nhất.

**Header:** `Authorization: Bearer <accessToken>`

**Response:**

```json
{
  "success": true,
  "count": 2,
  "conversations": [
    {
      "conversationId": "string",
      "type": "DIRECT | GROUP",
      "mode": "KYC | PRIVACY",
      "name": "string",
      "avatarUrl": "string | null",
      "isOnline": "boolean (chỉ DIRECT)",
      "lastSeen": "ISO date | null (chỉ DIRECT)",
      "kycStatus": "string (chỉ DIRECT)",
      "otherUserId": "string (chỉ DIRECT)",
      "memberCount": "number (chỉ GROUP)",
      "lastMessage": {
        "preview": "string",
        "encryptedContent": "string",
        "senderId": "string",
        "senderName": "string",
        "msgType": "TEXT | FILE | SYSTEM",
        "status": "SENT | DELIVERED | SEEN",
        "createdAt": "ISO date"
      } | null,
      "updatedAt": "ISO date"
    }
  ]
}
```

**Cách dùng phía Frontend:**

- Gọi 1 lần khi load màn hình chính → render sidebar.
- Mỗi khi nhận `new_message` qua WebSocket → cập nhật `lastMessage` của conversation tương ứng trong state, và move conversation đó lên đầu danh sách (re-sort theo `updatedAt`).
- Click vào 1 conversation trong sidebar → emit `join_conversation` + gọi `GET /chat/:conversationId/messages` để load lịch sử.
