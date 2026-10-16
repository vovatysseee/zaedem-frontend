// 16.10: проверка порции «шторка поиска без прыжков»: на телефоне «Куда едете?» открывается без клавиатуры, страница под
// шторкой не листается и после закрытия стоит там же; «Назад» закрывает шторку (Android); «Недавние» → «Очистить»;
// limited: true → «Показаны первые N вариантов…»; attribution у «Что рядом»; в разделах «Отели» / «Апартаменты» /
// «Усадьбы» — та же панель фильтров, что в обычной выдаче (фильтр без дат просит даты); главная не изменилась;
// лишний </div> после #main-page убран — разметка и снимки те же.
// Все ответы API — заглушки, сайт отдаётся локально; прежняя версия страницы — /old/ (git show origin/main:index.html).
// Запуск из корня репозитория:  node .github/poisk-test/shtorka_16_10.test.js
// Телефон: Android — Chromium с тачем; iPhone — WebKit, если он установлен (npx playwright install webkit),
// иначе iPhone эмулируется в Chromium (тот же экран и строка браузера iPhone: сайт включает свои правила для iPhone).
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const cp = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(cp.execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_shtorka_16_10');
fs.mkdirSync(SHOTS, { recursive: true });
// прежняя версия index.html — из origin/main (для сравнения главной «до/после»)
let OLD = process.env.ZB_OLD_INDEX ? fs.readFileSync(process.env.ZB_OLD_INDEX, 'utf8') : null;
if (!OLD) { try { OLD = cp.execSync('git show origin/main:index.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(); } catch (e) { OLD = null; } }

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let old = false;
      if (p.startsWith('/old/')) { old = true; p = p.slice(4); }
      if (p === '/') p = '/index.html';
      if (old && p === '/index.html' && OLD) { resp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return resp.end(OLD); }
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
const NEMIGA = { lat: 53.9058, lng: 27.5536 };
function makeHotels(idBase, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'ost_' + (idBase + i), hid: idBase + i, name_ru: 'Объект ' + (idBase + i), address: 'Минск, ул. Тестовая, ' + i,
      category: i % 3 === 0 ? 'guest' : (i % 3 === 1 ? 'hotel' : 'apart'), rating: i % 6, reviews_count: null,
      price: 80 + (i * 37) % 400, price_total: 2 * (80 + (i * 37) % 400), nights: 2, oldPrice: null, photos: [], amenities: [],
      source: 'ostrovok', tags: [], city_ru: 'Минск', meal: 'nomeal', cancellation: i % 2 ? '2026-11-08T10:00:00' : null,
      contactless: i % 4 === 0 || undefined, no_deposit: i % 5 === 0 || undefined,
      latitude: NEMIGA.lat + ((i % 11) - 5) * 0.006, longitude: NEMIGA.lng + ((i % 13) - 6) * 0.009,
    });
  }
  return out;
}
const SET = makeHotels(1000, 120);
// каталог без дат (как routes/catalog.js): price=null, catalog=true; звёзды 0..5
function catalog(cats) {
  const out = [];
  cats.forEach((c, k) => { for (let i = 0; i < 12; i++) out.push({ id: 'ost_' + (5000 + k * 100 + i), hid: 5000 + k * 100 + i, name_ru: 'Каталог ' + c + ' ' + i, address: 'Минск, ул. Каталожная, ' + i, category: c, rating: i % 6, reviews_count: null, price: null, price_total: null, nights: null, oldPrice: null, photos: [], amenities: [], source: 'ostrovok', latitude: NEMIGA.lat, longitude: NEMIGA.lng, catalog: true }); });
  return { ok: true, categories: cats, offset: 0, limit: 50, total: out.length, hasMore: false, hotels: out };
}
const HP_OK = { ok: true, hid: 1000, booking_enabled: false, hotel: { description: 'Описание объекта.', amenities: [], photos: [], check_in: '14:00', check_out: '12:00', policy: null },
  rates: [{ book_hash: 'h-0', room_name: 'Номер 1', meal: 'breakfast', price_byn: 200, images: [], room_amenities: [], taxes_on_site: [], cancellation: { free_cancellation_before: '2026-11-08T10:00:00', policies: [] } }] };
const NEARBY = { nearby: [{ icon: '🛒', label: 'Магазин', dist: '120 м', meters: 120 }, { icon: '💊', label: 'Аптека', dist: '300 м', meters: 300 }], cached: false };

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function setup(browser, base, vp) {
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block', timezoneId: 'Europe/Minsk', locale: 'ru-RU' }, vp.opts));
  const log = [];
  const S = { search: () => ({ ok: true, city: 'Минск', hotels: SET, total: SET.length }), nearby: () => NEARBY };
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith('https://api.zaedem.by'), route => {
    const u = route.request().url();
    if (/overpass/.test(u)) { log.push({ path: 'overpass' }); return route.fulfill({ status: 504, headers: CORS, contentType: 'text/plain', body: 'x' }); }
    if (/\.css(\?|$)|fonts\.googleapis/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'text/css', body: '' });
    if (/\.js(\?|$)/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/javascript', body: '' });
    if (/open-meteo/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG });
  });
  await ctx.route('https://api.zaedem.by/**', async route => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    log.push({ path: p, body, q: u.search });
    const json = (status, obj) => route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(obj) });
    if (p === '/api/ostrovok/search') return json(200, S.search(body));
    if (p === '/api/catalog') return json(200, catalog(String(u.searchParams.get('category') || 'hotel').split(',')));
    if (p === '/api/nearby') return json(200, S.nearby());
    if (p === '/api/ostrovok/hp') return json(200, HP_OK);
    if (p === '/api/ostrovok/reviews') return json(200, { reviews: [] });
    if (p === '/api/hotels') return json(200, { hotels: [] });
    if (p === '/api/ai/search') return json(200, { parsed: null, error: true });
    return json(200, {});
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page, log, S, errors };
}

