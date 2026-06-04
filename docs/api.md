# API

## Overview

The current backend exposes a minimal Express API plus basic Socket.IO room events. There is no OpenAPI/Swagger document in the repository.

Base URL in local development:

```text
http://localhost:3000
```

## Authentication

Authentication is Not Implemented.

Current routes do not require JWT or session credentials. This is a security gap for routes that write or search `MessageSearch` snippets.

## HTTP Endpoints

### `GET /healthz`

Returns backend health and environment.

Response `200`:

```json
{
  "ok": true,
  "env": "development"
}
```

### `POST /messages/search`

Searches the temporary `MessageSearch` collection with MongoDB text search.

Request body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `keyword` | String | Yes | Trimmed; max 200 chars |
| `dateFrom` | Date string | No | Filters `createdAt >= dateFrom` |
| `dateTo` | Date string | No | Filters `createdAt <= dateTo` |
| `senderId` | ObjectId string | No | Sender filter |
| `conversationId` | ObjectId string | No | Conversation filter |
| `limit` | Number | No | Defaults to 20; max 100 |

Response `200`:

```json
{
  "results": [
    {
      "_id": "ObjectId",
      "messageId": "ObjectId",
      "conversationId": "ObjectId",
      "senderId": "ObjectId",
      "snippet": "searchable text",
      "score": 1.5,
      "createdAt": "2026-06-04T00:00:00.000Z",
      "highlightedSnippet": "<em>searchable</em> text"
    }
  ]
}
```

Errors:

| Status | Condition |
| --- | --- |
| `400` | Missing/empty `keyword` |
| `400` | `keyword` over 200 chars |
| `400` | Invalid ObjectId filter |
| `400` | Invalid date |
| `400` | `dateFrom` after `dateTo` |
| `500` | Unexpected server error |

### `POST /messages/index-snippet`

Upserts one temporary search snippet for a message.

Request body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `messageId` | ObjectId string | Yes | Unique per snippet |
| `conversationId` | ObjectId string | Yes | Conversation reference |
| `senderId` | ObjectId string | Yes | Sender reference |
| `snippet` | String | Yes | Trimmed; max 2000 chars |

Response `201`:

```json
{
  "id": "ObjectId"
}
```

Errors:

| Status | Condition |
| --- | --- |
| `400` | Missing required field |
| `400` | Invalid ObjectId |
| `400` | `snippet` over 2000 chars |
| `500` | Unexpected server error |

Security note: This endpoint accepts opt-in plaintext snippets. Authorization is Not Implemented and must be added before production use.

## Socket.IO Events

| Event | Payload | Direction | Status |
| --- | --- | --- | --- |
| `join` | `{ "conversationId": "..." }` | client -> server | Implemented |
| `leave` | `{ "conversationId": "..." }` | client -> server | Implemented |
| encrypted message send | Not Found | client -> server | Not Implemented |
| delivered/seen status | Not Found | both | Not Implemented |

## Planned But Not Implemented APIs

| API Area | Expected Route Examples | Current Status |
| --- | --- | --- |
| Auth | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh` | Not Implemented |
| User public key | `/users/pubkey`, `/users/:id/pubkey` | Not Implemented |
| KYC | `/kyc/submit` | Not Implemented |
| Files | `/files/upload` | Not Implemented |
| AI | `/ai/summarize`, moderation route | Not Implemented |
| Blockchain | `/merkle/commit`, `/merkle/verify/:conversationId/:leafIndex`, `/merkle/dispute` | Not Implemented |
| Forensics | `/forensics/:conversationId` | Not Implemented |
