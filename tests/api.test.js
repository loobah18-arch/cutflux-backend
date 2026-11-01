const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server.js');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/health returns build 98 and full capability inventory', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.renderApiBuild, 98);
  assert.equal(data.ffmpeg, true);
  assert.equal(data.youtubeVideoFetch, true);
  assert.equal(data.captionsTranscribeConfigured, true);
});

test('GET /api/templates/list returns templates catalog with clip timings', async () => {
  const res = await fetch(`${baseUrl}/api/templates/list`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.templates));
  assert.ok(data.templates.length >= 1);
  assert.equal(data.templates[0].id, 'e025fef54d16bd4fd6a9');
  assert.ok(Array.isArray(data.templates[0].clips));
});

test('POST /api/account/delete validates bearer token presence', async () => {
  // Without token
  const res1 = await fetch(`${baseUrl}/api/account/delete`, { method: 'POST', body: '{}' });
  assert.equal(res1.status, 401);
  const err1 = await res1.json();
  assert.equal(err1.error, 'missing_bearer_token');

  // With token
  const res2 = await fetch(`${baseUrl}/api/account/delete`, {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-test-token', 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.ok, true);
});

test('POST /api/account/sync-native-premium validates auth_required error format', async () => {
  const res = await fetch(`${baseUrl}/api/account/sync-native-premium`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ premium: true, rcAppUserId: 'rc_123' })
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'auth_required');
});

test('POST /api/stripe/check-premium and checkout creation', async () => {
  // Check unauthenticated
  const res1 = await fetch(`${baseUrl}/api/stripe/check-premium`, { method: 'POST' });
  assert.equal(res1.status, 401);

  // Check authenticated
  const res2 = await fetch(`${baseUrl}/api/stripe/check-premium`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test-user-tok' }
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.ok, true);
  assert.equal(typeof data2.premium, 'boolean');

  // Create checkout
  const res3 = await fetch(`${baseUrl}/api/stripe/create-checkout`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test-user-tok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'lifetime' })
  });
  assert.equal(res3.status, 200);
  const data3 = await res3.json();
  assert.equal(data3.ok, true);
  assert.ok(data3.url.includes('checkout.stripe.com'));
});

test('POST /api/promo/redeem validates promo format and status', async () => {
  const headers = { Authorization: 'Bearer test-user-tok', 'Content-Type': 'application/json' };

  // Invalid format
  const res1 = await fetch(`${baseUrl}/api/promo/redeem`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'INVALID' })
  });
  assert.equal(res1.status, 400);
  assert.equal((await res1.json()).error, 'bad_code_format');

  // Not found
  const res2 = await fetch(`${baseUrl}/api/promo/redeem`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'CF-NONE-9999' })
  });
  assert.equal(res2.status, 404);
  assert.equal((await res2.json()).error, 'code_not_found');

  // Valid redemption
  const res3 = await fetch(`${baseUrl}/api/promo/redeem`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'CF-PREM-2026' })
  });
  assert.equal(res3.status, 200);
  assert.equal((await res3.json()).ok, true);

  // Now code_used_up
  const res4 = await fetch(`${baseUrl}/api/promo/redeem`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'CF-PREM-2026' })
  });
  assert.equal(res4.status, 400);
  assert.equal((await res4.json()).error, 'code_used_up');
});

test('POST /api/support/contact validates email and honeypot', async () => {
  // Invalid email
  const res1 = await fetch(`${baseUrl}/api/support/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bademail', message: 'Hello' })
  });
  assert.equal(res1.status, 400);
  assert.equal((await res1.json()).error, 'email_invalid');

  // Honeypot website field
  const res2 = await fetch(`${baseUrl}/api/support/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bot@example.com', message: 'Spam', website: 'http://spam.com' })
  });
  assert.equal(res2.status, 200);
  assert.equal((await res2.json()).ok, true);

  // Legitimate contact message
  const res3 = await fetch(`${baseUrl}/api/support/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', message: 'Need help with rendering' })
  });
  assert.equal(res3.status, 200);
  assert.equal((await res3.json()).ok, true);
});

test('POST /api/analytics/unlock verifies PIN', async () => {
  // Wrong PIN
  const res1 = await fetch(`${baseUrl}/api/analytics/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '0000' })
  });
  assert.equal(res1.status, 401);
  assert.equal((await res1.json()).error, 'unauthorized');

  // Correct PIN
  const res2 = await fetch(`${baseUrl}/api/analytics/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '8842' })
  });
  assert.equal(res2.status, 200);
  const data = await res2.json();
  assert.equal(data.ok, true);
  assert.ok(data.token);
});

test('GET /api/stock/videos/search returns video items matching Pexels schema', async () => {
  const res = await fetch(`${baseUrl}/api/stock/videos/search?query=cars&per_page=2`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.count, 2);
  assert.ok(data.videos[0].file.link);
});

test('GET /api/youtube/video-fetch and audio-fetch behaviors', async () => {
  // Invalid ID
  const res1 = await fetch(`${baseUrl}/api/youtube/video-fetch?id=short`);
  assert.equal(res1.status, 400);
  const data1 = await res1.json();
  assert.equal(data1.error, 'missing_or_invalid_id');
  assert.equal(data1.renderApiBuild, 98);

  // Valid 11-char ID
  const res2 = await fetch(`${baseUrl}/api/youtube/video-fetch?id=dQw4w9WgXcQ`);
  assert.equal(res2.status, 200);
  assert.equal(res2.headers.get('content-type'), 'video/mp4');
  assert.equal(res2.headers.get('x-cutflux-title'), 'youtube-dQw4w9WgXcQ');

  // Deprecated audio-fetch returns 410
  const res3 = await fetch(`${baseUrl}/api/youtube/audio-fetch?id=dQw4w9WgXcQ`);
  assert.equal(res3.status, 410);
  assert.equal((await res3.json()).error, 'youtube_import_removed');
});

test('POST /api/captions/transcribe returns word alignments', async () => {
  const res = await fetch(`${baseUrl}/api/captions/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captionAlignDurationSec: 30 })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.words));
  assert.ok(data.words.length > 0);
  assert.equal(typeof data.words[0].start, 'number');
  assert.equal(typeof data.words[0].end, 'number');
});

test('POST /api/render/url-start and polling /api/render/result/:jobId', async () => {
  const startRes = await fetch(`${baseUrl}/api/render/url-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution: '1080p', fps: 30 })
  });
  assert.equal(startRes.status, 200);
  const startData = await startRes.json();
  assert.equal(startData.ok, true);
  assert.ok(startData.jobId);

  // Poll result
  const pollRes = await fetch(`${baseUrl}/api/render/result/${startData.jobId}`);
  assert.equal(pollRes.status, 200);
  assert.equal(pollRes.headers.get('content-type'), 'video/mp4');
});