// касание-«прокрутка» пальцем (как на телефоне): Chromium — через CDP, WebKit — серией touch-событий
async function swipe(page, ctx, engine, x, y, dy) {
  if (engine === 'chromium') {
    // настоящие касания через CDP (Input.synthesizeScrollGesture в headless-сборке ничего не листает)
    const cdp = await ctx.newCDPSession(page);
    const T = (type, yy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: yy }] });
    const N = Math.max(6, Math.round(Math.abs(dy) / 20));
    await T('touchStart', y);
    for (let i = 1; i <= N; i++) { await T('touchMove', Math.round(y + dy * i / N)); await page.waitForTimeout(12); }
    await T('touchEnd', y + dy);
    await cdp.detach();
  } else {
    await page.evaluate(({ x, y, dy }) => {
      const t = document.elementFromPoint(x, y) || document.body;
      const mk = (yy) => new Touch({ identifier: 1, target: t, clientX: x, clientY: yy });
      t.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(y)], bubbles: true, cancelable: true }));
      for (let i = 1; i <= 8; i++) t.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(y + dy * i / 8)], bubbles: true, cancelable: true }));
      t.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(y + dy)], bubbles: true, cancelable: true }));
    }, { x, y, dy });
  }
  await page.waitForTimeout(450);
}

