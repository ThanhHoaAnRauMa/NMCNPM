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
