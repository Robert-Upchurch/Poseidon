import { verifyIdToken } from './jwt-validator.js';
import { isAllowed } from './allowlist.js';

const AUTH_JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function authJson(body, status) {
  return new Response(JSON.stringify(body), { status, headers: AUTH_JSON_HEADERS });
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkSSO(req, env) {
  const dashboardToken = req.headers.get('X-Dashboard-Token') || '';

  const bypass = (env.POSEIDON_AUTH_BYPASS_TOKEN || '').trim();
  if (bypass && dashboardToken && timingSafeEqual(dashboardToken, bypass)) {
    console.warn('auth: bypass-token used', { path: new URL(req.url).pathname });
    return null;
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const claims = await verifyIdToken(token);
      const email = (claims.preferred_username || claims.email || '').toLowerCase();
      if (!isAllowed(email, env)) {
        console.warn('auth: email-not-allowlisted', { email });
        return authJson({ error: 'auth', reason: 'not-allowlisted', email }, 403);
      }
      console.log('auth: sso-ok', { email });
      return null;
    } catch (err) {
      console.warn('auth: jwt-invalid', { reason: String(err.message || err) });
      return authJson({ error: 'auth', reason: 'invalid-token', detail: String(err.message || err) }, 401);
    }
  }

  if (String(env.POSEIDON_LEGACY_TOKEN_ENABLED).toLowerCase() === 'true') {
    const expected = (env.DASHBOARD_TOKEN || '').trim();
    if (expected && dashboardToken && timingSafeEqual(dashboardToken, expected)) {
      console.log('auth: legacy-token-ok');
      return null;
    }
  }

  return authJson({
    error: 'auth',
    hint: 'send Authorization: Bearer <id_token> from MSAL, or X-Dashboard-Token for bypass',
  }, 401);
}
