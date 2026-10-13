/*
 * Deal Stack hub (Cloudflare Pages, advanced mode).
 * Serves the app and a small private API backed by a D1 database.
 *
 * Needs, in the Cloudflare Pages project settings:
 *   - a D1 database binding named DB
 *   - a secret named APP_KEY (the same key you put in the app, GitHub and the add-ons)
 */

const VERSION = '1.0.0';
const MAX_BODY = 1500000;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, domain TEXT, source TEXT, kind TEXT, rank INTEGER DEFAULT 0, data TEXT, first_seen TEXT, last_seen TEXT, expires TEXT, gone INTEGER DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS deals_domain ON deals(domain)`,
  `CREATE TABLE IF NOT EXISTS sightings (deal_id TEXT, source TEXT, last_seen TEXT, PRIMARY KEY (deal_id, source))`,
  `CREATE INDEX IF NOT EXISTS sightings_source ON sightings(source, last_seen)`,
  `CREATE TABLE IF NOT EXISTS tests (id INTEGER PRIMARY KEY AUTOINCREMENT, deal_id TEXT, domain TEXT, code TEXT, ok INTEGER, saved REAL, at TEXT, via TEXT)`,
  `CREATE INDEX IF NOT EXISTS tests_deal ON tests(deal_id)`,
  `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`
];

let schemaReady = false;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-hub-key',
  'access-control-max-age': '86400'
};

function json(obj, status = 200, raw = false) {
  return new Response(raw ? obj : JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, CORS)
  });
}

function fail(message, status = 400) { return json({ ok: false, error: message }, status); }

function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  return diff === 0;
}

async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  schemaReady = true;
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('That upload is too large.');
  try { return JSON.parse(text || '{}'); } catch (e) { throw new Error('The request was not valid JSON.'); }
}

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function cleanDomain(d) { return String(d || '').toLowerCase().replace(/[^a-z0-9.:\-]/g, '').slice(0, 120); }

/* ---------------- API ---------------- */

async function getDeals(env, url) {
  const db = env.DB;
  const domain = cleanDomain(url.searchParams.get('domain'));
  const now = today();
  const since = daysAgo(60);
  const dealSql = 'SELECT id, data, first_seen, last_seen FROM deals WHERE gone = 0 AND (expires IS NULL OR expires >= ?1)' + (domain ? ' AND domain = ?2' : '') + ' LIMIT 6000';
  const dealStmt = domain ? db.prepare(dealSql).bind(now, domain) : db.prepare(dealSql).bind(now);
  const sightSql = domain
    ? 'SELECT s.deal_id, COUNT(*) AS n FROM sightings s JOIN deals d ON d.id = s.deal_id WHERE d.domain = ?1 AND s.last_seen >= ?2 GROUP BY s.deal_id HAVING n > 1'
    : 'SELECT deal_id, COUNT(*) AS n FROM sightings WHERE last_seen >= ?2 GROUP BY deal_id HAVING n > 1';
  const sightStmt = db.prepare(sightSql).bind(domain || '', daysAgo(14));
  const testSql = 'SELECT deal_id, ok, saved, at, via FROM tests WHERE at >= ?1' + (domain ? ' AND domain = ?2' : '') + ' ORDER BY at LIMIT 4000';
  const testStmt = domain ? db.prepare(testSql).bind(since, domain) : db.prepare(testSql).bind(since);
  const kvStmt = db.prepare("SELECT k, v FROM kv WHERE k = 'settings' OR k LIKE 'status:%'");
  const [deals, sight, tests, kv] = await db.batch([dealStmt, sightStmt, testStmt, kvStmt]);

  const sightMap = {};
  for (const r of sight.results || []) sightMap[r.deal_id] = r.n;
  let settings = 'null';
  const status = {};
  for (const r of kv.results || []) {
    if (r.k === 'settings') settings = r.v || 'null';
    else status[r.k.slice(7)] = r.v;
  }
  // Built as text so large lists don't cost much processing time.
  const dealParts = (deals.results || []).map(r => '{"id":' + JSON.stringify(r.id) + ',"fs":' + JSON.stringify(r.first_seen) + ',"ls":' + JSON.stringify(r.last_seen) + ',"d":' + r.data + '}');
  const statusParts = Object.keys(status).map(k => JSON.stringify(k) + ':' + (status[k] || 'null'));
  const body = '{"ok":true,"now":' + JSON.stringify(new Date().toISOString()) +
    ',"deals":[' + dealParts.join(',') + ']' +
    ',"sight":' + JSON.stringify(sightMap) +
    ',"tests":' + JSON.stringify(tests.results || []) +
    ',"settings":' + settings +
    ',"status":{' + statusParts.join(',') + '}}';
  return json(body, 200, true);
}

async function getDomains(env) {
  const res = await env.DB.prepare('SELECT DISTINCT domain FROM deals WHERE gone = 0 AND (expires IS NULL OR expires >= ?1)').bind(today()).all();
  return json({ ok: true, domains: (res.results || []).map(r => r.domain) });
}

async function ingest(env, body) {
  const db = env.DB;
  const source = String(body.source || 'unknown').slice(0, 120);
  const deals = Array.isArray(body.deals) ? body.deals.slice(0, 200) : [];
  const now = new Date().toISOString();
  const stmts = [];
  const upsert = db.prepare(`INSERT INTO deals (id, domain, source, kind, rank, data, first_seen, last_seen, expires, gone)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, 0)
    ON CONFLICT(id) DO UPDATE SET
      data = CASE WHEN excluded.rank >= deals.rank THEN excluded.data ELSE deals.data END,
      source = CASE WHEN excluded.rank >= deals.rank THEN excluded.source ELSE deals.source END,
      kind = CASE WHEN excluded.rank >= deals.rank THEN excluded.kind ELSE deals.kind END,
      rank = MAX(deals.rank, excluded.rank),
      last_seen = excluded.last_seen,
      expires = CASE WHEN excluded.rank >= deals.rank THEN excluded.expires ELSE COALESCE(deals.expires, excluded.expires) END,
      gone = CASE WHEN deals.gone = 2 THEN 2 ELSE 0 END`);
  const sight = db.prepare(`INSERT INTO sightings (deal_id, source, last_seen) VALUES (?1, ?2, ?3)
    ON CONFLICT(deal_id, source) DO UPDATE SET last_seen = excluded.last_seen`);
  let accepted = 0;
  for (const r of deals) {
    if (!r || typeof r.id !== 'string' || !r.data) continue;
    const data = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    if (data.length > 12000) continue;
    const expires = r.expires && /^\d{4}-\d{2}-\d{2}$/.test(r.expires) ? r.expires : null;
    stmts.push(upsert.bind(r.id.slice(0, 300), cleanDomain(r.domain), source, String(r.kind || 'code').slice(0, 20), Number(r.rank) || 0, data, now, expires));
    stmts.push(sight.bind(r.id.slice(0, 300), source, now));
    accepted++;
  }
  let retired = 0;
  if (body.complete && body.runStart) {
    // Deals this source showed before but not on this run have ended, unless
    // another source saw them in the last three days.
    stmts.push(db.prepare(`UPDATE deals SET gone = 1 WHERE gone = 0 AND id IN (
        SELECT deal_id FROM sightings WHERE source = ?1 AND last_seen < ?2)
      AND id NOT IN (SELECT deal_id FROM sightings WHERE source <> ?1 AND last_seen >= ?3)`).bind(source, String(body.runStart), daysAgo(3)));
  }
  if (stmts.length) {
    const results = await db.batch(stmts);
    if (body.complete && body.runStart) retired = (results[results.length - 1].meta && results[results.length - 1].meta.changes) || 0;
  }
  return json({ ok: true, accepted, retired });
}

async function addTests(env, body) {
  const db = env.DB;
  const list = Array.isArray(body.results) ? body.results.slice(0, 50) : [];
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO tests (deal_id, domain, code, ok, saved, at, via) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)');
  const stmts = [];
  for (const t of list) {
    if (!t || !t.dealId) continue;
    stmts.push(stmt.bind(String(t.dealId).slice(0, 300), cleanDomain(t.domain), String(t.code || '').slice(0, 40), t.ok ? 1 : 0, Number(t.saved) || 0, now, String(t.via || 'addon').slice(0, 20)));
  }
  if (stmts.length) await db.batch(stmts);
  return json({ ok: true, saved: stmts.length });
}

async function putKv(env, key, value) {
  const v = JSON.stringify(value);
  if (v.length > 200000) throw new Error('That is too much to save at once.');
  await env.DB.prepare('INSERT INTO kv (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(key, v).run();
}

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/ping') {
    return json({ ok: true, app: 'deal-stack', version: VERSION, db: !!env.DB, key: !!env.APP_KEY });
  }
  if (!env.APP_KEY) return fail('The hub has no APP_KEY yet. Add it in Cloudflare (Settings, Variables and Secrets) and redeploy.', 503);
  if (!env.DB) return fail('The database is not connected. In Cloudflare add a D1 binding named DB and redeploy.', 503);
  const key = request.headers.get('x-hub-key') || '';
  if (!sameKey(key, env.APP_KEY)) return fail('Wrong or missing key.', 401);

  await ensureSchema(env.DB);
  const method = request.method;
  if (path === '/api/deals' && method === 'GET') return getDeals(env, url);
  if (path === '/api/domains' && method === 'GET') return getDomains(env);
  if (path === '/api/ingest' && method === 'POST') return ingest(env, await readBody(request));
  if (path === '/api/tests' && method === 'POST') return addTests(env, await readBody(request));
  if (path === '/api/settings' && method === 'GET') {
    const r = await env.DB.prepare("SELECT v FROM kv WHERE k = 'settings'").first();
    return json('{"ok":true,"settings":' + ((r && r.v) || 'null') + '}', 200, true);
  }
  if (path === '/api/settings' && method === 'PUT') {
    const body = await readBody(request);
    await putKv(env, 'settings', body.settings || {});
    return json({ ok: true });
  }
  if (path === '/api/status' && method === 'POST') {
    const body = await readBody(request);
    const name = String(body.name || 'other').replace(/[^a-z0-9_-]/gi, '').slice(0, 30);
    await putKv(env, 'status:' + name, body.report || {});
    return json({ ok: true });
  }
  if (path === '/api/hide' && method === 'POST') {
    const body = await readBody(request);
    const r = await env.DB.prepare('UPDATE deals SET gone = 2 WHERE id = ?1').bind(String(body.id || '')).run();
    return json({ ok: true, hidden: (r.meta && r.meta.changes) || 0 });
  }
  return fail('Not found.', 404);
}

/* ---------------- Installable add-ons ---------------- */

async function asset(env, request, path) {
  const res = await env.ASSETS.fetch(new Request(new URL(path, request.url).toString()));
  if (!res.ok) throw new Error('Missing file ' + path);
  return res.text();
}

async function handleInstall(request, env, url) {
  const origin = url.origin;
  const engine = await asset(env, request, '/engine.js');
  if (url.pathname === '/install/deal-stack.user.js') {
    const tpl = await asset(env, request, '/addon.js');
    const body = tpl.replace('__HUB_URL__', origin).replace('/*__ENGINE__*/', () => engine);
    return new Response(body, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (url.pathname === '/install/gmail-scanner.gs') {
    const tpl = await asset(env, request, '/gmail.js');
    const body = tpl.replace('__HUB_URL__', origin).replace('/*__ENGINE__*/', () => engine);
    return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname.startsWith('/install/')) return await handleInstall(request, env, url);
      if (/^\/(_worker\.js|collector\.js|workflow\.txt)$/.test(url.pathname)) return new Response('Not found', { status: 404 });
      return env.ASSETS.fetch(request);
    } catch (err) {
      return fail(err && err.message ? err.message : 'Something went wrong.', 500);
    }
  }
};
