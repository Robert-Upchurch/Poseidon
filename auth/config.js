// Poseidon SSO — shared config for the auth/ scaffold.
// Values here must match what poseidon-worker validates in src/auth/config.js.

export const TENANT_ID = 'ef421d3f-5736-4cca-a38f-e6a4d8607e7e';
export const CLIENT_ID = 'aff2df6d-cd54-48f3-bd24-3584fd9ea3de';

export const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;

// openid    → id_token issued with aud=CLIENT_ID (what the Worker validates)
// profile   → name claim
// email     → preferred_username / email claim (Worker allowlist reads this)
// User.Read → keeps consent identical to the dashboards' existing OneDrive scope set
export const LOGIN_SCOPES = ['openid', 'profile', 'email', 'User.Read'];

export const WORKER_BASE = 'https://poseidon-proxy.robertupchurch6121.workers.dev';

const origin = (typeof window !== 'undefined' && window.location.origin) || '';
export const REDIRECT_URI = `${origin}/Poseidon/auth/callback.html`;
export const POST_LOGOUT_REDIRECT_URI = `${origin}/Poseidon/auth/login.html`;

export const MSAL_VERSION = '3.6.0';
export const MSAL_CDN = `https://alcdn.msauth.net/browser/${MSAL_VERSION}/js/msal-browser.min.js`;
