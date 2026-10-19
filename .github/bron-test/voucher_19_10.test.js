// 19.10: «Мои брони» → «Распечатать ваучер» и подпись платформы. Что проверяется:
//  1) время заезда/выезда в ваучере — «с 15:00 / до 12:00» (ЧЧ:ММ, без секунд и без сдвига пояса: тот же результат при
//     часовых поясах Минск / Окленд / Лос-Анджелес); нет времени — «по правилам объекта»; ISO-строка читается буквально;
//  2) новые блоки ваучера (адрес + «Открыть на карте», контакты объекта, «Как заселиться», сборы на месте, правила отмены,
//     правила дома) показываются, когда сервер прислал поля; без полей — ваучер как раньше, без пустых заголовков и без
//     «undefined»/«null»; чужой HTML из полей не исполняется, небезопасные ссылки (javascript:) не становятся ссылками;
//  3) «Способ оплаты»: card → «Банковская карта»; тестовая бронь → «Тестовая бронь, без оплаты»; на экране нет слова «card»;
//  4) «Скачать PDF» — только если сервер прислал безопасную ссылку на PDF-ваучер;
//  5) подпись платформы «Белорусская платформа бронирования жилья» — в ваучере, в подвале, в title/description,
//     в manifest и на страницах документов; прежних «агрегатор отелей» нигде нет;
//  6) «Как заселиться» (ручка бэкенда порции 39 А): раскрывающийся блок в «Моих бронях» и блок в ваучере — ключи, время,
//     инструкция, tel:/mailto:, мессенджеры, адрес и карта; ручка не ответила (404/500/мусор) — всё как раньше, без ошибок;
//     отменённая бронь — без контактов и без запроса к ручке; медленная ручка — ваучер дожидается ответа;
//  7) ошибок в консоли нет (главная и окно ваучера), горизонтальной прокрутки нет (кабинет и ваучер).
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

// ── заглушки броней: что именно присылает «сервер» ──
const BASE = { hotel_name: 'Усадьба «Тихий берег»', room_name: 'Стандарт', guest_name: 'Иван Петров', guest_email: EMAIL, guest_phone: '+375291112233',
  check_in: CI, check_out: CO, nights: 2, guests_count: 2, total_price: '420.00', currency: 'BYN', status: 'confirmed', manage_token: 'tok', created_at: CI };
