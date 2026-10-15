// 15.10: проверка правок под сертификацию Островка (гражданство, форма брони, отмена, питание,
// статусы брони, rate_limited). Все ответы API — заглушки, сайт отдаётся локально.
// Запуск из корня репозитория:  node .github/ostrovok-test/porcia_15_10.test.js
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
const VENDOR = process.env.ZB_VENDOR || ''; // папка с leaflet-1.9.4 и leaflet.markercluster-1.5.3 (npm pack); нет — пустые заглушки
fs.mkdirSync(SHOTS, { recursive: true });

// ── локальный сервер сайта ──
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.writeHead(404); return resp.end('nf'); }
      const ext = path.extname(f);
      const ct = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream';
      resp.writeHead(200, { 'Content-Type': ct }); fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

// ── данные заглушек ──
const HOTEL = { id: 'ost_777', hid: 777, ostrovok_id: 'test_hotel', name_ru: 'Тестовый отель', address: 'Минск, ул. Тестовая, 1', category: 'hotel', rating: 8.5, reviews_count: null, price: 100, price_total: 200, nights: 2, oldPrice: null, photos: [], amenities: [], source: 'ostrovok', city_ru: 'Минск', latitude: 53.9, longitude: 27.56, meal: 'nomeal', cancellation: null };
const RATE_TABLE = { book_hash: 'h-A', room_name: 'Стандарт', meal: 'some-new-meal', price_byn: 200, images: [], room_amenities: [], taxes_on_site: [], capacity: 3,
  cancellation: { free_cancellation_before: null, policies: [
    { start_at: null, end_at: '2026-11-05T09:00:00', amount: '0', currency: 'BYN' },
    { start_at: '2026-11-05T09:00:00', end_at: '2026-11-09T09:00:00', amount: '60', currency: 'BYN' },
    { start_at: '2026-11-09T09:00:00', end_at: null, amount: '200', currency: 'BYN' } ] } };
const RATE_FREE = { book_hash: 'h-B', room_name: 'Люкс', meal: 'breakfast', price_byn: 300, images: [], room_amenities: [], taxes_on_site: [],
  cancellation: { free_cancellation_before: '2026-11-08T10:00:00', policies: [{ start_at: '2026-11-08T10:00:00', end_at: null, amount: '300', currency: 'BYN' }] } };
const RATE_NONREF = { book_hash: 'h-C', room_name: 'Эконом', meal: 'nomeal', price_byn: 150, images: [], room_amenities: [], taxes_on_site: [],
  cancellation: { free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount: '150', currency: 'BYN' }] } };
const HP_OK = { ok: true, hid: 777, booking_enabled: false, hotel: { description: 'Описание отеля', amenities: [], photos: [], check_in: '14:00', check_out: '12:00', policy: null }, rates: [RATE_TABLE, RATE_FREE, RATE_NONREF] };

