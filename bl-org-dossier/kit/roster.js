// A projection of Org. Local navigation never changes task state.
(() => {
  const states = new Map();
  const q = (g, s) => g.querySelector(s);
  const qa = (g, s) => [...g.querySelectorAll(s)];
  function state(g) {
    if (!states.has(g.dataset.roster)) states.set(g.dataset.roster, { selected: g.dataset.rosterStart, filter: g.dataset.rosterFilter || 'open', area: '', search: '', history: [], drafts: new Map(), listOpen: false });
    return states.get(g.dataset.roster);
  }
  function matches(row, filter) {
    const d = row.dataset;
    switch (filter) {
      case 'open': return d.done !== 'true';
      case 'needs': return d.needsYou === 'true';
      case 'ready': return d.done !== 'true' && d.blocked !== 'true' && d.later !== 'true';
      case 'blocked': return d.blocked === 'true';
      case 'done': return d.done === 'true' && d.dropped !== 'true';
      case 'later': return d.later === 'true' && d.done !== 'true';
      default: return true;
    }
  }
  function paint(g, { follow = false } = {}) {
    const s = state(g), rows = qa(g, '[data-roster-row]');
    const visible = rows.filter(row => matches(row, s.filter) && (!s.area || row.dataset.area === s.area) && (!s.search || row.dataset.search.includes(s.search.toLowerCase())));
    rows.forEach(row => { row.hidden = !visible.includes(row); row.setAttribute('aria-pressed', row.dataset.rosterRow === s.selected); });
    qa(g, '[data-roster-group]').forEach(group => { group.hidden = !qa(group, '[data-roster-row]').some(row => !row.hidden); });
    qa(g, '[data-roster-filter-to]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rosterFilterTo === s.filter));
    qa(g, '[data-roster-filter-count]').forEach(b => { b.textContent = rows.filter(row => matches(row, b.dataset.rosterFilterCount)).length; });
    const select = q(g, '[data-roster-filter-select]'); if (select) select.value = s.filter;
    q(g, '[data-roster-visible-count]').textContent = visible.length;
    q(g, '[data-roster-empty]').hidden = visible.length > 0;
    if (!follow && !visible.some(row => row.dataset.rosterRow === s.selected)) s.selected = visible[0]?.dataset.rosterRow || null;
    qa(g, '[data-roster-panel]').forEach(panel => { panel.hidden = panel.dataset.rosterPanel !== s.selected; });
    qa(g, '[data-roster-row]').forEach(row => row.setAttribute('aria-pressed', row.dataset.rosterRow === s.selected));
    q(g, '[data-roster-filter-empty]').hidden = !!s.selected;
    const active = q(g, `[data-roster-detail="${CSS.escape(s.selected || '')}"]`);
    qa(g, '[data-roster-back]').forEach(b => { b.hidden = !s.history.length; });
    const title = active?.querySelector('.or-task-heading h2')?.textContent || 'Choose a task';
    q(g, '[data-roster-picker] span').textContent = title;
    q(g, '[data-roster-picker]').setAttribute('aria-expanded', String(s.listOpen));
    g.dataset.listOpen = String(s.listOpen);
    q(g, '[data-roster-result-status]').textContent = visible.length ? `${visible.length} matching tasks · ${title}` : 'No matching tasks';
    g.dataset.rosterSelected = s.selected || '';
    g.dataset.rosterFilter = s.filter;
  }
  function choose(g, id, remember = true) {
    const s = state(g);
    if (!q(g, `[data-roster-panel="${CSS.escape(id)}"]`)) return;
    if (remember && s.selected && s.selected !== id) s.history.push(s.selected);
    const row = q(g, `[data-roster-row="${CSS.escape(id)}"]`);
    if (row?.hidden) { s.filter = 'all'; s.area = ''; s.search = ''; q(g, '[data-roster-search]').value = ''; q(g, '[data-roster-area]').value = ''; }
    s.selected = id; s.listOpen = false; paint(g, { follow: true });
    if (innerWidth < 760) q(g, '.or-detail-region').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function init() {
    qa(document, '[data-roster]').forEach(g => {
      if (g.dataset.rosterReady) return; g.dataset.rosterReady = 'true';
      if (!q(g, '[data-roster-search]')) return;
      const s = state(g);
      q(g, '[data-roster-search]').value = s.search; q(g, '[data-roster-area]').value = s.area;
      s.drafts.forEach((draft, task) => {
        const f = q(g, `form[data-task="${CSS.escape(task)}"]`); if (!f) return;
        f.elements.note.value = draft.note; f.elements.decision.value = draft.decision; f.closest('details').open = true;
      });
      paint(g, { follow: true });
      const activeRow = q(g, `[data-roster-row="${CSS.escape(s.selected || '')}"]`), list = q(g, '.or-work-list');
      if (activeRow && !activeRow.hidden) list.scrollTop = activeRow.offsetTop - list.offsetTop - 70;
      q(g, '[data-roster-search]').addEventListener('input', e => { s.search = e.target.value; paint(g); });
      q(g, '[data-roster-area]').addEventListener('change', e => { s.area = e.target.value; paint(g); });
      q(g, '[data-roster-filter-select]')?.addEventListener('change', e => { s.filter = e.target.value; paint(g); });
      g.addEventListener('click', e => {
        const filter = e.target.closest('[data-roster-filter-to]'); if (filter) { s.filter = filter.dataset.rosterFilterTo; paint(g); }
        const target = e.target.closest('[data-roster-to]'); if (target) choose(g, target.dataset.rosterTo);
        if (e.target.closest('[data-roster-back]') && s.history.length) choose(g, s.history.pop(), false);
        if (e.target.closest('[data-roster-close-list]')) { s.listOpen = false; paint(g); q(g, '[data-roster-picker]').focus({ preventScroll: true }); }
        if (e.target.closest('[data-roster-picker]')) { s.listOpen = !s.listOpen; paint(g); if (s.listOpen) q(g, '[data-roster-area]').focus({ preventScroll: true }); }
        const image = e.target.closest('[data-roster-image]');
        if (image) {
          const dialog = q(g, '[data-roster-lightbox]'); q(dialog, 'img').src = image.dataset.rosterImage;
          q(dialog, 'img').alt = image.dataset.rosterCaption; q(dialog, 'p').textContent = image.dataset.rosterCaption; dialog.showModal();
        }
      });
      g.addEventListener('toggle', e => {
        if (!e.target.open) return;
        const iframe = q(e.target, 'iframe[data-roster-preview]'); if (iframe && !iframe.src) iframe.src = iframe.dataset.rosterPreview;
      }, true);
      g.addEventListener('input', e => {
        const f = e.target.closest('.or-note-form'); if (f) s.drafts.set(f.dataset.task, { note: f.elements.note.value, decision: f.elements.decision.value });
      });
      g.addEventListener('change', e => {
        const f = e.target.closest('.or-note-form'); if (f) s.drafts.set(f.dataset.task, { note: f.elements.note.value, decision: f.elements.decision.value });
      });
      g.addEventListener('submit', async e => {
        const f = e.target.closest('.or-note-form'); if (!f) return;
        e.preventDefault(); if (f.dataset.saving) return;
        const button = q(f, 'button[type=submit]'), status = q(f, '.or-save-state');
        f.dataset.saving = 'true'; button.disabled = true; status.textContent = 'Saving…';
        const payload = { roster: f.dataset.rosterNote, task: f.dataset.task, note: f.elements.note.value, decision: f.elements.decision.value };
        try {
          const res = await fetch('roster-note', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
          const body = await res.json(); if (!res.ok || body.ok !== true || body.note !== payload.note || body.task !== payload.task) throw new Error(body.error || 'The server did not confirm the save.');
          s.drafts.delete(f.dataset.task); f.elements.note.defaultValue = f.elements.note.value;
          status.textContent = 'Saved to this task'; f.closest('details').open = true;
        } catch (error) { status.textContent = 'Not saved: ' + error.message; }
        finally { delete f.dataset.saving; button.disabled = false; }
      });
      g.addEventListener('keydown', e => {
        if (e.key === 'Escape' && s.listOpen) { s.listOpen = false; paint(g); q(g, '[data-roster-picker]').focus(); }
        if (e.target.closest('input,textarea,select,dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
        const row = e.target.closest('[data-roster-row]');
        if (row && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault(); const rows = qa(g, '[data-roster-row]').filter(x => !x.hidden), i = rows.indexOf(row);
          const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length]; next?.focus();
        }
      });
    });
  }
  init();
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('[data-roster]') || n.querySelector?.('[data-roster]'))))) init();
  }).observe(document.getElementById('doc'), { childList: true, subtree: true });
})();
