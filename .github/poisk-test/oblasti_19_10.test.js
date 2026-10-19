// 19.10: проверка «ИИ-поиск понимает области». Что проверяется:
//  1) 100+ фраз (все формы шести областей, окрестности, белорусский и латиница, города, город + область, длинные
//     фразы с датами/гостями/ценой) → что попадает в «Куда» (_capState.city, строка поиска) и что уходит в
//     /api/ostrovok/search; заглушка ИИ в трёх режимах: (а) ИИ ответил верно, (б) ИИ вернул неверный город/область,
//     (в) таймаут ИИ (ответ бэкенда { timeout:true } и, для двух фраз, настоящее молчание дольше 10 с);
//  2) строка «Понял:» показывает область; подсказка limited: true по области; «а подешевле» после поиска по области;
//  3) разбор дат, гостей, цены, фильтров у фраз без области — ровно как в прежней версии (сравнение с /old/);
//  4) ошибок в консоли нет, горизонтальной прокрутки нет.
// Таблица «до/после» (прежняя версия — коммит ZB_OLD_REF, по умолчанию bd4c049, последний main до правки) —
// в oblasti_19_10.md. Все ответы API — заглушки, сайт отдаётся локально.
// Запуск из корня репозитория:  node .github/poisk-test/oblasti_19_10.test.js
//   ZB_VP=390|360|1366 — только один экран (по умолчанию все три); ZB_COMPARE=0 — без таблицы «до/после»;
//   ZB_MODES=ok,wrong,timeout — какие режимы ИИ гонять по всем фразам (none — только отдельные проверки).
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const cp = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(cp.execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_oblasti_19_10');
fs.mkdirSync(SHOTS, { recursive: true });
const OLD_REF = process.env.ZB_OLD_REF || 'bd4c049';
let OLD = null;
try { OLD = cp.execSync('git show ' + OLD_REF + ':index.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(); } catch (e) { OLD = null; }

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
function makeHotels(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: 'ost_' + (1000 + i), hid: 1000 + i, name_ru: 'Объект ' + i, address: 'Минская область, д. Тестовая, ' + i,
    category: ['guest', 'hotel', 'apart'][i % 3], rating: i % 6, reviews_count: null, price: 80 + (i * 37) % 400, price_total: 2 * (80 + (i * 37) % 400), nights: 2,
    oldPrice: null, photos: [], amenities: [], source: 'ostrovok', tags: [], city_ru: 'Минск', meal: 'nomeal', cancellation: null, latitude: 53.9 + (i % 9) * 0.01, longitude: 27.55 + (i % 7) * 0.01 });
  return out;
}
const SET = makeHotels(60);

// ── даты фраз: «10–12 <месяц через два>» — всегда в будущем ──
const MON_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const NOW = new Date(); const M2 = new Date(NOW.getFullYear(), NOW.getMonth() + 2, 1);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D_IN = ymd(new Date(M2.getFullYear(), M2.getMonth(), 10)), D_OUT = ymd(new Date(M2.getFullYear(), M2.getMonth(), 12));
const SUF = ' на двоих с 10 по 12 ' + MON_G[M2.getMonth()];
// ближайшая пятница начиная с завтра (как «на выходные» на сайте)
const FRI = (() => { const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1); d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7); return d; })();
const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const R = { min: 'Минская область', bre: 'Брестская область', gro: 'Гродненская область', vit: 'Витебская область', gom: 'Гомельская область', mog: 'Могилёвская область' };
// [фраза без хвоста, ожидаемое «Куда», группа]
const FORMS = [
  // Минская
  ['усадьба в минской области', R.min, 'полное название'], ['минская обл.', R.min, 'обл.'], ['обл. минская', R.min, 'обратный порядок'], ['домик минобл', R.min, 'сокращение'],
  ['мин. обл', R.min, 'сокращение'], ['усадьба минщина', R.min, 'разговорное'], ['на минщине', R.min, 'разговорное'], ['усадьба под Минском', R.min, 'окрестности'],
  ['возле Минска', R.min, 'окрестности'], ['около Минска', R.min, 'окрестности'], ['рядом с Минском', R.min, 'окрестности'], ['пригород Минска', R.min, 'окрестности'],
  ['под Борисовом', R.min, 'окрестности города'], ['Мінская вобласць', R.min, 'белорусский'], ['Minsk region', R.min, 'латиница'],
  // Брестская
  ['в брестской области', R.bre, 'полное название'], ['брестская обл.', R.bre, 'обл.'], ['обл. брестская', R.bre, 'обратный порядок'], ['брест обл', R.bre, 'сокращение'],
  ['на брестчине', R.bre, 'разговорное'], ['под Брестом', R.bre, 'окрестности'], ['возле Бреста', R.bre, 'окрестности'], ['около Бреста', R.bre, 'окрестности'],
  ['рядом с Брестом', R.bre, 'окрестности'], ['пригород Бреста', R.bre, 'окрестности'], ['под Пинском', R.bre, 'окрестности города'], ['Брэсцкая вобласць', R.bre, 'белорусский'], ['Brest region', R.bre, 'латиница'],
  // Гродненская
  ['в гродненской области', R.gro, 'полное название'], ['гродненская обл.', R.gro, 'обл.'], ['обл. гродненская', R.gro, 'обратный порядок'], ['гродн. обл', R.gro, 'сокращение'],
  ['гродненщина', R.gro, 'разговорное'], ['под Гродно', R.gro, 'окрестности'], ['возле Гродно', R.gro, 'окрестности'], ['около Гродно', R.gro, 'окрестности'],
  ['рядом с Гродно', R.gro, 'окрестности'], ['пригород Гродно', R.gro, 'окрестности'], ['возле Лиды', R.gro, 'окрестности города'], ['Гродзенская вобласць', R.gro, 'белорусский'], ['Grodno region', R.gro, 'латиница'],
  // Витебская
  ['в витебской области', R.vit, 'полное название'], ['витебская обл.', R.vit, 'обл.'], ['обл. витебская', R.vit, 'обратный порядок'], ['вит. обл', R.vit, 'сокращение'],
  ['витебщина', R.vit, 'разговорное'], ['под Витебском', R.vit, 'окрестности'], ['возле Витебска', R.vit, 'окрестности'], ['около Витебска', R.vit, 'окрестности'],
  ['рядом с Витебском', R.vit, 'окрестности'], ['пригород Витебска', R.vit, 'окрестности'], ['под Полоцком', R.vit, 'окрестности города'], ['Віцебская вобласць', R.vit, 'белорусский'], ['Vitebsk region', R.vit, 'латиница'],
  // Гомельская
  ['в гомельской области', R.gom, 'полное название'], ['гомельская обл.', R.gom, 'обл.'], ['обл. гомельская', R.gom, 'обратный порядок'], ['гом. обл', R.gom, 'сокращение'],
  ['на гомельщине', R.gom, 'разговорное'], ['под Гомелем', R.gom, 'окрестности'], ['возле Гомеля', R.gom, 'окрестности'], ['около Гомеля', R.gom, 'окрестности'],
  ['рядом с Гомелем', R.gom, 'окрестности'], ['пригород Гомеля', R.gom, 'окрестности'], ['под Мозырем', R.gom, 'окрестности города'], ['Гомельская вобласць', R.gom, 'белорусский'], ['Gomel region', R.gom, 'латиница'],
  // Могилёвская
  ['в могилёвской области', R.mog, 'полное название'], ['могилевская обл.', R.mog, 'обл.'], ['обл. могилевская', R.mog, 'обратный порядок'], ['могил. обл', R.mog, 'сокращение'],
  ['на могилевщине', R.mog, 'разговорное'], ['под Могилёвом', R.mog, 'окрестности'], ['возле Могилева', R.mog, 'окрестности'], ['около Могилёва', R.mog, 'окрестности'],
  ['рядом с Могилевом', R.mog, 'окрестности'], ['пригород Могилева', R.mog, 'окрестности'], ['под Бобруйском', R.mog, 'окрестности города'], ['Магілёўская вобласць', R.mog, 'белорусский'], ['Mogilev region', R.mog, 'латиница'],
  // города — не области; город + область — город
  ['квартира в Минске', 'Минск', 'город'], ['отель в Бресте', 'Брест', 'город'], ['Гродно', 'Гродно', 'город'], ['в Витебске', 'Витебск', 'город'], ['в Гомеле', 'Гомель', 'город'],
  ['в Могилёве', 'Могилёв', 'город'], ['в Пинске', 'Пинск', 'город'], ['Пинск, Брестская область', 'Пинск', 'город + область'], ['Минск, Минская область', 'Минск', 'город + область'],
  ['Лида Гродненская обл.', 'Лида', 'город + область'], ['из Минска в Брестскую область', R.bre, 'откуда + область'],
];
const PHRASES = FORMS.map(([f, exp, g]) => ({ q: f + SUF, exp, g, ai: { din: D_IN, dout: D_OUT, adults: 2 } }));
// длинные фразы: даты/гости/цена/фильтры + область. want — что должно уйти в поиск помимо города.
PHRASES.push(
  { q: 'на выходные под брестом вдвоем с собакой', exp: R.bre, g: 'длинная', ai: { adults: 2, amenities: ['можно с животными'] }, want: { checkin: ymd(FRI), checkout: ymd(plus(FRI, 2)), adults: 2, children: [] } },
  { q: 'усадьба в гродненской обл на 3 ночи до 200 р', exp: R.gro, g: 'длинная (нет гостей)', ai: { category: 'guest', priceMax: 200 }, pending: true },
  { q: 'домик на минщине 10-15 ' + MON_G[M2.getMonth()] + ' 2+1 без депозита', exp: R.min, g: 'длинная', ai: { category: 'guest', adults: 2, kids: 1, din: D_IN, dout: ymd(new Date(M2.getFullYear(), M2.getMonth(), 15)) },
    want: { checkin: D_IN, checkout: ymd(new Date(M2.getFullYear(), M2.getMonth(), 15)), adults: 2, children: [7] } },
  { q: 'квартира в Минской обл. с женой и ребенком с 10 по 12 ' + MON_G[M2.getMonth()] + ' бесконтактно', exp: R.min, g: 'длинная', ai: { category: 'apart', adults: 2, kids: 1, din: D_IN, dout: D_OUT },
    want: { checkin: D_IN, checkout: D_OUT, adults: 2, children: [7] } },
  { q: 'под Гродно на выходные вдвоём до 200 р с собакой', exp: R.gro, g: 'длинная', ai: { adults: 2, priceMax: 200 }, want: { checkin: ymd(FRI), checkout: ymd(plus(FRI, 2)), adults: 2, children: [] } },
  { q: 'брест обл, 10-15 ' + MON_G[M2.getMonth()] + ', 2 взрослых, до 300 р', exp: R.bre, g: 'длинная', ai: { adults: 2, priceMax: 300, din: D_IN, dout: ymd(new Date(M2.getFullYear(), M2.getMonth(), 15)) },
    want: { checkin: D_IN, checkout: ymd(new Date(M2.getFullYear(), M2.getMonth(), 15)), adults: 2, children: [] } },
  { q: 'Пинск, Брестская область, с пт по вс, втроем', exp: 'Пинск', g: 'длинная, город + область', ai: { adults: 3 }, want: { adults: 3 } },
);
// неверный ответ ИИ для режима (б): другой город или другая область
function wrongCity(exp, i) {
  const pool = i % 2 ? ['Минская область', 'Брестская область'] : ['Гомель', 'Минск'];
  return pool[0] === exp ? pool[1] : pool[0];
}
// корпус фраз без области — разбор должен совпасть с прежней версией один в один
const CORPUS = [
  'квартира в Минске 10-15 ноября вдвоём', 'Брест на выходные 2+1', 'Гродно с пт по вс с женой и ребёнком', 'минск до 200 р с собакой', 'усадьба с баней без депозита на 3 ночи',
  'квартира бесконтактно в Витебске на двоих', 'отель в Гомеле 4 звезды с завтраком', 'с 10 по 15 декабря трое взрослых и ребенок 5 лет', 'на неделю в Могилёве вдвоем', 'Нарочь коттедж компанией',
  'в Пинске 2 чел до 150', 'хостел в Минске на одного завтра', 'квартира у метро Немига на двоих 10.11-12.11', 'Несвиж с детьми 3 и 7 лет', 'а подешевле', 'с собакой', 'без депозита',
  'на 2 ночи с 20 ноября вдвоем', 'Браслав на выходные семьей', 'квартира в Минске с парковкой без животных до 1 500', 'Мир на двоих с 1 по 3 января', 'с 30 декабря по 2 января компанией 6 человек',
  'Лида квартира для двоих с бесплатной отменой', 'Бобруйск отель всё включено 2 взрослых', 'Барановичи на сутки', 'около 200 р квартира в Минске вдвоём', 'улица Мира в Минске на двоих', 'Минск около вокзала на двоих',
];

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

