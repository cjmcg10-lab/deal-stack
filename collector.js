/*
 * Deal Stack collector. GitHub runs this a few times a day.
 * It reads each store's own homepage and offers page, plus public deal feeds,
 * pulls out coupons and sales, and sends them to your private hub.
 *
 * It follows every site's robots.txt and stops at any site that blocks automated
 * visits. It never tries to get around a block.
 */
'use strict';
const E = require('./engine.js');

const HUB_URL = (process.env.HUB_URL || '').trim().replace(/\/+$/, '');
const HUB_KEY = (process.env.HUB_KEY || '').trim();
const DRY_RUN = !HUB_URL || process.argv.includes('--dry-run');
const UA_TOKEN = 'DealStackBot';
const UA = 'Mozilla/5.0 (compatible; DealStackBot/2.0; personal coupon finder that follows robots.txt)';
const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;
const RUN_START = new Date();

// Public deal feeds. Each must be allowed by the site's robots.txt (checked every run).
const FEEDS = [
  { name: 'Slickdeals Hot Deals', url: 'https://slickdeals.net/forums/external.php?type=rss&forumids=9' }
];

// Known deals pages, read along with whatever the store's own menu links to.
const DEAL_PAGES = {
  'costco.com': ['https://www.costco.com/warehouse-savings.html'],
  'logitech.com': ['https://www.logitech.com/en-us/shop/deals']
};

// How much of each store to read. Your favorite stores get read more deeply.
const DEPTH = {
  normal: { dealPages: 2, landing: 3, terms: 3, products: 25, shopifyPages: 1, steamPages: 2 },
  deep: { dealPages: 5, landing: 8, terms: 6, products: 100, shopifyPages: 4, steamPages: 4 }
};

/* ---------------- Fetching politely ---------------- */

async function fetchText(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': opts.accept || 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.8' },
      redirect: 'follow',
      signal: ctl.signal
    });
    const ct = res.headers.get('content-type') || '';
    let body = '';
    if (/text|html|xml|json|rss/i.test(ct) || !ct) {
      body = await res.text();
      if (body.length > 3000000) body = body.slice(0, 3000000);
    }
    return { status: res.status, body, url: res.url, ct };
  } finally {
    clearTimeout(timer);
  }
}

const robotsCache = new Map();

function parseRobots(txt) {
  // Returns the rule list for our bot (or '*' when there's no group for us).
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!lastWasAgent || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (field === 'allow' || field === 'disallow') cur.rules.push({ allow: field === 'allow', path: value });
    }
  }
  const mine = groups.filter(g => g.agents.some(a => a !== '*' && UA_TOKEN.toLowerCase().startsWith(a)));
  const chosen = mine.length ? mine : groups.filter(g => g.agents.includes('*'));
  return chosen.flatMap(g => g.rules);
}

