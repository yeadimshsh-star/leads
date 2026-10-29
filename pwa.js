/* ---------- גרסת האפליקציה המותקנת (GitHub Pages): כניסה עם Google ותקשורת ישירה לשרת ---------- */
window.PWA = (function () {
  const CLIENT_ID = '77339980151-alkogpsuis064johrb34vu8f9ust627b.apps.googleusercontent.com';
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbya0DwvJW0-Zberca99kAYBRwnNYIGGO4iieTTdD3cKpJqpw_2yHG_jqC37sBGF3NRz/exec';
  const TOKEN_KEY = 'yaadim-id-token';
  let token = null, waiting = [];

  function tokenExp(t) {
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch (e) { return 0; }
  }
  function valid(t) { return t && tokenExp(t) - Date.now() > 2 * 60 * 1000; }
  try { const t = localStorage.getItem(TOKEN_KEY); if (valid(t)) token = t; } catch (e) { }

  function onCredential(resp) {
    token = resp.credential;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { }
    document.getElementById('login').classList.remove('open');
    waiting.splice(0).forEach(f => f(token));
  }
  function initGis() {
    google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: true, use_fedcm_for_prompt: true, cancel_on_tap_outside: false });
    google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'he' });
  }
  /** מחזיר אסימון בתוקף; אם אין – מציג את מסך הכניסה ומחכה. */
  function getToken() {
    if (valid(token)) return Promise.resolve(token);
    token = null;
    return new Promise(ok => {
      waiting.push(ok);
      document.getElementById('login').classList.add('open');
      const go = () => { initGis(); google.accounts.id.prompt(); };
      if (window.google && google.accounts && google.accounts.id) go();
      else window.addEventListener('gis-ready', go, { once: true });
    });
  }
  async function call(action, args) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t = await getToken();
      // בלי כותרת Content-Type, כדי שהדפדפן לא ישלח בקשת preflight
      const res = await fetch(BACKEND_URL, { method: 'POST', body: JSON.stringify({ idToken: t, action, args: args || {} }) });
      const out = await res.json();
      if (out.ok) return out.data;
      if (/התחברות מחדש|אסימון/.test(out.error) && attempt === 0) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) { } continue; }
      throw new Error(out.error);
    }
  }
  function signOut() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { }
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    location.reload();
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  return { call, signOut };
})();
