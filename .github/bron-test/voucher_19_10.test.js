// 19.10: «Мои брони» → «Распечатать ваучер», «Как заселиться» и подпись платформы — под реальные поля бэкенда порции 39
// (zaedem-backend#21: GET /api/bookings/booking/:num и GET /api/bookings/booking/:num/checkin?email=). Что проверяется:
//  1) время и способ оплаты — готовые тексты сервера (check_in_text «с 15:00», check_out_text «до 12:00»,
//     «по правилам объекта», payment_method_ru «Банковская карта»); сырых «15:00:00», «card» на экране нет;
//  2) ручка «Как заселиться»: 200 {available:true} — раскрывающийся блок в «Моих бронях» и блок в ваучере (ключи, инструкция,
//     телефон/почта с tel:/mailto:, мессенджеры хозяина, адрес и ссылки на карту из map); 403/409/410, ошибка, мусор — блока нет,
//     ваучер как раньше; checkin_pending — «Сведения о заселении придут в письме»; отменённая бронь — без запроса и без контактов;
//  3) «Как добраться» (directions) — после адреса, в кабинете и в ваучере; нет поля — блока нет;
//  4) кнопки «Скачать PDF» и надписи «Тестовая бронь» на странице нет (сервер их не отдаёт; способ оплаты — как прислал сервер);
//  5) чужой HTML и небезопасные ссылки в ответах не исполняются; подпись платформы «Белорусская платформа бронирования
//     жилья» — в ваучере, на главной, в title/description, manifest и contacts.html;
//  6) ошибок в консоли нет, горизонтальной прокрутки нет (кабинет и ваучер).
// Все ответы API — заглушки, сайт отдаётся локально. Запуск из корня репозитория:
//   node .github/bron-test/voucher_19_10.test.js        (ZB_VP=390|360|1366 — только один экран)
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const cp = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(cp.execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_voucher_19_10');
fs.mkdirSync(SHOTS, { recursive: true });
const SIGN = 'Белорусская платформа бронирования жилья';

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.writeHead(404); return resp.end('nf'); }
      const ct = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(f)] || 'application/octet-stream';
      resp.writeHead(200, { 'Content-Type': ct });
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const CORS = { 'Access-Control-Allow-Origin': '*' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const CI = ymd(new Date(Date.now() + 30 * 86400000)), CO = ymd(new Date(Date.now() + 32 * 86400000));
const EMAIL = 'guest@example.com';
const LONG_MAIL = 'very.long.mail.address.of.the.hotel.reception.desk@some-very-long-domain-name-for-testing-print-layout.example.com';
const MAP = { yandex: 'https://yandex.by/maps/?pt=27.5,53.9&z=16&l=map', google: 'https://www.google.com/maps/search/?api=1&query=53.9,27.5' };

// ── ответ GET /api/bookings/booking/:num — поля как в routes/bookings.js бэкенда (порция 39) ──
const BASE = { hotel_id: '777', source: 'direct', hotel_name: 'Усадьба «Тихий берег»', room_name: 'Стандарт', guest_name: 'Иван Петров', guest_email: EMAIL, guest_phone: '+375291112233',
  check_in: CI, check_out: CO, nights: 2, guests_count: 2, total_price: '420.00', currency: 'BYN', payment_method: 'card', status: 'confirmed',
  cancel_rules: 'Бесплатная отмена за 3 дня до заезда.', hotel_address: 'Минская обл., д. Тихая, 5', check_in_time: '15:00', check_out_time: '12:00',
  check_in_text: 'с 15:00', check_out_text: 'до 12:00', payment_method_ru: 'Банковская карта', manage_token: 'tok', created_at: CI };
const mk = (num, o) => Object.assign({}, BASE, { booking_num: num }, o || {});
const BK = {
  bare: mk('ZB-100001'),                                                    // ручка отвечает 403
  ostFull: mk('ZB-100002', { source: 'ostrovok', hotel_id: '8001', onsite_fees: 'Уборка — 20 BYN\nДепозит за ключи — 50 BYN', house_rules: 'Не курить в номере.\nТишина с 23:00.' }),       // Островок, всё есть, directions есть
  ostNoDir: mk('ZB-100003', { source: 'ostrovok', hotel_id: '8002' }),      // Островок, directions нет
  direct: mk('ZB-100004'),                                                  // своя бронь: host
  pending: mk('ZB-100005', { source: 'ostrovok', hotel_id: '8003' }),       // Островок не ответил
  c409: mk('ZB-100006'), c410: mk('ZB-100007'),
  cancelled: mk('ZB-100008', { status: 'cancelled', hotel_phone: '+375 17 999-88-77', hotel_tg: '@secret_tg' }),
  noTime: mk('ZB-100009', { check_in_text: 'по правилам объекта', check_out_text: 'по правилам объекта', payment_method: 'erip', payment_method_ru: 'ЕРИП', hotel_address: null, cancel_rules: null }),
  testBk: mk('ZB-100010', { source: 'ostrovok', hotel_id: '8473727', payment_method_ru: 'Банковская карта' }),   // страница сама «тестовость» не определяет
  oldSrv: mk('ZB-100011', { check_in_text: undefined, check_out_text: undefined, payment_method_ru: undefined, check_in_time: '15:00:00', check_out_time: '12:00:00' }),
  pdf: mk('ZB-100012', { voucher_pdf_url: 'https://api.zaedem.by/x.pdf', pdf_url: '/api/x.pdf', is_test: true }),
  slow: mk('ZB-100013', { source: 'ostrovok', hotel_id: '8004' }),
  broken: mk('ZB-100014'), garbage: mk('ZB-100015'),
  evil: mk('ZB-100016', { hotel_address: '<img src=x onerror="window.__xss=1"> ул. Злая, 1', cancel_rules: '<i onmouseover="window.__xss=6">правила</i>', payment_method_ru: '<b>Карта</b>', onsite_fees: '<img src=x onerror="window.__xss=8">сбор', house_rules: '<svg onload="window.__xss=9">тишина' }),
};

// ── ответы GET /api/bookings/booking/:num/checkin?email= — форма services/stay_info.js guestBlock ──
const GB = (num, o) => Object.assign({ available: true, status: 'confirmed', booking_num: num, hotel_name: BASE.hotel_name, address: BASE.hotel_address, map: MAP,
  check_in: CI, check_out: CO, check_in_ru: '18 ноября 2026 г.', check_out_ru: '20 ноября 2026 г.', check_in_time: '15:00', check_out_time: '12:00',
  check_in_text: 'с 15:00', check_out_text: 'до 12:00', checkin: null, host: null, payment_method_ru: 'Банковская карта' }, o || {});
const OST_CK = { contactless: true, keys: 'Ключница (сейф для ключей)', keys_address: 'Д. Тихая, 5, калитка справа', instructions: 'Код ключницы пришлём за час до заезда.\nПарковка во дворе.',
  extra_info: 'Заселение по паспорту.', phone: '+375 17 111-22-33', email: LONG_MAIL };
const DIRECTIONS = 'От остановки «Центр» — 5 минут пешком.\nПоверните налево у магазина.';
const CHECKIN = {
  'ZB-100002': { body: GB('ZB-100002', { checkin: OST_CK, checkin_pending: false, directions: DIRECTIONS }) },
  'ZB-100003': { body: GB('ZB-100003', { checkin: OST_CK, checkin_pending: false }) },
  'ZB-100004': { body: GB('ZB-100004', { host: { phone: '+375 29 123-45-67', telegram: 'https://t.me/tihiy_bereg', whatsapp: 'https://wa.me/375291234567', viber: 'viber://chat?number=%2B375291234567' } }) },
  'ZB-100005': { body: GB('ZB-100005', { checkin: null, checkin_pending: true }) },
  'ZB-100006': { status: 409, body: { error: 'Сведения о заселении — только для подтверждённой брони.', status: 'pending', available: false } },
  'ZB-100007': { status: 410, body: { error: 'Дата выезда прошла — сведения о заселении больше не показываются.', available: false } },
  'ZB-100008': { body: GB('ZB-100008', { host: { phone: '+375 17 999-88-77', telegram: 'https://t.me/secret_tg', whatsapp: null, viber: null }, checkin: { keys: 'Секретные ключи' } }) },
  'ZB-100013': { delay: 700, body: GB('ZB-100013', { checkin: { keys: 'Ключи на стойке', phone: '+375 17 000-11-22' }, checkin_pending: false }) },
  'ZB-100014': { status: 500, body: { error: 'Ошибка сервера' } },
  'ZB-100015': { raw: 'это не JSON <html>' },
  'ZB-100016': { body: GB('ZB-100016', { address: '<img src=x onerror="window.__xss=2"> ул. Злая, 1', map: { yandex: 'javascript:window.__xss=3', google: 'https://www.google.com/maps/?q=1&x=2' },
    directions: '<script>window.__xss=4</script>Идти прямо', checkin: { keys: '<b>ключи</b>', phone: '<b>+375</b>', email: 'не-почта<script>' },
    host: { phone: null, telegram: 'javascript:window.__xss=5', whatsapp: 'data:text/html,x', viber: 'viber://chat?number=%2B375291234567' } }) },
};

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

async function setup(browser, base, vp, tz) {
  const reqLog = [];
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block', timezoneId: tz || 'Europe/Minsk', locale: 'ru-RU' }, vp.opts));
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith('https://api.zaedem.by'), route => {
    const u = route.request().url();
    if (/\.css(\?|$)|fonts\.googleapis/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'text/css', body: '' });
    if (/\.js(\?|$)/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/javascript', body: '' });
    return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG });
  });
  await ctx.route('https://api.zaedem.by/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const json = (status, obj) => route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(obj) }).catch(() => {});
    reqLog.push({ path: p, search: new URL(req.url()).search });
    const ck = p.match(/^\/api\/bookings\/booking\/([^/]+)\/checkin$/);
    if (ck) {
      const c = CHECKIN[decodeURIComponent(ck[1]).toUpperCase()];
      if (!c) return json(403, { error: 'Укажите номер брони и e-mail, который был указан при бронировании.' });
      if (c.delay) await new Promise(x => setTimeout(x, c.delay));
      if (c.raw) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: c.raw }).catch(() => {});
      return json(c.status || 200, c.body);
    }
    const m = p.match(/^\/api\/bookings\/booking\/([^/]+)$/);
    if (m) {
      const num = decodeURIComponent(m[1]).toUpperCase();
      const bk = Object.values(BK).find(b => b.booking_num === num);
      return bk ? json(200, { booking: bk }) : json(404, { error: 'Бронь не найдена' });
    }
    if (p === '/api/hotels') return json(200, { hotels: [] });
    if (p === '/api/catalog') return json(200, { ok: true, hotels: [] });
    return json(200, {});
  });
  const page = await ctx.newPage();
  const errors = [];
  const watch = pg => {
    pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  };
  watch(page);
  ctx.on('page', watch);
  return { ctx, page, errors, base, vp, reqLog };
}

