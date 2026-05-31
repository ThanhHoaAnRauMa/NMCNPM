#### 3. Architectural Design

##### 1.1 Architecture Diagram
*   **Written by**: Nguyễn Ngọc Tuân - 23120389
*   **Edited by**: Nguyễn Lê Gia Hòa - 23120129
*   **Reviewed by**: Nguyễn Lê Gia Hòa, Lưu Đức Toàn, Nguyễn Tấn Hùng, Võ Nhật Anh

**A. System Decomposition (Phân rã hệ thống)**
Hệ thống Secure Chat Forensics được thiết kế theo kiến trúc Client-Server kết hợp với nền tảng Blockchain (Web3) và tích hợp AI [1, 3]. Cụ thể hệ thống chia thành 5 phân hệ (Layers) chính:
1.  **Client Layer (Frontend)**: Giao diện người dùng đa nền tảng, chịu trách nhiệm xử lý UI/UX và thực thi mã hóa/giải mã (Crypto Module) ngay trên thiết bị người dùng. Lưu trữ log cục bộ (Forensic Log) bằng IndexedDB [3, 4].
2.  **Server Layer (Backend)**: Trung gian điều phối luồng dữ liệu. Bao gồm Auth Service, Chat Service (WebSocket real-time) và Blockchain REST API Layer [3, 5].
3.  **Database Layer**: Nơi lưu trữ siêu dữ liệu (metadata), thông tin người dùng, đoạn chat đã mã hóa và lịch sử chốt Merkle Root [2, 3].
4.  **Blockchain Layer**: Mạng lưới phi tập trung (Sepolia Testnet) chứa các Smart Contract (MerkleCommit, Dispute & Verification) để lưu trữ vĩnh viễn và kiểm chứng tính toàn vẹn của cuộc hội thoại [2, 3].
5.  **AI Layer**: Dịch vụ gọi qua API (Google Gemini) để hỗ trợ tóm tắt tin nhắn và kiểm duyệt nội dung (Content Moderation) [3, 4].

**B. Overall System Architecture Diagram (Sơ đồ kiến trúc tổng thể)**

```mermaid
graph TD
    subgraph ClientLayer [Client - React/Vite]
        UI[UI/UX Components]
        Crypto[Crypto Module: WebCrypto/noble-curves]
        LocalDB[(IndexedDB: Forensic Log)]
        UI <--> Crypto
        Crypto <--> LocalDB
    end

    subgraph ServerLayer [Backend - Node.js/Express/Socket.io]
        Auth[Auth Service / KYC]
        Chat[Chat Service: WebSocket]
        BlockchainAPI[Blockchain REST API]
        Security[Security Middleware: Helmet/XSS]
    end

    subgraph DatabaseLayer [MongoDB Atlas]
        DB[(User, Message, Conversation, MerkleCommit, KYCRecord)]
    end

    subgraph BlockchainLayer [Sepolia Testnet]
        SmartContract[MerkleCommit & Dispute Contracts]
    end

    subgraph AILayer [External Services]
        Gemini[Google Gemini API]
    end

    %% Connections
    ClientLayer <-->|HTTPS / WSS| ServerLayer
    ServerLayer <-->|Mongoose / TLS| DatabaseLayer
    ServerLayer <-->|ethers.js / RPC| BlockchainLayer
    ServerLayer <-->|REST API| AILayer