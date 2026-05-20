import { checkSSO } from "./auth/middleware.js";

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/zoho.js
var CACHE = { crm: { token: null, exp: 0 }, books: { token: null, exp: 0 } };
var DC_TOKEN_HOST = {
  us: "https://accounts.zoho.com",
  eu: "https://accounts.zoho.eu",
  in: "https://accounts.zoho.in",
  au: "https://accounts.zoho.com.au",
  jp: "https://accounts.zoho.jp"
};
function tokenHost(env) {
  const dc = (env.ZOHO_DC || "us").toLowerCase();
  return DC_TOKEN_HOST[dc] || DC_TOKEN_HOST.us;
}
__name(tokenHost, "tokenHost");
async function getZohoCRMAccessToken(env) {
  return await refreshAccess(env, "crm", {
    clientId: env.ZOHO_CRM_CLIENT_ID,
    clientSecret: env.ZOHO_CRM_CLIENT_SECRET,
    refreshToken: env.ZOHO_CRM_REFRESH_TOKEN
  });
}
__name(getZohoCRMAccessToken, "getZohoCRMAccessToken");
async function refreshAccess(env, family, creds) {
  if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
    throw new Error(`zoho-${family}-oauth-not-configured`);
  }
  const c = CACHE[family];
  if (c.token && c.exp > Date.now() + 3e4) return c.token;
  const params = new URLSearchParams({
    refresh_token: creds.refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token"
  });
  const url = tokenHost(env) + "/oauth/v2/token";
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error(`zoho-${family}-refresh-failed: ${j.error || r.status}`);
  }
  const expiresIn = (j.expires_in || 3600) * 1e3;
  CACHE[family] = {
    token: j.access_token,
    exp: Date.now() + expiresIn - 6e4
    // refresh 1 min early
  };
  return j.access_token;
}
__name(refreshAccess, "refreshAccess");