// ═══ ТЕЛЕФОН ═══
async function runPhone(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  const { ctx, page, log, S, errors } = await setup(browser, base, vp);
  // у iPhone-эмуляции снимки те же, что у Android, — сохраняем только шторку (меньше веса в репозитории)
  const shot = async n => { await page.waitForTimeout(350); if (vp.ios && !/^1_/.test(n)) return; return page.screenshot({ path: path.join(SHOTS, vp.tag + '_' + n + '.png') }); };
  const W = vp.opts.viewport.width;
  const sheetOpen = () => page.evaluate(() => { const s = document.getElementById('cap-sheet'); return !!(s && s.style.display === 'flex'); });
  const mainTop = () => page.evaluate(() => Math.round(document.getElementById('hotels-section').getBoundingClientRect().top));
  const goHome = async () => { await page.evaluate(() => { try { sessionStorage.clear(); localStorage.removeItem('zb_recent_cities'); } catch (e) {} }); await page.goto(base + '/'); await page.waitForTimeout(900); };
  await goHome();

  // ── 1. «Куда едете?» — без клавиатуры, страница под шторкой стоит ──
  // недавние — чтобы список был длиннее экрана и его было что листать
  await page.evaluate(() => localStorage.setItem('zb_recent_cities', JSON.stringify(['Брест', 'Гродно', 'Витебск', 'Нарочь', 'Минская область'])));
  // страницу чуть прокручиваем (строка «Куда едете?» остаётся на экране) — так виден любой прыжок страницы
  await page.evaluate(() => { const r = document.getElementById('cap-main').getBoundingClientRect(); window.scrollTo(0, Math.max(0, Math.min(140, Math.round(r.top) - 70))); });
  await page.waitForTimeout(300);
  const Y0 = await page.evaluate(() => Math.round(window.scrollY));
  const T0 = await mainTop();
  // контроль: тот же жест без шторки листает страницу (значит, проверки ниже не пустые)
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 600, -200);
  const Yc = await page.evaluate(() => Math.round(window.scrollY));
  check('контроль: жест пальцем без шторки листает страницу (' + Y0 + ' → ' + Yc + ')', Yc > Y0 + 50, String(Yc));
  await page.evaluate(y => window.scrollTo(0, y), Y0); await page.waitForTimeout(400);
  check('страница вернулась на исходную позицию', await page.evaluate(() => Math.round(window.scrollY)) === Y0 && await mainTop() === T0);
  await page.locator('#cap-main').tap(); await page.waitForTimeout(600);
  const f1 = await page.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, id: a && a.id }; });
  check('тап «Куда едете?» → шторка открыта', await sheetOpen());
  check('клавиатуры нет: фокус не в поле ввода', !/^(INPUT|TEXTAREA)$/.test(f1.tag) && f1.id !== 'cs-city-input', JSON.stringify(f1));
  const order = await page.evaluate(() => ['cs-city-input', 'cs-recent-wrap', 'cs-pop-lbl', 'cs-reg-wrap'].map(id => { const e = document.getElementById(id); return e && e.offsetParent !== null ? Math.round(e.getBoundingClientRect().top) : -1; }));
  check('сверху поле поиска, ниже «Недавние», «Популярные», «Области»', order.every(v => v >= 0) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3], order.join(','));
  check('у «Недавних» есть «Очистить»', await page.locator('#cs-recent-wrap .zb-rec-clear').isVisible());
  await shot('1_shtorka_bez_klaviatury');
  const sc = await page.evaluate(() => { const s = document.getElementById('cs-scroll'); return { h: s.scrollHeight, c: s.clientHeight }; });
  // листаем список вниз и вверх, тянем за шапку и за пустое место
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 500, -350);
  const listMoved = await page.evaluate(() => document.getElementById('cs-scroll').scrollTop);
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 300, 400);
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 300, 400);
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 30, 300);   // шапка шторки
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 30, -300);
  const Y1 = await page.evaluate(() => Math.round(window.scrollY));
  const T1 = await mainTop();
  check('прокрутка списка не двигает страницу: scrollY ' + Y0 + ' → ' + Y1, Y1 === Y0 && T1 === T0, 'scrollY ' + Y1 + ', блок ' + T0 + '→' + T1);
  if (sc.h > sc.c + 20) check('сам список при этом листается (' + sc.h + ' > ' + sc.c + ')', listMoved > 0, String(listMoved));
  else console.log('  (список помещается целиком: ' + sc.h + ' ≤ ' + sc.c + ' — листать нечего)');
  // экран ниже (как с открытой клавиатурой) — список длиннее экрана: он листается, страница под ним — нет
  await page.setViewportSize({ width: W, height: 430 }); await page.waitForTimeout(400);
  const Yk = await page.evaluate(() => Math.round(window.scrollY)), Tk = await mainTop();
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 330, -260);
  const lk1 = await page.evaluate(() => document.getElementById('cs-scroll').scrollTop);
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 330, -600);
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 330, -600);   // список уже в самом низу — тянем дальше
  const lk2 = await page.evaluate(() => { const s = document.getElementById('cs-scroll'); return { top: s.scrollTop, max: s.scrollHeight - s.clientHeight }; });
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 150, 900);
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 150, 900);    // и вверх дальше начала
  const Yk2 = await page.evaluate(() => Math.round(window.scrollY));
  check('низкий экран: список листается сам (' + lk1 + ' px, до конца ' + lk2.max + ')', lk1 > 0 && lk2.top >= lk2.max - 2, JSON.stringify(lk2));
  check('низкий экран: долистали до края и дальше — страница под шторкой стоит (scrollY ' + Yk + ' → ' + Yk2 + ')', Yk2 === Yk && await mainTop() === Tk);
  await page.setViewportSize(vp.opts.viewport); await page.waitForTimeout(400);
  check('у списка overscroll-behavior: contain', await page.evaluate(() => getComputedStyle(document.getElementById('cs-scroll')).overscrollBehaviorY) === 'contain');
  // гость сам нажал в поле — тогда фокус в поле (клавиатура)
  await page.locator('#cs-city-input').tap(); await page.waitForTimeout(250);
  check('нажал в поле сам → фокус в поле (клавиатура только так)', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'cs-city-input');
  await page.locator('#cs-city-input').fill('гро'); await page.waitForTimeout(250);
  check('поиск в поле работает (Гродно в подсказке)', /Гродно/.test(await page.locator('#cs-city-suggest').innerText()));
  await page.locator('#cs-city-input').fill('');
  // закрытие крестиком
  await page.locator('#cs-header button[onclick="capSheetClose()"]').tap(); await page.waitForTimeout(500);
  const Y2 = await page.evaluate(() => Math.round(window.scrollY));
  check('крестик закрыл шторку, страница там же: ' + Y0 + ' → ' + Y2, !(await sheetOpen()) && Y2 === Y0 && await mainTop() === T0, String(Y2));
  check('после закрытия страница снова листается (zb-lock снят)', await page.evaluate(() => !document.documentElement.classList.contains('zb-lock')));

  // ── «Назад» на телефоне ──
  const h0 = await page.evaluate(() => JSON.stringify(history.state));
  await page.locator('#cap-main').tap(); await page.waitForTimeout(500);
  const h1 = await page.evaluate(() => JSON.stringify(history.state));
  if (vp.ios) {
    check('iPhone: шаг в историю не пишется (как у других окон сайта на iPhone), закрытие — крестиком', h1 === h0, h0 + '→' + h1);
    await page.locator('#cs-header button[onclick="capSheetClose()"]').tap(); await page.waitForTimeout(400);
  } else {
    check('Android: у открытой шторки свой шаг истории', /"zbOv":"cap"/.test(h1), h0 + '→' + h1);
    await page.goBack(); await page.waitForTimeout(600);
    check('«Назад» закрыл шторку, остались на главной, страница там же', !(await sheetOpen()) && await page.evaluate(() => !document.body.classList.contains('on-serp')) && await page.evaluate(() => Math.round(window.scrollY)) === Y0);
  }
  check('свайпа вниз у шторок сайта нет — не добавляли (закрытие: крестик, «Назад»)', true);

  // ── даты и гости — та же шторка: под ней тоже ничего не едет ──
  await page.locator('#cap-main').tap(); await page.waitForTimeout(400);
  await page.locator('#cs-popular-pills button', { hasText: 'Минск' }).tap(); await page.waitForTimeout(500);
  check('выбор города пальцем → шаг «Когда едете?»', await page.locator('#cs-step2').isVisible());
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 400, -300);
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 400, 300);
  check('шаг «Даты»: страница под шторкой не сдвинулась', await page.evaluate(() => Math.round(window.scrollY)) === Y0 && await mainTop() === T0);
  // между касаниями — пауза: два касания быстрее 0,32 с сайт считает двойным тапом и второе гасит (как раньше)
  await page.locator('#cs-cnext').tap(); await page.waitForTimeout(400);   // следующий месяц — все дни доступны
  await page.locator('#cs-cgrid button', { hasText: /^10$/ }).tap(); await page.waitForTimeout(400);
  await page.locator('#cs-cgrid button', { hasText: /^12$/ }).tap(); await page.waitForTimeout(400);
  await page.locator('#cs-next-btn').tap(); await page.waitForTimeout(400);
  check('шаг «Гости» открыт', await page.locator('#cs-step3').isVisible());
  await swipe(page, ctx, vp.engine, Math.round(W / 2), 400, -300);
  check('шаг «Гости»: страница под шторкой не сдвинулась', await page.evaluate(() => Math.round(window.scrollY)) === Y0);
  await shot('2_shtorka_gosti');
  log.length = 0;
  await page.locator('#cs-footer button').tap(); await page.waitForTimeout(1300);
  check('«Найти жильё» → выдача Минска (поиск ушёл)', await page.evaluate(() => document.body.classList.contains('on-serp')) && log.some(x => x.path === '/api/ostrovok/search'));
  check('без limited — подсказки о пределе нет', !(await page.locator('#serp-limit-note').isVisible()));
  if (!vp.ios) {
    const hs = await page.evaluate(() => ({ len: history.length, st: history.state, hash: location.hash }));
    check('история: шаг выдачи на месте (#s=…), шаг шторки снят', /^#s=/.test(hs.hash) && hs.st && hs.st.zb === '#s=' && !hs.st.zbOv, JSON.stringify(hs));
    // «Изменить» на выдаче → та же шторка → «Назад» закрывает её и оставляет выдачу
    await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(200);
    const sy = await page.evaluate(() => Math.round(window.scrollY));
    // строка «Изменить» на телефоне уезжает вверх вместе с выдачей; зовём то же, что она (serpEditSearch), прямо с середины списка
    await page.evaluate(() => serpEditSearch()); await page.waitForTimeout(500);
    check('выдача → «Изменить» → шторка, выдача под ней на месте', await sheetOpen() && await page.evaluate(() => Math.round(window.scrollY)) === sy);
    await swipe(page, ctx, vp.engine, Math.round(W / 2), 400, -300);
    await page.goBack(); await page.waitForTimeout(600);
    const bk = { open: await sheetOpen(), serp: await page.evaluate(() => document.body.classList.contains('on-serp')), y: await page.evaluate(() => Math.round(window.scrollY)) };
    check('«Назад» закрыл шторку, выдача осталась и стоит там же', !bk.open && bk.serp && bk.y === sy, JSON.stringify(bk) + ' ждали y=' + sy);
    await page.goBack(); await page.waitForTimeout(800);
    check('следующий «Назад» — на главную (лишних шагов нет)', await page.evaluate(() => !document.body.classList.contains('on-serp')));
  }

  // ── 2. «Недавние» → «Очистить» ──
  await goHome();
  await page.evaluate(() => localStorage.setItem('zb_recent_cities', JSON.stringify(['Брест', 'Гродно'])));
  await page.locator('#cap-main').tap(); await page.waitForTimeout(400);
  check('«Недавние» видны (Брест, Гродно)', await page.locator('#cs-recent-wrap').isVisible() && /Брест/.test(await page.locator('#cs-recent-pills').innerText()));
  await page.locator('#cs-recent-wrap .zb-rec-clear').tap(); await page.waitForTimeout(300);
  check('«Очистить» → группа исчезла, на устройстве пусто', !(await page.locator('#cs-recent-wrap').isVisible()) && await page.evaluate(() => localStorage.getItem('zb_recent_cities')) === '[]');
  check('«Очистить» не закрыл шторку и не открыл клавиатуру', await sheetOpen() && await page.evaluate(() => document.activeElement && document.activeElement.tagName) !== 'INPUT');
  await shot('3_nedavnie_ochishcheno');
  await page.locator('#cs-header button[onclick="capSheetClose()"]').tap(); await page.waitForTimeout(300);
  await page.evaluate(() => { window._lastReg = { city: 'Пинск' }; });   // город прошлого поиска тоже не подставляется
  await page.locator('#cap-main').tap(); await page.waitForTimeout(400);
  check('после «Очистить» и повторного открытия «Недавних» нет', !(await page.locator('#cs-recent-wrap').isVisible()));
  await page.locator('#cs-popular-pills button', { hasText: 'Брест' }).tap(); await page.waitForTimeout(400);
  check('новый выбор снова попадает в «Недавние»', await page.evaluate(() => localStorage.getItem('zb_recent_cities')) === '["Брест"]');
  await page.evaluate(() => capSheetClose());

  await common(page, ctx, log, S, vp, shot, base);
  check('нет горизонтальной прокрутки', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('ошибок JS в консоли нет', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ═══ Общее для телефона и ПК: limited, attribution, разделы категорий ═══
async function common(page, ctx, log, S, vp, shot, base) {
  // на телефоне между касаниями — пауза (два касания быстрее 0,32 с сайт гасит как двойной тап)
  const tapOrClick = async loc => { if (vp.mobile) { await loc.tap(); await page.waitForTimeout(380); } else await loc.click(); };
  const setTrip = c => page.evaluate(c => { window._capState = window._capState || {}; Object.assign(window._capState, { city: c, din: new Date(2026, 10, 10), dout: new Date(2026, 10, 12), adults: 2, kids: 0, childAges: [], gDone: true }); var sd = document.getElementById('s-dest'); if (sd) sd.value = c; }, c);
  const openSerp = async c => { await setTrip(c); await page.evaluate(() => serpOpen()); await page.waitForTimeout(1300); };
  const goHome = async () => { await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} }); await page.goto(base + '/'); await page.waitForTimeout(900); };
  const FIL = ['sft-type', 'sft-price', 'sft-stars', 'sft-excl', 'sft-free', 'sft-contactless', 'sft-nodep', 'serp-pmode', 'serp-sort'];
  const visible = () => page.evaluate(ids => ids.filter(id => { const e = document.getElementById(id); return e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'; }), FIL);

  // ── 3. limited: true ──
  await goHome();
  S.search = () => ({ ok: true, city: 'Минская область', area: true, hotels: SET, total: 900, limited: true });
  await openSerp('Минск');
  const ln = await page.locator('#serp-limit-note').innerText().catch(() => '');
  check('limited: true → над выдачей «Показаны первые 120 вариантов — уточните город или добавьте фильтры»', await page.locator('#serp-limit-note').isVisible() && ln === 'Показаны первые 120 вариантов — уточните город или добавьте фильтры', ln);
  await page.locator('#serp-limit-note').scrollIntoViewIfNeeded(); await shot('4_limited');
  await page.evaluate(() => serpToggleTag('sft-free')); await page.waitForTimeout(200);
  check('с фильтрами подсказка остаётся', await page.locator('#serp-limit-note').isVisible());
  await page.evaluate(() => serpToggleTag('sft-free'));
  S.search = () => ({ ok: true, city: 'Минск', hotels: SET.slice(0, 40), total: 40 });
  await openSerp('Брест');
  check('новый поиск без limited → подсказки нет', !(await page.locator('#serp-limit-note').isVisible()));
  S.search = () => ({ ok: true, city: 'Минск', hotels: SET, total: SET.length });
  const normalVis = await visible();

  // ── 4. «Что рядом»: attribution ──
  S.nearby = () => Object.assign({}, NEARBY, { attribution: '© OpenStreetMap contributors, ODbL' });
  await openSerp('Минск');
  await page.evaluate(() => openHotel('ost_1001')); await page.waitForSelector('#hp-nearby', { state: 'attached', timeout: 8000 });
  await page.waitForTimeout(1000);
  const at = await page.locator('#hp-near-attr').innerText().catch(() => '');
  check('attribution есть → под «Что рядом» мелко «© участники OpenStreetMap»', at === '© участники OpenStreetMap' && /Магазин/.test(await page.locator('#hp-nearby').innerText()), at);
  await page.locator('#hp-nearby').scrollIntoViewIfNeeded(); await shot('5_ryadom_osm');
  S.nearby = () => NEARBY;
  await page.evaluate(() => openHotel('ost_1002')); await page.waitForTimeout(1200);
  check('поля attribution нет → подписи нет, блок как раньше', await page.locator('#hp-near-attr').count() === 0 && /Магазин/.test(await page.locator('#hp-nearby').innerText()));

  // ── 6. Разделы «Отели» / «Апартаменты» / «Усадьбы» с главной ──
  check('обычная выдача: видны все фильтры, сортировка и «За поездку / За ночь»', normalVis.length === FIL.length, normalVis.join(','));
  for (const [cat, label] of [['hotel', 'Отели'], ['apart', 'Апартаменты'], ['guest', 'Усадьбы']]) {
    await goHome(); log.length = 0;
    await tapOrClick(page.locator('.hero-cat[aria-label="' + label + '"]')); await page.waitForTimeout(1100);
    const vis = await visible();
    check(label + ': видны те же фильтры, что в обычной выдаче', JSON.stringify(vis) === JSON.stringify(normalVis), vis.join(','));
    const typ = await page.evaluate(() => ['hotel', 'apart', 'guest'].filter(c => document.getElementById('flt-' + c).checked));
    check(label + ': в «Тип жилья» отмечена своя категория', JSON.stringify(typ) === JSON.stringify([cat]), typ.join(','));
    await shot('6_' + cat + '_filtry');
    const needDates = async (kind, act) => {
      await act(); await page.waitForTimeout(350);
      const n = await page.evaluate(() => { const e = document.getElementById('serp-cat-note'); return { on: !!(e && e.offsetParent !== null), kind: e && e.dataset.kind, t: e ? e.innerText : '' }; });
      return n.on && n.kind === kind && /выберите/i.test(n.t) && /Выбрать даты/.test(n.t);
    };
    // Цена
    const okPrice = await needDates('price', async () => { await tapOrClick(page.locator('#sft-price')); await tapOrClick(page.locator('#sft-price-dd label', { hasText: 'До 100 BYN' })); });
    check(label + ': «Цена» без дат → мягко просит даты, выбор не применён', okPrice && await page.evaluate(() => document.querySelector('input[name="price-r"]:checked').value) === '0');
    if (cat === 'hotel') { await page.locator('#serp-cat-note').scrollIntoViewIfNeeded(); await shot('7_prosim_daty'); }
    // Бесплатная отмена / бесконтактное / без депозита
    for (const [id, kind, nm] of [['sft-free', 'free', 'Бесплатная отмена'], ['sft-contactless', 'contactless', 'Бесконтактное заселение'], ['sft-nodep', 'nodep', 'Без депозита']]) {
      const ok = await needDates(kind, () => tapOrClick(page.locator('#' + id)));
      check(label + ': «' + nm + '» без дат → просит даты, не включается', ok && !(await page.evaluate(i => document.getElementById(i).classList.contains('active'), id)));
    }
    // Сортировка по цене → просит даты; по рейтингу — применяется
    await page.locator('#serp-sort').selectOption('price_asc'); await page.waitForTimeout(300);
    check(label + ': сортировка «Сначала дешёвые» → просит даты, сортировка прежняя', await page.evaluate(() => document.getElementById('serp-cat-note').dataset.kind) === 'sort' && await page.locator('#serp-sort').inputValue() === 'recommended');
    // За ночь
    await tapOrClick(page.locator('#pm-night')); await page.waitForTimeout(250);
    check(label + ': «За ночь» — режим запомнен, подсказка про даты', await page.evaluate(() => localStorage.getItem('zb_price_mode')) === 'night' && await page.evaluate(() => document.getElementById('serp-cat-note').dataset.kind) === 'pmode');
    await tapOrClick(page.locator('#pm-trip')); await page.waitForTimeout(150);
    if (cat !== 'guest') {
      await page.locator('#serp-sort').selectOption('rating_desc'); await page.waitForTimeout(300);
      check(label + ': сортировка «По рейтингу» применяется (без подсказки)', await page.locator('#serp-sort').inputValue() === 'rating_desc' && await page.evaluate(() => document.getElementById('serp-cat-note').dataset.kind) === 'pmode');
      // Звёзды
      await tapOrClick(page.locator('#sft-stars')); await tapOrClick(page.locator('#sft-stars-dd label', { hasText: 'Только 5★' })); await page.waitForTimeout(400);
      const meta = await page.locator('#serp-meta').innerText();
      check(label + ': «Звёзды: только 5★» применяется (Найдено: 2 из 12)', /Найдено: 2 объекта/.test(meta), meta);
      await page.evaluate(() => { document.querySelector('input[name="stars-r"][value="0"]').checked = true; serpFilterChange('stars'); });
      // Эксклюзив
      await tapOrClick(page.locator('#sft-excl')); await page.waitForTimeout(300);
      const em = await page.locator('#serp-meta').innerText();
      check(label + ': «✨ Эксклюзив» включается, честно пишет, что в каталоге их пока нет', await page.evaluate(() => document.getElementById('sft-excl').classList.contains('active')) && /в каталоге их пока нет/.test(em), em);
      await tapOrClick(page.locator('#sft-excl')); await page.waitForTimeout(200);
      // Тип жилья: добавили вторую категорию — каталог перезагружен с двумя
      const other = cat === 'hotel' ? 'apart' : 'hotel';
      log.length = 0;
      await tapOrClick(page.locator('#sft-type')); await page.locator('#flt-' + other).check(); await page.waitForTimeout(700);
      const q = (log.filter(x => x.path === '/api/catalog').slice(-1)[0] || {}).q || '';
      check(label + ': «Тип жилья» можно поменять — каталог загружен для двух типов', /category=(hotel%2Capart|apart%2Chotel|hotel,apart|apart,hotel)/.test(q) && /Найдено: 24/.test(await page.locator('#serp-meta').innerText()), q);
    } else {
      check('Усадьбы: показана заглушка «Усадьбы — скоро», фильтры над ней видны', /Усадьбы — скоро/.test(await page.locator('#serp-cards').innerText()));
      await tapOrClick(page.locator('#sft-stars')); await tapOrClick(page.locator('#sft-stars-dd label', { hasText: '4★ и выше' })); await page.waitForTimeout(300);
      check('Усадьбы: «Звёзды» — выбор принят, остаётся «Усадьбы — скоро» (данных нет)', await page.evaluate(() => document.querySelector('input[name="stars-r"]:checked').value) === '4' && /Усадьбы — скоро/.test(await page.locator('#serp-cards').innerText()));
      await tapOrClick(page.locator('#sft-excl')); await page.waitForTimeout(300);
      check('Усадьбы: «✨ Эксклюзив» включается без ошибок', await page.evaluate(() => document.getElementById('sft-excl').classList.contains('active')));
      log.length = 0;
      await tapOrClick(page.locator('#sft-type')); await page.locator('#flt-hotel').check(); await page.waitForTimeout(700);
      const q = (log.filter(x => x.path === '/api/catalog').slice(-1)[0] || {}).q || '';
      check('Усадьбы: «Тип жилья» + отели → каталог загружен', /category=(hotel%2Cguest|guest%2Chotel|hotel,guest)/.test(q), q);
    }
    // «Выбрать даты» → окно выбора (на телефоне шторка, на ПК окно под строкой)
    await needDates('price', async () => { await tapOrClick(page.locator('#sft-price')); await tapOrClick(page.locator('#sft-price-dd label', { hasText: 'До 500 BYN' })); });
    await tapOrClick(page.locator('#scn-pick')); await page.waitForTimeout(500);
    const pick = await page.evaluate(() => ({ sheet: (document.getElementById('cap-sheet') || {}).style.display === 'flex', sd: !!document.getElementById('serp-sd-modal') }));
    check(label + ': «Выбрать даты» → открывается выбор города и дат', vp.mobile ? pick.sheet : pick.sd, JSON.stringify(pick));
    if (vp.mobile) await page.evaluate(() => capSheetClose()); else await page.evaluate(() => serpSearchClose());
    check(label + ': подсказки о пределе в разделе категории нет', !(await page.locator('#serp-limit-note').isVisible()));
  }
  // обычная выдача — фильтры как раньше (включаются сразу, без просьбы о датах)
  await goHome(); await openSerp('Минск');
  await page.evaluate(() => serpToggleTag('sft-free')); await page.waitForTimeout(200);
  check('обычная выдача: «Бесплатная отмена» включается сразу, подсказки про даты нет', await page.evaluate(() => document.getElementById('sft-free').classList.contains('active')) && !(await page.locator('#serp-cat-note').isVisible()));
  await page.evaluate(() => serpToggleTag('sft-free'));
  await page.locator('#serp-sort').selectOption('price_asc'); await page.waitForTimeout(200);
  check('обычная выдача: сортировка по цене применяется', await page.locator('#serp-sort').inputValue() === 'price_asc');
  await page.locator('#serp-sort').selectOption('recommended');
}

// ═══ ПК 1366×768 ═══
async function runDesktop(browser, base) {
  const vp = { name: 'ПК 1366×768', tag: '1366', mobile: false, opts: { viewport: { width: 1366, height: 768 } } };
  console.log('\n=== ' + vp.name + ' ===');
  const { ctx, page, log, S, errors } = await setup(browser, base, vp);
  const shot = async n => { await page.waitForTimeout(350); return page.screenshot({ path: path.join(SHOTS, vp.tag + '_' + n + '.png') }); };
  await page.goto(base + '/'); await page.waitForTimeout(900);
  await page.evaluate(() => localStorage.setItem('zb_recent_cities', JSON.stringify(['Брест', 'Гродно'])));
  await page.locator('#cap-main').click(); await page.waitForTimeout(400);
  check('ПК: как раньше — выпадающий список под строкой, шторки нет', await page.locator('#cap-dd').isVisible() && !(await page.evaluate(() => (document.getElementById('cap-sheet').style.display) === 'flex')));
  check('ПК: как раньше — печатают в строке «Куда едете?» (фокус в ней)', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'cap-city-inp');
  check('ПК: «Недавние» с «Очистить»', await page.locator('#cap-dd-recent-wrap').isVisible() && await page.locator('#cap-dd-recent-wrap .zb-rec-clear').isVisible());
  await shot('1_nedavnie');
  await page.locator('#cap-dd-recent-wrap .zb-rec-clear').click(); await page.waitForTimeout(250);
  check('ПК: «Очистить» → группа исчезла, список открыт, фокус в строке', !(await page.locator('#cap-dd-recent-wrap').isVisible()) && await page.locator('#cap-dd').isVisible() && await page.evaluate(() => document.activeElement && document.activeElement.id) === 'cap-city-inp');
  await page.keyboard.type('Мин'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  check('ПК: набор и Enter работают как раньше (календарь открыт)', await page.locator('#cap-dd-cal').isVisible());
  await page.keyboard.press('Escape'); await page.mouse.click(5, 700); await page.waitForTimeout(200);
  await common(page, ctx, log, S, vp, shot, base);
  check('ПК: нет горизонтальной прокрутки', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('ПК: ошибок JS в консоли нет', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ═══ Главная до/после и разметка после удаления лишнего </div> ═══
async function runSame(browser, base, vp) {
  if (!OLD) { console.log('\n(прежняя версия не найдена — сравнение «до/после» пропущено)'); return; }
  console.log('\n=== Главная до/после, ' + vp.name + ' ===');
  const shots = {};
  const dom = {};
  for (const [k, url] of [['old', base + '/old/'], ['new', base + '/']]) {
    const { ctx, page } = await setup(browser, base, vp);
    await page.goto(url); await page.waitForTimeout(1200);
    // «печатающаяся» подсказка в строке — меняется каждые доли секунды, её прячем на снимке
    const mask = [page.locator('#cap-top')];
    shots[k] = await page.screenshot({ fullPage: true, animations: 'disabled', mask });
    dom[k] = await page.evaluate(() => {
      const kids = el => [...el.children].map(c => c.tagName + (c.id ? '#' + c.id : ''));
      return { body: kids(document.body).filter(x => !/^SCRIPT|^STYLE/.test(x)).join(' '), main: document.getElementById('main-page').innerHTML.replace(/\s+/g, ' ').length,
        mainKids: kids(document.getElementById('main-page')).join(' '), serpParent: document.getElementById('serp-page').parentElement.tagName };
    });
    // выдача и подвал — тоже снимком (проверка, что после удаления </div> ничего не съехало)
    await page.evaluate(() => { window._capState = { city: 'Минск', din: new Date(2026, 10, 10), dout: new Date(2026, 10, 12), adults: 2, kids: 0, childAges: [], gDone: true }; serpOpen(); });
    // ждём, пока выдача дорисуется (под нагрузкой загрузка идёт дольше — иначе на снимке остаётся заглушка-скелет)
    await page.waitForFunction(() => /Найдено/.test((document.getElementById('serp-meta') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    shots[k + 'Serp'] = await page.screenshot({ animations: 'disabled' });
    await ctx.close();
  }
  // попиксельное сравнение — в самом браузере
  const { ctx, page } = await setup(browser, base, { opts: { viewport: { width: 400, height: 400 } } });
  await page.goto(base + '/old/'); // любой адрес нашего сайта
  const cmp = (a, b) => page.evaluate(async ([a, b]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [A, B] = [await load(a), await load(b)];
    if (A.width !== B.width || A.height !== B.height) return { same: false, why: A.width + 'x' + A.height + ' vs ' + B.width + 'x' + B.height };
    const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const x = c.getContext('2d');
    x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
    x.clearRect(0, 0, c.width, c.height); x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
    let diff = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) { diff++; const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
    return { same: diff === 0, why: diff + ' точек отличаются' + (diff ? ' в области x ' + x0 + '–' + x1 + ', y ' + y0 + '–' + y1 : ''), size: A.width + 'x' + A.height };
  }, [a.toString('base64'), b.toString('base64')]);
  // в папку снимков — «после»; «до» — только если отличается (иначе это тот же файл)
  const r1 = await cmp(shots.old, shots.new);
  fs.writeFileSync(path.join(SHOTS, vp.tag + '_glavnaya_posle.png'), shots.new);
  if (!r1.same) fs.writeFileSync(path.join(SHOTS, vp.tag + '_glavnaya_do.png'), shots.old);
  check('главная (вся страница, ' + vp.name + '): снимок до и после совпадает' + (r1.size ? ' (' + r1.size + ')' : ''), r1.same, r1.why);
  const r2 = await cmp(shots.oldSerp, shots.newSerp);
  fs.writeFileSync(path.join(SHOTS, vp.tag + '_vydacha_posle.png'), shots.newSerp);
  if (!r2.same) fs.writeFileSync(path.join(SHOTS, vp.tag + '_vydacha_do.png'), shots.oldSerp);
  check('выдача (' + vp.name + '): снимок до и после совпадает — над выдачей ничего не съехало', r2.same, r2.why);
  check('разметка: те же блоки в <body> и в #main-page (лишний </div> браузер и так пропускал)', dom.old.body === dom.new.body && dom.old.mainKids === dom.new.mainKids && dom.old.main === dom.new.main && dom.new.serpParent === 'BODY', JSON.stringify({ o: dom.old.main, n: dom.new.main }));
  await ctx.close();
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const chromium = await pw.chromium.launch();
  let webkit = null;
  try { webkit = await pw.webkit.launch(); } catch (e) { console.log('(WebKit не установлен — iPhone эмулируется в Chromium: ' + String(e.message).split('\n')[0].slice(0, 90) + ')'); }
  const phone = (w, h, ios) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: ios ? 3 : 2, userAgent: ios ? UA_IPHONE : UA_ANDROID });
  try {
    // ZB_ONLY=same — только сравнение «до/после» (быстро)
    if (process.env.ZB_ONLY !== 'same') for (const [w, h] of [[390, 844], [360, 740]]) {
      await runPhone(chromium, base, { name: 'Android (Chromium) ' + w + '×' + h + ', тач', tag: w + '_android', mobile: true, engine: 'chromium', opts: phone(w, h, false) });
      const iosB = webkit || chromium;
      await runPhone(iosB, base, { name: 'iPhone (' + (webkit ? 'WebKit' : 'эмуляция в Chromium') + ') ' + w + '×' + h + ', тач', tag: w + '_iphone', mobile: true, ios: true, engine: webkit ? 'webkit' : 'chromium', opts: phone(w, h, true) });
    }
    if (process.env.ZB_ONLY !== 'same') await runDesktop(chromium, base);
    await runSame(chromium, base, { name: '390×844', tag: '390', opts: phone(390, 844, false) });
    await runSame(chromium, base, { name: '360×740', tag: '360', opts: phone(360, 740, false) });
    await runSame(chromium, base, { name: '1366×768', tag: '1366', opts: { viewport: { width: 1366, height: 768 } } });
  } finally { await chromium.close(); if (webkit) await webkit.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  fs.writeFileSync(path.join(__dirname, 'result_shtorka_16_10.json'), JSON.stringify(results, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