const LONG_MAIL = 'very.long.mail.address.of.the.hotel.reception.desk@some-very-long-domain-name-for-testing-print-layout.example.com';
const BK = {
  // как отдаёт сервер сейчас: без телефона, мессенджеров, сборов, PDF; время — с секундами
  bare: Object.assign({}, BASE, { booking_num: 'ZB-100001', payment_method: 'card', hotel_address: 'Минская обл., д. Тихая, 5', check_in_time: '15:00:00', check_out_time: '12:00:00', cancel_rules: 'Бесплатная отмена за 3 дня до заезда.' }),
  // всё, что может прислать сервер после порции 39 А
  full: Object.assign({}, BASE, { booking_num: 'ZB-100002', payment_method: 'card', hotel_address: 'Минская обл., д. Тихая, 5', map_url: 'https://yandex.by/maps/?text=53.9,27.5',
    check_in_time: '15:00:00', check_out_time: '12:00:00', hotel_phone: '+375 17 111-22-33', hotel_email: LONG_MAIL, hotel_tg: '@tihiy_bereg', hotel_wa: '+375291234567', hotel_viber: '+375291234567',
    onsite_fees: 'Курортный сбор — 2 BYN с человека за ночь\nДепозит 50 BYN при заселении', cancel_rules: 'Бесплатная отмена за 3 дня до заезда.\nПосле — штраф за первую ночь.', house_rules: 'Не шуметь после 23:00. Без вечеринок.',
    voucher_pdf_url: 'https://api.zaedem.by/api/bookings/ZB-100002/voucher.pdf?t=abc' }),
  // отменённая бронь: контактов быть не должно, ручку не спрашиваем
  cancelled: Object.assign({}, BASE, { booking_num: 'ZB-100007', status: 'cancelled', payment_method: 'card', hotel_address: 'Минская обл., д. Тихая, 5', map_url: 'https://yandex.by/maps/?text=1,2',
    check_in_time: '15:00:00', check_out_time: '12:00:00', hotel_phone: '+375 17 999-88-77', hotel_tg: '@secret_tg', onsite_fees: 'Секретный сбор', house_rules: 'Секретные правила', cancel_rules: 'Правила отмены этого объекта.' }),
  // ручка отвечает долго
  slow: Object.assign({}, BASE, { booking_num: 'ZB-100008', payment_method: 'card', hotel_address: 'Минск, ул. Медленная, 1', check_in_time: '15:00:00', check_out_time: '12:00:00' }),
  // ручка отвечает ошибкой / мусором
  broken: Object.assign({}, BASE, { booking_num: 'ZB-100009', payment_method: 'card', hotel_address: 'Минск, ул. Сломанная, 1', check_in_time: '15:00:00', check_out_time: '12:00:00' }),
  garbage: Object.assign({}, BASE, { booking_num: 'ZB-100010', payment_method: 'card', hotel_address: 'Минск, ул. Мусорная, 1', check_in_time: '15:00:00', check_out_time: '12:00:00' }),
  // время неизвестно, оплата ЕРИП, часть блоков пустая
  noTime: Object.assign({}, BASE, { booking_num: 'ZB-100003', payment_method: 'erip', hotel_address: '', check_in_time: null, check_out_time: '', cancel_rules: null, onsite_fees: '', checkin_info: null, hotel_phone: null, voucher_pdf_url: '' }),
  // тестовая бронь Островка (в базе у неё тоже payment_method=card)
  test: Object.assign({}, BASE, { booking_num: 'ZB-100004', payment_method: 'card', is_test: true, hotel_address: 'Минск, ул. Тестовая, 1', check_in_time: '14:00:00', check_out_time: '12:00:00' }),
  // чужой HTML и небезопасные ссылки в полях — не исполняются
  evil: Object.assign({}, BASE, { booking_num: 'ZB-100005', payment_method: 'card', hotel_address: '<img src=x onerror="window.__xss=1"> ул. Злая, 1', map_url: 'javascript:window.__xss=2',
    check_in_time: '15:00:00', check_out_time: '12:00:00', hotel_phone: '<b>+375</b>', onsite_fees: '<script>window.__xss=3</script>Сбор 5 BYN', hotel_tg: 'javascript:window.__xss=4',
    voucher_pdf_url: 'javascript:window.__xss=5', cancel_rules: '<i onmouseover="window.__xss=6">правила</i>' }),
  // PDF — относительная ссылка от адреса API
  pdfRel: Object.assign({}, BASE, { booking_num: 'ZB-100006', payment_method: 'card', check_in_time: '15:00', check_out_time: '12:00', pdf_url: '/api/bookings/ZB-100006/voucher.pdf' }),
};

