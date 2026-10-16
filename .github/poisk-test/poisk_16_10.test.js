// 16.10: проверка порции 16.10: гражданство — родной select без клавиатуры; «Что рядом» без плашки ошибки
// при автозагрузке; поиск по областям (выбор, подсказка, фильтр по типу, ошибка, ИИ-фразы); кнопка «Наверх»;
// «Карта» уходит у «Показать ещё» и подвала; слова «турист» на страницах нет; карты на ключе CARTO.
// Все ответы API и внешних сервисов — заглушки, сайт отдаётся локально.
// Запуск из корня репозитория:  node .github/poisk-test/poisk_16_10.test.js
// Для проверки карт с ключом CARTO нужен настоящий Leaflet: пакеты leaflet@1.9.4 и leaflet.markercluster@1.5.3
// (npm i в любом месте; путь к папке с ними — в ZB_LEAFLET_DIR). Нет пакетов — этот раздел пропускается.
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_16_10');
fs.mkdirSync(SHOTS, { recursive: true });
const TEST_KEY = 'TEST-CARTO-KEY';

// /carto/... — тот же сайт, но в index.html вписан тестовый ключ CARTO (проверка п. 7)
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let carto = false;
      if (p.startsWith('/carto/')) { carto = true; p = p.slice(6); }
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.writeHead(404); return resp.end('nf'); }
      const ext = path.extname(f);
      const ct = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream';
      resp.writeHead(200, { 'Content-Type': ct });
      if (carto && p === '/index.html') {
        const src = fs.readFileSync(f, 'utf8');
        if (src.indexOf("var ZB_MAP_KEY = '';") < 0) throw new Error('строка ZB_MAP_KEY не найдена');
        return resp.end(src.replace("var ZB_MAP_KEY = '';", "var ZB_MAP_KEY = '" + TEST_KEY + "';"));
      }
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}
function findLeaflet() {
  const dirs = [process.env.ZB_LEAFLET_DIR, path.join(ROOT, 'node_modules')];
  try { dirs.push(require('child_process').execSync('npm root -g').toString().trim()); } catch (e) {}
  for (const d of dirs.filter(Boolean)) {
    for (const [a, b] of [['leaflet', 'leaflet.markercluster'], ['leaflet-1.9.4/package', 'leaflet.markercluster-1.5.3/package']]) {
      const js = path.join(d, a, 'dist', 'leaflet.js'), mc = path.join(d, b, 'dist', 'leaflet.markercluster.js');
      if (fs.existsSync(js) && fs.existsSync(mc)) return { js, css: path.join(d, a, 'dist', 'leaflet.css'), mc };
    }
  }
  return null;
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
      source: 'ostrovok', tags: [], city_ru: 'Минск', meal: 'nomeal', cancellation: null,
      latitude: NEMIGA.lat + ((i % 11) - 5) * 0.006, longitude: NEMIGA.lng + ((i % 13) - 6) * 0.009,
    });
  }
  return out;
}
const SET = makeHotels(1000, 120);
const CAT = {}; SET.forEach(h => { CAT[h.id] = h.category; });
const RATE = i => ({ book_hash: 'h-' + i, room_name: 'Номер ' + (i + 1), meal: 'breakfast', price_byn: 200 + i * 10, images: [], room_amenities: [], taxes_on_site: [], cancellation: { free_cancellation_before: '2026-11-08T10:00:00', policies: [] } });
const HP_OK = { ok: true, hid: 1000, booking_enabled: false, hotel: { description: 'Описание объекта. '.repeat(40), amenities: [], photos: [], check_in: '14:00', check_out: '12:00', policy: null },
  rates: Array.from({ length: 12 }, (_, i) => RATE(i)) };
const NEARBY_OK = { nearby: [{ icon: '🛒', label: 'Магазин', dist: '120 м', meters: 120 }, { icon: '💊', label: 'Аптека', dist: '300 м', meters: 300 }], cached: false };
const OVERPASS_OK = { elements: [
  { type: 'node', id: 1, lat: NEMIGA.lat + 0.001, lon: NEMIGA.lng, tags: { amenity: 'pharmacy' } },
  { type: 'way', id: 2, center: { lat: NEMIGA.lat + 0.004, lon: NEMIGA.lng }, tags: { leisure: 'park' } } ] };

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

