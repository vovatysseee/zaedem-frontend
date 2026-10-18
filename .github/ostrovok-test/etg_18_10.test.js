// 18.10: сертификация Островка — тестовый отель по ссылке, кнопка «Тестовая бронь (без оплаты)»,
// «по Минску (UTC+3)» в сроке отмены, все разделы «Условий проживания». Все ответы API — заглушки.
// Главная и выдача сравниваются с main (index.html из git): разметка должна совпасть.
// Запуск из корня репозитория:  node .github/ostrovok-test/etg_18_10.test.js
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_18_10');
const BASE_REF = process.env.ZB_BASE_REF || 'origin/main'; // с чем сравниваем главную и выдачу
fs.mkdirSync(SHOTS, { recursive: true });
let OLD_HTML = null;
try { OLD_HTML = execSync('git show ' + BASE_REF + ':index.html', { cwd: ROOT, maxBuffer: 64 << 20 }); } catch (e) { console.log('  (нет ' + BASE_REF + ' — сравнение с main пропущено)'); }

// ── локальный сервер: / — новая версия, /old/ — index.html из main (остальные файлы общие) ──
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let old = false;
      if (p.startsWith('/old/')) { old = true; p = p.slice(4); }
      if (p === '/') p = '/index.html';
      if (old && p === '/index.html' && OLD_HTML) { resp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return resp.end(OLD_HTML); }
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.writeHead(404); return resp.end('nf'); }
      const ext = path.extname(f);
      const ct = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream';
      resp.writeHead(200, { 'Content-Type': ct }); fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

// даты поездки — через месяц от сегодняшнего дня (прошлые даты сайт отбрасывает)
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const D_IN = new Date(Date.now() + 30 * 86400000), D_OUT = new Date(Date.now() + 32 * 86400000);
const CI = ymd(D_IN), CO = ymd(D_OUT);
const LINK_TEST = '#h=ost_8473727|' + encodeURIComponent('Минск') + '|' + CI + '|' + CO + '|2|1|5';
const LINK_TEST2 = '#h=ost_8526976|Минск|' + CI + '|' + CO + '|2|0|';
const LINK_USUAL = '#h=ost_777|Минск|' + CI + '|' + CO + '|2|0|';

// ── данные заглушек ──
const HOTEL = { id: 'ost_777', hid: 777, ostrovok_id: 'usual_hotel', name_ru: 'Обычный отель', address: 'Минск, ул. Тестовая, 1', category: 'hotel', rating: 4, reviews_count: null, price: 100, price_total: 200, nights: 2, oldPrice: null, photos: [], amenities: [], source: 'ostrovok', city_ru: 'Минск', latitude: 53.9, longitude: 27.56, meal: 'nomeal', cancellation: null };
const iso = (days, h) => { const d = new Date(Date.now() + days * 86400000); return ymd(d) + 'T' + pad(h) + ':00:00'; };
const RATE_FREE = { book_hash: 'h-FREE', room_name: 'Стандарт', meal: 'breakfast', price_byn: 210, images: [], room_amenities: [], taxes_on_site: [], capacity: 3,
  cancellation: { free_cancellation_before: iso(25, 9), policies: [{ start_at: iso(25, 9), end_at: null, amount: '210', currency: 'BYN' }] } };
const RATE_TABLE = { book_hash: 'h-TBL', room_name: 'Люкс', meal: 'nomeal', price_byn: 300, images: [], room_amenities: [], taxes_on_site: [], capacity: 3,
  cancellation: { free_cancellation_before: null, policies: [
    { start_at: null, end_at: iso(20, 9), amount: '0', currency: 'BYN' },
    { start_at: iso(20, 9), end_at: iso(27, 9), amount: '90', currency: 'BYN' },
    { start_at: iso(27, 9), end_at: null, amount: '300', currency: 'BYN' } ] } };
