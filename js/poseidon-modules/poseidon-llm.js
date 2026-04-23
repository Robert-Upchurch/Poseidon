/* ═══════════════════════════════════════════════════════════════════
   POSEIDON — LLM ENHANCEMENT LAYER
   Strategic enhancements for:
     · PDF Housing Import parser
     · Forecasting / Simulations
     · Video Brief Generation
     · Automated Client Briefings

   Design: Each enhancement runs LOCALLY by default (deterministic
   heuristics + regex + numerical methods). If a Grok API key is
   provided in PoseidonLLM.setApiKey(), the layer will transparently
   upgrade to Grok for higher-quality results.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LS_KEY_API = 'poseidon_grok_api_key';
  const GROK_ENDPOINT_RESPONSES = 'https://api.x.ai/v1/responses';
  const GROK_ENDPOINT_CHAT      = 'https://api.x.ai/v1/chat/completions';
  const GROK_MODEL              = 'grok-4.20-reasoning';
  const LS_KEY_ENDPOINT         = 'poseidon_grok_endpoint_mode'; // 'responses' | 'chat'

  function getApiKey() {
    try { return localStorage.getItem(LS_KEY_API) || window.GROK_API_KEY || ''; } catch (_) { return window.GROK_API_KEY || ''; }
  }
  function setApiKey(k) { try { localStorage.setItem(LS_KEY_API, k || ''); } catch (_) {} }
  function hasApiKey() { return !!getApiKey(); }

  function getEndpointMode() {
    try { return localStorage.getItem(LS_KEY_ENDPOINT) || 'responses'; } catch (_) { return 'responses'; }
  }
  function setEndpointMode(mode) {
    if (mode !== 'responses' && mode !== 'chat') return;
    try { localStorage.setItem(LS_KEY_ENDPOINT, mode); } catch (_) {}
  }

  // Extract model output text from either API shape.
  function extractOutputText(data) {
    // /v1/responses shapes
    if (typeof data.output_text === 'string') return data.output_text;
    if (Array.isArray(data.output)) {
      const parts = [];
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (typeof c === 'string') parts.push(c);
            else if (c.type === 'output_text' && typeof c.text === 'string') parts.push(c.text);
            else if (c.type === 'text' && typeof c.text === 'string') parts.push(c.text);
          }
        } else if (typeof item.text === 'string') {
          parts.push(item.text);
        }
      }
      if (parts.length) return parts.join('');
    }
    // /v1/chat/completions shape
    const choice = data.choices && data.choices[0];
    if (choice) {
      const msg = choice.message || {};
      if (typeof msg.content === 'string') return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content.map(c => (typeof c === 'string' ? c : (c.text || ''))).join('');
      }
    }
    return '';
  }

  // ─── Shared Grok helper (non-blocking; local fallbacks elsewhere) ──
  // Uses /v1/responses by default with grok-4.20-reasoning. Falls back
  // to /v1/chat/completions if the responses endpoint returns a 4xx
  // that indicates it's unsupported for the chosen model/team.
  async function callGrok(systemPrompt, userPrompt, opts) {
    opts = opts || {};
    const key = getApiKey();
    if (!key) throw new Error('No Grok API key configured');
    const model = opts.model || GROK_MODEL;
    const mode = opts.endpoint || getEndpointMode();

    // Primary: /v1/responses
    if (mode === 'responses') {
      const body = {
        model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt }
        ],
        temperature: opts.temperature ?? 0.3
      };
      if (opts.json) body.response_format = { type: 'json_object' };
      const res = await fetch(GROK_ENDPOINT_RESPONSES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        return extractOutputText(data);
      }
      const errText = await res.text();
      // If /v1/responses isn't available for this model/team, fall back to chat completions.
      const shouldFallback = res.status === 404 || /not\s+found|unsupported|unknown\s+model|endpoint/i.test(errText);
      if (!shouldFallback) throw new Error(`Grok /v1/responses ${res.status}: ${errText}`);
      console.warn('[PoseidonLLM] /v1/responses unavailable — falling back to /v1/chat/completions');
    }

    // Fallback: /v1/chat/completions
    const body = {
      model,
      temperature: opts.temperature ?? 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ]
    };
    if (opts.json) body.response_format = { type: 'json_object' };
    const res = await fetch(GROK_ENDPOINT_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Grok /v1/chat/completions ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return extractOutputText(data);
  }

  // ══════════════════════════════════════════════════════════════════
  // 1) PDF HOUSING PARSER — local heuristic engine
  //    Handles fuzzy currency, date ranges, utility inclusions, pet
  //    policy, deposits, amenities. Returns structured JSON.
  // ══════════════════════════════════════════════════════════════════
  const HousingParser = (function () {
    const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

    function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

    function parseDate(str) {
      if (!str) return null;
      const s = norm(str).toLowerCase();
      // ISO
      let m = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
      if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
      // "May 15, 2026" / "15 May 2026"
      m = s.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/);
      if (m) return `${m[3]}-${String(MONTHS[m[2]]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
      m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/);
      if (m) return `${m[3]}-${String(MONTHS[m[1]]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
      // mm/dd/yyyy
      m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
      if (m) return `${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
      return null;
    }

    function parseMoney(str) {
      if (!str) return null;
      const m = String(str).match(/\$?\s?([\d,]+(?:\.\d{1,2})?)/);
      if (!m) return null;
      return parseFloat(m[1].replace(/,/g, ''));
    }

    function extractOptions(text) {
      // Split into blocks by "Option" markers or by double-newlines
      const blocks = text.split(/\n\s*(?:option|property|unit|listing|#\d+)\b[:\s]*/i)
                         .map(b => b.trim()).filter(b => b.length > 40);
      return blocks.length > 1 ? blocks : [text];
    }

    function extract(text) {
      const T = norm(text);
      const Tl = T.toLowerCase();

      // Move-in / move-out
      const moveInM = Tl.match(/(?:move[- ]?in|start|available|begin)[:\s]+([^\n.]{3,40})/);
      const moveOutM = Tl.match(/(?:move[- ]?out|end|until|through)[:\s]+([^\n.]{3,40})/);
      const moveIn = moveInM ? parseDate(moveInM[1]) : null;
      const moveOut = moveOutM ? parseDate(moveOutM[1]) : null;

      // Rent (monthly)
      let rent = null;
      const rentRx = [
        /\$?\s?([\d,]+(?:\.\d{1,2})?)\s*(?:\/|per)\s*(?:mo|month)/i,
        /monthly\s+rent[:\s]+\$?\s?([\d,]+)/i,
        /rent[:\s]+\$?\s?([\d,]+)/i
      ];
      for (const r of rentRx) { const m = T.match(r); if (m) { rent = parseMoney(m[0]); break; } }

      // Deposit
      const depoM = T.match(/(?:security\s+)?deposit[:\s]+\$?\s?([\d,]+)/i);
      const deposit = depoM ? parseMoney(depoM[0]) : null;

      // Bedrooms / bathrooms
      const bedM = T.match(/(\d+(?:\.\d)?)\s*(?:bed|bd|br)\b/i);
      const bathM = T.match(/(\d+(?:\.\d)?)\s*(?:bath|ba|bth)\b/i);

      // Utilities inclusion
      const utilityTerms = ['water','electric','gas','internet','wifi','wi-fi','trash','heat','sewer','cable'];
      const utilitiesIncluded = utilityTerms.filter(u => new RegExp(`${u}[^\\n]{0,30}(included|incl\\.|yes|paid)`, 'i').test(Tl));
      const utilitiesExtra = utilityTerms.filter(u => new RegExp(`${u}[^\\n]{0,30}(not\\s+included|tenant|separate)`, 'i').test(Tl));

      // Pet policy
      let pets = 'unknown';
      if (/\bno\s+pets?\b|pets?\s+not\s+allowed|no\s+animals/i.test(Tl)) pets = 'not_allowed';
      else if (/pets?\s+(?:are\s+)?(?:allowed|welcome|ok)|pet[- ]?friendly/i.test(Tl)) pets = 'allowed';
      else if (/cats?\s+only|dogs?\s+only/i.test(Tl)) pets = 'restricted';

      // Address
      const addrM = T.match(/\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct)[A-Za-z0-9,.\- ]*\d{5}?/);

      // Amenities
      const amenityList = ['pool','gym','fitness','laundry','parking','furnished','dishwasher','a/c','ac','air conditioning','balcony','patio','wi-fi','wifi'];
      const amenities = [...new Set(amenityList.filter(a => new RegExp(`\\b${a.replace('/','\\/')}\\b`, 'i').test(Tl))
                                                .map(a => a === 'ac' ? 'a/c' : a))];

      // Contact
      const phoneM = T.match(/\+?1?\s?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const emailM = T.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

      // Capacity / occupants
      const capM = T.match(/(\d+)\s*(?:occupants?|people|participants?|tenants?)\s*(?:max|allowed)?/i);

      return {
        address: addrM ? addrM[0] : null,
        moveIn, moveOut,
        rentMonthly: rent,
        deposit,
        bedrooms: bedM ? parseFloat(bedM[1]) : null,
        bathrooms: bathM ? parseFloat(bathM[1]) : null,
        utilitiesIncluded, utilitiesExtra,
        pets,
        amenities,
        capacity: capM ? parseInt(capM[1], 10) : null,
        contact: { phone: phoneM ? phoneM[0] : null, email: emailM ? emailM[0] : null },
        _confidence: _confidenceScore({ addrM, moveIn, rent, bedM, bathM })
      };
    }

    function _confidenceScore({ addrM, moveIn, rent, bedM, bathM }) {
      let s = 0;
      if (addrM) s += 30; if (moveIn) s += 25; if (rent) s += 25;
      if (bedM) s += 10; if (bathM) s += 10;
      return s;
    }

    async function parse(pdfText, opts) {
      opts = opts || {};
      const blocks = extractOptions(pdfText);
      const options = blocks.map(b => ({ raw: b.slice(0, 800), ...extract(b) }));

      // Optionally enhance with Grok for higher-quality edge cases
      if (opts.useGrok && hasApiKey()) {
        try {
          const sys = 'You are an expert real-estate document parser. Return VALID JSON matching the schema provided. Be conservative — null if unsure.';
          const schema = `{ "options": [ { "address": string|null, "moveIn": "YYYY-MM-DD"|null, "moveOut": "YYYY-MM-DD"|null, "rentMonthly": number|null, "deposit": number|null, "bedrooms": number|null, "bathrooms": number|null, "utilitiesIncluded": string[], "utilitiesExtra": string[], "pets": "allowed"|"not_allowed"|"restricted"|"unknown", "amenities": string[], "capacity": number|null, "contact": { "phone": string|null, "email": string|null } } ] }`;
          const content = await callGrok(sys, `Schema:\n${schema}\n\nDocument:\n${pdfText.slice(0, 12000)}`, { json: true, temperature: 0.1 });
          const parsed = JSON.parse(content);
          if (parsed.options && Array.isArray(parsed.options)) return { options: parsed.options, source: 'grok' };
        } catch (e) {
          console.warn('[HousingParser] Grok fallback → local', e);
        }
      }
      return { options, source: 'local' };
    }

    return { parse, extract, parseDate, parseMoney };
  })();

  // ══════════════════════════════════════════════════════════════════
  // 2) FORECASTING / SIMULATIONS — local numerical methods
  //    - Linear regression baseline
  //    - Seasonal decomposition (12-period, Holt-Winters additive)
  //    - Monte Carlo scenarios
  //    All zero-dependency, zero-API, fully deterministic.
  // ══════════════════════════════════════════════════════════════════
  const Forecast = (function () {
    function linearRegression(series) {
      const n = series.length;
      if (n < 2) return { slope: 0, intercept: series[0] || 0, r2: 0 };
      const xs = series.map((_, i) => i);
      const xm = xs.reduce((a,b)=>a+b,0)/n;
      const ym = series.reduce((a,b)=>a+b,0)/n;
      let num = 0, den = 0, tss = 0;
      for (let i = 0; i < n; i++) { num += (xs[i]-xm)*(series[i]-ym); den += (xs[i]-xm)**2; tss += (series[i]-ym)**2; }
      const slope = den === 0 ? 0 : num/den;
      const intercept = ym - slope * xm;
      let rss = 0;
      for (let i = 0; i < n; i++) { const pred = intercept + slope*xs[i]; rss += (series[i]-pred)**2; }
      const r2 = tss === 0 ? 0 : 1 - rss/tss;
      return { slope, intercept, r2 };
    }

    function holtWinters(series, period, horizon, alpha, beta, gamma) {
      alpha = alpha ?? 0.5; beta = beta ?? 0.2; gamma = gamma ?? 0.3;
      const n = series.length;
      if (n < period * 2) return { forecast: linearForecast(series, horizon), method: 'linear-fallback' };
      // Initial level + trend
      let level = series.slice(0, period).reduce((a,b)=>a+b,0)/period;
      const trend0 = (series.slice(period, 2*period).reduce((a,b)=>a+b,0)/period - level) / period;
      let trend = trend0;
      const seasonal = [];
      for (let i = 0; i < period; i++) seasonal[i] = series[i] - level;
      const smoothed = [], fc = [];
      for (let t = 0; t < n; t++) {
        const seasonalIdx = t % period;
        const prevLevel = level;
        level = alpha * (series[t] - seasonal[seasonalIdx]) + (1 - alpha) * (level + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
        seasonal[seasonalIdx] = gamma * (series[t] - level) + (1 - gamma) * seasonal[seasonalIdx];
        smoothed.push(level + trend + seasonal[seasonalIdx]);
      }
      for (let h = 1; h <= horizon; h++) {
        fc.push(level + h * trend + seasonal[(n + h - 1) % period]);
      }
      return { forecast: fc, method: 'holt-winters' };
    }

    function linearForecast(series, horizon) {
      const { slope, intercept } = linearRegression(series);
      const out = []; const n = series.length;
      for (let h = 1; h <= horizon; h++) out.push(intercept + slope * (n + h - 1));
      return out;
    }

    function simulate(base, scenarios) {
      scenarios = scenarios || [
        { name: 'Conservative', multiplier: 0.85, volatility: 0.08 },
        { name: 'Expected',     multiplier: 1.00, volatility: 0.12 },
        { name: 'Aggressive',   multiplier: 1.25, volatility: 0.18 }
      ];
      return scenarios.map(s => ({
        name: s.name,
        multiplier: s.multiplier,
        values: base.map((v, i) => {
          const noise = (Math.sin(i * 12.345 + s.multiplier * 7) * 0.5 + 0.5 - 0.5) * s.volatility * 2;
          return Math.max(0, v * s.multiplier * (1 + noise));
        })
      }));
    }

    function whatIf(series, deltaPercent) {
      const f = linearForecast(series, 12);
      const scaled = f.map(v => v * (1 + (deltaPercent || 0) / 100));
      const totalBase = f.reduce((a,b)=>a+b,0);
      const totalScaled = scaled.reduce((a,b)=>a+b,0);
      return { baseline: f, scaled, delta: totalScaled - totalBase, deltaPercent: deltaPercent || 0 };
    }

    return { linearRegression, holtWinters, linearForecast, simulate, whatIf };
  })();

  // ══════════════════════════════════════════════════════════════════
  // 3) VIDEO BRIEF GENERATOR — local template engine
  //    Produces 8-scene scripts from intake data.
  //    Upgradeable to Grok for cinematic polish.
  // ══════════════════════════════════════════════════════════════════
  const VideoBrief = (function () {
    const SCENE_TEMPLATES = [
      { beat: 'Hook',          duration: 5,  prompt: 'High-impact opener: brand logo stinger + establishing hero shot.' },
      { beat: 'Problem',       duration: 8,  prompt: 'The challenge this opportunity solves. Voiceover names the pain.' },
      { beat: 'Promise',       duration: 8,  prompt: 'The opportunity — cultural exchange + paid work + professional growth.' },
      { beat: 'Location',      duration: 10, prompt: 'Partner property / destination B-roll. Show the scale.' },
      { beat: 'Daily Life',    duration: 12, prompt: 'Behind-the-scenes: housing, teammates, workday rhythm.' },
      { beat: 'Testimonial',   duration: 15, prompt: 'Alumni participant speaks to the transformation.' },
      { beat: 'Partner Pitch', duration: 10, prompt: 'Why this sponsor / employer. Credibility signals.' },
      { beat: 'CTA',           duration: 7,  prompt: 'Clear next step with date + URL + QR code.' }
    ];

    function generateLocal(intake) {
      intake = intake || {};
      const partner = intake.partnerName || intake.partner || 'CTI Partner';
      const destination = intake.destination || intake.location || 'the Host Destination';
      const program = intake.program || 'J-1 Cultural Exchange';
      const toneHint = intake.tone || 'inspiring';
      const duration = intake.targetDuration || 75;

      const scale = duration / SCENE_TEMPLATES.reduce((a,s)=>a+s.duration,0);

      const scenes = SCENE_TEMPLATES.map((tpl, i) => {
        const sec = Math.round(tpl.duration * scale);
        const vo = _voForBeat(tpl.beat, { partner, destination, program });
        return {
          scene: i + 1, beat: tpl.beat, durationSec: sec,
          bRollPrompt: `${tpl.prompt} Tone: ${toneHint}. Destination: ${destination}.`,
          voiceover: vo,
          onScreenText: _titleForBeat(tpl.beat, { partner, destination })
        };
      });

      return {
        partner, destination, program, targetDurationSec: duration,
        totalDuration: scenes.reduce((a,s)=>a+s.durationSec,0),
        scenes,
        musicCue: `Cinematic ${toneHint} score, 90 BPM, builds at Scene 5.`,
        deliverables: ['16:9 master (1080p)', '9:16 vertical cut (1080×1920)', '1:1 square cut (1080×1080)'],
        source: 'local'
      };
    }

    function _voForBeat(beat, ctx) {
      const v = {
        Hook:          `The next chapter begins with ${ctx.partner}.`,
        Problem:       `Most careers stay within one set of borders. Yours doesn't have to.`,
        Promise:       `${ctx.program} opens the door to ${ctx.destination} — paid work, cultural immersion, and skills that compound.`,
        Location:      `From arrival, you'll work inside a world-class operation at ${ctx.destination}.`,
        'Daily Life':  `Housing is arranged. Your team is international. Your day is structured but never small.`,
        Testimonial:   `"Coming here changed how I see my career." — Former participant`,
        'Partner Pitch': `${ctx.partner} selects for curiosity, work ethic, and the ability to represent your country well.`,
        CTA:           `Applications open now. Visit ghrhospitality.com/apply to begin.`
      };
      return v[beat] || '';
    }
    function _titleForBeat(beat, ctx) {
      const t = {
        Hook: ctx.partner, Problem: 'Bigger than one border',
        Promise: 'Your next chapter', Location: ctx.destination,
        'Daily Life': 'Your life on program', Testimonial: 'What alumni say',
        'Partner Pitch': `Why ${ctx.partner}`, CTA: 'Apply now'
      };
      return t[beat] || '';
    }

    async function generate(intake, opts) {
      opts = opts || {};
      const local = generateLocal(intake);
      if (!opts.useGrok || !hasApiKey()) return local;
      try {
        const sys = 'You are a senior creative director for corporate recruiting video. Return VALID JSON only.';
        const usr = `Upgrade this scene brief with more cinematic voiceover and precise b-roll prompts. Keep the same JSON schema.\n\n${JSON.stringify(local)}`;
        const content = await callGrok(sys, usr, { json: true, temperature: 0.6 });
        const parsed = JSON.parse(content);
        parsed.source = 'grok'; return parsed;
      } catch (e) {
        console.warn('[VideoBrief] Grok fallback → local', e);
        return local;
      }
    }
    return { generate, generateLocal };
  })();

  // ══════════════════════════════════════════════════════════════════
  // 4) CLIENT BRIEFINGS — automated executive summaries
  //    Reads the live dashboard state and drafts a briefing.
  // ══════════════════════════════════════════════════════════════════
  const ClientBriefing = (function () {
    const SKIP_SELECTOR = [
      'script', 'style', 'noscript', 'template',
      '#sidebar', '#sidebar-overlay', '#mobile-menu-btn', '#app-header',
      '#jarvis-fab', '#jarvis-panel', '#jarvis-modal',
      '#poseidon-training-overlay', '#poseidon-directory-modal', '#poseidon-version-modal',
      '#poseidon-back-to-v6',
      '[data-skip-snapshot]', '.page.hidden'
    ].join(',');

    function _getActivePage() {
      return document.querySelector('.page.active:not(.hidden), .page:not(.hidden)');
    }

    function _closestLabel(el) {
      // Look for an associated <label> or a nearby text hint
      try {
        if (el.id) {
          const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (lab) return lab.textContent.trim();
        }
        const parent = el.closest('label');
        if (parent) return parent.textContent.trim();
        // Look for a preceding heading/label-ish sibling
        let prev = el.previousElementSibling;
        while (prev) {
          if (/^(LABEL|H1|H2|H3|H4|H5|H6|DT)$/.test(prev.tagName)) return (prev.textContent || '').trim();
          prev = prev.previousElementSibling;
        }
        // Fall back to placeholder or aria-label
        return el.getAttribute('aria-label') || el.getAttribute('placeholder') || null;
      } catch (_) { return null; }
    }

    function _clean(str, maxLen) {
      if (!str) return '';
      const s = String(str).replace(/\s+/g, ' ').trim();
      return (maxLen && s.length > maxLen) ? s.slice(0, maxLen) + '…' : s;
    }

    // Extract rich content from a page element. Walks the DOM and harvests
    // headings, paragraphs, list items, textareas, form inputs, and any
    // elements explicitly tagged data-document / data-note.
    function extractPageContent(pageEl, opts) {
      opts = opts || {};
      const maxLenPerField = opts.maxLenPerField ?? 4000;
      const maxItems = opts.maxItems ?? 120;
      if (!pageEl) return { empty: true };

      // Clone the page so we can safely strip UI chrome
      const clone = pageEl.cloneNode(true);
      clone.querySelectorAll(SKIP_SELECTOR).forEach(n => n.remove());
      // Remove toolbar buttons — pure chrome with no informational value
      clone.querySelectorAll('[data-division-toolbar] button, .jv-close, .pd-close, .pv-close').forEach(n => n.remove());

      const out = {
        title: (pageEl.querySelector('h2,h1')?.textContent || '').trim() || null,
        subtitle: null,
        headings: [],
        paragraphs: [],
        listItems: [],
        documents: [],
        notes: [],
        textareas: [],
        inputs: [],
        links: [],
        tables: [],
        canvases: []
      };

      // Subtitle: first non-empty text adjacent to the H2
      try {
        const h2 = pageEl.querySelector('h2');
        const hint = h2 && h2.nextElementSibling && /^P$/i.test(h2.nextElementSibling.tagName) ? h2.nextElementSibling.textContent : null;
        out.subtitle = _clean(hint, 240) || null;
      } catch (_) {}

      // Headings
      [...clone.querySelectorAll('h1,h2,h3,h4,h5,h6')].slice(0, maxItems).forEach(h => {
        const t = _clean(h.textContent, 240);
        if (t && t.length > 1) out.headings.push({ level: parseInt(h.tagName.slice(1), 10), text: t });
      });

      // Paragraphs — long enough to be meaningful
      [...clone.querySelectorAll('p')].slice(0, maxItems).forEach(p => {
        const t = _clean(p.textContent, 1200);
        if (t && t.length >= 20) out.paragraphs.push(t);
      });

      // List items
      [...clone.querySelectorAll('li')].slice(0, maxItems).forEach(li => {
        const t = _clean(li.textContent, 600);
        if (t && t.length >= 2) out.listItems.push(t);
      });

      // Tables (summary)
      [...clone.querySelectorAll('table')].slice(0, 20).forEach(tbl => {
        const rows = [...tbl.querySelectorAll('tr')].map(tr =>
          [...tr.querySelectorAll('th,td')].map(td => _clean(td.textContent, 120))
        ).filter(r => r.some(c => c));
        if (rows.length) out.tables.push(rows.slice(0, 50));
      });

      // Textareas — capture full text (these are where docs/plans/notes live)
      [...clone.querySelectorAll('textarea')].forEach(ta => {
        const val = ta.value !== undefined ? ta.value : ta.textContent;
        if (val && val.trim().length) {
          out.textareas.push({
            id: ta.id || null,
            label: _closestLabel(ta) || null,
            placeholder: ta.getAttribute('placeholder') || null,
            text: _clean(val, maxLenPerField)
          });
        }
      });
      // The cloned textareas don't carry their .value from the DOM props (cloneNode
      // only clones the "value" attribute, not the live property). Backfill from
      // the live page:
      [...pageEl.querySelectorAll('textarea')].forEach(ta => {
        if (!ta.value || !ta.value.trim()) return;
        const already = out.textareas.find(t => t.id && ta.id && t.id === ta.id);
        if (already) { already.text = _clean(ta.value, maxLenPerField); return; }
        out.textareas.push({
          id: ta.id || null,
          label: _closestLabel(ta) || null,
          placeholder: ta.getAttribute('placeholder') || null,
          text: _clean(ta.value, maxLenPerField)
        });
      });

      // Inputs — only meaningful, filled, non-sensitive
      const INPUT_SKIP = new Set(['password','hidden','file','submit','button','reset']);
      [...pageEl.querySelectorAll('input')].forEach(inp => {
        const type = (inp.type || 'text').toLowerCase();
        if (INPUT_SKIP.has(type)) return;
        const val = inp.value;
        if (!val || !val.trim()) return;
        // Skip inputs that are clearly search boxes / global chrome
        if (inp.id === 'global-search') return;
        out.inputs.push({
          id: inp.id || null,
          type,
          label: _closestLabel(inp) || null,
          value: _clean(val, 600)
        });
      });

      // Explicit document/note regions (authors can tag content with data-document / data-note)
      [...clone.querySelectorAll('[data-document],[data-doc],.poseidon-document')].forEach(el => {
        out.documents.push({
          title: el.getAttribute('data-document') || el.getAttribute('data-doc') || el.querySelector('h3,h4')?.textContent?.trim() || null,
          text: _clean(el.innerText, maxLenPerField * 2)
        });
      });
      [...clone.querySelectorAll('[data-note],.poseidon-note')].forEach(el => {
        out.notes.push({
          title: el.getAttribute('data-note') || el.querySelector('h3,h4')?.textContent?.trim() || null,
          text: _clean(el.innerText, maxLenPerField)
        });
      });

      // Heuristic: certain card patterns we know carry briefings/notes
      [...clone.querySelectorAll('[id*="briefing" i], [id*="notes" i], [class*="briefing" i]')].slice(0, 20).forEach(el => {
        const t = _clean(el.innerText, maxLenPerField);
        if (!t || t.length < 30) return;
        out.documents.push({ title: el.querySelector('h3,h4')?.textContent?.trim() || null, text: t });
      });

      // Canvas IDs for context (cannot read pixel data cheaply)
      out.canvases = [...pageEl.querySelectorAll('canvas')].map(c => c.id).filter(Boolean);

      // Links — useful for "what can I click from here"
      [...clone.querySelectorAll('a[href]')].slice(0, 40).forEach(a => {
        const t = _clean(a.textContent, 100);
        const href = a.getAttribute('href');
        if (t && href && !href.startsWith('#') && t.length > 1) {
          out.links.push({ text: t, href });
        }
      });

      // De-dup paragraphs / list items / headings
      out.paragraphs = [...new Set(out.paragraphs)];
      out.listItems  = [...new Set(out.listItems)];
      out.headings   = out.headings.filter((h, i, arr) => arr.findIndex(x => x.text === h.text) === i);

      return out;
    }

    function snapshotDashboard(opts) {
      opts = opts || {};
      const includeFullContent = opts.includeFullContent !== false; // default true
      const snap = {
        date: new Date().toISOString().slice(0,10),
        timestamp: new Date().toISOString(),
        divisions: {},
        tasks: _readTasks(),
        events: _readEvents()
      };
      ['masterforecast','finance','recruitingdivision','processingcuk','j1division','ittech','j1housing'].forEach(id => {
        const page = document.getElementById(id);
        if (!page) return;
        const title = page.querySelector('h2')?.textContent?.trim() || id;
        const charts = [...page.querySelectorAll('canvas')].map(c => c.id);
        const kpiCards = [...page.querySelectorAll('[class*="border-l-"][class*="rounded"]')].map(el => ({
          label: el.querySelector('[class*="text-zinc-500"],[class*="text-zinc-400"]')?.textContent?.trim(),
          value: el.querySelector('[class*="text-2xl"],[class*="text-3xl"],.text-xl,[class*="font-bold"]')?.textContent?.trim()
        })).filter(k => k.label);
        snap.divisions[id] = { title, charts, kpiCards };
      });

      // Active-page deep content — this is the big unlock:
      if (includeFullContent) {
        const active = _getActivePage();
        if (active) {
          snap.activePageId = active.id || null;
          snap.activePageContent = extractPageContent(active, {
            maxLenPerField: opts.maxLenPerField ?? 4000,
            maxItems: opts.maxItems ?? 120
          });
        }
      }

      return snap;
    }

    function _readTasks() { try { return JSON.parse(localStorage.getItem('poseidon-tasks') || '[]'); } catch (_) { return []; } }
    function _readEvents() { try { return JSON.parse(localStorage.getItem('poseidon-events') || '[]'); } catch (_) { return []; } }

    function generateLocal(client, opts) {
      opts = opts || {};
      const snap = snapshotDashboard();
      const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      const openTasks = snap.tasks.filter(t => !t.done).length;
      const todayISO = snap.date;
      const upcomingEvents = snap.events.filter(e => (e.date || '') >= todayISO).slice(0, 3);

      const divisionLines = Object.values(snap.divisions).map(d => {
        const kpiLine = d.kpiCards.slice(0,3).map(k => `${k.label}: ${k.value || '—'}`).join(' · ');
        return `• ${d.title} — ${kpiLine || 'Awaiting data connection'}`;
      }).join('\n');

      const body = [
        `## ${opts.title || 'Executive Briefing'}`,
        `Prepared for: ${client || 'Executive Team'}`,
        `Date: ${today}`,
        '',
        `### Division Snapshot`,
        divisionLines,
        '',
        `### Priority Focus`,
        `${openTasks} open tasks · ${upcomingEvents.length} upcoming meetings.`,
        upcomingEvents.length ? upcomingEvents.map(e => `• ${e.date} — ${e.title || 'Untitled'}`).join('\n') : '• No scheduled meetings in the next horizon.',
        '',
        `### Recommended Next Steps`,
        `1. Validate division KPIs against Zoho Analytics after the next sync.`,
        `2. Confirm J-1 Housing pipeline and consular briefing cadence.`,
        `3. Review Master + Forecast scenario outputs with leadership.`,
        '',
        `_Generated by Poseidon · v${(window.PoseidonVersion?.getCurrent?.() || '6.1.0')}_`
      ].join('\n');

      return { client: client || 'Executive Team', date: todayISO, markdown: body, snapshot: snap, source: 'local' };
    }

    async function generate(client, opts) {
      opts = opts || {};
      const local = generateLocal(client, opts);
      if (!opts.useGrok || !hasApiKey()) return local;
      try {
        const sys = `You are a senior executive chief-of-staff. Write a concise, confident briefing in well-formatted Markdown. Keep it under 400 words. Be candid about data gaps. Conclude with 3 actionable recommendations.`;
        const usr = `Client: ${client}\nRole/audience: ${opts.audience || 'Board / Executive Team'}\nDashboard snapshot:\n${JSON.stringify(local.snapshot)}\n`;
        const md = await callGrok(sys, usr, { temperature: 0.4 });
        return { ...local, markdown: md, source: 'grok' };
      } catch (e) {
        console.warn('[ClientBriefing] Grok fallback → local', e);
        return local;
      }
    }

    return { generate, generateLocal, snapshotDashboard, extractPageContent };
  })();

  // ─── Public API ─────────────────────────────────────────────────
  window.PoseidonLLM = {
    setApiKey, getApiKey, hasApiKey,
    getEndpointMode, setEndpointMode,
    defaultModel: GROK_MODEL,
    HousingParser, Forecast, VideoBrief, ClientBriefing,
    _callGrok: callGrok
  };

  // ─── Dashboard hook-ins ─────────────────────────────────────────
  // Expose helper functions on window so existing dashboard buttons
  // can call them without additional wiring. Existing handlers remain
  // fully functional; these are additive.
  window.Poseidon_generateVideoBriefLLM = async function (intake) {
    const brief = await VideoBrief.generate(intake || {}, { useGrok: hasApiKey() });
    return brief;
  };
  window.Poseidon_parseHousingPdfLLM = async function (text) {
    return await HousingParser.parse(text || '', { useGrok: hasApiKey() });
  };
  window.Poseidon_forecastLLM = function (series, horizon) {
    return Forecast.holtWinters(series || [], 4, horizon || 12);
  };
  window.Poseidon_clientBriefingLLM = async function (client, opts) {
    return await ClientBriefing.generate(client, Object.assign({ useGrok: hasApiKey() }, opts || {}));
  };
})();