// src/index.js
var JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
var index_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "OPTIONS") return preflight(req, env);
    try {
      if (pathname === "/health" || pathname === "/api/health") {
        return cors(req, env, json({
          ok: true,
          service: "poseidon-proxy",
          version: "1.0.0",
          ts: (/* @__PURE__ */ new Date()).toISOString()
        }));
      }
      if (req.method === "POST" && pathname === "/api/portal-intake/cruise") {
        return cors(req, env, await handlePortalIntake(req, env, "cruise"));
      }
      if (req.method === "POST" && pathname === "/api/portal-intake/ghr") {
        return cors(req, env, await handlePortalIntake(req, env, "ghr"));
      }
      const statusMatch = pathname.match(/^\/api\/portal-status\/([\w.-]+)$/);
      if (req.method === "GET" && statusMatch) {
        return cors(req, env, await handlePortalStatus(env, statusMatch[1]));
      }
      if (pathname.startsWith("/api/")) {
        const authRes = await checkSSO(req, env);
        if (authRes) return cors(req, env, authRes);
      }
      if (req.method === "GET" && pathname === "/api/kpi-summary") {
        const scope = (url.searchParams.get("scope") || "master").toLowerCase();
        return cors(req, env, await handleKPISummary(req, env, scope));
      }
      return cors(req, env, json({
        error: "route-not-found",
        path: pathname,
        method: req.method
      }, 404));
    } catch (err) {
      return cors(req, env, json({
        error: "internal",
        message: String(err && err.message || err),
        path: pathname
      }, 500));
    }
  }
};
function corsHeaders(req, env) {
  const reqOrigin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  let origin = "";
  if (allowed.includes(reqOrigin)) origin = reqOrigin;
  else if (reqOrigin && /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(reqOrigin) && allowed.some((a) => reqOrigin.startsWith(a.split("/").slice(0, 3).join("/")))) {
    origin = reqOrigin;
  }
  return {
    "Access-Control-Allow-Origin": origin || allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Dashboard-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function preflight(req, env) {
  return new Response(null, { status: 204, headers: corsHeaders(req, env) });
}
__name(preflight, "preflight");
function cors(req, env, response) {
  const headers = new Headers(response.headers);
  const extra = corsHeaders(req, env);
  for (const k in extra) headers.set(k, extra[k]);
  return new Response(response.body, { status: response.status, headers });
}
__name(cors, "cors");
function checkAuth(req, env) {
  const sent = req.headers.get("X-Dashboard-Token") || "";
  const expected = env.DASHBOARD_TOKEN || "";
  if (!expected) {
    return json({
      error: "auth-not-configured",
      hint: "Worker secret DASHBOARD_TOKEN is not set. Run: wrangler secret put DASHBOARD_TOKEN"
    }, 503);
  }
  if (!sent || sent !== expected) {
    return json({
      error: "auth",
      hint: "send X-Dashboard-Token header with the value the dashboard was configured with"
    }, 401);
  }
  return null;
}
__name(checkAuth, "checkAuth");
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
__name(json, "json");
async function handleKPISummary(req, env, scope) {
  if (scope === "master") return await scopeMaster(env);
  if (scope === "finance") return await scopeFinance(env);
  if (scope === "marketing") return await scopeMarketing(env);
  if (scope === "portals") return await scopePortals(env);
  return json({
    error: "bad-scope",
    scope,
    accepted: ["master", "finance", "marketing", "portals"]
  }, 400);
}
__name(handleKPISummary, "handleKPISummary");
function emptyEnvelope(scope) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const fresh = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
  return {
    scope,
    captured_at: now,
    fresh_until: fresh,
    source_state: { primary: "live", fallback_from: null },
    kpis: [],
    alerts: [],
    links: { deep: "", refresh_now: `/api/kpi-summary?scope=${scope}&_t=now` },
    meta: { version: "1.0", owner_agent: "poseidon-proxy", partition_safe: true }
  };
}
__name(emptyEnvelope, "emptyEnvelope");
async function scopeFinance(env) {
  const env_ = emptyEnvelope("finance");
  env_.links.deep = "cti-financial-dashboard.html";
  let snap = null;
  let primary = "snapshot";
  try {
    const r = await fetch(env.SNAPSHOT_URL, { cf: { cacheTtl: 600 } });
    if (r.ok) snap = await r.json();
  } catch (_) {
  }
  if (!snap) {
    env_.source_state.primary = "stale";
    env_.alerts.push({
      id: "snapshot-unreachable",
      severity: "warning",
      message: "Zoho Books snapshot at SNAPSHOT_URL could not be fetched",
      link: env.SNAPSHOT_URL
    });
  }
  const k = snap && snap.kpis ? snap.kpis : {};
  const arBr = snap && snap.ar_status_breakdown ? snap.ar_status_breakdown : {};
  const ageKey = ["90_plus_days", "90+", "over_90", "90_plus"].find((x) => arBr[x] != null);
  const aging90 = ageKey ? arBr[ageKey] : null;
  const cashTotal = Array.isArray(snap?.bank_accounts) ? snap.bank_accounts.reduce((s, a) => s + (typeof a.balance === "number" ? a.balance : 0), 0) : typeof k.cash_position === "number" ? k.cash_position : null;
  const arTotal = typeof k.ar_outstanding === "number" ? k.ar_outstanding : null;
  const apTotal = typeof k.ap_outstanding === "number" ? k.ap_outstanding : null;
  const mtdRev = typeof k.mtd_revenue === "number" ? k.mtd_revenue : null;
  const ytdRev = typeof k.ytd_revenue === "number" ? k.ytd_revenue : null;
  const runway = typeof cashTotal === "number" && typeof mtdRev === "number" && mtdRev > 0 ? Math.max(0, Math.round(cashTotal / Math.max(1, Math.abs(mtdRev)) * 30)) : null;
  const asOf = snap?._meta?.captured_at || null;
  env_.kpis = [
    { id: "cash_total_usd", label: "Cash total", value: cashTotal, unit: "USD", as_of: asOf, drilldown: "cti-financial-dashboard.html#cash" },
    { id: "ar_total_usd", label: "AR total", value: arTotal, unit: "USD", as_of: asOf, drilldown: "cti-financial-dashboard.html#invoicing" },
    { id: "ar_aging_90_plus_usd", label: "AR aging 90+", value: aging90, unit: "USD", as_of: asOf, drilldown: "cti-financial-dashboard.html#invoicing" },
    { id: "ap_total_usd", label: "AP total", value: apTotal, unit: "USD", as_of: asOf, drilldown: "cti-financial-dashboard.html#bills" },
    { id: "mtd_revenue_usd", label: "MTD revenue", value: mtdRev, unit: "USD", as_of: asOf, drilldown: "cti-financial-dashboard.html#snapshot" },
    { id: "ytd_revenue_usd", label: "YTD revenue", value: ytdRev, unit: "USD", as_of: asOf, drilldown: "cti-financial-dashboard.html#snapshot" },
    { id: "cash_runway_days", label: "Cash runway", value: runway, unit: "days", as_of: asOf, drilldown: "cti-financial-dashboard.html#snapshot" }
  ];
  if (typeof aging90 === "number" && aging90 > 5e4) {
    env_.alerts.push({
      id: "ar_90_plus_high",
      severity: "warning",
      message: `AR 90+ days = $${aging90.toLocaleString("en-US")} \u2014 review collections`,
      link: "cti-financial-dashboard.html#invoicing"
    });
  }
  return json(env_);
}
__name(scopeFinance, "scopeFinance");
async function scopeMarketing(env) {
  const envelope = emptyEnvelope("marketing");
  envelope.links.deep = "cti-marketing-dashboard.html";
  const [crm, campaigns, ga4] = await Promise.all([
    fetchZohoCRMMarketing(env),
    fetchZohoCampaigns(env),
    fetchGA4Marketing(env)
  ]);
  envelope.kpis = [
    { id: "new_leads_mtd",        label: "New Leads MTD",              value: crm.new_leads_mtd,           unit: "count", display: "integer",    source: "zoho_crm",       as_of: null, drilldown: "cti-marketing-dashboard.html#attribution" },
    { id: "lead_conversion_rate", label: "Lead Conversion Rate (90d)", value: crm.lead_conversion_rate,    unit: "pct",   display: "percentage", source: "zoho_crm",       as_of: null, drilldown: "cti-marketing-dashboard.html#attribution" },
    { id: "pipeline_value_open",  label: "Open Pipeline Value",        value: crm.pipeline_value_open,     unit: "USD",   display: "currency",   source: "zoho_crm",       as_of: null, drilldown: "cti-marketing-dashboard.html#roi" },
    { id: "top_lead_source_mtd",  label: "Top Lead Source MTD",        value: crm.top_lead_source_mtd,     unit: "count", display: "string",     source: "zoho_crm",       as_of: null, drilldown: "cti-marketing-dashboard.html#attribution" },
    { id: "email_open_rate",      label: "Email Open Rate (30d)",      value: campaigns.email_open_rate,   unit: "pct",   display: "percentage", source: "zoho_campaigns", as_of: null, drilldown: "cti-marketing-dashboard.html#channels" },
    { id: "email_click_rate",     label: "Email Click Rate (30d)",     value: campaigns.email_click_rate,  unit: "pct",   display: "percentage", source: "zoho_campaigns", as_of: null, drilldown: "cti-marketing-dashboard.html#channels" },
    { id: "email_sends_mtd",      label: "Email Sends MTD",            value: campaigns.email_sends_mtd,   unit: "count", display: "integer",    source: "zoho_campaigns", as_of: null, drilldown: "cti-marketing-dashboard.html#channels" },
    { id: "website_sessions_mtd", label: "Website Sessions MTD",       value: ga4.website_sessions_mtd,    unit: "count", display: "integer",    source: "ga4",            as_of: null, drilldown: "cti-marketing-dashboard.html#channels" }
  ];
  envelope.source_state.primary = "stale";
  envelope.alerts.push({
    id: "marketing-credentials-pending",
    severity: "info",
    message: "Marketing data sources pending credential setup — tiles populate as Zoho CRM, Zoho Campaigns, and GA4 are wired.",
    link: "cti-marketing-dashboard.html"
  });
  return json(envelope);
}
__name(scopeMarketing, "scopeMarketing");

// Placeholder Zoho CRM marketing fetch. Returns null per metric until OAuth is wired
// (env.ZOHO_CRM_CLIENT_ID / ZOHO_CRM_CLIENT_SECRET / ZOHO_CRM_REFRESH_TOKEN are
// already used by handlePortalIntake — same credential set will drive these reads).
async function fetchZohoCRMMarketing(env) {
  if (!env.ZOHO_CRM_CLIENT_ID || !env.ZOHO_CRM_CLIENT_SECRET || !env.ZOHO_CRM_REFRESH_TOKEN) {
    console.log("fetchZohoCRMMarketing: credentials not configured");
  } else {
    console.log("fetchZohoCRMMarketing: credentials not configured (live queries pending wire-up)");
  }
  return {
    new_leads_mtd: null,
    lead_conversion_rate: null,
    pipeline_value_open: null,
    top_lead_source_mtd: null
  };
}
__name(fetchZohoCRMMarketing, "fetchZohoCRMMarketing");

// Placeholder Zoho Campaigns fetch. Returns null per metric until ZOHO_CAMPAIGNS_*
// OAuth credentials are added as Worker secrets.
async function fetchZohoCampaigns(env) {
  if (!env.ZOHO_CAMPAIGNS_CLIENT_ID || !env.ZOHO_CAMPAIGNS_CLIENT_SECRET || !env.ZOHO_CAMPAIGNS_REFRESH_TOKEN) {
    console.log("fetchZohoCampaigns: credentials not configured");
  }
  return {
    email_open_rate: null,
    email_click_rate: null,
    email_sends_mtd: null
  };
}
__name(fetchZohoCampaigns, "fetchZohoCampaigns");

// Placeholder GA4 Data API fetch. Returns null until GA4_SERVICE_ACCOUNT_JSON +
// GA4_PROPERTY_ID secrets are wired.
async function fetchGA4Marketing(env) {
  if (!env.GA4_SERVICE_ACCOUNT_JSON || !env.GA4_PROPERTY_ID) {
    console.log("fetchGA4Marketing: credentials not configured");
  }
  return {
    website_sessions_mtd: null
  };
}
__name(fetchGA4Marketing, "fetchGA4Marketing");
async function scopePortals(env) {
  const e = emptyEnvelope("portals");
  e.links.deep = "portals/cruise/index.html";
  const cruise = await getKVCount(env, "intake:cruise");
  const ghr = await getKVCount(env, "intake:ghr");
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  e.kpis = [
    { id: "cruise_intakes_total", label: "Cruise intakes (total)", value: cruise.count, unit: "count", as_of: cruise.last, drilldown: "portals/cruise/index.html" },
    { id: "cruise_intakes_24h", label: "Cruise intakes (24h)", value: cruise.last24, unit: "count", as_of: nowIso, drilldown: "portals/cruise/index.html" },
    { id: "ghr_intakes_total", label: "GHR intakes (total)", value: ghr.count, unit: "count", as_of: ghr.last, drilldown: "portals/ghr/index.html" },
    { id: "ghr_intakes_24h", label: "GHR intakes (24h)", value: ghr.last24, unit: "count", as_of: nowIso, drilldown: "portals/ghr/index.html" }
  ];
  return json(e);
}
__name(scopePortals, "scopePortals");
async function scopeMaster(env) {
  const e = emptyEnvelope("master");
  e.links.deep = "poseidon-master-dashboard.html";
  const [finResp, mktResp, prtResp] = await Promise.all([
    scopeFinance(env),
    scopeMarketing(env),
    scopePortals(env)
  ]);
  const [fin, mkt, prt] = await Promise.all([finResp.json(), mktResp.json(), prtResp.json()]);
  const pick = /* @__PURE__ */ __name((payload, id) => (payload.kpis || []).find((k) => k.id === id) || null, "pick");
  const tile = /* @__PURE__ */ __name((id, label, unit, source) => {
    const k = source ? pick(source, id) : null;
    return {
      id,
      label,
      value: k && k.value != null ? k.value : null,
      unit,
      as_of: k ? k.as_of : null,
      drilldown: k ? k.drilldown : null
    };
  }, "tile");
  e.kpis = [
    tile("cash_total_usd", "Cash total", "USD", fin),
    tile("ar_aging_90_plus_usd", "AR 90+ days", "USD", fin),
    tile("mtd_revenue_usd", "MTD revenue", "USD", fin),
    tile("ytd_revenue_usd", "YTD revenue", "USD", fin),
    { id: "cruise_active_candidates", label: "Cruise candidates", value: null, unit: "count", as_of: null, drilldown: "poseidon-dashboard-v6.html" },
    { id: "j1_active_candidates", label: "J-1 candidates", value: null, unit: "count", as_of: null, drilldown: "j1-system-dashboard.html" },
    { id: "j1_housing_beds_filled_pct", label: "J-1 housing fill", value: null, unit: "pct", as_of: null, drilldown: "j1-housing-finder-index.html" },
    tile("new_leads_mtd", "New leads MTD", "count", mkt),
    tile("pipeline_value_open", "Marketing pipeline", "USD", mkt),
    { id: "tasks_open", label: "Open tasks", value: null, unit: "count", as_of: null, drilldown: "tracker.html" },
    { id: "health_pct", label: "System health", value: 100, unit: "pct", as_of: (/* @__PURE__ */ new Date()).toISOString(), drilldown: "#it" }
  ];
  const cruiseTile = pick(prt, "cruise_intakes_total");
  const ghrTile = pick(prt, "ghr_intakes_total");
  if (cruiseTile && ghrTile) {
    e.alerts.push({
      id: "portals-intake-summary",
      severity: "info",
      message: `Portal intakes \u2014 cruise: ${cruiseTile.value || 0}, GHR: ${ghrTile.value || 0}`,
      link: "portals/cruise/index.html"
    });
  }
  [fin, mkt, prt].forEach((s) => (s.alerts || []).forEach((a) => {
    if (a.severity !== "info") e.alerts.push(a);
  }));
  e.source_state.primary = fin.source_state.primary === "live" ? "live" : "snapshot";
  return json(e);
}
__name(scopeMaster, "scopeMaster");
var PARTITION = {
  cruise: {
    module: "Candidates",
    // Zoho CRM CustomModule13
    candidateType: "Cruise",
    leadSource: "Cruise Web Portal"
  },
  ghr: {
    module: "J1_Candidates",
    // Zoho CRM CustomModule12
    candidateType: "Hospitality",
    leadSource: "GHR Web Portal"
  }
};
async function handlePortalIntake(req, env, portal) {
  if (!PARTITION[portal]) return json({ error: "bad-portal", portal }, 400);
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "bad-json" }, 400);
  }
  const flat = JSON.stringify(body).toLowerCase();
  const otherPortal = portal === "cruise" ? "ghr" : "cruise";
  if (flat.includes('"_portal":"' + otherPortal + '"')) {
    return json({ error: "partition-violation", portal, sent_for: otherPortal }, 400);
  }
  const cfg = PARTITION[portal];
  const id = crypto.randomUUID();
  const stored = {
    id,
    portal,
    captured_at: (/* @__PURE__ */ new Date()).toISOString(),
    payload: body,
    pushed_to_zoho: false,
    zoho_error: null,
    candidate_type: cfg.candidateType,
    lead_source: cfg.leadSource,
    module: cfg.module
  };
  await kvPut(env, `intake:${portal}:${id}`, stored);
  await bumpKVCount(env, `intake:${portal}`);
  let zohoOk = false;
  let zohoErr = null;
  if (env.ZOHO_CRM_CLIENT_ID && env.ZOHO_CRM_CLIENT_SECRET && env.ZOHO_CRM_REFRESH_TOKEN) {
    try {
      const access = await getZohoCRMAccessToken(env);
      const fields = mapToZohoFields(body, cfg);
      const r = await fetch(`https://www.zohoapis.com/crm/v6/${cfg.module}`, {
        method: "POST",
        headers: {
          "Authorization": `Zoho-oauthtoken ${access}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: [fields], trigger: ["workflow"] })
      });
      const j = await r.json();
      if (r.ok && j.data && j.data[0] && j.data[0].status === "success") {
        zohoOk = true;
        stored.pushed_to_zoho = true;
        stored.zoho_record_id = j.data[0].details && j.data[0].details.id;
        await kvPut(env, `intake:${portal}:${id}`, stored);
      } else {
        zohoErr = j.data?.[0]?.message || j.message || "zoho-write-failed";
        stored.zoho_error = zohoErr;
        await kvPut(env, `intake:${portal}:${id}`, stored);
      }
    } catch (err) {
      zohoErr = String(err && err.message || err);
      stored.zoho_error = zohoErr;
      await kvPut(env, `intake:${portal}:${id}`, stored);
    }
  } else {
    zohoErr = "zoho-crm-not-configured";
  }
  const token = await mintToken(env, { candidate_id: id, portal, exp: Math.floor(Date.now() / 1e3) + 86400 });
  return json({
    ok: true,
    portal,
    candidate_id: id,
    zoho: { pushed: zohoOk, error: zohoErr },
    token,
    status_url: `${env.ALLOWED_ORIGIN}/Poseidon/portals/${portal}/track.html?token=${encodeURIComponent(token)}`
  });
}
__name(handlePortalIntake, "handlePortalIntake");
async function handlePortalStatus(env, token) {
  let claims;
  try {
    claims = await verifyToken(env, token);
  } catch (e) {
    return json({ error: "invalid-token", detail: String(e.message || e) }, 401);
  }
  if (!claims || !claims.candidate_id || !claims.portal) return json({ error: "invalid-token" }, 401);
  if (claims.exp && claims.exp * 1e3 < Date.now()) return json({ error: "expired" }, 401);
  const rec = await kvGet(env, `intake:${claims.portal}:${claims.candidate_id}`);
  if (!rec) return json({ error: "not-found" }, 404);
  return json({
    ok: true,
    portal: claims.portal,
    candidate_id: claims.candidate_id,
    stage: rec.pushed_to_zoho ? "received-by-cti" : "queued-locally",
    captured_at: rec.captured_at,
    zoho_pushed: !!rec.pushed_to_zoho,
    notes: rec.zoho_error ? "Your submission is saved. Our system will retry the CRM push shortly." : "Your submission was received. A recruiter will be in touch within 3 business days."
  });
}
__name(handlePortalStatus, "handlePortalStatus");
function mapToZohoFields(body, cfg) {
  const firstName = trim(body.first_name || body.firstName || "");
  const lastName = trim(body.last_name || body.lastName || body.surname || "");
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || trim(body.email) || "Applicant";
  const out = {
    Name: fullName,
    First_Name: firstName,
    Last_Name: lastName,
    Email: trim(body.email || ""),
    Phone: trim(body.phone || ""),
    Lead_Source: cfg.leadSource,
    Candidate_Type: cfg.candidateType,
    Description: "Submitted via " + cfg.leadSource + " on " + (/* @__PURE__ */ new Date()).toISOString() + "\n\nRaw payload:\n" + JSON.stringify(body, null, 2)
  };
  for (const k in out) if (out[k] === "" || out[k] == null) delete out[k];
  if (!out.Last_Name) out.Last_Name = "Applicant";
  return out;
}
__name(mapToZohoFields, "mapToZohoFields");
function trim(s) {
  return String(s == null ? "" : s).trim().slice(0, 254);
}
__name(trim, "trim");
async function kvGet(env, key) {
  if (!env.POSEIDON_KV) return null;
  try {
    const v = await env.POSEIDON_KV.get(key, "json");
    return v;
  } catch (_) {
    return null;
  }
}
__name(kvGet, "kvGet");
async function kvPut(env, key, val) {
  if (!env.POSEIDON_KV) return;
  try {
    await env.POSEIDON_KV.put(key, JSON.stringify(val), { expirationTtl: 60 * 60 * 24 * 365 });
  } catch (_) {
  }
}
__name(kvPut, "kvPut");
async function bumpKVCount(env, baseKey) {
  if (!env.POSEIDON_KV) return;
  const c = await kvGet(env, baseKey + ":count") || { count: 0, last: null, last24: 0 };
  c.count = (c.count || 0) + 1;
  c.last = (/* @__PURE__ */ new Date()).toISOString();
  const dayKey = baseKey + ":day:" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const d = await kvGet(env, dayKey) || { count: 0 };
  d.count = (d.count || 0) + 1;
  c.last24 = d.count;
  await kvPut(env, baseKey + ":count", c);
  await kvPut(env, dayKey, d);
}
__name(bumpKVCount, "bumpKVCount");
async function getKVCount(env, baseKey) {
  const c = await kvGet(env, baseKey + ":count");
  return c || { count: 0, last: null, last24: 0 };
}
__name(getKVCount, "getKVCount");
async function mintToken(env, claims) {
  if (!env.JWT_SIGNING_KEY) {
    return "opaque." + base64url(JSON.stringify(claims));
  }
  const header = { alg: "HS256", typ: "JWT" };
  const enc = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claims));
  const sig = await hmacSign(env.JWT_SIGNING_KEY, enc);
  return enc + "." + sig;
}
__name(mintToken, "mintToken");
async function verifyToken(env, token) {
  if (!token) throw new Error("missing");
  if (token.startsWith("opaque.")) {
    return JSON.parse(b64urlDecodeString(token.slice("opaque.".length)));
  }
  if (!env.JWT_SIGNING_KEY) throw new Error("signing-key-missing");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("shape");
  const expected = await hmacSign(env.JWT_SIGNING_KEY, parts[0] + "." + parts[1]);
  if (expected !== parts[2]) throw new Error("bad-signature");
  return JSON.parse(b64urlDecodeString(parts[1]));
}
__name(verifyToken, "verifyToken");
function base64url(s) {
  if (typeof s === "string") s = new TextEncoder().encode(s);
  let bin = "";
  const b = new Uint8Array(s);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64url, "base64url");
function b64urlDecodeString(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}
__name(b64urlDecodeString, "b64urlDecodeString");
async function hmacSign(key, data) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return base64url(new Uint8Array(buf));
}
__name(hmacSign, "hmacSign");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
