// live.js — the page listens to its file, and talks back to it.
// Polls /rev; when the .bl.org changed (an answer, an Emacs save, a
// `bl doc run`), swaps the body in place unless you are mid-answer.
(() => {
  const $ = s => document.querySelector(s);
  let rev = null, busy = false;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  const stamp = (s) => { $('#stamp').textContent = s; };
  const editing = () => { if (document.querySelector('form.or-note-form[data-saving]') || document.querySelector('dialog[open]')) return true; const a = document.activeElement; if (a?.closest('.org-roster') && a.matches('input,textarea,select')) return true; return a && a.tagName === 'TEXTAREA' && a.value.trim() !== (a.defaultValue || '').trim(); };

  // Prototype navigation, inspection and expansion belong to each graph.
  // The same state survives a file refresh; no prototype action writes data.
  const graphs = new Map();
  const svgNS = 'http://www.w3.org/2000/svg';
  const viewsOf = g => Array.from(g.querySelectorAll('.sg-stage > [data-view]'));
  function graphState(g) {
    if (!graphs.has(g.dataset.graph)) graphs.set(g.dataset.graph, { history: [g.dataset.start], mode: g.dataset.initialMode === 'graph' ? 'graph' : 'screen', highlight: false, inspect: false, expanded: false, zoom: innerWidth < 720 ? .7 : .85 });
    return graphs.get(g.dataset.graph);
  }
  const svgEl = (name, attrs = {}) => {
    const el = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };
  function buildOverview(g) {
    if (g.dataset.built || !viewsOf(g).length) return;
    g.dataset.built = 'true';
    const views = viewsOf(g), byId = new Map(views.map(v => [v.dataset.view, v]));
    const links = [];
    views.forEach(v => {
      v.querySelectorAll('[data-sg-to]').forEach(b => {
        if (b.hasAttribute('data-sg-navigation')) return; // index/backlinks navigate without inventing semantic edges
        const target = byId.get(b.dataset.sgTo);
        if (!target) return;
        b.dataset.destination = target.dataset.title;
        if (!b.title) b.title = target.dataset.title;
        const existing = links.find(e => e.from === v.dataset.view && e.to === b.dataset.sgTo);
        const label = b.textContent.trim() || target.dataset.title;
        if (existing) { if (!existing.labels.includes(label)) existing.labels.push(label); }
        else links.push({ from: v.dataset.view, to: b.dataset.sgTo, labels: [label], nav: !!b.closest('.sg-app-nav') });
        if (existing && !b.closest('.sg-app-nav')) existing.nav = false;
      });
    });
    // Place screens by the shortest path through their actual content controls.
    // Persistent app navigation is available in the inspector without crowding
    // the graph with repeated sidebar routes.
    const levels = new Map([[g.dataset.start, 0]]), queue = [g.dataset.start];
    for (let i = 0; i < queue.length; i++) {
      links.filter(e => e.from === queue[i] && !e.nav).forEach(e => {
        if (!levels.has(e.to)) { levels.set(e.to, levels.get(e.from) + 1); queue.push(e.to); }
      });
    }
    const lastLevel = Math.max(0, ...levels.values()) + 1;
    views.forEach(v => { if (!levels.has(v.dataset.view)) levels.set(v.dataset.view, lastLevel); });
    const columns = new Map();
    levels.forEach((level, id) => { if (!columns.has(level)) columns.set(level, []); columns.get(level).push(id); });
    const rows = Math.max(...Array.from(columns.values(), c => c.length)), positions = new Map();
    columns.forEach((ids, column) => ids.forEach((id, row) => positions.set(id, { x: 42 + column * 310, y: 42 + row * 236 + (rows - ids.length) * 48 })));
    const canvas = g.querySelector('.sg-canvas'), nodes = g.querySelector('.sg-nodes'), wires = g.querySelector('.sg-wires');
    const width = 84 + (Math.max(...levels.values()) + 1) * 310, height = 90 + rows * 236;
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    wires.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const markerId = 'sg-arrow-' + g.dataset.graph.replace(/[^a-z0-9_-]/gi, '');
    const defs = svgEl('defs'), marker = svgEl('marker', { id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.append(svgEl('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'context-stroke' })); defs.append(marker); wires.append(defs);
    links.filter(e => !e.nav).forEach(e => {
      const a = positions.get(e.from), b = positions.get(e.to), forward = b.x > a.x;
      const x1 = a.x + (forward ? 230 : 115), y1 = a.y + (forward ? 86 : 180);
      const x2 = b.x + (forward ? 0 : 115), y2 = b.y + (forward ? 86 : 0);
      const path = forward ? `M${x1},${y1} C${x1 + 70},${y1} ${x2 - 70},${y2} ${x2},${y2}`
        : `M${x1},${y1} C${x1 + 70},${y1 + 72} ${x2 - 70},${y2 - 72} ${x2},${y2}`;
      const group = svgEl('g', { class: 'sg-wire', 'data-from': e.from, 'data-to': e.to });
      const hit = svgEl('path', { d: path, class: 'sg-wire-hit', 'data-sg-to': e.to, 'data-sg-from': e.from });
      const line = svgEl('path', { d: path, class: 'sg-wire-line', 'marker-end': `url(#${markerId})` });
      const title = svgEl('title'); title.textContent = e.labels.join(' · '); hit.append(title);
      const label = svgEl('text', {class: 'sg-wire-label', x: (x1 + x2) / 2 + (forward ? 0 : 32), y: (y1 + y2) / 2 - 8, 'text-anchor': 'middle'});
      label.textContent = e.labels[0];
      group.append(hit, line, label); wires.append(group);
    });
    views.forEach(v => {
      const id = v.dataset.view, at = positions.get(id), node = document.createElement('button');
      node.type = 'button'; node.className = 'sg-node'; node.dataset.sgTo = id;
      node.style.left = at.x + 'px'; node.style.top = at.y + 'px';
      const label = document.createElement('span'); label.className = 'sg-node-title'; label.textContent = v.dataset.title;
      const preview = document.createElement('span'); preview.className = 'sg-node-preview'; preview.setAttribute('aria-hidden', 'true');
      const clone = v.querySelector('.sg-app').cloneNode(true); clone.inert = true;
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      clone.querySelectorAll('[data-sg-to]').forEach(el => el.removeAttribute('data-sg-to'));
      clone.querySelectorAll('input,textarea,select').forEach(el => { el.removeAttribute('name'); el.disabled = true; });
      preview.append(clone);
      const count = document.createElement('span'); count.className = 'sg-node-count'; count.textContent = links.filter(e => e.from === id).length + ' connections';
      node.append(label, preview, count);
      node.addEventListener('mouseenter', () => markOverview(g, id));
      node.addEventListener('mouseleave', () => markOverview(g, graphState(g).history.at(-1)));
      node.addEventListener('focus', () => markOverview(g, id));
      nodes.append(node);
    });
    g._routes = links; g._graphSize = { width, height, positions };
    const scroller = g.querySelector('.sg-graph-scroll');
    if (scroller.dataset.dragBound) return;
    scroller.dataset.dragBound = 'true';
    let drag = null;
    scroller.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button,.sg-wire-hit')) return;
      drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      scroller.setPointerCapture(e.pointerId);
    });
    scroller.addEventListener('pointermove', e => { if (drag) { scroller.scrollLeft = drag.left - e.clientX + drag.x; scroller.scrollTop = drag.top - e.clientY + drag.y; } });
    scroller.addEventListener('pointerup', () => { drag = null; });
    scroller.addEventListener('pointercancel', () => { drag = null; });
  }
  function markOverview(g, id) {
    g.querySelectorAll('.sg-wire').forEach(e => e.classList.toggle('is-related', e.dataset.from === id));
    g.querySelectorAll('.sg-node').forEach(n => n.classList.toggle('is-current', n.dataset.sgTo === id));
  }
  function zoomGraph(g, command) {
    const size = g._graphSize; if (!size) return;
    const state = graphState(g), scroll = g.querySelector('.sg-graph-scroll');
    if (command === 'fit') state.zoom = Math.min(1, (scroll.clientWidth - 24) / size.width, (scroll.clientHeight - 24) / size.height);
    else if (command) state.zoom = Math.max(.15, Math.min(1.5, state.zoom + (command === 'in' ? .15 : -.15)));
    g.querySelector('.sg-canvas').style.transform = `scale(${state.zoom})`;
    const sizer = g.querySelector('.sg-graph-sizer'); sizer.style.width = size.width * state.zoom + 'px'; sizer.style.height = size.height * state.zoom + 'px';
    if (command === 'fit') scroll.scrollTo(0, 0);
  }
  function paintGraph(g, focus = false) {
    const views = viewsOf(g), ids = views.map(v => v.dataset.view);
    if (!ids.length) return;
    const state = graphState(g);
    state.history = state.history.filter(id => ids.includes(id));
    if (!state.history.length) state.history = [g.dataset.start];
    const here = state.history.at(-1), active = views.find(v => v.dataset.view === here), overview = state.mode === 'graph';
    views.forEach(v => { v.hidden = v !== active; });
    g.classList.toggle('sg-highlights', state.highlight); g.classList.toggle('sg-expanded', state.expanded); g.classList.toggle('sg-graph-mode', overview);
    g._componentState=state;g.classList.toggle('component-inspecting',!!state.inspect);if(!state.inspect)g.querySelector('.source-component-info').hidden=true;
    document.body.classList.toggle('sg-immersed', Array.from(graphs.values()).some(s => s.expanded));
    const workbench = g.querySelector('.sg-workbench');
    workbench.setAttribute('role', state.expanded ? 'dialog' : 'region');
    if (state.expanded) workbench.setAttribute('aria-modal', 'true'); else workbench.removeAttribute('aria-modal');
    g.querySelector('.sg-stage').hidden = overview;
    g.querySelector('.sg-overview').hidden = !overview;
    g.querySelector('[data-sg-back]').disabled = state.history.length < 2;
    [['highlight', state.highlight], ['mode', overview], ['inspect', !!state.inspect], ['expand', state.expanded]].forEach(([key, on]) => g.querySelector(`[data-sg-${key}]`).setAttribute('aria-pressed', String(on)));
    g.querySelector('[data-sg-mode]').setAttribute('aria-label', overview ? (g.dataset.graphLabel ? 'Return to detail' : 'Return to screen') : (g.dataset.graphLabel ? 'Show ' + g.dataset.graphLabel.toLowerCase() : 'Show screen graph'));
    g.querySelector('[data-sg-expand]').setAttribute('aria-label', state.expanded ? 'Exit full screen' : 'Expand prototype');
    g.querySelector('[data-sg-mode]').dataset.tip = overview ? (g.dataset.graphLabel ? 'Return to detail · G' : 'Return to screen · G') : (g.dataset.graphLabel || 'Screen graph') + ' · G';
    g.querySelector('[data-sg-expand]').dataset.tip = state.expanded ? 'Exit full screen · Esc' : 'Full screen · Esc to exit';
    g.querySelector('.sg-announcement').textContent = (overview ? 'Screen graph · ' : '') + active.dataset.title;
    buildOverview(g); zoomGraph(g); markOverview(g, here);
    const inspector = g.querySelector('.sg-graph-inspector'); inspector.replaceChildren();
    const caption = document.createElement('strong'); caption.textContent = active.dataset.title + ' →'; inspector.append(caption);
    (g._routes || []).filter(e => e.from === here).forEach(e => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.sgTo = e.to; button.dataset.sgFrom = e.from;
      button.textContent = e.labels.join(' / ') + ' → ' + views.find(v => v.dataset.view === e.to).dataset.title;
      inspector.append(button);
    });
    if (focus) {
      const el = overview ? g.querySelector('.sg-node.is-current') : active.querySelector('.d-title,.s-bar b');
      if (el && !el.matches('button')) el.setAttribute('tabindex', '-1');
      (el || workbench).focus({ preventScroll: true });
      if (overview && g._graphSize) {
        const at = g._graphSize.positions.get(here), scroll = g.querySelector('.sg-graph-scroll');
        scroll.scrollTo({left: Math.max(0, (at.x + 115) * state.zoom - scroll.clientWidth / 2), top: Math.max(0, (at.y + 90) * state.zoom - scroll.clientHeight / 2)});
      }
    }
  }
  const paintGraphs = () => document.querySelectorAll('.screen-graph').forEach(g => paintGraph(g));
  // Hosts that project record-dependent controls can refresh the actual graph
  // after rendering. History/mode/focus state stays with the existing graph.
  document.addEventListener('dossier:prototype-updated', e => {
    const g = e.target.closest?.('.screen-graph'); if (!g || g.classList.contains('screen-source')) return;
    g.querySelector('.sg-nodes').replaceChildren(); g.querySelector('.sg-wires').replaceChildren();
    delete g.dataset.built; paintGraph(g);
  });
  function expandGraph(g, on) {
    const state = graphState(g); state.expanded = on;
    if (on) { state.returnFocus = document.activeElement; state.scroll = scrollY; }
    paintGraph(g);
    if (on) g.querySelector('.sg-workbench').focus({ preventScroll: true });
    else { (state.returnFocus?.isConnected ? state.returnFocus : g.querySelector('[data-sg-expand]')).focus({ preventScroll: true }); scrollTo(0, state.scroll || 0); }
  }
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-sg-to],[data-sg-back],[data-sg-reset],[data-sg-highlight],[data-sg-mode],[data-sg-inspect],[data-sg-expand],[data-sg-zoom]');
    const g = button?.closest('.screen-graph');
    if (!g) return;
    e.preventDefault();
    const state = graphState(g);
    if (button.hasAttribute('data-sg-zoom')) { zoomGraph(g, button.dataset.sgZoom); return; }
    if (button.hasAttribute('data-sg-expand')) { expandGraph(g, !state.expanded); return; }
    if (button.hasAttribute('data-sg-inspect')) {state.inspect=!state.inspect;state.mode='screen';paintGraph(g);return;}
    if (button.hasAttribute('data-sg-highlight')) state.highlight = !state.highlight;
    else if (button.hasAttribute('data-sg-mode')) state.mode = state.mode === 'graph' ? 'screen' : 'graph';
    else if (button.hasAttribute('data-sg-reset')) { state.history = [g.dataset.start]; state.mode = 'screen'; }
    else if (button.hasAttribute('data-sg-back')) { if (state.history.length > 1) state.history.pop(); state.mode = 'screen'; }
    else {
      const from = button.dataset.sgFrom;
      if (from && state.history.at(-1) !== from) state.history.push(from);
      if (state.history.at(-1) !== button.dataset.sgTo) state.history.push(button.dataset.sgTo);
      state.mode = 'screen';
    }
    paintGraph(g, !button.hasAttribute('data-sg-highlight'));
  });
  document.addEventListener('keydown', e => {
    const g = document.querySelector('.sg-expanded') || e.target.closest('.screen-graph');
    if (!g || g.classList.contains('screen-source')) return;
    const editable = e.target.closest('input,textarea,select,[contenteditable]');
    if (editable && e.key === 'Enter' && e.target.closest('.sg-compose')) { e.preventDefault(); e.target.closest('.sg-compose').querySelector('[data-sg-to]')?.click(); return; }
    if (e.key === 'Escape' && graphState(g).inspect) {e.preventDefault();graphState(g).inspect=false;paintGraph(g);return;}
    if (e.key === 'Escape' && graphState(g).expanded) { e.preventDefault(); expandGraph(g, false); return; }
    if (!editable && !e.ctrlKey && !e.metaKey && !e.altKey && ['h', 'g', 'i'].includes(e.key.toLowerCase())) {
      e.preventDefault(); g.querySelector(e.key.toLowerCase() === 'h' ? '[data-sg-highlight]' : e.key.toLowerCase() === 'i' ? '[data-sg-inspect]' : '[data-sg-mode]').click();
    }
    if (e.key === 'Tab' && graphState(g).expanded) {
      const elements = Array.from(g.querySelector('.sg-workbench').querySelectorAll('button:not(:disabled),input,a[href],textarea,select,[contenteditable="true"],[tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[inert]'));
      if (!elements.length) return;
      if (e.shiftKey && (document.activeElement === elements[0] || !elements.includes(document.activeElement))) { e.preventDefault(); elements.at(-1).focus(); }
      else if (!e.shiftKey && (document.activeElement === elements.at(-1) || !elements.includes(document.activeElement))) { e.preventDefault(); elements[0].focus(); }
    }
  });

  async function refresh(force) {
    try {
      const r = await (await fetch('rev', { cache: 'no-store' })).json();
      stamp('live · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (rev === null) { rev = r.rev; if (!force) return; }
      if (r.rev === rev && !force) return;
      if (busy || editing()) return;
      const d = await (await fetch('doc' + location.search, { cache: 'no-store' })).json();
      const y = scrollY; $('#doc').innerHTML = d.html; rev = d.rev;
      const design = $('#doc .app2')?.dataset.design;
      if (design) document.documentElement.dataset.design = design;
      else delete document.documentElement.dataset.design;
      show(current); paintGraphs(); window.dossierNotebook?.apply(); scrollTo(0, y);
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
    if (f.classList.contains('sending')) return;
    busy = true; f.classList.add('sending');
    try {
      const res = await fetch('answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const text = await res.text();
      let j;
      try { j = text ? JSON.parse(text) : null; } catch { j = null; }
      if (!res.ok) throw new Error(j?.error || `The server returned HTTP ${res.status}. Your draft is still here; try again.`);
      if (!j || j.ok !== true || typeof j.rev !== 'string') throw new Error('The server did not confirm the save. Your draft is still here; try again.');
      toast(body.answer ? 'Written into the .bl.org — Claude will read it' : 'Answer cleared');
      busy = false; document.activeElement && document.activeElement.blur(); await refresh(true);
    } catch (err) { toast('Not saved: ' + err.message); }
    finally { busy = false; f.classList.remove('sending'); }
  });

  // ── the client's reading: the same file without its internal parts (dossier/audience.bl) ──
  const design = $('#design');
  if (design) design.onclick = () => {
    const url = new URL(location.href), on = url.searchParams.get('design') !== 'sober';
    url.searchParams.set('design', on ? 'sober' : 'warm-signal');
    history.replaceState(null, '', url); design.setAttribute('aria-pressed', String(on)); refresh(true);
  };
  const audience = $('#audience');
  if (audience) audience.onclick = () => {
    const url = new URL(location.href), on = url.searchParams.get('mode') !== 'client';
    if (on) url.searchParams.set('mode', 'client'); else url.searchParams.delete('mode');
    history.replaceState(null, '', url); audience.setAttribute('aria-pressed', String(on)); refresh(true);
  };
  $('#theme').onclick = () => {
    const r = document.documentElement, dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const cur = r.dataset.theme || (dark ? 'dark' : 'light'); r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  };
  // ── sections as pages: the sidebar picks one, #all shows the whole file ──
  let current = null;
  const secs = () => Array.from(document.querySelectorAll('section.part[data-sec]'));
  const sectionOf = (el) => el && el.closest('section.part[data-sec]');
  // A paged section (#+subpages: t) shows one subsection at a time; `sub` remembers which.
  let sub = null;
  const subsOf = (s) => Array.from(s ? s.querySelectorAll(':scope > .subpage') : []);
  function show(id, subId) {
    const list = secs(); if (!list.length) return;
    const all = id === 'all';
    let target = null;
    if (!all) { const el = id && document.getElementById(id); target = el && el.matches('section.part') ? el : list[0]; }
    list.forEach(s => { s.hidden = !(all || s === target); });
    const head = $('header.doc'); if (head) head.hidden = !(all || target === list[0]);
    document.body.classList.toggle('all-mode', all);
    current = all ? 'all' : target.id;
    const pages = subsOf(target);
    sub = all || !pages.length ? null : (pages.find(p => p.dataset.sub === subId) || pages.find(p => p.dataset.sub === sub) || pages[0]).dataset.sub;
    list.forEach(s => {
      subsOf(s).forEach(p => { p.hidden = !(all || (s === target && p.dataset.sub === sub)); });
      const lead = s.querySelector(':scope > .sub-lead'); if (lead) lead.hidden = !(all || (s === target && sub === subsOf(s)[0]?.dataset.sub));
    });
    document.querySelectorAll('.side-item').forEach(i => i.classList.toggle('on', i.dataset.sec === current));
    document.querySelectorAll('nav.subnav a').forEach(a => a.classList.toggle('on', !!sub && a.dataset.sub === sub && sectionOf(a) === target));
    document.querySelectorAll('.side-subs a').forEach(a => a.classList.toggle('on', !!sub && a.dataset.sub === sub && a.closest('.side-item')?.dataset.sec === current));
    document.querySelectorAll('.side-all').forEach(a => a.classList.toggle('on', all));
    document.querySelectorAll('nav.chips a').forEach(a => {
      const h = decodeURIComponent(a.getAttribute('href').slice(1)), el = document.getElementById(h);
      a.classList.toggle('on', all ? h === 'all' : !!(el && sectionOf(el) === target));
    });
  }
  // The pages a reader steps through with ←/→, in order: sections, or the subsections of a paged one.
  const pageList = () => secs().flatMap(s => { const p = subsOf(s); return p.length ? p.map(x => ({ sec: s.id, sub: x.dataset.sub })) : [{ sec: s.id, sub: null }]; });
  function route(scroll) {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) { show(current); return; }
    if (h === 'all') { show('all'); if (scroll) scrollTo(0, 0); return; }
    const el = document.getElementById(h);
    if (el && el.matches('section.part')) { show(h, null); if (scroll) scrollTo(0, 0); return; }
    const page = el && el.closest('.subpage');
    if (page && current !== 'all') { show(sectionOf(page).id, page.dataset.sub); if (scroll) (page.firstElementChild === el ? scrollTo(0, 0) : el.scrollIntoView({ block: 'start' })); return; }
    if (el) { const s = sectionOf(el); if (s && current !== 'all') show(s.id); if (scroll) el.scrollIntoView({ block: 'start' }); return; }
    show(current);
  }
  window.addEventListener('hashchange', () => route(true));
  document.addEventListener('keydown', (e) => {
    if (current === 'all' || e.target.closest('input,textarea,select,.screen-graph,.org-roster,[data-witness],[data-milestones],[data-claims],[data-lifetime]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const list = pageList(), i = list.findIndex(p => p.sec === current && p.sub === sub);
    const go = (p) => { location.hash = p.sub ? p.sub : p.sec; };
    if (e.key === 'ArrowRight' && i < list.length - 1) go(list[i + 1]);
    if (e.key === 'ArrowLeft' && i > 0) go(list[i - 1]);
  });
  route(true);
  paintGraphs();

  refresh(false); setInterval(() => refresh(false), 4000);
})();

// Source-hosted screen compositions expose real component roots. No component
// name, source or description is maintained here: metadata comes from the host.
(() => {
  const states = new Map(), metadata = new Map();
  const stateOf = g => { const id=g.dataset.sourceId; if(!states.has(id))states.set(id,{history:[],inspect:false,highlight:false,mode:'screen',expanded:false}); return states.get(id); };
  const safeURL = path => { const u=new URL(path,location.href); if(u.origin!==location.origin)throw Error('Screen tools require a same-origin URL'); return u; };
  function expand(g,on){const s=stateOf(g);s.expanded=on;g.classList.toggle('source-expanded',on);const box=g.querySelector('.source-workbench');box.setAttribute('role',on?'dialog':'region');if(on){s.focus=document.activeElement;box.setAttribute('aria-modal','true');box.focus()}else{box.removeAttribute('aria-modal');s.focus?.isConnected&&s.focus.focus()}g.querySelector('[data-source-expand]').setAttribute('aria-pressed',String(on));g.querySelector('[data-source-expand]').dataset.tip=on?'Full screen · Esc to exit':'Full screen';}
  function inspect(g,on){const s=stateOf(g);s.inspect=on;g.querySelector('[data-source-inspect]').setAttribute('aria-pressed',String(on));g.querySelector('.source-component-info').hidden=true;try{const d=g.querySelector('iframe').contentDocument;d.documentElement.classList.toggle('component-inspecting',on);d.querySelectorAll('.component-hit').forEach(e=>e.classList.remove('component-hit'));}catch{}}
  async function describe(g,el,event){
    const id=el.dataset.uiComponent,s=g.classList.contains('screen-source')?stateOf(g):g._componentState,info=g.querySelector('.source-component-info');s.target=id;s.element=el;
    const chain=[];for(let e=el;e;e=e.parentElement){if(e.dataset.uiComponent)chain.unshift(e.dataset.uiComponent);if(e.dataset.uiComposition)chain.unshift(e.dataset.uiComposition);}
    let meta={id,title:el.dataset.uiTitle||id,qualified:el.dataset.uiFunction||'Component',use:el.dataset.uiDeclaration?'Native dossier declaration: '+el.dataset.uiDeclaration:'Rendered by the screen host.'};
    try{const catalog=g.dataset.componentCatalog;if(catalog){const url=safeURL(catalog);url.searchParams.set('q','id:'+id);const key=url.href;if(!metadata.has(key))metadata.set(key,fetch(url).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json()}));const found=(await metadata.get(key)).find(e=>e.id===id);if(found)meta=found;}}catch{meta.use='Metadata is currently unavailable. The component remains selectable.'}
    if(s.target!==id||!s.inspect)return;
    info.replaceChildren();const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close component information');close.onclick=()=>{info.hidden=true};info.append(close);
    const title=document.createElement('strong');title.textContent=meta.title;info.append(title);const code=document.createElement('code');code.textContent=meta.qualified;info.append(code);
    const family=document.createElement('small');family.textContent=meta.family||'Component';info.append(family);const use=document.createElement('p');use.textContent=meta.use;info.append(use);
    if(meta.source){const src=document.createElement('code');src.textContent=meta.source+':'+meta.line;info.append(src)}
    if(meta.where){const p=document.createElement('p');p.textContent='Used in: '+meta.where.join(' · ');info.append(p)}
    if(meta.examples){const p=document.createElement('p');p.textContent='States: '+meta.examples.map(x=>x.state).join(' · ');info.append(p)}
    const parents=document.createElement('div');parents.className='component-parents';chain.forEach(id=>{const part=document.createElement('span');part.textContent=id;parents.append(part)});info.append(parents);
    if(g.dataset.componentExplorer){const a=document.createElement('a'),url=safeURL(g.dataset.componentExplorer);url.searchParams.set('q','id:'+id);url.hash='component-'+id;a.href=url.href;a.target='_blank';a.rel='noopener';a.textContent='Open in UI Explorer ↗';info.append(a)}
    const rect=g.querySelector('.source-frame')?.getBoundingClientRect()||{left:0,top:0};const x=rect.left+(event?.clientX||24),y=rect.top+(event?.clientY||40);info.hidden=false;info.style.left=Math.max(12,Math.min(innerWidth-info.offsetWidth-12,x+14))+'px';info.style.top=Math.max(12,Math.min(innerHeight-info.offsetHeight-12,y+14))+'px';
  }
  function attach(g){
    const frame=g.querySelector('iframe'),s=stateOf(g);let doc;
    try{doc=frame.contentDocument;if(!doc?.body)return;safeURL(frame.contentWindow.location.href)}catch{return}
    if(doc._componentTools)return;doc._componentTools=true;
    const style=doc.createElement('style');style.textContent='.component-inspecting [data-ui-component]{cursor:crosshair!important}.component-inspecting .component-hit{outline:2px solid var(--b-focus,#b56b30)!important;outline-offset:-2px!important}.component-inspecting .component-hit::after{pointer-events:none}.source-highlight-links [data-source-link]{outline:2px dashed var(--b-action,#a15822)!important;outline-offset:-2px;position:relative}.source-highlight-links [data-source-link]:hover::after,.source-highlight-links [data-source-link]:focus-visible::after{content:attr(data-source-destination);position:absolute;top:100%;left:0;z-index:1000;max-width:240px;padding:4px 7px;border-radius:4px;background:var(--b-rail,#1d2153);color:var(--b-rail-ink,#fff);font:12px/1.4 sans-serif;pointer-events:none;white-space:normal}';doc.head.append(style);
    const sync=()=>{const theme=document.documentElement.dataset.theme;if(theme)doc.documentElement.dataset.theme=theme;else delete doc.documentElement.dataset.theme};sync();const themeObserver=new MutationObserver(sync);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});frame.contentWindow.addEventListener('pagehide',()=>themeObserver.disconnect(),{once:true});
    const url=frame.contentWindow.location.href;if(s.history.at(-1)!==url)s.history.push(url);g.querySelector('[data-source-back]').disabled=s.history.length<2;
    const current=new URL(url).searchParams.get('view');const named=declaredViews(g).find(v=>v.id===current);g.querySelector('.source-current').textContent=named?.title||current||'Screen';markLinks(g,doc);highlight(g,!!s.highlight);
    const target=e=>e.target.closest?.('[data-ui-component]');
    doc.addEventListener('pointerover',e=>{if(!s.inspect)return;const el=target(e);if(!el||el===s.element)return;doc.querySelectorAll('.component-hit').forEach(x=>x.classList.remove('component-hit'));el.classList.add('component-hit');describe(g,el,e)});
    doc.addEventListener('focusin',e=>{if(s.inspect&&target(e))describe(g,target(e))});
    doc.addEventListener('click',e=>{if(!s.inspect)return;const el=target(e);if(!el)return;e.preventDefault();e.stopImmediatePropagation();if(g.dataset.componentExplorer){const url=safeURL(g.dataset.componentExplorer);url.searchParams.set('q','id:'+el.dataset.uiComponent);url.hash='component-'+el.dataset.uiComponent;window.open(url.href,'_blank','noopener')}describe(g,el,e)},true);
    doc.addEventListener('keydown',e=>{keyboardTools(g,e);if(s.expanded&&s.mode!=='graph'&&e.key==='Tab'){const nodes=[...doc.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select')].filter(x=>x.getClientRects().length);if((e.shiftKey&&doc.activeElement===nodes[0])||(!e.shiftKey&&doc.activeElement===nodes.at(-1))){e.preventDefault();const buttons=g.querySelectorAll('.sg-toolbar button:not(:disabled)');(e.shiftKey?buttons[buttons.length-1]:buttons[0]).focus()}}});

    s.element=null;inspect(g,s.inspect);
  }
  const declaredViews = g => [...g.querySelectorAll('[data-source-view-id]')].map(el => ({id:el.dataset.sourceViewId,title:el.dataset.sourceViewTitle}));
  function sourceURL(g,id) {
    const url=safeURL(g.dataset.sourceStart);url.searchParams.set('view',id);return url;
  }
  function destination(g,a) {
    if((a.getAttribute('href')||'').startsWith('#'))return null; // local evidence/context anchors do not change screens
    const base=safeURL(g.dataset.sourceStart),url=safeURL(a.href);
    if(url.pathname!==base.pathname)return null;
    return url.searchParams.get('view');
  }
  function markLinks(g,doc) {
    const titles=new Map(declaredViews(g).map(v=>[v.id,v.title]));
    doc.querySelectorAll('a[href]').forEach(a=>{
      try {
        const id=destination(g,a);if(!id)return;
        a.dataset.sourceLink=id;a.dataset.sourceDestination=titles.get(id)||id;
        if(!a.title)a.title=titles.get(id)||a.textContent.trim()||id;
      } catch {}
    });
    doc.documentElement.classList.toggle('source-highlight-links',!!stateOf(g).highlight);
  }
  function highlight(g,on) {
    stateOf(g).highlight=on;
    g.querySelector('[data-source-highlight]').setAttribute('aria-pressed',String(on));
    const frames=[g.querySelector('.source-frame'),...g.querySelectorAll('.source-thumbnail')];
    frames.forEach(f=>{try{markLinks(g,f.contentDocument)}catch{}});
  }
  function snapshot(g,id,doc) {
    markLinks(g,doc);
    const links=[];
    doc.querySelectorAll('a[data-source-link]').forEach(a=>{
      const to=a.dataset.sourceLink;
      if(to===id||!a.getClientRects().length)return;
      const ownText=[...a.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ');
      const label=(a.getAttribute('aria-label')||a.querySelector('.bd-name,b,.bd-label')?.textContent||ownText.trim()||a.innerText||a.textContent).trim().replace(/\s+/g,' ').slice(0,90);
      const nav=!!a.closest('nav');
      const existing=links.find(e=>e.to===to);
      if(existing){if(!existing.labels.includes(label))existing.labels.push(label);existing.nav&&=nav}
      else links.push({from:id,to,labels:[label||to],nav});
    });
    const clone=doc.documentElement.cloneNode(true);
    clone.querySelectorAll('script,base').forEach(e=>e.remove());
    clone.querySelectorAll('*').forEach(e=>{
      [...e.attributes].forEach(a=>{if(a.name.startsWith('on'))e.removeAttribute(a.name)});
    });
    clone.querySelectorAll('form').forEach(f=>{f.removeAttribute('action');f.removeAttribute('method')});
    clone.querySelectorAll('input,textarea,select').forEach(e=>e.removeAttribute('name'));
    clone.classList.remove('component-inspecting');clone.querySelectorAll('.component-hit').forEach(e=>e.classList.remove('component-hit'));
    return {id,html:'<!doctype html>'+clone.outerHTML,links};
  }
  function navigateSource(g,id) {
    mode(g,false);g.querySelector('.source-frame').src=sourceURL(g,id).href;
  }
  function paintSourceGraph(g,selected) {
    const state=stateOf(g),data=g._sourceData;if(!data)return;
    const here=selected||new URL(state.history.at(-1)||g.dataset.sourceStart,location.href).searchParams.get('view');
    g.querySelectorAll('.sg-node').forEach(n=>n.classList.toggle('is-current',n.dataset.sourceTo===here));
    g.querySelectorAll('.sg-wire').forEach(e=>e.classList.toggle('is-related',e.dataset.from===here));
    const inspector=g.querySelector('.sg-graph-inspector');inspector.replaceChildren();
    const title=document.createElement('strong');title.textContent=(data.titles.get(here)||here||'Screen')+' →';inspector.append(title);
    data.edges.filter(e=>e.from===here).forEach(e=>{
      const b=document.createElement('button');b.type='button';b.dataset.sourceTo=e.to;
      b.textContent=e.labels.join(' / ')+' → '+(data.titles.get(e.to)||e.to);inspector.append(b);
    });
  }
  function zoomSourceGraph(g,command) {
    const size=g._sourceSize;if(!size)return;
    const s=stateOf(g),scroll=g.querySelector('.sg-graph-scroll');
    if(command==='fit')s.zoom=Math.min(1,(scroll.clientWidth-24)/size.width,(scroll.clientHeight-24)/size.height);
    else if(command)s.zoom=Math.max(.15,Math.min(1.5,(s.zoom||.85)+(command==='in'?.15:-.15)));
    s.zoom||=.85;
    g.querySelector('.sg-canvas').style.transform=`scale(${s.zoom})`;
    const sizer=g.querySelector('.sg-graph-sizer');sizer.style.width=size.width*s.zoom+'px';sizer.style.height=size.height*s.zoom+'px';
    if(command==='fit')scroll.scrollTo(0,0);
  }
  function drawSourceGraph(g,data) {
    const svgNS='http://www.w3.org/2000/svg';
    const svgEl=(name,attrs={})=>{const e=document.createElementNS(svgNS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e};
    const ids=[...data.titles.keys()],start=new URL(g.dataset.sourceStart,location.href).searchParams.get('view')||ids[0];
    // Content transitions stay near their source; persistent navigation has a
    // longer distance and remains available in the connection inspector.
    const levels=new Map([[start,0]]),queue=[start];
    for(let i=0;i<queue.length;i++)data.edges.filter(e=>e.from===queue[i]).forEach(e=>{
      const next=levels.get(queue[i])+(e.nav?2:1);
      if(!levels.has(e.to)||next<levels.get(e.to)){levels.set(e.to,next);queue.push(e.to)}
    });
    const last=Math.max(0,...levels.values())+1;
    ids.forEach(id=>{if(!levels.has(id))levels.set(id,last)});
    const columns=new Map();ids.forEach(id=>{const l=levels.get(id);if(!columns.has(l))columns.set(l,[]);columns.get(l).push(id)});
    const rows=Math.max(1,...[...columns.values()].map(c=>c.length)),positions=new Map();
    columns.forEach((list,col)=>list.forEach((id,row)=>positions.set(id,{x:42+col*310,y:42+row*236+(rows-list.length)*36})));
    const width=84+(Math.max(...levels.values())+1)*310,height=90+rows*236;
    const canvas=g.querySelector('.sg-canvas'),nodes=g.querySelector('.sg-nodes'),wires=g.querySelector('.sg-wires');
    canvas.style.width=width+'px';canvas.style.height=height+'px';nodes.replaceChildren();wires.replaceChildren();wires.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const markerId='source-arrow-'+g.dataset.sourceId.replace(/[^a-z0-9_-]/gi,'');
    const defs=svgEl('defs'),marker=svgEl('marker',{id:markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});
    marker.append(svgEl('path',{d:'M0 0 L10 5 L0 10 z',fill:'context-stroke'}));defs.append(marker);wires.append(defs);
    data.edges.filter(e=>!e.nav).forEach(e=>{
      const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return;
      const forward=b.x>a.x,x1=a.x+(forward?230:115),y1=a.y+(forward?86:186),x2=b.x+(forward?0:115),y2=b.y+(forward?86:0);
      const path=forward?`M${x1},${y1} C${x1+70},${y1} ${x2-70},${y2} ${x2},${y2}`:`M${x1},${y1} C${x1+100},${y1+62} ${x2-100},${y2-62} ${x2},${y2}`;
      const group=svgEl('g',{class:'sg-wire','data-from':e.from,'data-to':e.to});
      const hit=svgEl('path',{d:path,class:'sg-wire-hit','data-source-to':e.to,tabindex:'0',role:'link','aria-label':e.labels.join(' · ')+' → '+data.titles.get(e.to)});
      const line=svgEl('path',{d:path,class:'sg-wire-line','marker-end':`url(#${markerId})`});
      const title=svgEl('title');title.textContent=e.labels.join(' · ');hit.append(title);
      const label=svgEl('text',{class:'sg-wire-label',x:(x1+x2)/2+(forward?0:32),y:(y1+y2)/2-8,'text-anchor':'middle'});label.textContent=e.labels[0];
      group.append(hit,line,label);wires.append(group);
    });
    ids.forEach(id=>{
      const at=positions.get(id),node=document.createElement('button');node.type='button';node.className='sg-node';node.dataset.sourceTo=id;node.style.left=at.x+'px';node.style.top=at.y+'px';
      const title=document.createElement('span');title.className='sg-node-title';title.textContent=data.titles.get(id);
      const preview=document.createElement('span');preview.className='sg-node-preview';preview.setAttribute('aria-hidden','true');
      const shot=data.snapshots.get(id);
      if(shot){const thumb=document.createElement('iframe');thumb.className='source-thumbnail';thumb.tabIndex=-1;thumb.inert=true;thumb.setAttribute('aria-hidden','true');thumb.setAttribute('sandbox','allow-same-origin');thumb.srcdoc=shot.html;
        thumb.addEventListener('load',()=>{try{const theme=document.documentElement.dataset.theme;if(theme)thumb.contentDocument.documentElement.dataset.theme=theme;else delete thumb.contentDocument.documentElement.dataset.theme;markLinks(g,thumb.contentDocument)}catch{}});preview.append(thumb)}
      else {const missing=document.createElement('span');missing.textContent='Preview unavailable';preview.append(missing)}
      const count=document.createElement('span');count.className='sg-node-count';count.textContent=data.edges.filter(e=>e.from===id).length+' connections';
      node.append(title,preview,count);node.addEventListener('pointerenter',()=>paintSourceGraph(g,id));node.addEventListener('focus',()=>paintSourceGraph(g,id));nodes.append(node);
    });
    g._sourceSize={width,height};g._sourceData=data;zoomSourceGraph(g,stateOf(g).fitted?'':'fit');stateOf(g).fitted=true;paintSourceGraph(g);
    const scroll=g.querySelector('.sg-graph-scroll');if(!scroll._sourceDrag){scroll._sourceDrag=true;let drag=null;
      scroll.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,.sg-wire-hit'))return;drag={x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop};scroll.setPointerCapture(e.pointerId)});
      scroll.addEventListener('pointermove',e=>{if(drag){scroll.scrollLeft=drag.left-e.clientX+drag.x;scroll.scrollTop=drag.top-e.clientY+drag.y}});
      ['pointerup','pointercancel'].forEach(type=>scroll.addEventListener(type,()=>drag=null));
    }
  }
  async function buildSourceGraph(g) {
    if(g._sourceBuilding)return g._sourceBuilding;
    const work=async()=>{
      const titles=new Map(declaredViews(g).map(v=>[v.id,v.title])),snapshots=new Map(),queue=[...titles.keys()],seen=new Set(),errors=[];
      const status=g.querySelector('[data-source-progress]');
      async function load(id) {
        const frame=document.createElement('iframe');frame.className='source-discovery-frame';frame.tabIndex=-1;frame.inert=true;frame.setAttribute('aria-hidden','true');frame.src=sourceURL(g,id).href;
        try {
          await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Screen timed out')),12000);frame.onload=()=>{clearTimeout(timer);resolve()};frame.onerror=()=>{clearTimeout(timer);reject(Error('Screen could not load'))};g.querySelector('.source-workbench').append(frame)});
          const doc=frame.contentDocument;if(!doc?.body)throw Error('Screen unavailable');
          const shot=snapshot(g,id,doc);snapshots.set(id,shot);
          shot.links.forEach(e=>{if(!titles.has(e.to)&&titles.size<48){titles.set(e.to,e.labels[0]||e.to);queue.push(e.to)}});
        } catch {errors.push(titles.get(id)||id)} finally {frame.remove()}
      }
      while(queue.some(id=>!seen.has(id))){const batch=queue.filter(id=>!seen.has(id)).slice(0,2);batch.forEach(id=>seen.add(id));await Promise.all(batch.map(load));if(!g.isConnected)return;status.textContent=`Reading actual screens · ${snapshots.size} / ${titles.size}`}
      const edges=[...snapshots.values()].flatMap(s=>s.links).filter(e=>titles.has(e.to));
      drawSourceGraph(g,{titles,snapshots,edges});status.textContent=`${titles.size} screens · ${edges.length} connections${errors.length?' · unavailable: '+errors.join(', '):''}`;
    };
    g._sourceBuilding=work().catch(()=>{g.querySelector('[data-source-progress]').textContent='Could not read the screen graph. Toggle Graph to retry.';g._sourceBuilding=null});return g._sourceBuilding;
  }
  function mode(g,on) {
    const state=stateOf(g);state.mode=on?'graph':'screen';
    g.classList.toggle('source-graph-mode',on);g.querySelector('.source-frame').hidden=on;g.querySelector('.source-overview').hidden=!on;
    const b=g.querySelector('[data-source-mode]');b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Return to screen':'Explore graph');b.title=on?'Return to screen · G':'Explore graph · G';b.dataset.tip=b.title;
    g.querySelector('.source-component-info').hidden=true;
    if(on){if(g._sourceData){zoomSourceGraph(g);paintSourceGraph(g)}else buildSourceGraph(g)}
  }
  function keyboardTools(g,e) {
    const s=stateOf(g),editable=e.target.closest('input,textarea,select,[contenteditable]');
    if(e.key==='Escape'){e.preventDefault();if(s.inspect)inspect(g,false);else if(s.expanded)expand(g,false);else if(s.mode==='graph')mode(g,false);return}
    if(!editable&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      const key=e.key.toLowerCase();if(['h','g','i'].includes(key)){e.preventDefault();if(key==='h')highlight(g,!s.highlight);if(key==='g')mode(g,s.mode!=='graph');if(key==='i'){mode(g,false);inspect(g,!s.inspect)}return}
    }
    if(s.expanded&&s.mode==='graph'&&e.key==='Tab'){
      const list=[...g.querySelector('.source-workbench').querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[inert]'));
      if(e.shiftKey&&(document.activeElement===list[0]||!list.includes(document.activeElement))){e.preventDefault();list.at(-1)?.focus()}
      else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus()}
    }
  }

  function init(){document.querySelectorAll('.screen-source').forEach(g=>{if(g._sourceBound)return;g._sourceBound=true;const s=stateOf(g),frame=g.querySelector('.source-frame');frame.addEventListener('load',()=>attach(g));if(s.history.length)frame.src=s.history.at(-1);attach(g);expand(g,s.expanded);mode(g,s.mode==='graph');highlight(g,!!s.highlight)})}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-source-back],[data-source-reset],[data-source-inspect],[data-source-highlight],[data-source-mode],[data-source-expand],[data-source-to],[data-source-zoom]');
    if(!b)return;const g=b.closest('.screen-source');if(!g)return;
    const s=stateOf(g),f=g.querySelector('.source-frame');e.preventDefault();
    if(b.hasAttribute('data-source-to')){navigateSource(g,b.dataset.sourceTo);return}
    if(b.hasAttribute('data-source-zoom')){zoomSourceGraph(g,b.dataset.sourceZoom);return}
    if(b.hasAttribute('data-source-mode'))mode(g,s.mode!=='graph');
    if(b.hasAttribute('data-source-highlight'))highlight(g,!s.highlight);
    if(b.hasAttribute('data-source-inspect')){mode(g,false);inspect(g,!s.inspect)}
    if(b.hasAttribute('data-source-expand')){expand(g,!s.expanded);if(s.mode==='graph')zoomSourceGraph(g)}
    if(b.hasAttribute('data-source-reset')){s.history=[];mode(g,false);f.src=g.dataset.sourceStart}
    if(b.hasAttribute('data-source-back')){mode(g,false);if(s.history.length>1){s.history.pop();f.src=s.history.pop()}}
  });
  document.addEventListener('keydown',e=>{
    const g=document.querySelector('.source-expanded')||e.target.closest('.screen-source');if(!g)return;
    if(e.target.matches('.sg-wire-hit[data-source-to]')&&['Enter',' '].includes(e.key)){e.preventDefault();navigateSource(g,e.target.dataset.sourceTo);return}
    keyboardTools(g,e);const s=stateOf(g);
    if(s.expanded&&s.mode!=='graph'&&e.key==='Tab'){const controls=[...g.querySelectorAll('.sg-toolbar button:not(:disabled)')];if((!e.shiftKey&&document.activeElement===controls.at(-1))||(e.shiftKey&&document.activeElement===controls[0])){e.preventDefault();const f=g.querySelector('.source-frame');const nodes=[...f.contentDocument.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select')].filter(x=>x.getClientRects().length);(e.shiftKey?nodes.at(-1):nodes[0])?.focus()}}
  });
  document.addEventListener('dossier:prototype-updated',e=>{const g=e.target.closest?.('.screen-source');if(!g)return;g._sourceData=null;g._sourceBuilding=null;if(stateOf(g).mode==='graph')buildSourceGraph(g)});
  new MutationObserver(()=>{document.querySelectorAll('.screen-source').forEach(g=>g.querySelectorAll('.source-thumbnail').forEach(f=>{try{const theme=document.documentElement.dataset.theme;if(theme)f.contentDocument.documentElement.dataset.theme=theme;else delete f.contentDocument.documentElement.dataset.theme}catch{}}))}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  const nativePart=e=>{const el=e.target.closest?.('[data-ui-component]'),g=el?.closest('.screen-graph:not(.screen-source)');return g&&g._componentState?.inspect&&g._componentState.mode==='screen'&&!el.closest('.sg-node-preview')?{g,el}:null};
  document.addEventListener('pointerover',e=>{const part=nativePart(e);if(!part)return;const {g,el}=part;if(g._componentState.element===el)return;g.querySelectorAll('.component-hit').forEach(x=>x.classList.remove('component-hit'));el.classList.add('component-hit');describe(g,el,e)});
  document.addEventListener('focusin',e=>{const part=nativePart(e);if(part)describe(part.g,part.el,e)});
  document.addEventListener('click',e=>{const part=nativePart(e);if(!part)return;e.preventDefault();e.stopImmediatePropagation();describe(part.g,part.el,e)},true);
  new MutationObserver(init).observe(document.body,{childList:true,subtree:true});init();
})();

// Native Scenario Runner witnesses retain their selected claim over live refresh.
(() => {
  const selections = new Map();
  function select(root, step, focus = false) {
    const buttons = [...root.querySelectorAll('[data-witness-step]')];
    const picked = buttons.find(b => b.dataset.witnessStep === step) || buttons[0];
    if (!picked) return;
    const index = buttons.indexOf(picked);
    selections.set(root.dataset.witness, picked.dataset.witnessStep);
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === picked)));
    root.querySelectorAll('[data-witness-stage]').forEach(s => s.hidden = s.dataset.witnessStage !== picked.dataset.witnessStep);
    root.querySelector('[data-witness-position]').textContent = `${index + 1} / ${buttons.length}`;
    root.querySelector('[data-witness-move="-1"]').disabled = index === 0;
    root.querySelector('[data-witness-move="1"]').disabled = index === buttons.length - 1;
    if (focus) picked.focus({preventScroll:true});
  }
  function init() {
    document.querySelectorAll('[data-witness]').forEach(root => {
      if (root._witnessReady) return;
      root._witnessReady = true;
      select(root, selections.get(root.dataset.witness));
      root.querySelectorAll('[data-epoch]').forEach(t => {
        const d = new Date(Number(t.dataset.epoch));
        if (!Number.isNaN(d.getTime())) { t.dateTime = d.toISOString(); t.textContent = d.toLocaleString(); }
      });
    });
  }
  document.addEventListener('click', e => {
    const control = e.target.closest('[data-witness-step],[data-witness-move]');
    if (!control) return;
    const root = control.closest('[data-witness]');
    if (control.hasAttribute('data-witness-step')) select(root, control.dataset.witnessStep);
    else {
      const buttons = [...root.querySelectorAll('[data-witness-step]')];
      const i = buttons.findIndex(b => b.getAttribute('aria-pressed') === 'true');
      const next = buttons[i + Number(control.dataset.witnessMove)];
      if (next) select(root, next.dataset.witnessStep);
    }
  });
  document.addEventListener('keydown', e => {
    const root = e.target.closest('[data-witness]');
    if (!root || e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    const buttons = [...root.querySelectorAll('[data-witness-step]')];
    const i = buttons.findIndex(b => b.getAttribute('aria-pressed') === 'true');
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : Math.max(0,Math.min(buttons.length - 1,i + (e.key === 'ArrowRight' ? 1 : -1)));
    if (buttons[n]) { e.preventDefault(); select(root, buttons[n].dataset.witnessStep, true); }
  });
  document.addEventListener('error', e => {
    const img = e.target;
    if (!img.matches?.('[data-witness-image]')) return;
    const note = document.createElement('p'); note.className = 'witness-no-frame'; note.textContent = 'Recorded frame unavailable.';
    img.closest('a').replaceWith(note);
  }, true);
  new MutationObserver(init).observe(document.body,{childList:true,subtree:true});
  init();
})();

// Milestones are an authored map; selecting one never approves or starts work.
(() => {
  const selections = new Map();
  function select(root, id, focus = false) {
    const details = [...root.querySelectorAll('[data-milestone-detail]')];
    const picked = details.find(d => d.dataset.milestoneDetail === id) || details[0];
    if (!picked) return;
    const key = picked.dataset.milestoneDetail, i = details.indexOf(picked);
    selections.set(root.dataset.milestones, key);
    details.forEach(d => d.hidden = d !== picked);
    root.querySelectorAll('.ms-map [data-milestone-to]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.milestoneTo === key)));
    root.querySelector('[data-milestone-move="-1"]').disabled = i === 0;
    root.querySelector('[data-milestone-move="1"]').disabled = i === details.length - 1;
    if (focus) { picked.focus({preventScroll:true}); if (innerWidth < 701) picked.scrollIntoView({block:'start'}); }
  }
  function init() {
    document.querySelectorAll('[data-milestones]').forEach(root => {
      if (root._milestonesReady) return;
      root._milestonesReady = true;
      select(root, selections.get(root.dataset.milestones) || root.dataset.milestoneStart);
    });
  }
  document.addEventListener('click', e => {
    const control = e.target.closest('[data-milestone-to],[data-milestone-move],[data-milestone-map]');
    if (!control) return;
    const root = control.closest('[data-milestones]'); if (!root) return;
    if (control.hasAttribute('data-milestone-to')) select(root, control.dataset.milestoneTo, true);
    else if (control.hasAttribute('data-milestone-map')) root.querySelector('.ms-map button[aria-pressed=true]')?.focus();
    else {
      const details = [...root.querySelectorAll('[data-milestone-detail]')];
      const i = details.findIndex(d => !d.hidden), next = details[i + Number(control.dataset.milestoneMove)];
      if (next) select(root, next.dataset.milestoneDetail, true);
    }
  });
  document.addEventListener('keydown', e => {
    const root = e.target.closest('[data-milestones]');
    if (!root || e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    const details = [...root.querySelectorAll('[data-milestone-detail]')], i = details.findIndex(d => !d.hidden);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? details.length - 1 : Math.max(0,Math.min(details.length-1,i+(e.key==='ArrowRight'?1:-1)));
    if (details[n]) { e.preventDefault(); select(root, details[n].dataset.milestoneDetail, true); }
  });
  new MutationObserver(init).observe(document.body,{childList:true,subtree:true}); init();
})();

// A settings review keeps the page the reader selected when evidence refreshes.
(() => {
  const selected = new Map();
  function init() {
    document.querySelectorAll('.settings-pages').forEach(root => {
      if (root._settingsPageReady) return;
      root._settingsPageReady = true;
      const id = selected.get(root.id), input = [...root.querySelectorAll('input.sp-choice')].find(i => i.id === id);
      if (input) input.checked = true;
    });
  }
  document.addEventListener('change', e => {
    if (!e.target.matches('input.sp-choice')) return;
    const root = e.target.closest('.settings-pages'); if (root) selected.set(root.id,e.target.id);
  });
  new MutationObserver(init).observe(document.body,{childList:true,subtree:true}); init();
})();

// Claims: phase/desk filters are local and survive refresh; a screen chip opens
// that same-origin view in a dialog and returns focus to the chip on close.
(() => {
  const filters = new Map();
  let opener = null;
  const stateOf = root => { if (!filters.has(root.dataset.claims)) filters.set(root.dataset.claims, {phase: '', desk: '', open: false}); return filters.get(root.dataset.claims); };
  function apply(root) {
    const s = stateOf(root), rows = [...root.querySelectorAll('.cl-row')];
    let shown = 0;
    rows.forEach(r => {
      const ok = (!s.phase || r.dataset.phase === s.phase) && (!s.desk || r.dataset.desks.split('|').includes(s.desk)) && (!s.open || r.dataset.open === '1');
      r.hidden = !ok; if (ok) shown++;
    });
    root.querySelectorAll('[data-claims-group]').forEach(g => { g.hidden = !g.querySelector('.cl-row:not([hidden])'); });
    root.querySelectorAll('[data-claims-filter]').forEach(b => {
      const k = b.dataset.claimsFilter;
      b.setAttribute('aria-pressed', String(k === 'open' ? s.open : s[k] === b.dataset.value));
    });
    const out = root.querySelector('[data-claims-showing]');
    if (out) out.textContent = `${shown} / ${rows.length} ${out.dataset.claimsShowing}`;
    const empty = root.querySelector('.cl-empty'); if (empty) empty.hidden = shown > 0;
  }
  function frameURL(root, view) {
    const url = new URL(root.dataset.claimsSrc, location.href);
    if (url.origin !== location.origin) throw Error('Claim screens must be same-origin');
    url.searchParams.set('view', view); return url;
  }
  function showView(root, dlg, view) {
    const url = frameURL(root, view), f = dlg.querySelector('iframe');
    f.src = url.href; f.title = view; dlg.querySelector('.cl-dlg-out').href = url.href;
    dlg.querySelectorAll('[data-claims-switch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.claimsSwitch === view)));
  }
  function openView(root, button) {
    const dlg = root.querySelector('dialog.cl-dialog'), row = button.closest('.cl-row');
    if (!dlg || !row) return;
    opener = {root: root.dataset.claims, claim: button.dataset.claim, view: button.dataset.claimsView};
    dlg.querySelector('[data-claims-dlg-id]').textContent = button.dataset.claim;
    dlg.querySelector('[data-claims-dlg-text]').textContent = row.querySelector('.cl-text').textContent;
    const nav = dlg.querySelector('.cl-dlg-views');
    nav.replaceChildren(...[...row.querySelectorAll('[data-claims-view]')].map(b => {
      const x = document.createElement('button'); x.type = 'button'; x.dataset.claimsSwitch = b.dataset.claimsView; x.textContent = b.querySelector('span')?.textContent || b.dataset.claimsView; return x;
    }));
    nav.hidden = nav.children.length < 2;
    showView(root, dlg, button.dataset.claimsView);
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('[data-claims-close]').focus();
  }
  function init() {
    document.querySelectorAll('[data-claims]').forEach(root => {
      if (root._claimsReady) return;
      root._claimsReady = true; apply(root);
      const dlg = root.querySelector('dialog.cl-dialog'); if (!dlg) return;
      const f = dlg.querySelector('iframe');
      f.addEventListener('load', () => { try { const t = document.documentElement.dataset.theme, d = f.contentDocument; if (t) d.documentElement.dataset.theme = t; else delete d.documentElement.dataset.theme; } catch {} });
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', () => {
        f.src = 'about:blank';
        const o = opener; opener = null; if (!o) return;
        const r = document.querySelector(`[data-claims="${CSS.escape(o.root)}"]`);
        r?.querySelector(`[data-claim="${CSS.escape(o.claim)}"][data-claims-view="${CSS.escape(o.view)}"]`)?.focus();
      });
    });
  }
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-claims-filter],[data-claims-view],[data-claims-switch],[data-claims-close]');
    const root = c?.closest('[data-claims]'); if (!root) return;
    if (c.hasAttribute('data-claims-close')) { c.closest('dialog').close(); return; }
    if (c.hasAttribute('data-claims-switch')) { if (opener) opener.view = c.dataset.claimsSwitch; showView(root, c.closest('dialog'), c.dataset.claimsSwitch); return; }
    if (c.hasAttribute('data-claims-view')) { openView(root, c); return; }
    const s = stateOf(root), k = c.dataset.claimsFilter;
    if (k === 'open') s.open = !s.open; else s[k] = s[k] === c.dataset.value ? '' : c.dataset.value;
    apply(root);
  });
  new MutationObserver(init).observe(document.body, {childList: true, subtree: true}); init();
})();