async function setup(browser, base, vp) {
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block', timezoneId: 'Europe/Minsk', locale: 'ru-RU' }, vp.opts));
  const log = [];
  const S = { search: () => ({ body: { ok: true, city: 'X', hotels: SET, total: SET.length } }), ai: null, aiHits: 0, aiDone: 0 };
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
    if (p === '/api/ai/search') {
      S.aiHits++;
      const r = S.ai ? S.ai(body) : { body: { parsed: null, error: true } };
      if (r.delay) await new Promise(x => setTimeout(x, r.delay));
      await json(200, r.body); S.aiDone = Date.now(); return;
    }
    if (p === '/api/hotels') return json(200, { hotels: [] });
    if (p === '/api/catalog') return json(200, { ok: true, hotels: [] });
    return json(200, {});
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page, log, S, errors };
}

const aiParsed = (exp, o) => Object.assign({ city: exp, area: null, name: null, category: null, adults: null, kids: null, childAges: [], priceMax: null, din: null, dout: null, amenities: [], avoid: [] }, o || {});

// одна фраза: главная → ИИ-поиск → ждём ответ ИИ и поиск → что в «Куда» и что ушло в поиск
async function runPhrase(env, prefix, ph, mode, idx) {
  const { page, log, S, vp } = env;
  await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
  await page.goto(env.base + prefix + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof aiSearch === 'function' && document.getElementById('ai-q'));
  log.length = 0; S.aiHits = 0; S.aiDone = 0;
  if (mode === 'ok') S.ai = () => ({ delay: 150, body: { parsed: aiParsed(ph.exp, ph.ai), error: false } });
  else if (mode === 'wrong') S.ai = () => ({ delay: 150, body: { parsed: aiParsed(wrongCity(ph.exp, idx), ph.ai), error: false } });
  else if (mode === 'timeout') S.ai = () => ({ delay: 150, body: { parsed: null, error: true, timeout: true } });
  else if (mode === 'silent') S.ai = () => ({ delay: 12000, body: { parsed: null, error: true } });
  await page.evaluate(() => switchSearch('ai'));
  await page.locator('#ai-q').fill(ph.q);
  if (env.tapSubmit) await page.locator('button[aria-label="Найти по описанию"]').first().tap(); else await page.locator('#ai-q').press('Enter');
  const t0 = Date.now();
  if (mode === 'silent') await page.waitForFunction(() => !/Понимаю запрос/.test((document.getElementById('ai-understood') || {}).innerText || ''), null, { timeout: 15000 }).catch(() => {});
  // ждём: ИИ ответил (или 10,5 с при молчании) и 450 мс тишины в сети
  for (;;) {
    await page.waitForTimeout(100);
    const quiet = log.length ? Date.now() - log[log.length - 1].t > 450 : Date.now() - t0 > 600;
    if ((mode === 'silent' ? Date.now() - t0 > 10500 : S.aiDone && Date.now() - S.aiDone > 450) && quiet) break;
    if (Date.now() - t0 > 16000) break;
  }
  const st = await page.evaluate(() => ({
    city: (window._capState || {}).city || null, pend: window._aiPending ? window._aiPending.p.city : null,
    pill: (document.getElementById('serp-pill-text') || {}).innerText || '',
    und: (document.getElementById('ai-understood') || {}).innerText || '' }));
  const sent = log.filter(x => x.path === '/api/ostrovok/search').map(x => x.body);
  return Object.assign(st, { sent, kuda: st.pend && !sent.length ? st.pend : st.city });
}

