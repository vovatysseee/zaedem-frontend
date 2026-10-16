// 15.10: проверка правок поиска: гражданство (все страны, поиск по вводу), город в основной строке
// «Куда едете?», «Что рядом» (успех, запасной путь, ошибка → «Повторить»), ИИ-фраза со многими фильтрами.
// Все ответы API и внешних сервисов — заглушки, сайт отдаётся локально.
// 16.10: проверки поля ввода гражданства и «Что рядом» с плашкой ошибки убраны — это поведение заменено,
// новое проверяет poisk_16_10.test.js.
// Запуск из корня репозитория:  node .github/poisk-test/poisk_15_10.test.js
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

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

const CORS = { 'Access-Control-Allow-Origin': '*' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// ── выдача Островка для заглушки: 360 объектов в Минске, разные звёзды/питание/отмена/удобства/место ──
const NEMIGA = { lat: 53.9058, lng: 27.5536 };
function makeHotels(idBase) {
  const out = [];
  for (let i = 0; i < 360; i++) {
    const rating = i % 6;
    const meal = rating === 5 ? ['nomeal', 'breakfast', 'half-board'][i % 3] : ['nomeal', 'breakfast', 'half-board', 'breakfast-buffet', 'all-inclusive'][i % 5];
    const tags = [];
    if (i % 2 === 0) tags.push('parking');
    if (i % 7 < 3) tags.push('pool');
    out.push({
      id: 'ost_' + (idBase + i), hid: idBase + i, name_ru: 'Отель ' + (idBase + i), address: 'Минск, ул. Тестовая, ' + i,
      category: i % 3 === 0 ? 'apart' : (i % 10 === 1 ? 'guest' : 'hotel'), rating, reviews_count: null,
      price: 80 + (i * 37) % 400, price_total: 2 * (80 + (i * 37) % 400), nights: 2, oldPrice: null, photos: [], amenities: [],
      source: 'ostrovok', tags, city_ru: 'Минск', meal, cancellation: i % 4 !== 0 ? '2026-11-09T09:00:00' : null,
      latitude: NEMIGA.lat + ((i % 11) - 5) * 0.006, longitude: NEMIGA.lng + ((i % 13) - 6) * 0.009,
    });
  }
  return out;
}
const SET_A = makeHotels(0);      // ответ ПЕРВОГО поиска (даты локального разбора) — приходит поздно
const SET_B = makeHotels(1000);   // ответ ВТОРОГО поиска (даты, поправленные ИИ) — приходит сразу
function distKm(a, b, c, d) { const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t; const q = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)); }
function mealRank(m) { if (!m || m === 'nomeal') return 0; if (/all-inclusive/.test(m)) return 4; if (/full-board/.test(m)) return 3; if (/half-board/.test(m)) return 2; if (/breakfast/.test(m)) return 1; return 0.5; }

const HP_OK = { ok: true, hid: 1000, booking_enabled: false, hotel: { description: 'Описание', amenities: [], photos: [], check_in: '14:00', check_out: '12:00', policy: null },
  rates: [{ book_hash: 'h-A', room_name: 'Стандарт', meal: 'breakfast', price_byn: 200, images: [], room_amenities: [], taxes_on_site: [], cancellation: { free_cancellation_before: '2026-11-08T10:00:00', policies: [] } }] };
const NEARBY_OK = { nearby: [{ icon: '🛒', label: 'Магазин', dist: '120 м', meters: 120 }, { icon: '💊', label: 'Аптека', dist: '300 м', meters: 300 }, { icon: '🚌', label: 'Остановка', dist: '80 м', meters: 80 }], cached: false };
const OVERPASS_OK = { elements: [
  { type: 'node', id: 1, lat: NEMIGA.lat + 0.001, lon: NEMIGA.lng, tags: { amenity: 'pharmacy' } },
  { type: 'way', id: 2, center: { lat: NEMIGA.lat + 0.004, lon: NEMIGA.lng }, tags: { leisure: 'park' } },
  { type: 'node', id: 3, lat: NEMIGA.lat, lon: NEMIGA.lng + 0.002, tags: { shop: 'supermarket' } } ] };

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

