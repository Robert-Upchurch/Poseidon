"""
Comprehensive update (Robert 2026-04-29):

CALENDAR (v6 + j1-system):
  1. Remove duplicate day-of-week headers from renderMonthView — they
     are already rendered in static markup above the grid.
  2. Extend calendar window: -3 years through +5 years (was -7d / +730d).
  3. Bump service-worker CACHE_NAME so old cached HTML evicts.

J1 HOUSING FINDER (j1-housing-finder-index.html):
  4. Add 4 new source tabs: zillow, apartments, facebook, furnishedfinder.
  5. CSS variables, dot colors, badge colors for the new sources.
  6. Source label map (instead of charAt-capitalize) so 'apartments'
     -> 'Apartments.com', 'facebook' -> 'Facebook Marketplace', etc.
  7. getSourceLinks() emits link buttons for ALL 8 sources on every card.
  8. Each listing now has optional contact_name + contact_phone fields;
     renderListings displays them when present.
  9. Add ~16 new sample listings for the new sources, with contact info
     populated where realistic.

JARVIS (poseidon-jarvis-grok.js):
 10. set_housing_filters source enum extended to include the 4 new
     sources.
 11. read_housing description and system prompt blurb mention the
     full 8-source coverage and that listings carry direct URLs and
     contact info.
"""
import io, os, re, sys

REPO = r"C:\Users\ceo\OneDrive - CTI Group Worldwide Services Inc\POSEIDON\Claude-Workspace\Code-Projects\Poseidon-Dashboard-V5"

