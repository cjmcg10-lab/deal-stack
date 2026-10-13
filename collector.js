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
const UA = 'Mozilla/5.0 (compatible; DealStackBot/1.0; personal coupon finder that follows robots.txt)';
const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;
const RUN_START = new Date();

// Public deal feeds. Each must be allowed by the site's robots.txt (checked every run).
const FEEDS = [
  { name: 'Slickdeals Hot Deals', url: 'https://slickdeals.net/forums/external.php?type=rss&forumids=9' }
];

// Extra offers pages for stores whose deals are not on the homepage.
const OFFER_PAGES = {
  'costco.com': ['https://www.costco.com/warehouse-savings.html']
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
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const label = E.clean(m[2].replace(/<[^>]+>/g, ' '));
    let href;
    try { href = new URL(E.decodeEntities(m[1]), baseUrl).toString(); } catch (e) { continue; }
    if (!sameSite(href, domain)) continue;
    if (/\b(coupons?|offers|promotions?|deals of the|current deals|weekly deals|all deals|promo codes?)\b/i.test(label) ||
        /\/(coupons?|offers|promotions?|deals)(\/|$|\?|\.)/i.test(new URL(href).pathname)) {
      return href;
    }
  }
  return null;
}

async function collectStore(b) {
  const report = { name: b.name, domain: b.domain, ok: false, items: 0, note: '' };
  const records = [];
  const pages = [b.url].concat(OFFER_PAGES[b.domain] || []);
  let fetchedAny = false;
  const notes = [];
  let discovered = null;
  for (let i = 0; i < pages.length + 1; i++) {
    const url = i < pages.length ? pages[i] : discovered;
    if (!url) continue;
    if (i === pages.length && pages.includes(url)) continue;
    let got;
    try { got = await politeGet(url); } catch (e) { notes.push(e.name === 'AbortError' ? 'timed out' : 'could not connect'); continue; }
    if (got.skipped) { notes.push(got.skipped); continue; }
    fetchedAny = true;
    const html = got.res.body;
    if (i === 0) discovered = findOffersLink(html, got.res.url || url, b.domain);
    const text = E.htmlToText(html);
    const pageUrl = got.res.url || url;
    if (b.domain === 'costco.com' && /savings/i.test(pageUrl)) {
      for (const it of E.parseCostcoText(text, RUN_START).slice(0, 80)) {
        records.push(E.makeRecord({ domain: 'costco.com', kind: 'sale', title: it.item + ': ' + E.money(it.amt) + ' off', terms: it.raw, url: pageUrl, sourceType: 'costco', sourceName: 'Costco member savings', expires: it.expires }, RUN_START));
      }
      continue;
    }
    for (const o of E.extractOffersFromText(text, { refDate: RUN_START, max: 6 })) {
      records.push(E.makeRecord({ domain: b.domain, brand: b.name, kind: o.code ? 'code' : 'sale', title: o.title, code: o.code, terms: o.terms, url: pageUrl, cat: b.cat, sourceType: 'official', sourceName: b.name + ' website', item: o.item }, RUN_START));
    }
  }
  const unique = dedupe(records);
  report.ok = fetchedAny;
  report.items = unique.length;
  report.note = fetchedAny ? (unique.length ? 'found ' + unique.length : 'no coupons on the page right now') + (notes.length ? '; ' + notes[0] : '') : (notes[0] || 'not reached');
  return { report, records: unique, complete: fetchedAny };
}

function dedupe(records) {
  const map = new Map();
  for (const r of records) if (!map.has(r.id)) map.set(r.id, r);
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
    records.push(E.makeRecord({
      domain, brand, kind: code ? 'code' : 'sale', title: it.title, code, terms: descText, url: it.link,
      cat: productCat !== 'general' ? productCat : (store && store.cat) || 'general', sourceType: 'community',
      sourceName: 'Slickdeals', sourceUrl: it.link, posted: posted.toISOString(), price: priceM ? parseFloat(priceM[1].replace(/,/g, '')) : null,
      votes: thumbs ? parseInt(thumbs[1], 10) : null
    }, RUN_START));
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
  let stores = E.BRANDS.filter(b => !b.pseudo && b.url);
  if (only) { const list = only.slice(7).split(','); stores = stores.filter(b => list.includes(b.domain)); }

  const reports = [];
  let total = 0;
  const storeResults = await pool(stores, CONCURRENCY, async (b) => {
    const r = await collectStore(b);
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
  if (DRY_RUN && process.argv.includes('--print')) console.log(JSON.stringify(storeResults.flatMap(r => (r && r.records) || []).slice(0, 20), null, 2));
}

if (require.main === module) {
  main().catch(err => { console.error('Collector failed: ' + err.message); process.exit(1); });
}

module.exports = { parseRobots, robotsAllows, rssItems, storeFromTitle, storeFromPost, parseFeedDate, findOffersLink, looksBlocked, collectStore, collectFeed, FEEDS };
