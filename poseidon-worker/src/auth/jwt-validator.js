import {
  JWKS_URL,
  EXPECTED_ISS,
  EXPECTED_AUD,
  CLOCK_SKEW_SECONDS,
} from './config.js';

let jwksCache = null;
let jwksFetchedAt = 0;
const JWKS_MIN_REFETCH_MS = 60_000;

function base64urlDecodeToBytes(input) {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64urlDecodeToString(input) {
  const bytes = base64urlDecodeToBytes(input);
  return new TextDecoder().decode(bytes);
}

async function fetchJwks(force = false) {
  const now = Date.now();
  if (jwksCache && !force) return jwksCache;
  if (!jwksCache && now - jwksFetchedAt < JWKS_MIN_REFETCH_MS) return null;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error(`jwks-fetch-failed: ${r.status}`);
  const body = await r.json();
  if (!body || !Array.isArray(body.keys)) throw new Error('jwks-malformed');
  jwksCache = new Map(body.keys.map((k) => [k.kid, k]));
  jwksFetchedAt = now;
  return jwksCache;
}

async function getJwk(kid) {
  let keys = await fetchJwks(false);
  if (keys && keys.has(kid)) return keys.get(kid);
  keys = await fetchJwks(true);
  if (keys && keys.has(kid)) return keys.get(kid);
  throw new Error(`jwks-kid-not-found: ${kid}`);
}

async function importRsaPublicKey(jwk) {
  return await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

export async function verifyIdToken(token) {
  if (typeof token !== 'string' || !token) throw new Error('token-missing');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token-malformed');

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64urlDecodeToString(headerB64));
  const payload = JSON.parse(base64urlDecodeToString(payloadB64));

  if (header.alg !== 'RS256') throw new Error(`unexpected-alg: ${header.alg}`);
  if (!header.kid) throw new Error('header-missing-kid');

  const jwk = await getJwk(header.kid);
  const key = await importRsaPublicKey(jwk);

  const signedInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlDecodeToBytes(signatureB64);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signedInput,
  );
  if (!ok) throw new Error('signature-invalid');

  if (payload.iss !== EXPECTED_ISS) {
    throw new Error(`iss-mismatch: ${payload.iss}`);
  }
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(EXPECTED_AUD)) {
    throw new Error(`aud-mismatch: ${payload.aud}`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < nowSec) {
    throw new Error('token-expired');
  }
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_SECONDS > nowSec) {
    throw new Error('token-not-yet-valid');
  }

  return payload;
}
