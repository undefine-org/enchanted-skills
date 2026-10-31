// live.js — the page listens to its file, and talks back to it.
// Polls /rev; when the .bl.org changed (an answer, an Emacs save, a
// `bl doc run`), swaps the body in place unless you are mid-answer.
(() => {
  const $ = s => document.querySelector(s);
  let rev = null, busy = false;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  const stamp = (s) => { $('#stamp').textContent = s; };
  const editing = () => { const a = document.activeElement; return a && a.tagName === 'TEXTAREA' && a.value.trim() !== (a.defaultValue || '').trim(); };

  async function refresh(force) {
    try {
      const r = await (await fetch('rev', { cache: 'no-store' })).json();
      stamp('live · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (rev === null) { rev = r.rev; if (!force) return; }
      if (r.rev === rev && !force) return;
      if (busy || editing()) return;
      const d = await (await fetch('doc', { cache: 'no-store' })).json();
      const y = scrollY; $('#doc').innerHTML = d.html; rev = d.rev; scrollTo(0, y);
    } catch (e) { stamp('offline · ' + e.message); }
  }

  document.addEventListener('click', (e) => {
    const opt = e.target.closest('form.fb .opt');
    if (opt) { opt.closest('form').classList.add('picked'); opt.parentElement.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b === opt && !b.classList.contains('on'))); }
  });

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form.fb'); if (!f) return;
    e.preventDefault();
    const on = f.querySelector('.opt.on');
    const body = { id: f.dataset.id, answer: on ? on.dataset.v : '', note: f.querySelector('textarea').value };
    busy = true; f.classList.add('sending');
    try {
      const res = await fetch('answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.status);
      toast(body.answer ? 'Written into the .bl.org — Claude will read it' : 'Answer cleared');
      busy = false; document.activeElement && document.activeElement.blur(); await refresh(true);
    } catch (err) { toast('Not saved: ' + err.message); }
    finally { busy = false; f.classList.remove('sending'); }
  });

  $('#theme').onclick = () => {
    const r = document.documentElement, dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const cur = r.dataset.theme || (dark ? 'dark' : 'light'); r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  };
  refresh(false); setInterval(() => refresh(false), 4000);
})();
