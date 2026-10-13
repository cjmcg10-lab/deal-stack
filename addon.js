// ==UserScript==
// @name         Deal Stack
// @namespace    deal-stack
// @version      2.0.0
// @description  Tests your coupon codes at checkout, shows the best way to pay on store sites, saves deals from store pages, and saves your card offers to your Deal Stack hub.
// @match        *://*/*
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setClipboard
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  var HUB = '__HUB_URL__';

/*__ENGINE__*/

  var E = (typeof DealEngine !== 'undefined') ? DealEngine : (typeof globalThis !== 'undefined' ? globalThis.DealEngine : null);
  if (!E || !document.body) return;

  var HUB_HOST = (function () { try { return new URL(HUB).hostname; } catch (e) { return ''; } })();
  var DOMAIN = E.storeKey(location.hostname);
  var GMOK = typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function';
  var DANGER = /place (your )?order|pay now|complete (your )?(purchase|order)|submit (your )?order|buy now|confirm (and|&) pay|paypal|apple pay|google pay|continue to payment|place my order|review order|checkout now/i;
  var ERR_RE = /(invalid|not valid|isn['’]?t valid|has expired|is expired|expired|not (?:be )?(?:applicable|eligible)|doesn['’]?t (?:apply|qualify)|does not (?:apply|qualify)|can['’]?t be (?:applied|used|combined)|cannot be (?:applied|used|combined)|not recognized|does not exist|doesn['’]?t exist|unable to apply|didn['’]?t work|try (?:a different|another) code|no longer (?:valid|available)|not found|enter a valid|minimum (?:purchase|order) (?:not met|required))/i;
  var OK_RE = /(applied|success|you saved|discount added|promo added|code accepted|has been added|is now active)/i;

  /* ---------------- storage and hub calls ---------------- */
  function getVal(k, d) {
    if (GMOK) return GM.getValue('ds_' + k, null).then(function (v) { if (v == null) return d; try { return JSON.parse(v); } catch (e) { return d; } });
    try { var v = localStorage.getItem('dealstack.addon.' + k); return Promise.resolve(v == null ? d : JSON.parse(v)); } catch (e) { return Promise.resolve(d); }
  }
  function setVal(k, v) {
    if (GMOK) return GM.setValue('ds_' + k, JSON.stringify(v));
    try { localStorage.setItem('dealstack.addon.' + k, JSON.stringify(v)); } catch (e) { }
    return Promise.resolve();
  }
  function hub(method, path, body, keyOverride) {
    return (keyOverride ? Promise.resolve(keyOverride) : getVal('key', '')).then(function (key) {
      if (!key) { var e = new Error('nokey'); e.nokey = true; throw e; }
      return new Promise(function (resolve, reject) {
        var url = HUB + path;
        var headers = { 'content-type': 'application/json', 'x-hub-key': key };
        var data = body ? JSON.stringify(body) : undefined;
        function done(status, text) {
          var j; try { j = JSON.parse(text); } catch (e) { j = { ok: false, error: 'Bad reply from hub' }; }
          j._status = status; resolve(j);
        }
        if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') {
          GM.xmlHttpRequest({ method: method, url: url, headers: headers, data: data, timeout: 20000,
            onload: function (r) { done(r.status, r.responseText); }, onerror: reject, ontimeout: reject });
        } else {
          fetch(url, { method: method, headers: headers, body: data }).then(function (r) { return r.text().then(function (t) { done(r.status, t); }); }).catch(reject);
        }
      });
    });
  }

  /* ---------------- little UI in its own shadow root ---------------- */
  var host = document.createElement('div');
  host.setAttribute('data-deal-stack', '');
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; left: 0; bottom: 0; width: 0; height: 0;';
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  shadow.innerHTML = '<style>' +
    ':host{all:initial}*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
    '.pill{position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:8px;padding:9px 13px 9px 10px;border-radius:999px;border:1.5px solid #121722;background:#FFD43B;color:#121722;font:600 14px/1.1 inherit;box-shadow:0 8px 24px -8px rgba(0,0,0,.45);cursor:pointer;max-width:calc(100vw - 24px)}' +
    '.pill b{font-weight:800}.pill .x{margin-left:4px;opacity:.6;font-size:16px;line-height:1;padding:0 2px}' +
    '.panel{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));max-width:440px;max-height:72vh;overflow:auto;background:#fff;color:#121722;border-radius:18px;border:1px solid #d8dce4;box-shadow:0 18px 50px -12px rgba(0,0,0,.5);padding:14px 14px 16px;font-size:14px;line-height:1.4}' +
    '.hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}.hd b{flex:1;font-size:17px}.close{border:0;background:#eef0f3;border-radius:10px;width:32px;height:32px;font-size:18px;cursor:pointer;color:#121722}' +
    '.sec{margin-top:12px}.lab{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a8396;font-weight:700;margin-bottom:6px}' +
    '.big{font-size:28px;font-weight:800;letter-spacing:-.01em}.muted{color:#4b5468;font-size:13px}' +
    'ol{margin:6px 0 0;padding-left:20px}li{margin:3px 0}' +
    '.code{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px dashed #7a8396;border-radius:10px;margin-top:6px;cursor:pointer;background:#fff;width:100%;text-align:left;color:#121722}' +
    '.code span{font:600 14px ui-monospace,Menlo,monospace;letter-spacing:.04em;flex:none}.code small{margin-left:auto;color:#4b5468;font-size:12px;text-align:right;min-width:0}' +
    '.found{padding:7px 0;border-bottom:1px solid #eef0f3;font-size:13px}.found b{display:block;font-size:13.5px}.found span{color:#4b5468}' +
    '.btn{display:inline-block;border:1.5px solid #121722;background:#121722;color:#fff;border-radius:11px;padding:9px 14px;font-weight:700;font-size:14px;cursor:pointer}' +
    '.btn.ghost{background:#fff;color:#121722}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
    '.res{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #eef0f3;font-size:13px}.ok{color:#1e7f52;font-weight:700}.bad{color:#b33a27;font-weight:700}.unk{color:#7a8396}' +
    'input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #d8dce4;font-size:16px;color:#121722;background:#fff;margin-top:6px}' +
    '.err{color:#b33a27;font-size:13px;margin-top:6px}.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(70px + env(safe-area-inset-bottom,0px));background:#121722;color:#fff;padding:10px 14px;border-radius:12px;font-size:14px;max-width:calc(100vw - 32px)}' +
    '@media (prefers-color-scheme: dark){.panel{background:#161b25;color:#edf0f5;border-color:#2a3141}.close{background:#232a38;color:#edf0f5}.muted{color:#b0b8c8}.code{background:#161b25;color:#edf0f5;border-color:#848da0}.code small{color:#b0b8c8}.btn{background:#edf0f5;color:#0c0f15;border-color:#edf0f5}.btn.ghost{background:#161b25;color:#edf0f5;border-color:#2a3141}.res,.found{border-color:#2a3141}.found span{color:#b0b8c8}input{background:#0c0f15;color:#edf0f5;border-color:#2a3141}}' +
    '</style><div id="root"></div>';
  document.documentElement.appendChild(host);
  var root = shadow.getElementById ? shadow.getElementById('root') : shadow.querySelector('#root');

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ui = { view: 'none', pillText: '', toast: '' };
  var toastTimer;
  function toast(msg) { ui.toast = msg; paint(); clearTimeout(toastTimer); toastTimer = setTimeout(function () { ui.toast = ''; paint(); }, 3200); }

  function paint() {
    var out = '';
    if (ui.view === 'pill' && ui.pillText) out += '<div class="pill" data-a="open">' + ui.pillText + '<span class="x" data-a="dismiss" aria-label="Hide">×</span></div>';
    if (ui.view === 'panel') out += '<div class="panel" role="dialog">' + panelHtml() + '</div>';
    if (ui.toast) out += '<div class="toast">' + h(ui.toast) + '</div>';
    root.innerHTML = out;
  }

  root.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-a]');
    if (!el) return;
    ev.stopPropagation();
    var a = el.getAttribute('data-a');
    if (a === 'dismiss') { ui.view = 'none'; sessionSet('dismissed', true); paint(); return; }
    if (a === 'open') { ui.view = 'panel'; paint(); if (!isCheckout() && !ctx.capture) scanPage(false).then(paint); return; }
    if (a === 'close') { ui.view = ui.pillText ? 'pill' : 'none'; paint(); return; }
    if (a === 'copy') { copy(el.getAttribute('data-v')); return; }
    if (a === 'test') { startTest(); return; }
    if (a === 'stop') { stopTest('Stopped.'); return; }
    if (a === 'capture') { doCapture(); return; }
    if (a === 'savepage') { savePage(); return; }
    if (a === 'rescan') { scanPage(true).then(paint); return; }
    if (a === 'savekey') { saveKey(); return; }
  });

  function copy(text) {
    var done = function () { toast('Copied ' + text); };
    if (typeof GM !== 'undefined' && GM && typeof GM.setClipboard === 'function') { try { GM.setClipboard(text); done(); return; } catch (e) { } }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { toast(text); });
    else toast(text);
  }

  function sessionGet(k) { try { return JSON.parse(sessionStorage.getItem('dealstack.' + k) || 'null'); } catch (e) { return null; } }
  function sessionSet(k, v) { try { if (v == null) sessionStorage.removeItem('dealstack.' + k); else sessionStorage.setItem('dealstack.' + k, JSON.stringify(v)); } catch (e) { } }

  /* ---------------- state for this store ---------------- */
  var ctx = { store: null, items: [], codes: [], settings: null, plan: null, cart: null, needKey: false, keyErr: '', capture: null, captureCount: 0 };

  function panelHtml() {
    var out = '<div class="hd"><b>Deal Stack' + (ctx.store ? ' · ' + h(ctx.store.name) : '') + '</b><button class="close" data-a="close" aria-label="Close">×</button></div>';
    if (ctx.needKey) {
      return out + '<div class="muted">Paste the key you set as APP_KEY. You can copy it in the Deal Stack app under Settings.</div>' +
        '<input id="dskey" type="password" autocapitalize="off" autocomplete="off" placeholder="Your key">' + (ctx.keyErr ? '<div class="err">' + h(ctx.keyErr) + '</div>' : '') +
        '<div class="row"><button class="btn" data-a="savekey">Connect</button></div>';
    }
    if (ctx.capture) {
      out += '<div class="sec"><div class="lab">Save offers</div><div class="muted">Found ' + ctx.captureCount + ' ' + (ctx.capture.prog === 'costco' ? 'member savings' : 'offers') + ' on this page. Scroll to load more first if the list is long.</div>' +
        '<div class="row"><button class="btn" data-a="capture">Save to Deal Stack</button></div></div>';
      return out;
    }
    var t = test;
    if (isCheckout() && ctx.codes.length) {
      out += '<div class="sec"><div class="lab">Test codes</div>';
      if (t.running) out += '<div class="muted">Trying ' + (t.i + 1) + ' of ' + t.codes.length + ': <b>' + h(t.codes[Math.min(t.i, t.codes.length - 1)].code) + '</b></div>';
      else if (t.msg) out += '<div class="muted">' + h(t.msg) + '</div>';
      else out += '<div class="muted">' + ctx.codes.length + (ctx.codes.length === 1 ? ' code' : ' codes') + ' to try on this cart.</div>';
      if (t.results.length) out += '<div style="margin-top:6px">' + t.results.map(function (r) {
        return '<div class="res"><span>' + h(r.code) + '</span><span class="' + (r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'unk') + '">' + (r.ok === true ? 'Worked' + (r.saved ? ', saved ' + E.money(r.saved) : '') : r.ok === false ? "Didn't work" : "Couldn't tell") + '</span></div>';
      }).join('') + '</div>';
      out += '<div class="row">' + (t.running ? '<button class="btn ghost" data-a="stop">Stop</button>' : '<button class="btn" data-a="test">' + (t.results.length ? 'Test again' : 'Test codes') + '</button>') + '</div></div>';
    }
    if (ctx.plan && ctx.plan.best) {
      var b = ctx.plan.best;
      out += '<div class="sec"><div class="lab">Best way to pay' + (ctx.cart ? ' on this ' + E.money(ctx.cart) + ' cart' : ' on $100') + '</div>' +
        '<div class="big">' + E.money(b.total) + ' <span class="muted">(' + E.pctStr(b.totalPct) + ')</span></div>' +
        '<ol>' + b.steps.map(function (s) { return '<li>' + h(s) + '</li>'; }).join('') + '</ol>' +
        (b.notes.length ? '<div class="muted" style="margin-top:6px">' + h(b.notes[0]) + '</div>' : '') + '</div>';
    }
    if (ctx.codes.length) {
      out += '<div class="sec"><div class="lab">Codes · tap to copy</div>' + ctx.codes.slice(0, 8).map(function (x) {
        return '<button class="code" data-a="copy" data-v="' + h(x.rec.d.code) + '"><span>' + h(x.rec.d.code) + '</span><small><b>' + h(x.a.terms.headline || '') + '</b> · ' + h((E.STATUS[x.a.status] || {}).label || '') + '<br>On: ' + h(x.a.applies) + '</small></button>';
      }).join('') + '</div>';
    }
    if (!isCheckout()) out += pageSection();
    var offers = ctx.items.filter(function (x) { return (x.rec.d.kind === 'cardoffer' || x.rec.d.kind === 'portal') && x.a.status !== 'expired'; });
    if (offers.length) out += '<div class="sec"><div class="lab">Card offers here</div>' + offers.map(function (x) {
      var prog = E.PROGRAMS[x.rec.d.card] || E.PROGRAMS[x.rec.d.portal] || {};
      return '<div class="muted">' + h(prog.name || 'Offer') + ': <b>' + h(x.a.terms.headline || x.rec.d.title) + '</b></div>';
    }).join('') + '</div>';
    return out;
  }

  function saveKey() {
    var input = shadow.querySelector ? shadow.querySelector('#dskey') : null;
    var key = input && input.value.trim();
    if (!key) return;
    hub('GET', '/api/domains', null, key).then(function (j) {
      if (j._status === 401) { ctx.keyErr = "That key doesn't match your hub."; paint(); return; }
      if (!j.ok) { ctx.keyErr = j.error || 'Could not reach your hub.'; paint(); return; }
      setVal('key', key).then(function () { ctx.needKey = false; ctx.keyErr = ''; setVal('index', null); toast('Connected to Deal Stack'); start(); });
    }).catch(function () { ctx.keyErr = 'Could not reach your hub.'; paint(); });
  }

  /* ---------------- page reading ---------------- */
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  }
  function isCheckout() {
    if (/\/(cart|basket|bag|checkout|payment|order-?summary|shopping-?bag|shoppingcart)(\/|\?|$|\.|-)/i.test(location.pathname + location.search)) return true;
    return !!findPromoInput();
  }
  function labelText(el) {
    var t = '';
    try { if (el.id) { var l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t += l.textContent; } } catch (e) { }
    var p = el.closest && el.closest('label'); if (p) t += ' ' + p.textContent;
    return t.slice(0, 200);
  }
  function findPromoInput() {
    var inputs = document.querySelectorAll('input:not([type]), input[type="text"], input[type="search"], input[type="tel"]');
    var best = null, bestScore = 0;
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.disabled || el.readOnly || !visible(el)) continue;
      var attrs = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.getAttribute('autocomplete'), el.getAttribute('data-testid'), typeof el.className === 'string' ? el.className : '', labelText(el)].join(' ');
      var promo = /promo|coupon/i.test(attrs);
      if (!promo && /gift ?card|giftcard|zip|postal|e-?mail|phone|card ?number|cc-|cvv|cvc|security|password|search|first ?name|last ?name|address|city|quantity|qty|employee|member(ship)? ?(number|id)|rewards? ?(number|id)|\bpin\b/i.test(attrs)) continue;
      var s = 0;
      if (promo) s += 5;
      if (/discount|voucher|offer/i.test(attrs)) s += 3;
      if (/\bcode\b/i.test(attrs)) s += 2;
      if (s > bestScore) { bestScore = s; best = el; }
    }
    return bestScore >= 3 ? best : null;
  }
  function revealPromo() {
    var els = document.querySelectorAll('button, a, [role="button"], summary, [aria-expanded]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var t = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim();
      if (t.length > 80 || DANGER.test(t)) continue;
      if (/(promo|coupon|discount|offer)\s*code|have a (promo|coupon|discount|code)|add (a )?(promo|coupon|discount|code)|apply (a )?(promo|coupon|discount)|enter (a )?(promo|coupon|discount|code)|promotions?$/i.test(t) && visible(el)) { el.click(); return true; }
    }
    return false;
  }
  function findApply(input) {
    var scope = input;
    for (var i = 0; i < 6 && scope.parentElement; i++) {
      scope = scope.parentElement;
      var btns = scope.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
      for (var j = 0; j < btns.length; j++) {
        var b = btns[j];
        var t = ((b.textContent || '') + ' ' + (b.value || '') + ' ' + (b.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim();
        if (t.length < 40 && /\b(apply|redeem|submit|add|use)\b/i.test(t) && !DANGER.test(t) && !/remove/i.test(t) && visible(b)) return b;
      }
    }
    return null;
  }
  function promoScope(input) {
    var s = input;
    for (var i = 0; i < 5 && s.parentElement; i++) s = s.parentElement;
    return s;
  }
  function setValue(input, v) {
    input.focus();
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(input, v); else input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function pressEnter(input) {
    ['keydown', 'keypress', 'keyup'].forEach(function (type) {
      input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    });
    if (input.form && typeof input.form.requestSubmit === 'function') { try { input.form.requestSubmit(); } catch (e) { } }
  }
  function moneyIn(text) {
    var m = String(text).match(/\$\s?[\d,]+\.\d{2}/g);
    return m ? parseFloat(m[m.length - 1].replace(/[$,\s]/g, '')) : null;
  }
  function readTotal() {
    var nodes = document.querySelectorAll('span, div, p, td, th, dt, dd, li, strong, b, h2, h3, h4, label');
    var best = null, sub = null;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length > 4) continue;
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length > 70 || !/total/i.test(t)) continue;
      if (!visible(el)) continue;
      var isSub = /sub-?total|items? total|merchandise total/i.test(t);
      if (!isSub && /savings|you saved|discount|tax|shipping|points|rewards/i.test(t)) continue;
      var row = el, amt = null;
      for (var k = 0; k < 4 && row; k++) {
        var rt = (row.textContent || '').replace(/\s+/g, ' ');
        if (rt.length < 180) { amt = moneyIn(rt); if (amt != null) break; }
        row = row.parentElement;
      }
      if (amt == null) continue;
      if (isSub) { sub = amt; continue; }
      var strength = /order total|estimated total|grand total|total due|amount due|total to pay|total \(/i.test(t) ? 2 : 1;
      if (!best || strength >= best.s) best = { amt: amt, s: strength };
    }
    return best ? best.amt : sub;
  }
  function pageMessages(scope) {
    var bits = [];
    var els = (scope || document).querySelectorAll('[role="alert"], [aria-live], .error, .errors, [class*="error"], [class*="message"], [class*="promo"], [class*="coupon"], small, p, span');
    for (var i = 0; i < els.length && i < 400; i++) {
      var t = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length < 220 && visible(els[i])) bits.push(t);
    }
    return bits.join(' | ');
  }
  function hasCaptcha() {
    if (document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"], #px-captcha, [id*="captcha"], [class*="captcha"]')) return true;
    return /verify you are (a )?human|are you a robot|press (and|&) hold|unusual activity/i.test((document.body.innerText || '').slice(0, 20000));
  }
  function settle(maxMs) {
    return new Promise(function (resolve) {
      var t0 = Date.now(), last = Date.now();
      var mo = new MutationObserver(function () { last = Date.now(); });
      mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      (function tick() {
        var now = Date.now();
        if ((now - last > 900 && now - t0 > 1500) || now - t0 > maxMs) { mo.disconnect(); resolve(); }
        else setTimeout(tick, 150);
      })();
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function removeApplied(scope) {
    var els = (scope || document).querySelectorAll('button, a, [role="button"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var t = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim();
      if (t.length < 50 && (/^(remove|×|✕|x|delete|clear)$/i.test(t) || /remove (promo|coupon|code|discount|offer)/i.test(t)) && visible(el) && !DANGER.test(t)) { el.click(); return true; }
    }
    return false;
  }

  /* ---------------- checkout tester ---------------- */
  var test = { running: false, i: 0, codes: [], results: [], msg: '' };

  function saveTestState(extra) {
    sessionSet('test', Object.assign({ domain: DOMAIN, i: test.i, codes: test.codes, results: test.results, base: test.base, at: Date.now() }, extra || {}));
  }

  function startTest() {
    if (test.running) return;
    test = { running: true, i: 0, codes: ctx.codes.slice(0, 12).map(function (x) { return { id: x.rec.id, code: x.rec.d.code }; }), results: [], msg: '', base: readTotal() };
    ui.view = 'panel'; paint();
    runTest();
  }

  function stopTest(msg) {
    test.running = false; test.msg = msg || '';
    sessionSet('test', null);
    sessionSet('tested:' + DOMAIN, Date.now());
    paint();
  }

  async function tryOne(code) {
    var input = findPromoInput();
    if (!input) { revealPromo(); await settle(2500); input = findPromoInput(); }
    if (!input) return { stop: "Couldn't find the promo code box on this page. Open it, then tap Test codes again." };
    var scope = promoScope(input);
    if (removeApplied(scope)) { await settle(4000); input = findPromoInput() || input; scope = promoScope(input); }
    var before = readTotal();
    var msgBefore = pageMessages(scope);
    saveTestState({ pending: code, before: before });
    setValue(input, code);
    await wait(250);
    var apply = findApply(input);
    if (apply) apply.click(); else pressEnter(input);
    await settle(7000);
    return judge(code, before, msgBefore, scope);
  }

  function judge(code, before, msgBefore, scope) {
    var after = readTotal();
    var msgs = pageMessages(scope && document.contains(scope) ? scope : document);
    var fresh = msgs.split(' | ').filter(function (m) { return msgBefore.indexOf(m) < 0; }).join(' | ');
    var codeShown = (document.body.innerText || '').toUpperCase().indexOf(code.toUpperCase()) >= 0;
    if (before != null && after != null && after < before - 0.009) return { ok: true, saved: Math.round((before - after) * 100) / 100 };
    if (ERR_RE.test(fresh)) return { ok: false };
    if (OK_RE.test(fresh) && codeShown) return { ok: true, saved: 0 };
    if (before != null && after != null && Math.abs(after - before) < 0.01 && fresh) return { ok: false };
    return { ok: null };
  }

  async function runTest(resume) {
    try {
      if (resume && resume.pending) {
        var r0 = judge(resume.pending, resume.before, '', document);
        test.results.push({ id: test.codes[test.i].id, code: resume.pending, ok: r0.ok, saved: r0.saved || 0 });
        test.i++;
      }
      while (test.running && test.i < test.codes.length) {
        if (hasCaptcha()) { finishTest('The store asked to check you\'re human, so testing stopped. Finish this checkout yourself.'); return; }
        paint();
        var c = test.codes[test.i];
        var r = await tryOne(c.code);
        if (!test.running) return;
        if (r.stop) { finishTest(r.stop); return; }
        test.results.push({ id: c.id, code: c.code, ok: r.ok, saved: r.saved || 0 });
        test.i++;
        saveTestState();
        await wait(1200);
      }
      if (!test.running) return;
      // Put the best working code back on the cart.
      var good = test.results.filter(function (r) { return r.ok; }).sort(function (a, b) { return b.saved - a.saved; });
      if (good.length) {
        var lastTried = test.results[test.results.length - 1];
        if (!lastTried || lastTried.code !== good[0].code || !lastTried.ok) {
          var input = findPromoInput();
          if (input) {
            removeApplied(promoScope(input)); await settle(3000);
            input = findPromoInput() || input;
            setValue(input, good[0].code); await wait(250);
            var ap = findApply(input); if (ap) ap.click(); else pressEnter(input);
            await settle(6000);
          }
        }
        finishTest('Best code applied: ' + good[0].code + (good[0].saved ? ', saving ' + E.money(good[0].saved) : '') + '. Check your total before you pay.');
      } else {
        finishTest(test.results.some(function (r) { return r.ok === false; }) ? 'None of the codes worked on this cart.' : "Couldn't tell whether the codes worked. Check your total.");
      }
    } catch (e) {
      finishTest('Testing stopped because the page changed unexpectedly.');
    }
  }

  function finishTest(msg) {
    var report = test.results.filter(function (r) { return r.ok === true || r.ok === false; }).map(function (r) { return { dealId: r.id, domain: DOMAIN, code: r.code, ok: r.ok, saved: r.saved, via: 'addon' }; });
    stopTest(msg);
    if (report.length) hub('POST', '/api/tests', { results: report }).then(function () { return loadStore(); }).catch(function () { });
  }

  /* ---------------- card offer capture ---------------- */
  function captureSite() {
    var hn = location.hostname;
    if (/(^|\.)capitaloneshopping\.com$/.test(hn)) return { prog: 'c1shopping', name: 'Capital One Shopping' };
    if (/(^|\.)capitalone(offers)?\.com$/.test(hn)) return { prog: 'capitalone', name: 'Capital One Offers' };
    if (/(^|\.)citi\.com$/.test(hn)) return { prog: 'citi', name: 'Citi offers' };
    if (/(^|\.)costco\.com$/.test(hn)) return { prog: 'costco', name: 'Costco member savings' };
    return null;
  }
  function captureItems() {
    var text = document.body.innerText || '';
    if (ctx.capture.prog === 'costco') return E.parseCostcoText(text, new Date());
    return E.parseOfferText(text);
  }
  function watchCapture() {
    if (ctx.watching) return;
    ctx.watching = true;
    function check() {
      var n = captureItems().length;
      ctx.captureCount = n;
      if (n >= 3 && !sessionGet('dismissed')) {
        ui.pillText = '<b>Deal Stack</b> Save ' + n + (ctx.capture.prog === 'costco' ? ' savings' : ' offers');
        if (ui.view !== 'panel') ui.view = 'pill';
        paint();
      }
    }
    setTimeout(check, 2500);
    var timer;
    var mo = new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(check, 1200); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  function doCapture() {
    var prog = ctx.capture.prog;
    var now = new Date();
    var recs;
    if (prog === 'costco') {
      recs = E.parseCostcoText(document.body.innerText || '', now).map(function (it) {
        return E.makeRecord({ domain: 'costco.com', kind: 'sale', title: it.item + ': ' + E.money(it.amt) + ' off', terms: it.raw, url: location.href, sourceType: 'costco', sourceName: 'Costco member savings', expires: it.expires }, now);
      });
    } else {
      recs = E.parseOfferText(document.body.innerText || '').map(function (o) {
        var g = E.guessDomainFromName(o.merchant) || { domain: 'deal:' + E.normName(o.merchant) };
        var val = o.pct ? (o.upTo ? 'Up to ' : '') + o.pct + '% back' : E.money(o.amt) + ' back';
        return E.makeRecord({
          domain: g.domain, brand: g.brand ? g.brand.name : o.merchant, kind: prog === 'c1shopping' ? 'portal' : 'cardoffer',
          card: prog === 'c1shopping' ? null : prog, portal: prog === 'c1shopping' ? 'c1shopping' : null,
          title: val, terms: o.raw, sourceType: 'card', sourceName: ctx.capture.name, guessed: g.guessed
        }, now);
      });
    }
    if (!recs.length) { toast('No offers found on this page yet.'); return; }
    var chunks = [];
    for (var i = 0; i < recs.length; i += 150) chunks.push(recs.slice(i, i + 150));
    var saved = 0;
    chunks.reduce(function (p, chunk) {
      return p.then(function () { return hub('POST', '/api/ingest', { source: 'capture:' + prog, deals: chunk }).then(function (j) { if (!j.ok) throw new Error(j.error || 'failed'); saved += j.accepted; }); });
    }, Promise.resolve()).then(function () {
      ui.view = 'none'; sessionSet('dismissed', true); toast('Saved ' + saved + ' to Deal Stack');
    }).catch(function (e) {
      if (e && e.nokey) { ctx.needKey = true; ui.view = 'panel'; paint(); }
      else toast("Couldn't save: " + (e && e.message ? e.message : 'no connection'));
    });
  }

  /* ---------------- save the deals on a store page ---------------- */
  // Reads this page the same way the collector reads store pages, so stores that block
  // the collector can still be saved: open their deals page and tap Save.
  var scan = { at: 0, recs: [], offers: [], products: [] };
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function looksLikeShop() {
    var t = (document.body.innerText || '').slice(0, 60000);
    return (t.match(/\$\s?\d/g) || []).length >= 6 && /\b(add to (cart|bag)|sale|% off|promo|coupon|code)\b/i.test(t);
  }
  function pageInfo(page) {
    var brand = E.brandByDomain(DOMAIN);
    var name = (ctx.store && ctx.store.name) || (brand && brand.name) || DOMAIN.split('.')[0].replace(/^./, function (c) { return c.toUpperCase(); });
    var label = page.h1 && page.h1.length < 70 ? page.h1 : null;
    return { domain: DOMAIN, brand: name, url: location.href.split('#')[0], cat: brand ? brand.cat : null, pageLabel: label, sourceType: 'official', sourceName: name + ' website (saved in Safari)' };
  }
  async function fillTerms(page, allowFetch) {
    var here = location.href.split('#')[0];
    var cache = {};
    var budget = 3;
    for (var i = 0; i < page.offers.length; i++) {
      var o = page.offers[i];
      if (!o.termsUrls || !o.termsUrls.length) continue;
      var turl = o.termsUrls[0];
      var base = turl.split('#')[0];
      var root = base === here ? page.root : cache[base];
      if (root === undefined) {
        root = null;
        if (allowFetch && budget > 0 && base.indexOf(location.origin) === 0) {
          budget--;
          try { var res = await fetch(base, { credentials: 'include' }); if (res.ok) root = E.parseHTML(await res.text()); } catch (e) { }
        }
        cache[base] = root;
      }
      if (!root) continue;
      var keys = [o.code].concat((o.tiers || []).map(function (t) { return '$' + t.amt; }), [(/\d{1,2}\s?%/.exec(o.line) || [])[0], (/\$\s?\d+/.exec(o.line) || [])[0]]).filter(Boolean);
      var text = E.termsFromPage(root, turl, keys);
      if (text) { o.termsText = text; o.termsSource = turl; }
    }
  }
  async function scanPage(withTerms) {
    try {
      var page = E.readPage(E.fromDom(document.documentElement), { url: location.href, domain: DOMAIN });
      await fillTerms(page, !!withTerms);
      var got = E.recordsFromPage(page, pageInfo(page), new Date());
      var recs = got.records.filter(function (r) { return E.isComplete(r); });
      var now = new Date();
      var assessed = recs.map(function (r) { return { r: r, a: E.assess({ id: r.id, d: r.data, fs: now.toISOString(), ls: now.toISOString() }, { now: now }) }; });
      scan = { at: Date.now(), recs: recs, offers: assessed.filter(function (x) { return x.r.kind !== 'product'; }), products: assessed.filter(function (x) { return x.r.kind === 'product'; }), dropped: got.dropped.length };
    } catch (e) { scan = { at: Date.now(), recs: [], offers: [], products: [], err: true }; }
    return scan;
  }
  function pageSection() {
    if (!scan.at) return '';
    var n = scan.recs.length;
    var out = '<div class="sec"><div class="lab">On this page</div>';
    if (!n) return out + '<div class="muted">No deals here that say what they apply to. Open the store\'s deals or sale page and try again.</div><div class="row"><button class="btn ghost" data-a="rescan">Look again</button></div></div>';
    out += '<div class="muted">' + [scan.offers.length ? plural(scan.offers.length, 'promotion or code', 'promotions and codes') : null, scan.products.length ? plural(scan.products.length, 'product') + ' on sale' : null].filter(Boolean).join(' and ') + '. Saving adds them to the app with what each applies to.</div>';
    out += scan.offers.slice(0, 5).map(function (x) {
      return '<div class="found"><b>' + h(x.r.data.title) + '</b><span>Applies to: ' + h(x.a.applies) + '</span></div>';
    }).join('');
    if (scan.products.length) out += '<div class="found"><span>' + scan.products.slice(0, 3).map(function (x) { return h(x.r.data.product.name) + ' ' + E.money(x.r.data.product.price); }).join(' · ') + (scan.products.length > 3 ? ' and more' : '') + '</span></div>';
    return out + '<div class="row"><button class="btn" data-a="savepage">Save ' + plural(n, 'deal') + ' to Deal Stack</button><button class="btn ghost" data-a="rescan">Look again</button></div></div>';
  }
  function offerPageSave() {
    if (isCheckout()) return;
    setTimeout(function () {
      scanPage(false).then(function (sc) {
        if (sc.offers.length < 1 && sc.products.length < 3) return;
        if (!ui.pillText) ui.pillText = '<b>Deal Stack</b> Save ' + plural(sc.recs.length, 'deal') + ' from this page';
        if (sessionGet('dismissed') || ui.view === 'panel') { paint(); return; }
        ui.view = 'pill'; paint();
      });
    }, 2500);
  }
  function savePage() {
    toast('Reading the fine print…');
    scanPage(true).then(function (sc) {
      if (!sc.recs.length) { paint(); toast('Nothing to save on this page.'); return; }
      return hub('POST', '/api/ingest', { source: 'capture:store:' + DOMAIN, deals: sc.recs }).then(function (j) {
        if (j._status === 401) { var e = new Error('badkey'); e.nokey = true; throw e; }
        if (!j.ok) throw new Error(j.error || 'failed');
        setVal('index', null);
        toast('Saved ' + plural(j.accepted, 'deal') + ' to Deal Stack');
        return hub('POST', '/api/notify', {}).catch(function () { });
      });
    }).catch(function (e) {
      if (e && e.nokey) { ctx.needKey = true; ui.view = 'panel'; paint(); }
      else toast("Couldn't save: " + (e && e.message ? e.message : 'no connection'));
    });
  }

  /* ---------------- start ---------------- */
  function loadIndex() {
    return getVal('index', null).then(function (idx) {
      if (idx && Date.now() - idx.at < 6 * 3600000) return idx.list;
      return hub('GET', '/api/domains').then(function (j) {
        if (j._status === 401) { var e = new Error('badkey'); e.nokey = true; throw e; }
        var list = j.ok ? j.domains : [];
        setVal('index', { at: Date.now(), list: list });
        return list;
      });
    });
  }

  function loadStore() {
    return hub('GET', '/api/deals?domain=' + encodeURIComponent(DOMAIN)).then(function (j) {
      if (!j.ok) return;
      var now = new Date();
      var testsBy = {};
      (j.tests || []).forEach(function (t) { (testsBy[t.deal_id] = testsBy[t.deal_id] || []).push(t); });
      ctx.items = (j.deals || []).map(function (rec) { return { rec: rec, a: E.assess(rec, { now: now, sight: j.sight || {}, tests: testsBy[rec.id] || [] }) }; });
      ctx.settings = Object.assign({}, E.DEFAULT_SETTINGS, j.settings || {});
      ctx.store = E.storeFor(DOMAIN, (j.deals || []));
      // Codes for the whole order first, then codes for certain items. Codes tied to one product are skipped.
      ctx.codes = ctx.items.filter(function (x) { var d = x.rec.d; return d.code && x.a.status !== 'failed' && x.a.status !== 'expired' && !x.a.terms.item && !(d.scope && d.scope.type === 'product'); })
        .sort(function (a, b) { return (b.a.whole ? 1 : 0) - (a.a.whole ? 1 : 0) || b.a.score - a.a.score; });
      ctx.cart = isCheckout() ? readTotal() : null;
      ctx.plan = E.planForStore(ctx.store, ctx.items, ctx.settings, ctx.cart || 100);
      var b = ctx.plan.best;
      if (!ctx.items.length) { offerPageSave(); return; }
      var label = ctx.codes.length ? ctx.codes.length + (ctx.codes.length === 1 ? ' code' : ' codes') : ctx.items.some(function (x) { return x.rec.d.kind === 'cardoffer' || x.rec.d.kind === 'portal'; }) ? 'card offers' : plural(ctx.items.length, 'deal');
      ui.pillText = '<b>Deal Stack</b> ' + h(label) + (b && b.totalPct ? ' · save ' + E.pctStr(b.totalPct) : '');
      if (sessionGet('dismissed')) return;
      if (ui.view !== 'panel') ui.view = 'pill';
      paint();
      var resume = sessionGet('test');
      if (resume && resume.domain === DOMAIN && Date.now() - resume.at < 10 * 60000) {
        test = { running: true, i: resume.i, codes: resume.codes, results: resume.results || [], msg: '', base: resume.base };
        ui.view = 'panel'; paint();
        settle(3000).then(function () { runTest(resume); });
        return;
      }
      var tested = sessionGet('tested:' + DOMAIN);
      if (isCheckout() && ctx.codes.length && ctx.settings.autoTest !== false && !(tested && Date.now() - tested < 30 * 60000)) {
        ui.view = 'panel'; paint();
        setTimeout(function () { if (!test.running && ui.view === 'panel') startTest(); }, 2500);
      }
    });
  }

  function start() {
    var site = captureSite();
    if (site) { ctx.capture = site; watchCapture(); return; }
    getVal('key', '').then(function (key) {
      if (!key) {
        if (isCheckout()) { ctx.needKey = true; ui.pillText = '<b>Deal Stack</b> Connect to test codes'; ui.view = 'pill'; paint(); }
        return;
      }
      loadIndex().then(function (list) {
        ctx.known = list.indexOf(DOMAIN) >= 0;
        if (!ctx.known) { if (E.brandByDomain(DOMAIN) || looksLikeShop()) offerPageSave(); return; }
        return loadStore().then(function () { if (!isCheckout()) setTimeout(function () { scanPage(false).then(function () { if (ui.view === 'panel') paint(); }); }, 2500); });
      }).catch(function (e) {
        if (e && e.nokey && isCheckout()) { ctx.needKey = true; ctx.keyErr = "Your saved key no longer matches your hub."; ui.pillText = '<b>Deal Stack</b> Reconnect'; ui.view = 'pill'; paint(); }
      });
    });
  }

  if (location.hostname === HUB_HOST) {
    // On your own hub: pick up the key the app saved, so you don't have to paste it.
    try {
      var k = JSON.parse(localStorage.getItem('dealstack.key') || 'null');
      if (k) getVal('key', '').then(function (old) { if (old !== k) setVal('key', k).then(function () { toast('Safari add-on connected to your hub'); }); });
    } catch (e) { }
    return;
  }
  start();
})();
