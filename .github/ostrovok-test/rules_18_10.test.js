// 18.10: «Условия проживания» — все разделы правил (hotel.policy.rules при OST_POLICY_FULL=1). Все ответы API — заглушки.
// Блок условий сравнивается с main (index.html из git): без rules разметка и снимок должны совпасть.
// Запуск из корня репозитория:  node .github/ostrovok-test/rules_18_10.test.js
// Папка .github не попадает на GitHub Pages (Jekyll пропускает папки с точкой).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_rules_18_10');
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
const RATE = { book_hash: 'h-1', room_name: 'Стандарт', meal: 'breakfast', price_byn: 210, images: [], room_amenities: [], taxes_on_site: [{ label: 'Городской сбор', amount: '1.5', currency: 'BYN' }], capacity: 3,
  cancellation: { free_cancellation_before: null, policies: [] } };
// прежний формат (без OST_POLICY_FULL): deposit + paid, rules нет
const POLICY_OLD = {
  contactless: true,
  deposit: [{ label: 'Залог за сохранность имущества', text: '50 BYN за номер за всё проживание, наличными' }],
  paid: [{ label: 'Парковка', text: '5 BYN за машину в сутки' }, { label: 'Интернет в номере', text: '3 BYN в сутки' }],
  extra_info: 'Заселение по паспорту.',
};
// все 14 разделов (по одному примеру из документации бэкенда + <b> для проверки экранирования)
const RULES_ALL = [
  { section: 'check_in_check_out', label: 'Ранний заезд', text: '50 BYN, до полудня' },
  { section: 'children', label: 'Дети (от 0 до 6 лет)', text: 'бесплатно, дополнительная кровать есть' },
  { section: 'children_meal', label: 'Завтрак для детей (от 0 до 6 лет)', text: 'входит в стоимость' },
  { section: 'extra_bed', label: 'Дополнительная кровать', text: '25 BYN в сутки' },
  { section: 'cot', label: 'Детская кроватка', text: 'бесплатно' },
  { section: 'meal', label: 'Завтрак', text: '15 BYN с гостя в сутки' },
  { section: 'internet', label: 'Интернет в номере', text: 'входит в стоимость' },
  { section: 'parking', label: 'Парковка на территории', text: '5 BYN в сутки' },
  { section: 'pets', label: 'Проживание с животными', text: '<b>20 BYN</b> за животное в сутки' },
  { section: 'shuttle', label: 'Трансфер из аэропорта', text: '60 BYN в одну сторону' },
  { section: 'add_fee', label: 'Дополнительный сбор', text: 'оплачивается отдельно' },
  { section: 'deposit', label: 'Залог за сохранность имущества', text: '50 BYN за номер за всё проживание, наличными' },
  { section: 'no_show', label: 'Неявка (no-show)', text: 'отмечается в 12:00 после полудня' },
  { section: 'visa', label: 'Визовая поддержка', text: 'предоставляется' },
];
const POLICY_RULES = Object.assign({}, POLICY_OLD, { rules: RULES_ALL });
// длинный список: 40 строк в «Услугах»
const RULES_LONG = [{ section: 'children', label: 'Дети (от 0 до 6 лет)', text: 'бесплатно' }]
  .concat(Array.from({ length: 39 }, (_, i) => ({ section: 'add_fee', label: 'Дополнительный сбор № ' + (i + 1) + ' за очень длинное название услуги для проверки переноса строк', text: (i + 1) + ' BYN с гостя в сутки, оплачивается на месте наличными' })));
const HP = (policy) => ({ ok: true, hid: 8473727, ostrovok_id: 'test_hotel_do_not_book', booking_enabled: true, test_only: true,
  hotel: { description: 'Тестовый отель Островка', amenities: [], photos: [], check_in: '14:00', check_out: '12:00', policy },
  rates: [RATE] });

