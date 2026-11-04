/* SchemaGraph — the dossier's relationship-oriented counterpart to its screen
 * explorer. HTML cards + SVG wires, deterministic layers, bounded neighbourhoods,
 * shared pan/zoom conventions. Hosts supply data, never executable callbacks
 * from a query string. A hyperedge is one selectable set of inputs and output.
 */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = value => String(value).split('/').at(-1).replaceAll('-', ' ');
  const cardinality = ref => `${ref.required ? '1' : '0'}…${ref.many ? 'N' : '1'}`;
  const glyphs = {
    back:'<path d="m14 6-6 6 6 6"/>', links:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
    graph:'<rect x="3" y="3" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><rect x="3" y="15" width="6" height="5" rx="1"/><path d="M6 8v4h12v3M6 12v3"/>',
    fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    details:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M7 9h4m-4 5h4"/>',
    reset:'<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>', search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    computed:'<path d="m12 2 2.8 6.2L22 11l-7.2 2.8L12 21l-2.8-7.2L2 11l7.2-2.8z"/>',
    identity:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM8 12h8m-4-4v8"/>', arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>'
  };
  const icon = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[id] || glyphs.graph}</svg>`;
  const key = item => `${item.selected}|${item.layer}|${item.lens}|${item.edge || ''}`;

  function validate(graph) {
    if (!graph || !Array.isArray(graph.nodes) || !graph.nodes.length) throw Error('A schema needs its entity definitions.');
    const ids = new Set(graph.nodes.map(n => n.id));
    if (ids.size !== graph.nodes.length) throw Error('Duplicate schema entity identity.');
    const fields = new Set(graph.nodes.flatMap(n => n.fields.map(f => f.name)));
    for (const r of graph.refs) if (!ids.has(r.from) || r.to !== '*' && !ids.has(r.to)) throw Error('Reference leaves its declared domain.');
    for (const h of graph.hyperedges) if (!ids.has(h.owner) || !h.inputs.length || h.inputs.some(a => !fields.has(a))) throw Error('A hyperedge needs all of its declared input fields.');
    return graph;
  }

  // This projection contains schema definitions only. Universal reference targets
  // become ONE quantified scope node, never fourteen invented pairwise refs.
  function scene(graph, selected, layer = 'links', lens = 'neighbors', orientation = 'horizontal') {
    validate(graph);
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    if (!byId.has(selected)) selected = graph.nodes[0].id;
    if (layer !== 'links') {
      const kind = layer === 'derived' ? 'computed' : 'identity';
      const hyper = graph.hyperedges.filter(h => h.kind === kind && h.owner === selected);
      if (!hyper.length) return {nodes:[{...byId.get(selected),kind:'entity',x:240,y:170,w:248,h:126}],edges:[],width:760,height:470,selected,layer};
      const n = byId.get(selected), inputs = [...new Set(hyper.flatMap(h => h.inputs))];
      const entity = {...n,kind:'entity',ports:inputs,x:38,y:100,w:250,h:96+inputs.length*32};
      const nodes = [entity], edges = [];
      hyper.forEach((h, i) => {
        const y = 145 + i * 220;
        nodes.push({id:'hyper:'+h.id,kind:h.kind,title:h.title,x:402,y,w:204,h:104,hyper:h});
        nodes.push({id:'output:'+h.id,kind:'output',title:short(h.output),namespace:h.output,x:716,y:y-4,w:248,h:112,hyper:h});
        h.inputs.forEach((attr, j) => edges.push({id:h.id,part:attr,from:selected,to:'hyper:'+h.id,label:'',kind:h.kind,hyper:h,port:inputs.indexOf(attr)}));
        edges.push({id:h.id,from:'hyper:'+h.id,to:'output:'+h.id,label:h.kind==='identity'?'unique tuple':'computed value',kind:h.kind,hyper:h});
      });
      if(orientation==='vertical'){entity.x=75;entity.y=74;hyper.forEach((h,i)=>{const junction=nodes.find(n=>n.id==='hyper:'+h.id),output=nodes.find(n=>n.id==='output:'+h.id);Object.assign(junction,{x:98,y:entity.y+entity.h+80+i*320});Object.assign(output,{x:76,y:junction.y+174});});return {nodes,edges,width:400,height:Math.max(...nodes.map(n=>n.y+n.h))+60,selected,layer,orientation};}
      return {nodes,edges,width:1000,height:Math.max(470,entity.y+entity.h+64,hyper.length*220+150),selected,layer};
    }
    const direct = graph.refs.filter(r => r.from === selected || r.to === selected);
    const included = lens === 'domain' ? new Set(byId.keys()) : new Set([selected,...direct.flatMap(r => [r.from,r.to]).filter(id => id!=='*')]);
    let refs = graph.refs.filter(r => included.has(r.from) && (r.to==='*' || included.has(r.to)));
    const wildcard = refs.some(r=>r.to==='*');
    const nodes = [...included].map(id=>({...byId.get(id),kind:'entity',w:224,h:128}));
    if (wildcard) nodes.push({id:'$scope',kind:'scope',title:'Any entity in this domain',namespace:graph.title,count:graph.nodes.length,w:224,h:128});
    const edges = refs.map(r=>({...r,to:r.to==='*'?'$scope':r.to,kind:r.to==='*'?'scope':'ref',label:r.label}));
    const positions = new Map();
    if(lens==='neighbors') {
      const incoming=nodes.filter(n=>n.id!==selected&&direct.some(r=>r.from===n.id&&r.to===selected));
      const outgoing=nodes.filter(n=>n.id!==selected&&!incoming.includes(n));
      if(orientation==='vertical') {
        const width=472,inRows=Math.ceil(incoming.length/2),ownerY=104+inRows*174;
        positions.set(selected,{x:136,y:ownerY});
        [incoming,outgoing].forEach((group,col)=>group.forEach((n,i)=>positions.set(n.id,{x:group.length===1?136:24+(i%2)*224,y:col===0?104+Math.floor(i/2)*174:ownerY+174+Math.floor(i/2)*174})));
        for(const n of nodes)Object.assign(n,positions.get(n.id),{w:200});
        return {nodes,edges,width,height:Math.max(500,ownerY+Math.ceil(outgoing.length/2)*174+216),selected,layer,orientation};
      }
      const rows=Math.max(incoming.length,outgoing.length,1), height=Math.max(500,rows*174+130);
      const centerX=incoming.length?354:92;
      positions.set(selected,{x:centerX,y:height/2-64});
      [incoming,outgoing].forEach((group, col)=>group.forEach((n,i)=>positions.set(n.id,{x:col===0?32:centerX+324,y:height/2-group.length*87+i*174+24})));
      for(const n of nodes)Object.assign(n,positions.get(n.id));
      return {nodes,edges,width:outgoing.length?centerX+608:centerX+292,height,selected,layer};
    }
    // Keep whole-domain positions independent of selection. Native reference
    // direction determines layers; disconnected families share the same ranks.
    const levels=new Map(),visiting=new Set();
    function rank(id){if(levels.has(id))return levels.get(id);if(visiting.has(id))return 0;visiting.add(id);const targets=edges.filter(e=>e.from===id).map(e=>e.to);const value=targets.length?1+Math.max(...targets.map(rank)):0;visiting.delete(id);levels.set(id,value);return value;}
    nodes.forEach(n=>rank(n.id));
    const cols=new Map();nodes.forEach(n=>{const l=levels.get(n.id);if(!cols.has(l))cols.set(l,[]);cols.get(l).push(n);});
    const rows=Math.max(...[...cols.values()].map(c=>c.length)),height=Math.max(560,rows*174+128);
    cols.forEach((group,col)=>group.forEach((n,i)=>Object.assign(n,{x:44+col*310,y:height/2-group.length*87+i*174+24,depth:col})));
    return {nodes,edges,width:Math.max(...nodes.map(n=>n.x+n.w))+64,height,selected,layer};
  }

  function mount(root, graph, options={}) {
    validate(graph);
    const initial={selected:graph.nodes.some(n=>n.id===options.selected)?options.selected:graph.nodes[0].id,layer:['derived','identity'].includes(options.layer)?options.layer:'links',lens:options.lens==='domain'?'domain':'neighbors',edge:options.edge==='$scope'||[...graph.refs,...graph.hyperedges].some(e=>e.id===options.edge)?options.edge:''};
    let state={...initial},history=[],current,zoom=1,drag=null,observer,expanded=false,opener=null,details=true,hover=null,paintEpoch=0,zoomVersion=0,abort=new AbortController();
    const byId=new Map(graph.nodes.map(n=>[n.id,n])), signal=abort.signal;
    root.className='sgm';root.dataset.schema=graph.id;root.dataset.component='schema-graph';
    const tools=[['back','Back','back'],['highlight','Highlight connections · H','links'],['domain','Whole domain · G','graph'],['details','Inspect schema · I','details'],['expand','Full screen','expand'],['reset','Reset exploration','reset']];
    root.innerHTML=`<div class="sgm-workbench"><div class="sgm-main"><header class="sgm-top"><div class="sgm-search-wrap"><label class="sgm-search">${icon('search')}<input type="search" aria-label="Find an entity in ${esc(graph.title)}" placeholder="Find an entity…" autocomplete="off"></label><div class="sgm-results" hidden></div></div><div class="sgm-lenses" role="group" aria-label="Schema layers">${[['links','References'],['derived','Computed'],['identity','Identity']].map(([id,label])=>`<button data-layer="${id}" aria-pressed="false" ${id!=='links'&&!graph.hyperedges.some(h=>h.kind===(id==='derived'?'computed':'identity'))?'disabled title="None declared in this domain"':''}>${label}<small>${id==='links'?graph.refs.length:graph.hyperedges.filter(h=>h.kind===(id==='derived'?'computed':'identity')).length}</small></button>`).join('')}</div></header><div class="sgm-map-head"><span class="sgm-map-title"></span><div class="sgm-zoom" role="group" aria-label="Graph zoom"><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="fit" aria-label="Fit the graph">Fit</button><button data-zoom="in" aria-label="Zoom in">+</button></div></div><div class="sgm-viewport" tabindex="0" role="region" aria-label="${esc(graph.title)} schema map; drag to pan"><div class="sgm-sizer"><div class="sgm-canvas"><div class="sgm-domain-boundary"><span>${esc(graph.title)}<small>one Datom connection</small></span></div><svg class="sgm-wires" aria-label="Schema relationships"></svg><div class="sgm-nodes"></div></div></div></div><footer class="sgm-floor"><span class="sgm-count"></span><span class="sgm-legend"><i></i>reference <i class="dashed"></i>domain scope <b>◇</b>shared inputs</span></footer><div class="sgm-tools" role="toolbar" aria-label="Schema explorer controls">${tools.map(([id,label,g])=>`<button data-tool="${id}" aria-label="${label}" title="${label}">${icon(g)}</button>`).join('')}</div></div><aside class="sgm-inspector" aria-label="Selected schema details"></aside><div class="sgm-live" role="status" aria-live="polite"></div></div>`;
    const viewport=root.querySelector('.sgm-viewport'),canvas=root.querySelector('.sgm-canvas'),sizer=root.querySelector('.sgm-sizer'),wires=root.querySelector('.sgm-wires'),nodesEl=root.querySelector('.sgm-nodes'),inspector=root.querySelector('.sgm-inspector');
    function announce(){root.querySelector('.sgm-live').textContent=`${byId.get(state.selected)?.title}. ${state.layer==='links'?current.edges.length+' visible references':state.layer==='derived'?'Computed properties':'Compound identity'}. ${state.lens==='domain'?'Whole domain':'Focused neighbourhood'}.`;}
    function emit(){options.onChange?.({...state});}
    function change(next,{push=true}={}){const hadFocus=root.contains(document.activeElement);const target={...state,...next};if(!byId.has(target.selected))return;if(key(target)===key(state))return;if(push)history.push({...state});const keepCamera=state.lens==='domain'&&target.lens==='domain'&&state.layer==='links'&&target.layer==='links';state=target;render(keepCamera);if(hadFocus)requestAnimationFrame(()=>[...nodesEl.querySelectorAll('[data-node]')].find(n=>n.dataset.node===state.selected)?.focus({preventScroll:true}));emit();}
    function showField(f){return `<div class="sgm-field"><div><span>${esc(f.label||short(f.name))}</span><small>${esc(f.type)}${f.many?' · many':' · one'}${f.unique?' · unique':''}</small></div><code>:${esc(f.name)}</code>${f.type==='ref'?`<button data-follow="${esc(f.target==='*'?'$scope':f.target)}" data-ref="${esc(f.name)}">${f.target==='*'?'Any entity in this domain':esc(byId.get(f.target)?.title||f.target)} ${icon('arrow')}</button>`:''}${f.required?'<small class="sgm-note">Required by the domain declaration</small>':''}${f.components?.length?`<button data-open-hyper="${esc(f.name)}">${icon('identity')}Explore compound identity</button>`:''}</div>`;}
    function referenceRow(r,incoming){const other=incoming?r.from:r.to;return `<button class="sgm-relation-row" data-select-edge="${esc(r.id)}"><span class="sgm-direction">${incoming?'←':'→'}</span><span><b>${esc(r.label)}</b><small>${other==='*'?'Any entity in this domain':esc(byId.get(other)?.title)}</small></span><em>${cardinality(r)}</em></button>`;}
    function renderInspector(){
      const n=byId.get(state.selected),r=graph.refs.find(r=>r.id===state.edge),h=graph.hyperedges.find(h=>h.id===state.edge);
      let body=`<div class="sgm-inspector-head"><span class="sgm-eyebrow">${esc(graph.title)} / schema</span><h2>${esc(n.title)}</h2><code>:${esc(n.namespace)}/*</code></div>`;
      if(state.edge==='$scope'){body=`<div class="sgm-inspector-head"><span class="sgm-eyebrow">∀ Domain scope</span><h2>Any entity in ${esc(graph.title)}</h2></div><p class="sgm-hyper-doc">A subject reference is not restricted to a single entity type. The owning domain stays explicit.</p><div class="sgm-scope-list">${graph.nodes.map(n=>`<button data-select="${esc(n.id)}">${esc(n.title)} ${icon('arrow')}</button>`).join('')}</div>`;}else if(r){
        body=`<button class="sgm-inspector-back" data-clear-edge>← ${esc(n.title)}</button><div class="sgm-inspector-head"><span class="sgm-eyebrow">${r.to==='*'?'Domain-scoped reference':'Reference'}</span><h2>${esc(r.label)}</h2><code>:${esc(r.attribute)}</code></div><div class="sgm-edge-route"><button data-select="${esc(r.from)}">${esc(byId.get(r.from).title)}</button>${icon('arrow')}${r.to==='*'?'<button data-allowed-types>Any entity in this domain</button>':`<button data-select="${esc(r.to)}">${esc(byId.get(r.to).title)}</button>`}</div><dl class="sgm-facts"><dt>Per source entity</dt><dd>${cardinality(r)} target${r.many?'s':''}</dd><dt>Reverse navigation</dt><dd>Target ← referring entities</dd><dt>Native storage</dt><dd>ref · ${r.many?'many':'one'}</dd></dl><details class="sgm-provenance"><summary>Schema provenance</summary><p>Type and cardinality: <code>datom/schema</code>. Target type and requiredness: domain declaration. A type-level edge is not a claim that records already exist.</p></details>`;
      }else if(h){
        body=`<button class="sgm-inspector-back" data-clear-edge>← ${esc(n.title)}</button><div class="sgm-inspector-head"><span class="sgm-eyebrow">${h.kind==='computed'?'Native computed relation':'Native composite tuple'}</span><h2>${esc(h.title)}</h2><code>:${esc(h.output)}</code></div><p class="sgm-hyper-doc">${esc(h.doc||'These values together identify a measurement. Sharing only the metric does not merge two subjects, cohorts or windows.')}</p><div class="sgm-input-list"><span class="sgm-eyebrow">${h.inputs.length} shared inputs</span>${h.inputs.map(a=>`<button data-input="${esc(a)}">${esc(n.fields.find(f=>f.name===a)?.label||short(a))}<code>:${esc(a)}</code></button>`).join('')}</div><div class="sgm-native">${esc(h.origin)}</div>`;
      }else{
        const incoming=graph.refs.filter(r=>r.to===n.id),outgoing=graph.refs.filter(r=>r.from===n.id),hyper=graph.hyperedges.filter(h=>h.owner===n.id);
        body+=`<div class="sgm-relation-groups">${incoming.length?`<section><h3>Referenced by <small>${incoming.length}</small></h3>${incoming.map(r=>referenceRow(r,true)).join('')}</section>`:''}${outgoing.length?`<section><h3>References <small>${outgoing.length}</small></h3>${outgoing.map(r=>referenceRow(r,false)).join('')}</section>`:''}${!incoming.length&&!outgoing.length?'<p class="sgm-note">No type-specific reference declared.</p>':''}</div>${hyper.length?`<section class="sgm-derived-list"><h3>Derived & identified</h3>${hyper.map(h=>`<button data-open-hyper="${esc(h.id)}">${icon(h.kind==='computed'?'computed':'identity')}<span>${esc(h.title)}<small>${h.inputs.length} inputs · ${h.kind==='computed'?'computed':'unique tuple'}</small></span>${icon('arrow')}</button>`).join('')}</section>`:''}<details class="sgm-fields" ${current.edges.length?'':'open'}><summary>${n.fields.length} native fields</summary>${n.fields.map(showField).join('')}</details>${graph.refs.some(r=>r.to==='*')&&n.id!=='measurement'?'<button class="sgm-domain-wide" data-select="measurement">Measurements can refer to this domain '+icon('arrow')+'</button>':''}<details class="sgm-provenance"><summary>Schema provenance</summary><p>Fields, types, cardinality, uniqueness and tuple components come from <code>datom/schema</code>. Labels and reference targets come from the domain declaration. Computed dependencies come from <code>datom.query.relation</code>.</p></details>`;
      }
      inspector.innerHTML=body;
      inspector.hidden=!details;
      root.classList.toggle('sgm-no-details',!details);
      root.querySelector('[data-tool=details]').setAttribute('aria-pressed',String(details));
    }
    function nodeHTML(n){
      if(n.kind==='scope')return `<span class="sgm-node-top">∀ <small>domain scope</small></span><strong>${esc(n.title)}</strong><span class="sgm-node-bottom">${n.count} declared entity types</span>`;
      if(n.kind==='computed'||n.kind==='identity')return `<span class="sgm-junction-glyph">${icon(n.kind==='computed'?'computed':'identity')}</span><strong>${esc(n.title)}</strong><small>${n.hyper.inputs.length} inputs · one result</small>`;
      if(n.kind==='output')return `<span class="sgm-node-top">${n.hyper.kind==='computed'?'Computed result':'Unique identity'}</span><strong>${esc(n.title)}</strong><code>:${esc(n.namespace)}</code>`;
      const derivations=graph.hyperedges.filter(h=>h.owner===n.id);
      return `<span class="sgm-node-top"><code>:${esc(n.namespace)}</code><i>${n.fields.length} fields</i></span><strong>${esc(n.title)}</strong>${n.ports?`<span class="sgm-port-list">${n.ports.map(attr=>`<span data-port="${esc(attr)}"><b>${esc(n.fields.find(f=>f.name===attr)?.label||short(attr))}</b><small>${esc(n.fields.find(f=>f.name===attr)?.type||'')}</small></span>`).join('')}</span>`:`<span class="sgm-node-bottom">${graph.refs.filter(r=>r.from===n.id||r.to===n.id).length} references${derivations.map(h=>`<span class="sgm-mini-kind">${h.kind==='computed'?'✧':'◇'} ${h.kind==='computed'?'computed':'identity'}</span>`).join('')}</span>`}`;
    }
    function render(keepCamera=false){
      const epoch=++paintEpoch,version=zoomVersion;root.dataset.ready='0';
      current=scene(graph,state.selected,state.layer,state.lens,viewport.clientWidth<500?'vertical':'horizontal');
      root.dataset.selected=state.selected;root.dataset.layer=state.layer;root.dataset.lens=state.lens;
      root.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===state.layer)));
      root.querySelector('[data-tool=back]').disabled=!history.length;
      root.querySelector('[data-tool=domain]').setAttribute('aria-pressed',String(state.lens==='domain'));
      root.querySelector('.sgm-map-title').innerHTML=`<b>${state.lens==='domain'?'Whole domain':esc(byId.get(state.selected).title)}</b><span>${state.layer==='links'?'References':state.layer==='derived'?'Inputs → computation → result':'Components → tuple → identity'}</span>`;
      root.querySelector('.sgm-count').textContent=state.layer==='links'?`${current.nodes.filter(n=>n.kind==='entity').length} / ${graph.nodes.length} entities`:`${current.nodes.filter(n=>n.hyper&&n.kind!=='output').length} ${state.layer==='derived'?'computed relations':'compound identities'}`;
      canvas.style.width=current.width+'px';canvas.style.height=current.height+'px';
      const boundary=root.querySelector('.sgm-domain-boundary');boundary.style.width=(current.width-24)+'px';boundary.style.height=(current.height-36)+'px';
      nodesEl.innerHTML=current.nodes.map(n=>`<button class="sgm-node sgm-${n.kind} ${n.id===state.selected?'sgm-selected':''}" data-node="${esc(n.id)}" ${n.kind==='entity'?`aria-pressed="${n.id===state.selected}"`:''} aria-label="${esc(n.kind==='entity'?'Explore '+n.title:n.kind==='scope'?'Explore allowed subject types':n.title)}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;min-height:${n.h}px">${nodeHTML(n)}</button>`).join('');
      drawWires();renderInspector();
      requestAnimationFrame(()=>{if(epoch!==paintEpoch)return;if(version===zoomVersion)setZoom(keepCamera?'keep':'initial');announce();root.dataset.ready='1';});
    }
    function drawWires(){
      const points=new Map(current.nodes.map(n=>[n.id,n]));
      const marker=`sgm-arrow-${graph.id.replace(/[^a-z0-9_-]/gi,'')}`;
      wires.setAttribute('viewBox',`0 0 ${current.width} ${current.height}`);
      wires.innerHTML=`<defs><marker id="${marker}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>`+current.edges.map((e,i)=>{
        const a=points.get(e.from),b=points.get(e.to),forward=b.x>a.x;
        let x1=a.x+(forward?a.w:0),y1=a.y+a.h/2,x2=b.x+(forward?0:b.w),y2=b.y+b.h/2;
        if(e.port!==undefined){const owner=[...nodesEl.querySelectorAll('[data-node]')].find(n=>n.dataset.node===e.from),port=[...owner.querySelectorAll('[data-port]')].find(p=>p.dataset.port===e.part);y1=a.y+port.offsetTop+port.offsetHeight/2;}
        const peers=current.edges.filter(x=>x.from===e.from&&x.to===e.to&&x.port===undefined);
        if(peers.length>1){const rank=peers.indexOf(e)-(peers.length-1)/2;y1+=rank*34;y2+=rank*34;}
        const dx=Math.max(62,Math.abs(x2-x1)*.47);let d=`M${x1} ${y1}C${x1+(forward?dx:-dx)} ${y1},${x2+(forward?-dx:dx)} ${y2},${x2} ${y2}`;
        if(current.orientation==='vertical'&&e.port!==undefined){x1=a.x+a.w;x2=b.x+b.w/2;y2=b.y;d=`M${x1} ${y1}C${x1+50} ${y1},${x1+50} ${y2-40},${x2} ${y2}`;}else if(current.orientation==='vertical'){const down=b.y>a.y;x1=a.x+a.w/2;y1=a.y+(down?a.h:0);x2=b.x+b.w/2;y2=b.y+(down?0:b.h);const dy=Math.max(40,Math.abs(y2-y1)*.5);d=`M${x1} ${y1}C${x1} ${y1+(down?dy:-dy)},${x2} ${y2+(down?-dy:dy)},${x2} ${y2}`;}
        const label=e.label?`${e.attribute?short(e.attribute):e.label}${e.kind==='ref'?' · '+cardinality(e):''}`:'',cx=(x1+x2)/2,cy=(y1+y2)/2-10,lw=Math.min(238,label.length*5.7+18);
        return `<g class="sgm-wire sgm-wire-${e.kind}" data-edge="${esc(e.id)}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" role="button" tabindex="0" aria-label="${esc(e.attribute?e.attribute+' · '+cardinality(e):e.hyper?.title||label)}"><path class="sgm-wire-hit" d="${d}"/><path class="sgm-wire-line" d="${d}" ${e.port!==undefined?'':`marker-end="url(#${marker})"`}/>${label?`<g class="sgm-wire-label"><rect x="${cx-lw/2}" y="${cy-12}" width="${lw}" height="23" rx="10"/><text x="${cx}" y="${cy+3}" text-anchor="middle">${esc(label)}</text></g>`:''}<title>${esc(e.attribute||e.hyper?.output||label)}</title></g>`;
      }).join('');
      highlight(state.edge);
    }
    function highlight(id){hover=id||null;const ids=new Set(current.edges.filter(e=>e.id===id||e.from===id||e.to===id).map(e=>e.id));root.classList.toggle('sgm-has-highlight',!!id);wires.querySelectorAll('.sgm-wire').forEach(w=>w.classList.toggle('sgm-related',ids.has(w.dataset.edge)));nodesEl.querySelectorAll('.sgm-node').forEach(n=>n.classList.toggle('sgm-related',id? n.dataset.node===id||current.edges.some(e=>ids.has(e.id)&&(e.from===n.dataset.node||e.to===n.dataset.node)):false));}
    function setZoom(command){
      zoomVersion++;
      const focus=current.nodes.find(n=>n.id===state.selected)||current.nodes[0];
      if(command==='fit')zoom=Math.max(.15,Math.min(1,(viewport.clientWidth-24)/current.width,(viewport.clientHeight-24)/current.height));
      else if(command==='initial')zoom=Math.min(1,Math.max(innerWidth<720?.72:.8,(viewport.clientWidth-28)/current.width));
      else if(command==='in'||command==='out')zoom=Math.max(.2,Math.min(1.7,zoom+(command==='in'?.15:-.15)));
      canvas.style.transform=`scale(${zoom})`;sizer.style.width=current.width*zoom+'px';sizer.style.height=current.height*zoom+'px';
      root.classList.toggle('sgm-distant',zoom<.6);root.dataset.zoom=zoom.toFixed(2);
      if(command==='fit')viewport.scrollTo(0,0);else if(command==='initial')viewport.scrollTo(Math.max(0,(focus.x+focus.w/2)*zoom-viewport.clientWidth/2),Math.max(0,(focus.y+focus.h/2)*zoom-viewport.clientHeight/2));
    }
    function choose(id){
      if(id==='$scope'){if(state.edge!=='$scope')history.push({...state});state.edge='$scope';details=true;renderInspector();highlight('$scope');root.querySelector('[data-tool=back]').disabled=!history.length;emit();return;}
      const node=current.nodes.find(n=>n.id===id);
      if(node?.hyper){state.edge=node.hyper.id;renderInspector();highlight(state.edge);emit();return;}
      change({selected:id,edge:'',layer:'links'});
    }
    function selectEdge(id){if(state.edge!==id)history.push({...state});state.edge=id;details=true;renderInspector();highlight(id);root.querySelector('[data-tool=back]').disabled=!history.length;emit();}
    function openHyper(id){const h=graph.hyperedges.find(h=>h.id===id);if(h)change({selected:h.owner,layer:h.kind==='computed'?'derived':'identity',edge:id,lens:'neighbors'});}
    function expand(on){
      if(on===expanded)return;expanded=on;
      if(on)opener=document.activeElement;
      root.classList.toggle('sgm-expanded',on);root.setAttribute('role',on?'dialog':'region');
      if(on){root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Schema explorer');document.body.classList.add('sgm-immersed');}
      else{root.removeAttribute('aria-modal');document.body.classList.remove('sgm-immersed');}
      root.querySelector('[data-tool=expand]').setAttribute('aria-pressed',String(on));
      root.querySelector('[data-tool=expand]').setAttribute('aria-label',on?'Exit full screen':'Full screen');
      requestAnimationFrame(()=>{setZoom('initial');(on?root.querySelector('[data-tool=expand]'):opener)?.focus({preventScroll:true});});
    }
    root.addEventListener('click',e=>{
      const t=e.target.closest('button,[data-edge]');if(!t)return;
      if(t.dataset.node){choose(t.dataset.node);return;}
      if(t.dataset.edge){selectEdge(t.dataset.edge);return;}
      if(t.hasAttribute('data-clear-edge')){state.edge='';renderInspector();highlight('');emit();return;}
      if(t.hasAttribute('data-layer')){const layer=t.dataset.layer,kind=layer==='derived'?'computed':'identity';const owns=graph.hyperedges.filter(h=>h.owner===state.selected&&h.kind===kind),fallback=graph.hyperedges.find(h=>h.kind===kind);change({layer,edge:'',lens:'neighbors',selected:layer!=='links'&&!owns.length&&fallback?fallback.owner:state.selected});return;}
      if(t.dataset.zoom){setZoom(t.dataset.zoom);return;}
      if(t.dataset.openHyper){openHyper(t.dataset.openHyper);return;}
      if(t.dataset.select){choose(t.dataset.select);root.querySelector('.sgm-results').hidden=true;return;}
      if(t.dataset.selectEdge){selectEdge(t.dataset.selectEdge);return;}
      if(t.dataset.follow){if(t.dataset.follow==='$scope')choose('$scope');else change({selected:t.dataset.follow,edge:'',layer:'links'});return;}
      if(t.hasAttribute('data-allowed-types')){choose('$scope');return;}
      if(t.dataset.input){const input=t.dataset.input;state.edge='';renderInspector();const detail=root.querySelector('.sgm-fields');if(detail)detail.open=true;inspector.querySelectorAll('.sgm-field').forEach(f=>{if(f.querySelector('code')?.textContent===':'+input){f.classList.add('sgm-field-selected');f.scrollIntoView({block:'nearest',behavior:'smooth'});}});emit();return;}
      const tool=t.dataset.tool;if(!tool)return;
      if(tool==='back'&&history.length){state=history.pop();render();emit();}
      if(tool==='domain')change({lens:state.lens==='domain'?'neighbors':'domain',layer:'links',edge:''});
      if(tool==='highlight'){root.classList.toggle('sgm-show-labels');t.setAttribute('aria-pressed',String(root.classList.contains('sgm-show-labels')));}
      if(tool==='details'){details=!details;renderInspector();}
      if(tool==='expand')expand(!expanded);
      if(tool==='reset'){history=[];state={...initial};render();emit();}
    },{signal});
    root.addEventListener('dblclick',e=>{const b=e.target.closest('[data-node]');if(b&&byId.has(b.dataset.node))change({selected:b.dataset.node,lens:'neighbors',layer:'links',edge:''});},{signal});
    root.addEventListener('pointerover',e=>{const n=e.target.closest('[data-node],[data-edge]');if(n)highlight(n.dataset.node||n.dataset.edge);},{signal});
    root.addEventListener('pointerleave',()=>highlight(state.edge),{signal});
    root.addEventListener('focusin',e=>{const n=e.target.closest('[data-node],[data-edge]');if(n)highlight(n.dataset.node||n.dataset.edge);},{signal});
    root.querySelector('input[type=search]').addEventListener('input',e=>{
      const q=e.target.value.trim().toLowerCase(),list=root.querySelector('.sgm-results');list.hidden=!q;
      list.innerHTML=q?graph.nodes.filter(n=>(n.title+' '+n.namespace+' '+n.fields.map(f=>f.label+' '+f.name).join(' ')).toLowerCase().includes(q)).map(n=>`<button data-select="${esc(n.id)}">${esc(n.title)}<small>:${esc(n.namespace)}/*</small></button>`).join('')||'<p>No matching entity in this domain.</p>':'';
    },{signal});
    root.addEventListener('keydown',e=>{
      const typing=/input|textarea|select/i.test(e.target.tagName);
      if(e.key==='Escape'){if(!root.querySelector('.sgm-results').hidden){root.querySelector('.sgm-results').hidden=true;e.preventDefault();}else if(expanded){expand(false);e.preventDefault();e.stopPropagation();}return;}
      if(typing)return;
      if(expanded&&e.key==='Tab'){
        const focusable=[...root.querySelectorAll('button,input,select,textarea,summary,a[href],[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length),first=focusable[0],last=focusable.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      if(e.key.toLowerCase()==='g'){e.preventDefault();root.querySelector('[data-tool=domain]').click();}
      if(e.key.toLowerCase()==='h'){e.preventDefault();root.querySelector('[data-tool=highlight]').click();}
      if(e.key.toLowerCase()==='i'){e.preventDefault();root.querySelector('[data-tool=details]').click();}
      if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-edge]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
      if(e.target.matches('[data-node]')&&['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...nodesEl.querySelectorAll('button')],at=buttons.indexOf(e.target);buttons[(at+(['ArrowRight','ArrowDown'].includes(e.key)?1:buttons.length-1))%buttons.length].focus();}
    },{signal});
    viewport.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,[data-edge]'))return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('sgm-dragging');},{signal});
    viewport.addEventListener('pointermove',e=>{if(drag){viewport.scrollLeft=drag.left+drag.x-e.clientX;viewport.scrollTop=drag.top+drag.y-e.clientY;}},{signal});
    const stop=()=>{drag=null;viewport.classList.remove('sgm-dragging');};viewport.addEventListener('pointerup',stop,{signal});viewport.addEventListener('pointercancel',stop,{signal});
    viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(e.deltaY<0?'in':'out');}},{passive:false,signal});
    observer=new ResizeObserver(()=>{if(!current)return;const axis=viewport.clientWidth<500?'vertical':'horizontal';if(state.layer==='links'&&state.lens==='neighbors'&&current.orientation!==axis&&!(axis==='horizontal'&&!current.orientation)){render();return;}});observer.observe(viewport);
    render();
    return {destroy(){abort.abort();observer.disconnect();if(expanded)expand(false);},select(id){choose(id);},state(){return {...state};},fit(){setZoom('fit');}};
  }
  globalThis.SchemaGraph=Object.freeze({mount,scene,validate,cardinality});
})();
