#### Stakeholders

*   **Written by**: Nguyễn Ngọc Tuân
*   **Edited by**: 
*   **Reviewed by**:

Dựa trên đặc tả hệ thống chat bảo mật có khả năng forensics, dưới đây là các bên liên quan (Stakeholders) chính của phần mềm:

| **STT** | **Stakeholder** | **Description** |
| --- | --- | --- |
| 1 | Người dùng cuối (End User / Client) | Bao gồm người dùng ưu tiên quyền riêng tư (đăng ký bằng ví Web3/ẩn danh) và người dùng định danh. Họ sử dụng hệ thống để nhắn tin 1-1, gọi điện, tạo nhóm, quản lý danh tính và sử dụng các tính năng forensics (ký số tin nhắn, gửi dispute, xuất bằng chứng) để bảo vệ quyền lợi cá nhân hoặc công việc [2, 4, 5]. |
| 2 | Bên thứ ba kiểm chứng (Third-party Verifier) | Bao gồm luật sư, tòa án, trọng tài phân xử hoặc các cơ quan chức năng. Đây là những người tiếp nhận gói dữ liệu trích xuất (bao gồm transcript, chữ ký số và Merkle proof) từ người dùng cuối để kiểm chứng độc lập tính toàn vẹn và sự tồn tại của cuộc hội thoại khi xảy ra tranh chấp pháp lý [2, 6]. |
| 3 | Quản trị viên hệ thống (System Admin) | Những người chịu trách nhiệm vận hành, duy trì Application Server và Database Server. Họ quản lý luồng định tuyến tin nhắn, kết nối mạng và xử lý các báo cáo lạm dụng (abuse report). Admin hoàn toàn không có quyền truy cập vào nội dung tin nhắn dạng plaintext do hệ thống sử dụng cơ chế mã hóa đầu cuối (E2E) [5, 7]. |
| 4 | Nhà cung cấp hạ tầng Blockchain (Blockchain Node Provider) | Cung cấp dịch vụ API node (ví dụ: Sepolia, Polygon Amoy) để hệ thống trung gian gửi transaction và tương tác với smart contract nhằm chốt Merkle root (commit on-chain) [6, 8, 9]. |

--------------------------------------------------------------------------------