function makeStub(log) {
  const S = { policy: POLICY_OLD };
  async function handler(route) {
    const req = route.request(); const p = new URL(req.url()).pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    log.push({ path: p, method: req.method(), body });
    const json = (status, obj) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    if (p === '/api/ostrovok/hp') return json(200, HP(S.policy));
    if (p === '/api/ostrovok/prebook') return json(200, { ok: true, changes: null, rate: Object.assign({}, RATE, { book_hash: 'p-h-1' }) });
    if (p === '/api/ostrovok/reviews') return json(200, { reviews: [] });
    if (p === '/api/ostrovok/search') return json(200, { ok: true, city: 'Минск', hotels: [], total: 0 });
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
  const open = async (prefix, policy) => {
    const o = await newPage(browser, base, vp);
    o.S.policy = policy;
    await o.page.goto(base + prefix + '/' + LINK_TEST);
    await o.page.waitForSelector('.ost-rate-row', { timeout: 10000 });
    await o.page.waitForTimeout(400);
    return o;
  };
  const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shotTo = (page, n) => page.screenshot({ path: path.join(SHOTS, vp.tag + '_' + n + '.png') });

  // ── 1. со всеми 14 разделами ──
  {
    const { ctx, page, errors } = await open('', POLICY_RULES);
    check('ссылка на тестовый отель открывает объект', await page.evaluate(() => document.body.classList.contains('on-hotel') && curHotel && curHotel.id === 'ost_8473727'));
    const pol = page.locator('#hp-policy');
    check('13 строк > 8: список свёрнут, кнопка «Показать все условия»', await pol.locator('.hp-pol-all').count() === 1);
    check('в свёрнутом виде видно 8 строк правил', await pol.locator('.hp-pol-rule:visible').count() === 8);
    await pol.scrollIntoViewIfNeeded();
    await shotTo(page, '1_svernuto');
    await press(pol.locator('.hp-pol-all'));
    check('«Показать все условия» → видны все 13 строк, кнопка «Свернуть»', await pol.locator('.hp-pol-rule:visible').count() === 13 && /Свернуть/.test(await pol.locator('.hp-pol-all').innerText()));
    const txt = (await pol.innerText()).replace(/[ \t]+/g, ' ');
    const heads = await pol.locator('.hp-pol-grp').allInnerTexts();
    check('заголовки групп по порядку: Заезд и выезд, Дети, Питание, Услуги, Визы', JSON.stringify(heads.map(h => h.toLowerCase())) === JSON.stringify(['заезд и выезд', 'дети', 'питание', 'услуги', 'визы']), JSON.stringify(heads));
    const shown = RULES_ALL.filter(r => r.section !== 'deposit');
    const miss = shown.filter(r => txt.indexOf(r.label + ' — ' + r.text) < 0);
    check('13 строк «label — text» видны (кроме депозита)', miss.length === 0, miss.map(r => r.label).join(' | '));
    check('текст с <b> экранирован (виден как текст, тега нет)', txt.indexOf('<b>20 BYN</b> за животное') >= 0 && await pol.locator('b').count() === 0);
    const depCount = txt.split('Залог за сохранность имущества').length - 1;
    check('депозит не дублируется (одна строка из policy.deposit)', depCount === 1, String(depCount));
    check('«Оплачивается отдельно» заменено разделами', txt.indexOf('Оплачивается отдельно') < 0);
    check('групповые строки: Заезд и выезд = заезд + no-show; Дети = дети, питание детей, кроватка, доп. кровать',
      await page.evaluate(() => {
        const g = {}; let cur = null;
        document.querySelectorAll('#hp-policy .hp-pol-grp, #hp-policy .hp-pol-rule').forEach(e => { if (e.classList.contains('hp-pol-grp')) { cur = e.textContent.toLowerCase(); g[cur] = []; } else if (cur) g[cur].push(e.textContent); });
        return g['заезд и выезд'].length === 2 && g['дети'].length === 4 && g['питание'].length === 1 && g['услуги'].length === 5 && g['визы'].length === 1;
      }));
    await pol.scrollIntoViewIfNeeded();
    await shotTo(page, '1_vse_razdely');
    check('нет горизонтальной прокрутки', await noHScroll(page));
    // блок «На месте отдельно» в форме брони не изменился: сбор + депозит из policy.deposit, rules не добавляются
    await page.evaluate(() => ostSelectRate(0));
    await page.waitForSelector('.bk-onsite-box', { timeout: 8000 });
    const on = (await page.locator('.bk-onsite-box').innerText()).replace(/\s+/g, ' ');
    check('«На месте отдельно»: сбор и залог, без правил из rules', /Городской сбор — 1,5 BYN/.test(on) && /Залог за сохранность имущества: 50 BYN/.test(on) && !/Дети|Визовая|Неявка/.test(on), on);
    await shotTo(page, '2_forma_na_meste');
    await page.evaluate(() => closeBK());
    allErrors.push(...errors); await ctx.close();
  }

  // ── 2. короткий список (≤ 8 строк): без кнопки; все строки видны ──
  {
    const rules = RULES_ALL.filter(r => ['children', 'meal', 'visa', 'deposit', 'no_show'].includes(r.section));
    const { ctx, page, errors } = await open('', Object.assign({}, POLICY_OLD, { rules }));
    const pol = page.locator('#hp-policy');
    check('4 строки правил: кнопки «Показать все условия» нет, скрытых строк нет', await pol.locator('.hp-pol-all').count() === 0 && await pol.locator('.hp-pol-x').count() === 0);
    check('пустые группы не показаны (Услуги нет)', JSON.stringify((await pol.locator('.hp-pol-grp').allInnerTexts()).map(x => x.toLowerCase())) === JSON.stringify(['заезд и выезд', 'дети', 'питание', 'визы']));
    allErrors.push(...errors); await ctx.close();
  }

  // ── 3. неизвестный section → «Услуги»; rules из одного депозита; пустой rules → как раньше ──
  {
    const { ctx, page, errors } = await open('', Object.assign({}, POLICY_OLD, { rules: [{ section: 'new_unknown', label: 'Новое правило', text: 'тест' }, { section: 'deposit', label: 'Залог', text: 'x' }] }));
    const pol = page.locator('#hp-policy');
    check('неизвестный section — в группе «Услуги»', JSON.stringify((await pol.locator('.hp-pol-grp').allInnerTexts()).map(x => x.toLowerCase())) === JSON.stringify(['услуги']) && /Новое правило — тест/.test(await pol.innerText()));
    allErrors.push(...errors); await ctx.close();
    const e = await open('', Object.assign({}, POLICY_OLD, { rules: [] }));
    check('rules: [] → прежняя строка «Оплачивается отдельно»', /Оплачивается отдельно/.test(await e.page.locator('#hp-policy').innerText()) && await e.page.locator('#hp-policy .hp-pol-grp').count() === 0);
    allErrors.push(...e.errors); await e.ctx.close();
  }

  // ── 4. длинный список (40 строк) на телефоне ──
  {
    const { ctx, page, errors } = await open('', Object.assign({}, POLICY_OLD, { rules: RULES_LONG }));
    const pol = page.locator('#hp-policy');
    check('40 строк: свёрнуто до 8 (кнопка есть)', await pol.locator('.hp-pol-all').count() === 1 && await pol.locator('.hp-pol-rule:visible').count() === 8, String(await pol.locator('.hp-pol-rule:visible').count()));
    check('в свёрнутом виде группа «Услуги» видна, пустых заголовков нет (скрытые группы не торчат)', await page.evaluate(() => Array.from(document.querySelectorAll('#hp-policy .hp-pol-grp')).filter(e => e.offsetParent !== null).length === 2));
    await pol.scrollIntoViewIfNeeded();
    await shotTo(page, '3_dlinnyj_svernut');
    check('свёрнутый список: нет горизонтальной прокрутки', await noHScroll(page));
    await press(pol.locator('.hp-pol-all'));
    await page.waitForTimeout(200);
    check('развёрнут: видны все 40 строк', await pol.locator('.hp-pol-rule:visible').count() === 40);
    const over = await page.evaluate(() => Array.from(document.querySelectorAll('#hp-policy .hp-pol-row, #hp-policy .hp-pol-v')).filter(e => e.scrollWidth > e.clientWidth + 1).length);
    const b = await pol.boundingBox(); const vw = await page.evaluate(() => window.innerWidth);
    check('развёрнутый список помещается по ширине, строки не вылезают', over === 0 && b.x >= 0 && b.x + b.width <= vw + 1 && await noHScroll(page), JSON.stringify(b));
    const btnBox = await pol.locator('.hp-pol-all').boundingBox();
    check('кнопка достаточно высокая для пальца (≥ 32 px)', btnBox && btnBox.height >= 32, JSON.stringify(btnBox));
    await shotTo(page, '4_dlinnyj_razvernut');
    await press(pol.locator('.hp-pol-all'));
    check('«Свернуть» возвращает 8 строк', await pol.locator('.hp-pol-rule:visible').count() === 8);
    allErrors.push(...errors); await ctx.close();
  }

  // ── 5. без rules — как в main: разметка блока и снимок совпадают ──
  if (OLD_HTML) {
    const snap = async (prefix) => {
      const { ctx, page, errors } = await open(prefix, POLICY_OLD);
      const html = await page.locator('#hp-policy').evaluate(e => e.outerHTML);
      const buf = await page.locator('#hp-policy').screenshot({ animations: 'disabled', caret: 'hide' });
      const page_ = await page.evaluate(() => document.getElementById('hotel-page').innerText);
      allErrors.push(...errors); await ctx.close();
      return { html, buf, page_ };
    };
    const a = await snap('/old'), b = await snap('');
    check('без rules: разметка «Условий проживания» как в main', a.html === b.html && /Оплачивается отдельно/.test(b.html), a.html === b.html ? '' : 'разметка отличается');
    check('без rules: снимок блока совпадает с main пиксель в пиксель', Buffer.compare(a.buf, b.buf) === 0);
    check('без rules: текст страницы объекта как в main', a.page_ === b.page_);
    fs.writeFileSync(path.join(SHOTS, vp.tag + '_5_bez_rules.png'), b.buf);
    // policy: null — блока нет ни там, ни там
    const n = await open('', null); const hasNone = await n.page.locator('#hp-policy').count() === 0;
    check('policy: null → блока нет, страница цела', hasNone && await n.page.locator('.ost-rate-row').count() === 1);
    allErrors.push(...n.errors); await n.ctx.close();
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
    await run(browser, base, { name: 'ПК 1366×768', tag: '1366', mobile: false, opts: { viewport: { width: 1366, height: 768 }, timezoneId: 'Europe/Minsk', locale: 'ru-RU' } });
  } finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log('\nИТОГ: ' + (results.length - bad.length) + ' из ' + results.length + ' проверок пройдено');
  fs.writeFileSync(path.join(__dirname, 'result_rules_18_10.json'), JSON.stringify(results, null, 1));
  process.exit(bad.length ? 1 : 0);
})();