async function run(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block' }, vp.opts));
  const log = [];
  const S = { search: () => ({ body: { ok: true, city: 'Минск', hotels: SET_B, total: SET_B.length } }), ai: null, nearby: () => NEARBY_OK, overpass: [] };
  // внешние сервисы: CDN/шрифты/картинки — пустышки; Overpass — по сценарию теста
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith('https://api.zaedem.by'), route => {
    const u = route.request().url();
    if (/overpass/.test(u)) {
      log.push({ path: 'overpass', url: u });
      const mode = S.overpass.shift() || 'fail';
      if (mode === 'fail') return route.abort('failed');
      if (mode === 'remark') return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 13 seconds.' }) });
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(OVERPASS_OK) });
    }
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
    if (p === '/api/ostrovok/search') { const r = S.search(body); if (r.delay) await new Promise(x => setTimeout(x, r.delay)); return json(200, r.body); }
    if (p === '/api/ai/search') { const r = S.ai ? S.ai(body) : { parsed: null, error: true }; if (r.delay) await new Promise(x => setTimeout(x, r.delay)); return json(200, r.body || r); }
    if (p === '/api/nearby') { const r = S.nearby(); if (r.delay) await new Promise(x => setTimeout(x, r.delay)); return json(200, r); }
    if (p === '/api/ostrovok/hp') return json(200, HP_OK);
    if (p === '/api/ostrovok/reviews') return json(200, { reviews: [] });
    if (p === '/api/hotels') return json(200, { hotels: [] });
    if (p === '/api/catalog') return json(200, { ok: true, hotels: [] });
    return json(200, {});
  });
  const page = await ctx.newPage();
  const errors = [], netWarn = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (/Failed to load resource/.test(t)) netWarn.push(t); else errors.push('console: ' + t); } });
  const shot = async n => { await page.waitForTimeout(500); return page.screenshot({ path: path.join(SHOTS, vp.tag + '_' + n + '.png') }); };
  const tapOrClick = async loc => { if (vp.mobile) await loc.tap(); else await loc.click(); };
  const last = p => log.filter(x => x.path === p).slice(-1)[0];

  await page.goto(base + '/');
  await page.waitForTimeout(900);

  // сайт помнит открытый экран (выдачу) в sessionStorage — для проверок с главной начинаем с чистой вкладки
  const goHome = async () => { await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} }); await page.goto(base + '/'); await page.waitForTimeout(900); };
  // ZB_ONLY=ai — только ИИ-сценарий (так он прогоняется и на старой версии сайта, для сравнения)
  if (!process.env.ZB_ONLY) {
  // ═══ 1. ГРАЖДАНСТВО: все страны, частые сверху, поиск по вводу ═══
  const info = await page.evaluate(() => {
    const L = ZB_COUNTRIES; const top = L.slice(0, 16).map(c => c[0]);
    const rest = L.slice(16).map(c => c[1]);
    const sorted = rest.slice().sort((a, b) => a.localeCompare(b, 'ru'));
    return { n: L.length, uniq: new Set(L.map(c => c[0])).size, top, restSorted: JSON.stringify(rest) === JSON.stringify(sorted),
      lower: L.every(c => /^[a-z]{2}$/.test(c[0])), ru: L.every(c => /[А-Яа-яЁё]/.test(c[1])), def: zbResidency(), de: zbResName('de'), kg: zbResName('kg') };
  });
  check('в списке гражданства все страны ISO 3166-1 alpha-2: 249', info.n === 249 && info.uniq === 249, JSON.stringify(info.n));
  check('частые сверху в заданном порядке (Беларусь, Россия, Казахстан … Германия, Китай)',
    info.top.join(',') === 'by,ru,kz,ua,pl,lt,lv,uz,am,ge,az,kg,tj,md,de,cn', info.top.join(','));
  check('дальше — все по алфавиту', info.restSorted);
  check('коды маленькими буквами, названия по-русски', info.lower && info.ru);
  check('по умолчанию — Беларусь', info.def === 'by');
  check('Кыргызстан назван как в задании', info.kg === 'Кыргызстан', info.kg);

  // 16.10: поле с поиском по вводу заменено родным select — выбор в панели гостей проверяет
  // .github/poisk-test/poisk_16_10.test.js (раздел «Гражданство»)
  await page.evaluate(() => { localStorage.removeItem('zb_residency'); localStorage.removeItem('zb_recent_cities'); });

  // ═══ 2. ГОРОД — в основной строке «Куда едете?» ═══
  await goHome();
  const visibleTextInputs = () => page.evaluate(() => [...document.querySelectorAll('input[type=text],input:not([type])')].filter(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(i).visibility !== 'hidden'; }).map(i => i.id || i.className));
  if (!vp.mobile) {
    await page.locator('#cap-main').click({ position: { x: 120, y: 22 } });
    await page.waitForTimeout(400);
    const act = await page.evaluate(() => { const a = document.activeElement; return { id: a && a.id, inCap: !!(a && document.getElementById('cap-main').contains(a)) }; });
    check('ПК: клик в «Куда едете?» — курсор в самой строке', act.id === 'cap-city-inp' && act.inCap, JSON.stringify(act));
    const vis = await visibleTextInputs();
    check('ПК: второго поля «Введите город…» нет — на экране одно поле', vis.length === 1 && vis[0] === 'cap-city-inp', vis.join(','));
    check('ПК: под строкой популярные города', await page.locator('#cap-dd').isVisible() && await page.locator('#cap-dd-list .dsk-city-item').count() >= 20);
    await page.keyboard.type('мог', { delay: 40 }); await page.waitForTimeout(300);
    const sug = await page.locator('#cap-dd-suggest .ddi-item').allTextContents();
    check('ПК: набрал «мог» — подсказка Могилёв, популярные скрыты', sug.length && /Могилёв/.test(sug[0]) && !(await page.locator('#cap-dd-pop').isVisible()), sug.join(','));
    await shot('3_gorod_v_stroke');
    for (const [q, want] of [['vbycr', 'Минск'], ['в минске', 'Минск'], ['hrodna', 'Гродно'], ['могилев', 'Могилёв']]) {
      await page.locator('#cap-city-inp').fill(q); await page.waitForTimeout(150);
      const r = await page.locator('#cap-dd-suggest .ddi-item').allTextContents();
      check('ПК: «' + q + '» → ' + want, r.length && r[0].indexOf(want) >= 0, r.join(','));
    }
    await page.locator('#cap-city-inp').fill('гомел'); await page.waitForTimeout(150);
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    check('ПК: Enter — выбран Гомель, открыт календарь, строка снова надпись', await page.evaluate(() => window._capState.city) === 'Гомель'
      && await page.locator('#cap-dd-cal').isVisible() && !(await page.locator('#cap-city-inp').isVisible()) && /Гомель/.test(await page.locator('#cap-top').innerText()));
    await page.mouse.click(30, 700); await page.waitForTimeout(300);
    await page.locator('#cap-main').click({ position: { x: 120, y: 22 } }); await page.waitForTimeout(400);
    check('ПК: недавние города — Гомель', /Гомель/.test(await page.locator('#cap-dd-recent').innerText()) && await page.locator('#cap-dd-recent-wrap').isVisible());
    check('ПК: при повторном открытии в строке текущий город (выделен для замены)', await page.locator('#cap-city-inp').inputValue() === 'Гомель');
    await page.keyboard.type('бре'); await page.waitForTimeout(200);
    await page.locator('#cap-dd-suggest .ddi-item').first().click(); await page.waitForTimeout(400);
    check('ПК: щелчок по подсказке — Брест', await page.evaluate(() => window._capState.city) === 'Брест');
    await page.mouse.click(30, 700); await page.waitForTimeout(300);
    await page.locator('#cap-main').click({ position: { x: 120, y: 22 } }); await page.waitForTimeout(300);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    check('ПК: Esc — панель закрыта, строка снова «Брест · …»', !(await page.locator('#cap-dd').isVisible()) && /Брест/.test(await page.locator('#cap-top').innerText()));
  } else {
    await page.locator('#cap-main').tap(); await page.waitForTimeout(500);
    // 16.10: шторка открывается БЕЗ клавиатуры (курсор не в поле); печатать — нажав в поле (порция «шторка без прыжков»)
    const act = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('телефон: касание «Куда едете?» — экран выбора города, клавиатура не выскакивает (16.10)', act !== 'cs-city-input', act);
    const vis = await visibleTextInputs();
    check('телефон: на экране одно поле города', vis.length === 1 && vis[0] === 'cs-city-input', vis.join(','));
    await page.locator('#cs-city-input').tap(); await page.waitForTimeout(300);
    await page.keyboard.type('инск', { delay: 40 }); await page.waitForTimeout(400);
    const sug = await page.locator('#cs-city-suggest [data-city]').allTextContents();
    check('телефон: «инск» — Минск (раньше искало только с начала названия)', sug.some(x => /Минск/.test(x)), sug.join(','));
    await page.locator('#cs-city-input').fill('vbycr'); await page.waitForTimeout(400);
    check('телефон: английская раскладка «vbycr» → Минск', /Минск/.test(await page.locator('#cs-city-suggest').innerText()));
    await page.locator('#cs-city-input').fill('гродн'); await page.waitForTimeout(450);
    await shot('3_gorod_telefon');
    await page.locator('#cs-city-suggest [data-city="Гродно"]').tap(); await page.waitForTimeout(600);
    check('телефон: выбран Гродно, дальше шаг дат', await page.evaluate(() => window._capState.city) === 'Гродно' && await page.locator('#cs-step2').isVisible());
    await page.evaluate(() => capSheetClose()); await page.waitForTimeout(200);
    await page.locator('#cap-main').tap(); await page.waitForTimeout(500);
    check('телефон: недавние города — Гродно', await page.locator('#cs-recent-wrap').isVisible() && /Гродно/.test(await page.locator('#cs-recent-pills').innerText()));
    await page.evaluate(() => capSheetClose());
  }

  // 16.10: «Что рядом» теперь без плашки ошибки при автозагрузке — проверяет poisk_16_10.test.js
  } // конец разделов 1–3
  // ═══ 4. ИИ-ФРАЗА СО МНОГИМИ ФИЛЬТРАМИ ═══
  await goHome();
  log.length = 0;
  // первый поиск (даты из фразы, 10–12.11) отвечает через 2,5 с; ИИ через 0,7 с поправляет даты на 11–13.11 →
  // второй поиск отвечает сразу. Раньше обе выдачи складывались: 360 + 360 = 720.
  S.search = b => (b && b.checkin === '2026-11-10') ? { delay: 2500, body: { ok: true, city: 'Минск', hotels: SET_A, total: 360 } } : { body: { ok: true, city: 'Минск', hotels: SET_B, total: 360 } };
  S.ai = () => ({ delay: 700, body: { parsed: { city: 'Минская область', area: 'метро Немига', areaGeo: NEMIGA, name: null, category: 'hotel', adults: 2, kids: null, childAges: [], priceMax: 300, din: '2026-11-11', dout: '2026-11-13', amenities: ['парковка'], avoid: [] }, error: false } });
  const PHRASE = 'хочу отель в Минске 4 звезды с завтраком и бесплатной отменой до 300 с парковкой и бассейном у метро Немига на двоих с 10 по 12 ноября';
  await page.evaluate(() => switchSearch('ai'));
  await page.locator('#ai-q').fill(PHRASE);
  await page.locator('#ai-q').press('Enter');
  await page.waitForTimeout(4200);
  const expB = SET_B.filter(h => h.category === 'hotel' && h.rating >= 4 && mealRank(h.meal) >= 1 && h.cancellation && h.price <= 300
    && h.tags.includes('parking') && h.tags.includes('pool') && distKm(NEMIGA.lat, NEMIGA.lng, h.latitude, h.longitude) <= 3);
  const st = await page.evaluate(() => ({ city: window._capState.city, ost: HOTELS.filter(h => h.source === 'ostrovok').length, ids: HOTELS.filter(h => h.source === 'ostrovok').map(h => h.hid),
    meta: (document.getElementById('serp-meta') || {}).textContent, stars: window._aiStars, meal: window._aiMeal, amen: window._aiAmenities, area: window._aiArea && window._aiArea.label,
    free: document.getElementById('sft-free').classList.contains('active'), cat: window._aiCategory, price: window._aiPriceMax,
    chips: (document.getElementById('serp-ai-chips') || {}).innerText, cards: [...document.querySelectorAll('#serp-cards .sr-card')].map(c => c.dataset.hid) }));
  const searches = log.filter(x => x.path === '/api/ostrovok/search');
  check('ИИ-фраза: было два поиска (локальный разбор и поправка ИИ)', searches.length === 2, String(searches.length));
  check('выдачи двух поисков НЕ сложились: в памяти 360 объектов, все из последнего поиска', st.ost === 360 && st.ids.every(id => id >= 1000), 'ost=' + st.ost);
  check('город не стал областью: «Минская область» от ИИ → Минск', st.city === 'Минск' && searches.every(s => s.body.city === 'Минск'), st.city + ' / ' + searches.map(s => s.body.city).join(','));
  check('применены: тип «отель», цена до 300, звёзды от 4, завтрак, бесплатная отмена', st.cat === 'hotel' && st.price === 300 && st.stars === 4 && st.meal === 'breakfast' && st.free, JSON.stringify({ cat: st.cat, price: st.price, stars: st.stars, meal: st.meal, free: st.free }));
  check('удобства: «бассейн» из фразы не потерялся, хотя ИИ вернул только «парковку»', (st.amen || []).some(a => /бассейн/.test(a)) && (st.amen || []).some(a => /парковк/.test(a)), JSON.stringify(st.amen));
  check('район «метро Немига» применён', st.area === 'метро Немига');
  check('чипы над выдачей: звёзды, питание, удобства, район, цена, тип', /★ от 4/.test(st.chips) && /с завтраком/.test(st.chips) && /бассейн/.test(st.chips) && /парковка/.test(st.chips) && /Немига/.test(st.chips) && /300/.test(st.chips) && /Отели/.test(st.chips), st.chips);
  check('ожидаемых объектов по всем фильтрам больше нуля (данные заглушки)', expB.length > 0, String(expB.length));
  check('счётчик «Найдено: N» — после фильтров: N = ' + expB.length, new RegExp('Найдено: ' + expB.length + ' ').test(st.meta + ' ') && !/50\d|7\d\d|360/.test(st.meta), st.meta);
  const expIds = new Set(expB.map(h => String('ost_' + h.hid)));
  check('на экране только объекты, подходящие под все фильтры', st.cards.length > 0 && st.cards.every(id => expIds.has(String(id))), st.cards.slice(0, 5).join(','));
  await shot('6_ii_mnogo_filtrov');
  // снятие чипа звёзд — фильтр снят, остальные остались
  await page.evaluate(() => aiChipRemove('stars')); await page.waitForTimeout(300);
  const expNoStars = SET_B.filter(h => h.category === 'hotel' && mealRank(h.meal) >= 1 && h.cancellation && h.price <= 300 && h.tags.includes('parking') && h.tags.includes('pool') && distKm(NEMIGA.lat, NEMIGA.lng, h.latitude, h.longitude) <= 3);
  check('сняли чип «★ от 4» — остальные фильтры на месте: Найдено ' + expNoStars.length, new RegExp('Найдено: ' + expNoStars.length + ' ').test(await page.locator('#serp-meta').innerText() + ' '), await page.locator('#serp-meta').innerText());

  // автоослабление: «5 звёзд всё включено до 100» — таких нет. Снимаются по одному (цена, затем питание),
  // тип «отель» и звёзды остаются. Раньше снималось всё сразу и показывался весь город.
  log.length = 0;
  S.search = () => ({ body: { ok: true, city: 'Минск', hotels: SET_B, total: 360 } });
  S.ai = () => ({ delay: 300, body: { parsed: { city: 'Минск', area: null, name: null, category: 'hotel', adults: 2, kids: null, childAges: [], priceMax: 100, din: '2026-11-10', dout: '2026-11-12', amenities: [], avoid: [] }, error: false } });
  await goHome();
  await page.evaluate(() => switchSearch('ai'));
  await page.locator('#ai-q').fill('отель в Минске 5 звезд всё включено до 100 на двоих с 10 по 12 ноября');
  await page.locator('#ai-q').press('Enter');
  await page.waitForTimeout(2200);
  const exp5 = SET_B.filter(h => h.category === 'hotel' && h.rating >= 5);
  const meta5 = await page.locator('#serp-meta').innerText();
  const cards5 = await page.evaluate(() => [...document.querySelectorAll('#serp-cards .sr-card')].map(c => c.dataset.hid));
  const ok5 = new Set(exp5.map(h => 'ost_' + h.hid));
  check('автоослабление: снято только «цена» и «всё включено», найдено ' + exp5.length, /без условий «цена», «всё включено»/.test(meta5) && new RegExp('найдено: ' + exp5.length + ' ').test(meta5), meta5);
  check('автоослабление: звёзды (5★) и тип «отель» НЕ сброшены', cards5.length > 0 && cards5.every(id => ok5.has(String(id))), cards5.slice(0, 5).join(','));
  await shot('7_ii_avtooslablenie');

  check('нет горизонтальной прокрутки', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('ошибок JS в консоли нет', errors.length === 0, errors.join(' | '));
  if (netWarn.length) console.log('  (браузер отметил ' + netWarn.length + ' неудачных запроса — это намеренно «упавшие» зеркала Overpass в заглушке)');
  await ctx.close();
}

