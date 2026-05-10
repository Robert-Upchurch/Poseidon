# Cloudflare Worker — 5-minute setup guide

This worker unlocks three features on the J1 Housing dashboard:
- **Live Zoho reads + writes** (Update Zoho from the dashboard, including data from Zoho Recruit `CustomModule2` once you add the Recruit scope)
- **Walk Score** without exposing your key in browser source
- **Zillow live listings** via RapidAPI without exposing your key

You only need to do this once. After setup, the dashboard auto-detects the worker and starts using it.

## 1. Create the worker (60 seconds)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Worker**.
2. Name it `poseidon-proxy` and click **Deploy**.
3. Click **Edit code**.
4. Replace the entire contents with the code from `docs/cloudflare-worker-template.js` (in this repo).
5. Click **Save and Deploy**.
6. Copy your worker URL — looks like `https://poseidon-proxy.<your-subdomain>.workers.dev`.

## 2. Add secrets (3 minutes)

In your worker's **Settings → Variables and Secrets**, add each as **Encrypted (Secret)**:

| Variable | Where to get it | Required for |
|---|---|---|
| `ALLOWED_ORIGIN` | `https://robert-upchurch.github.io` (literal) | Always |
| `ZOHO_CLIENT_ID` | https://api-console.zoho.com → Add Client → Server-based App | Live Zoho |
| `ZOHO_CLIENT_SECRET` | Same Zoho Developer Console | Live Zoho |
| `ZOHO_REFRESH_TOKEN` | Generate via the Zoho OAuth flow with scopes `ZohoCRM.modules.ALL,ZohoRecruit.modules.ALL` | Live Zoho |
| `ZOHO_DC` | `us` (CTI Group is on the US data center) | Live Zoho |
| `WALKSCORE_KEY` | https://walkscore.com/professional/api-sign-up.php | Real Walk Score |
| `RAPIDAPI_ZILLOW_KEY` | https://rapidapi.com → subscribe to Zillow Com1 (or similar) | Live Zillow |

Skip any feature you don't want — the worker handles missing keys gracefully (returns 500 with a clear "X not set" error from that route only).

## 3. Test the worker

```bash
curl https://poseidon-proxy.<you>.workers.dev/health
# → {"ok":true,"version":"1.0.0-2026-05-10"}
```

If you've added Zoho secrets:
```bash
curl https://poseidon-proxy.<you>.workers.dev/zoho/J1_Participants1?per_page=2
```

## 4. Tell the dashboard about it

(Pending — the dashboard's Settings panel will gain a "Cloudflare Worker URL" field in the next iteration. For now the worker stands ready for that wiring.)

## What this enables

| Feature | Without worker | With worker |
|---|---|---|
| Walk Score | OSM-derived heuristic (free, approximate) | Real Walk Score / Transit Score / Bike Score |
| Google Places | Counts via Overpass + browser-side key (key visible in source) | Real business names, key kept secret |
| Zoho roster | OneDrive snapshot (manual refresh) | Live reads, no manual snapshot |
| Update Zoho from dashboard | Deeplink to Zoho UI only | True in-place edit + save |
| Zillow live listings | None (sample data only) | Real-time rental inventory |

## Worker security model

- Origin check: only requests from `ALLOWED_ORIGIN` are answered.
- Zoho OAuth handled internally; access token cached in worker memory for ~50 minutes per refresh.
- All paid keys live in Worker Secrets (encrypted at rest, only available to this worker).
- No keys ever appear in dashboard browser source.