const LONG_INFO = 'Сведения от объекта: ' + 'Заселение по паспорту или виду на жительство. Гостям до 18 лет — только с родителями или по доверенности. '.repeat(6);
// «Условия проживания»: все разделы metapolicy в нынешнем формате ({label,text} в deposit и paid)
const POLICY_ALL = {
  contactless: true,
  deposit: [
    { label: 'Залог за сохранность имущества', text: '50 BYN за номер за всё проживание, наличными' },
    { label: 'Залог за ключи', text: '10 BYN, картой' },
    { label: 'Залог за животное', text: '30 BYN за животное за всё проживание' },
  ],
  paid: [
    { label: 'Парковка', text: '5 BYN за машину в сутки' },
    { label: 'Интернет в номере', text: '3 BYN в сутки' },
    { label: 'Завтрак', text: '15 BYN с гостя в сутки' },
    { label: 'Дополнительная кровать', text: '25 BYN в сутки' },
    { label: 'Детская кроватка', text: '10 BYN в сутки' },
    { label: 'Проживание с животными', text: '20 BYN за животное в сутки' },
    { label: 'Трансфер из аэропорта', text: '60 BYN в одну сторону' },
    { label: 'Дополнительный сбор', text: '2 BYN с гостя в сутки' },
    { label: 'Дети', text: 'Дети до 6 лет без дополнительного места — бесплатно; с 6 лет — 20 BYN в сутки' },
    { label: 'Заезд и выезд', text: 'Ранний заезд до 12:00 — 50% от стоимости суток; поздний выезд до 18:00 — 50% от стоимости суток' },
    { label: 'Визовая поддержка', text: '30 BYN с гостя за всё проживание' },
    { label: 'Неявка (no-show)', text: '100% от стоимости первых суток' },
    { label: 'Регистрация иностранных граждан', text: '5 BYN с гостя за всё проживание' },
    { label: 'Минимальный возраст для заезда', text: '18 лет' },
  ],
  extra_info: LONG_INFO,
};
const HP = (over) => Object.assign({ ok: true, hid: 8473727, ostrovok_id: 'test_hotel_do_not_book', booking_enabled: true, test_only: true,
  hotel: { description: 'Тестовый отель Островка', amenities: [], photos: ['https://cdn.worldota.net/t/1024x768/content/aa/test1.jpeg', 'https://cdn.worldota.net/t/1024x768/content/aa/test2.jpeg'], check_in: '14:00', check_out: '12:00', policy: POLICY_ALL },
  rates: [RATE_FREE, RATE_TABLE] }, over || {});

function makeStub(log) {
  const S = { hp: () => ({ status: 200, body: HP() }) };
  async function handler(route) {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    log.push({ path: p, method: req.method(), body });
    const json = (status, obj) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    if (p === '/api/ostrovok/search') return json(200, { ok: true, city: 'Минск', hotels: [HOTEL], total: 1 });
    if (p === '/api/ostrovok/hp') { const r = S.hp(body); return json(r.status, r.body); }
    if (p === '/api/ostrovok/reviews') return json(200, { reviews: [] });
    if (p === '/api/ostrovok/prebook') {
      const rt = [RATE_FREE, RATE_TABLE].find(x => x.book_hash === body.book_hash) || RATE_FREE;
      return json(200, { ok: true, changes: null, rate: Object.assign({}, rt, { book_hash: 'p-' + rt.book_hash }) });
    }
    if (p === '/api/ostrovok/order/form') return json(200, { ok: true, partner_order_id: 'ZB-ETG000001', payment: { type: 'deposit', amount: '60.00', currency_code: 'USD' } });
    if (p === '/api/ostrovok/order/finish') return json(200, { ok: true, partner_order_id: 'ZB-ETG000001', status: 'processing' });
    if (p.startsWith('/api/ostrovok/order/status/')) {
      S.statusCalls = (S.statusCalls || 0) + 1;
      return json(200, S.statusCalls < 2 ? { ok: true, status: 'processing' } : { ok: true, status: 'confirmed', partner_order_id: 'ZB-ETG000001' });
    }
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
    const u = route0.request().url();
    const ful = o => route0.fulfill(Object.assign({ headers: CORS }, o));
    if (/\.css(\?|$)|fonts\.googleapis/.test(u)) return ful({ status: 200, contentType: 'text/css', body: '' });
    if (/\.js(\?|$)/.test(u)) return ful({ status: 200, contentType: 'application/javascript', body: '' });
    if (/open-meteo/.test(u)) return ful({ status: 200, contentType: 'application/json', body: '{}' });
    return ful({ status: 200, contentType: 'image/png', body: PNG });
  });
}

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