// Браузер без Intl.DisplayNames — названия из встроенного списка
async function runNoIntl(browser, base) {
  console.log('\n=== Старый браузер без Intl.DisplayNames ===');
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route(url => !url.href.startsWith(base), r => r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' }));
  await ctx.addInitScript(() => { try { Intl.DisplayNames = undefined; } catch (e) {} });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/'); await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ intl: typeof Intl.DisplayNames, n: ZB_COUNTRIES.length, de: zbResName('de'), uz: zbResName('uz'), first: ZB_COUNTRIES[0][1] }));
  check('без Intl.DisplayNames: 249 стран, названия по-русски из встроенного списка', r.intl === 'undefined' && r.n === 249 && r.de === 'Германия' && r.uz === 'Узбекистан' && r.first === 'Беларусь', JSON.stringify(r));
  check('без Intl.DisplayNames: ошибок JS нет', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch();
  try {
    await run(browser, base, { name: 'Телефон 390×844 (тач)', tag: '390', mobile: true, opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Europe/Minsk', locale: 'ru-RU' } });
    await run(browser, base, { name: 'ПК 1366×768', tag: '1366', mobile: false, opts: { viewport: { width: 1366, height: 768 }, timezoneId: 'Europe/Minsk', locale: 'ru-RU' } });
    await runNoIntl(browser, base);
  } finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(results, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