// Lifetime: selecting a span, handoff or marker shows its detail under the
// timeline, with a caret at the control. The selection survives refresh.
(() => {
  const picked = new Map(), opened = new Map();
  function select(root, id, from) {
    const key = root.dataset.lifetime;
    if (id) picked.set(key, id); else picked.delete(key);
    root.querySelectorAll('[data-lt-item]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ltItem === id)));
    let card = null;
    root.querySelectorAll('[data-lt-detail]').forEach(d => { d.hidden = d.dataset.ltDetail !== id; if (!d.hidden) card = d; });
    const scroll = root.querySelector('.lt-scroll'), mark = id && scroll?.querySelector(`[data-lt-item="${CSS.escape(id)}"]`);
    if (!card || !mark) return;
    if (from === 'list') {
      const sr = scroll.getBoundingClientRect(), mr = mark.getBoundingClientRect(), labels = root.querySelector('.lt-labels')?.offsetWidth || 0;
      if (mr.left < sr.left + labels || mr.left > sr.right - 40) scroll.scrollBy({left: mr.left - sr.left - labels - 24, behavior: 'smooth'});
      setTimeout(() => caret(root), 350);
    }
    caret(root);
  }
  function caret(root) {
    const id = picked.get(root.dataset.lifetime), card = id && root.querySelector(`[data-lt-detail="${CSS.escape(id)}"]`);
    const mark = id && root.querySelector(`.lt-scroll [data-lt-item="${CSS.escape(id)}"]`);
    if (!card || !mark || card.hidden) return;
    const cr = card.getBoundingClientRect(), mr = mark.getBoundingClientRect(), sr = root.querySelector('.lt-scroll').getBoundingClientRect();
    const labels = root.querySelector('.lt-labels')?.offsetWidth || 0;
    const x = Math.max(sr.left + labels, Math.min(sr.right, mark.matches('.lt-span') ? Math.max(mr.left, sr.left + labels) + 18 : mr.left + mr.width / 2));
    card.style.setProperty('--caret', Math.max(14, Math.min(cr.width - 14, x - cr.left)) + 'px');
  }
  function init() {
    document.querySelectorAll('[data-lifetime]').forEach(root => {
      if (root._lifetimeReady) return;
      root._lifetimeReady = true;
      const key = root.dataset.lifetime, facts = root.querySelector('.lt-facts');
      if (facts) { facts.open = opened.has(key) ? opened.get(key) : innerWidth < 701; facts.addEventListener('toggle', () => opened.set(key, facts.open)); }
      root.querySelector('.lt-scroll')?.addEventListener('scroll', () => caret(root), {passive: true});
      select(root, picked.get(key));
    });
  }
  const ordered = root => [...root.querySelectorAll('.lt-facts [data-lt-item]')].map(b => b.dataset.ltItem);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lt-item]'), root = b?.closest('[data-lifetime]'); if (!root) return;
    const id = b.dataset.ltItem, again = picked.get(root.dataset.lifetime) === id;
    select(root, again ? null : id, b.closest('.lt-facts') ? 'list' : 'track');
  });
  document.addEventListener('keydown', e => {
    const root = e.target.closest?.('[data-lifetime]');
    if (!root || e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input,textarea,select')) return;
    if (e.key === 'Escape' && picked.has(root.dataset.lifetime)) { e.preventDefault(); select(root, null); return; }
    if (!e.target.matches('[data-lt-item]') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const ids = ordered(root), i = ids.indexOf(e.target.dataset.ltItem), next = ids[i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    const inList = !!e.target.closest('.lt-facts');
    select(root, next, inList ? 'list' : 'track');
    root.querySelector(`${inList ? '.lt-facts' : '.lt-scroll'} [data-lt-item="${CSS.escape(next)}"]`)?.focus();
  });
  addEventListener('resize', () => document.querySelectorAll('[data-lifetime]').forEach(caret));
  new MutationObserver(init).observe(document.body, {childList: true, subtree: true}); init();
})();

// Semantic notebook: the page carries a closed model (inputs, formulas as small
// expressions, people, claims). Switching scenario or moving a slider recomputes
// every figure here; clicking a figure opens its formula, term by term, down to
// the assumption, the person who can confirm it and the claim it stands on.
// Nothing is written to the file; adjustments stay in this browser.
(() => {
  let M = null, sig = null, V = {}, ALL = {}; const st = { scenario: null, over: {} };
  const split = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = () => 'nb:' + location.pathname;
  const fr = () => M?.lang === 'fr';
  const t = (en, f) => fr() ? f : en;
  const nf = (v, d) => new Intl.NumberFormat(fr() ? 'fr-FR' : 'en-GB', { maximumFractionDigits: d }).format(v);
  const sig2 = v => { if (!v) return 0; const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1); return Math.round(v / p) * p; };
  function fmt(kind, v) {
    if (v == null || !Number.isFinite(v)) return t('to measure', 'à mesurer');
    const a = Math.abs(v), sign = v < 0 ? '−' : '', d = a < 10 ? 1 : 0;
    switch (kind) {
      case 'mad': return a >= 1e6 ? sign + nf(Math.abs(sig2(v)) / 1e6, 1) + ' MMAD' : a >= 1e3 ? sign + nf(Math.abs(sig2(v)) / 1e3, 0) + ' kMAD' : sign + nf(a, 0) + ' MAD';
      case 'mad1': return a >= 1e6 ? sign + nf(a / 1e6, 1) + ' MMAD' : a >= 1e3 ? sign + nf(a / 1e3, 0) + ' kMAD' : sign + nf(a, 0) + ' MAD';
      case 'hours': return sign + nf(a >= 100 ? Math.round(a / 10) * 10 : a, d) + ' h';
      case 'days': return sign + nf(a, d) + t(' d', ' j');
      case 'months': return sign + nf(a, d) + t(' mo', ' mois');
      case 'pct': return sign + nf(a, d) + ' %';
      case 'share': return sign + nf(a * 100, a < 0.001 ? 1 : 0) + ' %';
      case 'ratio': return sign + nf(a, a < 10 ? 2 : 1);
      default: return sign + nf(a, d);
    }
  }
  // the same closed arithmetic as dossier.notebook/parse
  const tokens = s => String(s || '').match(/\d+(?:[.,]\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/×÷−(),]/g) || [];
  function parse(s) {
    const ts = tokens(s); let i = 0;
    const atom = () => { const x = ts[i];
      if (x == null) throw Error('end');
      if (/^\d/.test(x)) { i++; return { num: Number(x.replace(',', '.')) }; }
      if (x === '-' || x === '−') { i++; return { op: '-', a: { num: 0 }, b: atom() }; }
      if (x === '(') { i++; const a = sum(); if (ts[i++] !== ')') throw Error(')'); return a; }
      if ((x === 'min' || x === 'max') && ts[i + 1] === '(') { i += 2; const args = [sum()]; while (ts[i] === ',') { i++; args.push(sum()); } if (ts[i++] !== ')') throw Error(')'); return { fn: x, args }; }
      if (/^[A-Za-z_]/.test(x)) { i++; return { ref: x }; }
      throw Error(x); };
    const product = () => { let a = atom(); while (['*', '×', '/', '÷'].includes(ts[i])) { const o = ts[i++]; a = { op: o === '*' || o === '×' ? '×' : '÷', a, b: atom() }; } return a; };
    const sum = () => { let a = product(); while (['+', '-', '−'].includes(ts[i])) { const o = ts[i++]; a = { op: o === '+' ? '+' : '-', a, b: product() }; } return a; };
    const n = sum(); if (i < ts.length) throw Error(ts[i]); return n;
  }
  const cache = new Map(); const tree = s => { if (!cache.has(s)) cache.set(s, parse(s)); return cache.get(s); };
  function ev(n, v, pct) {
    if ('num' in n) return n.num;
    if (n.ref) { const x = v[n.ref]; return x == null ? null : pct.has(n.ref) ? x / 100 : x; }
    if (n.fn) { const xs = n.args.map(a => ev(a, v, pct)); return xs.some(x => x == null) ? null : Math[n.fn](...xs); }
    const a = ev(n.a, v, pct), b = ev(n.b, v, pct); if (a == null || b == null) return null;
    return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '×' ? a * b : b === 0 ? null : a / b;
  }
  const byId = {}; let pct = new Set();
  function calc(sid, over = {}) {
    const v = Object.fromEntries(M.inputs.map(r => [r.id, Object.hasOwn(over, r.id) ? over[r.id] : Number(r[sid])]));
    for (const f of M.formulas) { let x = null; try { x = ev(tree(f.expr), v, pct); } catch {} v[f.id] = Number.isFinite(x) ? x : null; }
    return v;
  }
  function load() {
    const el = document.getElementById('nb-model'); if (!el) { M = null; return false; }
    const raw = el.dataset.model; if (M && raw === sig) return true;
    M = JSON.parse(raw); sig = raw; pct = new Set(M.inputs.filter(r => r.unit === '%').map(r => r.id));
    for (const r of M.inputs) byId[r.id] = { ...r, input: true }; for (const f of M.formulas) byId[f.id] = f;
    st.scenario = M.default; st.over = {};
    try { const saved = JSON.parse(localStorage.getItem(store()) || 'null'); if (saved?.sig === sigOf()) Object.assign(st, saved.state); } catch {}
    if (!M.scenarios.some(x => x.id === st.scenario)) { st.scenario = M.default; st.over = {}; }
    return true;
  }
  const sigOf = () => JSON.stringify([M.inputs.map(r => r.id), M.formulas.map(f => f.expr)]);
  const save = () => { try { localStorage.setItem(store(), JSON.stringify({ sig: sigOf(), state: st })); } catch {} };
  const width = (el, share) => { if (el) el.style.width = Math.max(0, Math.min(100, share * 100)) + '%'; };
  const fmtInput = (r, v) => r.unit === '%' ? fmt('pct', v) : nf(v, Math.abs(v) < 10 ? 2 : 0) + (r.unit ? ' ' + r.unit : '');
  const kindOf = id => { const r = byId[id]; if (!r) return 'num'; if (r.unit === '%') return 'pct'; if (/MAD/.test(r.unit)) return 'mad'; if (/^h\b|^h\//.test(r.unit)) return 'hours'; if (/^(j|jour)/.test(r.unit)) return 'days'; if (/^mois/.test(r.unit)) return 'months'; if (r.unit === 'part') return 'share'; if (r.unit === 'multiple') return 'ratio'; return 'num'; };
  const text = e => { const s = String(e || ''); return s; };
  function words(id) {
    const f = byId[id]; if (!f || f.input) return '';
    return text(f.expr).replace(/[A-Za-z_][A-Za-z0-9_]*/g, x => byId[x] ? byId[x].title : x).replace(/\*/g, '×').replace(/\//g, '÷');
  }
  function apply() {
    if (!load()) return;
    V = calc(st.scenario, st.over); ALL = Object.fromEntries(M.scenarios.map(s => [s.id, calc(s.id)]));
    const adjusted = Object.keys(st.over).length, doc = document;
    doc.querySelectorAll('[data-nb]').forEach(el => {
      const sc = el.dataset.nbScen, id = el.dataset.nb;
      el.textContent = fmt(el.dataset.fmt, (sc && sc !== st.scenario ? ALL[sc] : V)[id]);
      if (!el.title) el.title = byId[id] ? (byId[id].title + (byId[id].input ? '' : ' = ' + words(id))) : '';
    });
    doc.querySelectorAll('[data-nb-scenario]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nbScenario === st.scenario)));
    doc.querySelectorAll('[data-nb-col]').forEach(c => c.classList.toggle('nb-on', c.dataset.nbCol === st.scenario));
    doc.querySelectorAll('[data-nb-bars]').forEach(box => {
      const bars = [...box.querySelectorAll('[data-nb-w]')], max = Math.max(1e-9, ...bars.map(b => Math.abs(V[b.dataset.nbW] || 0)));
      bars.forEach(b => width(b, Math.abs(V[b.dataset.nbW] || 0) / max));
    });
    doc.querySelectorAll('[data-nb-limit]').forEach(box => {
      const raw = V[box.dataset.value] || 0, cap = V[box.dataset.limit] || 0, max = Math.max(raw, cap, 1e-9);
      width(box.querySelector('.raw'), raw / max); width(box.querySelector('.kept'), Math.min(raw, cap) / max);
      box.querySelector('.cap').style.left = Math.min(100, cap / max * 100) + '%'; box.classList.toggle('nb-capped', raw > cap);
    });
    doc.querySelectorAll('[data-nb-funnel]').forEach(box => { const top = V[box.dataset.nbFunnel] || 1; box.querySelectorAll('[data-nb-share]').forEach(i => width(i, (V[i.dataset.nbShare] || 0) / top)); });
    doc.querySelectorAll('[data-nb-range]').forEach(box => {
      const id = box.dataset.nbRange, vals = M.scenarios.map(s => ALL[s.id][id] || 0), max = Math.max(...vals, V[id] || 0, 1e-9), pos = v => 4 + (v / max) * 92;
      box.querySelectorAll('[data-nb-dot]').forEach((d, i) => { d.style.left = pos(vals[i]) + '%'; d.classList.toggle('nb-on', d.dataset.nbDot === st.scenario); });
      const tr = box.querySelector('.nb-range-track > i'); tr.style.left = pos(Math.min(...vals)) + '%'; tr.style.width = (pos(Math.max(...vals)) - pos(Math.min(...vals))) + '%';
      const here = box.querySelector('[data-nb-here]'); here.hidden = !adjusted; here.style.left = pos(V[id] || 0) + '%';
    });
    doc.querySelectorAll('[data-nb-trajectory]').forEach(box => {
      const rows = [...box.querySelectorAll('[data-nb-traj-row]')];
      const max = Math.max(1e-9, ...rows.flatMap(r => M.scenarios.map(s => ALL[s.id][r.dataset.nbTrajRow] || 0)));
      const pos = v => 2 + (v / max) * 94;
      rows.forEach(r => {
        const vals = M.scenarios.map(s => ALL[s.id][r.dataset.nbTrajRow] || 0);
        const band = r.querySelector('.nb-traj-band');
        band.style.left = pos(Math.min(...vals)) + '%';
        band.style.width = Math.max(0.6, pos(Math.max(...vals)) - pos(Math.min(...vals))) + '%';
        r.querySelectorAll('[data-nb-dot]').forEach((d, i) => { d.style.left = pos(vals[i]) + '%'; });
        const here = r.querySelector('[data-nb-here]'); here.hidden = !adjusted; here.style.left = pos(V[r.dataset.nbTrajRow] || 0) + '%';
      });
    });
    doc.querySelectorAll('[data-nb-waterfall]').forEach(box => {
      const rows = [...box.querySelectorAll('[data-nb-wf]')];
      const vals = rows.map(r => V[r.dataset.nbWf] || 0);
      let run = 0, peak = 0;
      rows.forEach((r, i) => {
        const kind = r.dataset.nbWfKind, v = vals[i];
        if (kind === 'start') { run = v; peak = Math.max(peak, run); }
        else if (kind === 'up') { run += v; peak = Math.max(peak, run); }
        else if (kind === 'down') { run = Math.max(0, run - v); peak = Math.max(peak, run); }
        else { peak = Math.max(peak, v); }
      });
      const max = Math.max(1e-9, peak);
      let cum = 0;
      rows.forEach((r, i) => {
        const kind = r.dataset.nbWfKind, v = vals[i], bar = r.querySelector('.nb-wf-bar');
        if (kind === 'start') { cum = v; bar.style.left = '0%'; bar.style.width = (v / max * 100) + '%'; }
        else if (kind === 'up') { bar.style.left = (cum / max * 100) + '%'; bar.style.width = (v / max * 100) + '%'; cum += v; }
        else if (kind === 'down') { cum = Math.max(0, cum - v); bar.style.left = (cum / max * 100) + '%'; bar.style.width = (v / max * 100) + '%'; }
        else { bar.style.left = '0%'; bar.style.width = (v / max * 100) + '%'; }
      });
    });
    doc.querySelectorAll('[data-nb-input]').forEach(inp => {
      const id = inp.dataset.nbInput, r = byId[id]; if (!r) return;
      const v = Object.hasOwn(st.over, id) ? st.over[id] : Number(r[st.scenario]);
      if (document.activeElement !== inp) inp.value = v;
      const o = inp.closest('.nb-control,.nb-explain-input'); const out = o?.querySelector('[data-nb-out]'); if (out) out.textContent = fmtInput(r, v);
      const u = o?.querySelector('[data-nb-undo]'); if (u) { u.hidden = !Object.hasOwn(st.over, id); u.textContent = (M.scenarios.find(s => s.id === st.scenario)?.label || '') + ' : ' + fmtInput(r, Number(r[st.scenario])); }
    });
    doc.querySelectorAll('[data-nb-adjusted]').forEach(a => { a.hidden = !adjusted; a.querySelector('span').textContent = t('adjusted · ', 'ajusté · ') + adjusted; });
    if (pop?.isConnected && !pop.hidden && trail.length) {
      const id = trail[trail.length - 1], pv = pop.querySelector('.nb-pop-value'); if (pv) pv.firstChild.textContent = fmt(kindOf(id), V[id]);
      pop.querySelectorAll('[data-nb-open]').forEach(b => { b.querySelector('b').textContent = fmt(kindOf(b.dataset.nbOpen), V[b.dataset.nbOpen]); });
      place();
    }
    save();
  }

  // ---- explain: a figure opens its formula; each term opens in turn
  let pop = null, trail = [], popAnchor = null;
  const person = p => { const r = M.people?.[p]; return r ? `<span class="nb-person" title="${esc(r.role)}"><i>${esc((r.name || p)[0])}</i>${esc(r.name || p)}<small>${esc(r.role || '')}</small></span>` : ''; };
  const claim = c => { const r = M.claims?.[c]; if (!r) return '';
    const inner = `<i class="nb-ph-${esc(r.phase)}"></i>${esc(r.text)}<small>${esc(M.phases?.[r.phase] || r.phase)}</small>`;
    const url = M.sourceUrls?.[r.source];
    return url ? `<a class="nb-claim" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>` : `<span class="nb-claim">${inner}</span>`; };
  const source = s => split(s).filter(x => x !== 'HYP').map(x => {
    const label = M.sources?.[x] || x, url = M.sourceUrls?.[x];
    return url ? `<a class="nb-src" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : `<span class="nb-src">${esc(label)}</span>`; }).join('');
  function chip(id) { const r = byId[id]; if (!r) return `<code>${esc(id)}</code>`;
    return `<button type="button" class="nb-term ${r.input ? 'is-input' : ''}" data-nb-open="${esc(id)}"><span>${esc(r.title)}</span><b>${esc(fmt(kindOf(id), V[id]))}</b></button>`; }
  function expression(f) {
    return tokens(f.expr).map(x => /^[A-Za-z_]/.test(x) && x !== 'min' && x !== 'max' ? chip(x)
      : /^\d/.test(x) ? `<span class="nb-lit">${esc(nf(Number(x.replace(',', '.')), 4))}</span>`
      : `<span class="nb-op">${esc(({ '*': '×', '/': '÷', '-': '−', min: t('smallest of', 'le plus petit de'), max: t('largest of', 'le plus grand de') })[x] || x)}</span>`).join(' ');
  }
  function paint() {
    const id = trail[trail.length - 1], r = byId[id]; if (!r) return;
    const usedBy = M.formulas.filter(f => tokens(f.expr).includes(id)).slice(0, 6);
    const phase = r.phase && M.phases?.[r.phase];
    pop.querySelector('.nb-pop-body').innerHTML = `
      ${trail.length > 1 ? `<nav class="nb-trail">${trail.slice(0, -1).map((x, i) => `<button type="button" data-nb-back="${i}">${esc(byId[x]?.title || x)}</button>`).join('<span>›</span>')}</nav>` : ''}
      <div class="nb-pop-title">${phase ? `<span class="nb-phase nb-ph-${esc(r.phase)}">${esc(phase)}</span>` : ''}<h4>${esc(r.title)}</h4></div><div class="nb-pop-value">${esc(fmt(kindOf(id), V[id]))}<small>${esc(M.scenarios.find(s => s.id === st.scenario)?.label || '')}${Object.keys(st.over).length ? t(' · adjusted', ' · ajusté') : ''}</small></div>
      ${r.input ? `<p class="nb-pop-kind">${t('An assumption', 'Une hypothèse')}${r.source && r.source !== 'HYP' ? ' · ' + source(r.source) : ' · ' + t('to confirm', 'à confirmer')}</p>
        <div class="nb-explain-input nb-control"><label><span>${t('Adjust', 'Ajuster')}</span><output data-nb-out="${esc(id)}"></output></label>
        <input type="range" data-nb-input="${esc(id)}" min="${esc(r.min)}" max="${esc(r.max)}" step="${esc(r.step)}" value="${esc(Object.hasOwn(st.over, id) ? st.over[id] : r[st.scenario])}" aria-label="${esc(r.title)}">
        <small><button type="button" data-nb-undo="${esc(id)}" hidden></button></small></div>
        <div class="nb-pop-scen">${M.scenarios.map(s => `<span class="${s.id === st.scenario ? 'nb-on' : ''}">${esc(s.label)} <b>${esc(fmtInput(r, Number(r[s.id])))}</b></span>`).join('')}</div>`
      : `<div class="nb-expr"><span class="nb-op">=</span> ${expression(r)}</div>`}
      ${split(r.who).length ? `<div class="nb-pop-row"><small>${t('Who can confirm it', 'Qui peut le confirmer')}</small>${split(r.who).map(person).join('')}</div>` : ''}
      ${split(r.claims).length ? `<div class="nb-pop-row"><small>${t('The claims it stands on', 'Les promesses sur lesquelles il repose')}</small>${split(r.claims).map(claim).join('')}</div>` : ''}
      ${M.imported?.includes(id) ? `<p class="nb-pop-kind">${t('From the imported model', 'Du carnet importé')}</p>` : ''}
      ${usedBy.length ? `<div class="nb-pop-row"><small>${t('Used in', 'Entre dans')}</small>${usedBy.map(f => chip(f.id)).join('')}</div>` : ''}`;
    const r2 = byId[id]; if (r2?.input) { const inp = pop.querySelector('[data-nb-input]'); const o = pop.querySelector('[data-nb-out]'); o.textContent = fmtInput(r2, Number(inp.value)); const u = pop.querySelector('[data-nb-undo]'); u.hidden = !Object.hasOwn(st.over, id); u.textContent = (M.scenarios.find(s => s.id === st.scenario)?.label || '') + ' : ' + fmtInput(r2, Number(r2[st.scenario])); }
    place();
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const phone = matchMedia('(max-width:640px)');
  // The panel goes wherever it fits whole: below the figure, above it, then
  // beside it on the side with the most room. When no direction holds it, the
  // roomiest one takes it with a capped height and internal scrolling, so a
  // figure at an edge never opens a panel that runs off the screen.
  function place() {
    if (!pop || pop.hidden) return;
    // At phone width the stylesheet docks the panel to the bottom edge; inline
    // geometry would only fight it.
    if (phone.matches || !popAnchor) {
      if (pop.style.width || pop.style.left || pop.style.top || pop.style.maxHeight) pop.style.width = pop.style.left = pop.style.top = pop.style.maxHeight = '';
      return;
    }
    // The panel is fixed, so it lives in the layout viewport: clientWidth and
    // clientHeight exclude the scrollbar, which innerWidth includes.
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = document.documentElement.clientHeight || innerHeight;
    const margin = 12, gap = 8;
    const naturalW = Math.min(420, vw - 2 * margin);
    const measure = w => { pop.style.maxHeight = ''; pop.style.width = w + 'px'; return pop.getBoundingClientRect().height; };
    const b = popAnchor.getBoundingClientRect();
    const seen = {
      left: clamp(b.left, margin, vw - margin), right: clamp(b.right, margin, vw - margin),
      top: clamp(b.top, margin, vh - margin), bottom: clamp(b.bottom, margin, vh - margin),
    };
    const room = {
      below: vh - margin - (seen.bottom + gap), above: seen.top - gap - margin,
      right: vw - margin - (seen.right + gap), left: seen.left - gap - margin,
    };
    const hFull = measure(naturalW);
    const vertical = d => ({dir: d, w: naturalW, h: hFull, avail: room[d]});
    const beside = d => {
      const w = Math.min(naturalW, room[d]);
      if (w < Math.min(260, naturalW)) return null;
      return {dir: d, w, h: w >= naturalW ? hFull : measure(w), avail: vh - 2 * margin};
    };
    const sides = ['right', 'left'].map(beside).filter(Boolean).sort((x, y) => room[y.dir] - room[x.dir]);
    const order = [vertical('below'), vertical('above'), ...sides];
    let c = order.find(x => x.h <= x.avail);
    // Nothing holds it whole: keep the placement that leaves the most height.
    if (!c) c = order.reduce((best, x) => (x.avail > best.avail + 0.5 ? x : best), order[0]);
    const h = Math.min(c.h, c.avail);
    pop.style.width = c.w + 'px';
    pop.style.maxHeight = c.h > c.avail ? Math.max(0, Math.floor(c.avail)) + 'px' : '';
    let top, left;
    if (c.dir === 'below') { top = seen.bottom + gap; left = clamp(b.left, margin, vw - margin - c.w); }
    else if (c.dir === 'above') { top = seen.top - gap - h; left = clamp(b.left, margin, vw - margin - c.w); }
    else if (c.dir === 'right') { top = clamp(b.top, margin, vh - margin - h); left = seen.right + gap; }
    else { top = clamp(b.top, margin, vh - margin - h); left = seen.left - gap - c.w; }
    top = clamp(top, margin, vh - margin - h);
    pop.style.left = Math.round(clamp(left, margin, vw - margin - c.w)) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }
  function open(id, anchor) {
    if (!pop || !pop.isConnected) {
      pop = document.createElement('div'); pop.id = 'nb-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', t('How this figure is made', 'Comment ce chiffre est fait'));
      pop.innerHTML = `<div class="nb-pop-top"><span>${t('How this figure is made', 'Comment ce chiffre est fait')}</span><button type="button" data-nb-close aria-label="${t('Close', 'Fermer')}">×</button></div><div class="nb-pop-body"></div>`;
      document.body.appendChild(pop);
    }
    trail = anchor ? [id] : [...trail, id]; pop.hidden = false;
    if (anchor) popAnchor = anchor;
    paint(); pop.querySelector('[data-nb-close]').focus({ preventScroll: true });
  }
  const close = () => { if (pop) { pop.hidden = true; pop.style.maxHeight = ''; trail = []; popAnchor = null; } };
  const reposition = () => { if (pop && !pop.hidden) place(); };
  addEventListener('scroll', reposition, { passive: true });
  addEventListener('resize', reposition);
  // Web fonts settle after first paint and change the panel's height.
  document.fonts?.ready.then(reposition);

  document.addEventListener('click', e => {
    const v = e.target.closest('.nb-v[data-nb]');
    if (v && load()) { e.preventDefault(); if (byId[v.dataset.nb]) open(v.dataset.nb, v); return; }
    const o = e.target.closest('[data-nb-open]'); if (o) { open(o.dataset.nbOpen); return; }
    const back = e.target.closest('[data-nb-back]'); if (back) { trail = trail.slice(0, Number(back.dataset.nbBack) + 1); paint(); return; }
    if (e.target.closest('[data-nb-close]')) { close(); return; }
    if (pop && !pop.hidden && !e.target.closest('#nb-pop')) close();
    const c = e.target.closest('[data-nb-scenario],[data-nb-reset],[data-nb-undo]'); if (!c || !load()) return;
    if (c.dataset.nbScenario) { st.scenario = c.dataset.nbScenario; st.over = {}; }
    else if (c.hasAttribute('data-nb-reset')) st.over = {};
    else delete st.over[c.dataset.nbUndo];
    apply();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop && !pop.hidden) { close(); e.stopPropagation(); } }, true);
  document.addEventListener('input', e => {
    const inp = e.target.closest('[data-nb-input]'); if (!inp || !load()) return;
    const r = byId[inp.dataset.nbInput], v = Number(inp.value);
    if (v === Number(r[st.scenario])) delete st.over[r.id]; else st.over[r.id] = v;
    apply();
  });
  window.dossierNotebook = { apply, calc: (sid, over) => (load(), calc(sid, over)), fmt, parse, state: st, open: id => (load(), open(id, document.querySelector(`[data-nb="${CSS.escape(id)}"]`))) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
