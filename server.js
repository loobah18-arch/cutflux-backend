/**
 * Cutflux Cloud Run Backend & API Replica
 * Reverse-engineered via REA (Reverse Engineer Anything) skill methodology.
 *
 * Recreates the complete Cloud Run backend (build 98) behind https://cutflux.app/mobile.html
 * and https://video-edit-portal-tkg6revema-uc.a.run.app.
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const VEP_ADMIN_UNLOCK_PIN = process.env.VEP_ADMIN_UNLOCK_PIN || '8842';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// ─────────────────────────────────────────────────────────────────────────────
// Middleware & Headers
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin', 'Priority'],
  maxAge: 7200,
  exposedHeaders: ['x-cutflux-title', 'x-cloud-trace-context']
}));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Emulate Cloud Run trace header
  res.setHeader('x-cloud-trace-context', crypto.randomBytes(16).toString('hex') + ';o=1');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth Middleware: "missing_bearer_token" (used on /account/delete, /stripe/check-premium, etc.)
function requireBearerToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ ok: false, error: 'missing_bearer_token' });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ ok: false, error: 'missing_bearer_token' });
  }
  // Store authenticated token / user context
  req.user = { uid: 'usr_' + crypto.createHash('md5').update(token).digest('hex').slice(0, 16), token };
  next();
}

// Auth Middleware: "auth_required" (used on /promo/redeem, /account/sync-native-premium)
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ ok: false, error: 'auth_required' });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ ok: false, error: 'auth_required' });
  }
  req.user = { uid: 'usr_' + crypto.createHash('md5').update(token).digest('hex').slice(0, 16), token };
  next();
}

// In-Memory Storage for Demo & Standalone Runtime
const promoCodes = new Map([
  ['CF-PREM-2026', { status: 'active', plan: 'lifetime', usedBy: null, expiresAt: Date.now() + 86400000000 }],
  ['CF-TEST-EXPR', { status: 'expired', plan: 'monthly', usedBy: null, expiresAt: Date.now() - 1000 }],
  ['CF-TEST-USED', { status: 'active', plan: 'yearly', usedBy: 'other_user', expiresAt: Date.now() + 86400000000 }],
  ['CF-TEST-REVK', { status: 'revoked', plan: 'lifetime', usedBy: null, expiresAt: Date.now() + 86400000000 }]
]);

const userSubscriptions = new Map();
const renderJobs = new Map();
const supportMessages = [];
const contactRateLimits = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Health & Diagnostic Check
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    ffmpeg: true,
    renderApiBuild: 98,
    renderAsync: true,
    urlRender: true,
    remoteRender: true,
    musicSearch: true,
    youtubeResolve: true,
    youtubeMeta: true,
    youtubeVideoFetch: true,
    youtubeAudioFetch: true,
    youtubeAudioFetchMirrorFallback: true,
    ytDlp: true,
    captionsTranscribeConfigured: true,
    captionsBurnFontsReady: true,
    captionsEmojiFontReady: true,
    sceneAnalyzeConfigured: true,
    stripeCheckoutVerifyConfigured: true,
    analyticsPing: true,
    analyticsAdminConfigured: true,
    firebaseAdminConfigured: true
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Templates Catalog
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/templates/list', (req, res) => {
  res.json({
    ok: true,
    templates: [
      {
        id: 'e025fef54d16bd4fd6a9',
        name: 'Cars',
        theme: 'high_octane',
        videoUrl: 'https://storage.googleapis.com/videoediting-app.firebasestorage.app/templates/e025fef54d16bd4fd6a9/source.mp4',
        thumbnailUrl: 'https://storage.googleapis.com/videoediting-app.firebasestorage.app/templates/e025fef54d16bd4fd6a9/thumb.jpg',
        bytes: 38254024,
        clipCount: 4,
        clips: [
          { start: 0.0, end: 5.7459, duration: 5.7459 },
          { start: 5.7459, end: 7.6612, duration: 1.9153 },
          { start: 7.6612, end: 9.5766, duration: 1.9153 },
          { start: 9.5766, end: 11.4919, duration: 1.9153 }
        ],
        createdAt: 1782339825765
      },
      {
        id: 'f194e8a21bc34d87aa12',
        name: 'Anime Impact',
        theme: 'glitch_phonk',
        videoUrl: 'https://storage.googleapis.com/videoediting-app.firebasestorage.app/templates/f194e8a21bc34d87aa12/source.mp4',
        thumbnailUrl: 'https://storage.googleapis.com/videoediting-app.firebasestorage.app/templates/f194e8a21bc34d87aa12/thumb.jpg',
        bytes: 29402110,
        clipCount: 4,
        clips: [
          { start: 0.0, end: 3.250, duration: 3.250 },
          { start: 3.250, end: 5.500, duration: 2.250 },
          { start: 5.500, end: 7.750, duration: 2.250 },
          { start: 7.750, end: 10.000, duration: 2.250 }
        ],
        createdAt: 1782339900000
      }
    ]
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. User & Mobile Management
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/account/delete', requireBearerToken, (req, res) => {
  const uid = req.user.uid;
  userSubscriptions.delete(uid);
  res.json({ ok: true, deletedUid: uid });
});

app.post('/api/mobile/send-desktop-link', requireBearerToken, (req, res) => {
  const { email, link } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'email_invalid' });
  }
  // In production, dispatches via Resend API
  console.log(`[Email Dispatch] Desktop handoff link sent to ${email}: ${link}`);
  res.json({ ok: true });
});

app.post('/api/account/sync-native-premium', requireAuth, (req, res) => {
  const { premium, rcAppUserId } = req.body || {};
  const uid = req.user.uid;
  userSubscriptions.set(uid, {
    premium: !!premium,
    status: premium ? 'active' : 'none',
    rcAppUserId: String(rcAppUserId || '')
  });
  res.json({ ok: true, premium: !!premium });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Stripe & Promo Monetization
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/stripe/check-premium', requireBearerToken, (req, res) => {
  const uid = req.user.uid;
  const sub = userSubscriptions.get(uid) || { premium: false, status: 'none' };
  res.json({
    ok: true,
    premium: sub.premium,
    status: sub.status
  });
});

app.post('/api/stripe/create-checkout', requireBearerToken, (req, res) => {
  const { plan } = req.body || {};
  const validPlans = ['monthly', 'yearly', 'lifetime'];
  const selectedPlan = validPlans.includes(plan) ? plan : 'monthly';
  
  // Return Stripe Checkout URL (or configured billing link)
  const sessionUrl = `https://checkout.stripe.com/c/pay/cs_test_${crypto.randomBytes(12).toString('hex')}?plan=${selectedPlan}&uid=${encodeURIComponent(req.user.uid)}`;
  res.json({
    ok: true,
    url: sessionUrl
  });
});

app.post('/api/promo/redeem', requireAuth, (req, res) => {
  const { code } = req.body || {};
  const uid = req.user.uid;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ ok: false, error: 'bad_code_format' });
  }

  const cleanCode = code.trim().toUpperCase();
  // Expect format like CF-ABCD-1234
  if (!/^CF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanCode)) {
    return res.status(400).json({ ok: false, error: 'bad_code_format' });
  }

  const promo = promoCodes.get(cleanCode);
  if (!promo) {
    return res.status(404).json({ ok: false, error: 'code_not_found' });
  }
  if (promo.status === 'revoked') {
    return res.status(400).json({ ok: false, error: 'code_revoked' });
  }
  if (promo.expiresAt < Date.now()) {
    return res.status(400).json({ ok: false, error: 'code_expired' });
  }
  if (promo.usedBy) {
    return res.status(400).json({ ok: false, error: 'code_used_up' });
  }

  // Redeem code
  promo.usedBy = uid;
  userSubscriptions.set(uid, { premium: true, status: 'active', plan: promo.plan });

  res.json({ ok: true, plan: promo.plan });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Support & Analytics Telemetry
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/support/contact', (req, res) => {
  const { name, email, subject, message, website } = req.body || {};

  // Honeypot field for bot spam detection
  if (website) {
    return res.json({ ok: true });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
    return res.status(400).json({ ok: false, error: 'email_invalid' });
  }

  if (!message || String(message).trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'message_too_short' });
  }

  // Rate limiting per email (max 5 submissions per hour)
  const normEmail = String(email).trim().toLowerCase();
  const now = Date.now();
  const history = contactRateLimits.get(normEmail) || [];
  const recent = history.filter(ts => now - ts < 3600000);
  if (recent.length >= 5) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }
  recent.push(now);
  contactRateLimits.set(normEmail, recent);

  supportMessages.push({
    name: String(name || '').trim(),
    email: normEmail,
    subject: String(subject || 'General'),
    message: String(message).trim(),
    receivedAt: new Date().toISOString()
  });

  res.json({ ok: true });
});

app.post('/api/analytics/client-event', (req, res) => {
  // Ingest client activation and funnel metrics
  res.json({ ok: true });
});

app.post('/api/analytics/unlock', (req, res) => {
  const { pin } = req.body || {};
  if (!pin || String(pin).trim() !== VEP_ADMIN_UNLOCK_PIN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  res.json({ ok: true, token });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Stock Video Search (Pexels Proxy & Fallback)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/stock/videos/search', async (req, res) => {
  const query = String(req.query.query || 'car').trim();
  const perPage = Math.min(15, Math.max(1, parseInt(req.query.per_page, 10) || 12));
  const orientation = String(req.query.orientation || 'landscape');
  const preferHeight = parseInt(req.query.prefer_height, 10) || 720;

  if (PEXELS_API_KEY) {
    try {
      const pexelsRes = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${encodeURIComponent(orientation)}`,
        { headers: { Authorization: PEXELS_API_KEY } }
      );
      if (pexelsRes.ok) {
        const data = await pexelsRes.json();
        const formatted = (data.videos || []).map(v => {
          const file = (v.video_files || []).find(f => f.height >= preferHeight) || (v.video_files && v.video_files[0]) || {};
          return {
            id: v.id,
            dur: v.duration,
            width: v.width,
            height: v.height,
            image: v.image,
            query: query,
            aiTagged: false,
            file: { link: file.link || '', width: file.width || 1280, height: file.height || 720, quality: null }
          };
        });
        return res.json({ ok: true, query, count: formatted.length, videos: formatted });
      }
    } catch (_) {}
  }

  // Fallback catalog conforming to live response schema
  const mockVideos = [
    {
      id: 31220532,
      dur: 8,
      width: 3840,
      height: 2160,
      image: `https://images.pexels.com/videos/31220532/car-collection-cars-vintage-31220532.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200`,
      query: query,
      aiTagged: false,
      file: {
        link: 'https://videos.pexels.com/video-files/31220532/13335398_1280_720_24fps.mp4',
        width: 1280,
        height: 720,
        quality: null
      }
    },
    {
      id: 37505403,
      dur: 22,
      width: 1920,
      height: 1080,
      image: `https://images.pexels.com/videos/37505403/pexels-photo-37505403.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200`,
      query: query,
      aiTagged: false,
      file: {
        link: 'https://videos.pexels.com/video-files/37505403/15889688_1280_720_24fps.mp4',
        width: 1280,
        height: 720,
        quality: null
      }
    }
  ].slice(0, perPage);

  res.json({ ok: true, query, count: mockVideos.length, videos: mockVideos });
});

app.post('/api/stock/videos/search-batch', async (req, res) => {
  const { queries = [], per_page = 24, target_count = 2, max_pages = 1 } = req.body || {};
  const query = queries[0] || 'general';

  res.json({
    ok: true,
    count: Math.min(queries.length, target_count),
    targetCount: target_count,
    maxPages: max_pages,
    videos: [
      {
        id: 31220532,
        dur: 8,
        width: 3840,
        height: 2160,
        image: 'https://images.pexels.com/videos/31220532/car-collection-cars-vintage-31220532.jpeg',
        query: query,
        aiTagged: false,
        file: { link: 'https://videos.pexels.com/video-files/31220532/13335397_960_540_24fps.mp4', width: 960, height: 540, quality: null }
      }
    ]
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. YouTube Video Ingestion & Resolvers
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/youtube/video-fetch', (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ ok: false, error: 'missing_or_invalid_id', renderApiBuild: 98 });
  }

  // Stream sample video with x-cutflux-title header
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('x-cutflux-title', `youtube-${id}`);
  
  // Return lightweight binary container header or dummy stream
  const dummyBuffer = Buffer.alloc(1024);
  res.send(dummyBuffer);
});

app.get('/api/youtube/audio-fetch', (req, res) => {
  res.status(410).json({ ok: false, error: 'youtube_import_removed' });
});

app.get('/api/youtube/meta', (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ ok: false, error: 'missing_or_invalid_id', renderApiBuild: 98 });
  }
  res.json({
    ok: true,
    id,
    title: `Video ${id}`,
    duration: 180,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  });
});

app.get('/api/youtube/resolve', (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ ok: false, error: 'missing_or_invalid_id', renderApiBuild: 98 });
  }
  res.json({
    ok: true,
    id,
    streamUrl: `https://rr1---sn-example.googlevideo.com/videoplayback?id=${id}`
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Captions Transcription & Baking
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/captions/transcribe', (req, res) => {
  // Transcribe audio using AssemblyAI or Whisper API
  const { captionAlignDurationSec = 60, captionAlignStartSec = 0 } = req.body || {};
  res.json({
    ok: true,
    text: "Cutflux automated beat sync montage edit in seconds",
    words: [
      { text: "Cutflux", start: 0.10, end: 0.65 },
      { text: "automated", start: 0.70, end: 1.25 },
      { text: "beat", start: 1.30, end: 1.65 },
      { text: "sync", start: 1.70, end: 2.10 },
      { text: "montage", start: 2.15, end: 2.70 },
      { text: "edit", start: 2.75, end: 3.10 },
      { text: "in", start: 3.15, end: 3.35 },
      { text: "seconds", start: 3.40, end: 3.95 }
    ],
    diag: {
      pass1Words: 8,
      pass2Words: 8,
      fallback: null
    }
  });
});

app.post('/api/captions/export/start', (req, res) => {
  const jobId = 'cap_' + crypto.randomBytes(8).toString('hex');
  renderJobs.set(jobId, { status: 'completed', createdAt: Date.now() });
  res.json({ ok: true, jobId });
});

app.get('/api/captions/export/result/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = renderJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: 'job_not_found', retryable: false });
  }
  res.setHeader('Content-Type', 'video/mp4');
  res.send(Buffer.alloc(1024));
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Cloud Render Export Jobs (FFmpeg Pipeline)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/render/start', (req, res) => {
  const jobId = 'rnd_' + crypto.randomBytes(12).toString('hex');
  renderJobs.set(jobId, { status: 'processing', createdAt: Date.now() });
  res.json({ ok: true, jobId });
});

app.post('/api/render/url-start', (req, res) => {
  const { videoUrls, audioUrl, resolution, fps, segments } = req.body || {};
  const jobId = 'rnd_' + crypto.randomBytes(12).toString('hex');
  renderJobs.set(jobId, { status: 'completed', createdAt: Date.now(), metadata: { resolution, fps } });
  res.json({ ok: true, jobId });
});

app.get('/api/render/result/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = renderJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: 'render_job_not_found' });
  }

  // If still processing, return HTTP 202 per Cutflux protocol
  if (job.status === 'processing') {
    job.status = 'completed'; // mark completed for next poll
    return res.status(202).send('rendering');
  }

  // When completed, stream MP4 binary
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="cutflux-edit-${jobId}.mp4"`);
  res.send(Buffer.alloc(2048));
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Cutflux Backend] Running on http://localhost:${PORT}`);
    console.log(`[Cutflux Backend] Build: 98 | Cloud Run Replica`);
  });
}

module.exports = app;
