# Data Specification

## I. Server-Side

### 1. `users`

Lưu trữ thông tin người dùng, định danh và các thiết lập tài khoản cá nhân.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-------------------------|---------------------|--------------------------|----------------------|
| `_id` | ObjectId | PK, Unique, Auto | Khóa chính, mã định danh duy nhất của người dùng. |
| `username` | String | Unique, Required | Tên đăng nhập hiển thị của người dùng. |
| `email` | String | Unique, Sparse | Địa chỉ email (tùy chọn, phục vụ khôi phục tài khoản). |
| `phone` | String | Sparse | Số điện thoại (tùy chọn). |
| `passwordHash` | String | Required | Mã băm của mật khẩu người dùng. |
| `web3Wallet` | String | Unique, Sparse | Địa chỉ ví Web3 (Metamask, v.v) dùng để đăng nhập. |
| `publicKey` | String | Required | Khóa công khai (X25519/Ed25519) dùng để mã hóa và kiểm tra chữ ký. |
| `isKycVerified` | Boolean | Default: `false` | Cờ đánh dấu tài khoản đã xác minh danh tính thành công (KYC). |
| `privacyMode` | Boolean | Default: `false` | Cờ bật/tắt chế độ riêng tư (tin nhắn không lưu trên server, chỉ chuyển tiếp). |
| `kycRecordId` | ObjectId | FK (kyc_records) | Liên kết tới hồ sơ xác thực danh tính tương ứng. |
| `profile` | Object | | Chứa thông tin cấu hình hiển thị: Avatar, DisplayName, Status, ShowEmail, ShowPhone. |

### 2. `conversations`

Lưu trữ cấu trúc thông tin các cuộc hội thoại.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-------------------------|---------------------|--------------------------|----------------------|
| `_id` | ObjectId | PK, Unique, Auto | Khóa chính của phòng chat. |
| `type` | String | Enum: `['DIRECT', 'GROUP']` | Xác định loại hội thoại (chat 1-1 hoặc nhóm). |
| `name` | String | Required (nếu GROUP) | Tên của nhóm chat. |
| `avatar` | String | Optional | Đường dẫn URL tới ảnh đại diện của nhóm. |
| `participants` | Array | Required | Mảng danh sách các thành viên trong nhóm. |
| `participants[].userId` | ObjectId | FK (users) | Mã định danh của thành viên tham gia. |
| `participants[].role` | String | Enum: `['ADMIN', 'MEMBER']`| Phân quyền thành viên trong hội thoại nhóm. |
| `createdAt` | Date | Auto | Dấu thời gian tạo phòng chat. |
| `updatedAt` | Date | Auto | Dấu thời gian có hoạt động/tin nhắn mới nhất. |

### 3. `merkle_commits`

Lưu trữ các dữ liệu trên chứng thực trên blockchain để làm bằng chứng minh bạch cho các tranh chấp pháp lý sau này.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-------------------------|---------------------|--------------------------|----------------------|
| `_id` | ObjectId | PK, Unique, Auto | Khóa chính của bản ghi commit. |
| `conversationId` | ObjectId | FK (conversations) | Hội thoại được commit. |
| `committerId` | ObjectId | FK (users) | ID của người dùng khởi xướng thao tác commit này. |
| `rootHash` | String | Required | Giá trị Merkle Root ($R_N$) tính toán từ danh sách tin nhắn nội bộ. |
| `startMessageId` | ObjectId | FK (messages) | ID của tin nhắn đầu tiên trong chuỗi được commit đợt này. |
| `endMessageId` | ObjectId | FK (messages) | ID của tin nhắn cuối cùng trong chuỗi được commit đợt này. |
| `txHash` | String | Required | Mã băm giao dịch (Transaction Hash) lưu trên mạng Sepolia Testnet. |
| `onChainStatus` | String | Enum: `['PENDING', 'CONFIRMED', 'DISPUTED']` | Trạng thái hiện tại của root trên blockchain. |
| `createdAt` | Date | Auto | Thời gian thực hiện commit. |

## II. Client-Side Data Specification

### 1. `KeyStore`

Bảng lưu trữ cục bộ các cặp khóa mật mã của riêng người dùng để thực hiện việc mã hóa, giải mã và ký số.
| Thuộc tính (Attribute) | Kiểu dữ liệu (Type) | Ràng buộc (Constraints) | Mô tả (Description) |
|-------------------------|---------------------|--------------------------|----------------------|
| `userId` | String | PK, Unique | Mã định danh của người dùng sở hữu bộ khóa. |
| `privateKey` | String | Required | Khóa bí mật (Ed25519/X25519). _Bắt buộc phải mã hóa tại ổ cứng cục bộ (Encrypted at rest)._ |
| `publicKey` | String | Required | Khóa công khai tương ứng. |
| `ephemeralKey`| String | Optional | Cặp khóa dùng một lần (dùng tạm thời trong chế độ Privacy Mode). |

### 2. `messages`

Lưu trữ các đoạn tin nhắn giao tiếp giữa người dùng để có thể xuất thành proof cung cấp cho bên thứ ba.

| Thuộc tính         | Kiểu dữ liệu | Ràng buộc                             | Mô tả                                                           |
| ------------------ | ------------ | ------------------------------------- | --------------------------------------------------------------- |
| `_id`              | ObjectId     | PK, Unique, Auto                      | Khóa chính duy nhất của một tin nhắn.                           |
| `conversationId`   | ObjectId     | FK (conversations)                    | Liên kết tới phòng chat chứa tin nhắn này.                      |
| `senderId`         | ObjectId     | FK (users)                            | Liên kết tới người thực hiện gửi tin nhắn.                      |
| `encryptedContent` | String       | Required                              | Nội dung tin nhắn đã được mã hóa end-to-end tại máy client.     |
| `metadata`         | Object       | Required                              | Siêu dữ liệu đính kèm (loại tin nhắn, reply-to,...).            |
| `signature`        | String       | Required                              | Chữ ký số điện tử của `senderId` xác thực trên nội dung bản rõ. |
| `status`           | String       | Enum: `['SENT', 'DELIVERED', 'READ']` | Trạng thái giao vận của tin nhắn.                               |
| `timestamp`        | Date         | Required                              | Dấu thời gian gửi tin nhắn.                                     |
| `attachments`      | Array        | Optional                              | Mảng chứa thông tin file đính kèm (`fileUrl`, `fileType`).      |