async function run(browser, base, vp) {
  console.log('\n=== ' + vp.name + ' ===');
  const env = await setup(browser, base, vp); env.base = base; env.vp = vp;
  const { page, log, S, errors } = env;
  const rows = [];
  // ═══ 1. МАТРИЦА ФРАЗ × РЕЖИМЫ ИИ ═══
  for (const mode of ['ok', 'wrong', 'timeout'].filter(m => !process.env.ZB_MODES || process.env.ZB_MODES.split(',').includes(m))) {
    let bad = 0, n = 0;
    for (let i = 0; i < PHRASES.length; i++) {
      const ph = PHRASES[i];
      const r = await runPhrase(env, '', ph, mode, i);
      const sentC = r.sent.map(b => b.city);
      let ok = r.kuda === ph.exp;
      if (ph.pending) ok = ok && !r.sent.length && /сколько гостей/.test(r.und);
      else {
        ok = ok && sentC.length > 0 && sentC.every(c => c === ph.exp) && r.pill.indexOf(ph.exp + ' · ') === 0
          && /Понял:/.test(r.und) && r.und.indexOf('📍 ' + ph.exp) >= 0;
        const last = r.sent[r.sent.length - 1] || {};
        if (ph.want) for (const k in ph.want) if (JSON.stringify(last[k]) !== JSON.stringify(ph.want[k])) { ok = false; r.wantFail = k + '=' + JSON.stringify(last[k]); }
      }
      n++; if (!ok) { bad++; check(vp.tag + ' [' + mode + '] «' + ph.q + '» → ' + ph.exp, false, JSON.stringify({ kuda: r.kuda, sent: sentC, pill: r.pill, und: r.und.slice(0, 160), want: r.wantFail })); }
      rows.push({ mode, q: ph.q, exp: ph.exp, kuda: r.kuda, sent: sentC });
    }
    check(vp.tag + ': режим ИИ «' + { ok: '(а) ответил верно', wrong: '(б) неверный город/область', timeout: '(в) таймаут' }[mode] + '» — ' + (n - bad) + ' из ' + n + ' фраз: «Куда», поиск и «Понял:» верные', bad === 0);
  }
  // ═══ 2. НАСТОЯЩЕЕ МОЛЧАНИЕ ИИ (> 10 с) ═══
  for (const ph of [PHRASES.find(p => /под Пинском/.test(p.q)), PHRASES.find(p => /^Minsk region/.test(p.q))]) {
    const r = await runPhrase(env, '', ph, 'silent', 0);
    check(vp.tag + ': ИИ молчит дольше 10 с, «' + ph.q + '» → поиск по ' + ph.exp, r.kuda === ph.exp && r.sent.length && r.sent.every(b => b.city === ph.exp), JSON.stringify({ kuda: r.kuda, sent: r.sent.map(b => b.city) }));
  }
  // ═══ 3. «ПОНЯЛ:», ПОДСКАЗКИ, «А ПОДЕШЕВЛЕ», ДОБОР ГОСТЕЙ ═══
  if (vp.mobile) env.tapSubmit = true; // на телефоне — касанием кнопки поиска
  let r = await runPhrase(env, '', PHRASES.find(p => /^усадьба под Минском/.test(p.q)), 'ok', 0);
  env.tapSubmit = false;
  check(vp.tag + ': «Понял:» — «📍 Минская область»' + (vp.mobile ? ' (поиск касанием кнопки)' : ''), /^Понял:/.test(r.und) && r.und.indexOf('📍 Минская область') >= 0, r.und);
  await page.waitForTimeout(300);
  check(vp.tag + ': подсказка «Поиск по всей области» над выдачей', await page.locator('#serp-region-note').isVisible() && /Минская область/.test(await page.locator('#serp-region-note').innerText()));
  check(vp.tag + ': горизонтальной прокрутки нет (выдача по области)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_1_vydacha_oblast.png') });
  // «а подешевле» на открытой выдаче по области — быстрое уточнение на месте, без запроса к ИИ, область остаётся
  const aiBefore = S.aiHits; log.length = 0;
  await page.evaluate(() => { document.getElementById('ai-q').value = 'а подешевле'; aiSearch(); });
  await page.waitForTimeout(900);
  check(vp.tag + ': «а подешевле» на выдаче по области — без запроса к ИИ, «Куда» осталось «Минская область»', S.aiHits === aiBefore && await page.evaluate(() => window._capState.city) === 'Минская область'
    && /Уточнил/.test(await page.locator('#ai-understood').innerText()),
    JSON.stringify({ hits: S.aiHits - aiBefore, city: await page.evaluate(() => window._capState.city), und: await page.locator('#ai-understood').innerText(), sort: await page.evaluate(() => document.getElementById('serp-sort').value) }));
  // «а подешевле» с главной — к ИИ уходит прошлый разбор с областью (prev.city), поиск снова по области
  await page.evaluate(() => { serpClose(); }); await page.waitForTimeout(300); log.length = 0; S.aiDone = 0;
  S.ai = b => ({ delay: 150, body: { parsed: aiParsed(b && b.prev ? b.prev.city : null, { adults: 2, din: D_IN, dout: D_OUT, priceMax: 150 }), error: false } });
  await page.evaluate(() => switchSearch('ai'));
  await page.locator('#ai-q').fill('а подешевле'); await page.locator('#ai-q').press('Enter');
  await page.waitForTimeout(1500);
  const aiReq = log.filter(x => x.path === '/api/ai/search').slice(-1)[0], sch = log.filter(x => x.path === '/api/ostrovok/search').slice(-1)[0];
  check(vp.tag + ': «а подешевле» с главной — ИИ получил prev.city «Минская область», поиск снова по области, до 150', aiReq && aiReq.body.prev && aiReq.body.prev.city === 'Минская область'
    && sch && sch.body.city === 'Минская область' && await page.evaluate(() => window._aiPriceMax) === 150, JSON.stringify({ prev: aiReq && aiReq.body.prev, sent: sch && sch.body.city }));
  // limited: true по области → подсказка порции 33
  S.search = b => ({ body: { ok: true, city: b.city, hotels: SET, total: SET.length, limited: /област/.test(b.city) } });
  r = await runPhrase(env, '', PHRASES.find(p => /^на брестчине/.test(p.q)), 'ok', 0);
  await page.waitForTimeout(300);
  const ln = page.locator('#serp-limit-note');
  check(vp.tag + ': ИИ-поиск по области, limited: true → «Показаны первые 60 вариантов — уточните город или добавьте фильтры»', r.kuda === R.bre && await ln.isVisible() && /Показаны первые 60 вариантов/.test(await ln.innerText()), await ln.innerText().catch(() => ''));
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_2_limited_oblast.png') });
  S.search = () => ({ body: { ok: true, city: 'X', hotels: SET, total: SET.length } });
  // фраза без гостей: просим гостей, область запомнена; выбрали гостей → поиск по области
  r = await runPhrase(env, '', PHRASES.find(p => p.pending), 'timeout', 0);
  await page.screenshot({ path: path.join(SHOTS, vp.tag + '_3_ponyal_utochnite.png') });
  log.length = 0;
  await page.evaluate(() => { window._capState = window._capState || {}; window._capState.adults = 2; window._capState.kids = 0; window._capState.childAges = []; aiPendingResume(true); });
  await page.waitForTimeout(900);
  const sr = log.filter(x => x.path === '/api/ostrovok/search').slice(-1)[0];
  check(vp.tag + ': «усадьба в гродненской обл на 3 ночи до 200 р» → просим гостей; после выбора гостей поиск по «Гродненская область», 3 ночи, до 200',
    r.pend === R.gro && sr && sr.body.city === R.gro && (new Date(sr.body.checkout) - new Date(sr.body.checkin)) / 864e5 === 3 && await page.evaluate(() => window._aiPriceMax) === 200, JSON.stringify({ pend: r.pend, sent: sr && sr.body }));
  // выбор области из списка — как раньше (тот же city в поиск)
  await page.goto(base + '/'); await page.waitForTimeout(500); log.length = 0;
  await page.evaluate(() => { window._capState = { city: 'Витебская область', din: new Date(2026, 11, 10), dout: new Date(2026, 11, 12), adults: 2, kids: 0, childAges: [], gDone: true }; serpOpen(); });
  await page.waitForTimeout(900);
  const s2 = log.filter(x => x.path === '/api/ostrovok/search').slice(-1)[0];
  check(vp.tag + ': выбор области из списка — в поиск уходит «Витебская область», как раньше', s2 && s2.body.city === 'Витебская область');
  check(vp.tag + ': ошибок в консоли нет', errors.length === 0, errors.slice(0, 5).join(' | '));
  await env.ctx.close();
  return rows;
}

