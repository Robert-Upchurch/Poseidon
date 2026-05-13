export function parseAllowlist(raw) {
  if (typeof raw !== 'string') return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowed(email, env) {
  if (typeof email !== 'string' || !email) return false;
  const allowlist = parseAllowlist(env.POSEIDON_EMAIL_ALLOWLIST || '');
  if (allowlist.size === 0) return false;
  return allowlist.has(email.toLowerCase());
}
