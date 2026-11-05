/* ---------- גרסת האפליקציה המותקנת (GitHub Pages): כניסה עם Google ותקשורת ישירה לשרת ---------- */
window.PWA = (function () {
  const CLIENT_ID = '77339980151-alkogpsuis064johrb34vu8f9ust627b.apps.googleusercontent.com';
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbya0DwvJW0-Zberca99kAYBRwnNYIGGO4iieTTdD3cKpJqpw_2yHG_jqC37sBGF3NRz/exec';
  const REDIRECT_URI = location.origin + location.pathname;
  const TOKEN_KEY = 'yaadim-id-token', NONCE_KEY = 'yaadim-nonce', HINT_KEY = 'yaadim-login-hint';
  let token = null, waiting = [], gisStarted = false;

  function claims(t) {
    try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; }
  }
  function valid(t) { return t && (claims(t).exp || 0) * 1000 - Date.now() > 2 * 60 * 1000; }
  function save(t) {
    token = t;
    try { localStorage.setItem(TOKEN_KEY, t); if (claims(t).email) localStorage.setItem(HINT_KEY, claims(t).email); } catch (e) { }
    document.getElementById('login').classList.remove('open');
    waiting.splice(0).forEach(f => f(t));
  }
  try { const t = localStorage.getItem(TOKEN_KEY); if (valid(t)) token = t; } catch (e) { }

  // חזרה מעמוד הכניסה של Google (כניסה באותו חלון – עובד גם בטלפון וגם באפליקציה המותקנת)
  (function readRedirect() {
    if (!location.hash.includes('id_token=')) return;
    const p = new URLSearchParams(location.hash.slice(1));
    const t = p.get('id_token');
    history.replaceState(null, '', location.pathname);
    let nonce = null; try { nonce = sessionStorage.getItem(NONCE_KEY) || localStorage.getItem(NONCE_KEY); } catch (e) { }
    if (t && valid(t) && claims(t).nonce === nonce) save(t);
  })();

  /** כניסה באותו חלון: עוברים לדף של Google וחוזרים עם אסימון. */
  function redirectLogin(silent) {
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem(NONCE_KEY, nonce); localStorage.setItem(NONCE_KEY, nonce); } catch (e) { }
    let hint = ''; try { hint = localStorage.getItem(HINT_KEY) || ''; } catch (e) { }
    const q = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'id_token', scope: 'openid email',
      nonce, prompt: silent && hint ? 'none' : 'select_account'
    });
    if (hint) q.set('login_hint', hint);
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString();
  }

  /** ניסיון שקט אחד עם One Tap (בלי פתיחה כפולה – זה מה ששבר את הכניסה בטלפון) */
  function startGis() {
    if (gisStarted) return;
    gisStarted = true;
    const go = () => {
      try {
        google.accounts.id.initialize({ client_id: CLIENT_ID, callback: r => save(r.credential), auto_select: true, use_fedcm_for_prompt: true, cancel_on_tap_outside: false });
        google.accounts.id.prompt();
      } catch (e) { }
    };
    if (window.google && google.accounts && google.accounts.id) go();
    else window.addEventListener('gis-ready', go, { once: true });
  }

  /** מחזיר אסימון בתוקף; אם אין – מציג את מסך הכניסה ומחכה (כל הבקשות מחכות לאותה כניסה אחת). */
  function getToken() {
    if (valid(token)) return Promise.resolve(token);
    token = null;
    return new Promise(ok => {
      waiting.push(ok);
      document.getElementById('login').classList.add('open');
      startGis();
    });
  }
  async function call(action, args) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t = await getToken();
      // בלי כותרת Content-Type, כדי שהדפדפן לא ישלח בקשת preflight
      const res = await fetch(BACKEND_URL, { method: 'POST', body: JSON.stringify({ idToken: t, action, args: args || {} }) });
      const out = await res.json();
      if (out.ok) return out.data;
      if (/התחברות מחדש|אסימון/.test(out.error) && attempt === 0) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) { } gisStarted = false; continue; }
      throw new Error(out.error);
    }
  }
  function signOut() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(HINT_KEY); } catch (e) { }
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    location.reload();
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  return { call, signOut, login: () => redirectLogin(false) };
})();