// ═══ 4. РАЗБОР ДАТ/ГОСТЕЙ/ЦЕНЫ/ФИЛЬТРОВ — КАК В ПРЕЖНЕЙ ВЕРСИИ ═══
async function runParseCompare(browser, base) {
  console.log('\n=== Разбор фраз: новая версия против прежней (' + OLD_REF + ') ===');
  const got = {};
  for (const pre of ['', '/old']) {
    const env = await setup(browser, base, { opts: { viewport: { width: 1366, height: 768 } } });
    await env.page.goto(base + pre + '/'); await env.page.waitForFunction(() => typeof aiParse === 'function');
    got[pre] = await env.page.evaluate(list => list.map(q => {
      const p = aiParse(q); const n = aiNormNeeds(JSON.parse(JSON.stringify(p)), q);
      const d = aiDates(' ' + q.toLowerCase().replace(/ё/g, 'е') + ' ', p.nights);
      return { p, n: { amenities: n.amenities, avoid: n.avoid, stars: n.stars || 0, meal: n.meal || null }, d: d ? [d.din.getTime(), d.dout.getTime()] : null, x: aiParseExtras(q) };
    }), CORPUS.concat(PHRASES.map(p => p.q)));
    if (env.errors.length) check('разбор (' + (pre || 'новая') + '): ошибок нет', false, env.errors.join(' | '));
    await env.ctx.close();
  }
  if (!OLD) { check('прежняя версия ' + OLD_REF + ' найдена в git', false); return; }
  const all = CORPUS.concat(PHRASES.map(p => p.q));
  let same = 0, sameNoCity = 0, diffs = [];
  const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
  all.forEach((q, i) => {
    const a = got[''][i], b = got['/old'][i];
    if (i < CORPUS.length) { if (canon(a) === canon(b)) same++; else diffs.push(q + ': ' + JSON.stringify(a.p) + ' / было ' + JSON.stringify(b.p)); }
    else { const strip = o => canon(Object.assign({}, o, { p: Object.assign({}, o.p, { city: null }) })); if (strip(a) === strip(b)) sameNoCity++; else diffs.push(q + ' (кроме города): ' + strip(a) + ' / было ' + strip(b)); }
  });
  check('фразы без области (' + CORPUS.length + '): город, даты, ночи, гости, дети, цена, тип, удобства, «без …», звёзды, питание — как в прежней версии', same === CORPUS.length, diffs.slice(0, 3).join(' | '));
  check('фразы с областью (' + PHRASES.length + '): всё, кроме города, — как в прежней версии', sameNoCity === PHRASES.length, diffs.slice(0, 3).join(' | '));
}