// ответы ручки «Как заселиться» (форма — как у services/checkin_info.js бэкенда); нет записи — 404 («нет ответа»)
const CHECKIN = {
  'ZB-100002': { body: { keys: 'Ключница (сейф для ключей)', contactless: true, address: 'Д. Тихая, 5, калитка справа', instructions: 'Код ключницы пришлём за час до заезда.\nПарковка во дворе.',
    extra_info: 'Заселение по паспорту.', phone: '+375 17 111-22-33', email: LONG_MAIL, check_in: '15:00', check_out: '12:00' } },
  'ZB-100007': { body: { keys: 'Секретные ключи', phone: '+375 17 999-88-77' } },
  'ZB-100008': { delay: 700, body: { keys: 'Ключи на стойке', check_in: '15:00', check_out: '12:00', phone: '+375 17 000-11-22' } },
  'ZB-100009': { status: 500, body: { error: 'Ошибка сервера' } },
  'ZB-100010': { raw: 'это не JSON <html>' },
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
    const ck = p.match(/^\/api\/bookings\/booking\/([^/]+)\/checkin-info$/);
    if (ck) {
      const c = CHECKIN[decodeURIComponent(ck[1]).toUpperCase()];
      if (!c) return json(404, { error: 'нет' });
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

// ищем бронь по номеру и email, как гость; возвращаем страницу кабинета
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
  const [pop] = await Promise.all([
    page.waitForEvent('popup', { timeout: 5000 }),
    tap(vp, page.locator('#cabinet-body button', { hasText: 'Распечатать ваучер' })),
  ]);
  await pop.waitForSelector('.num', { timeout: 5000 });
  return pop;
}
const vtext = pop => pop.evaluate(() => document.body.innerText);
const noHScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const cabHScroll = page => page.evaluate(() => { const b = document.getElementById('cabinet-body'); return b.scrollWidth <= b.clientWidth + 1; });

// блок ваучера по заголовку (малый серый заголовок) — есть ли
const hasTitle = (txt, t) => new RegExp(t, 'i').test(txt);

async function run(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  const T = vp.tag + ': ';
  const env = await setup(browser, base, vp);
  const { page, errors } = env;

  // ═══ 1. ВРЕМЯ: разбор строки ═══
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof zbHHMM === 'function');
  const tm = await page.evaluate(() => ({
    sec: zbHHMM('15:00:00'), hm: zbHHMM('15:00'), one: zbHHMM('8:05'), dot: zbHHMM('15.00'), word: zbHHMM('с 14:30'), num: zbHHMM(1500),
    iso: zbHHMM('1970-01-01T08:00:00.000Z'), ms: zbHHMM('06:00:00.000'), bad1: zbHHMM('25:00'), bad2: zbHHMM('12:61'), bad3: zbHHMM('abc'), nul: zbHHMM(null), und: zbHHMM(undefined), empty: zbHHMM('  '),
    inLbl: zbTimeText('15:00:00', 'с'), outLbl: zbTimeText('12:00:00', 'до'), noLbl: zbTimeText(null, 'с') }));
  check(T + 'время: «15:00:00» → «15:00», «15:00» → «15:00», «8:05» → «08:05», «15.00» → «15:00»', tm.sec === '15:00' && tm.hm === '15:00' && tm.one === '08:05' && tm.dot === '15:00', JSON.stringify(tm));
  check(T + 'время: «с 14:30» → «14:30», «06:00:00.000» → «06:00»', tm.word === '14:30' && tm.ms === '06:00', JSON.stringify(tm));
  check(T + 'время: ISO-строка читается буквально, без пересчёта пояса (08:00:00Z → 08:00)', tm.iso === '08:00', JSON.stringify(tm));
  check(T + 'время: мусор, 25:00, 12:61, число, null, пусто → нет времени', tm.bad1 === '' && tm.bad2 === '' && tm.bad3 === '' && tm.num === '' && tm.nul === '' && tm.und === '' && tm.empty === '', JSON.stringify(tm));
  check(T + 'подписи: «с 15:00», «до 12:00», нет времени → «по правилам объекта»', tm.inLbl === 'с 15:00' && tm.outLbl === 'до 12:00' && tm.noLbl === 'по правилам объекта', JSON.stringify(tm));

  // ═══ 2. КАБИНЕТ + ВАУЧЕР: данные как отдаёт сервер сейчас ═══
  await openCab(env, 'bare');
  check(T + 'кабинет: кнопка «Распечатать ваучер» есть', await page.locator('#cabinet-body button', { hasText: 'Распечатать ваучер' }).count() === 1);
  await page.waitForTimeout(250);
  check(T + 'кабинет: ручка не ответила (404) — блока «Как заселиться» нет, ошибок нет', await page.locator('#cabinet-body details.zbci').count() === 0);
  check(T + 'кабинет: ссылки на PDF нет (сервер не прислал)', await page.locator('#cabinet-body a', { hasText: 'PDF' }).count() === 0);
  check(T + 'кабинет: нет горизонтальной прокрутки', await cabHScroll(page) && await noHScroll(page));
  let pop = await openVoucher(env);
  let tx = await vtext(pop);
  check(T + 'ваучер: «с 15:00» и «до 12:00» (без секунд)', /с 15:00(?!:)/.test(tx) && /до 12:00(?!:)/.test(tx) && !/\d{2}:\d{2}:\d{2}/.test(tx), tx.slice(0, 400));
  check(T + 'ваучер: подпись «' + SIGN + '», «агрегатор» нет', tx.indexOf(SIGN + ' · zaedem.by') >= 0 && !/агрегатор/i.test(tx));
  check(T + 'ваучер: «Способ оплаты» — «Банковская карта», слова «card» нет', /Способ оплаты\s*Банковская карта/.test(tx) && !/\bcard\b/i.test(tx), tx);
  check(T + 'ваучер: адрес и правила отмены (они приходят с сервера) показаны', tx.indexOf('Минская обл., д. Тихая, 5') >= 0 && /Правила отмены/i.test(tx) && tx.indexOf('Бесплатная отмена за 3 дня до заезда.') >= 0);
  check(T + 'ваучер без новых полей: нет блоков «Контакты», «Как заселиться», «Сборы», «PDF», карты', !hasTitle(tx, 'Как заселиться') && !hasTitle(tx, 'Контакты объекта') && !hasTitle(tx, 'на месте') && !/Открыть на карте/.test(tx) && !/PDF/.test(tx));
  check(T + 'ваучер без новых полей: нет «undefined», «null», «NaN»', !/undefined|null|NaN/.test(tx), tx);
  check(T + 'ваучер: нет горизонтальной прокрутки', await noHScroll(pop));
  await pop.emulateMedia({ media: 'print' });
  check(T + 'печать: кнопка «Распечатать» скрыта, текст на месте', await pop.evaluate(() => getComputedStyle(document.querySelector('.print-btn')).display === 'none') && /до 12:00/.test(await vtext(pop)));
  await pop.screenshot({ path: path.join(SHOTS, vp.tag + '_1_vaucher_bez_novyh_poley.png'), fullPage: true });
  await pop.close();
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_0_kabinet_bez_pdf.png') });

  // ═══ 3. ВАУЧЕР: сервер прислал всё ═══
  await openCab(env, 'full');
  await page.waitForSelector('#cabinet-body details.zbci', { timeout: 4000 });
  const det = page.locator('#cabinet-body details.zbci');
  const sumBox = await det.locator('summary').boundingBox();
  check(T + 'кабинет: блок «Как заселиться» — раскрывающийся, свёрнут, кнопка ≥ 44 px', await det.evaluate(d => !d.open) && /Как заселиться/.test(await det.locator('summary').innerText()) && sumBox && sumBox.height >= 44, JSON.stringify(sumBox));
  await tap(vp, det.locator('summary'));
  await page.waitForTimeout(150);
  const dtx = await det.innerText();
  check(T + 'кабинет: раскрылся — ключи, где получить, время, инструкция, сведения', await det.evaluate(d => d.open) && /Бесконтактное/.test(dtx) && dtx.indexOf('Ключница (сейф для ключей)') >= 0 && dtx.indexOf('калитка справа') >= 0 && /заезд с 15:00 · выезд до 12:00/.test(dtx) && dtx.indexOf('Код ключницы пришлём за час до заезда.') >= 0 && dtx.indexOf('Заселение по паспорту.') >= 0, dtx);
  check(T + 'кабинет: адрес, «Открыть на карте», Telegram / WhatsApp / Viber', dtx.indexOf('Минская обл., д. Тихая, 5') >= 0 && await det.locator('a', { hasText: 'Открыть на карте' }).getAttribute('href') === BK.full.map_url && /@tihiy_bereg/.test(dtx) && /WhatsApp/.test(dtx) && /Viber/.test(dtx));
  check(T + 'кабинет: телефон — ссылка tel:, почта — ссылка mailto:', await det.locator('a[href="tel:+375171112233"]').count() === 1 && await det.locator('a[href="mailto:' + LONG_MAIL + '"]').count() === 1);
  const ckReq = env.reqLog.filter(r => /ZB-100002\/checkin-info$/.test(r.path));
  check(T + 'ручка «Как заселиться»: один запрос на бронь, с email гостя', ckReq.length === 1 && ckReq[0].path === '/api/bookings/booking/ZB-100002/checkin-info' && ckReq[0].search === '?email=' + encodeURIComponent(EMAIL), JSON.stringify(ckReq));
  check(T + 'кабинет: блок раскрыт — нет горизонтальной прокрутки', await cabHScroll(page) && await noHScroll(page));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_2_kabinet_kak_zaselitsya.png') });
  const pdfA = page.locator('#cabinet-body a', { hasText: 'Скачать PDF' });
  check(T + 'кабинет: «Скачать PDF» есть, ссылка из ответа сервера, откроется в новой вкладке', await pdfA.count() === 1 && await pdfA.getAttribute('href') === BK.full.voucher_pdf_url && await pdfA.getAttribute('target') === '_blank' && /noopener/.test(await pdfA.getAttribute('rel')));
  const pdfBox = await pdfA.boundingBox();
  check(T + 'кабинет: кнопка «Скачать PDF» достаточно высокая для пальца (≥ 36 px)', pdfBox && pdfBox.height >= 36, JSON.stringify(pdfBox));
  check(T + 'кабинет: с PDF нет горизонтальной прокрутки', await cabHScroll(page) && await noHScroll(page));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_2_kabinet_s_pdf.png') });
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (всё): «с 15:00» / «до 12:00»', /с 15:00(?!:)/.test(tx) && /до 12:00(?!:)/.test(tx) && !/\d{2}:\d{2}:\d{2}/.test(tx));
  check(T + 'ваучер (всё): адрес и «Открыть на карте» со ссылкой', tx.indexOf('Минская обл., д. Тихая, 5') >= 0 && await pop.locator('a', { hasText: 'Открыть на карте' }).getAttribute('href') === BK.full.map_url);
  check(T + 'ваучер (всё): контакты объекта — телефон, почта, Telegram, WhatsApp, Viber', /Контакты объекта/i.test(tx) && tx.indexOf('+375 17 111-22-33') >= 0 && tx.indexOf(LONG_MAIL) >= 0 && /Telegram[\s\S]*@tihiy_bereg/.test(tx) && /WhatsApp[\s\S]*\+375291234567/.test(tx) && /Viber[\s\S]*\+375291234567/.test(tx), tx);
  check(T + 'ваучер (всё): «Как заселиться» — ключи, где получить, инструкция, сведения', /Как заселиться/i.test(tx) && tx.indexOf('Ключница (сейф для ключей)') >= 0 && tx.indexOf('калитка справа') >= 0 && tx.indexOf('Код ключницы пришлём за час до заезда.') >= 0 && tx.indexOf('Заселение по паспорту.') >= 0 && /Бесконтактн/i.test(tx));
  check(T + 'ваучер (всё): телефон объекта не дублируется в контактах', (tx.match(/\+375 17 111-22-33/g) || []).length === 1, String((tx.match(/\+375 17 111-22-33/g) || []).length));
  check(T + 'ваучер (всё): «Оплачивается на месте» — оба сбора', /Оплачивается на месте/i.test(tx) && tx.indexOf('Курортный сбор — 2 BYN с человека за ночь') >= 0 && tx.indexOf('Депозит 50 BYN при заселении') >= 0);
  check(T + 'ваучер (всё): правила отмены (две строки) и правила дома', tx.indexOf('После — штраф за первую ночь.') >= 0 && /Правила дома/i.test(tx) && tx.indexOf('Не шуметь после 23:00') >= 0);
  check(T + 'ваучер (всё): блоки в порядке «адрес → контакты → как заселиться → сборы → правила отмены»', (() => { const o = ['Минская обл.', 'Контакты объекта', 'Как заселиться', 'Оплачивается на месте', 'Правила отмены'].map(x => x.toLowerCase()); const lt = tx.toLowerCase(); const ix = o.map(s => lt.indexOf(s)); return ix.every(i => i >= 0) && ix.every((v, i) => !i || v > ix[i - 1]); })(), tx);
  check(T + 'ваучер (всё): итоговая цена и платёжная строка на месте', /Итого к оплате\s*420 BYN/.test(tx) && /Способ оплаты\s*Банковская карта/.test(tx));
  check(T + 'ваучер (всё): нет горизонтальной прокрутки (длинная почта переносится)', await noHScroll(pop));
  check(T + 'ваучер (всё): блоки не разрываются при печати (break-inside: avoid)', await pop.evaluate(() => { const b = Array.from(document.querySelectorAll('.vblock')); return b.length >= 4 && b.every(x => /avoid/.test(getComputedStyle(x).breakInside)); }));
  check(T + 'ваучер (всё): «агрегатор» нет, подпись платформы на месте', !/агрегатор/i.test(tx) && tx.indexOf(SIGN) >= 0);
  await pop.screenshot({ path: path.join(SHOTS, vp.tag + '_3_vaucher_vse_polya.png'), fullPage: true });
  await pop.emulateMedia({ media: 'print' });
  check(T + 'печать (всё): блоки видны, кнопки печати нет', await pop.evaluate(() => getComputedStyle(document.querySelector('.print-btn')).display === 'none') && /Как заселиться/i.test(await vtext(pop)));
  await pop.close();

  // ═══ 4. ВРЕМЯ НЕИЗВЕСТНО, ОПЛАТА ЕРИП, ПУСТЫЕ ПОЛЯ ═══
  await openCab(env, 'noTime');
  check(T + 'кабинет (пустые поля): PDF-кнопки нет', await page.locator('#cabinet-body a', { hasText: 'PDF' }).count() === 0);
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (времени нет): «по правилам объекта» у заезда и выезда', (tx.match(/по правилам объекта/g) || []).length === 2, tx);
  check(T + 'ваучер (ЕРИП): «Способ оплаты» — «ЕРИП»', /Способ оплаты\s*ЕРИП/.test(tx));
  check(T + 'ваучер (пустые поля): нет пустых блоков и «undefined»/«null»', !/Как заселиться|Контакты объекта|на месте|Правила отмены|Открыть на карте/i.test(tx) && !/undefined|null|NaN/.test(tx), tx);
  await pop.close();

  // ═══ 5. ТЕСТОВАЯ БРОНЬ ═══
  await openCab(env, 'test');
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (тестовая бронь): «Способ оплаты» — «Тестовая бронь, без оплаты», не «Банковская карта»', /Способ оплаты\s*Тестовая бронь, без оплаты/.test(tx) && !/Банковская карта/.test(tx), tx);
  await pop.close();

  // ═══ 5б. ОТМЕНЁННАЯ БРОНЬ — БЕЗ КОНТАКТОВ ═══
  env.reqLog.length = 0;
  await openCab(env, 'cancelled');
  await page.waitForTimeout(400);
  check(T + 'отменённая бронь: запроса к ручке «Как заселиться» нет, блока в кабинете нет', env.reqLog.filter(r => /checkin-info/.test(r.path)).length === 0 && await page.locator('#cabinet-body details.zbci').count() === 0);
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'отменённая бронь: в ваучере нет контактов, «Как заселиться», карты, сборов и правил дома', !/Контакты объекта|Как заселиться|Открыть на карте|Оплачивается на месте|Правила дома/i.test(tx) && tx.indexOf('+375 17 999-88-77') < 0 && tx.indexOf('@secret_tg') < 0 && tx.indexOf('Секретн') < 0, tx);
  check(T + 'отменённая бронь: статус «Отменено», адрес и правила отмены остаются', /Отменено/.test(tx) && tx.indexOf('Минская обл., д. Тихая, 5') >= 0 && tx.indexOf('Правила отмены этого объекта.') >= 0);
  check(T + 'отменённая бронь: в ваучере нет ссылок tel: / mailto: кроме строки внизу страницы', await pop.locator('a[href^="tel:"]').count() === 0);
  await pop.close();

  // ═══ 5в. РУЧКА ОТВЕЧАЕТ МЕДЛЕННО / ОШИБКОЙ / МУСОРОМ ═══
  await openCab(env, 'slow');
  pop = await openVoucher(env);   // нажимаем «Распечатать» сразу, ответ ручки ещё не пришёл
  tx = await vtext(pop);
  check(T + 'медленная ручка: ваучер дождался ответа — есть «Как заселиться» и телефон', /Как заселиться/i.test(tx) && tx.indexOf('+375 17 000-11-22') >= 0 && tx.indexOf('Ключи на стойке') >= 0, tx);
  await pop.close();
  for (const key of ['broken', 'garbage']) {
    await openCab(env, key);
    await page.waitForTimeout(300);
    check(T + 'ручка (' + key + '): блока в кабинете нет', await page.locator('#cabinet-body details.zbci').count() === 0);
    pop = await openVoucher(env);
    tx = await vtext(pop);
    check(T + 'ручка (' + key + '): ваучер как раньше — «с 15:00», без новых блоков, без «undefined»', /с 15:00/.test(tx) && !/Как заселиться|Контакты объекта/i.test(tx) && !/undefined|null|NaN/.test(tx));
    await pop.close();
  }

  // ═══ 6. ЧУЖОЙ HTML И ОПАСНЫЕ ССЫЛКИ ═══
  await openCab(env, 'evil');
  check(T + 'кабинет (опасная ссылка на PDF): кнопки «Скачать PDF» нет', await page.locator('#cabinet-body a', { hasText: 'PDF' }).count() === 0);
  pop = await openVoucher(env);
  tx = await vtext(pop);
  const evil = await pop.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('img, script:not([src]) + script').length, js: Array.from(document.querySelectorAll('a')).filter(a => /^javascript:/i.test(a.getAttribute('href') || '')).length, handlers: document.querySelectorAll('[onerror],[onmouseover]').length, map: document.querySelectorAll('a').length }));
  check(T + 'ваучер (чужой HTML): теги из полей показаны текстом, не исполняются', evil.xss === 0 && evil.handlers === 0 && evil.imgs === 0 && tx.indexOf('<img src=x') >= 0, JSON.stringify(evil));
  check(T + 'ваучер (javascript:): не становится ссылкой, «Открыть на карте» нет', evil.js === 0 && !/Открыть на карте/.test(tx), JSON.stringify(evil));
  await pop.close();
  check(T + 'главное окно: чужой код не выполнился', await page.evaluate(() => !window.__xss));

  // ═══ 7. PDF — ОТНОСИТЕЛЬНАЯ ССЫЛКА ОТ АДРЕСА API ═══
  await openCab(env, 'pdfRel');
  const relA = page.locator('#cabinet-body a', { hasText: 'Скачать PDF' });
  check(T + 'кабинет: pdf_url вида «/api/...» превращается в ссылку на api.zaedem.by', await relA.count() === 1 && await relA.getAttribute('href') === 'https://api.zaedem.by/api/bookings/ZB-100006/voucher.pdf', await relA.count() ? await relA.getAttribute('href') : 'нет кнопки');
  pop = await openVoucher(env);
  tx = await vtext(pop);
  check(T + 'ваучер (время «15:00» без секунд): «с 15:00» / «до 12:00»', /с 15:00/.test(tx) && /до 12:00/.test(tx));
  await pop.close();

  // ═══ 8. ПОДПИСЬ ПЛАТФОРМЫ НА ГЛАВНОЙ ═══
  await page.goto(base + '/', { waitUntil: 'load' });
  const home = await page.evaluate(() => ({ title: document.title, desc: (document.querySelector('meta[name="description"]') || {}).content || '', og: (document.querySelector('meta[property="og:title"]') || {}).content || '',
    ogd: (document.querySelector('meta[property="og:description"]') || {}).content || '', foot: (document.querySelector('footer .ft-desc') || {}).textContent || '' }));
  check(T + 'главная: подвал начинается с подписи платформы', home.foot.indexOf(SIGN) === 0, home.foot);
  check(T + 'главная: title и og:title содержат подпись платформы', home.title.indexOf(SIGN) >= 0 && home.og.indexOf(SIGN) >= 0, home.title + ' | ' + home.og);
  check(T + 'главная: description и og:description начинаются с подписи', home.desc.indexOf(SIGN) === 0 && home.ogd.indexOf(SIGN) === 0, home.desc + ' | ' + home.ogd);

  check(T + 'нет горизонтальной прокрутки на главной', await noHScroll(page));
  const errs = errors.slice();
  check(T + 'ошибок JS в консоли нет (главная и окна ваучера)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await env.ctx.close();

  // ═══ 9. ТОТ ЖЕ ВАУЧЕР В ДРУГИХ ЧАСОВЫХ ПОЯСАХ — ВРЕМЯ НЕ ПЛЫВЁТ ═══
  if (vp.tag === '390') {
    for (const tz of ['Pacific/Auckland', 'America/Los_Angeles', 'UTC']) {
      const e2 = await setup(browser, base, vp, tz);
      await openCab(e2, 'full');
      const p2 = await openVoucher(e2);
      const t2 = await vtext(p2);
      check(T + 'пояс ' + tz + ': «с 15:00» / «до 12:00», сдвига нет', /с 15:00(?!:)/.test(t2) && /до 12:00(?!:)/.test(t2) && !/с 0\d:00|до 0\d:00/.test(t2), t2.slice(0, 300));
      check(T + 'пояс ' + tz + ': ошибок в консоли нет', e2.errors.length === 0, e2.errors.slice(0, 2).join(' | '));
      await e2.ctx.close();
    }
  }
}

