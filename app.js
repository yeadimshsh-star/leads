/* ---------- מצב ---------- */
const S = {
  data: null, view: 'today', limit: 100, templates: null, current: null,
  f: { who: 'me', stage: 'leads', status: 'פעיל', due: '', q: '' }
};
const COLS = []; for (let i = 0; i < 41; i++) COLS.push(colLetter(i));
function colLetter(i) { let s = ''; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
const ci = l => COLS.indexOf(l);
const v = (r, l) => (r.values[ci(l)] || '').trim();

/* ---------- אייקונים בצבעי המותג (במקום אימוג'י) ---------- */
const ICON = {
  phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>'
};
/** אייקון "היום" עם התאריך של היום */
function renderTodayIcon() {
  const t = new Date();
  const el = document.getElementById('todayIcon');
  if (el) el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V9h14z"/><text x="12" y="18.3" text-anchor="middle" font-size="9" font-weight="700" font-family="Heebo,Arial" fill="currentColor">${t.getDate()}</text></svg>`;
}

/* ---------- תקשורת ---------- */
function call(action, args) {
  if (window.PWA) return window.PWA.call(action, args);
  return new Promise((ok, fail) => {
    google.script.run.withSuccessHandler(s => ok(JSON.parse(s))).withFailureHandler(e => fail(e)).api(action, args || {});
  });
}
async function writeCall(action, args, okMsg) {
  busy(true);
  try {
    const res = await call(action, args);
    (res.rows || []).forEach(patchRow);
    if (res.conflicts && res.conflicts.length) toast('חלק מהשדות שונו בינתיים בגליון ולא נשמרו: ' + res.conflicts.join(', ') + '. בדוק ונסה שוב.', true);
    else if (res.warnings && res.warnings.length) toast((okMsg ? okMsg + '. ' : '') + res.warnings.join('. '), true);
    else if (okMsg && !res.duplicates) toast(okMsg);
    return res;
  } catch (e) {
    toast(e.message || String(e), true);
    throw e;
  } finally { busy(false); }
}
function patchRow(p) {
  const i = p.row - S.data.firstRow;
  while (S.data.rows.length <= i) S.data.rows.push(new Array(41).fill(''));
  S.data.rows[i] = p.values;
  buildRows();
  saveCache();
}
/* עותק הנתונים בדפדפן: פתיחה מיידית, והנתונים העדכניים נטענים ברקע */
const CACHE_KEY = 'yaadim-leads-cache-v1';
const REFRESH_MS = 10 * 60 * 1000;
function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { } }
function restore(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
function saveCache() { if (S.data) store(CACHE_KEY, { data: S.data, at: S.loadedAt }); }
function setWho(updating) {
  const at = S.loadedAt ? new Date(S.loadedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
  document.getElementById('who').innerHTML = 'שלום ' + esc(S.data ? S.data.me : '') + '<br>' + (updating ? 'מתעדכן…' : at);
}
/** האם המשתמש באמצע הקלדה או עריכה – אז לא מרעננים כדי לא למחוק לו את מה שכתב. */
function isTyping() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
  return [...document.querySelectorAll('#panel textarea, #panel input, #main textarea, #main input:not([type=search])')]
    .some(el => el.classList.contains('changed') || (el.tagName === 'TEXTAREA' && el.value.trim() && !el.dataset.old));
}
async function reload(quiet) {
  if (!quiet && !S.data) document.getElementById('main').innerHTML = '<div class="card muted">טוען נתונים…</div>';
  if (S.data) setWho(true);
  try {
    S.data = await call('load');
    S.loadedAt = Date.now();
    buildRows();
    saveCache();
    setWho(false);
    if (!isTyping()) {
      render();
      if (S.currentId || S.current) reopenCurrent();
    }
    showSales();
  } catch (e) {
    const msg = e.message || String(e);
    toast(msg, true);
    if (S.data) setWho(false);
    else document.getElementById('main').innerHTML = `<div class="card"><b>שגיאה בטעינה:</b> ${esc(msg)}<br><button class="btn" style="margin-top:8px" onclick="reload()">נסה שוב</button></div>`;
  }
}
function reopenCurrent() {
  const r = (S.currentId && S.rows.find(x => v(x, 'AO') === S.currentId)) || (S.current && rowByNum(S.current.row));
  if (r) openLead(r.row, true); else closeLead();
}
function startFromCache() {
  const c = restore(CACHE_KEY);
  if (!c || !c.data) return;
  S.data = c.data; S.loadedAt = c.at;
  buildRows(); render(); setWho(true);
}
function maybeRefresh() {
  if (document.visibilityState === 'visible' && S.loadedAt && Date.now() - S.loadedAt > REFRESH_MS && !isTyping()) reload(true);
}
document.addEventListener('visibilitychange', maybeRefresh);
setInterval(maybeRefresh, 60 * 1000);

/* ---------- הודעה חגיגית על מכירות ---------- */
const SEEN_KEY = 'yaadim-seen-sales';
function showSales() {
  const seen = restore(SEEN_KEY) || [];
  const recent = (S.data.sales || []).filter(s => !seen.includes(s.id + s.ts) && Date.now() - new Date(s.ts).getTime() < 14 * 86400000);
  if (!recent.length) return;
  const box = document.getElementById('celebrate');
  box.innerHTML = `<div class="boom">&#x1F389;</div>` + recent.slice(0, 5).map(s =>
    `<div class="sale-line"><b>${esc(s.verb)} ${esc(s.label)}!</b> ${esc(s.name)}<div class="muted">נסגר ע"י ${esc(s.by)} · ${new Date(s.ts).toLocaleDateString('he-IL')}</div></div>`).join('') +
    `<button class="btn teal" style="margin-top:10px" onclick="closeSales()">יש! &#x1F44F;</button>`;
  box.dataset.ids = JSON.stringify(recent.map(s => s.id + s.ts));
  box.classList.add('open');
}
function closeSales() {
  const box = document.getElementById('celebrate');
  const seen = restore(SEEN_KEY) || [];
  store(SEEN_KEY, seen.concat(JSON.parse(box.dataset.ids || '[]')).slice(-200));
  box.classList.remove('open');
}

/* ---------- עיבוד שורות ---------- */
function parseDate(s) {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}
function today0() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function toIso(disp) { const d = parseDate(disp); return d ? iso(d) : ''; }

function buildRows() {
  const t = today0().getTime();
  S.rows = S.data.rows.map((values, i) => {
    const r = { row: S.data.firstRow + i, values };
    if (!values.slice(0, 12).some(x => String(x).trim())) { r.empty = true; return r; }
    r.isLead = v(r, 'G').startsWith('ליד');
    r.active = v(r, 'H') === 'פעיל';
    const k = v(r, 'K'), kd = parseDate(k);
    r.kTime = kd ? kd.getTime() : null;
    r.due = k === 'מלאי' ? 'stock' : !kd ? (k ? 'other' : 'none') : r.kTime < t ? 'overdue' : r.kTime === t ? 'today' : 'future';
    r.fp = [values[0], values[4], values[6], values[9]].join('|');
    r.search = (values[0] + ' ' + values[1] + ' ' + values[3] + ' ' + values[4] + ' ' + values[5] + ' ' + values[8]).toLowerCase();
    return r;
  }).filter(r => !r.empty);
}
const openLeads = () => S.rows.filter(r => r.isLead && r.active);
const byDue = (a, b) => (a.kTime ?? 9e15) - (b.kTime ?? 9e15);

/* ---------- ניווט (כולל כפתור "חזרה" של המכשיר באפליקציה המותקנת) ---------- */
function go(view, fromHistory) {
  if (window.PWA && !fromHistory && view !== S.view) history.pushState({ view }, '');
  S.view = view; S.limit = 100; render(); window.scrollTo(0, 0);
}
if (window.PWA) {
  history.replaceState({ view: 'today' }, '');
  window.addEventListener('popstate', e => {
    if (S.current) { closeLead(true); return; }
    go((e.state && e.state.view) || 'today', true);
  });
}

/* חיוג: באפליקציה המותקנת הקישור עובד רגיל; בקישור הישן (בתוך המסגרת של גוגל) פותחים בחלון חדש, אחרת הטלפון חוסם */
function dial(a) {
  if (window.PWA) return true;
  window.open(a.getAttribute('href'), '_blank');
  return false;
}

/* כפתור "חזרה" בקישור הישן: דרך מנגנון ההיסטוריה של Apps Script */
if (!window.PWA && window.google && google.script && google.script.history) {
  google.script.history.setChangeHandler(e => {
    if (S.current && !(e.state && e.state.lead)) closeLead(true);
  });
}
function gasPush(lead) {
  if (!window.PWA && window.google && google.script && google.script.history) google.script.history.push({ lead }, {}, '');
}

/* ---------- טיוטות: מה שמוקלד נשמר במכשיר עד ששומרים, גם אם הדף נטען מחדש ---------- */
const DRAFT_KEY = 'yaadim-drafts';
function draftKey(el) { return (S.currentId || 'new') + ':' + el.id; }
function saveDraft(el) {
  const d = restore(DRAFT_KEY) || {};
  if (el.value.trim()) d[draftKey(el)] = el.value; else delete d[draftKey(el)];
  store(DRAFT_KEY, d);
}
function restoreDrafts(root) {
  const d = restore(DRAFT_KEY) || {};
  root.querySelectorAll('textarea[id], input[id]:not([type=date]):not([type=checkbox])').forEach(el => {
    if (d[draftKey(el)] && !el.value) { el.value = d[draftKey(el)]; el.classList.add('changed'); }
    el.addEventListener('input', () => saveDraft(el));
  });
}
function clearDrafts(prefix) {
  const d = restore(DRAFT_KEY) || {};
  Object.keys(d).filter(k => k.startsWith(prefix + ':')).forEach(k => delete d[k]);
  store(DRAFT_KEY, d);
}
function render() {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  renderTodayIcon();
  if (!S.data) return;
  const m = document.getElementById('main');
  m.innerHTML = S.view === 'today' ? viewToday() : S.view === 'all' ? viewAll() : S.view === 'dash' ? viewDash() : viewNew();
  if (S.view === 'new') restoreDrafts(m);
  if (S.view === 'today') initSortable();
}

/* ---------- רכיבים ---------- */
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function waPhone(p) { const d = String(p).replace(/\D/g, ''); return d.startsWith('0') ? '972' + d.slice(1) : d; }
function dueBadge(r) {
  if (r.due === 'overdue') return `<span class="badge red">באיחור · ${esc(v(r, 'K'))}</span>`;
  if (r.due === 'today') return '<span class="badge orange">היום</span>';
  if (r.due === 'stock') return '<span class="badge gray">מלאי</span>';
  if (r.due === 'future') return `<span class="badge">${esc(v(r, 'K'))}</span>`;
  if (r.isLead && r.active) return '<span class="badge gray">אין תאריך חזרה</span>';
  return '';
}
function statusBadge(r) {
  const h = v(r, 'H');
  const cls = h === 'פעיל' ? 'green' : h === 'נמכר' ? '' : 'gray';
  return `<span class="badge ${cls}">${esc(h || '—')}</span>`;
}
function leadItem(r) {
  const phone = v(r, 'E');
  const cls = r.active && (r.due === 'overdue' || r.due === 'today') ? r.due : '';
  return `<div class="card lead ${cls}" data-id="${esc(v(r, 'AO'))}" onclick="openLead(${r.row})">
    <div class="main">
      <div class="name">${esc(v(r, 'A') || '(ללא שם)')}</div>
      <div class="sub">${esc(v(r, 'G'))} · ${esc(v(r, 'C'))}</div>
      <div>${statusBadge(r)}${dueBadge(r)}</div>
    </div>
    <div class="acts" onclick="event.stopPropagation()">
      ${phone ? `<a class="icon ph" href="tel:${esc(phone)}" onclick="return dial(this)" title="חיוג">${ICON.phone}</a>
      <a class="icon wa" href="https://wa.me/${waPhone(phone)}" target="_blank" title="וואטסאפ">${ICON.wa}</a>` : ''}
    </div>
  </div>`;
}
function list(rows) {
  if (!rows.length) return '<div class="card muted">אין שורות להצגה.</div>';
  const shown = rows.slice(0, S.limit).map(leadItem).join('');
  const more = rows.length > S.limit ? `<button class="btn light more" onclick="S.limit+=100;render()">הצג עוד (${rows.length - S.limit})</button>` : '';
  return shown + more;
}

/* ---------- מסך היום: סדר ידני אישי בלחיצה ארוכה וגרירה ---------- */
/** לידים שסידרתם ידנית לפי הסדר שלכם; לידים חדשים שעוד לא סודרו מופיעים לפניהם לפי תאריך חזרה */
function manualSort(rows) {
  const order = (S.data && S.data.order) || [];
  if (!order.length) return rows.sort(byDue);
  const idx = {}; order.forEach((id, i) => idx[id] = i);
  return rows.sort((a, b) => ((idx[v(a, 'AO')] ?? -1) - (idx[v(b, 'AO')] ?? -1)) || byDue(a, b));
}
function sortList(rows) {
  if (!rows.length) return '<div class="card muted">אין שורות להצגה.</div>';
  return `<div class="sortable">${rows.map(leadItem).join('')}</div>`;
}
function initSortable() {
  if (!window.Sortable) return;
  document.querySelectorAll('#main .sortable').forEach(el => Sortable.create(el, {
    animation: 150, delay: 350, touchStartThreshold: 6, filter: '.acts', preventOnFilter: false, onEnd: saveOrder
  }));
}
function saveOrder() {
  const shown = [...document.querySelectorAll('#main .sortable .lead[data-id]')].map(el => el.dataset.id);
  const rest = ((S.data && S.data.order) || []).filter(id => !shown.includes(id));
  S.data.order = shown.concat(rest);
  saveCache();
  clearTimeout(S.orderT);
  S.orderT = setTimeout(() => call('setOrder', { ids: S.data.order }).then(() => toast('הסדר נשמר')).catch(e => toast(e.message || String(e), true)), 800);
}
function jumpTo(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function viewToday() {
  const mine = openLeads().filter(r => v(r, 'C') === S.data.me);
  const over = manualSort(mine.filter(r => r.due === 'overdue'));
  const tod = manualSort(mine.filter(r => r.due === 'today'));
  const none = manualSort(mine.filter(r => r.due === 'none' || r.due === 'other'));
  const week = manualSort(mine.filter(r => r.due === 'future' && r.kTime <= addDays(today0(), 7).getTime()));
  return `<h2>היום של ${esc(S.data.me)}</h2>
    <div class="stats">
      <div class="stat red" onclick="jumpTo('sec-over')"><b>${over.length}</b><span>באיחור</span></div>
      <div class="stat orange" onclick="jumpTo('sec-today')"><b>${tod.length}</b><span>להיום</span></div>
      <div class="stat" onclick="S.f.who='me';S.f.stage='leads';S.f.status='פעיל';S.f.due='';S.f.q='';go('all')"><b>${mine.length}</b><span>לידים פתוחים שלי</span></div>
    </div>
    <div class="muted" style="margin:-2px 2px 8px">לסידור ידני: לחיצה ארוכה על ליד וגרירה. הסדר נשמר לך בלבד.</div>
    <h3 id="sec-over">באיחור (${over.length})</h3>${sortList(over)}
    <h3 id="sec-today">להיום (${tod.length})</h3>${sortList(tod)}
    <h3>ללא תאריך חזרה (${none.length})</h3>${sortList(none)}
    <h3>בשבוע הקרוב (${week.length})</h3>${sortList(week)}`;
}

/* ---------- כל השורות ---------- */
function filtered() {
  const f = S.f, me = S.data.me, t7 = addDays(today0(), 7).getTime();
  let rows = S.rows.filter(r => {
    // חיפוש טקסט מחפש בכל השורות, בלי קשר לשאר המסננים
    if (f.q) { const q = f.q.toLowerCase(), qd = q.replace(/\D/g, ''); return r.search.includes(q) || (qd.length >= 4 && r.search.replace(/-/g, '').includes(qd)); }
    const c = v(r, 'C');
    if (f.who === 'me' && c !== me) return false;
    if (S.data.handlers.includes(f.who) && c !== f.who) return false;
    if (f.who === 'others' && S.data.handlers.includes(c)) return false;
    if (String(f.who).startsWith('adv:') && c !== f.who.slice(4)) return false;
    if (f.stage === 'leads' && !r.isLead) return false;
    if (f.stage === 'buys' && r.isLead) return false;
    if (f.stage && !['leads', 'buys'].includes(f.stage) && v(r, 'G') !== f.stage) return false;
    if (f.status && v(r, 'H') !== f.status) return false;
    if (f.due === 'late' && r.due !== 'overdue') return false;
    if (f.due === 'today' && r.due !== 'today') return false;
    if (f.due === 'week' && !(r.due === 'future' && r.kTime <= t7)) return false;
    if (f.due === 'none' && r.due !== 'none') return false;
    if (f.due === 'stock' && r.due !== 'stock') return false;
    return true;
  });
  if (f.status === 'פעיל') rows.sort(byDue);
  else rows.sort((a, b) => (parseDate(v(b, 'J')) || 0) - (parseDate(v(a, 'J')) || 0));
  return rows;
}
function viewAll() {
  const f = S.f, L = S.data.lists;
  const advisors = [...new Set([...(L.C || []), ...S.rows.map(r => v(r, 'C'))])].filter(c => c && !S.data.handlers.includes(c));
  const advOn = f.who === 'others' || String(f.who).startsWith('adv:');
  const whoChips = [['me', 'שלי'], ...S.data.handlers.filter(h => h !== S.data.me).map(h => [h, h])]
    .map(([k, t]) => `<button class="chip ${f.who === k ? 'on' : ''}" onclick="setF('who','${k}')">${esc(t)}</button>`).join('') +
    `<select class="chip ${advOn ? 'on' : ''}" style="width:auto" onchange="setF('who',this.value)">
      <option value="" ${advOn ? '' : 'selected'} disabled>יועצים אחרים ▾</option>
      <option value="others" ${f.who === 'others' ? 'selected' : ''}>כל היועצים האחרים</option>
      ${advisors.map(a => `<option value="adv:${esc(a)}" ${f.who === 'adv:' + a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
    </select>` +
    `<button class="chip ${f.who === '' ? 'on' : ''}" onclick="setF('who','')">כולם</button>`;
  const opt = (val, t, cur) => `<option value="${esc(val)}" ${cur === val ? 'selected' : ''}>${esc(t)}</option>`;
  const statuses = [...new Set([...(L.H || []), ...S.rows.map(r => r.values[7])].map(s => String(s).trim()))].filter(Boolean);
  const rows = filtered();
  return `<h2>כל השורות</h2>
    <div class="chips">${whoChips}</div>
    <div class="filters">
      <select onchange="setF('stage',this.value)">${opt('', 'כל השלבים', f.stage)}${opt('leads', 'לידים בלבד', f.stage)}${opt('buys', 'רכישות בלבד', f.stage)}${(L.G || []).map(g => opt(g, g, f.stage)).join('')}</select>
      <select onchange="setF('status',this.value)">${opt('', 'כל המצבים', f.status)}${statuses.map(s => opt(s, s, f.status)).join('')}</select>
      <select onchange="setF('due',this.value)">${opt('', 'כל תאריכי החזרה', f.due)}${opt('late', 'באיחור', f.due)}${opt('today', 'היום', f.due)}${opt('week', 'בשבוע הקרוב', f.due)}${opt('none', 'ללא תאריך', f.due)}${opt('stock', 'מלאי', f.due)}</select>
      <input type="search" placeholder="חיפוש: שם, טלפון, מייל, הערות" value="${esc(f.q)}" oninput="S.f.q=this.value;clearTimeout(S.qt);S.qt=setTimeout(()=>{S.limit=100;document.getElementById('res').innerHTML=resList()},250)">
    </div>
    <div id="res">${resList(rows)}</div>`;
}
function resList(rows) { rows = rows || filtered(); return `<div class="muted" style="margin:0 2px 6px">${rows.length} שורות</div>` + list(rows); }
function setF(k, val) {
  S.f[k] = val; S.limit = 100;
  // יועצים מופיעים בעיקר בשורות רכש, ולכן בבחירת יועץ מציגים את כל השלבים
  if (k === 'who' && (val === 'others' || String(val).startsWith('adv:')) && S.f.stage === 'leads') S.f.stage = '';
  render();
}

/* ---------- דשבורד ---------- */
const productName = g => String(g).replace(/^(ליד|רכש)\s+/, '').replace('צמיחה עסקית', 'מעטפת צמיחה עסקית');
const ym = d => d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : '';
const ymLabel = k => k.slice(5) + '/' + k.slice(0, 4);
function phonesOf(r) { return [v(r, 'E'), v(r, 'F')].map(x => x.replace(/\D/g, '')).filter(x => x.length >= 9 && !/^0+$/.test(x)); }
function realMail(r) { const e = v(r, 'D').toLowerCase(); return e.includes('@') ? e : ''; }
function sameClient(a, b) {
  const pa = phonesOf(a), pb = phonesOf(b), ea = realMail(a);
  return (pa.length && pb.some(x => pa.includes(x))) || (ea && ea === realMail(b));
}
/** מכירת ליווי שקדמה לה רכישת פגישה של אותו לקוח = שדרוג מפגישה לליווי */
function isUpgrade(r) {
  const j = parseDate(v(r, 'J'));
  return S.rows.some(x => v(x, 'G') === 'רכש פגישה' && sameClient(x, r) && (parseDate(v(x, 'J')) || 0) <= (j || 0));
}
function table(head, rows, opts) {
  opts = opts || {};
  const last = head.length - 1, totCol = head[last] === 'סה"כ';
  return `<div class="tablewrap"><table><tr>${head.map((h, j) => `<th class="${totCol && j === last ? 'tot' : ''}">${h}</th>`).join('')}</tr>${rows.map((r, i) =>
    `<tr${opts.totalLast && i === rows.length - 1 ? ' class="total"' : ''}>${r.map((c, j) => `<td class="${[(opts.cls && opts.cls[i] && c && j) ? opts.cls[i] : '', totCol && j === last ? 'tot' : ''].join(' ')}">${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
}
function viewDash() {
  const t = today0(), day = 86400000;
  const people = [...S.data.handlers];
  const cols = [...people, 'סה"כ'];
  const of = (rows, p) => p === 'סה"כ' ? rows : rows.filter(r => v(r, 'C') === p);
  const open = openLeads();
  const days = r => r.kTime === null ? null : Math.round((r.kTime - t.getTime()) / day);

  // 1. סיכום לידים פתוחים – הקטגוריות מכסות את כל הפתוחים, כך שהסה"כ תמיד מתאים
  const buckets = [
    ['באיחור', r => r.due === 'overdue', 'num-red'],
    ['היום', r => r.due === 'today', 'num-orange'],
    ['השבוע (1–7 ימים)', r => r.due === 'future' && days(r) <= 7, ''],
    ['החודש (8–30 ימים)', r => r.due === 'future' && days(r) > 7 && days(r) <= 30, ''],
    ['מעל חודש', r => r.due === 'future' && days(r) > 30, ''],
    ['ללא תאריך חזרה', r => r.due === 'none' || r.due === 'other', ''],
    ['מלאי', r => r.due === 'stock', '']
  ];
  const sumRows = buckets.map(([n, f]) => [n, ...cols.map(p => of(open, p).filter(f).length)]);
  sumRows.push(['<b>סה"כ לידים פתוחים</b>', ...cols.map(p => `<b>${of(open, p).length}</b>`)]);
  const summary = table(['סיכום לידים פתוחים', ...cols], sumRows, { totalLast: true, cls: buckets.map(b => b[2]) });

  // 2. לידים פתוחים לפי מוצר
  const products = [...new Set(open.map(r => productName(v(r, 'G'))))];
  const byProduct = table(['לידים פתוחים לפי מוצר', ...cols], products.map(pr => [esc(pr), ...cols.map(p => of(open, p).filter(r => productName(v(r, 'G')) === pr).length)]));

  // 3. מכירות לפי מוצר ואיש מכירות – חודש לבחירה (ברירת מחדל: החודש הנוכחי)
  const sold = S.rows.filter(r => r.isLead && v(r, 'H') === 'נמכר');
  const months = [...new Set([ym(t), ...sold.map(r => ym(parseDate(v(r, 'L')))).filter(Boolean)])].sort().reverse();
  const m = S.dashMonth || ym(t);
  const soldM = sold.filter(r => ym(parseDate(v(r, 'L'))) === m);
  const soldProducts = [...new Set(soldM.map(r => productName(v(r, 'G'))))];
  const salesRows = soldProducts.map(pr => [esc(pr), ...cols.map(p => of(soldM, p).filter(r => productName(v(r, 'G')) === pr).length)]);
  salesRows.push(['<b>סה"כ</b>', ...cols.map(p => `<b>${of(soldM, p).length}</b>`)]);
  const monthSel = `<select style="max-width:160px" onchange="S.dashMonth=this.value;render()">${months.map(k => `<option value="${k}" ${k === m ? 'selected' : ''}>${ymLabel(k)}</option>`).join('')}</select>`;
  const salesTable = `<div class="row" style="margin:14px 2px 6px"><h3 style="margin:0">מכירות לפי מוצר ואיש מכירות</h3>${monthSel}</div>` +
    (soldM.length ? table(['מוצר', ...cols], salesRows, { totalLast: true }) : '<div class="card muted">אין מכירות בחודש הזה</div>');

  // 4. בקרה חודשית – 6 החודשים האחרונים
  const buys = S.rows.filter(r => !r.isLead);
  const last6 = [...Array(6)].map((_, i) => ym(new Date(t.getFullYear(), t.getMonth() - i, 1)));
  const inM = (rows, k) => rows.filter(r => ym(parseDate(v(r, 'J'))) === k);
  const ctrl = last6.map(k => {
    const b = inM(buys, k);
    const acc = b.filter(r => /ליווי/.test(v(r, 'G')));
    return [ymLabel(k), inM(S.rows.filter(r => r.isLead), k).length, b.filter(r => v(r, 'G') === 'רכש פגישה').length,
      acc.length, b.filter(r => /צמיחה/.test(v(r, 'G'))).length, acc.filter(isUpgrade).length];
  });
  const control = table(['בקרה חודשית', 'לידים שהגיעו', 'פגישות שנמכרו', 'ליוויים שנמכרו', 'מעטפת צמיחה', 'שדרוגים מפגישה לליווי'], ctrl);

  // 5. אחוזי המרה
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
  const meetLeads = S.rows.filter(r => v(r, 'G') === 'ליד פגישה').length;
  const meetBuys = buys.filter(r => v(r, 'G') === 'רכש פגישה').length;
  const upgrades = buys.filter(r => /ליווי/.test(v(r, 'G')) && isUpgrade(r)).length;
  const conv = table(['אחוזי המרה (מתחילת הנתונים)', 'כמות', 'אחוז'], [
    ['ליד פגישה ← רכש פגישה', `${meetBuys} מתוך ${meetLeads}`, pct(meetBuys, meetLeads)],
    ['פגישה ← ליווי (שדרוג)', `${upgrades} מתוך ${meetBuys}`, pct(upgrades, meetBuys)]
  ]);

  // 6. תפוסת יועצים – כפי שהיא בדשבורד שבקובץ
  const cap = S.data.capacity;
  const capTable = cap ? `<h3>תפוסת יועצים</h3>` + table(cap[0].map(esc), cap.slice(1).map(r => r.map(esc))) : '';

  const gap = '<div style="height:10px"></div>';
  return `<h2>דשבורד לידים</h2><div class="muted" style="margin:-4px 2px 8px">נכון ל־${new Date(S.loadedAt).toLocaleString('he-IL')}</div>
    ${summary}${gap}${byProduct}${salesTable}${gap}<h3>בקרה חודשית</h3>${control}${gap}${conv}${capTable}`;
}

/* ---------- כרטיס ליד ---------- */
function rowByNum(n) { return S.rows.find(r => r.row === n); }
function openLead(n, keepScroll) {
  const r = rowByNum(n);
  if (!r) { closeLead(true); return; }
  if (window.PWA && !keepScroll) {
    const st = { view: S.view, lead: v(r, 'AO') || r.row };
    if (S.current) history.replaceState(st, ''); else history.pushState(st, '');
  }
  if (!window.PWA && !keepScroll && !S.current) gasPush(v(r, 'AO') || String(r.row));
  S.current = r;
  S.currentId = v(r, 'AO');
  const p = document.getElementById('panel'), st = p.scrollTop;
  p.innerHTML = leadPanel(r);
  document.getElementById('sheet').classList.add('open');
  p.scrollTop = keepScroll ? st : 0;
  restoreDrafts(p);
}
function closeLead(fromHistory) {
  if (window.PWA && !fromHistory && history.state && history.state.lead) { history.back(); return; }
  S.current = null; S.currentId = null; document.getElementById('sheet').classList.remove('open'); render();
}
/** שורות של אותו לקוח: אותו טלפון (ראשי או נוסף) או אותו מייל אמיתי (עם @). לא לפי שם, ולא "אין". */
function related(r) {
  return S.rows.filter(x => x.row !== r.row && sameClient(r, x));
}
function leadPanel(r) {
  const phone = v(r, 'E'), phone2 = v(r, 'F'), email = v(r, 'D'), me = S.data.me;
  const H = v(r, 'H'), C = v(r, 'C');
  const rel = related(r);
  const quick = [['מחר', 1], ['3 ימים', 3], ['שבוע', 7], ['שבועיים', 14], ['חודש', 30]];
  return `<div class="top"><button class="btn ghost" onclick="closeLead()">&#x2192; חזרה</button><h2>${esc(v(r, 'A') || '(ללא שם)')}</h2></div>
  <div class="card">
    <div>${statusBadge(r)}<span class="badge">${esc(v(r, 'G'))}</span><span class="badge">מטפל: ${esc(C || '—')}</span>${dueBadge(r)}</div>
    <div class="muted" style="margin-top:6px">שורה ${r.row} · תחילה ${esc(v(r, 'J') || '—')}${v(r, 'L') ? ' · סיום ' + esc(v(r, 'L')) : ''}${v(r, 'AE') ? ' · ערוץ: ' + esc(v(r, 'AE')) : ''}</div>
    <div class="row" style="margin-top:10px">
      ${phone ? `<a class="btn light" href="tel:${esc(phone)}" onclick="return dial(this)">${ICON.phone} ${esc(phone)}</a>
        <a class="btn light" style="color:#128C7E" href="https://wa.me/${waPhone(phone)}" target="_blank">${ICON.wa} וואטסאפ</a>
        <button class="btn teal" onclick="pickTemplate()">${ICON.wa} שלח טקסט מוכן</button>` : '<span class="muted">אין טלפון</span>'}
      ${phone2 ? `<a class="btn ghost" href="tel:${esc(phone2)}" onclick="return dial(this)">${ICON.phone} ${esc(phone2)}</a>` : ''}
      ${email ? `<a class="btn ghost" href="mailto:${esc(email)}" target="_blank">&#x2709; ${esc(email)}</a>` : ''}
    </div>
    <div id="tpls"></div>
  </div>

  <div class="card">
    <label>הוספת הערה (תירשם "${stampNow()} ${esc(me)}:")</label>
    <textarea id="note" placeholder="סיכום שיחה…"></textarea>
    <div class="row" style="margin-top:6px"><button class="btn" onclick="addNote()">הוסף הערה</button></div>
  </div>

  <div class="card">
    <label>תאריך חזרה${v(r, 'K') ? ' (כרגע: ' + esc(v(r, 'K')) + ')' : ''}</label>
    <div class="row">${quick.map(([t, d]) => `<button class="btn light" onclick="setNext('${iso(addDays(today0(), d))}')">${t}</button>`).join('')}
      <button class="btn light" onclick="setNext('מלאי')">מלאי</button></div>
    <div class="row" style="margin-top:6px"><input type="date" id="nextDate" style="max-width:200px" value="${toIso(v(r, 'K'))}"><button class="btn" onclick="setNext(document.getElementById('nextDate').value)">קבע</button>
      ${v(r, 'K') ? `<button class="btn ghost" onclick="setNext('')">נקה</button>` : ''}</div>
  </div>

  <div class="card">
    <label>מצב</label>
    <div class="row">${S.data.statuses.map(s => `<button class="btn ${s === H ? 'on' : 'light'}" onclick="setStatus('${s}')">${s}</button>`).join('')}</div>
    <label>העברה לטיפול</label>
    <div class="row">${S.data.handlers.map(h => `<button class="btn ${h === C ? 'on' : 'light'}" ${h === C ? 'disabled' : ''} onclick="transfer('${h}')">${h}</button>`).join('')}</div>
  </div>

  ${r.isLead ? `<div class="card"><details id="saleBox"><summary>&#x1F4B0; נסגרה מכירה - פתיחת שורת רכש</summary>${saleForm(r)}</details></div>` : ''}

  <div class="card"><label>סיכום שיחה / הערות</label><div class="notes">${esc(v(r, 'I')) || '<span class="muted">אין עדיין הערות</span>'}</div></div>

  ${rel.length ? `<h3>שורות נוספות של אותו לקוח (${rel.length})</h3>${rel.map(leadItem).join('')}` : ''}

  <div class="card"><details><summary>&#x270F; כל השדות</summary>${fieldsForm(r)}</details></div>

  <div class="row" style="justify-content:center;margin:14px 0 4px"><button class="btn ghost danger" onclick="deleteRow()">&#x1F5D1; מחק שורה</button></div>`;
}
function stampNow() { const t = new Date(); return String(t.getDate()).padStart(2, '0') + '.' + String(t.getMonth() + 1).padStart(2, '0') + '.' + String(t.getFullYear()).slice(2); }
const ref = () => ({ row: S.current.row, fp: S.current.fp, id: v(S.current, 'AO') });
async function deleteRow() {
  const r = S.current;
  if (!confirm(`האם אתה בטוח שברצונך למחוק את השורה של ${v(r, 'A') || '(ללא שם)'} (${v(r, 'G')})?\n\nהשורה תימחק מהגליון "לקוחות ולידים". התוכן שלה יישמר בלוג.`)) return;
  await writeCall('deleteRow', ref(), 'השורה נמחקה');
  closeLead();
  reload(true);
}
async function addNote() {
  const text = document.getElementById('note').value.trim();
  if (!text) return toast('ההערה ריקה', true);
  await writeCall('addNote', { ...ref(), text }, 'ההערה נשמרה');
  const d = restore(DRAFT_KEY) || {}; delete d[S.currentId + ':note']; store(DRAFT_KEY, d);
  openLead(S.current.row, true);
}
async function setNext(value) {
  if (value === undefined) return;
  await writeCall('setNext', { ...ref(), value }, value ? 'תאריך החזרה נקבע' : 'תאריך החזרה נוקה');
  openLead(S.current.row, true);
}
async function setStatus(status) {
  if (status === 'נמכר' && S.current.isLead) {
    const box = document.getElementById('saleBox');
    if (box && !confirm('לסמן "נמכר" בלי לפתוח שורת רכש?\nלחץ "ביטול" כדי למלא את פרטי הרכישה.')) { box.open = true; box.scrollIntoView({ behavior: 'smooth' }); return; }
  }
  await writeCall('setStatus', { ...ref(), status }, 'המצב עודכן');
  openLead(S.current.row, true);
}
async function transfer(to) {
  if (!confirm('להעביר את ' + v(S.current, 'A') + ' לטיפול ' + to + '?')) return;
  await writeCall('transfer', { ...ref(), to }, 'הליד הועבר ל' + to);
  openLead(S.current.row, true);
}

/* ---------- טקסטים מוכנים (נקראים חי מהמסמך בכל פתיחה) ---------- */
async function pickTemplate() {
  const box = document.getElementById('tpls');
  box.innerHTML = '<div class="muted" style="margin-top:8px">טוען טקסטים מהמסמך…</div>';
  try {
    const tpls = await call('templates');
    box.innerHTML = '<label>בחר טקסט לשליחה:</label>' + tpls.map((t, i) => `<button class="btn ghost tpl" data-i="${i}">${esc(t.title)}</button>`).join('');
    box.querySelectorAll('.tpl').forEach(b => b.onclick = () => {
      const t = tpls[+b.dataset.i];
      window.open('https://wa.me/' + waPhone(v(S.current, 'E')) + '?text=' + encodeURIComponent(t.text), '_blank');
    });
  } catch (e) { box.innerHTML = ''; toast(e.message || String(e), true); }
}

/* ---------- מכירה ---------- */
function saleForm(r) {
  const L = S.data.lists;
  const g = v(r, 'G').replace(/^ליד/, 'רכש');
  const buyStages = (L.G || []).filter(x => x.startsWith('רכש'));
  const defC = g === 'רכש פגישה' ? 'אפרים' : '';
  const sel = (id, opts, cur, empty) => `<select id="${id}">${empty ? '<option value=""></option>' : ''}${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<div class="grid2">
    <div><label>שלב הרכש</label>${sel('s_G', buyStages, g)}</div>
    <div><label>יועץ (עמודה C בשורת הרכש)</label>${sel('s_C', L.C || [], defC, true)}</div>
    <div><label>תאריך רכישה</label><input type="date" id="s_J" value="${iso(today0())}"></div>
    <div><label>אופן תשלום</label>${sel('s_M', L.M || [], '', true)}</div>
    <div><label>תשלום לקוח (₪, לפני מע"מ)</label><input id="s_O" inputmode="decimal"></div>
    <div><label>תשלום ליועץ (₪)</label><input id="s_P" inputmode="decimal"></div>
    <div><label>פגישה: שולם? / ליווי: יש פרטי אשראי?</label>${sel('s_Q', ['כן', 'לא'], '', true)}</div>
    <div><label>הערות גבייה</label><input id="s_N"></div>
  </div>
  <label class="check"><input type="checkbox" id="s_refund"> עם החזר אם נכנס לליווי <span class="muted">(נרשם בהערות הגבייה)</span></label>
  <label>הערה לשורת הרכש</label><textarea id="s_note"></textarea>
  <div class="muted" style="margin:6px 2px">שורת הליד תסומן "נמכר" עם תאריך סיום היום, ותיפתח שורת רכש חדשה עם פרטי הלקוח וסיכום השיחה. תישלח הודעה לאפרים ולנריה, תיפתח משימה ב"משימות שמואל", ובפגישה או ליווי – גם תיקיית לקוח (אם עוד אין).</div>
  <button class="btn teal" onclick="sale()">צור שורת רכש</button>`;
}
async function sale() {
  const g = id => document.getElementById(id).value.trim();
  const purchase = { G: g('s_G'), C: g('s_C'), J: g('s_J'), M: g('s_M'), O: g('s_O'), P: g('s_P'), Q: g('s_Q'), N: g('s_N'), note: g('s_note'), refund: document.getElementById('s_refund').checked };
  if (!purchase.C) return toast('בחר יועץ לשורת הרכש', true);
  if (!confirm(`לפתוח שורת ${purchase.G} עבור ${v(S.current, 'A')}?`)) return;
  const res = await writeCall('sale', { ...ref(), purchase }, 'נפתחה שורת רכש');
  clearDrafts(S.currentId);
  if (res.newRow) openLead(res.newRow, true);
  reload(true); // מביא את ההודעה החגיגית ואת הסימון בעמודה R
}

/* ---------- כל השדות ---------- */
function fieldsForm(r) {
  const hd = S.data.headers, L = S.data.lists;
  let group = '', html = '<div class="grid2">';
  COLS.forEach((c, i) => {
    if (hd[0][i] && hd[0][i].trim() && hd[0][i].trim() !== group) {
      group = hd[0][i].trim();
      html += `</div><h3>${esc(group)}</h3><div class="grid2">`;
    }
    const label = `${esc((hd[1][i] || '').trim())} <span class="muted">(${c})</span>`;
    const cur = r.values[i] || '';
    let input;
    if (c === 'AM' || c === 'AO') input = `<input value="${esc(cur)}" disabled>`;
    else if (['J', 'K', 'L'].includes(c)) {
      input = cur === 'מלאי' || (cur && !parseDate(cur)) ? `<input data-c="${c}" data-old="${esc(cur)}" value="${esc(cur)}" placeholder="yyyy-mm-dd או מלאי">`
        : `<input type="date" data-c="${c}" data-old="${esc(cur)}" data-date="1" value="${toIso(cur)}">`;
    } else if (L[c]) {
      const opts = [...L[c]]; if (cur && !opts.includes(cur)) opts.unshift(cur);
      input = `<select data-c="${c}" data-old="${esc(cur)}"><option value=""></option>${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (c === 'I') input = `<textarea data-c="I" data-old="${esc(cur)}" style="min-height:120px">${esc(cur)}</textarea>`;
    else input = `<input data-c="${c}" data-old="${esc(cur)}" value="${esc(cur)}">`;
    html += `<div><label>${label}</label>${input}</div>`;
  });
  html += '</div><div class="row" style="margin-top:10px"><button class="btn" onclick="saveFields()">שמור שינויים</button><span class="muted">נשמרים רק שדות ששונו</span></div>';
  setTimeout(() => document.querySelectorAll('#panel [data-c]').forEach(el => el.addEventListener('input', () => el.classList.add('changed'))), 0);
  return html;
}
async function saveFields() {
  const changes = {};
  document.querySelectorAll('#panel [data-c]').forEach(el => {
    const old = el.dataset.old, val = el.value;
    const same = el.dataset.date ? toIso(old) === val : old === val;
    if (!same) changes[el.dataset.c] = { old, value: val };
  });
  if (!Object.keys(changes).length) return toast('לא שונה אף שדה');
  await writeCall('update', { ...ref(), changes }, 'השינויים נשמרו');
  openLead(S.current.row, true);
}

/* ---------- ליד חדש ---------- */
function viewNew() {
  const L = S.data.lists, me = S.data.me;
  const leadStages = (L.G || []).filter(x => x.startsWith('ליד'));
  const sel = (id, opts, cur, empty) => `<select id="${id}">${empty ? '<option value=""></option>' : ''}${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<h2>ליד חדש</h2><div class="card">
    <div class="grid2">
      <div><label>שם מלא *</label><input id="n_A"></div>
      <div><label>טלפון</label><input id="n_E" inputmode="tel" onblur="checkDup()"></div>
      <div><label>טלפון נוסף</label><input id="n_F" inputmode="tel"></div>
      <div><label>מייל</label><input id="n_D" inputmode="email" onblur="checkDup()"></div>
      <div><label>שלב *</label>${sel('n_G', leadStages, 'ליד פגישה')}</div>
      <div><label>מטפל</label>${sel('n_C', S.data.handlers, me)}</div>
      <div><label>ערוץ שיווק</label>${sel('n_AE', L.AE || [], '', true)}</div>
      <div><label>פרט מקור (איזה וובינר/הרצאה)</label><input id="n_AG"></div>
      <div><label>מפנה</label><input id="n_AH"></div>
      <div><label>תאריך חזרה</label><input type="date" id="n_K"></div>
    </div>
    <label>הערה ראשונה</label><textarea id="n_note"></textarea>
    <div id="dup"></div>
    <div class="row" style="margin-top:10px"><button class="btn teal" onclick="newLead(false)">שמור ליד</button></div>
  </div>`;
}
function initNew() { }
function dupHtml(d) {
  return `<div class="card" style="background:var(--orangebg);margin-top:10px"><b>הלקוח כבר קיים בגליון (${d.length}):</b>
    ${d.map(x => `<div class="row" style="margin-top:6px"><span>${esc(x.name)} · ${esc(x.stage)} · ${esc(x.status)} · מטפל: ${esc(x.handler)}</span>
      <button class="btn light" onclick="openLead(${x.row})">פתח</button></div>`).join('')}
    <div class="row" style="margin-top:8px"><button class="btn ghost" onclick="newLead(true)">זה לקוח אחר / שלב חדש - צור בכל זאת</button></div></div>`;
}
async function checkDup() {
  const phone = document.getElementById('n_E').value, email = document.getElementById('n_D').value;
  if (phone.replace(/\D/g, '').length < 9 && !email.trim()) return;
  try {
    const d = await call('dupCheck', { phone, email });
    document.getElementById('dup').innerHTML = d.length ? dupHtml(d) : '';
  } catch (e) { }
}
async function newLead(force) {
  const g = id => document.getElementById(id).value.trim();
  const fields = { A: g('n_A'), E: g('n_E'), F: g('n_F'), D: g('n_D'), G: g('n_G'), C: g('n_C'), AE: g('n_AE'), AG: g('n_AG'), AH: g('n_AH'), K: g('n_K') };
  if (!fields.A) return toast('חסר שם', true);
  const ph = fields.E.replace(/\D/g, '');
  if (fields.E && !(ph.length === 10 && ph.startsWith('0')) && !(ph.startsWith('972') && ph.length === 12)) {
    if (!confirm('מספר הטלפון לא נראה כמו 05XXXXXXXX. לשמור בכל זאת?')) return;
  }
  const res = await writeCall('newLead', { fields, note: g('n_note'), force }, 'הליד נשמר');
  if (res.duplicates) { document.getElementById('dup').innerHTML = dupHtml(res.duplicates); return; }
  if (res.newRow) { clearDrafts('new'); S.view = 'today'; render(); openLead(res.newRow); }
}

/* ---------- כללי ---------- */
function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = err ? 'err' : ''; t.style.display = 'block';
  clearTimeout(S.tt); S.tt = setTimeout(() => t.style.display = 'none', err ? 6000 : 2500);
}
function busy(on) { document.getElementById('loading').style.display = on ? 'flex' : 'none'; }
window.addEventListener('keydown', e => { if (e.key === 'Escape' && S.current) closeLead(); });
render();
startFromCache();
reload(true);
