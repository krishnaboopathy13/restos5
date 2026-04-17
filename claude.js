/**
 * RestOS v4.1 — Anthropic Claude API Proxy
 * Vercel Serverless Function  →  /api/claude
 *
 * SETUP: Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables
 * Get your key at: https://console.anthropic.com
 */

const ANTHROPIC_URL   = 'https://api.anthropic.com/v1/messages';
const ALLOWED_MODELS  = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'];
const MAX_TOKENS_CAP  = 2000;

module.exports = async function handler(req, res) {

  // ── CORS ─────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  // ── API KEY CHECK ─────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    console.error('[RestOS] ANTHROPIC_API_KEY missing or malformed');
    return res.status(500).json({
      error: {
        type:    'api_key_missing',
        message: 'ANTHROPIC_API_KEY not configured on server. Add it in Vercel → Project → Settings → Environment Variables.'
      }
    });
  }

  // ── PARSE BODY ────────────────────────────────────────
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: { message: 'Invalid JSON body' } }); }
  }

  // ── VALIDATE ──────────────────────────────────────────
  if (!body || !body.messages || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: { message: 'messages array required' } });
  }

  // Sanitize model
  if (!body.model || !ALLOWED_MODELS.includes(body.model)) {
    body.model = ALLOWED_MODELS[0]; // default to sonnet
  }

  // Cap tokens
  if (!body.max_tokens || body.max_tokens > MAX_TOKENS_CAP) {
    body.max_tokens = MAX_TOKENS_CAP;
  }

  // ── FORWARD TO ANTHROPIC ──────────────────────────────
  try {
    const response = await fetch(ANTHROPIC_URL, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[RestOS Proxy] Anthropic error:', response.status, data?.error?.message);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[RestOS Proxy] Network error:', err.message);
    return res.status(502).json({
      error: { type: 'proxy_error', message: 'Failed to reach Anthropic API: ' + err.message }
    });
  }
};