// таблица «до/после»: прежняя версия, те же фразы и заглушки (только 1366)
async function runBefore(browser, base) {
  console.log('\n=== Прежняя версия (' + OLD_REF + '), для таблицы «до/после» ===');
  const env = await setup(browser, base, { tag: 'old', opts: { viewport: { width: 1366, height: 768 } } }); env.base = base; env.vp = {};
  const rows = [];
  for (const mode of ['ok', 'wrong', 'timeout']) for (let i = 0; i < PHRASES.length; i++) {
    const r = await runPhrase(env, '/old', PHRASES[i], mode, i);
    rows.push({ mode, q: PHRASES[i].q, kuda: r.kuda, sent: r.sent.map(b => b.city) });
  }
  await env.ctx.close();
  return rows;
}

function table(after, before) {
  const cell = r => !r ? '—' : (r.kuda || 'нет') + (r.sent.length ? '' : ' (поиск не ушёл)') + (r.sent.length && r.sent.some(c => c !== r.kuda) ? ' (в поиск: ' + [...new Set(r.sent)].join(', ') + ')' : '');
  const key = (r) => r.mode + '|' + r.q;
  const B = {}; (before || []).forEach(r => { B[key(r)] = r; });
  const A = {}; after.forEach(r => { A[key(r)] = r; });
  let md = '# ИИ-поиск и области (19.10): «Куда» до и после\n\nПрежняя версия — коммит ' + OLD_REF + '. Хвост фраз «' + SUF.trim() + '» в таблице опущен.\n'
    + 'Режимы заглушки ИИ: (а) ИИ ответил верно, (б) ИИ вернул неверный город/область, (в) таймаут ИИ.\n\n'
    + '| Фраза | Группа | Ожидается | (а) до | (а) после | (б) ИИ ответил | (б) до | (б) после | (в) до | (в) после |\n|---|---|---|---|---|---|---|---|---|---|\n';
  PHRASES.forEach((ph, i) => {
    const q = ph.q.endsWith(SUF) ? ph.q.slice(0, -SUF.length) : ph.q;
    md += '| ' + q + ' | ' + ph.g + ' | ' + ph.exp + (ph.pending ? ' (сначала спросим гостей)' : '') + ' | ' + cell(B['ok|' + ph.q]) + ' | ' + cell(A['ok|' + ph.q])
      + ' | ' + wrongCity(ph.exp, i) + ' | ' + cell(B['wrong|' + ph.q]) + ' | ' + cell(A['wrong|' + ph.q]) + ' | ' + cell(B['timeout|' + ph.q]) + ' | ' + cell(A['timeout|' + ph.q]) + ' |\n';
  });
  const cnt = (rows, m) => rows.filter(r => r.mode === m && r.kuda === PHRASES.find(p => p.q === r.q).exp).length;
  md += '\nВерно «Куда» (из ' + PHRASES.length + '): ' + ['ok', 'wrong', 'timeout'].map(m => '(' + { ok: 'а', wrong: 'б', timeout: 'в' }[m] + ') до ' + (before ? cnt(before, m) : '—') + ' → после ' + cnt(after, m)).join('; ') + '.\n';
  return md;
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
  let after1366 = null, before = null;
  try {
    await runParseCompare(browser, base);
    for (const vp of VPS) { const rows = await run(browser, base, vp); if (vp.tag === '1366' || !after1366) after1366 = rows; }
    if (process.env.ZB_COMPARE !== '0' && OLD) before = await runBefore(browser, base);
  } finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено (фраз: ' + PHRASES.length + ', по 3 режима ИИ на экран)');
  const tag = process.env.ZB_VP ? '_' + process.env.ZB_VP : '';
  fs.writeFileSync(path.join(__dirname, 'result_oblasti_19_10' + tag + '.json'), JSON.stringify(results, null, 1));
  if (before) fs.writeFileSync(path.join(__dirname, 'oblasti_19_10.md'), table(after1366, before));
  process.exit(bad.length ? 1 : 0);
})();