function ruleMatches(rulePath, path) {
  if (!rulePath) return -1;
  let re = '';
  for (const ch of rulePath) {
    if (ch === '*') re += '.*';
    else if (ch === '$') re += '$';
    else re += ch.replace(/[.+?^{}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re).test(path) ? rulePath.replace(/\*/g, '').length : -1;
}

function robotsAllows(rules, url) {
  const u = new URL(url);
  const path = u.pathname + (u.search || '');
  let best = { len: -1, allow: true };
  for (const r of rules) {
    if (!r.allow && r.path === '') continue; // "Disallow:" with nothing means allow all
    const len = ruleMatches(r.path, path);
    if (len < 0) continue;
    if (len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best.allow;
}

async function allowedByRobots(url) {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    let rules = null;
    try {
      const r = await fetchText(origin + '/robots.txt', { timeout: 10000, accept: 'text/plain,*/*' });
      if (r.status >= 200 && r.status < 300) rules = parseRobots(r.body);
      else if (r.status === 429 || r.status >= 500) rules = 'unavailable';
      else rules = []; // no robots.txt: allowed
    } catch (e) {
      rules = 'unavailable';
    }
    robotsCache.set(origin, rules);
  }
  const rules = robotsCache.get(origin);
  if (rules === 'unavailable') return { ok: false, why: "couldn't read robots.txt" };
  return robotsAllows(rules, url) ? { ok: true } : { ok: false, why: 'robots.txt asks bots not to read this page' };
}

function looksBlocked(res) {
  if ([401, 403, 429, 503].includes(res.status)) return 'the site blocked automated visits (' + res.status + ')';
  const head = res.body.slice(0, 20000);
  if (/captcha|px-captcha|cf-chl|challenge-platform|access denied|pardon our interruption|are you a robot|verify you are (a )?human|request unsuccessful|bot detection|perimeterx|datadome/i.test(head)) return 'the site showed a bot check';
  return null;
}

async function politeGet(url) {
  const rb = await allowedByRobots(url);
  if (!rb.ok) return { skipped: rb.why };
  const res = await fetchText(url);
  if (res.status >= 400 && res.status !== 404) {
    const why = looksBlocked(res) || 'error ' + res.status;
    return { skipped: why };
  }
  if (res.status === 404) return { skipped: 'page not found' };
  const blocked = looksBlocked(res);
  if (blocked) return { skipped: blocked };
  return { res };
}

/* ---------------- Stores ---------------- */

function sameSite(href, domain) {
  try {
    const key = E.storeKey(new URL(href).hostname);
    return key === domain;
  } catch (e) { return false; }
}

function findOffersLink(html, baseUrl, domain) {
  const page = E.readPage(html, { url: baseUrl, domain });
  return page.deals.length ? page.deals[0].url : null;
}

function samePage(a, b) {
  try { const x = new URL(a), y = new URL(b); return x.host === y.host && x.pathname.replace(/\/+$/, '') === y.pathname.replace(/\/+$/, ''); } catch (e) { return false; }
}

// Shopify stores publish their price list at /products.json; on-sale items have a compare-at price.
async function shopifyProducts(origin, b, depth, report) {
  const out = [];
  for (let page = 1; page <= depth.shopifyPages; page++) {
    const url = origin + '/products.json?limit=250&page=' + page;
    let got;
    try { got = await politeGet(url); } catch (e) { report.pages.push({ u: url, ok: false, n: 'could not connect' }); break; }
    if (got.skipped) { report.pages.push({ u: url, ok: false, n: got.skipped }); break; }
    let data;
    try { data = JSON.parse(got.res.body); } catch (e) { report.pages.push({ u: url, ok: false, n: 'not a price list' }); break; }
    const list = (data && data.products) || [];
    let n = 0;
    for (const pr of list) {
      let best = null;
      for (const v of pr.variants || []) {
        const price = parseFloat(v.price), was = parseFloat(v.compare_at_price);
        if (!(price > 0 && was > price)) continue;
        const pct = 1 - price / was;
        if (!best || pct > best.pct || (pct === best.pct && v.available && !best.available)) best = { price, was, pct, available: v.available !== false };
      }
      if (!best) continue;
      n++;
      out.push({
        name: E.clean(pr.title).slice(0, 160), url: origin + '/products/' + pr.handle, price: best.price, was: best.was,
        pct: Math.round(best.pct * 100), img: pr.images && pr.images[0] ? pr.images[0].src : null,
        stock: best.available ? null : 'out', section: pr.product_type || null, text: ''
      });
    }
    report.pages.push({ u: url, ok: true, n: n + ' on sale of ' + list.length });
    if (list.length < 250) break;
  }
  return out;
}

// Steam publishes its specials: each game's name, prices and when the sale ends.
async function steamProducts(depth, report) {
  const out = [];
  const seen = {};
  try {
    const got = await politeGet('https://store.steampowered.com/api/featuredcategories?cc=us&l=english');
    if (got.res) {
      const d = JSON.parse(got.res.body);
      for (const it of ((d.specials && d.specials.items) || [])) {
        if (!(it.discount_percent > 0) || !it.original_price) continue;
        seen[it.id] = 1;
        out.push({
          name: it.name, url: 'https://store.steampowered.com/' + (it.type === 1 ? 'sub/' : 'app/') + it.id + '/',
          price: it.final_price / 100, was: it.original_price / 100, pct: it.discount_percent,
          img: it.header_image || it.large_capsule_image || null, section: 'Games',
          expires: it.discount_expiration ? E.isoDay(new Date(it.discount_expiration * 1000)) : null, text: ''
        });
      }
      report.pages.push({ u: 'store.steampowered.com/api/featuredcategories', ok: true, n: out.length + ' specials' });
    }
  } catch (e) { report.pages.push({ u: 'store.steampowered.com/api/featuredcategories', ok: false, n: 'could not read' }); }
  for (let page = 0; page < depth.steamPages; page++) {
    const url = 'https://store.steampowered.com/search/results/?specials=1&infinite=1&count=50&start=' + page * 50 + '&cc=us&l=english';
    try {
      const got = await politeGet(url);
      if (!got.res) { report.pages.push({ u: url, ok: false, n: got.skipped }); break; }
      const html = JSON.parse(got.res.body).results_html || '';
      const re = /<a href="(https:\/\/store\.steampowered\.com\/(app|sub|bundle)\/(\d+)[^"]*)"[\s\S]*?<img src="([^"]+)"[\s\S]*?<span class="title">([^<]+)<\/span>[\s\S]*?data-discount="(\d+)"[\s\S]*?discount_original_price">([^<]+)<[\s\S]*?discount_final_price">([^<]+)</g;
      let m, n = 0;
      while ((m = re.exec(html)) !== null) {
        if (seen[m[3]]) continue;
        seen[m[3]] = 1;
        const was = parseFloat(m[7].replace(/[^0-9.]/g, '')), price = parseFloat(m[8].replace(/[^0-9.]/g, ''));
        if (!(was > price && price >= 0)) continue;
        n++;
        out.push({ name: E.decodeEntities(m[5]).trim(), url: m[1].split('?')[0], price, was, pct: parseInt(m[6], 10), img: m[4], section: 'Games', text: '' });
      }
      report.pages.push({ u: url, ok: true, n: n + ' games on sale' });
    } catch (e) { report.pages.push({ u: url, ok: false, n: 'could not read' }); break; }
  }
  return out;
}

// One store: its homepage, its deals pages, the pages its promotions link to and their
// terms. Every deal keeps what it applies to, its fine print and the page it came from.
async function collectStore(b, opts = {}) {
  const depth = opts.deep ? DEPTH.deep : DEPTH.normal;
  const report = { name: b.name, domain: b.domain, ok: false, items: 0, note: '', pages: [] };
  const roots = new Map();
  const offers = [];
  let products = [];
  let budgetLanding = depth.landing;
  let budgetTerms = depth.terms;
  const info = (url, label) => ({ domain: b.domain, brand: b.name, url, cat: b.cat, pageLabel: label || null });

  async function read(url, label) {
    let got;
    try { got = await politeGet(url); } catch (e) { report.pages.push({ u: url, ok: false, n: e.name === 'AbortError' ? 'timed out' : 'could not connect' }); return null; }
    if (got.skipped) { report.pages.push({ u: url, ok: false, n: got.skipped }); return null; }
    const pageUrl = got.res.url || url;
    const page = E.readPage(got.res.body, { url: pageUrl, domain: b.domain });
    roots.set(pageUrl.split('#')[0], page.root);
    page.url = pageUrl;
    page.label = label;
    page.html = got.res.body;
    report.pages.push({ u: pageUrl, ok: true, n: page.offers.length + ' promotions, ' + page.products.length + ' products' });
    return page;
  }

  if (b.domain === 'steampowered.com') {
    products = await steamProducts(depth, report);
    report.ok = products.length > 0;
  } else {
    const home = await read(b.url, null);
    const pages = [];
    if (home) {
      pages.push(home);
      if (/cdn\.shopify\.com|Shopify\.theme|shopify-section/.test(home.html.slice(0, 400000))) {
        products = products.concat(await shopifyProducts(new URL(home.url).origin, b, depth, report));
      }
      const dealUrls = (DEAL_PAGES[b.domain] || []).map(u => ({ url: u, label: null }))
        .concat(home.deals.map(d => ({ url: d.url, label: /^(sale|deals?|offers|coupons?|clearance|promotions?|specials|outlet|savings)$/i.test(d.label) ? null : d.label })));
      const seen = new Set([home.url.split('#')[0]]);
      let n = 0;
      for (const d of dealUrls) {
        if (n >= depth.dealPages) break;
        if (seen.has(d.url) || [...seen].some(u => samePage(u, d.url))) continue;
        seen.add(d.url);
        n++;
        const pg = await read(d.url, d.label);
        if (pg) pages.push(pg);
      }
    }
    for (const pg of pages) {
      for (const o of pg.offers) { o.page = pg; offers.push(o); }
      for (const pr of pg.products) { pr.section = pr.section || pg.label || null; products.push(pr); }
    }
    // Pages the promotions point at: what's actually included, and a clearer name.
    const fetched = new Set(pages.map(p => p.url.split('#')[0]));
    const byLanding = new Map();
    for (const o of offers) {
      if (!o.landing || o.product) continue;
      let key = o.landing.split('#')[0];
      try { const u = new URL(key); key = u.origin + u.pathname; } catch (e) { }
      if (!byLanding.has(key)) byLanding.set(key, []);
      byLanding.get(key).push(o);
    }
    for (const [url, list] of byLanding) {
      let page = pages.find(p => samePage(p.url, url));
      if (!page) {
        if (budgetLanding <= 0 || fetched.has(url) || !sameSite(url, b.domain)) continue;
        budgetLanding--;
        fetched.add(url);
        page = await read(url, null);
        if (!page) continue;
        for (const pr of page.products) products.push(Object.assign({ section: null }, pr));
      }
      const items = page.products.filter(p => p.stock !== 'out').sort((a, c) => c.pct - a.pct).slice(0, 8);
      const title = page.h1 && page.h1.length < 70 ? page.h1 : null;
      for (const o of list) {
        if (page === o.page) continue;
        o.items = items;
        o.landingTitle = title;
        items.forEach(it => { if (!it.section && title) it.section = title; });
      }
    }
    // Fine print that lives on another page or further down this one.
    const termsCache = new Map();
    for (const o of offers) {
      if (!o.termsUrls || !o.termsUrls.length) continue;
      const turl = o.termsUrls[0];
      const keys = [o.code, ...(o.tiers || []).map(t => '$' + t.amt), (/\d{1,2}\s?%/.exec(o.line) || [])[0], (/\$\s?\d+/.exec(o.line) || [])[0]].filter(Boolean);
      const base = turl.split('#')[0];
      let root = roots.get(base) || [...roots.entries()].find(([u]) => samePage(u, base))?.[1];
      if (!root && !termsCache.has(base)) {
        if (budgetTerms <= 0 || !sameSite(turl, b.domain)) continue;
        budgetTerms--;
        try {
          const got = await politeGet(base);
          if (got.res) { root = E.parseHTML(got.res.body); report.pages.push({ u: base, ok: true, n: 'terms page' }); }
          else report.pages.push({ u: base, ok: false, n: got.skipped });
        } catch (e) { report.pages.push({ u: base, ok: false, n: 'could not connect' }); }
        termsCache.set(base, root || null);
      }
      root = root || termsCache.get(base);
      if (!root) continue;
      const text = E.termsFromPage(root, turl, keys);
      if (text) { o.termsText = text; o.termsSource = turl; }
    }
    report.ok = pages.length > 0;
  }

  // Turn everything into records, keeping only complete deals.
  const records = [];
  const dropped = [];
  const byPage = new Map();
  for (const o of offers) {
    if (!byPage.has(o.page)) byPage.set(o.page, []);
    byPage.get(o.page).push(o);
  }
  for (const [pg, list] of byPage) {
    const r = E.recordsFromPage({ offers: list, products: [] }, info(pg.url, pg.label), RUN_START);
    records.push(...r.records);
    dropped.push(...r.dropped);
  }
  // The same promotion often shows on several pages; keep the copy with the most detail.
  const bySig = new Map();
  for (const r of records.splice(0)) {
    const d = r.data;
    const pv = E.parseTerms(d.title, '', {});
    const sig = d.code ? 'C|' + d.code : (pv.headline || d.title) + '|' + (d.scope ? d.scope.type + ':' + (d.scope.label || '').toLowerCase() : '');
    const prev = bySig.get(sig);
    const score = x => x.data.terms.length + (x.data.scope && x.data.scope.items ? 300 : 0) + (x.data.headline ? 50 : 0);
    if (!prev || score(r) > score(prev)) bySig.set(sig, r);
  }
  // The same banner can read as "Workspace upgrades" on one page and, with its fine print
  // ("applied at the order level"), as the whole order on another. Keep the version backed
  // by the fine print.
  const kept = [...bySig.values()];
  const wholeByTitle = new Map();
  for (const r of kept) if (!r.data.code && r.data.scope && r.data.scope.type === 'order' && r.data.terms.length > 200) wholeByTitle.set(E.normName(r.data.title), r);
  records.push(...kept.filter(r => r.data.code || !(r.data.scope && r.data.scope.type === 'category') || !wholeByTitle.has(E.normName(r.data.title))));
  // Products: the biggest real discounts first, in stock first, one copy each.
  const seenP = new Set();
  products = products.filter(p => p && p.url && p.name && p.was > p.price && p.pct >= 5 && p.pct <= 85)
    .sort((a, c) => (a.stock === 'out') - (c.stock === 'out') || c.pct - a.pct)
    .filter(p => { const k = p.url.split('?')[0].split('#')[0]; if (seenP.has(k)) return false; seenP.add(k); return true; })
    .slice(0, b.domain === 'steampowered.com' ? depth.products * 3 : depth.products);
  for (const pr of products) records.push(E.productRecord(pr, info(pr.url, pr.section), RUN_START));

  const unique = dedupe(records).filter(r => E.isComplete(r));
  const nOffers = unique.filter(r => r.kind !== 'product').length;
  report.items = unique.length;
  report.note = report.ok ? (unique.length ? nOffers + ' promotions and codes, ' + (unique.length - nOffers) + ' products on sale' : 'no deals on the pages it could read') + (dropped.length ? '; left out ' + dropped.length + ' unclear' : '') : ((report.pages[0] && report.pages[0].n) || 'not reached');
  report.pages = report.pages.slice(0, 14).map(p => ({ u: p.u.slice(0, 160), ok: p.ok, n: p.n }));
  return { report, records: unique, complete: report.ok };
}

function dedupe(records) {
  const map = new Map();
  for (const r of records) {
    const prev = map.get(r.id);
    if (!prev || (r.data.terms.length + (r.data.scope && r.data.scope.items ? 200 : 0)) > (prev.data.terms.length + (prev.data.scope && prev.data.scope.items ? 200 : 0))) map.set(r.id, r);
  }
  return [...map.values()];
}

/* ---------------- Deal feeds ---------------- */

function rssItems(xml) {
  const items = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  const pick = (block, tag) => {
    const mm = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i').exec(block);
    if (!mm) return '';
    return mm[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
  };
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    items.push({
      title: E.clean(E.decodeEntities(pick(block, 'title'))),
      link: E.clean(E.decodeEntities(pick(block, 'link'))),
      description: pick(block, 'description'),
      content: pick(block, 'content:encoded'),
      pubDate: E.clean(pick(block, 'pubDate'))
    });
  }
  return items;
}

function parseFeedDate(s) {
  if (!s) return null;
  // Some feeds write two-digit years ("Sun, 12 Apr 26 17:24:19 +0000").
  const fixed = s.replace(/(\d{1,2} [A-Za-z]{3}) (\d{2}) (\d{2}:)/, '$1 20$2 $3');
  const d = new Date(fixed);
  return isNaN(d) ? null : d;
}

const NOT_STORES = /slickdeals|slickdealscdn|imgur|youtube|google|facebook|twitter|instagram|reddit|bit\.ly|amzn\.to/i;

// Where a forum deal is sold: a [store.com] tag or a link in the post, else the title.
function storeFromPost(title, text, html) {
  const found = [];
  const re1 = /\[([a-z0-9][a-z0-9.-]*\.(?:com|net|us|co|org))\]/gi;
  let m;
  while ((m = re1.exec(text)) !== null) found.push(m[1]);
  const re2 = /https?:\/\/(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(\/[^\s"'<>]*)?/gi;
  const src = (html || '') + ' ' + text;
  while ((m = re2.exec(src)) !== null) {
    if (/slickdeals\.net\/click/i.test(m[0])) {
      const ln = /[?&](?:ln|u2)=([^&"'\s]+)/i.exec(m[0]);
      if (ln) { try { found.push(new URL(decodeURIComponent(ln[1])).hostname); } catch (e) { } }
      continue;
    }
    found.push(m[1]);
  }
  for (const host of found) {
    if (NOT_STORES.test(host)) continue;
    const key = E.storeKey(host);
    const b = E.BY_DOMAIN_LOOKUP(key);
    if (b) return { domain: b.domain, brand: b.name, cat: b.cat, url: b.url };
  }
  const t = storeFromTitle(title);
  if (t) return t;
  for (const host of found) {
    if (NOT_STORES.test(host)) continue;
    const key = E.storeKey(host);
    if (/\.(com|net|us|co)$/.test(key)) return { domain: key, brand: key, url: 'https://' + key };
  }
  return null;
}

const STORE_FIRST = /^(costco|walmart|target|amazon|best buy|home depot|lowe'?s|kohl'?s|macy'?s|sam'?s club|bj'?s|woot|ebay|newegg|staples|office depot|dell|hp|lenovo|samsung|apple|nike|adidas)\b/i;

function storeFromTitle(title) {
  // "Sony WH-1000XM5 $248 at Best Buy", "Costco Wholesale: Upcoming savings", "Amazon: Echo Dot $20"
  const patterns = [
    /(?:^|\s)(?:at|@|from|via)\s+([A-Z][\w&'.\- ]{1,40}?)(?:\s*(?:\(|\+|w\/|with|after|for|\||-\s|–|—|$))/,
    /^([A-Z][\w&'.\- ]{1,30}?):\s/,
    /(?:^|\s)(?:at|@)\s+([A-Za-z][\w&'.\-]{1,30})\s*$/
  ];
  for (const re of patterns) {
    const m = re.exec(title);
    if (m) {
      const name = E.clean(m[1]).replace(/\.$/, '');
      const b = E.brandByName(name);
      if (b) return { domain: b.domain, brand: b.name, cat: b.cat, url: b.url };
      if (/^[A-Z]/.test(name) && name.split(' ').length <= 4 && !/\d/.test(name)) return { name };
    }
  }
  const first = STORE_FIRST.exec(title.replace(/^\[[^\]]*\]\s*/, ''));
  if (first) {
    const b = E.brandByName(first[1]);
    if (b) return { domain: b.domain, brand: b.name, cat: b.cat, url: b.url };
  }
  return null;
}

// "Sony WH-1000XM5 Headphones $248 at Best Buy" → "Sony WH-1000XM5 Headphones"
function itemName(title, brand) {
  let t = String(title || '').replace(/\[[^\]]*\]\s*/g, '').replace(/^\s*[A-Z][\w&'. ]{1,25}:\s+/, '');
  t = t.replace(/\s*(?:\+|&)\s*free (?:shipping|s\/h|store pickup).*$/i, '')
    .replace(/\s*(?:w\/|with)\s*(?:promo\s*)?code\s+\S+.*$/i, '')
    .replace(/\s+(?:at|@|from|via)\s+[A-Z][\w&'.\- ]{1,30}$/, '')
    .replace(/\s*@\s*[\w&'.\-]+\s*$/, '')
    .replace(/\s*\$\s?\d[\d,]*(?:\.\d{2})?\s*(?:AC|after coupon|after code|shipped|each|\/ea)?\b.*$/i, '')
    .replace(/\s*[-–:|]\s*$/, '').trim();
  return t.length >= 4 ? t.slice(0, 160) : null;
}

function thumbImg(html) {
  const m = /<img[^>]+src="([^"]+)"/i.exec(html || '');
  return m ? m[1] : null;
}

async function collectFeed(feed) {
  const report = { name: feed.name, ok: false, items: 0, note: '' };
  const records = [];
  let got;
  try { got = await politeGet(feed.url); } catch (e) { report.note = 'could not connect'; return { report, records, complete: false }; }
  if (got.skipped) { report.note = got.skipped; return { report, records, complete: false }; }
  const items = rssItems(got.res.body);
  for (const it of items.slice(0, 80)) {
    if (!it.title) continue;
    const contentText = E.clean(E.htmlToText(it.content || '').replace(/\n/g, ' '));
    const descText = E.clean(E.htmlToText(E.decodeEntities(it.description)).replace(/\n/g, ' ')).slice(0, 900);
    const store = storeFromPost(it.title, descText + ' ' + contentText, it.content || '');
    const thumbs = /Thumb Score:\s*([+-]?\d+)/i.exec(contentText);
    const code = E.extractCodes(it.title + ' ' + descText)[0] || null;
    const posted = parseFeedDate(it.pubDate) || RUN_START;
    const priceM = /(?<!(?:off|over|spend|orders?|purchases?)\s{0,2})\$\s?(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)(?![\d,.]|\s*(?:off|back|credit|gift|reward|cash|wm cash|\+\s*orders?))/i.exec(it.title.replace(/\[[^\]]*\]/g, ''));
    let domain = 'deal:other', brand = 'Other stores';
    if (store && store.domain) { domain = store.domain; brand = store.brand; }
    else if (store && store.name) { domain = 'deal:' + E.normName(store.name); brand = store.name; }
    const productCat = E.classify(it.title + ' ' + descText, null);
    const price = priceM ? parseFloat(priceM[1].replace(/,/g, '')) : null;
    const item = itemName(it.title, brand);
    const wasM = /(?:list(?:\s+price)?|reg(?:ular)?(?:\s+price)?|was|normally|retail|msrp|originally|compare at)[:\s]*\$\s?(\d[\d,]*(?:\.\d{2})?)/i.exec(descText);
    const before = /on sale for\s*\$\s?(\d[\d,]*(?:\.\d{2})?)/i.exec(descText);
    let was = wasM ? parseFloat(wasM[1].replace(/,/g, '')) : null;
    if (!(was > price)) was = null;
    const base = {
      domain, brand, title: it.title, terms: descText, url: it.link,
      cat: productCat !== 'general' ? productCat : (store && store.cat) || 'general', sourceType: 'community',
      sourceName: 'Slickdeals', sourceUrl: it.link, posted: posted.toISOString(), price,
      votes: thumbs ? parseInt(thumbs[1], 10) : null
    };
    if (code) {
      const pre = before ? parseFloat(before[1].replace(/,/g, '')) : null;
      records.push(E.makeRecord(Object.assign(base, {
        kind: 'code', code, scope: { type: 'product', label: item + (price ? ' (' + E.money(price) + ' after the code' + (pre && pre > price ? ', ' + E.money(pre) + ' before' : '') + ')' : '') }
      }), RUN_START));
    } else if (price && item) {
      records.push(E.makeRecord(Object.assign(base, {
        kind: 'product', title: item, product: { name: item, price, was, img: thumbImg(it.content), pct: was ? Math.round((1 - price / was) * 100) : null }
      }), RUN_START));
    }
  }
  report.ok = true;
  report.items = records.length;
  report.note = items.length ? 'found ' + records.length : 'feed was empty';
  return { report, records, complete: false };
}

/* ---------------- Sending to the hub ---------------- */

async function post(path, body) {
  if (DRY_RUN) return { ok: true, dry: true };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(HUB_URL + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-key': HUB_KEY },
        body: JSON.stringify(body)
      });
      const txt = await res.text();
      if (res.ok) return JSON.parse(txt || '{}');
      if (res.status === 401) throw new Error('The hub rejected the key. Check that the HUB_KEY secret matches APP_KEY in Cloudflare.');
      if (res.status < 500) throw new Error('Hub said ' + res.status + ': ' + txt.slice(0, 200));
    } catch (e) {
      if (/rejected the key|Hub said/.test(e.message) || attempt === 2) throw e;
    }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

async function send(source, records, complete) {
  if (!records.length) {
    if (complete) await post('/api/ingest', { source, complete: true, runStart: RUN_START.toISOString(), deals: [] });
    return;
  }
  for (let i = 0; i < records.length; i += 80) {
    const last = i + 80 >= records.length;
    await post('/api/ingest', { source, complete: complete && last, runStart: RUN_START.toISOString(), deals: records.slice(i, i + 80) });
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i], i); } catch (e) { out[i] = { error: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

// Confirms the hub address and key before spending minutes collecting.
async function checkHub() {
  let host;
  try { host = new URL(HUB_URL).host; } catch (e) {
    throw new Error('HUB_URL is not a web address. It should look like https://deal-stack.yourname.workers.dev');
  }
  let res;
  try { res = await fetch(HUB_URL + '/api/ping'); } catch (e) {
    throw new Error('Could not connect to ' + host + ' (' + ((e.cause && e.cause.code) || e.message) + '). Check the HUB_URL secret.');
  }
  const text = await res.text();
  let ping = null;
  try { ping = JSON.parse(text); } catch (e) { }
  if (!ping || ping.app !== 'deal-stack') {
    throw new Error(host + ' answered (HTTP ' + res.status + ') but it is not your Deal Stack hub. It sent: ' + text.slice(0, 80).replace(/\s+/g, ' ') + ' ... Check the HUB_URL secret.');
  }
  if (!ping.db) throw new Error('Your hub at ' + host + ' is up but its database is not connected.');
  if (!ping.key) throw new Error('Your hub at ' + host + ' has no APP_KEY secret.');
  const auth = await fetch(HUB_URL + '/api/domains', { headers: { 'x-hub-key': HUB_KEY } });
  if (auth.status === 401) throw new Error('Your hub at ' + host + ' rejected the key. Make HUB_KEY on GitHub match APP_KEY on Cloudflare exactly.');
  console.log('Connected to your hub at ' + host + '.');
}

async function main() {
  if (DRY_RUN) console.log('Dry run: nothing will be sent (HUB_URL not set or --dry-run).');
  else await checkHub();
  const only = process.argv.find(a => a.startsWith('--only='));
  let settings = {};
  if (!DRY_RUN) {
    try {
      const r = await fetch(HUB_URL + '/api/settings', { headers: { 'x-hub-key': HUB_KEY } });
      const j = await r.json();
      settings = (j && j.settings) || {};
    } catch (e) { }
  }
  const favs = new Set(settings.favorites || []);
  const hidden = new Set(settings.hidden || []);
  let stores = E.BRANDS.filter(b => !b.pseudo && b.url && !hidden.has(b.domain));
  for (const x of settings.extraStores || []) {
    const domain = E.storeKey(x.domain || '');
    if (!domain || stores.some(b => b.domain === domain)) continue;
    stores.push({ name: x.name || domain, domain, cat: x.cat || 'general', mcc: 'online', url: 'https://' + (x.host || ('www.' + domain)) + '/', aliases: [] });
  }
  if (only) { const list = only.slice(7).split(','); stores = stores.filter(b => list.includes(b.domain)); }
  // Favorites first, so they always finish.
  stores.sort((a, c) => (favs.has(c.domain) ? 1 : 0) - (favs.has(a.domain) ? 1 : 0));

  const reports = [];
  let total = 0;
  const storeResults = await pool(stores, CONCURRENCY, async (b) => {
    const r = await collectStore(b, { deep: favs.has(b.domain) });
    await send('store:' + b.domain, r.records, r.complete);
    console.log(`${r.report.ok ? 'ok  ' : 'skip'} ${b.name.padEnd(28)} ${r.report.note}`);
    return r;
  });
  for (const r of storeResults) {
    if (!r || r.error) { reports.push({ name: '?', ok: false, items: 0, note: r && r.error ? r.error.message : 'failed' }); continue; }
    reports.push(r.report); total += r.records.length;
  }
  for (const f of FEEDS) {
    const r = await collectFeed(f);
    await send('feed:' + f.name, r.records, false);
    console.log(`${r.report.ok ? 'ok  ' : 'skip'} ${f.name.padEnd(28)} ${r.report.note}`);
    reports.push(r.report); total += r.records.length;
  }
  const reached = reports.filter(r => r.ok).length;
  const summary = { runAt: RUN_START.toISOString(), finishedAt: new Date().toISOString(), deals: total, sources: reports.length, reached, version: E.VERSION, details: reports };
  await post('/api/status', { name: 'collector', report: summary });
  console.log(`\nDone: ${total} deals from ${reached} of ${reports.length} sources.`);
  try {
    const n = await post('/api/notify', { from: 'collector' });
    if (n && n.sent) console.log('Sent ' + n.sent + ' alert' + (n.sent === 1 ? '' : 's') + ' to your phone.');
  } catch (e) { console.log('Alerts not sent: ' + e.message); }
  if (DRY_RUN && process.argv.includes('--print')) console.log(JSON.stringify(storeResults.flatMap(r => (r && r.records) || []).slice(0, 20), null, 2));
}

if (require.main === module) {
  main().catch(err => { console.error('Collector failed: ' + err.message); process.exit(1); });
}

module.exports = { parseRobots, robotsAllows, rssItems, storeFromTitle, storeFromPost, parseFeedDate, findOffersLink, looksBlocked, collectStore, collectFeed, FEEDS };