const tap = (vp, loc) => vp.mobile ? loc.first().tap() : loc.first().click();

// ищем бронь по номеру и email, как гость
async function openCab(env, key) {
  const { page, base } = env;
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof openAuth === 'function' && typeof findBooking === 'function');
  await page.evaluate(() => openAuth('guest'));
  await page.locator('#bn-inp').fill(BK[key].booking_num);
  await page.locator('#be-inp').fill(EMAIL);
  await page.evaluate(() => findBooking());
  await page.waitForSelector('#cabinet-modal.open', { timeout: 5000 });
  await page.waitForTimeout(150);
}
// нажимаем «Распечатать ваучер» → окно ваучера
async function openVoucher(env) {
  const { page, vp } = env;
  const btn = page.locator('#cabinet-body button', { hasText: 'Распечатать ваучер' });
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const [pop] = await Promise.all([
    page.waitForEvent('popup', { timeout: 5000 }),
    tap(vp, btn),
  ]);
  await pop.waitForSelector('.num', { timeout: 5000 });
  return pop;
}
const vtext = pop => pop.evaluate(() => document.body.innerText);
const noHScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const cabHScroll = page => page.evaluate(() => { const b = document.getElementById('cabinet-body'); return b.scrollWidth <= b.clientWidth + 1; });
const ckLog = (env, num) => env.reqLog.filter(r => new RegExp('/' + num + '/checkin$').test(r.path));
// заголовки блоков в innerText — прописными (text-transform), поэтому ищем без учёта регистра
const has = (txt, s) => txt.toLowerCase().indexOf(s.toLowerCase()) >= 0;
const noBlocks = tx => !/Как заселиться|Контакты объекта|Открыть на карте|Как добраться|Сведения о заселении придут/i.test(tx);

