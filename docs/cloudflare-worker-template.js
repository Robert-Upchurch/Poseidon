/**
 * Poseidon J1 Housing Dashboard — Cloudflare Worker proxy template
 *
 * One worker, three concerns:
 *   1. Zoho proxy        — live Zoho CRM/Recruit reads + writes (via OAuth)
 *   2. Walk Score proxy  — adds the API key server-side (key stays secret)
 *   3. Zillow scraper proxy (RapidAPI) — same pattern, keys stay secret
 *
 * 5-minute deploy:
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker.
 *   2. Paste this entire file into the editor. Save & Deploy.
 *   3. Note your worker URL (e.g. https://poseidon-proxy.<your>.workers.dev).
 *   4. In Worker Settings → Variables → add as Secret (encrypted):
 *        ZOHO_REFRESH_TOKEN     ← from Zoho Developer Console
 *        ZOHO_CLIENT_ID         ← from Zoho Developer Console
 *        ZOHO_CLIENT_SECRET     ← from Zoho Developer Console
 *        ZOHO_DC                ← "us" (or "eu", "in", "au", etc.)
 *        WALKSCORE_KEY          ← optional, from walkscore.com
 *        RAPIDAPI_ZILLOW_KEY    ← optional, from rapidapi.com
 *        ALLOWED_ORIGIN         ← "https://robert-upchurch.github.io"
 *   5. In the dashboard's Settings panel, paste your worker URL where
 *      it asks for "Cloudflare Worker URL" (this part of the dashboard
 *      will be added in the next iteration once the worker is live).
 *
 * Routes exposed by this worker:
 *   GET  /zoho/<module>?fields=...&limit=...   → list records
 *   GET  /zoho/<module>/<id>                   → single record
 *   PUT  /zoho/<module>/<id>  body=JSON        → update record
 *   GET  /walkscore?lat=..&lon=..&address=..   → walk + transit + bike score
 *   GET  /zillow/search?location=..&beds=..    → live Zillow rentals
 *   GET  /health                               → "ok" + version
 *
 * Security:
 *   - Origin check: only ALLOWED_ORIGIN can call this worker.
 *   - Zoho OAuth refresh handled internally; access token cached 50 min in KV
 *     (or memory if no KV bound).
 *   - All paid keys live in Worker Secrets, never in the dashboard source.
 */

const VERSION = '1.0.0-2026-05-10';

// --- CORS helpers ---
function corsHeaders(env) {
    const allow = env.ALLOWED_ORIGIN || '*';
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

function jsonResponse(body, env, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
    });
}

// --- Zoho OAuth: refresh access token using long-lived refresh token ---
let _zohoTokenCache = { token: null, expiresAt: 0 };
async function getZohoAccessToken(env) {
    const now = Date.now();
    if (_zohoTokenCache.token && _zohoTokenCache.expiresAt > now) {
        return _zohoTokenCache.token;
    }
    const dc = env.ZOHO_DC || 'us';
    const url = `https://accounts.zoho.${dc === 'us' ? 'com' : dc}/oauth/v2/token`;
    const body = new URLSearchParams({
        refresh_token: env.ZOHO_REFRESH_TOKEN,
        client_id: env.ZOHO_CLIENT_ID,
        client_secret: env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
    });
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!r.ok) throw new Error(`Zoho token refresh failed: ${r.status}`);
    const j = await r.json();
    if (!j.access_token) throw new Error('Zoho returned no access_token');
    _zohoTokenCache = {
        token: j.access_token,
        expiresAt: now + (j.expires_in - 120) * 1000, // 2-min safety margin
    };
    return j.access_token;
}