async function setup(browser, base, vp, extra) {
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block', timezoneId: 'Europe/Minsk', locale: 'ru-RU' }, vp.opts, extra || {}));
  const log = [];
  const S = { search: () => ({ body: { ok: true, city: 'Минск', hotels: SET, total: SET.length } }), ai: null, nearby: () => NEARBY_OK, overpass: [], leaflet: null };
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith('https://api.zaedem.by'), route => {
    const u = route.request().url();
    if (/overpass/.test(u)) {
      log.push({ path: 'overpass', url: u });
      const mode = S.overpass.shift() || 'fail';
      if (mode === 'fail') return route.fulfill({ status: 504, headers: CORS, contentType: 'text/plain', body: 'Gateway Timeout' });
      if (mode === 'remark') return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ elements: [], remark: 'runtime error: Query timed out' }) });
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(OVERPASS_OK) });
    }
    if (/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(u)) { log.push({ path: 'tile', url: u }); return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG }); }
    if (S.leaflet && /unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/javascript', body: fs.readFileSync(S.leaflet.js) });
    if (S.leaflet && /unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'text/css', body: fs.readFileSync(S.leaflet.css) });
    if (S.leaflet && /leaflet\.markercluster\.js/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/javascript', body: fs.readFileSync(S.leaflet.mc) });
    if (/\.css(\?|$)|fonts\.googleapis/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'text/css', body: '' });
    if (/\.js(\?|$)/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/javascript', body: '' });
    if (/open-meteo/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG });
  });
  await ctx.route('https://api.zaedem.by/**', async route => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    log.push({ path: p, body, t: Date.now() });
    const json = (status, obj) => route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(obj) });
    if (p === '/api/ostrovok/search') { const r = S.search(body); if (r.delay) await new Promise(x => setTimeout(x, r.delay)); return json(r.status || 200, r.body); }
    if (p === '/api/ai/search') { const r = S.ai ? S.ai(body) : { parsed: null, error: true }; if (r.delay) await new Promise(x => setTimeout(x, r.delay)); return json(200, r.body || r); }
    if (p === '/api/nearby') { const r = S.nearby(); if (r.delay) await new Promise(x => setTimeout(x, r.delay)); return json(r.status || 200, r); }
    if (p === '/api/ostrovok/hp') return json(200, HP_OK);
    if (p === '/api/ostrovok/prebook') return json(200, { ok: true, rate: HP_OK.rates[0] });
    if (p === '/api/ostrovok/reviews') return json(200, { reviews: [] });
    if (p === '/api/hotels') return json(200, { hotels: [] });
    if (p === '/api/catalog') return json(200, { ok: true, hotels: [] });
    return json(200, {});
  });
  const page = await ctx.newPage();
  const errors = [], netWarn = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (/Failed to load resource/.test(t)) netWarn.push(t); else errors.push('console: ' + t); } });
  return { ctx, page, log, S, errors, netWarn };
}

