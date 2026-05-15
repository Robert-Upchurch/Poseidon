import {
  AUTHORITY,
  CLIENT_ID,
  MSAL_CDN,
  REDIRECT_URI,
  POST_LOGOUT_REDIRECT_URI,
} from './config.js';

let scriptPromise = null;
let instance = null;
let initPromise = null;

function loadMsalScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.msal && window.msal.PublicClientApplication) {
      resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = MSAL_CDN;
    tag.async = true;
    tag.onload = () => {
      if (window.msal && window.msal.PublicClientApplication) resolve();
      else reject(new Error('msal-loader: script loaded but window.msal is missing'));
    };
    tag.onerror = () => reject(new Error('msal-loader: failed to load MSAL from ' + MSAL_CDN));
    document.head.appendChild(tag);
  });
  return scriptPromise;
}

export async function getMsalInstance() {
  if (instance) return instance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await loadMsalScript();
    const pca = new window.msal.PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: AUTHORITY,
        redirectUri: REDIRECT_URI,
        postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    });
    // MSAL v3 requires explicit initialize() before any other API call.
    await pca.initialize();
    instance = pca;
    return pca;
  })();
  return initPromise;
}
