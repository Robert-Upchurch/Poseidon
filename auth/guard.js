// Poseidon SSO guard. Drop this into any dashboard with:
//   <script type="module" src="/Poseidon/auth/guard.js"></script>
//
// Behavior on load:
//   1. Init MSAL, finish any in-flight redirect.
//   2. If no cached account, redirect to /Poseidon/auth/login.html?return=<current>.
//   3. Acquire id_token silently from the cache.
//   4. Monkey-patch window.fetch to add `Authorization: Bearer <id_token>`
//      to any request whose URL starts with the Worker base.
//   5. Schedule a background refresh ~5 minutes before token expiry.
//   6. Expose window.poseidonAuth = { email, name, getToken, getClaims, signOut }.
//   7. Dispatch 'poseidon:auth-ready' on window when ready.

import { getMsalInstance } from './msal-loader.js';
import { LOGIN_SCOPES, WORKER_BASE } from './config.js';

const LOGIN_URL = '/Poseidon/auth/login.html';
const LOGOUT_URL = '/Poseidon/auth/logout.html';
const REFRESH_LEAD_MS = 5 * 60 * 1000;
const MIN_REFRESH_DELAY_MS = 30 * 1000;

let currentIdToken = null;
let currentClaims = null;
let activeAccount = null;
let refreshTimer = null;
let fetchPatched = false;

function redirectToLogin() {
  const returnUrl = encodeURIComponent(location.href);
  location.replace(`${LOGIN_URL}?return=${returnUrl}`);
}

function isInteractionRequired(err) {
  if (!err) return false;
  if (err.name === 'InteractionRequiredAuthError') return true;
  const code = err.errorCode || '';
  return code === 'interaction_required'
    || code === 'login_required'
    || code === 'consent_required'
    || code === 'invalid_grant';
}

function scheduleRefresh(msal) {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!currentClaims || !currentClaims.exp) return;
  const expMs = currentClaims.exp * 1000;
  const delay = Math.max(expMs - REFRESH_LEAD_MS - Date.now(), MIN_REFRESH_DELAY_MS);
  refreshTimer = setTimeout(() => {
    refreshToken(msal).catch((err) => console.error('guard: background refresh failed', err));
  }, delay);
}

async function refreshToken(msal) {
  try {
    const result = await msal.acquireTokenSilent({
      scopes: LOGIN_SCOPES,
      account: activeAccount,
      forceRefresh: false,
    });
    currentIdToken = result.idToken;
    currentClaims = result.idTokenClaims;
    scheduleRefresh(msal);
    return result.idToken;
  } catch (err) {
    if (isInteractionRequired(err)) {
      console.warn('guard: silent token acquisition requires interaction', err.errorCode || err.name);
      redirectToLogin();
      return null;
    }
    throw err;
  }
}

function installFetchInterceptor() {
  if (fetchPatched) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = function poseidonGuardedFetch(input, init) {
    const url = typeof input === 'string'
      ? input
      : (input && typeof input.url === 'string' ? input.url : '');
    if (!url.startsWith(WORKER_BASE) || !currentIdToken) {
      return originalFetch(input, init);
    }
    const baseHeaders = (init && init.headers)
      || (input && input.headers)
      || {};
    const headers = new Headers(baseHeaders);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentIdToken}`);
    }
    const nextInit = { ...(init || {}), headers };
    return originalFetch(input, nextInit);
  };
  fetchPatched = true;
}

(async function initGuard() {
  let msal;
  try {
    msal = await getMsalInstance();
    await msal.handleRedirectPromise();
  } catch (err) {
    console.error('guard: MSAL init / handleRedirectPromise failed', err);
    redirectToLogin();
    return;
  }

  const accounts = msal.getAllAccounts();
  if (accounts.length === 0) {
    redirectToLogin();
    return;
  }

  activeAccount = msal.getActiveAccount() || accounts[0];
  msal.setActiveAccount(activeAccount);

  const token = await refreshToken(msal);
  if (!token) return; // redirectToLogin already fired

  installFetchInterceptor();

  window.poseidonAuth = {
    email: activeAccount.username,
    name: activeAccount.name || activeAccount.username,
    getToken: () => currentIdToken,
    getClaims: () => currentClaims,
    signOut: () => location.assign(LOGOUT_URL),
  };

  window.dispatchEvent(new CustomEvent('poseidon:auth-ready', {
    detail: { email: activeAccount.username, name: window.poseidonAuth.name },
  }));
})();
