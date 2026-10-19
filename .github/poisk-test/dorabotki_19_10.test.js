// 19.10: проверка доделок после порции 37 (области в ИИ-поиске). Что проверяется:
//  1) «а подешевле» / «а подороже» ставят в «Сортировка» значения price_asc / price_desc (раньше 'price-asc' — список
//     сбрасывался), выдача пересортирована по цене и совпадает с ручным выбором; без запроса к ИИ;
//  2) ИИ ответил { parsed: null, region: {...} } — область из region попадает в «Куда» и уходит в поиск, если своим
//     разбором города не нашли; найденный на сайте город остаётся главным;
//  3) ответ поиска с area: true — над выдачей подпись «Варианты по всей Минской области»;
//  4) area: true + reason: region_not_found_by — «Не нашли варианты по области — попробуйте город или другие даты»
//     (не «поиск по областям скоро»); для обычного города текст прежний; limited: true — подсказка порции 33 как раньше;
//  5) ошибок в консоли нет, горизонтальной прокрутки нет.
// Все ответы API — заглушки, сайт отдаётся локально. Запуск из корня репозитория:
//   node .github/poisk-test/dorabotki_19_10.test.js        (ZB_VP=390|360|1366 — только один экран)
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const cp = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(cp.execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_dorabotki_19_10');
fs.mkdirSync(SHOTS, { recursive: true });

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
function makeHotels(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: 'ost_' + (1000 + i), hid: 1000 + i, name_ru: 'Объект ' + i, address: 'Минская область, д. Тестовая, ' + i,
    category: ['guest', 'hotel', 'apart'][i % 3], rating: i % 6, reviews_count: null, price: 80 + (i * 37) % 400, price_total: 2 * (80 + (i * 37) % 400), nights: 2,
    oldPrice: null, photos: [], amenities: [], source: 'ostrovok', tags: [], city_ru: 'Минск', meal: 'nomeal', cancellation: null, latitude: 53.9 + (i % 9) * 0.01, longitude: 27.55 + (i % 7) * 0.01 });
  return out;
}
const SET = makeHotels(40);

const MON_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const NOW = new Date(); const M2 = new Date(NOW.getFullYear(), NOW.getMonth() + 2, 1);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D_IN = ymd(new Date(M2.getFullYear(), M2.getMonth(), 10)), D_OUT = ymd(new Date(M2.getFullYear(), M2.getMonth(), 12));
const SUF = ' на двоих с 10 по 12 ' + MON_G[M2.getMonth()];

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

async function setup(browser, base, vp) {
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block', timezoneId: 'Europe/Minsk', locale: 'ru-RU' }, vp.opts));
  const log = [];
  const S = { search: b => ({ body: { ok: true, city: b.city, hotels: SET, total: SET.length } }), ai: null, aiHits: 0 };
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith('https://api.zaedem.by'), route => {
    const u = route.request().url();
    if (/\.css(\?|$)|fonts\.googleapis/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'text/css', body: '' });
    if (/\.js(\?|$)/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/javascript', body: '' });
    if (/open-meteo|overpass/.test(u)) return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG });
  });
  await ctx.route('https://api.zaedem.by/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    log.push({ path: p, body, t: Date.now() });
    const json = (status, obj) => route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(obj) }).catch(() => {});
    if (p === '/api/ostrovok/search') { const r = S.search(body); return json(r.status || 200, r.body); }
    if (p === '/api/ai/search') { S.aiHits++; const r = S.ai ? S.ai(body) : { body: { parsed: null, error: true } }; if (r.delay) await new Promise(x => setTimeout(x, r.delay)); return json(200, r.body); }
    if (p === '/api/hotels') return json(200, { hotels: [] });
    if (p === '/api/catalog') return json(200, { ok: true, hotels: [] });
    return json(200, {});
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page, log, S, errors, base, vp };
}

const aiParsed = (city, o) => Object.assign({ city, area: null, name: null, category: null, adults: null, kids: null, childAges: [], priceMax: null, din: null, dout: null, amenities: [], avoid: [] }, o || {});

// главная → ИИ-поиск фразы → ждём ответ ИИ и тишину в сети
async function aiRun(env, q) {
  const { page, log, S, vp } = env;
  await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
  await page.goto(env.base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof aiSearch === 'function' && document.getElementById('ai-q'));
  log.length = 0; S.aiHits = 0;
  await page.evaluate(() => switchSearch('ai'));
  await page.locator('#ai-q').fill(q);
  if (vp.mobile) await page.locator('button[aria-label="Найти по описанию"]').first().tap(); else await page.locator('#ai-q').press('Enter');
  const t0 = Date.now();
  for (;;) {
    await page.waitForTimeout(120);
    const quiet = log.length ? Date.now() - log[log.length - 1].t > 500 : false;
    if (quiet) break;
    if (Date.now() - t0 > 8000) break;
  }
  await page.waitForTimeout(250);
  return page.evaluate(() => ({
    city: (window._capState || {}).city || null, pend: window._aiPending ? window._aiPending.p.city : null,
    und: (document.getElementById('ai-understood') || {}).innerText || '' }));
}
const sentSearch = log => log.filter(x => x.path === '/api/ostrovok/search').map(x => x.body);
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const text = async (page, sel) => (await page.locator(sel).count()) ? (await page.locator(sel).first().innerText()) : '';

