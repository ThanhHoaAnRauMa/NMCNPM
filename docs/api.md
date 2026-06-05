# API

## Overview

The current backend exposes a minimal Express API plus basic Socket.IO room events. There is no OpenAPI/Swagger document in the repository.

Base URL in local development:

```text
http://localhost:3000
```

## Authentication

Authentication is Not Implemented.

Current routes do not require JWT or session credentials. This is a security gap for routes that write or search `MessageSearch` snippets and AI routes that receive opt-in plaintext.

## HTTP Endpoints

### `GET /health`

Production health endpoint used by deployment health checks.

Response `200`:

```json
{
  "status": "ok",
  "uptime": 12.345,
  "timestamp": "2026-06-05T00:00:00.000Z"
}
```

### `GET /healthz`

Returns backend health and environment.

Response `200`:

```json
{
  "ok": true,
  "env": "development"
}
```

This endpoint remains for backward compatibility.

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

### `POST /ai/summarize`

Summarizes client-supplied plaintext that was decrypted locally by the client. The backend verifies that each `messageId` exists in the requested conversation, calls Gemini, and caches the returned summary for 1 hour.

The `Message` collection remains ciphertext-only. Plaintext from this request is not persisted.

Request body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `conversationId` | ObjectId string | Yes | Conversation containing the messages |
| `messageIds` | ObjectId string[] | No | If omitted, derived from `messages[].messageId`; order controls summary order |
| `messages` | Object[] | Yes | Opt-in plaintext payload from the client |
| `messages[].messageId` | ObjectId string | Yes | Must belong to `conversationId` |
| `messages[].text` | String | Yes | Decrypted plaintext; max 4000 chars per message |
| `messages[].senderId` | ObjectId string | No | Client hint only; DB metadata wins when present |
| `messages[].timestamp` | Date string | No | Client hint only; DB metadata wins when present |

Response `200`:

```json
{
  "summary": "Short conversation summary",
  "cached": false,
  "model": "gemini-2.5-flash",
  "expiresAt": "2026-06-04T01:00:00.000Z",
  "messageCount": 3
}
```

Errors:

| Status | Condition |
| --- | --- |
| `400` | Invalid ObjectId, missing plaintext messages, too many messages, or text too large |
| `404` | One or more messages are not found in the conversation |
| `503` | Gemini API key is missing or Gemini is unavailable |

### `POST /ai/moderate`

Moderates one plaintext message before the client encrypts and sends it. Gemini has a maximum moderation timeout of 2 seconds. If Gemini is unavailable or times out, the backend allows the message and marks moderation as unavailable.

Request body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `text` | String | Yes | Plaintext message; max 4000 chars |

Allowed response `200`:

```json
{
  "moderation": {
    "is_moderated": true,
    "allowed": true,
    "harmful": false,
    "categories": [],
    "warning": ""
  }
}
```

Blocked response `422`:

```json
{
  "error": "message_blocked",
  "moderation": {
    "is_moderated": true,
    "allowed": false,
    "harmful": true,
    "categories": ["harassment"],
    "warning": "Message blocked by AI moderation."
  }
}
```

Fallback response `200`:

```json
{
  "moderation": {
    "is_moderated": false,
    "allowed": true,
    "harmful": false,
    "categories": [],
    "warning": "",
    "error": "moderation_unavailable"
  }
}
```

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
| AI forensic analysis | Future endpoints beyond summarize/moderate | Not Implemented |
| Blockchain | `/merkle/commit`, `/merkle/verify/:conversationId/:leafIndex`, `/merkle/dispute` | Not Implemented |
| Forensics | `/forensics/:conversationId` | Not Implemented |