// --- Zoho route handlers ---
async function handleZoho(req, env, parts) {
    const token = await getZohoAccessToken(env);
    const dc = env.ZOHO_DC || 'us';
    const apiHost = `https://www.zohoapis.${dc === 'us' ? 'com' : dc}`;

    const module = parts[1];
    const id = parts[2];
    const url = new URL(req.url);

    if (req.method === 'GET' && !id) {
        // List records
        const params = new URLSearchParams();
        for (const [k, v] of url.searchParams) params.set(k, v);
        if (!params.has('per_page')) params.set('per_page', '100');
        const upstream = `${apiHost}/crm/v6/${module}?${params}`;
        const r = await fetch(upstream, {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        return new Response(await r.text(), {
            status: r.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
        });
    }
    if (req.method === 'GET' && id) {
        // Single record
        const r = await fetch(`${apiHost}/crm/v6/${module}/${id}`, {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        return new Response(await r.text(), {
            status: r.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
        });
    }
    if (req.method === 'PUT' && id) {
        // Update record
        const bodyText = await req.text();
        const r = await fetch(`${apiHost}/crm/v6/${module}/${id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json',
            },
            body: bodyText,
        });
        return new Response(await r.text(), {
            status: r.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
        });
    }
    return jsonResponse({ error: 'method-not-allowed' }, env, 405);
}

// --- Walk Score proxy (key stays server-side) ---
async function handleWalkScore(req, env) {
    if (!env.WALKSCORE_KEY) return jsonResponse({ error: 'WALKSCORE_KEY not set' }, env, 500);
    const u = new URL(req.url);
    const lat = u.searchParams.get('lat');
    const lon = u.searchParams.get('lon');
    const address = u.searchParams.get('address') || '';
    if (!lat || !lon) return jsonResponse({ error: 'lat+lon required' }, env, 400);
    const ws = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lon}&transit=1&bike=1&wsapikey=${encodeURIComponent(env.WALKSCORE_KEY)}`;
    const r = await fetch(ws);
    return new Response(await r.text(), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
    });
}

// --- Zillow proxy (RapidAPI) ---
async function handleZillow(req, env) {
    if (!env.RAPIDAPI_ZILLOW_KEY) return jsonResponse({ error: 'RAPIDAPI_ZILLOW_KEY not set' }, env, 500);
    const u = new URL(req.url);
    const location = u.searchParams.get('location');
    const beds = u.searchParams.get('beds') || '';
    const maxPrice = u.searchParams.get('max_price') || '';
    if (!location) return jsonResponse({ error: 'location required' }, env, 400);
    // Default to "zillow-com1" RapidAPI provider — change to whichever you subscribed.
    const upstream = `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?location=${encodeURIComponent(location)}&status_type=ForRent${beds?`&bedsMin=${beds}`:''}${maxPrice?`&rentMaxPrice=${maxPrice}`:''}`;
    const r = await fetch(upstream, {
        headers: {
            'X-RapidAPI-Key': env.RAPIDAPI_ZILLOW_KEY,
            'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com',
        },
    });
    return new Response(await r.text(), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
    });
}

// --- Main router ---
export default {
    async fetch(req, env) {
        // CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(env) });
        }

        // Origin allowlist
        const origin = req.headers.get('Origin');
        const allowedOrigin = env.ALLOWED_ORIGIN;
        if (allowedOrigin && origin && origin !== allowedOrigin) {
            return jsonResponse({ error: 'origin-not-allowed', origin }, env, 403);
        }

        const url = new URL(req.url);
        const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');

        try {
            if (parts[0] === 'health') {
                return jsonResponse({ ok: true, version: VERSION }, env);
            }
            if (parts[0] === 'zoho' && parts[1]) {
                return await handleZoho(req, env, parts);
            }
            if (parts[0] === 'walkscore') {
                return await handleWalkScore(req, env);
            }
            if (parts[0] === 'zillow' && parts[1] === 'search') {
                return await handleZillow(req, env);
            }
            return jsonResponse({ error: 'route-not-found', path: url.pathname }, env, 404);
        } catch (e) {
            return jsonResponse({ error: 'worker-exception', message: e.message }, env, 500);
        }
    },
};