async function run(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  const env = await setup(browser, base, vp);
  const { page, log, S, errors } = env;
  const T = vp.tag + ': ';

  // ═══ 1. «А ПОДЕШЕВЛЕ» ═══
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Минск', { adults: 2, din: D_IN, dout: D_OUT }), error: false } });
  let r = await aiRun(env, 'квартира в Минске' + SUF);
  const idsBefore = await page.evaluate(() => window._serpFullList.map(h => h.id));
  const sort0 = await page.evaluate(() => document.getElementById('serp-sort').value);
  const aiBefore = S.aiHits; log.length = 0;
  await page.evaluate(() => { document.getElementById('ai-q').value = 'а подешевле'; aiSearch(); });
  await page.waitForTimeout(900);
  const st1 = await page.evaluate(() => {
    const L = window._serpFullList, m = srPriceMode(), f = m === 'night' ? srNightPrice : srTotalPrice;
    let asc = true; for (let i = 1; i < L.length; i++) if (f(L[i - 1]) > f(L[i])) asc = false;
    const sel = document.getElementById('serp-sort');
    return { val: sel.value, label: sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : null, asc, n: L.length, ids: L.map(h => h.id), und: document.getElementById('ai-understood').innerText };
  });
  check(T + '«а подешевле»: в «Сортировка» — «Сначала дешёвые» (price_asc), не сброс', st1.val === 'price_asc' && st1.label === 'Сначала дешёвые', JSON.stringify({ sort0, val: st1.val, label: st1.label }));
  check(T + '«а подешевле»: выдача (' + st1.n + ') отсортирована по цене по возрастанию и отличается от прежнего порядка', st1.asc && st1.n > 5 && JSON.stringify(st1.ids) !== JSON.stringify(idsBefore));
  check(T + '«а подешевле»: без запроса к ИИ, подпись «Уточнил»', S.aiHits === aiBefore && /Уточнил/.test(st1.und), JSON.stringify({ hits: S.aiHits - aiBefore, und: st1.und }));
  // то же вручную: сброс на «Рекомендуемые», затем выбор в списке — порядок карточек тот же
  await page.selectOption('#serp-sort', 'recommended'); await page.waitForTimeout(400);
  await page.selectOption('#serp-sort', 'price_asc'); await page.waitForTimeout(500);
  const idsManual = await page.evaluate(() => window._serpFullList.map(h => h.id));
  check(T + 'выбор «Сначала дешёвые» вручную даёт ту же выдачу, что «а подешевле»', JSON.stringify(idsManual) === JSON.stringify(st1.ids));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_1_podeshevle.png') });
  // «а подороже»
  await page.evaluate(() => { document.getElementById('ai-q').value = 'а подороже'; aiSearch(); });
  await page.waitForTimeout(900);
  const st2 = await page.evaluate(() => {
    const L = window._serpFullList, m = srPriceMode(), f = m === 'night' ? srNightPrice : srTotalPrice;
    let desc = true; for (let i = 1; i < L.length; i++) if (f(L[i - 1]) < f(L[i])) desc = false;
    return { val: document.getElementById('serp-sort').value, desc };
  });
  check(T + '«а подороже»: «Сначала дорогие» (price_desc), цены по убыванию', st2.val === 'price_desc' && st2.desc, JSON.stringify(st2));
  // если цена уже задана («до 150») — «подешевле» урезает её, сортировку не трогает (как раньше)
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Минск', { adults: 2, din: D_IN, dout: D_OUT, priceMax: 300 }), error: false } });
  await aiRun(env, 'квартира в Минске до 300 р' + SUF);
  await page.evaluate(() => { document.getElementById('ai-q').value = 'а подешевле'; aiSearch(); });
  await page.waitForTimeout(700);
  const st3 = await page.evaluate(() => ({ pm: window._aiPriceMax, sort: document.getElementById('serp-sort').value }));
  check(T + 'при заданной цене «а подешевле» снижает потолок (300 → 240), сортировка не меняется', st3.pm === 240 && st3.sort === 'recommended', JSON.stringify(st3));

  // ═══ 2. parsed: null + region ═══
  const LOG = 'домик в Логойском районе' + SUF;
  S.ai = () => ({ delay: 120, body: { parsed: null, error: true, timeout: true } });
  r = await aiRun(env, LOG);
  const sentNo = sentSearch(log);
  check(T + 'контроль: «' + LOG.slice(0, 24) + '…», ИИ без region — города нет, просим город, поиск не ушёл', !r.city && !r.pend && sentNo.length === 0 && /город/.test(r.und), JSON.stringify({ city: r.city, und: r.und, sent: sentNo.length }));
  S.ai = () => ({ delay: 120, body: { parsed: null, error: true, timeout: true, region: { city: 'Минская область', area: true, src: 'rule' } } });
  r = await aiRun(env, LOG);
  let sent = sentSearch(log);
  check(T + 'parsed: null + region «Минская область» → в «Куда» область, поиск ушёл по области', r.city === 'Минская область' && sent.length > 0 && sent.every(b => b.city === 'Минская область') && /📍 Минская область/.test(r.und), JSON.stringify({ city: r.city, sent: sent.map(b => b.city), und: r.und }));
  check(T + 'в строке «Куда» выдачи тоже область', (await text(page, '#serp-pill-text')).indexOf('Минская область') === 0, await text(page, '#serp-pill-text'));
  S.ai = () => ({ delay: 120, body: { parsed: null, error: true, limited: true, region: { city: 'Брестская область', area: true, src: 'rule' } } });
  r = await aiRun(env, LOG);
  sent = sentSearch(log);
  check(T + 'лимит ИИ (parsed: null, limited: true) + region «Брестская область» → поиск по Брестской области', r.city === 'Брестская область' && sent.length > 0 && sent.every(b => b.city === 'Брестская область'), JSON.stringify({ city: r.city, sent: sent.map(b => b.city) }));
  S.ai = () => ({ delay: 120, body: { parsed: null, error: true, region: { city: 'Пинск', area: false, src: 'rule' } } });
  r = await aiRun(env, LOG);
  sent = sentSearch(log);
  check(T + 'region с городом («Пинск») → поиск по городу', r.city === 'Пинск' && sent.length > 0 && sent.every(b => b.city === 'Пинск'), JSON.stringify({ city: r.city, sent: sent.map(b => b.city) }));
  // локальный разбор главный: сайт сам нашёл Брест, region другой — остаётся Брест
  S.ai = () => ({ delay: 120, body: { parsed: null, error: true, timeout: true, region: { city: 'Минская область', area: true, src: 'rule' } } });
  r = await aiRun(env, 'квартира в Бресте' + SUF);
  sent = sentSearch(log);
  check(T + 'сайт сам нашёл город (Брест) — region «Минская область» его не подменяет', r.city === 'Брест' && sent.length > 0 && sent.every(b => b.city === 'Брест'), JSON.stringify({ city: r.city, sent: sent.map(b => b.city) }));
  check(T + 'ИИ ответил нормально (parsed есть) — поле region не используется', await (async () => {
    S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Гродно', { adults: 2, din: D_IN, dout: D_OUT }), error: false, region: { city: 'Минская область', area: true } } });
    const rr = await aiRun(env, 'тихий домик у воды' + SUF); const ss = sentSearch(log);
    return rr.city === 'Гродно' && ss.length > 0 && ss.every(b => b.city === 'Гродно');
  })());

  // ═══ 3. area: true — подпись над выдачей ═══
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Минская область', { adults: 2, din: D_IN, dout: D_OUT }), error: false } });
  S.search = b => ({ body: { ok: true, city: b.city, area: /област/.test(b.city), hotels: SET, total: SET.length } });
  await aiRun(env, 'усадьба под Минском' + SUF);
  await page.waitForTimeout(300);
  const note = page.locator('#serp-region-note');
  check(T + 'area: true → над выдачей «Варианты по всей Минской области»', await note.isVisible() && /Варианты по всей Минской области/.test(await note.innerText()), await note.innerText().catch(() => ''));
  check(T + 'горизонтальной прокрутки нет (выдача по области)', await noHScroll(page));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_2_podpis_oblast.png') });
  // другая область — своё название в нужном падеже
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Могилёвская область', { adults: 2, din: D_IN, dout: D_OUT }), error: false } });
  await aiRun(env, 'усадьба под Могилёвом' + SUF); await page.waitForTimeout(300);
  check(T + 'Могилёвская область → «Варианты по всей Могилёвской области»', /Варианты по всей Могилёвской области/.test(await text(page, '#serp-region-note')), await text(page, '#serp-region-note'));
  // area: true + limited: true — подпись и подсказка порции 33 вместе
  S.search = b => ({ body: { ok: true, city: b.city, area: true, limited: true, hotels: SET, total: SET.length } });
  await aiRun(env, 'усадьба под Могилёвом' + SUF); await page.waitForTimeout(300);
  check(T + 'area: true + limited: true → подпись и «Показаны первые 40 вариантов — уточните город или добавьте фильтры»',
    /Варианты по всей Могилёвской области/.test(await text(page, '#serp-region-note')) && /Показаны первые 40 вариантов — уточните город или добавьте фильтры/.test(await text(page, '#serp-limit-note')), await text(page, '#serp-limit-note'));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_3_limited_oblast.png') });
  // обычный город — подписи нет
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Минск', { adults: 2, din: D_IN, dout: D_OUT }), error: false } });
  S.search = b => ({ body: { ok: true, city: b.city, hotels: SET, total: SET.length } });
  await aiRun(env, 'квартира в Минске' + SUF); await page.waitForTimeout(300);
  check(T + 'обычный город — подписи по области нет', !(await note.isVisible()));

  // ═══ 4. area: true + ничего не нашли ═══
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Витебская область', { adults: 2, din: D_IN, dout: D_OUT }), error: false } });
  S.search = b => ({ body: { ok: true, city: b.city, area: true, hotels: [], total: 0, reason: 'region_not_found_by' } });
  await aiRun(env, 'усадьба под Витебском' + SUF); await page.waitForTimeout(400);
  const cards = await text(page, '#serp-cards');
  check(T + 'area: true + region_not_found_by → «Не нашли варианты по области — попробуйте город или другие даты»', /Не нашли варианты по области — попробуйте город или другие даты/.test(cards), cards.slice(0, 150));
  check(T + 'старого «Поиск по областям скоро появится» нет, подписи «Варианты по всей…» над пустой выдачей нет', !/скоро появится/.test(cards) && !(await note.isVisible()));
  check(T + 'в заглушке есть кнопка «Выбрать город или даты», горизонтальной прокрутки нет', await page.locator('#serp-area-empty button').isVisible() && await noHScroll(page));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_4_ne_nashli_po_oblasti.png') });
  // кнопка открывает изменение поиска
  await page.locator('#serp-area-empty button').click(); await page.waitForTimeout(500);
  check(T + 'кнопка заглушки открывает выбор города/дат', await page.evaluate(() => !!document.getElementById('serp-sd-modal') || (document.getElementById('cap-sheet') || {}).style.display === 'flex')); // на телефоне — шторка, на ПК — окно
  await page.evaluate(() => { try { serpSearchClose(); } catch (e) {} try { var sh = document.getElementById('cap-sheet'); if (sh) sh.style.display = 'none'; } catch (e) {} });
  // обычный город, ничего не нашли — текст прежний
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Пинск', { adults: 2, din: D_IN, dout: D_OUT }), error: false } });
  S.search = b => ({ body: { ok: true, city: b.city, hotels: [], total: 0, reason: 'region_not_found_by' } });
  await aiRun(env, 'квартира в Пинске' + SUF); await page.waitForTimeout(400);
  const cards2 = await text(page, '#serp-cards');
  check(T + 'город без вариантов (area нет) — прежнее «По вашему запросу ничего не найдено»', /По вашему запросу ничего не найдено/.test(cards2) && !/Не нашли варианты по области/.test(cards2), cards2.slice(0, 120));
  // область, старый ответ бэкенда без area (ошибка) — прежнее поведение «скоро появится»
  S.ai = () => ({ delay: 120, body: { parsed: aiParsed('Брестская область', { adults: 2, din: D_IN, dout: D_OUT }), error: false } });
  S.search = b => ({ body: { ok: true, city: b.city, hotels: [], total: 0, reason: 'region_not_found' } });
  await aiRun(env, 'усадьба под Брестом' + SUF); await page.waitForTimeout(400);
  check(T + 'область, ответ без area: true (старый бэкенд) — прежний текст «Поиск по областям скоро появится»', /Поиск по областям скоро появится/.test(await text(page, '#serp-cards')));

  check(T + 'ошибок в консоли нет', errors.length === 0, errors.slice(0, 5).join(' | '));
  await env.ctx.close();
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch();
  const VPS = [
    { name: 'Телефон 390×844 (тач)', tag: '390', mobile: true, opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'Телефон 360×740 (тач)', tag: '360', mobile: true, opts: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'ПК 1366×768', tag: '1366', mobile: false, opts: { viewport: { width: 1366, height: 768 } } },
  ].filter(v => !process.env.ZB_VP || process.env.ZB_VP === v.tag);
  try { for (const vp of VPS) await run(browser, base, vp); } finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  const tag = process.env.ZB_VP ? '_' + process.env.ZB_VP : '';
  fs.writeFileSync(path.join(__dirname, 'result_dorabotki_19_10' + tag + '.json'), JSON.stringify(results, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