// ═══ ПОДПИСЬ ПЛАТФОРМЫ В ФАЙЛАХ (не зависит от экрана) ═══
function filesCheck() {
  console.log('\n=== файлы: подпись платформы ===');
  const html = fs.readdirSync(ROOT).filter(f => /\.(html|webmanifest|js)$/.test(f));
  const BAD = /агрегатор|аггрегатор|(?<!Белорусская )платформа бронирования жилья/i;
  for (const f of html) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const bad = (s.match(new RegExp(BAD.source, 'gi')) || []);
    check(f + ': прежних вариантов («агрегатор…», «Платформа бронирования жилья» без «Белорусская») нет', bad.length === 0, bad.join(' | '));
  }
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  check('manifest: name и description содержат подпись платформы', mf.name.indexOf(SIGN) >= 0 && mf.description.indexOf(SIGN) === 0, mf.name + ' | ' + mf.description);
  check('manifest: short_name не менялся («Заедем.by»)', mf.short_name === 'Заедем.by');
  const tw = (idx.match(/<meta name="twitter:(title|description)" content="([^"]*)"/g) || []);
  check('index.html: twitter:title и twitter:description — подпись платформы', tw.length === 2 && tw.every(x => x.indexOf(SIGN) >= 0), tw.join(' | '));
  const ct = fs.readFileSync(path.join(ROOT, 'contacts.html'), 'utf8');
  check('contacts.html: description — подпись платформы', ct.indexOf('— ' + SIGN + ' zaedem.by') >= 0 || /<meta name="description" content="[^"]*Белорусская платформа бронирования жилья/.test(ct));
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
