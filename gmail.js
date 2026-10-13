/**
 * Deal Stack: Gmail scanner (Google Apps Script)
 *
 * It reads your promotions and card-offer emails, pulls out codes, sales and
 * card offers, and sends them to your private Deal Stack hub. It runs inside
 * your own Google account; nothing else sees your email.
 *
 * Setup:
 *   1. Paste your key between the quotes on the HUB_KEY line below.
 *   2. Pick "setup" in the function menu at the top and tap Run.
 *   3. Allow access when Google asks. It then runs by itself every 6 hours.
 */
var HUB_URL = '__HUB_URL__';
var HUB_KEY = 'PASTE-YOUR-KEY-HERE';

/*__ENGINE__*/

var ISSUERS = {
  'capitalone.com': 'capitalone',
  'capitaloneoffers.com': 'capitalone',
  'capitaloneshopping.com': 'c1shopping',
  'citi.com': 'citi',
  'citibank.com': 'citi',
  'venmo.com': 'venmo'
};

function setup() {
  checkKey_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scan') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scan').timeBased().everyHours(6).create();
  scan();
  Logger.log('Done. The scanner will now run every 6 hours.');
}

function checkKey_() {
  if (!HUB_KEY || HUB_KEY === 'PASTE-YOUR-KEY-HERE') throw new Error('Paste your key on the HUB_KEY line first, then run setup again.');
}

function scan() {
  checkKey_();
  var E = DealEngine;
  var props = PropertiesService.getScriptProperties();
  var firstRun = !props.getProperty('lastRun');
  var days = firstRun ? 21 : 3;
  var cutoff = Date.now() - days * 86400000;
  var queries = [
    'category:promotions newer_than:' + days + 'd',
    '(from:capitalone.com OR from:capitaloneoffers.com OR from:capitaloneshopping.com OR from:citi.com OR from:venmo.com) newer_than:' + days + 'd',
    '("promo code" OR "coupon code" OR "use code" OR "% off") -category:promotions newer_than:' + days + 'd'
  ];
  var seen = {};
  var byId = {};
  var messages = 0;
  var errors = 0;
  queries.forEach(function (q) {
    var threads = GmailApp.search(q, 0, 80);
    threads.forEach(function (th) {
      th.getMessages().forEach(function (msg) {
        if (messages >= 250) return;
        var id = msg.getId();
        if (seen[id]) return;
        seen[id] = 1;
        if (msg.getDate().getTime() < cutoff) return;
        messages++;
        try {
          readMessage_(E, msg).forEach(function (r) {
            var old = byId[r.id];
            if (!old || r.data.posted > old.data.posted) byId[r.id] = r;
          });
        } catch (e) {
          errors++;
        }
      });
    });
  });
  var records = Object.keys(byId).map(function (k) { return byId[k]; });
  for (var i = 0; i < records.length; i += 80) {
    post_('/api/ingest', { source: 'gmail', deals: records.slice(i, i + 80) });
  }
  post_('/api/status', { name: 'gmail', report: { runAt: new Date().toISOString(), messages: messages, deals: records.length, errors: errors } });
  props.setProperty('lastRun', new Date().toISOString());
  Logger.log('Read ' + messages + ' emails and sent ' + records.length + ' deals to Deal Stack.');
}

function readMessage_(E, msg) {
  var from = msg.getFrom() || '';
  var m = /<([^>]+)>/.exec(from);
  var addr = (m ? m[1] : from).trim().toLowerCase();
  var name = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim();
  var senderDomain = (addr.split('@')[1] || '').replace(/[>\s]/g, '');
  var regDom = E.registrableDomain(senderDomain);
  var subject = msg.getSubject() || '';
  var body = (msg.getPlainBody() || '').slice(0, 25000);
  var date = msg.getDate();
  var now = new Date();
  var out = [];

  var issuer = ISSUERS[regDom];
  if (issuer) {
    E.parseOfferText(subject + '\n' + body).slice(0, 40).forEach(function (o) {
      var g = E.guessDomainFromName(o.merchant);
      if (!g || g.guessed) return; // only stores we recognize, to keep email junk out
      var val = o.pct ? (o.upTo ? 'Up to ' : '') + o.pct + '% back' : E.money(o.amt) + ' back';
      out.push(E.makeRecord({
        domain: g.domain, brand: g.brand.name,
        kind: issuer === 'c1shopping' ? 'portal' : 'cardoffer',
        card: issuer === 'c1shopping' ? null : issuer,
        portal: issuer === 'c1shopping' ? 'c1shopping' : null,
        title: val, terms: o.raw, sourceType: 'card',
        sourceName: E.PROGRAMS[issuer].name + ' email', posted: date, personal: true
      }, now));
    });
    return out;
  }

  var store = E.brandByDomain(regDom) || E.brandByName(name);
  var domain = store ? store.domain : E.storeKey(senderDomain);
  var brand = store ? store.name : (name || regDom);
  var link = firstLink_(msg, domain);
  E.extractOffersFromText(subject + '\n' + body, { refDate: date, max: 3 }).forEach(function (o) {
    out.push(E.makeRecord({
      domain: domain, brand: brand, kind: o.code ? 'code' : 'sale',
      title: o.title, code: o.code, terms: o.terms,
      url: link || (store && store.url) || ('https://' + domain),
      sourceType: 'email', sourceName: 'Email from ' + brand, posted: date, personal: true
    }, now));
  });
  return out;
}

function firstLink_(msg, domain) {
  try {
    var html = (msg.getBody() || '').slice(0, 300000);
    var re = /href=["'](https?:\/\/[^"']+)["']/gi;
    var m;
    var bare = domain.split('.').slice(-2).join('.');
    while ((m = re.exec(html)) !== null) {
      if (m[1].indexOf(bare) >= 0 && !/unsubscribe|privacy|preferences|terms/i.test(m[1])) return m[1].replace(/&amp;/g, '&');
    }
  } catch (e) { }
  return null;
}

function post_(path, body) {
  var res = UrlFetchApp.fetch(HUB_URL + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-hub-key': HUB_KEY },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 401) throw new Error('Your hub rejected the key. Check the HUB_KEY line matches APP_KEY in Cloudflare.');
  if (code >= 400) throw new Error('Your hub said ' + code + ': ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText() || '{}');
}