async function newPage(browser, base, vp) {
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block' }, vp.opts));
  await routeExternal(ctx, base);
  const log = []; const st = makeStub(log);
  await ctx.route('https://api.zaedem.by/**', st.handler);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page, log, S: st.S, errors };
}

async function run(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  const allErrors = [];
  const press = async (loc) => { if (vp.mobile) await loc.tap(); else await loc.click(); };

  // ── 1. Ссылка на тестовый отель 8473727: сразу страница объекта, без поиска города ──
  {
    const { ctx, page, log, S, errors } = await newPage(browser, base, vp);
    const shot = async n => { await page.waitForTimeout(500); return page.screenshot({ path: path.join(SHOTS, vp.tag + '_' + n + '.png') }); };
    const last = p => log.filter(x => x.path === p).slice(-1)[0];
    await page.goto(base + '/' + LINK_TEST);
    await page.waitForSelector('.ost-rate-row', { timeout: 10000 });
    check('ссылка на тестовый отель → открыта страница объекта', await page.evaluate(() => document.body.classList.contains('on-hotel') && document.getElementById('hotel-page').classList.contains('open')));
    check('поиск города не запускался (нет /api/ostrovok/search)', log.filter(x => x.path === '/api/ostrovok/search').length === 0);
    const hp = last('/api/ostrovok/hp');
    check('цены через /hp по hid 8473727, даты и гости из ссылки (2 взрослых + ребёнок 5)', hp && hp.body.hid === 8473727 && hp.body.checkin === CI && hp.body.checkout === CO && hp.body.adults === 2 && JSON.stringify(hp.body.children) === '[5]', JSON.stringify(hp && hp.body));
    const ttl = await page.locator('#hp-content .hp-title').textContent();
    check('название — ETG test hotel', /^ETG test hotel/.test(ttl.trim()), ttl);
    check('тарифы показаны (2)', await page.locator('.ost-rate-row').count() === 2);
    check('фото из hp подставлены в галерею', await page.locator('#hp-content .hp-gallery img').count() === 2 && /Все фото \(2\)/.test(await page.locator('#hp-content .hp-gallery').innerText()));
    check('плашки «Подключаем онлайн-оплату» нет (booking_enabled+test_only)', !/Подключаем онлайн-оплату/.test(await page.locator('#ost-rates').innerText()));
    await page.waitForTimeout(2500);
    check('через 3 с всё ещё на объекте — без ухода на главную', await page.evaluate(() => document.body.classList.contains('on-hotel') && document.getElementById('main-page').style.display === 'none'));
    check('адрес страницы — по-прежнему ссылка на тестовый отель', /^#h=ost_8473727\|/.test(await page.evaluate(() => decodeURIComponent(location.hash))), await page.evaluate(() => location.hash));
    await shot('1_test_otel');

    // ── срок отмены: «по Минску (UTC+3)» ──
    const c0 = await page.locator('.ost-rate-row').nth(0).innerText();
    check('бесплатная отмена: «… по Минску (UTC+3)»', /Бесплатная отмена до \d\d\.\d\d\.\d{4} \d\d:\d\d по Минску \(UTC\+3\)/.test(c0), c0);
    const c1 = await page.locator('.ost-rate-row').nth(1).innerText();
    check('таблица штрафов: подпись «по Минску (UTC+3)»', /Время — по Минску \(UTC\+3\)/.test(c1) && await page.locator('.ost-rate-row').nth(1).locator('.ost-cx-tbl tr').count() === 3, c1);
    check('старой подписи «по минскому времени» нет', !/по минскому времени/.test(await page.locator('#ost-rates').innerText()));
    await page.locator('.ost-rate-row').nth(1).scrollIntoViewIfNeeded();
    await shot('2_otmena_utc3');

    // ── «Условия проживания»: все разделы, без обрезки, аккуратно ──
    const pol = page.locator('#hp-policy');
    check('блок «Условия проживания» есть', await pol.count() === 1);
    const pt = await pol.innerText();
    const want = ['бесконтактное'].concat(POLICY_ALL.deposit.map(d => d.label), POLICY_ALL.deposit.map(d => d.text), POLICY_ALL.paid.map(d => d.label + ' — ' + d.text));
    const miss = want.filter(w => pt.indexOf(w) < 0);
    check('все разделы показаны (' + want.length + ' строк: заселение, 3 залога, 14 разделов, в т. ч. дети, заезд/выезд, визы, no-show)', miss.length === 0, 'нет: ' + miss.join(' | '));
    check('сведения от объекта: «Показать полностью» раскрывает весь текст', await pol.locator('.hp-pol-more').count() === 1);
    await press(pol.locator('.hp-pol-more'));
    check('после раскрытия текст целиком', (await pol.innerText()).replace(/\s+/g, ' ').indexOf(LONG_INFO.replace(/\s+/g, ' ').trim()) >= 0);
    const polBox = await pol.boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    check('блок помещается по ширине экрана', polBox && polBox.x >= 0 && polBox.x + polBox.width <= vw + 1, JSON.stringify(polBox));
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('#hp-policy .hp-pol-row, #hp-policy .hp-pol-v, #hp-policy .hp-pol-k')).filter(e => e.scrollWidth > e.clientWidth + 1).length);
    check('строки условий не вылезают за край', overflow === 0, String(overflow));
    if (vp.mobile) check('телефон: подпись над значением (колонкой)', await page.evaluate(() => getComputedStyle(document.querySelector('#hp-policy .hp-pol-row')).flexDirection === 'column'));
    await pol.scrollIntoViewIfNeeded();
    await shot('3_usloviya');

    // ── 2. Тестовая бронь: кнопка активна → order/form → finish → status → «Бронь подтверждена!» ──
    await page.evaluate(() => ostSelectRate(0));
    await page.waitForSelector('#ost-afn0', { timeout: 8000 });
    const btn = page.locator('#bm-body .btn-pay');
    check('подпись кнопки — «Тестовая бронь (без оплаты)»', /Тестовая бронь \(без оплаты\)/.test(await btn.innerText()), await btn.innerText());
    check('нет «Скоро подключим онлайн-оплату» и серого вида', !/Скоро подключим онлайн-оплату/.test(await page.locator('#bm-body').innerText()) && !(await btn.getAttribute('class')).includes('btn-pay-soon'));
    check('до согласий кнопка ждёт галочки (как всегда)', await btn.isDisabled());
    const fm = await page.locator('#bm-body').innerText();
    check('в форме срок отмены «по Минску (UTC+3)»', /по Минску \(UTC\+3\)/.test(fm));
    const fill = async (vals) => { for (const [id, v] of Object.entries(vals)) await page.fill('#' + id, v); };
    await fill({ 'ost-afn0': 'Test', 'ost-aln0': 'Adult', 'ost-afn1': 'Test', 'ost-aln1': 'Adulttwo', 'ost-cfn0': 'Test', 'ost-cln0': 'Child', 'f-em': 'test@example.com', 'f-ph': '+375 29 000-00-00' });
    await press(page.locator('#bm-body label.bk-check .bx').nth(0)); await page.waitForTimeout(500);
    await press(page.locator('#bm-body label.bk-check .bx').nth(1)); await page.waitForTimeout(300);
    check('с согласиями кнопка активна', await btn.isEnabled(), JSON.stringify(await page.evaluate(() => [document.getElementById('cons-offer').checked, document.getElementById('cons-pd').checked, document.querySelectorAll('#bm-body .bk-check').length])));
    await btn.scrollIntoViewIfNeeded();
    await shot('4_testovaya_bron_forma');
    await press(btn);
    await page.waitForSelector('#bm-body .success', { timeout: 15000 });
    const paths = log.map(x => x.path);
    const iF = paths.indexOf('/api/ostrovok/order/form'), iN = paths.indexOf('/api/ostrovok/order/finish'), iS = paths.findIndex(x => x.startsWith('/api/ostrovok/order/status/'));
    check('по нажатию: order/form → order/finish → order/status', iF >= 0 && iN > iF && iS > iN, paths.filter(x => /order/.test(x)).join(' → '));
    const fin = last('/api/ostrovok/order/finish');
    check('в finish — тестовый отель, 3 гостя, согласия', fin && fin.body.hotel_id === 'ost_8473727' && fin.body.guests.length === 3 && fin.body.consents.offer === true && fin.body.consents.pdn === true, JSON.stringify(fin && fin.body).slice(0, 300));
    const ok = await page.locator('#bm-body').innerText();
    check('экран «Бронь подтверждена!» с номером ZB-ETG000001', /Бронь подтверждена!/.test(ok) && /ZB-ETG000001/.test(ok));
    await shot('5_bron_podtverzhdena');
    await page.evaluate(() => closeBK());

    // ── 3. booking_enabled без test_only — кнопка выключена, как сейчас ──
    const offCase = async (name, over) => {
      S.hp = () => ({ status: 200, body: HP(over) });
      await page.evaluate(() => loadOstRates(curHotel));
      await page.waitForSelector('.ost-rate-row', { timeout: 8000 });
      await page.evaluate(() => ostSelectRate(0));
      await page.waitForSelector('#ost-afn0', { timeout: 8000 });
      await fill({ 'ost-afn0': 'Test', 'ost-aln0': 'Adult', 'ost-afn1': 'Test', 'ost-aln1': 'Adulttwo', 'ost-cfn0': 'Test', 'ost-cln0': 'Child', 'f-em': 'test@example.com', 'f-ph': '+375 29 000-00-00' });
      await press(page.locator('#bm-body label.bk-check .bx').nth(0)); await page.waitForTimeout(500);
      await press(page.locator('#bm-body label.bk-check .bx').nth(1)); await page.waitForTimeout(300);
      const b = page.locator('#bm-body .btn-pay');
      const t = await page.locator('#bm-body').innerText();
      const n0 = log.filter(x => x.path === '/api/ostrovok/order/form').length;
      await b.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      check(name + ' → кнопка выключена, «Забронировать и оплатить», «Скоро подключим онлайн-оплату»', await b.isDisabled() && /Забронировать и оплатить/.test(await b.innerText()) && /Скоро подключим онлайн-оплату/.test(t) && !/Тестовая бронь/.test(t));
      check(name + ' → нажатие ничего не отправляет', log.filter(x => x.path === '/api/ostrovok/order/form').length === n0);
      await page.evaluate(() => closeBK());
    };
    await offCase('booking_enabled без test_only', { test_only: false });
    await shot('6_bez_test_only');
    await offCase('booking_enabled без поля test_only', { test_only: undefined });
    await offCase('test_only без booking_enabled', { booking_enabled: false });
    await offCase('test_only:"1" (не true)', { test_only: '1' });

    // ── F5 на странице тестового отеля — остаёмся на нём ──
    S.hp = () => ({ status: 200, body: HP() });
    await page.reload();
    await page.waitForSelector('.ost-rate-row', { timeout: 10000 });
    check('F5 → снова тестовый отель с тарифами', await page.evaluate(() => document.body.classList.contains('on-hotel') && curHotel && curHotel.id === 'ost_8473727'));
    check('нет горизонтальной прокрутки', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ── второй тестовый отель 8526976 ──
  {
    const { ctx, page, log, S, errors } = await newPage(browser, base, vp);
    S.hp = () => ({ status: 200, body: HP({ hid: 8526976, ostrovok_id: 'test_hotel', hotel: { description: '', amenities: [], photos: [], policy: null } }) });
    await page.goto(base + '/' + LINK_TEST2);
    await page.waitForSelector('.ost-rate-row', { timeout: 10000 });
    const hp = log.filter(x => x.path === '/api/ostrovok/hp').slice(-1)[0];
    check('ссылка на 8526976 → страница объекта, /hp по hid 8526976, без поиска', hp && hp.body.hid === 8526976 && log.filter(x => x.path === '/api/ostrovok/search').length === 0);
    check('без фото в hp — заготовка без фото, страница цела', await page.locator('#hp-content .hp-gallery img').count() === 0 && /^ETG test hotel/.test((await page.locator('#hp-content .hp-title').textContent()).trim()));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ── 4. Обычный отель по ссылке — как раньше: через поиск города ──
  {
    const { ctx, page, log, errors } = await newPage(browser, base, vp);
    await page.goto(base + '/' + LINK_USUAL);
    await page.waitForSelector('.ost-rate-row', { timeout: 10000 });
    const srch = log.filter(x => x.path === '/api/ostrovok/search');
    const hp = log.filter(x => x.path === '/api/ostrovok/hp').slice(-1)[0];
    check('обычный отель по ссылке: поиск города, затем объект (hid 777)', srch.length >= 1 && hp && hp.body.hid === 777 && /^Обычный отель/.test((await page.locator('#hp-content .hp-title').textContent()).trim()));
    check('у обычного отеля заготовки ETG нет', await page.evaluate(() => !HOTELS.some(h => /ETG test hotel/.test(h.name_ru || ''))));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ── 5. Главная и выдача — как в main ──
  if (OLD_HTML) {
    const snap = async (prefix) => {
      const { ctx, page, errors } = await newPage(browser, base, vp);
      await page.goto(base + prefix + '/');
      await page.waitForTimeout(1200);
      const main = await page.evaluate(() => document.getElementById('main-page').innerHTML);
      const shotMain = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      await page.evaluate(d => {
        window._capState = window._capState || {};
        Object.assign(window._capState, { city: 'Минск', din: new Date(d[0] + 'T00:00:00'), dout: new Date(d[1] + 'T00:00:00'), adults: 2, kids: 0, childAges: [], gDone: true });
        dIn = new Date(window._capState.din); dOut = new Date(window._capState.dout); gCnt = 2;
        serpOpen();
      }, [CI, CO]);
      await page.waitForTimeout(1800);
      const serp = await page.evaluate(() => document.getElementById('serp-page').innerText);
      const shotSerp = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      allErrors.push(...errors);
      await ctx.close();
      return { main, serp, shotMain, shotSerp };
    };
    const a = await snap('/old'), b = await snap('');
    check('главная: разметка как в main', a.main === b.main);
    check('выдача: содержимое как в main', a.serp === b.serp && /Обычный отель/.test(b.serp));
    check('главная: снимок экрана совпадает с main пиксель в пиксель', Buffer.compare(a.shotMain, b.shotMain) === 0);
    check('выдача: снимок экрана совпадает с main пиксель в пиксель', Buffer.compare(a.shotSerp, b.shotSerp) === 0);
    fs.writeFileSync(path.join(SHOTS, vp.tag + '_7_glavnaya.png'), b.shotMain);
    fs.writeFileSync(path.join(SHOTS, vp.tag + '_8_vydacha.png'), b.shotSerp);
  }

  check('ошибок JS в консоли нет', allErrors.length === 0, allErrors.join(' | '));
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch();
  try {
    await run(browser, base, { name: 'Телефон 390×844 (тач)', tag: '390', mobile: true, opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Europe/Minsk', locale: 'ru-RU' } });
    await run(browser, base, { name: 'Телефон 360×740', tag: '360', mobile: false, opts: { viewport: { width: 360, height: 740 }, timezoneId: 'Europe/Minsk', locale: 'ru-RU' } });
    await run(browser, base, { name: 'ПК 1366×768 (пояс Токио)', tag: '1366', mobile: false, opts: { viewport: { width: 1366, height: 768 }, timezoneId: 'Asia/Tokyo', locale: 'ru-RU' } });
  } finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  fs.writeFileSync(path.join(__dirname, 'result_18_10.json'), JSON.stringify(results, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
