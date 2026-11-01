# Cutflux Backend (Cloud Run Replica)

A complete, faithful reverse-engineered replica of the backend powering **[Cutflux](https://cutflux.app/mobile.html)** (`video-edit-portal`, Build 98), extracted using the **REA (Reverse Engineer Anything)** methodology.

---

## 1. REA Architecture & Empirical Findings

Cutflux splits its architecture between high-performance client-side rendering (Web Audio API, Canvas 2D/WebGL color filters, FFmpeg WASM) and a central **Google Cloud Run** service running behind **Firebase Hosting** (`/api/**` rewrites).

### Key Architecture Details
- **Hosting / CDN**: Firebase Hosting (`videoediting-app.web.app`) + Google Frontend CDN.
- **Backend Service**: Google Cloud Run (`https://video-edit-portal-tkg6revema-uc.a.run.app`).
- **Build Version**: `renderApiBuild: 98` (reported live via `/api/health`).
- **Database & Auth**: Firebase Auth (ID Tokens) + Firestore + Cloud Storage.
- **Third-Party Integrations**:
  - **Stripe**: Subscriptions (`monthly`, `yearly`, `lifetime`) & Billing Portal.
  - **RevenueCat**: Native iOS / Android in-app subscription entitlement synchronization.
  - **Pexels**: Stock footage catalog proxy & parallel batch querying.
  - **AssemblyAI**: Audio lyric and speech transcription for word-timed dynamic captions.
  - **FFmpeg / yt-dlp**: Server-side video rendering, subtitle baking, and YouTube streaming.

---

## 2. API Endpoint Specifications

All endpoints support CORS (`*`) with headers `Authorization`, `Content-Type`, `X-Requested-With`, `Accept`, `Origin`, `Priority`.

### Health & Diagnostics
- `GET /api/health`
  - Returns complete subsystem health and build status (`renderApiBuild: 98`, `ffmpeg: true`, `renderAsync: true`, etc.).

### Mobile Hub & Templates
- `GET /api/templates/list`
  - Returns catalog of beat-synced video templates, clip boundary arrays (`start`, `end`, `duration`), and media URLs.

### Account & Native App Shell
- `POST /api/account/delete`
  - Requires: `Authorization: Bearer <token>`
  - Deletes user records and files. Returns `401 {"ok": false, "error": "missing_bearer_token"}` if omitted.
- `POST /api/mobile/send-desktop-link`
  - Requires: `Authorization: Bearer <token>`
  - Body: `{"email": "...", "link": "..."}`
  - Dispatches desktop handoff magic link.
- `POST /api/account/sync-native-premium`
  - Requires: `Authorization: Bearer <token>`
  - Body: `{"premium": boolean, "rcAppUserId": "..."}`
  - Verifies RevenueCat entitlement and updates user premium claims. Returns `401 {"ok": false, "error": "auth_required"}` if unauthenticated.

### Monetization & Promo Vouchers
- `POST /api/stripe/check-premium`
  - Requires: `Authorization: Bearer <token>`
  - Returns `{ "ok": true, "premium": boolean, "status": "active"|"none"|"past_due" }`.
- `POST /api/stripe/create-checkout`
  - Requires: `Authorization: Bearer <token>`
  - Body: `{"plan": "monthly"|"yearly"|"lifetime"}`
  - Returns `{ "ok": true, "url": "https://checkout.stripe.com/..." }`.
- `POST /api/promo/redeem`
  - Requires: `Authorization: Bearer <token>`
  - Body: `{"code": "CF-XXXX-XXXX"}`
  - Validates promo code pattern. Error codes: `bad_code_format`, `code_not_found`, `code_revoked`, `code_expired`, `code_used_up`, `auth_required`.

### Stock Video Engine
- `GET /api/stock/videos/search?query=...&per_page=...&orientation=...&prefer_height=...`
  - Proxies to Pexels Video Search API (or local catalog fallback).
- `POST /api/stock/videos/search-batch`
  - Aggregates multi-query parallel video searches.

### YouTube Ingestion
- `GET /api/youtube/video-fetch?id=VIDEO_ID`
  - Streams muxed MP4 with header `x-cutflux-title: <sanitized_title>`.
  - Missing/invalid ID: `400 {"ok": false, "error": "missing_or_invalid_id", "renderApiBuild": 98}`.
- `GET /api/youtube/audio-fetch`
  - Returns `410 {"ok": false, "error": "youtube_import_removed"}`.
- `GET /api/youtube/meta?id=VIDEO_ID` & `GET /api/youtube/resolve?id=VIDEO_ID`

### Captions & Cloud Video Rendering
- `POST /api/captions/transcribe`
  - Word-level timestamp alignment powered by AssemblyAI / Whisper.
- `POST /api/render/start` & `POST /api/render/url-start`
  - Asynchronous montage render jobs. Returns `{ "ok": true, "jobId": "..." }`.
- `GET /api/render/result/:jobId`
  - Polling endpoint. Returns `202 Accepted` while rendering; streams MP4 on completion.

### Admin & Support
- `POST /api/support/contact`
  - Body: `{"name": "...", "email": "...", "subject": "...", "message": "...", "website": "..."}`
  - Includes bot honeypot detection (`website`), email validation, and rate limiting.
- `POST /api/analytics/client-event`
  - Telemetry funnel metrics.
- `POST /api/analytics/unlock`
  - Body: `{"pin": "..."}`
  - Verifies `VEP_ADMIN_UNLOCK_PIN` and returns admin session token.

---

## 3. Running & Testing

### Local Start
```bash
# Using Node.js
node server.js

# Or using Bun
bun server.js
```

### Running Test Suite
```bash
npm test
# or
node --test tests/api.test.js
```
All 12 automated integration tests pass with 0 dependencies outside standard Node.js / Express.

### Deploying to Google Cloud Run
```bash
gcloud run deploy video-edit-portal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```
