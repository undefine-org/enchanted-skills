// live.js — the page listens to its file, and talks back to it.
// Polls /rev; when the .bl.org changed (an answer, an Emacs save, a
// `bl doc run`), swaps the body in place unless you are mid-answer.
(() => {
  const $ = s => document.querySelector(s);
  let rev = null, busy = false;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  const stamp = (s) => { $('#stamp').textContent = s; };
  const editing = () => { if (document.querySelector('form.or-note-form[data-saving]')) return true; const a = document.activeElement; return a && a.tagName === 'TEXTAREA' && a.value.trim() !== (a.defaultValue || '').trim(); };

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
      const d = await (await fetch('doc', { cache: 'no-store' })).json();
      const y = scrollY; $('#doc').innerHTML = d.html; rev = d.rev;
      const design = $('#doc .app2')?.dataset.design;
      if (design) document.documentElement.dataset.design = design;
      else delete document.documentElement.dataset.design;
      show(current); paintGraphs(); scrollTo(0, y);
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
    if (current === 'all' || e.target.closest('input,textarea,select,.screen-graph,.org-roster,[data-witness],[data-milestones]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const list = secs(), i = list.findIndex(s => s.id === current);
    if (e.key === 'ArrowRight' && i < list.length - 1) location.hash = list[i + 1].id;
    if (e.key === 'ArrowLeft' && i > 0) location.hash = list[i - 1].id;
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