async function run(browser, base, vp, leaflet) {
  console.log('\n=== ' + vp.name + ' ===');
  const { ctx, page, log, S, errors, netWarn } = await setup(browser, base, vp);
  const shot = async n => { await page.waitForTimeout(450); return page.screenshot({ path: path.join(SHOTS, vp.tag + '_' + n + '.png') }); };
  const tapOrClick = async loc => { if (vp.mobile) await loc.tap(); else await loc.click(); };
  const last = p => log.filter(x => x.path === p).slice(-1)[0];
  const goHome = async () => { await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} }); await page.goto(base + '/'); await page.waitForTimeout(900); };
  const setTrip = (city) => page.evaluate(c => { window._capState = window._capState || {}; Object.assign(window._capState, { city: c, din: new Date(2026, 10, 10), dout: new Date(2026, 10, 12), adults: 2, kids: 0, childAges: [], gDone: true }); dIn = new Date(2026, 10, 10); dOut = new Date(2026, 10, 12); var sd = document.getElementById('s-dest'); if (sd) sd.value = c; }, city);
  const openSerp = async (city) => { await setTrip(city); await page.evaluate(() => serpOpen()); await page.waitForTimeout(1300); };
  const rectsOverlap = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  const rect = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05 }; }, sel);

  await goHome();

  // ═══ 1. ГРАЖДАНСТВО: родной select, «Частые» и «Все страны», без поля ввода ═══
  const si = await page.evaluate(() => {
    const s = document.querySelector('.zb-res-slot select.zb-res-sel'); if (!s) return null;
    const g = [...s.querySelectorAll('optgroup')];
    const all = [...g[1].children].map(o => o.textContent);
    return { labels: g.map(x => x.label), top: [...g[0].children].map(o => o.value), n1: g[1].children.length, uniq1: new Set([...g[1].children].map(o => o.value)).size,
      sorted: JSON.stringify(all) === JSON.stringify(all.slice().sort((a, b) => a.localeCompare(b, 'ru'))), val: s.value,
      inputs: document.querySelectorAll('.zb-res-wrap input').length, de: [...s.options].find(o => o.value === 'de').textContent, kg: [...s.options].find(o => o.value === 'kg').textContent,
      lower: [...s.options].every(o => /^[a-z]{2}$/.test(o.value)) };
  });
  check('гражданство: в панели гостей родной <select>, поля ввода нет', si && si.inputs === 0, JSON.stringify(si && si.inputs));
  check('группы «Частые» и «Все страны»', si && si.labels.join('|') === 'Частые|Все страны', si && si.labels.join('|'));
  check('«Частые» — 16 стран в заданном порядке', si && si.top.join(',') === 'by,ru,kz,ua,pl,lt,lv,uz,am,ge,az,kg,tj,md,de,cn', si && si.top.join(','));
  check('«Все страны» — 249, по алфавиту', si && si.n1 === 249 && si.uniq1 === 249 && si.sorted, si && (si.n1 + ' sorted=' + si.sorted));
  check('значения — коды маленькими буквами, названия по-русски (Германия, Кыргызстан)', si && si.lower && si.de === 'Германия' && si.kg === 'Кыргызстан', si && (si.de + ',' + si.kg));
  check('по умолчанию — Беларусь', si && si.val === 'by');

  let scope;
  if (vp.mobile) { await setTrip('Минск'); await page.evaluate(() => capSheetOpen(3)); scope = '#cs-step3'; }
  else {
    check('ПК, главная: в окне гостей тоже select', await page.locator('#ddc-guests-section select.zb-res-sel').count() === 1 && await page.locator('#ddc-guests-section input').count() === 0);
    await openSerp('Минск'); await page.evaluate(() => { serpEditSearch(); serpSearchStep(3); }); scope = '#serp-sd-modal';
  }
  await page.waitForTimeout(400);
  const sel = page.locator(scope + ' select.zb-res-sel');
  check('select гражданства виден, в нём «Беларусь»', await sel.isVisible() && await sel.inputValue() === 'by');
  check('в панели гостей нет текстовых полей', await page.evaluate(sc => [...document.querySelectorAll(sc + ' input')].filter(i => i.offsetParent !== null && !/checkbox|radio|hidden/.test(i.type)).length, scope) === 0);
  if (vp.mobile) {
    await sel.tap(); await page.waitForTimeout(300);
    const ae = await page.evaluate(() => ({ tag: document.activeElement && document.activeElement.tagName, cls: document.activeElement && document.activeElement.className }));
    check('телефон: касание открывает системный список (фокус на SELECT, не на поле ввода — клавиатуры нет)', ae.tag === 'SELECT' && /zb-res-sel/.test(ae.cls), JSON.stringify(ae));
    await page.keyboard.press('Escape').catch(() => {});
  } else {
    // настоящие нажатия клавиш (через CDP), как набирает человек на русской раскладке
    await sel.focus();
    const cdp = await ctx.newCDPSession(page);
    for (const ch of 'герм') { await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch }); await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); await page.waitForTimeout(40); }
    await page.waitForTimeout(250);
    check('ПК: набор первых букв в списке («герм») — прыжок на Германию', await sel.inputValue() === 'de', await sel.inputValue());
  }
  await shot('1_grazhdanstvo_select');
  await sel.selectOption('uz'); await page.waitForTimeout(200);
  check('выбран Узбекистан → на устройстве запомнен код uz', await page.evaluate(() => localStorage.getItem('zb_residency')) === 'uz' && await page.evaluate(() => zbResidency()) === 'uz');
  if (vp.mobile) await page.locator('#cs-footer button').tap(); else await page.evaluate(() => serpSearchSubmit());
  await page.waitForTimeout(1300);
  const s1 = last('/api/ostrovok/search');
  check('в /api/ostrovok/search ушло residency=uz', s1 && s1.body && s1.body.residency === 'uz', JSON.stringify(s1 && s1.body && s1.body.residency));
  await page.evaluate(() => openHotel('ost_1000'));
  await page.waitForSelector('.ost-rate-row', { timeout: 8000 }).catch(() => {});
  const hp1 = last('/api/ostrovok/hp');
  check('в /api/ostrovok/hp ушло residency=uz', hp1 && hp1.body && hp1.body.residency === 'uz', JSON.stringify(hp1 && hp1.body && hp1.body.residency));
  // форма брони Островка: гражданство только показано, «изменить» → select в панели гостей объекта
  await page.evaluate(() => ostSelectRate(0));
  await page.waitForSelector('.ost-res-ro a', { timeout: 8000 });
  check('форма брони: показано «Узбекистан»', /Узбекистан/.test(await page.locator('#f-citizen-ro').innerText()));
  await page.locator('.ost-res-ro a').click(); await page.waitForTimeout(700);
  const hpSel = page.locator('#hp-guests-pop.open select.zb-res-sel');
  check('форма брони → «изменить» → в панели гостей объекта select (фокус на нём, поля ввода нет)', await hpSel.isVisible() && await hpSel.inputValue() === 'uz'
    && await page.evaluate(() => document.activeElement && document.activeElement.tagName) === 'SELECT' && await page.locator('#hp-guests-pop input').count() === 0);
  await hpSel.selectOption('kz'); await page.evaluate(() => hpApplyGuests()); await page.waitForTimeout(900);
  check('сменили на Казахстан — цены объекта запрошены с residency=kz', last('/api/ostrovok/hp').body.residency === 'kz');
  // форма брони своих объектов: тот же полный список, значение — название (как раньше), по умолчанию Беларусь
  await page.evaluate(() => { curHotel = { id: 1, source: 'direct', name_ru: 'Тестовый дом', address: 'Минск', photos: [], rooms: [{ name: 'Стандарт', price: 100 }] }; openBookModal(); });
  await page.waitForTimeout(300);
  const own = await page.evaluate(() => { const s = document.getElementById('f-citizen'); const g = [...s.querySelectorAll('optgroup')]; return { tag: s.tagName, labels: g.map(x => x.label).join('|'), n: g[1] && g[1].children.length, v: s.value }; });
  check('форма брони своих объектов: select «Частые» / «Все страны» (249), по умолчанию Беларусь', own.tag === 'SELECT' && own.labels === 'Частые|Все страны' && own.n === 249 && own.v === 'Беларусь', JSON.stringify(own));
  await page.locator('#f-citizen').selectOption('Германия'); await page.waitForTimeout(150);
  check('своя бронь: иностранец → имена на латинице, в бронь уходит «Германия»', await page.evaluate(() => bkCollectGuests().citizenship) === 'Германия' && /Ivan/.test(await page.locator('#f-fn').getAttribute('placeholder')));
  await page.evaluate(() => closeBK());
  await page.reload(); await page.waitForTimeout(900);
  check('после перезагрузки в списках стоит Казахстан', await page.evaluate(() => [...document.querySelectorAll('select.zb-res-sel')].every(s => s.value === 'kz') && document.querySelectorAll('select.zb-res-sel').length > 0));
  await page.evaluate(() => { localStorage.removeItem('zb_residency'); localStorage.removeItem('zb_recent_cities'); });

  // ═══ 2. «ЧТО РЯДОМ» ═══
  await goHome();
  const openHotelPage = async () => { await openSerp('Минск'); await page.evaluate(() => openHotel('ost_1000')); await page.waitForSelector('#hp-nearby', { state: 'attached', timeout: 8000 }); };
  const nb = () => page.evaluate(() => { const b = document.getElementById('hp-nearby'); const o = document.getElementById('hp-near-open'); return { shown: !!(b && b.offsetHeight > 0), text: b ? b.innerText : '', link: !!(o && o.offsetWidth > 0) }; });
  for (const [label, fn] of [['пустой ответ (как сейчас почти везде)', () => ({ nearby: [], cached: true })], ['ошибка бэкенда', () => ({ nearby: [], error: true })], ['HTTP 502', () => ({ status: 502, error: 'bad gateway' })]]) {
    log.length = 0; S.nearby = fn; S.overpass = ['ok'];
    await openHotelPage(); await page.waitForTimeout(1200);
    const r = await nb();
    check('«Что рядом», ' + label + ': блока нет, плашки ошибки нет', !r.shown && !/Не удалось/.test(r.text), JSON.stringify(r));
    check('«Что рядом», ' + label + ': браузер сам Overpass не спрашивает', !log.some(x => x.path === 'overpass'));
    check('«Что рядом», ' + label + ': у адреса маленькая ссылка «Что рядом»', r.link);
  }
  await shot('2_ryadom_net_bloka');
  // гость сам открыл → бэкенд ошибся, оба зеркала Overpass не ответили → «Не удалось» и «Повторить»
  log.length = 0; S.nearby = () => ({ nearby: [], error: true }); S.overpass = ['fail', 'fail'];
  await tapOrClick(page.locator('#hp-near-open')); await page.waitForTimeout(1500);
  let r2 = await nb();
  check('ручное открытие + ошибка → «Не удалось загрузить» и «Повторить»', /Не удалось загрузить/.test(r2.text) && await page.locator('#hp-nearby-err button').isVisible(), JSON.stringify(r2));
  check('ручное открытие: запасной путь спросил оба зеркала', log.filter(x => x.path === 'overpass').length === 2);
  await page.locator('#hp-nearby').scrollIntoViewIfNeeded(); await shot('3_ryadom_povtorit');
  S.nearby = () => NEARBY_OK;
  await tapOrClick(page.locator('#hp-nearby-err button')); await page.waitForTimeout(900);
  r2 = await nb();
  check('«Повторить» — загрузилось (Магазин, Аптека)', /Что рядом/.test(r2.text) && /Магазин/.test(r2.text) && /Аптека/.test(r2.text), r2.text);
  // ручное открытие, бэкенд пуст, Overpass: 1-е зеркало «не успел», 2-е ответило
  S.nearby = () => ({ nearby: [], cached: true }); await openHotelPage(); await page.waitForTimeout(900);
  log.length = 0; S.overpass = ['remark', 'ok'];
  await tapOrClick(page.locator('#hp-near-open')); await page.waitForTimeout(1300);
  r2 = await nb();
  check('ручное открытие: запасной путь (2-е зеркало) показал Аптеку и Парк', /Аптека/.test(r2.text) && /Парк/.test(r2.text), r2.text);
  // бэкенд вернул данные — как раньше
  log.length = 0; S.nearby = () => NEARBY_OK;
  await openHotelPage(); await page.waitForTimeout(900);
  r2 = await nb();
  check('бэкенд вернул данные → блок «Что рядом» как раньше, ссылки нет, Overpass не спрашивали', r2.shown && /Магазин/.test(r2.text) && !r2.link && !log.some(x => x.path === 'overpass'), JSON.stringify(r2));

  // ═══ 3. ПОИСК ПО ОБЛАСТЯМ ═══
  await goHome(); log.length = 0;
  if (vp.mobile) {
    await page.locator('#cap-main').tap(); await page.waitForTimeout(500);
    const pills = await page.locator('#cs-reg-pills button').allTextContents();
    check('телефон: в выборе направления группа «Области» — 6 областей', pills.length === 6 && /Брестская/.test(pills[0]) && /Могилёвская/.test(pills[5]), pills.join(','));
    await page.locator('#cs-reg-pills button', { hasText: 'Минская' }).scrollIntoViewIfNeeded();
    await shot('4_oblasti_vybor');
    await page.locator('#cs-reg-pills button', { hasText: 'Минская' }).tap(); await page.waitForTimeout(600);
    check('телефон: выбрана «Минская область», дальше шаг дат', await page.evaluate(() => window._capState.city) === 'Минская область' && await page.locator('#cs-step2').isVisible());
    await page.evaluate(() => capSheetClose());
    await page.locator('#cap-main').tap(); await page.waitForTimeout(400);
    await page.locator('#cs-city-input').fill('минск'); await page.waitForTimeout(400);
    const sg = await page.locator('#cs-city-suggest [data-city]').evaluateAll(els => els.map(e => e.dataset.city));
    check('телефон: «минск» — первым город Минск, область ниже (город не подменяется)', sg[0] === 'Минск' && sg.indexOf('Минская область') > 0, sg.join(','));
    await page.evaluate(() => capSheetClose());
  } else {
    await page.locator('#cap-main').click({ position: { x: 120, y: 22 } }); await page.waitForTimeout(400);
    const items = await page.locator('#cap-dd-reg .dsk-reg-item').allTextContents();
    check('ПК: в выборе направления группа «Области» — 6 областей', items.length === 6 && /Брестская/.test(items[0]), items.join(','));
    const ddR = await rect('#cap-dd');
    check('ПК: панель направлений помещается в экран (при нехватке места — прокрутка внутри)', ddR && ddR.bottom <= 768, JSON.stringify(ddR));
    await shot('4_oblasti_vybor');
    await page.keyboard.type('минская', { delay: 30 }); await page.waitForTimeout(250);
    let sug = await page.locator('#cap-dd-suggest .ddi-item').evaluateAll(els => els.map(e => e.dataset.city));
    check('ПК: «минская» → подсказка «Минская область»', sug[0] === 'Минская область', sug.join(','));
    await page.locator('#cap-city-inp').fill('минск'); await page.waitForTimeout(250);
    sug = await page.locator('#cap-dd-suggest .ddi-item').evaluateAll(els => els.map(e => e.dataset.city));
    check('ПК: «минск» → первым город Минск (область сама не подставляется)', sug[0] === 'Минск', sug.join(','));
    await page.locator('#cap-city-inp').fill(''); await page.waitForTimeout(200);
    await page.locator('#cap-dd-reg .dsk-reg-item', { hasText: 'Минская' }).scrollIntoViewIfNeeded();
    await page.locator('#cap-dd-reg .dsk-reg-item', { hasText: 'Минская' }).click(); await page.waitForTimeout(400);
    check('ПК: выбрана «Минская область», открыт календарь', await page.evaluate(() => window._capState.city) === 'Минская область' && await page.locator('#cap-dd-cal').isVisible());
    await page.mouse.click(30, 700); await page.waitForTimeout(200);
  }
  // в ответе по области у части объектов адрес с «Минская область», у части — только район/деревня
  const SET_REG = SET.map((h, i) => Object.assign({}, h, { address: i % 2 ? 'Минская область, Логойский р-н, д. Тестовая' : 'Логойский р-н, д. Тестовая, ' + i }));
  S.search = b => (b && /област/.test(b.city)) ? { body: { ok: true, city: b.city, hotels: SET_REG, total: SET_REG.length } } : { body: { ok: true, city: 'Минск', hotels: SET, total: SET.length } };
  await setTrip('Минская область');
  await page.evaluate(() => serpOpen()); await page.waitForTimeout(1300);
  check('по области показаны все объекты ответа (адрес без слова «область» не отсеивается)', new RegExp('Найдено: ' + SET_REG.length + ' ').test(await page.locator('#serp-meta').innerText() + ' '), await page.locator('#serp-meta').innerText());
  const sr = last('/api/ostrovok/search');
  check('в /api/ostrovok/search ушло city=«Минская область»', sr && sr.body && sr.body.city === 'Минская область', JSON.stringify(sr && sr.body && sr.body.city));
  const note = page.locator('#serp-region-note');
  check('в выдаче подсказка «Поиск по всей области»', await note.isVisible() && /Поиск по всей области/.test(await note.innerText()) && /Минская область/.test(await note.innerText()));
  check('строка поиска — «Минская область · …»', /^Минская область/.test(await page.locator('#serp-pill-text').innerText()));
  await shot('5_oblast_vydacha');
  await tapOrClick(page.locator('#srn-type')); await page.waitForTimeout(400);
  let ids = await page.evaluate(() => [...document.querySelectorAll('#serp-cards .sr-card')].map(c => c.dataset.hid));
  check('кнопка «Усадьбы и загородные» — в выдаче только усадьбы, кнопка нажата', ids.length > 0 && ids.every(id => CAT_OK(id)) && /on/.test(await page.locator('#srn-type').getAttribute('class')), ids.slice(0, 4).join(','));
  function CAT_OK(id) { return CAT[id] === 'guest'; }
  await shot('6_oblast_usadby');
  await tapOrClick(page.locator('#srn-type')); await page.waitForTimeout(400);
  ids = await page.evaluate(() => [...document.querySelectorAll('#serp-cards .sr-card')].map(c => c.dataset.hid));
  check('повторное нажатие — снова все типы', ids.some(id => CAT[id] !== 'guest'));
  if (!vp.mobile) {
    await page.evaluate(() => { serpEditSearch(); serpSearchStep(1); }); await page.waitForTimeout(300);
    const t = await page.locator('#ssd-city-list').innerText();
    check('ПК: в правке поиска на выдаче тоже группа «Области»', /Области/i.test(t) && /Гродненская область/.test(t));
    await page.keyboard.press('Escape'); await page.evaluate(() => { var m = document.getElementById('serp-sd-modal'); if (m) m.remove(); });
  }
  await openSerp('Минск');
  check('обычный город (Минск) — подсказки области нет', !(await note.isVisible()));
  // бэкенд пока не умеет область — ошибка → «Поиск по областям скоро появится»
  for (const [label, resp] of [['HTTP 500', { status: 500, body: { error: 'region not found' } }], ['reason: region_not_found_by', { body: { ok: true, city: 'Минская область', hotels: [], total: 0, reason: 'region_not_found_by' } }]]) {
    S.search = b => (b && /област/.test(b.city)) ? resp : { body: { ok: true, city: 'Минск', hotels: SET, total: SET.length } };
    await openSerp('Минская область');
    check('ошибка для области (' + label + ') → «Поиск по областям скоро появится»', await page.locator('#serp-region-soon').isVisible() && /Поиск по областям скоро появится/.test(await page.locator('#serp-region-soon').innerText()));
  }
  await shot('7_oblast_skoro');
  S.search = () => ({ body: { ok: true, city: 'Минск', hotels: SET, total: SET.length } });

  // ═══ 4. ИИ-ФРАЗЫ С ОБЛАСТЬЮ ═══
  const aiRun = async (phrase, aiCity, cat) => {
    await goHome(); log.length = 0;
    S.ai = () => ({ delay: 300, body: { parsed: { city: aiCity, area: null, name: null, category: cat || null, adults: 2, kids: null, childAges: [], priceMax: null, din: '2026-11-10', dout: '2026-11-12', amenities: [], avoid: [] }, error: false } });
    await page.evaluate(() => switchSearch('ai'));
    await page.locator('#ai-q').fill(phrase); await page.locator('#ai-q').press('Enter');
    await page.waitForTimeout(2000);
    return { city: await page.evaluate(() => window._capState.city), sent: log.filter(x => x.path === '/api/ostrovok/search').map(x => x.body.city) };
  };
  let a = await aiRun('усадьба под Минском на двоих с 10 по 12 ноября', 'Минск', 'guest');
  check('ИИ: «усадьба под Минском» → «Минская область» (ИИ ответил «Минск» — не перебивает)', a.city === 'Минская область' && a.sent.length && a.sent.every(c => c === 'Минская область'), JSON.stringify(a));
  check('ИИ: подсказка «Поиск по всей области» видна', await page.locator('#serp-region-note').isVisible());
  a = await aiRun('домик в Гродненской области на двоих с 10 по 12 ноября', 'Гродненская область', 'guest');
  check('ИИ: «в Гродненской области» → «Гродненская область»', a.city === 'Гродненская область' && a.sent.every(c => c === 'Гродненская область'), JSON.stringify(a));
  a = await aiRun('квартира в Минской обл. на двоих с 10 по 12 ноября', 'Минская область', 'apart');
  check('ИИ: «в Минской обл.» → «Минская область»', a.city === 'Минская область', JSON.stringify(a));
  a = await aiRun('отель в Минске на двоих с 10 по 12 ноября', 'Минская область', 'hotel');
  check('ИИ: «отель в Минске» (ИИ ответил областью) → Минск: город сам областью не подменяется', a.city === 'Минск' && a.sent.every(c => c === 'Минск'), JSON.stringify(a));
  S.ai = null;

  // ═══ 5–6. «НАВЕРХ» И «КАРТА» ═══
  await goHome();
  await openSerp('Минск');
  const upState = () => page.evaluate(() => { const b = document.getElementById('zb-up'); const cs = getComputedStyle(b); return { show: b.classList.contains('show'), op: parseFloat(cs.opacity), vis: cs.visibility }; });
  const scroller = vp.mobile ? 'window' : '#serp-list';
  const scrollTo = y => page.evaluate(([s, y]) => { if (s === 'window') window.scrollTo(0, y); else document.querySelector(s).scrollTop = y; }, [scroller, y]);
  const scrollY = () => page.evaluate(s => s === 'window' ? window.scrollY : document.querySelector(s).scrollTop, scroller);
  const viewH = await page.evaluate(s => s === 'window' ? window.innerHeight : document.querySelector(s).clientHeight, scroller);
  await scrollTo(0); await page.waitForTimeout(400);
  let u = await upState();
  check('«Наверх»: у верха спрятана', !u.show && u.vis === 'hidden', JSON.stringify(u));
  await scrollTo(Math.round(viewH * 1.2)); await page.waitForTimeout(400);
  check('«Наверх»: пролистали 1,2 экрана — ещё спрятана', !(await upState()).show);
  await scrollTo(Math.round(viewH * 1.7)); await page.waitForTimeout(450);
  u = await upState();
  check('«Наверх»: пролистали больше 1,5 экрана — появилась', u.show && u.op > 0.95 && u.vis === 'visible', JSON.stringify(u));
  const upR = await rect('#zb-up'), vw = vp.opts.viewport.width, vh = vp.opts.viewport.height;
  if (vp.mobile) {
    const mapR = await rect('#serp-map-btn');
    check('телефон: «Наверх» слева внизу, с отступом от края', upR.left >= 12 && upR.right < vw / 2 && vh - upR.bottom >= 16, JSON.stringify(upR));
    check('телефон: «Наверх» и «Карта» не налезают друг на друга', mapR && mapR.vis && !rectsOverlap(upR, mapR), JSON.stringify({ upR, mapR }));
  } else {
    const mapR = await rect('#serp-map');
    const onCards = await page.evaluate(u => [...document.querySelectorAll('#serp-cards .sr-card, #serp-more')].filter(c => { const r = c.getBoundingClientRect(); return !(r.right <= u.left || u.right <= r.left || r.bottom <= u.top || u.bottom <= r.top); }).length, upR);
    check('ПК: «Наверх» справа внизу на границе списка и карты, не на карточках', upR.left > vw / 2 && Math.abs((upR.left + upR.right) / 2 - mapR.left) <= 3 && onCards === 0 && vh - upR.bottom >= 16, JSON.stringify({ upR, map: mapR.left, onCards }));
  }
  await shot('8_naverh');
  if (vp.mobile) {
    // «Показать ещё» на экране → «Карта» плавно уходит; ушла с экрана → возвращается
    await page.evaluate(() => document.getElementById('serp-more').scrollIntoView({ block: 'center' })); await page.waitForTimeout(600);
    let m = await rect('#serp-map-btn'); const moreR = await rect('#serp-more'); u = await upState();
    check('«Карта» ушла, когда «Показать ещё» на экране', !m.vis && await page.evaluate(() => document.body.classList.contains('zb-mapbtn-away')), JSON.stringify(m));
    check('«Наверх» при этом не перекрывает «Показать ещё»', !u.show || !rectsOverlap(await rect('#zb-up'), moreR), JSON.stringify({ more: moreR }));
    await shot('9_karta_ushla');
    await scrollTo(Math.round(viewH * 1.7)); await page.waitForTimeout(600);
    m = await rect('#serp-map-btn');
    check('«Показать ещё» ушла с экрана — «Карта» вернулась', m.vis && !(await page.evaluate(() => document.body.classList.contains('zb-mapbtn-away'))), JSON.stringify(m));
    // «Показать ещё» нажали — новая кнопка тоже отслеживается
    await page.evaluate(() => document.getElementById('serp-more').click()); await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById('serp-more').scrollIntoView({ block: 'center' })); await page.waitForTimeout(600);
    check('после «Показать ещё» новая кнопка тоже прячет «Карта»', !(await rect('#serp-map-btn')).vis);
    // подвал: на выдаче он скрыт стилями, показываем его на время проверки — «Карта» уходит и у подвала
    await scrollTo(Math.round(viewH * 1.7)); await page.waitForTimeout(500);
    await page.evaluate(() => { const f = document.querySelector('footer'); f.style.setProperty('display', 'block', 'important'); f.style.setProperty('position', 'fixed', 'important'); f.style.setProperty('top', '0', 'important'); f.style.setProperty('height', '60px', 'important'); f.style.setProperty('overflow', 'hidden', 'important'); });
    await page.waitForTimeout(600);
    check('«Карта» уходит, когда на экране подвал', !(await rect('#serp-map-btn')).vis);
    await page.evaluate(() => { const f = document.querySelector('footer'); ['display', 'position', 'top', 'height', 'overflow'].forEach(p => f.style.removeProperty(p)); });
    await page.waitForTimeout(600);
    check('подвал ушёл — «Карта» вернулась', (await rect('#serp-map-btn')).vis);
    // по всей длине выдачи «Наверх» и «Карта» не пересекаются
    let clash = 0;
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += Math.round(viewH * 0.8)) {
      await scrollTo(y); await page.waitForTimeout(320);
      const a1 = await rect('#zb-up'), b1 = await rect('#serp-map-btn');
      if (a1.vis && b1.vis && rectsOverlap(a1, b1)) clash++;
    }
    check('по всей длине выдачи «Наверх» и «Карта» ни разу не пересеклись', clash === 0, String(clash));
    // открыта карта — «Наверх» прячется
    await scrollTo(Math.round(viewH * 1.7)); await page.waitForTimeout(400);
    await page.evaluate(() => serpMapToggle()); await page.waitForTimeout(400);
    check('открыта карта — «Наверх» спрятана, кнопка «Список» на месте', !(await upState()).show && (await rect('#serp-map-btn')).vis);
    await page.evaluate(() => serpMapToggle()); await page.waitForTimeout(400);
  }
  await scrollTo(Math.round(viewH * 1.7)); await page.waitForTimeout(400);
  await tapOrClick(page.locator('#zb-up'));
  await page.waitForTimeout(1500);
  check('нажали «Наверх» — плавно вернулись наверх, кнопка спряталась', (await scrollY()) === 0 && !(await upState()).show, String(await scrollY()));
  // длинная страница объекта
  await page.evaluate(() => openHotel('ost_1000')); await page.waitForSelector('.ost-rate-row', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  const hpH = await page.evaluate(() => document.documentElement.scrollHeight);
  if (hpH > vh * 2.2) {
    await page.evaluate(h => window.scrollTo(0, h), Math.round(vh * 1.8)); await page.waitForTimeout(450);
    check('страница объекта: пролистали — «Наверх» появилась', (await upState()).show);
    await shot('10_naverh_obekt');
    await tapOrClick(page.locator('#zb-up')); await page.waitForTimeout(1500);
    check('страница объекта: «Наверх» вернула к началу', await page.evaluate(() => window.scrollY) === 0);
  } else check('страница объекта достаточно длинная для проверки', false, String(hpH));

  // ═══ 7. СЛОВО «ТУРИСТ» ═══
  await goHome();
  await page.evaluate(() => openAuth()); await page.waitForTimeout(300);
  const tabs = await page.locator('#auth-body button').allTextContents();
  check('вход: вкладки «Гость» и «Владелец жилья»', tabs.some(t => t.trim() === 'Гость') && tabs.some(t => t.trim() === 'Владелец жилья'), tabs.map(t => t.trim()).join(' | '));
  check('вход: по умолчанию вкладка гостя — поиск брони', /Найдите бронь по номеру и email/.test(await page.locator('#auth-body').innerText()));
  await shot('11_vhod_gost');
  await page.evaluate(() => document.getElementById('auth-modal').classList.remove('open'));
  for (const f of ['index.html', 'oferta.html', 'privacy.html', 'terms.html', 'confidential.html', 'contacts.html', 'payment.html', 'ostrovok-admin.html']) {
    await page.goto(base + '/' + f); await page.waitForTimeout(f === 'index.html' ? 900 : 300);
    if (f === 'index.html') await page.evaluate(() => openAuth());
    const hits = await page.evaluate(() => {
      const re = /турист|туризм/i, out = [];
      if (re.test(document.title)) out.push('title');
      if (re.test(document.body.innerText)) out.push('text');
      document.querySelectorAll('*').forEach(e => { for (const a of ['title', 'alt', 'aria-label', 'placeholder', 'content', 'onclick']) { const v = e.getAttribute(a); if (v && re.test(v)) out.push(a + '@' + e.tagName); } });
      if (re.test(document.documentElement.outerHTML)) out.push('html');
      return out;
    });
    check('нет слова «турист» на странице ' + f, hits.length === 0, hits.join(','));
  }

  check('нет горизонтальной прокрутки', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('ошибок JS в консоли нет', errors.length === 0, errors.join(' | '));
  if (netWarn.length) console.log('  (браузер отметил ' + netWarn.length + ' ответа с кодом ошибки — это намеренные 500/502/504 заглушек: бэкенд и зеркала Overpass)');
  await ctx.close();
}

// «Наверх» при «уменьшить движение» — сразу, без анимации
async function runReduced(browser, base) {
  console.log('\n=== Телефон 390×844, «уменьшить движение» ===');
  const vp = { mobile: true, opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
  const { ctx, page, errors } = await setup(browser, base, vp, { reducedMotion: 'reduce' });
  await page.goto(base + '/'); await page.waitForTimeout(800);
  await page.evaluate(() => { window._capState = { city: 'Минск', din: new Date(2026, 10, 10), dout: new Date(2026, 10, 12), adults: 2, kids: 0, childAges: [], gDone: true }; serpOpen(); });
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 1.8))); await page.waitForTimeout(150);
  const shown = await page.evaluate(() => { const b = document.getElementById('zb-up'); return b.classList.contains('show') && getComputedStyle(b).opacity === '1'; });
  check('«уменьшить движение»: кнопка появляется сразу, без плавности', shown);
  await page.locator('#zb-up').tap(); await page.waitForTimeout(80);
  check('«уменьшить движение»: прокрутка наверх мгновенная', await page.evaluate(() => window.scrollY) === 0, String(await page.evaluate(() => window.scrollY)));
  check('«уменьшить движение»: ошибок JS нет', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Карты: без ключа — OpenStreetMap, с ключом в ZB_MAP_KEY — CARTO light_all (поиск и карта объекта)
async function runCarto(browser, base, leaflet, vp) {
  console.log('\n=== Карты, ' + vp.name + ' ===');
  for (const withKey of [false, true]) {
    const { ctx, page, log, S, errors } = await setup(browser, base, vp);
    S.leaflet = leaflet;
    await page.goto(base + (withKey ? '/carto/' : '/')); await page.waitForTimeout(1200);
    await page.evaluate(() => { window._capState = { city: 'Минск', din: new Date(2026, 10, 10), dout: new Date(2026, 10, 12), adults: 2, kids: 0, childAges: [], gDone: true }; serpOpen(); });
    await page.waitForTimeout(1500);
    if (vp.mobile) { await page.evaluate(() => serpMapToggle()); await page.waitForTimeout(800); }
    const serpTiles = log.filter(x => x.path === 'tile').map(x => x.url);
    if (vp.mobile) { await page.evaluate(() => serpMapToggle()); await page.waitForTimeout(300); }
    log.length = 0;
    await page.evaluate(() => openHotel('ost_1000')); await page.waitForTimeout(900);
    await page.evaluate(() => openHotelMap()); await page.waitForTimeout(1200);
    const hpTiles = log.filter(x => x.path === 'tile').map(x => x.url);
    const L1 = await page.evaluate(() => typeof L);
    const ok = list => list.length > 0 && list.every(u => withKey
      ? /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/rastertiles\/light_all\/\d+\/\d+\/\d+(@2x)?\.png\?key=TEST-CARTO-KEY$/.test(u)
      : /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u));
    const what = withKey ? 'ключ вписан → CARTO light_all с ключом' : 'ключа нет → OpenStreetMap';
    check('Leaflet загрузился', L1 === 'object');
    check('карта поиска: ' + what, ok(serpTiles), serpTiles.slice(0, 2).join(' '));
    check('карта объекта: ' + what, ok(hpTiles), hpTiles.slice(0, 2).join(' '));
    if (withKey) await page.screenshot({ path: path.join(SHOTS, (vp.mobile ? '390' : '1366') + '_12_karta_carto.png') });
    check('карты (' + (withKey ? 'с ключом' : 'без ключа') + '): ошибок JS нет', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch();
  const leaflet = findLeaflet();
  try {
    await run(browser, base, { name: 'Телефон 390×844 (тач)', tag: '390', mobile: true, opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }, leaflet);
    await run(browser, base, { name: 'Телефон 360×740 (тач)', tag: '360', mobile: true, opts: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }, leaflet);
    await run(browser, base, { name: 'ПК 1366×768', tag: '1366', mobile: false, opts: { viewport: { width: 1366, height: 768 } } }, leaflet);
    await runReduced(browser, base);
    if (leaflet) {
      await runCarto(browser, base, leaflet, { name: 'ПК 1366×768', mobile: false, opts: { viewport: { width: 1366, height: 768 } } });
      await runCarto(browser, base, leaflet, { name: 'телефон 390×844', mobile: true, opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
    } else console.log('\n(Leaflet не найден — проверка карт с ключом CARTO пропущена; см. ZB_LEAFLET_DIR в шапке)');
  } finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  fs.writeFileSync(path.join(__dirname, 'result_16_10.json'), JSON.stringify(results, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
