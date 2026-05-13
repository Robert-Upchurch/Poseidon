export const TENANT_ID = 'ef421d3f-5736-4cca-a38f-e6a4d8607e7e';
export const CLIENT_ID = 'aff2df6d-cd54-48f3-bd24-3584fd9ea3de';

export const JWKS_URL = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;
export const EXPECTED_ISS = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
export const EXPECTED_AUD = CLIENT_ID;

export const CLOCK_SKEW_SECONDS = 300;
