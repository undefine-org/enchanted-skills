// live.js — the page listens to its file, and talks back to it.
// Polls /rev; when the .bl.org changed (an answer, an Emacs save, a
// `bl doc run`), swaps the body in place unless you are mid-answer.
(() => {
  const $ = s => document.querySelector(s);
  let rev = null, busy = false;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  const stamp = (s) => { $('#stamp').textContent = s; };
  const editing = () => { const a = document.activeElement; return a && a.tagName === 'TEXTAREA' && a.value.trim() !== (a.defaultValue || '').trim(); };

  // Each graph keeps its own navigation, including across a live doc refresh.
  const graphs = new Map();
  function paintGraph(g, focus = false) {
    const ids = Array.from(g.querySelectorAll('[data-view]'), v => v.dataset.view);
    if (!ids.length) return;
    let history = graphs.get(g.dataset.graph) || [];
    history = history.filter(id => ids.includes(id));
    if (!history.length) history = [g.dataset.start];
    graphs.set(g.dataset.graph, history);
    const here = history[history.length - 1];
    g.querySelectorAll('[data-view]').forEach(v => { v.hidden = v.dataset.view !== here; });
    g.querySelectorAll('.sg-map [data-sg-to]').forEach(b => {
      if (b.dataset.sgTo === here) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    g.querySelector('[data-sg-back]').disabled = history.length < 2;
    const active = Array.from(g.querySelectorAll('[data-view]')).find(v => v.dataset.view === here);
    g.querySelector('.sg-position').textContent = active.querySelector('h4').textContent;
    if (focus) active.querySelector('h4').focus({ preventScroll: true });
  }
  const paintGraphs = () => document.querySelectorAll('.screen-graph').forEach(g => paintGraph(g));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-sg-to],[data-sg-back],[data-sg-reset]');
    if (!b) return;
    const g = b.closest('.screen-graph');
    if (!g) return;
    const history = graphs.get(g.dataset.graph) || [g.dataset.start];
    if (b.hasAttribute('data-sg-reset')) graphs.set(g.dataset.graph, [g.dataset.start]);
    else if (b.hasAttribute('data-sg-back')) { if (history.length > 1) history.pop(); graphs.set(g.dataset.graph, history); }
    else if (history[history.length - 1] !== b.dataset.sgTo) graphs.set(g.dataset.graph, [...history, b.dataset.sgTo]);
    paintGraph(g, true);
  });

  async function refresh(force) {
    try {
      const r = await (await fetch('rev', { cache: 'no-store' })).json();
      stamp('live · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (rev === null) { rev = r.rev; if (!force) return; }
      if (r.rev === rev && !force) return;
      if (busy || editing()) return;
      const d = await (await fetch('doc', { cache: 'no-store' })).json();
      const y = scrollY; $('#doc').innerHTML = d.html; rev = d.rev; show(current); paintGraphs(); scrollTo(0, y);
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
  // ── sections as pages: the sidebar picks one, #all shows the whole file ──
  let current = null;
  const secs = () => Array.from(document.querySelectorAll('section.part[data-sec]'));
  const sectionOf = (el) => el && el.closest('section.part[data-sec]');
  function show(id) {
    const list = secs(); if (!list.length) return;
    const all = id === 'all';
    let target = null;
    if (!all) { const el = id && document.getElementById(id); target = el && el.matches('section.part') ? el : list[0]; }
    list.forEach(s => { s.hidden = !(all || s === target); });
    const head = $('header.doc'); if (head) head.hidden = !(all || target === list[0]);
    document.body.classList.toggle('all-mode', all);
    current = all ? 'all' : target.id;
    document.querySelectorAll('.side-item').forEach(i => i.classList.toggle('on', i.dataset.sec === current));
    document.querySelectorAll('.side-all').forEach(a => a.classList.toggle('on', all));
    document.querySelectorAll('nav.chips a').forEach(a => {
      const h = decodeURIComponent(a.getAttribute('href').slice(1)), el = document.getElementById(h);
      a.classList.toggle('on', all ? h === 'all' : !!(el && sectionOf(el) === target));
    });
  }
  function route(scroll) {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) { show(current); return; }
    if (h === 'all') { show('all'); if (scroll) scrollTo(0, 0); return; }
    const el = document.getElementById(h);
    if (el && el.matches('section.part')) { show(h); if (scroll) scrollTo(0, 0); return; }
    if (el) { const s = sectionOf(el); if (s && current !== 'all') show(s.id); if (scroll) el.scrollIntoView({ block: 'start' }); return; }
    show(current);
  }
  window.addEventListener('hashchange', () => route(true));
  document.addEventListener('keydown', (e) => {
    if (current === 'all' || e.target.closest('input,textarea,select,.screen-graph') || e.metaKey || e.ctrlKey || e.altKey) return;
    const list = secs(), i = list.findIndex(s => s.id === current);
    if (e.key === 'ArrowRight' && i < list.length - 1) location.hash = list[i + 1].id;
    if (e.key === 'ArrowLeft' && i > 0) location.hash = list[i - 1].id;
  });
  route(true);
  paintGraphs();

  refresh(false); setInterval(() => refresh(false), 4000);
})();