async function run(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  const T = vp.tag + ': ';
  const env = await setup(browser, base, vp);
  const { page, errors } = env;
  let pop, tx;

  // ═══ 1. РУЧКА ОТВЕЧАЕТ 403 — ВАУЧЕР КАК РАНЬШЕ, ТЕКСТЫ ВРЕМЕНИ И ОПЛАТЫ — ОТ СЕРВЕРА ═══
  await openCab(env, 'bare');
  await page.waitForTimeout(250);
  check(T + 'кабинет: «Распечатать ваучер» есть; «Скачать PDF» нет', await page.locator('#cabinet-body button', { hasText: 'Распечатать ваучер' }).count() === 1 && !/PDF/i.test(await page.locator('#cabinet-body').innerText()));
  check(T + 'кабинет: ручка ответила 403 — блока «Как заселиться» нет, ошибок нет', await page.locator('#cabinet-body details.zbci').count() === 0 && ckLog(env, 'ZB-100001').length === 1);
  check(T + 'кабинет: нет горизонтальной прокрутки', await cabHScroll(page) && await noHScroll(page));
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер: «с 15:00» и «до 12:00» — тексты сервера, без секунд', /с 15:00(?!:)/.test(tx) && /до 12:00(?!:)/.test(tx) && !/\d{2}:\d{2}:\d{2}/.test(tx), tx.slice(0, 400));
  check(T + 'ваучер: подпись «' + SIGN + '», «агрегатор» нет', tx.indexOf(SIGN + ' · zaedem.by') >= 0 && !/агрегатор/i.test(tx));
  check(T + 'ваучер: «Способ оплаты» — «Банковская карта» (payment_method_ru), слова «card» нет', /Способ оплаты\s*Банковская карта/.test(tx) && !/\bcard\b/i.test(tx), tx);
  check(T + 'ваучер: адрес и правила отмены из брони', tx.indexOf('Минская обл., д. Тихая, 5') >= 0 && has(tx, 'Правила отмены') && tx.indexOf('Бесплатная отмена за 3 дня до заезда.') >= 0);
  check(T + 'ваучер без ответа ручки: нет блоков, карты, «undefined»/«null»', noBlocks(tx) && !/undefined|null|NaN/.test(tx) && !/PDF/i.test(tx) && !/Тестовая бронь/.test(tx), tx);
  check(T + 'ваучер: нет горизонтальной прокрутки', await noHScroll(pop));
  await pop.emulateMedia({ media: 'print' });
  check(T + 'печать: кнопка «Распечатать» скрыта, текст на месте', await pop.evaluate(() => getComputedStyle(document.querySelector('.print-btn')).display === 'none') && /до 12:00/.test(await vtext(pop)));
  await pop.screenshot({ path: path.join(SHOTS, vp.tag + '_1_vaucher_bez_otveta_ruchki.png'), fullPage: true });
  await pop.close();
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_0_kabinet_bez_bloka.png') });

  // ═══ 2. БРОНЬ ОСТРОВКА: «Как заселиться» + «Как добраться» ═══
  await openCab(env, 'ostFull');
  await page.waitForSelector('#cabinet-body details.zbci', { timeout: 4000 });
  const det = page.locator('#cabinet-body details.zbci');
  const sumBox = await det.locator('summary').boundingBox();
  check(T + 'кабинет: «Как заселиться» — раскрывающийся блок, свёрнут, кнопка ≥ 44 px', await det.evaluate(d => !d.open) && /Как заселиться/.test(await det.locator('summary').innerText()) && sumBox && sumBox.height >= 44, JSON.stringify(sumBox));
  await tap(vp, det.locator('summary'));
  await page.waitForTimeout(150);
  const dtx = await det.innerText();
  check(T + 'кабинет: раскрылся — бесконтактное, ключи, где получить, время, инструкция, сведения', await det.evaluate(d => d.open) && /Бесконтактное/.test(dtx) && dtx.indexOf('Ключница (сейф для ключей)') >= 0 && dtx.indexOf('калитка справа') >= 0 && /заезд с 15:00 · выезд до 12:00/.test(dtx) && dtx.indexOf('Код ключницы пришлём за час до заезда.') >= 0 && dtx.indexOf('Заселение по паспорту.') >= 0, dtx);
  check(T + 'кабинет: адрес и две ссылки на карту — ровно те, что прислал сервер (map.yandex, map.google)', dtx.indexOf('Минская обл., д. Тихая, 5') >= 0 && await det.locator('a', { hasText: 'Яндекс Карты' }).getAttribute('href') === MAP.yandex && await det.locator('a', { hasText: 'Google Maps' }).getAttribute('href') === MAP.google);
  check(T + 'кабинет: «Как добраться» — сразу после адреса, до «Заселение»', (() => { const l = dtx.toLowerCase(); const a = l.indexOf('минская обл.'), d = l.indexOf('как добраться'), z = l.indexOf('заселение'); return a >= 0 && d > a && z > d && dtx.indexOf('5 минут пешком') >= 0 && dtx.indexOf('Поверните налево у магазина.') >= 0; })(), dtx);
  check(T + 'кабинет: телефон — ссылка tel:, почта — ссылка mailto:', await det.locator('a[href="tel:+375171112233"]').count() === 1 && await det.locator('a[href="mailto:' + LONG_MAIL + '"]').count() === 1);
  check(T + 'ручка: один запрос на бронь, адрес /checkin (не /checkin-info), с email гостя', ckLog(env, 'ZB-100002').length === 1 && ckLog(env, 'ZB-100002')[0].path === '/api/bookings/booking/ZB-100002/checkin' && ckLog(env, 'ZB-100002')[0].search === '?email=' + encodeURIComponent(EMAIL) && !env.reqLog.some(r => /checkin-info/.test(r.path)), JSON.stringify(env.reqLog.filter(r => /checkin/.test(r.path))));
  check(T + 'кабинет: блок раскрыт — нет горизонтальной прокрутки', await cabHScroll(page) && await noHScroll(page));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_2_kabinet_kak_zaselitsya.png') });
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (Островок): адрес, «Как добраться» сразу после адреса и карты, дальше номер/статус', (() => { const l = tx.toLowerCase(); const a = l.indexOf('минская обл.'), m = l.indexOf('открыть на карте'), d = l.indexOf('как добраться'), r = l.indexOf('стандарт'); return a >= 0 && m > a && d > m && r > d && tx.indexOf('5 минут пешком') >= 0; })(), tx.slice(0, 500));
  check(T + 'ваучер (Островок): ссылки на карту — Яндекс и Google из ответа сервера', await pop.locator('a', { hasText: 'Яндекс Карты' }).getAttribute('href') === MAP.yandex && await pop.locator('a', { hasText: 'Google Maps' }).getAttribute('href') === MAP.google);
  check(T + 'ваучер (Островок): «Как заселиться» — ключи, где получить, инструкция, сведения, бесконтактное', has(tx, 'Как заселиться') && tx.indexOf('Ключница (сейф для ключей)') >= 0 && tx.indexOf('калитка справа') >= 0 && tx.indexOf('Код ключницы пришлём за час до заезда.') >= 0 && tx.indexOf('Заселение по паспорту.') >= 0 && /Бесконтактн/i.test(tx));
  check(T + 'ваучер (Островок): «Контакты объекта» — телефон и почта (tel:, mailto:), длинная почта переносится', has(tx, 'Контакты объекта') && await pop.locator('a[href="tel:+375171112233"]').count() === 1 && await pop.locator('a[href="mailto:' + LONG_MAIL + '"]').count() === 1 && await noHScroll(pop));
  check(T + 'ваучер (Островок): блоки в порядке «адрес → как добраться → контакты → как заселиться → правила отмены»', (() => { const l = tx.toLowerCase(); const o = ['минская обл.', 'как добраться', 'контакты объекта', 'как заселиться', 'правила отмены'].map(x => l.indexOf(x)); return o.every(i => i >= 0) && o.every((v, i) => !i || v > o[i - 1]); })(), tx);
  check(T + 'ваучер (Островок): «с 15:00» / «до 12:00», оплата «Банковская карта», итог 420 BYN', /с 15:00(?!:)/.test(tx) && /до 12:00(?!:)/.test(tx) && /Способ оплаты\s*Банковская карта/.test(tx) && /Итого к оплате\s*420 BYN/.test(tx));
  // 19.10: сборы на месте и правила дома — из брони (onsite_fees, house_rules), после «Итого», до «Правила отмены»
  check(T + 'ваучер (Островок): «Оплачивается на месте» — строки сборов и пометка «в сумму брони не входит»', has(tx, 'Оплачивается на месте') && tx.indexOf('Уборка — 20 BYN') >= 0 && tx.indexOf('Депозит за ключи — 50 BYN') >= 0 && /в сумму брони не входит/.test(tx), tx);
  check(T + 'ваучер (Островок): «Правила дома» из брони', has(tx, 'Правила дома') && tx.indexOf('Не курить в номере.') >= 0 && tx.indexOf('Тишина с 23:00.') >= 0, tx);
  check(T + 'ваучер (Островок): порядок «Итого → на месте → правила дома → правила отмены»', (() => { const l = tx.toLowerCase(); const o = ['итого к оплате', 'оплачивается на месте', 'правила дома', 'правила отмены'].map(x => l.indexOf(x)); return o.every(i => i >= 0) && o.every((v, i) => !i || v > o[i - 1]); })(), tx);
  check(T + 'ваучер (Островок): блоки не разрываются при печати (break-inside: avoid)', await pop.evaluate(() => { const b = Array.from(document.querySelectorAll('.vblock')); return b.length >= 4 && b.every(x => /avoid/.test(getComputedStyle(x).breakInside)); }));
  await pop.screenshot({ path: path.join(SHOTS, vp.tag + '_3_vaucher_ostrovok_vse_polya.png'), fullPage: true });
  await pop.emulateMedia({ media: 'print' });
  check(T + 'печать (Островок): блоки видны, кнопки печати нет', await pop.evaluate(() => getComputedStyle(document.querySelector('.print-btn')).display === 'none') && has(await vtext(pop), 'Как заселиться'));
  await pop.close();

  // ═══ 3. БЕЗ directions — БЛОКА «КАК ДОБРАТЬСЯ» НЕТ ═══
  await openCab(env, 'ostNoDir');
  await page.waitForSelector('#cabinet-body details.zbci', { timeout: 4000 });
  await tap(vp, page.locator('#cabinet-body details.zbci summary'));
  await page.waitForTimeout(150);
  check(T + 'кабинет без directions: «Как добраться» нет, остальное на месте', !has(await page.locator('#cabinet-body details.zbci').innerText(), 'Как добраться') && has(await page.locator('#cabinet-body details.zbci').innerText(), 'Ключница'));
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер без directions: «Как добраться» нет, «Как заселиться» есть', !has(tx, 'Как добраться') && has(tx, 'Как заселиться'));
  await pop.close();

  // ═══ 4. СВОЯ БРОНЬ: host — телефон и мессенджеры ═══
  await openCab(env, 'direct');
  await page.waitForSelector('#cabinet-body details.zbci', { timeout: 4000 });
  await tap(vp, page.locator('#cabinet-body details.zbci summary'));
  await page.waitForTimeout(150);
  const hd = page.locator('#cabinet-body details.zbci');
  check(T + 'кабинет (своя бронь): телефон хозяина — tel:, Telegram, WhatsApp, Viber — ссылками', await hd.locator('a[href="tel:+375291234567"]').count() === 1 && await hd.locator('a[href="https://t.me/tihiy_bereg"]').count() === 1 && await hd.locator('a[href="https://wa.me/375291234567"]').count() === 1 && await hd.locator('a[href="viber://chat?number=%2B375291234567"]').count() === 1, await hd.innerText());
  check(T + 'кабинет (своя бронь): подписи «@tihiy_bereg», «+375291234567»', /@tihiy_bereg/.test(await hd.innerText()) && /\+375291234567/.test(await hd.innerText()));
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (своя бронь): «Контакты объекта» — телефон и мессенджеры, «Как заселиться» нет (у своей брони ключей нет)', has(tx, 'Контакты объекта') && /Telegram[\s\S]*@tihiy_bereg/.test(tx) && /WhatsApp/.test(tx) && /Viber/.test(tx) && await pop.locator('a[href="tel:+375291234567"]').count() === 1 && !/Как заселиться/i.test(tx.replace(/Контакты[\s\S]*/i, '')) , tx);
  await pop.screenshot({ path: path.join(SHOTS, vp.tag + '_4_vaucher_svoya_bron.png'), fullPage: true });
  await pop.close();

  // ═══ 5. ОСТРОВОК НЕ ОТВЕТИЛ (checkin_pending) ═══
  await openCab(env, 'pending');
  await page.waitForSelector('#cabinet-body details.zbci', { timeout: 4000 });
  await tap(vp, page.locator('#cabinet-body details.zbci summary'));
  await page.waitForTimeout(150);
  check(T + 'кабинет (checkin_pending): «Сведения о заселении придут в письме», адрес и карта на месте', has(await page.locator('#cabinet-body details.zbci').innerText(), 'Сведения о заселении придут в письме') && has(await page.locator('#cabinet-body details.zbci').innerText(), 'Яндекс Карты'));
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (checkin_pending): «Сведения о заселении придут в письме», контактов нет', has(tx, 'Сведения о заселении придут в письме') && !has(tx, 'Контакты объекта') && !has(tx, 'Как получить ключи'), tx);
  await pop.close();

  // ═══ 6. 403 / 409 / 410, ОШИБКА, МУСОР, МЕДЛЕННАЯ РУЧКА ═══
  for (const [key, label] of [['c409', '409 (не подтверждена)'], ['c410', '410 (выезд прошёл)'], ['broken', '500'], ['garbage', 'не JSON']]) {
    await openCab(env, key);
    await page.waitForTimeout(300);
    check(T + 'ручка ' + label + ': блока в кабинете нет', await page.locator('#cabinet-body details.zbci').count() === 0);
    pop = await openVoucher(env);
    tx = await vtext(pop);
    check(T + 'ручка ' + label + ': ваучер как раньше — «с 15:00», без новых блоков, без «undefined»', /с 15:00/.test(tx) && noBlocks(tx) && !/undefined|null|NaN/.test(tx));
    await pop.close();
  }
  await openCab(env, 'slow');
  pop = await openVoucher(env);   // «Распечатать» сразу, ответ ручки ещё не пришёл
  tx = await vtext(pop);
  check(T + 'медленная ручка: ваучер дождался ответа — «Как заселиться» и телефон', has(tx, 'Как заселиться') && tx.indexOf('+375 17 000-11-22') >= 0 && tx.indexOf('Ключи на стойке') >= 0, tx);
  await pop.close();

  // ═══ 7. ОТМЕНЁННАЯ БРОНЬ — БЕЗ ЗАПРОСА И БЕЗ КОНТАКТОВ ═══
  env.reqLog.length = 0;
  await openCab(env, 'cancelled');
  await page.waitForTimeout(400);
  check(T + 'отменённая бронь: запроса к ручке нет, блока в кабинете нет', ckLog(env, 'ZB-100008').length === 0 && await page.locator('#cabinet-body details.zbci').count() === 0);
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'отменённая бронь: в ваучере нет контактов, ключей, карты; статус «Отменено»; адрес и правила отмены остались', noBlocks(tx) && tx.indexOf('+375 17 999-88-77') < 0 && tx.indexOf('secret_tg') < 0 && tx.indexOf('Секретн') < 0 && /Отменено/.test(tx) && tx.indexOf('Минская обл., д. Тихая, 5') >= 0 && has(tx, 'Правила отмены'), tx);
  check(T + 'отменённая бронь: в ваучере нет ссылок tel:', await pop.locator('a[href^="tel:"]').count() === 0);
  await pop.close();

  // ═══ 8. ВРЕМЯ НЕИЗВЕСТНО / СТАРЫЙ ОТВЕТ СЕРВЕРА / ТЕСТОВЫЙ ОТЕЛЬ / PDF ═══
  await openCab(env, 'noTime');
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (времени нет): «по правилам объекта» у заезда и выезда, оплата «ЕРИП», адреса и правил отмены нет', (tx.match(/по правилам объекта/g) || []).length === 2 && /Способ оплаты\s*ЕРИП/.test(tx) && !/📍/.test(tx) && !has(tx, 'Правила отмены'), tx);
  await pop.close();
  await openCab(env, 'oldSrv');
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (сервер без текстов времени/оплаты): «по правилам объекта» и «—», сырых «15:00:00» и «card» нет — своих пересчётов страница не делает', (tx.match(/по правилам объекта/g) || []).length === 2 && /Способ оплаты\s*—/.test(tx) && !/15:00|\bcard\b/i.test(tx), tx);
  await pop.close();
  await openCab(env, 'testBk');
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (hid тестового отеля): способ оплаты — как прислал сервер, надписи «Тестовая бронь» от страницы нет', /Способ оплаты\s*Банковская карта/.test(tx) && !/Тестовая бронь/.test(tx), tx);
  await pop.close();
  await openCab(env, 'pdf');
  check(T + 'кабинет (voucher_pdf_url / pdf_url / is_test в ответе): кнопки «Скачать PDF» нет, ссылок на PDF нет', !/PDF/i.test(await page.locator('#cabinet-body').innerText()) && await page.locator('#cabinet-body a[href*=".pdf"]').count() === 0 && await page.locator('#cabinet-body a[download]').count() === 0);
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (is_test в ответе): надписи «Тестовая бронь» нет, оплата «Банковская карта»', !/Тестовая бронь/.test(tx) && /Банковская карта/.test(tx));
  await pop.close();

  // ═══ 9. ЧУЖОЙ HTML И ОПАСНЫЕ ССЫЛКИ ═══
  await openCab(env, 'evil');
  await page.waitForSelector('#cabinet-body details.zbci', { timeout: 4000 });
  await tap(vp, page.locator('#cabinet-body details.zbci summary'));
  await page.waitForTimeout(150);
  pop = await openVoucher(env);
  tx = await vtext(pop);
  const evil = await pop.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('img').length, handlers: document.querySelectorAll('[onerror],[onmouseover]').length,
    badLinks: Array.from(document.querySelectorAll('a')).filter(a => /^(javascript|data):/i.test(a.getAttribute('href') || '')).length, scripts: document.querySelectorAll('body script').length }));
  check(T + 'ваучер (чужой HTML в ответах): теги показаны текстом, не исполняются', evil.xss === 0 && evil.handlers === 0 && evil.imgs === 0 && evil.scripts === 0 && tx.indexOf('<img src=x') >= 0 && tx.indexOf('<script>window.__xss=4</script>Идти прямо') >= 0, JSON.stringify(evil));
  check(T + 'ваучер: javascript: / data: не становятся ссылками; Яндекс-ссылки нет, Google-ссылка осталась; viber:// оставлен', evil.badLinks === 0 && await pop.locator('a', { hasText: 'Яндекс Карты' }).count() === 0 && await pop.locator('a', { hasText: 'Google Maps' }).count() === 1 && await pop.locator('a[href^="viber://chat"]').count() === 1 && await pop.locator('a[href^="tel:"]').count() === 0 && await pop.locator('a[href^="mailto:"]').count() === 1 /* только «booking@» в подвале */, JSON.stringify(evil));
  await pop.close();
  check(T + 'главное окно: чужой код не выполнился, в кабинете нет опасных ссылок', await page.evaluate(() => !window.__xss && !Array.from(document.querySelectorAll('#cabinet-body a')).some(a => /^(javascript|data):/i.test(a.getAttribute('href') || ''))));

  // ═══ 10. ПОДПИСЬ ПЛАТФОРМЫ НА ГЛАВНОЙ ═══
  await page.goto(base + '/', { waitUntil: 'load' });
  const home = await page.evaluate(() => ({ title: document.title, desc: (document.querySelector('meta[name="description"]') || {}).content || '', og: (document.querySelector('meta[property="og:title"]') || {}).content || '',
    ogd: (document.querySelector('meta[property="og:description"]') || {}).content || '', foot: (document.querySelector('footer .ft-desc') || {}).textContent || '' }));
  check(T + 'главная: подвал начинается с подписи платформы', home.foot.indexOf(SIGN) === 0, home.foot);
  check(T + 'главная: title и og:title содержат подпись платформы', home.title.indexOf(SIGN) >= 0 && home.og.indexOf(SIGN) >= 0, home.title + ' | ' + home.og);
  check(T + 'главная: description и og:description начинаются с подписи', home.desc.indexOf(SIGN) === 0 && home.ogd.indexOf(SIGN) === 0, home.desc + ' | ' + home.ogd);
  check(T + 'нет горизонтальной прокрутки на главной', await noHScroll(page));
  check(T + 'ошибок JS в консоли нет (главная и окна ваучера)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await env.ctx.close();

  // ═══ 11. ДРУГОЙ ЧАСОВОЙ ПОЯС — ТЕКСТЫ ВРЕМЕНИ ТЕ ЖЕ ═══
  if (vp.tag === '390') {
    for (const tz of ['Pacific/Auckland', 'America/Los_Angeles']) {
      const e2 = await setup(browser, base, vp, tz);
      await openCab(e2, 'ostFull');
      const p2 = await openVoucher(e2);
      const t2 = await vtext(p2);
      check(T + 'пояс ' + tz + ': «с 15:00» / «до 12:00», ошибок в консоли нет', /с 15:00(?!:)/.test(t2) && /до 12:00(?!:)/.test(t2) && e2.errors.length === 0, t2.slice(0, 200) + ' ' + e2.errors.slice(0, 2).join(' | '));
      await e2.ctx.close();
    }
  }
}