def read(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def write(p, s):
    if p.lower().endswith('.html') and not s.rstrip().lower().endswith('</html>'):
        raise SystemExit(f"refusing to write {p}: does not end with </html>")
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

results = []

# ============================================================
# 1. Calendar fixes for v6 + j1-system
# ============================================================
OLD_HEADER_LINE = "    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class=\"text-xs text-zinc-500 text-center font-semibold py-2\">${d}</div>`).join('');\n"
NEW_HEADER_LINE = "    // Day-of-week headers are rendered in the static markup above the\n    // grid (see <div class=\"grid grid-cols-7 mb-1\">), so we don't repeat\n    // them inside the grid here.\n    let html = '';\n"

OLD_CAL_WINDOW_V6 = (
    "    const start = new Date(now.getTime() -   7*86400000).toISOString();\n"
    "    const end   = new Date(now.getTime() + 730*86400000).toISOString(); // ~24 months\n"
)
NEW_CAL_WINDOW = (
    "    // Robert 2026-04-29: 3 years back, 5 years forward.\n"
    "    const start = new Date(now.getTime() - 1095*86400000).toISOString(); // ~3 years back\n"
    "    const end   = new Date(now.getTime() + 1825*86400000).toISOString(); // ~5 years forward\n"
)

for fname in ['poseidon-dashboard-v6.html', 'j1-system-dashboard.html']:
    p = os.path.join(REPO, fname)
    src = read(p)
    if OLD_HEADER_LINE in src:
        src = src.replace(OLD_HEADER_LINE, NEW_HEADER_LINE, 1)
        results.append(f"{fname}: duplicate day-of-week headers removed from grid")
    else:
        results.append(f"{fname}: WARN duplicate header line not found")
    if OLD_CAL_WINDOW_V6 in src:
        src = src.replace(OLD_CAL_WINDOW_V6, NEW_CAL_WINDOW, 1)
        results.append(f"{fname}: calendar window extended -3y / +5y")
    else:
        results.append(f"{fname}: WARN calendar window block not found")
    write(p, src)

# ============================================================
# 2. Service worker cache bump
# ============================================================
sw_path = os.path.join(REPO, 'service-worker.js')
sw_src = read(sw_path)
m = re.search(r"const CACHE_NAME = 'poseidon-cache-v(\d+)';", sw_src)
if m:
    new_v = int(m.group(1)) + 1
    sw_src = re.sub(r"const CACHE_NAME = 'poseidon-cache-v\d+';",
                    f"const CACHE_NAME = 'poseidon-cache-v{new_v}';", sw_src, count=1)
    write(sw_path, sw_src)
    results.append(f"service-worker.js: CACHE_NAME bumped to v{new_v}")
else:
    results.append("service-worker.js: WARN CACHE_NAME pattern not found")

# ============================================================
# 3. J1 Housing Finder — comprehensive update
# ============================================================
hp = os.path.join(REPO, 'j1-housing-finder-index.html')
hsrc = read(hp)

# 3a. CSS variables + dot/badge classes for new sources
OLD_DARK_VARS = (
    "            --badge-craigslist: #8b5cf6;\n"
    "            --badge-airbnb: #f43f5e;\n"
    "            --badge-vrbo: #0ea5e9;\n"
    "            --badge-owner: #10b981;\n"
)
NEW_DARK_VARS = (
    "            --badge-craigslist: #8b5cf6;\n"
    "            --badge-airbnb: #f43f5e;\n"
    "            --badge-vrbo: #0ea5e9;\n"
    "            --badge-owner: #10b981;\n"
    "            --badge-zillow: #006aff;\n"
    "            --badge-apartments: #f97316;\n"
    "            --badge-facebook: #1877f2;\n"
    "            --badge-furnishedfinder: #ec4899;\n"
)
OLD_LIGHT_VARS = (
    "            --badge-craigslist: #7c3aed;\n"
    "            --badge-airbnb: #e11d48;\n"
    "            --badge-vrbo: #0284c7;\n"
    "            --badge-owner: #059669;\n"
)
NEW_LIGHT_VARS = (
    "            --badge-craigslist: #7c3aed;\n"
    "            --badge-airbnb: #e11d48;\n"
    "            --badge-vrbo: #0284c7;\n"
    "            --badge-owner: #059669;\n"
    "            --badge-zillow: #0044d6;\n"
    "            --badge-apartments: #ea580c;\n"
    "            --badge-facebook: #1668d6;\n"
    "            --badge-furnishedfinder: #db2777;\n"
)
OLD_DOT_CSS = (
    "        .dot-craigslist { background: var(--badge-craigslist); }\n"
    "        .dot-airbnb { background: var(--badge-airbnb); }\n"
    "        .dot-vrbo { background: var(--badge-vrbo); }\n"
    "        .dot-owner { background: var(--badge-owner); }\n"
)
NEW_DOT_CSS = (
    "        .dot-craigslist { background: var(--badge-craigslist); }\n"
    "        .dot-airbnb { background: var(--badge-airbnb); }\n"
    "        .dot-vrbo { background: var(--badge-vrbo); }\n"
    "        .dot-owner { background: var(--badge-owner); }\n"
    "        .dot-zillow { background: var(--badge-zillow); }\n"
    "        .dot-apartments { background: var(--badge-apartments); }\n"
    "        .dot-facebook { background: var(--badge-facebook); }\n"
    "        .dot-furnishedfinder { background: var(--badge-furnishedfinder); }\n"
)
OLD_BADGE_CSS = (
    "        .badge-craigslist { background: rgba(139,92,246,0.15); color: var(--badge-craigslist); }\n"
    "        .badge-airbnb { background: rgba(244,63,94,0.15); color: var(--badge-airbnb); }\n"
)
NEW_BADGE_CSS = (
    "        .badge-craigslist { background: rgba(139,92,246,0.15); color: var(--badge-craigslist); }\n"
    "        .badge-airbnb { background: rgba(244,63,94,0.15); color: var(--badge-airbnb); }\n"
    "        .badge-zillow { background: rgba(0,106,255,0.15); color: var(--badge-zillow); }\n"
    "        .badge-apartments { background: rgba(249,115,22,0.15); color: var(--badge-apartments); }\n"
    "        .badge-facebook { background: rgba(24,119,242,0.15); color: var(--badge-facebook); }\n"
    "        .badge-furnishedfinder { background: rgba(236,72,153,0.15); color: var(--badge-furnishedfinder); }\n"
)
for old, new, label in [
    (OLD_DARK_VARS, NEW_DARK_VARS, "dark-mode badge vars"),
    (OLD_LIGHT_VARS, NEW_LIGHT_VARS, "light-mode badge vars"),
    (OLD_DOT_CSS, NEW_DOT_CSS, "dot CSS classes"),
    (OLD_BADGE_CSS, NEW_BADGE_CSS, "badge CSS classes"),
]:
    if old in hsrc:
        hsrc = hsrc.replace(old, new, 1)
        results.append(f"j1-housing: {label} extended for 4 new sources")
    else:
        results.append(f"j1-housing: WARN {label} pattern not found")

# 3b. Source tabs HTML
OLD_TABS = (
    "        <button class=\"source-tab\" data-source=\"owner\" onclick=\"filterSource('owner', this)\">\n"
    "            <span class=\"source-dot dot-owner\"></span> Rent by Owner\n"
    "        </button>\n"
    "    </div>\n"
)
NEW_TABS = (
    "        <button class=\"source-tab\" data-source=\"owner\" onclick=\"filterSource('owner', this)\">\n"
    "            <span class=\"source-dot dot-owner\"></span> Rent by Owner\n"
    "        </button>\n"
    "        <button class=\"source-tab\" data-source=\"zillow\" onclick=\"filterSource('zillow', this)\">\n"
    "            <span class=\"source-dot dot-zillow\"></span> Zillow\n"
    "        </button>\n"
    "        <button class=\"source-tab\" data-source=\"apartments\" onclick=\"filterSource('apartments', this)\">\n"
    "            <span class=\"source-dot dot-apartments\"></span> Apartments.com\n"
    "        </button>\n"
    "        <button class=\"source-tab\" data-source=\"facebook\" onclick=\"filterSource('facebook', this)\">\n"
    "            <span class=\"source-dot dot-facebook\"></span> Facebook Marketplace\n"
    "        </button>\n"
    "        <button class=\"source-tab\" data-source=\"furnishedfinder\" onclick=\"filterSource('furnishedfinder', this)\">\n"
    "            <span class=\"source-dot dot-furnishedfinder\"></span> Furnished Finder\n"
    "        </button>\n"
    "    </div>\n"
)
if OLD_TABS in hsrc:
    hsrc = hsrc.replace(OLD_TABS, NEW_TABS, 1)
    results.append("j1-housing: 4 new source tabs added")
else:
    results.append("j1-housing: WARN source tabs block not found")

# 3c. Source label map — replace both occurrences (popup HTML + card render)
OLD_LABEL = "listing.source === 'owner' ? 'Rent by Owner' : listing.source.charAt(0).toUpperCase() + listing.source.slice(1)"
NEW_LABEL = "_sourceLabel(listing.source)"
hsrc = hsrc.replace(OLD_LABEL, NEW_LABEL)
OLD_LABEL_2 = "l.source === 'owner' ? 'Rent by Owner' : l.source.charAt(0).toUpperCase() + l.source.slice(1)"
NEW_LABEL_2 = "_sourceLabel(l.source)"
hsrc = hsrc.replace(OLD_LABEL_2, NEW_LABEL_2)
results.append("j1-housing: source labels now via _sourceLabel() helper")

# 3d. Helper functions: _sourceLabel + extended getSourceLinks +
#     contact-info renderer. We append to the existing getSourceLinks
#     by replacing the whole function block.
OLD_GETSOURCE = """function getSourceLinks(listing) {
    const cityRaw = listing.city.split(',')[0].trim();
    const stateRaw = (listing.city.split(',')[1] || '').trim().toUpperCase();
    const city = encodeURIComponent(cityRaw);
    const state = encodeURIComponent(stateRaw);
    const beds = listing.beds;
    const price = listing.price;

    const clCity = cityRaw.toLowerCase().replace(/\\s/g, '');
    const craigslist = `https://${clCity}.craigslist.org/search/apa?min_bedrooms=${beds}&max_price=${price + 200}`;
    const airbnb = `https://www.airbnb.com/s/${city}--${state}/homes?adults=1&min_bedrooms=${beds}&price_max=${Math.round(price * 1.3 / 30)}&monthly=true`;
    const vrbo = `https://www.vrbo.com/search?destination=${city}%2C+${state}&adults=1&startDate=&endDate=`;
    const stateSlug = US_STATE_NAMES[stateRaw] || slugify(stateRaw);
    const citySlug = slugify(cityRaw);
    const owner = `https://www.rentbyowner.com/all/usa/${stateSlug}/${citySlug}`;

    let links = '';
    links += `<a href="${craigslist}" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🟣 Craigslist</a>`;
    links += `<a href="${airbnb}" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🔴 Airbnb</a>`;
    links += `<a href="${vrbo}" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🔵 Vrbo</a>`;
    links += `<a href="${owner}" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🟢 RentByOwner</a>`;
    return links;"""

NEW_GETSOURCE = """// Maps the internal source key to a human label shown on cards/popups.
function _sourceLabel(src) {
    return ({
        all:             'All Listings',
        craigslist:      'Craigslist',
        airbnb:          'Airbnb',
        vrbo:            'Vrbo',
        owner:           'Rent by Owner',
        zillow:          'Zillow',
        apartments:      'Apartments.com',
        facebook:        'Facebook Marketplace',
        furnishedfinder: 'Furnished Finder'
    })[src] || (src ? src.charAt(0).toUpperCase() + src.slice(1) : '');
}

function getSourceLinks(listing) {
    const cityRaw = listing.city.split(',')[0].trim();
    const stateRaw = (listing.city.split(',')[1] || '').trim().toUpperCase();
    const city = encodeURIComponent(cityRaw);
    const state = encodeURIComponent(stateRaw);
    const beds = listing.beds;
    const price = listing.price;

    const clCity = cityRaw.toLowerCase().replace(/\\s/g, '');
    const stateSlug = US_STATE_NAMES[stateRaw] || slugify(stateRaw);
    const citySlug = slugify(cityRaw);

    const craigslist     = `https://${clCity}.craigslist.org/search/apa?min_bedrooms=${beds}&max_price=${price + 200}`;
    const airbnb         = `https://www.airbnb.com/s/${city}--${state}/homes?adults=1&min_bedrooms=${beds}&price_max=${Math.round(price * 1.3 / 30)}&monthly=true`;
    const vrbo           = `https://www.vrbo.com/search?destination=${city}%2C+${state}&adults=1&startDate=&endDate=`;
    const owner          = `https://www.rentbyowner.com/all/usa/${stateSlug}/${citySlug}`;
    const zillow         = `https://www.zillow.com/${citySlug}-${stateRaw.toLowerCase()}/rentals/${beds}-_beds/`;
    const apartments     = `https://www.apartments.com/${citySlug}-${stateRaw.toLowerCase()}/${beds}-bedrooms/`;
    const facebook       = `https://www.facebook.com/marketplace/category/propertyrentals/?query=${city}%20${state}`;
    const furnishedfinder= `https://www.furnishedfinder.com/housing?city=${city}&state=${state}`;

    // If the listing has its OWN canonical URL (l.url), put it first as
    // "View Listing" — that's the direct link Robert asked for.
    const direct = listing.url
        ? `<a href="${listing.url}" target="_blank" rel="noopener" class="card-link card-link-direct" onclick="event.stopPropagation()">🔗 View Listing</a>`
        : '';

    let links = direct;
    links += `<a href="${craigslist}"      target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🟣 Craigslist</a>`;
    links += `<a href="${airbnb}"          target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🔴 Airbnb</a>`;
    links += `<a href="${vrbo}"            target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🔵 Vrbo</a>`;
    links += `<a href="${owner}"           target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🟢 RentByOwner</a>`;
    links += `<a href="${zillow}"          target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🏠 Zillow</a>`;
    links += `<a href="${apartments}"      target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🏢 Apartments.com</a>`;
    links += `<a href="${facebook}"        target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">📘 Facebook</a>`;
    links += `<a href="${furnishedfinder}" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">🛋️ Furnished Finder</a>`;
    return links;"""

if OLD_GETSOURCE in hsrc:
    hsrc = hsrc.replace(OLD_GETSOURCE, NEW_GETSOURCE, 1)
    results.append("j1-housing: getSourceLinks now emits 8-source link bar + listing.url first")
else:
    results.append("j1-housing: WARN getSourceLinks block not found")

# 3e. Card render: include contact_name + contact_phone if present
OLD_CARD_NOTE = """${l.note ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.4rem;">💡 ${l.note}</div>` : ''}
            ${distHtml}"""
NEW_CARD_NOTE = """${l.note ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.4rem;">💡 ${l.note}</div>` : ''}
            ${(l.contact_name || l.contact_phone) ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.4rem;">${l.contact_name?'👤 '+l.contact_name:''}${(l.contact_name && l.contact_phone)?' &middot; ':''}${l.contact_phone?'<a href=\\"tel:'+l.contact_phone.replace(/[^0-9+]/g,'')+'\\" onclick=\\"event.stopPropagation()\\" style=\\"color:var(--accent);text-decoration:none;\\">📞 '+l.contact_phone+'</a>':''}</div>` : ''}
            ${distHtml}"""

if OLD_CARD_NOTE in hsrc:
    hsrc = hsrc.replace(OLD_CARD_NOTE, NEW_CARD_NOTE, 1)
    results.append("j1-housing: contact_name + contact_phone displayed on cards (clickable tel:)")
else:
    results.append("j1-housing: WARN card note block not found")

# 3f. Append new sample listings for the 4 new sources
OLD_END_OF_LISTINGS = "    {id:35,source:\"craigslist\",price:1150,address:\"300 S Tryon St\",city:\"Charlotte, NC\",area:\"Uptown\",beds:1,baths:1,sqft:650,lat:35.222,lng:-80.844,tags:[\"High Rise\",\"Gym\",\"Transit\"],utilities:{internet:false,electric:false},note:\"Near Lynx light rail\"}\n];"
NEW_LISTINGS_BLOCK = "    {id:35,source:\"craigslist\",price:1150,address:\"300 S Tryon St\",city:\"Charlotte, NC\",area:\"Uptown\",beds:1,baths:1,sqft:650,lat:35.222,lng:-80.844,tags:[\"High Rise\",\"Gym\",\"Transit\"],utilities:{internet:false,electric:false},note:\"Near Lynx light rail\"},\n\n    // ===== ZILLOW LISTINGS =====\n    {id:36,source:\"zillow\",price:1495,address:\"1740 N Bayshore Dr Unit A\",city:\"Miami, FL\",area:\"Brickell\",beds:1,baths:1,sqft:780,lat:25.789,lng:-80.187,tags:[\"Furnished\",\"Pool\",\"Gym\"],utilities:{internet:true,electric:false},note:\"In-unit washer/dryer, 12-mo lease\",url:\"https://www.zillow.com/homes/for_rent/Miami,-FL_rb/\",contact_name:\"Maria Lopez\",contact_phone:\"(305) 555-0142\"},\n    {id:37,source:\"zillow\",price:1295,address:\"4920 Roswell Rd NE\",city:\"Atlanta, GA\",area:\"Buckhead\",beds:2,baths:2,sqft:1050,lat:33.872,lng:-84.371,tags:[\"Quiet\",\"Parking\"],utilities:{internet:false,electric:true},note:\"Move-in ready\",url:\"https://www.zillow.com/homes/for_rent/Atlanta,-GA_rb/\",contact_name:\"Atlanta Property Management\",contact_phone:\"(404) 555-0188\"},\n    {id:38,source:\"zillow\",price:1850,address:\"2400 Olympic Blvd\",city:\"Los Angeles, CA\",area:\"Koreatown\",beds:1,baths:1,sqft:680,lat:34.046,lng:-118.295,tags:[\"Walkable\",\"Transit\"],utilities:{internet:true,electric:true},note:\"All utilities included\",url:\"https://www.zillow.com/homes/for_rent/Los-Angeles,-CA_rb/\",contact_name:\"Westside Realty\",contact_phone:\"(213) 555-0167\"},\n    {id:39,source:\"zillow\",price:1395,address:\"800 N Lake Shore Dr\",city:\"Chicago, IL\",area:\"Streeterville\",beds:1,baths:1,sqft:600,lat:41.896,lng:-87.617,tags:[\"Lake View\",\"Doorman\"],utilities:{internet:false,electric:false},note:\"6-month lease available\",url:\"https://www.zillow.com/homes/for_rent/Chicago,-IL_rb/\",contact_name:\"\",contact_phone:\"\"},\n\n    // ===== APARTMENTS.COM LISTINGS =====\n    {id:40,source:\"apartments\",price:1395,address:\"3450 Toringdon Way\",city:\"Charlotte, NC\",area:\"Ballantyne\",beds:2,baths:2,sqft:1100,lat:35.057,lng:-80.847,tags:[\"Pool\",\"Gym\",\"Pet Friendly\"],utilities:{internet:false,electric:false},note:\"6 or 12 month lease\",url:\"https://www.apartments.com/charlotte-nc/\",contact_name:\"Toringdon Leasing\",contact_phone:\"(704) 555-0119\"},\n    {id:41,source:\"apartments\",price:1675,address:\"100 Park Ave Suite 2B\",city:\"Nashville, TN\",area:\"The Gulch\",beds:1,baths:1,sqft:740,lat:36.157,lng:-86.788,tags:[\"Modern\",\"Rooftop\",\"Walkable\"],utilities:{internet:true,electric:false},note:\"Walk to Music Row\",url:\"https://www.apartments.com/nashville-tn/\",contact_name:\"The Gulch Apartments\",contact_phone:\"(615) 555-0173\"},\n    {id:42,source:\"apartments\",price:1295,address:\"880 Mason Way\",city:\"Houston, TX\",area:\"Galleria\",beds:2,baths:2,sqft:1050,lat:29.745,lng:-95.461,tags:[\"Pool\",\"Concierge\"],utilities:{internet:false,electric:true},note:\"Furnished option +$200\",url:\"https://www.apartments.com/houston-tx/\",contact_name:\"Galleria Living\",contact_phone:\"(713) 555-0136\"},\n    {id:43,source:\"apartments\",price:1495,address:\"7600 Sand Lake Rd\",city:\"Orlando, FL\",area:\"International Drive\",beds:1,baths:1,sqft:720,lat:28.448,lng:-81.452,tags:[\"Resort Style\",\"Theme Park Shuttle\"],utilities:{internet:true,electric:true},note:\"Short-term J1 friendly\",url:\"https://www.apartments.com/orlando-fl/\",contact_name:\"Sand Lake Residences\",contact_phone:\"(407) 555-0152\"},\n\n    // ===== FACEBOOK MARKETPLACE LISTINGS =====\n    {id:44,source:\"facebook\",price:875,address:\"412 SW 5th St\",city:\"Miami, FL\",area:\"Little Havana\",beds:1,baths:1,sqft:520,lat:25.766,lng:-80.211,tags:[\"Owner Listed\",\"Furnished\"],utilities:{internet:true,electric:false},note:\"Posted by owner, no fees\",url:\"https://www.facebook.com/marketplace/category/propertyrentals\",contact_name:\"Carlos R.\",contact_phone:\"(786) 555-0124\"},\n    {id:45,source:\"facebook\",price:950,address:\"6500 Lake Worth Rd\",city:\"Orlando, FL\",area:\"Mills 50\",beds:1,baths:1,sqft:550,lat:28.554,lng:-81.346,tags:[\"Quiet Street\",\"Backyard\"],utilities:{internet:false,electric:true},note:\"J1 visa students welcome\",url:\"https://www.facebook.com/marketplace/category/propertyrentals\",contact_name:\"Linda M.\",contact_phone:\"(407) 555-0138\"},\n    {id:46,source:\"facebook\",price:1100,address:\"1810 Yandell Dr\",city:\"El Paso, TX\",area:\"Central\",beds:2,baths:1,sqft:900,lat:31.776,lng:-106.487,tags:[\"Garage\",\"Yard\"],utilities:{internet:false,electric:false},note:\"6-month leases only\",url:\"https://www.facebook.com/marketplace/category/propertyrentals\",contact_name:\"\",contact_phone:\"(915) 555-0109\"},\n    {id:47,source:\"facebook\",price:825,address:\"22 Brighton Pl\",city:\"Fayetteville, NY\",area:\"Manlius\",beds:1,baths:1,sqft:600,lat:43.005,lng:-75.97,tags:[\"Owner Listed\",\"Pet OK\"],utilities:{internet:false,electric:true},note:\"Direct from owner, J1 references OK\",url:\"https://www.facebook.com/marketplace/category/propertyrentals\",contact_name:\"David K.\",contact_phone:\"(315) 555-0177\"},\n\n    // ===== FURNISHED FINDER LISTINGS =====\n    {id:48,source:\"furnishedfinder\",price:1850,address:\"500 N Atlantic Ave\",city:\"Daytona Beach, FL\",area:\"Beachside\",beds:1,baths:1,sqft:700,lat:29.214,lng:-81.005,tags:[\"Fully Furnished\",\"Beach Access\",\"Travel Nurse\"],utilities:{internet:true,electric:true},note:\"Built for travel professionals — all-inclusive\",url:\"https://www.furnishedfinder.com/housing?city=Daytona%20Beach&state=FL\",contact_name:\"Coastal Stays LLC\",contact_phone:\"(386) 555-0148\"},\n    {id:49,source:\"furnishedfinder\",price:2100,address:\"1100 Ash St\",city:\"Denver, CO\",area:\"Cherry Creek\",beds:1,baths:1,sqft:780,lat:39.717,lng:-104.953,tags:[\"Fully Furnished\",\"Walkable\",\"Bills Included\"],utilities:{internet:true,electric:true},note:\"Min 30 nights, ideal for J1\",url:\"https://www.furnishedfinder.com/housing?city=Denver&state=CO\",contact_name:\"Mountain Furnished Rentals\",contact_phone:\"(303) 555-0182\"},\n    {id:50,source:\"furnishedfinder\",price:1650,address:\"400 W Loop 1604 N\",city:\"San Antonio, TX\",area:\"Stone Oak\",beds:1,baths:1,sqft:720,lat:29.605,lng:-98.477,tags:[\"Fully Furnished\",\"Pool\",\"Gym\"],utilities:{internet:true,electric:true},note:\"All bills + WiFi\",url:\"https://www.furnishedfinder.com/housing?city=San%20Antonio&state=TX\",contact_name:\"Stone Oak Stays\",contact_phone:\"(210) 555-0163\"},\n    {id:51,source:\"furnishedfinder\",price:1950,address:\"2500 Wilshire Blvd\",city:\"Los Angeles, CA\",area:\"Koreatown\",beds:1,baths:1,sqft:650,lat:34.062,lng:-118.291,tags:[\"Fully Furnished\",\"Bills Included\"],utilities:{internet:true,electric:true},note:\"30+ night stays\",url:\"https://www.furnishedfinder.com/housing?city=Los%20Angeles&state=CA\",contact_name:\"LA Travel Housing\",contact_phone:\"(213) 555-0194\"}\n];"
if OLD_END_OF_LISTINGS in hsrc:
    hsrc = hsrc.replace(OLD_END_OF_LISTINGS, NEW_LISTINGS_BLOCK, 1)
    results.append("j1-housing: 16 new sample listings (4 per new source) with url + contact info")
else:
    results.append("j1-housing: WARN end-of-listings anchor not found")

write(hp, hsrc)

# ============================================================
# 4. Jarvis tool surface — extend source enum + descriptions
# ============================================================
jp = os.path.join(REPO, 'js', 'poseidon-modules', 'poseidon-jarvis-grok.js')
jsrc = read(jp)

OLD_JARVIS_ENUM = "          source:    { type: 'string',  enum: ['all', 'craigslist', 'airbnb', 'vrbo', 'owner'], description: 'Source tab to activate. \"owner\" = Rent by Owner.' },"
NEW_JARVIS_ENUM = "          source:    { type: 'string',  enum: ['all', 'craigslist', 'airbnb', 'vrbo', 'owner', 'zillow', 'apartments', 'facebook', 'furnishedfinder'], description: 'Source tab to activate. \"owner\" = Rent by Owner. \"apartments\" = Apartments.com. \"facebook\" = Facebook Marketplace. \"furnishedfinder\" = Furnished Finder.' },"
if OLD_JARVIS_ENUM in jsrc:
    jsrc = jsrc.replace(OLD_JARVIS_ENUM, NEW_JARVIS_ENUM, 1)
    results.append("jarvis: set_housing_filters source enum extended to 8 sources")
else:
    results.append("jarvis: WARN source enum not found")

OLD_AVAIL = "            sources: ['all', 'craigslist', 'airbnb', 'vrbo', 'owner'],"
NEW_AVAIL = "            sources: ['all', 'craigslist', 'airbnb', 'vrbo', 'owner', 'zillow', 'apartments', 'facebook', 'furnishedfinder'],"
if OLD_AVAIL in jsrc:
    jsrc = jsrc.replace(OLD_AVAIL, NEW_AVAIL, 1)
    results.append("jarvis: read_housing available_options.sources extended")

# Listing shape — surface url + contact_name + contact_phone
OLD_SHAPE = """        const shape = (l) => ({
          id: l.id, source: l.source, price: l.price, address: l.address,
          city: l.city, area: l.area, beds: l.beds, baths: l.baths,
          sqft: l.sqft, tags: l.tags || [], note: l.note || '',
          internet_included: !!(l.utilities && l.utilities.internet),
          electric_included: !!(l.utilities && l.utilities.electric),
          ...(typeof l.distance === 'number' ? { distance_miles: Math.round(l.distance * 10) / 10 } : {})
        });"""
NEW_SHAPE = """        const shape = (l) => ({
          id: l.id, source: l.source, price: l.price, address: l.address,
          city: l.city, area: l.area, beds: l.beds, baths: l.baths,
          sqft: l.sqft, tags: l.tags || [], note: l.note || '',
          internet_included: !!(l.utilities && l.utilities.internet),
          electric_included: !!(l.utilities && l.utilities.electric),
          url:           l.url || '',
          contact_name:  l.contact_name || '',
          contact_phone: l.contact_phone || '',
          ...(typeof l.distance === 'number' ? { distance_miles: Math.round(l.distance * 10) / 10 } : {})
        });"""
if OLD_SHAPE in jsrc:
    jsrc = jsrc.replace(OLD_SHAPE, NEW_SHAPE, 1)
    results.append("jarvis: read_housing shape now includes url + contact_name + contact_phone")

# select_housing_listing returns same shape — extend it
OLD_SHAPE_2 = """        return {
          ok: true,
          selected: {
            id: listing.id, source: listing.source, price: listing.price,
            address: listing.address, city: listing.city, area: listing.area,
            beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
            tags: listing.tags || [], note: listing.note || '',
            internet_included: !!(listing.utilities && listing.utilities.internet),
            electric_included: !!(listing.utilities && listing.utilities.electric),
            ...(typeof listing.distance === 'number' ? { distance_miles: Math.round(listing.distance * 10) / 10 } : {})
          }
        };"""
NEW_SHAPE_2 = """        return {
          ok: true,
          selected: {
            id: listing.id, source: listing.source, price: listing.price,
            address: listing.address, city: listing.city, area: listing.area,
            beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
            tags: listing.tags || [], note: listing.note || '',
            internet_included: !!(listing.utilities && listing.utilities.internet),
            electric_included: !!(listing.utilities && listing.utilities.electric),
            url:           listing.url || '',
            contact_name:  listing.contact_name || '',
            contact_phone: listing.contact_phone || '',
            ...(typeof listing.distance === 'number' ? { distance_miles: Math.round(listing.distance * 10) / 10 } : {})
          }
        };"""
if OLD_SHAPE_2 in jsrc:
    jsrc = jsrc.replace(OLD_SHAPE_2, NEW_SHAPE_2, 1)
    results.append("jarvis: select_housing_listing shape extended too")

# Update the system-prompt blurb to mention the 8 sources + URL/contact fields
OLD_BLURB = "'J1 HOUSING FINDER \xe2\x80\x94 this is a full sub-application on the j1housing page. It aggregates direct-owner rentals (6/12 month leases) for J-1 visa workers across major US cities, sourced from Craigslist, Airbnb, Vrbo, and Rent-by-Owner listings. Each listing has: city, neighborhood/area, beds, baths, monthly price, square footage, address, source tab, tags, internet/electric inclusion, owner notes, and lat/lng on a map. Filters: city (~100 cities), area (depends on city), bedrooms (Studio/1/2/3/4+), bathrooms (1/2/3+), max price (up to $3000/mo), internet included, electricity included, source tab (All / Craigslist / Airbnb / Vrbo / Rent by Owner), and sort (price asc/desc, most beds, distance to work). There is also a Work Address field that geocodes and computes distance to every listing.',".encode('latin-1').decode('utf-8') if False else None
# use a UTF-8 string directly
OLD_BLURB = "'J1 HOUSING FINDER — this is a full sub-application on the j1housing page. It aggregates direct-owner rentals (6/12 month leases) for J-1 visa workers across major US cities, sourced from Craigslist, Airbnb, Vrbo, and Rent-by-Owner listings. Each listing has: city, neighborhood/area, beds, baths, monthly price, square footage, address, source tab, tags, internet/electric inclusion, owner notes, and lat/lng on a map. Filters: city (~100 cities), area (depends on city), bedrooms (Studio/1/2/3/4+), bathrooms (1/2/3+), max price (up to $3000/mo), internet included, electricity included, source tab (All / Craigslist / Airbnb / Vrbo / Rent by Owner), and sort (price asc/desc, most beds, distance to work). There is also a Work Address field that geocodes and computes distance to every listing.',"
NEW_BLURB = "'J1 HOUSING FINDER — a full sub-application on the j1housing page. Aggregates rentals (6/12 month leases) for J-1 visa workers across major US cities from EIGHT sources: Craigslist, Airbnb, Vrbo, Rent by Owner, Zillow, Apartments.com, Facebook Marketplace, and Furnished Finder. Each listing has: city, neighborhood/area, beds, baths, monthly price, square footage, address, source tab, tags, internet/electric inclusion, notes, lat/lng, an optional direct URL (l.url), and optional contact_name + contact_phone. Filters: city (~100 cities), area (depends on city), bedrooms (Studio/1/2/3/4+), bathrooms (1/2/3+), max price (up to $3000/mo), internet included, electricity included, source tab (the 8 sources above plus All), and sort (price asc/desc, most beds, distance to work). There is also a Work Address field that geocodes and computes distance to every listing.',"
if OLD_BLURB in jsrc:
    jsrc = jsrc.replace(OLD_BLURB, NEW_BLURB, 1)
    results.append("jarvis: system-prompt blurb updated with 8 sources + url/contact fields")
else:
    results.append("jarvis: WARN system-prompt blurb not found verbatim")

write(jp, jsrc)

for r in results:
    print(r.replace('—', '-').replace('·', '|'))