function makeStub(log) {
  const S = {
    hp: () => ({ status: 200, body: HP_OK }),
    finish: () => ({ status: 200, body: { ok: true, partner_order_id: 'ZB-TEST00001', status: 'processing' } }),
    status: () => ({ status: 200, body: { ok: true, status: 'confirmed', partner_order_id: 'ZB-TEST00001' } }),
  };
  async function handler(route) {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    log.push({ path: p, method: req.method(), body });
    const json = (status, obj) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    if (p === '/api/ostrovok/search') return json(200, { ok: true, city: 'Минск', hotels: [HOTEL], total: 1 });
    if (p === '/api/ostrovok/hp') { const r = S.hp(body); return json(r.status, r.body); }
    if (p === '/api/ostrovok/reviews') return json(200, { reviews: [] });
    if (p === '/api/ostrovok/prebook') {
      const all = [RATE_TABLE, RATE_FREE, RATE_NONREF]; const rt = all.find(x => x.book_hash === body.book_hash) || RATE_TABLE;
      return json(200, { ok: true, changes: null, rate: Object.assign({}, rt, { book_hash: 'p-' + rt.book_hash }) });
    }
    if (p === '/api/ostrovok/order/form') return json(200, { ok: true, partner_order_id: 'ZB-TEST00001', payment: { type: 'deposit', amount: '10.00', currency_code: 'USD' } });
    if (p === '/api/ostrovok/order/finish') { const r = S.finish(body); return json(r.status, r.body); }
    if (p.startsWith('/api/ostrovok/order/status/')) { const r = S.status(); return json(r.status, r.body); }
    if (p === '/api/hotels') return json(200, { hotels: [] });
    if (p === '/api/catalog') return json(200, { ok: true, hotels: [] });
    return json(200, {});
  }
  return { S, handler };
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
async function routeExternal(ctx, base) {
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith('https://api.zaedem.by'), route0 => {
    const CORS = { 'Access-Control-Allow-Origin': '*' };
    const route = { request: () => route0.request(), fulfill: o => route0.fulfill(Object.assign({ headers: CORS }, o)) };
    const u = route.request().url();
    const m = u.match(/unpkg\.com\/(leaflet(?:\.markercluster)?)@([\d.]+)\/dist\/(.+)$/);
    if (m && VENDOR) {
      const f = path.join(VENDOR, m[1] + '-' + m[2], 'dist', m[3]);
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(f) });
    }
    if (/\.css(\?|$)|fonts\.googleapis/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (/\.js(\?|$)/.test(u)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    if (/open-meteo/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
}

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

async function run(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  // сервис-воркер сайта сам ходит на CDN мимо заглушек — в тесте он не нужен
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block' }, vp.opts));
  await routeExternal(ctx, base);
  const log = []; const { S, handler } = makeStub(log);
  await ctx.route('https://api.zaedem.by/**', handler);
  const page = await ctx.newPage();
  const errors = []; const netWarn = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (/Failed to load resource/.test(t)) netWarn.push(t + ' @ ' + ((m.location()||{}).url||'')); else errors.push('console: ' + t); } });
  const shot = async n => { await page.waitForTimeout(700); return page.screenshot({ path: path.join(SHOTS, vp.tag + '_' + n + '.png') }); };
  const last = p => log.filter(x => x.path === p).slice(-1)[0];
  const setTrip = (kids) => page.evaluate(k => {
    window._capState = window._capState || {};
    Object.assign(window._capState, { city: 'Минск', din: new Date(2026, 10, 10), dout: new Date(2026, 10, 12), adults: 2, kids: k.length, childAges: k.slice(), gDone: true });
    dIn = new Date(2026, 10, 10); dOut = new Date(2026, 10, 12); gCnt = 2;
  }, kids);

  await page.goto(base + '/');
  await page.waitForTimeout(800);

  // ── 1. Гражданство в поиске ──
  check('по умолчанию гражданство — Беларусь', await page.evaluate(() => zbResidency()) === 'by');
  await setTrip([5]);
  if (vp.mobile) {
    await page.evaluate(() => capSheetOpen(3));
    const sel = page.locator('#cs-step3 select.zb-res-sel');
    check('телефон: выбор гражданства в панели гостей виден', await sel.isVisible());
    await sel.selectOption('ru');
    await page.waitForTimeout(200);
    await shot('1_poisk_grazhdanstvo');
    await page.locator('#cs-footer button').tap();
  } else {
    await page.evaluate(() => { serpOpen(); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { serpEditSearch(); serpSearchStep(3); });
    const sel = page.locator('#serp-sd-modal select.zb-res-sel');
    check('ПК: выбор гражданства в панели гостей виден', await sel.isVisible());
    await sel.selectOption('ru');
    await page.waitForTimeout(200);
    await shot('1_poisk_grazhdanstvo');
    await page.evaluate(() => serpSearchSubmit());
  }
  await page.waitForTimeout(1500);
  const srch = last('/api/ostrovok/search');
  check('residency=ru ушло в /api/ostrovok/search', srch && srch.body && srch.body.residency === 'ru', JSON.stringify(srch && srch.body));
  check('гражданство запомнено на устройстве', await page.evaluate(() => localStorage.getItem('zb_residency')) === 'ru');

  // перезагрузка — значение то же, в обеих панелях
  await page.reload(); await page.waitForTimeout(800);
  check('после перезагрузки гражданство — Россия', await page.evaluate(() => zbResidency()) === 'ru');
  check('после перезагрузки в панели стоит Россия', await page.evaluate(() => { var s = document.querySelector('.zb-res-slot select'); return s && s.value; }) === 'ru');

  // ── страница объекта: residency в /hp, питание, отмена ──
  await setTrip([5]);
  await page.evaluate(() => { serpOpen(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { openHotel('ost_777'); });
  await page.waitForSelector('.ost-rate-row', { timeout: 8000 });
  const hp = last('/api/ostrovok/hp');
  check('residency=ru ушло в /api/ostrovok/hp', hp && hp.body && hp.body.residency === 'ru', JSON.stringify(hp && hp.body));
  check('в /hp тот же состав: 2 взрослых, ребёнок 5 лет', hp && hp.body.adults === 2 && JSON.stringify(hp.body.children) === '[5]');
  const card0 = await page.locator('.ost-rate-row').nth(0).innerText();
  check('неизвестное питание показано как есть (some-new-meal)', /some-new-meal/.test(card0) && !/Без питания/.test(card0), card0);
  check('таблица штрафов в карточке (free_cancellation_before=null)', await page.locator('.ost-rate-row').nth(0).locator('.ost-cx-tbl tr').count() === 3);
  check('штрафы по минскому времени: до 05.11.2026 12:00 — бесплатно', /до 05\.11\.2026 12:00\s+бесплатно/.test(card0), card0);
  check('штраф 60 BYN до 09.11.2026 12:00', /до 09\.11\.2026 12:00\s+60 BYN/.test(card0), card0);
  check('подпись «по минскому времени»', /по минскому времени/.test(card0));
  check('таблица ≠ «Невозвратный»', !/Невозвратный/.test(card0));
  const card1 = await page.locator('.ost-rate-row').nth(1).innerText();
  check('бесплатная отмена: время по Минску как раньше (до 08.11.2026 13:00 (по Минску))', /Бесплатная отмена до 08\.11\.2026 13:00 \(по Минску\)/.test(card1), card1);
  const card2 = await page.locator('.ost-rate-row').nth(2).innerText();
  check('100% с момента брони — «Невозвратный»', /Невозвратный/.test(card2), card2);
  await page.locator('.ost-rate-row').nth(0).scrollIntoViewIfNeeded();
  await shot('2_tarify_shtrafy_pitanie');

  // ── 2. Форма брони: 2 взрослых + ребёнок 5 лет ──
  await page.evaluate(() => ostSelectRate(0));
  await page.waitForSelector('#ost-afn0', { timeout: 8000 });
  const ro = await page.locator('.ost-res-ro').innerText();
  check('в брони гражданство только для чтения: Россия + «изменить»', /Россия/.test(ro) && /изменить/.test(ro) && await page.locator('#bm-body select#f-citizen').count() === 0);
  check('в форме 3 гостя: 2 взрослых и ребёнок (по 2 поля)', await page.locator('#bm-body .ost-guest').count() === 3 && await page.locator('#bm-body .ost-g-inp').count() === 6);
  check('возраст ребёнка из поиска — 5 лет', /Ребёнок 1 · 5 лет/.test(await page.locator('#bm-body').innerText()));
  check('кнопка оплаты по-прежнему неактивна', await page.locator('#bm-body .btn-pay').isDisabled());
  check('таблица штрафов в форме', await page.locator('#bm-body .ost-cx-box .ost-cx-tbl tr').count() === 3);
  check('питание в итоге формы как есть', /some-new-meal/.test(await page.locator('#bm-body .sumbox').innerText()));
  await shot('3_forma_bron');

  // неверные имена: кириллица / цифры
  const fill = async (vals) => { for (const [id, v] of Object.entries(vals)) await page.fill('#' + id, v); };
  await fill({ 'ost-afn0': 'Иван', 'ost-aln0': 'Ivanov', 'ost-afn1': 'Anna', 'ost-aln1': 'Ivanova', 'ost-cfn0': 'Maria', 'ost-cln0': 'Ivanova', 'f-em': 'ivan@example.com', 'f-ph': '+375 29 123-45-67' });
  let n0 = log.filter(x => x.path === '/api/ostrovok/order/form').length;
  await page.evaluate(() => ostConfirm());
  await page.waitForTimeout(300);
  check('кириллица не проходит: подсказка «Латиницей…», заказ не создан', /Латиницей/.test(await page.locator('#ost-afn0-err').innerText()) && log.filter(x => x.path === '/api/ostrovok/order/form').length === n0);
  await fill({ 'ost-afn0': 'Ivan2' });
  await page.evaluate(() => ostConfirm()); await page.waitForTimeout(200);
  check('цифры не проходят: «Без цифр»', /Без цифр/.test(await page.locator('#ost-afn0-err').innerText()));
  await fill({ 'ost-afn0': 'Iv@n' });
  await page.evaluate(() => ostConfirm()); await page.waitForTimeout(200);
  check('спецсимволы не проходят', /Только латинские буквы/.test(await page.locator('#ost-afn0-err').innerText()));
  await fill({ 'ost-afn0': 'Ivan', 'ost-cfn0': '' });
  await page.evaluate(() => ostConfirm()); await page.waitForTimeout(200);
  check('пустое имя ребёнка не подменяется на Child1 — «Заполните поле»', /Заполните поле/.test(await page.locator('#ost-cfn0-err').innerText()) && log.filter(x => x.path === '/api/ostrovok/order/form').length === n0);
  await shot('4_forma_oshibki');
  await fill({ 'ost-cfn0': 'Maria' });

  // успешная отправка (прямой вызов ostConfirm — кнопка оплаты выключена)
  await page.evaluate(() => ostConfirm());
  await page.waitForSelector('#bm-body .success', { timeout: 10000 });
  const fin = last('/api/ostrovok/order/finish');
  const g = fin && fin.body && fin.body.guests;
  check('в finish ушли 3 гостя с настоящими именами', g && g.length === 3
    && g[0].first_name === 'Ivan' && g[0].last_name === 'Ivanov'
    && g[1].first_name === 'Anna' && g[1].last_name === 'Ivanova'
    && g[2].first_name === 'Maria' && g[2].last_name === 'Ivanova' && g[2].is_child === true && g[2].age === 5, JSON.stringify(g));
  check('нет подставных Guest/Child', !/Guest\d|Child\d/.test(JSON.stringify(fin && fin.body)));
  check('guest_name — заказчик', fin && fin.body.guest_name === 'Ivan Ivanov');
  check('согласия и время прибытия читаются до замены формы', fin && typeof fin.body.consents === 'object');
  check('бронь подтверждена — экран успеха', /Бронь подтверждена/.test(await page.locator('#bm-body').innerText()));
  await shot('5_bron_podtverzhdena');

  // ── 5. Статусы брони по error_code ──
  const fillOk = async () => {
    await page.evaluate(() => { closeBK(); ostSelectRate(0); });
    await page.waitForSelector('#ost-afn0', { timeout: 8000 });
    await fill({ 'ost-afn0': 'Ivan', 'ost-aln0': 'Ivanov', 'ost-afn1': 'Anna', 'ost-aln1': 'Ivanova', 'ost-cfn0': 'Maria', 'ost-cln0': 'Ivanova', 'f-em': 'ivan@example.com', 'f-ph': '+375 29 123-45-67' });
  };
  const NOT_CONF = ['book_limit', 'not_allowed', 'provider', 'block', 'charge', 'booking_finish_did_not_succeed'];
  // finish отвечает ошибкой с error_code
  for (const code of ['soldout'].concat(NOT_CONF)) {
    S.finish = () => ({ status: 502, body: { error: 'Ostrovok order/finish error', error_code: code } });
    await fillOk(); await page.evaluate(() => ostConfirm());
    await page.waitForSelector('#bm-body .ost-fail', { timeout: 8000 });
    const t = await page.locator('#bm-body').innerText();
    const want = code === 'soldout' ? /Номер только что закончился[\s\S]*другой тариф/ : /Отель не подтвердил бронь[\s\S]*Деньги не списаны[\s\S]*будут возвращены/;
    check('finish error_code=' + code + ' → свой текст', want.test(t) && !/Ostrovok/.test(t), t);
    if (code === 'soldout') await shot('6_soldout');
    if (code === 'provider') await shot('7_ne_podtverdil');
  }
  // status отвечает failed с error_code
  S.finish = () => ({ status: 200, body: { ok: true, partner_order_id: 'ZB-TEST00001', status: 'processing' } });
  for (const code of ['soldout'].concat(NOT_CONF)) {
    S.status = () => ({ status: 200, body: { ok: false, status: 'failed', error_code: code, partner_order_id: 'ZB-TEST00001' } });
    await fillOk(); await page.evaluate(() => ostConfirm());
    await page.waitForSelector('#bm-body .ost-fail', { timeout: 8000 });
    const t = await page.locator('#bm-body').innerText();
    const want = code === 'soldout' ? /Номер только что закончился/ : /Отель не подтвердил бронь/;
    check('status error_code=' + code + ' → свой текст', want.test(t), t);
  }
  // старый бэкенд: без error_code — сырой текст не показываем
  S.finish = () => ({ status: 502, body: { error: 'Ostrovok order/finish error', debug: null } });
  await fillOk(); await page.evaluate(() => ostConfirm());
  await page.waitForSelector('#bm-body .ost-fail', { timeout: 8000 });
  let t = await page.locator('#bm-body').innerText();
  check('старый бэкенд: «Ostrovok order/finish error» гостю не показан', !/Ostrovok/.test(t) && /Не получилось оформить бронь/.test(t), t);
  // finish error_code=processing → ожидание, затем подтверждение
  S.finish = () => ({ status: 200, body: { ok: false, error_code: 'processing', partner_order_id: 'ZB-TEST00001' } });
  let calls = 0;
  S.status = () => { calls++; return calls < 2 ? { status: 200, body: { ok: true, status: 'processing' } } : { status: 200, body: { ok: true, status: 'confirmed' } }; };
  await fillOk(); await page.evaluate(() => ostConfirm());
  await page.waitForTimeout(700);
  t = await page.locator('#bm-body').innerText();
  check('processing → «Проверяем бронь — это может занять до 15 минут, письмо придёт на почту»', /Проверяем бронь — это может занять до 15 минут, письмо придёт на почту/.test(t), t);
  await shot('8_ozhidanie');
  await page.waitForSelector('#bm-body .success', { timeout: 10000 });
  check('после ожидания — подтверждение (опрос каждые 4 с)', calls >= 2);
  // «требует проверки»
  S.finish = () => ({ status: 200, body: { ok: true, partner_order_id: 'ZB-TEST00001', status: 'processing' } });
  S.status = () => ({ status: 200, body: { ok: true, status: 'needs_review' } });
  await fillOk(); await page.evaluate(() => ostConfirm());
  await page.waitForSelector('#bm-body .ost-review', { timeout: 8000 });
  check('«требует проверки» → «Бронь проверяется, мы напишем вам на почту»', /Бронь проверяется[\s\S]*напишем вам на почту/.test(await page.locator('#bm-body').innerText()));
  await shot('9_proveryaetsya');
  // расписание опроса: 4 с первые 2 минуты, потом 15 с, всего до 15 минут
  await fillOk();
  const sched = await page.evaluate(async () => {
    const real = window.setTimeout, realNow = Date.now; let fake = realNow(); const delays = [];
    Date.now = () => fake;
    window.setTimeout = (fn, ms) => { if (ms === 4000 || ms === 15000) { delays.push(ms); fake += ms; return real(fn, 0); } return real(fn, ms); };
    const of = window.fetch;
    window.fetch = (u, o) => String(u).indexOf('/order/status/') >= 0 ? Promise.resolve(new Response(JSON.stringify({ ok: true, status: 'processing' }), { headers: { 'Content-Type': 'application/json' } })) : of(u, o);
    try {
      ostConfirm();
      await new Promise(r => { const iv = setInterval(() => { if (document.querySelector('#bm-body .ost-review')) { clearInterval(iv); r(); } }, 20); });
    } finally { window.setTimeout = real; Date.now = realNow; window.fetch = of; }
    return delays;
  }).catch(e => 'ERR ' + e.message);
  check('опрос: 30×4 с, затем 52×15 с, итог через 15 минут — «проверяется»', Array.isArray(sched) && sched.filter(d => d === 4000).length === 30 && sched.filter(d => d === 15000).length === 52, JSON.stringify(sched).slice(0, 200));

  // ── 6. rate_limited ──
  await page.evaluate(() => closeBK());
  S.hp = () => ({ status: 200, body: { ok: false, rate_limited: true } });
  await page.evaluate(() => loadOstRates(curHotel));
  await page.waitForSelector('.ost-ratelim', { timeout: 8000 });
  t = await page.locator('#ost-rates').innerText();
  check('rate_limited → «Цены временно недоступны, обновите через минуту» и кнопка «Обновить»', /Цены временно недоступны/.test(t) && /через минуту/.test(t) && await page.locator('.ost-ratelim-btn').isVisible());
  check('rate_limited → старых цен нет', await page.locator('.ost-rate-row').count() === 0 && !/BYN/.test(t));
  await page.locator('.ost-ratelim').scrollIntoViewIfNeeded();
  await shot('10_rate_limited');
  S.hp = () => ({ status: 200, body: HP_OK });
  await page.locator('.ost-ratelim-btn').click();
  await page.waitForSelector('.ost-rate-row', { timeout: 8000 });
  check('«Обновить» загружает цены заново', await page.locator('.ost-rate-row').count() === 3);

  // «изменить» гражданство из брони → панель гостей объекта с выбором гражданства
  await page.evaluate(() => ostSelectRate(0));
  await page.waitForSelector('.ost-res-ro a');
  await page.locator('.ost-res-ro a').click();
  await page.waitForTimeout(500);
  check('«изменить» → окно брони закрыто, открыт выбор гостей с гражданством', !(await page.locator('#bk-modal.open').count()) && await page.locator('#hp-guests-pop.open select.zb-res-sel').isVisible());
  await page.locator('#hp-guests-pop select.zb-res-sel').selectOption('kz');
  await page.evaluate(() => hpApplyGuests());
  await page.waitForSelector('.ost-rate-row', { timeout: 8000 });
  check('после смены гражданства цены запрошены заново с residency=kz', last('/api/ostrovok/hp').body.residency === 'kz');
  await shot('11_izmenit_grazhdanstvo');

  // ── «Мои брони» ──
  await page.evaluate(() => openCabinet([
    { booking_num: 'ZB-FAILED001', status: 'failed', hotel_name: 'Тестовый отель', guest_email: 'ivan@example.com', guest_name: 'Ivan Ivanov', check_in: '2026-11-10', check_out: '2026-11-12', total_price: 200 },
    { booking_num: 'ZB-FAILED002', status: 'cancelled', error_code: 'soldout', hotel_name: 'Тестовый отель', guest_email: 'ivan@example.com', guest_name: 'Ivan Ivanov', check_in: '2026-11-10', check_out: '2026-11-12', total_price: 200 },
    { booking_num: 'ZB-CANCEL003', status: 'cancelled', hotel_name: 'Тестовый отель', guest_email: 'ivan@example.com', guest_name: 'Ivan Ivanov', check_in: '2026-11-10', check_out: '2026-11-12', total_price: 200 },
  ]));
  t = await page.locator('#cabinet-body').innerText();
  check('«Мои брони»: неудачная бронь — «Не подтверждена»', (t.match(/Не подтверждена/g) || []).length === 2);
  check('«Мои брони»: настоящая отмена — по-прежнему «Отменено»', (t.match(/Отменено/g) || []).length === 1);
  await shot('12_moi_broni');
  await page.evaluate(() => document.getElementById('cabinet-modal').classList.remove('open'));

  // горизонтальная прокрутка
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('нет горизонтальной прокрутки', !hscroll);
  check('ошибок JS в консоли нет', errors.length === 0, errors.join(' | '));
  if (process.env.ZB_DEBUG) console.log(netWarn.join('\n'));
  if (netWarn.length) console.log('  (браузер отметил ответы с кодом ошибки от заглушек: ' + netWarn.length + ' — это намеренные 502 в проверке error_code)');
  await ctx.close();
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch();
  try {
    await run(browser, base, { name: 'Телефон 390×844 (тач, пояс Минска)', tag: '390', mobile: true, opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Europe/Minsk', locale: 'ru-RU' } });
    await run(browser, base, { name: 'ПК 1366×768 (пояс Токио — время всё равно по Минску)', tag: '1366', mobile: false, opts: { viewport: { width: 1366, height: 768 }, timezoneId: 'Asia/Tokyo', locale: 'ru-RU' } });
  } finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(results, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