// ═══ ПОДПИСЬ ПЛАТФОРМЫ В ФАЙЛАХ (не зависит от экрана) ═══
function filesCheck() {
  console.log('\n=== файлы: подпись платформы ===');
  const files = fs.readdirSync(ROOT).filter(f => /\.(html|webmanifest|js)$/.test(f));
  const BAD = /агрегатор|аггрегатор|(?<!Белорусская )платформа бронирования жилья/gi;
  for (const f of files) {
    const bad = fs.readFileSync(path.join(ROOT, f), 'utf8').match(BAD) || [];
    check(f + ': прежних вариантов («агрегатор…», «Платформа бронирования жилья» без «Белорусская») нет', bad.length === 0, bad.join(' | '));
  }
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  check('manifest: name и description содержат подпись платформы, short_name не менялся', mf.name.indexOf(SIGN) >= 0 && mf.description.indexOf(SIGN) === 0 && mf.short_name === 'Заедем.by', mf.name + ' | ' + mf.description);
  const tw = (idx.match(/<meta name="twitter:(title|description)" content="([^"]*)"/g) || []);
  check('index.html: twitter:title и twitter:description — подпись платформы', tw.length === 2 && tw.every(x => x.indexOf(SIGN) >= 0), tw.join(' | '));
  const ct = fs.readFileSync(path.join(ROOT, 'contacts.html'), 'utf8');
  check('contacts.html: description — подпись платформы', /<meta name="description" content="[^"]*Белорусская платформа бронирования жилья/.test(ct));
  // страница не пересчитывает время и не знает про PDF/тестовую бронь — только показывает тексты сервера
  const code = idx.slice(idx.indexOf('function zbCkStr'), idx.indexOf('function cancelBooking'));
  check('index.html: в коде ваучера нет своих пересчётов времени/оплаты и кнопки PDF (zbHHMM, zbPayLabel, zbIsTestBk, zbPdfUrl, 8473727)', !/zbHHMM|zbPayLabel|zbIsTestBk|zbPdfUrl|8473727|Скачать PDF|Тестовая бронь/.test(code));
  check('index.html: ручка — /checkin, не /checkin-info', /ZB_CHECKIN_PATH='\/api\/bookings\/booking\/\{num\}\/checkin'/.test(idx) && !/checkin-info/.test(idx));
}

(async () => {
  filesCheck();
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch();
  const VPS = [
    { tag: '390', name: '390×844 (тач)', mobile: true, opts: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { tag: '360', name: '360×740 (тач)', mobile: true, opts: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { tag: '1366', name: '1366×768', mobile: false, opts: { viewport: { width: 1366, height: 768 } } },
  ].filter(v => !process.env.ZB_VP || process.env.ZB_VP === v.tag);
  for (const vp of VPS) await run(browser, base, vp);
  await browser.close(); srv.close();
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  if (bad.length) { console.log('НЕ ПРОШЛИ:'); bad.forEach(b => console.log(' - ' + b.name + (b.info ? ' — ' + b.info : ''))); }
  fs.writeFileSync(path.join(__dirname, 'result_voucher_19_10' + (process.env.ZB_VP ? '_' + process.env.ZB_VP : '') + '.json'), JSON.stringify({ total: results.length, failed: bad.length, results }, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('ТЕСТ УПАЛ:', e); process.exit(2); });
