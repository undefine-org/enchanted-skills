/* Shared dossier comments: source anchors, quotations, same-origin screens.
 * This UI sends data only. Review text is always rendered as text, never HTML.
 */
(() => {
 'use strict';
 if(parent!==window){try{if(parent.document.getElementById('dossier-review')){document.querySelector('.review-standalone')?.remove();document.getElementById('dossier-review')?.remove();return}}catch{}}
 const panel=document.getElementById('dossier-review'),toggle=document.getElementById('review-toggle');
 if(!panel||!toggle)return;
 const fr=document.documentElement.lang==='fr',t=(a,b)=>fr?a:b;
 const $=s=>panel.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const form=$('.review-compose'),area=$('#review-body'),status=$('.review-status'),list=$('[data-review-list]'),context=$('[data-review-context]');
 const drafts=new Map(),storagePrefix='dossier-review:'+location.origin+location.pathname+':';
 let data=null,active={target:'document',label:document.title,view:new URL(location.href).searchParams.get('view')||''},replyTo='',filter='open',author='',pending=false,annotating=false,returnFocus=null,loading=false,epoch=0,focusThread='';
 const draftKey=(a=active,r=replyTo)=>JSON.stringify([a.target,a.view||'',a.component||'',a.quote||'',r]);
 function draft(key=draftKey()){
  if(!drafts.has(key)){let saved;try{saved=JSON.parse(localStorage.getItem(storagePrefix+key)||'null')}catch{}
   drafts.set(key,saved&&typeof saved.body==='string'?saved:{body:'',id:crypto.randomUUID()});}
  return drafts.get(key);
 }
 function persist(key,value){drafts.set(key,value);try{if(value.body)localStorage.setItem(storagePrefix+key,JSON.stringify(value));else localStorage.removeItem(storagePrefix+key)}catch{}}
 function capture(){if(pending)return;const key=draftKey(),old=draft(key);if(old.body!==area.value)persist(key,{body:area.value,id:crypto.randomUUID()});$('[data-review-draft]').textContent=area.value?t('Brouillon conservé','Draft kept'):'';form.querySelector('[type=submit]').disabled=pending||!data?.canComment||!area.value.trim()}
 function message(text){status.textContent=text}
 function targetElement(target){if(target==='document')return document.getElementById('doc')||document.querySelector('main')||document.body;return [...document.querySelectorAll('[data-review-target]')].find(el=>el.dataset.reviewTarget===target)}
 function textOf(el){const copy=el.cloneNode(true);copy.querySelectorAll('.review-trigger,script,style').forEach(n=>n.remove());return(copy.textContent||'').replace(/\s+/g,' ').trim()}
 function targetFrom(el,anchor,doc=document){
  const target=anchor||el.closest?.('[data-review-target]');if(!target)return null;
  const frame=doc.defaultView?.frameElement,view=frame?new URL(doc.location.href).searchParams.get('view')||'':el.closest?.('[data-view]')?.dataset.view||new URL(location.href).searchParams.get('view')||'';
  const component=el.closest?.('[data-ui-component]')?.dataset.uiComponent||'';
  return {target:target.dataset.reviewAmbiguous==='true'?'document':target.dataset.reviewTarget,label:target.dataset.reviewLabel||document.title,view,component,...(target.dataset.reviewAmbiguous==='true'?{quote:textOf(target).slice(0,2000)}:{})};
 }
 function selectContext(next,{reply='',thread='',focus=true}={}){
  if(pending)return;capture();active=Object.fromEntries(['target','label','view','component','quote','prefix','suffix','basis'].filter(k=>next[k]!==undefined&&next[k]!==null).map(k=>[k,next[k]]));replyTo=reply;focusThread=thread;area.value=draft().body;
  $('[data-review-cancel-reply]').hidden=!replyTo;form.hidden=!data.canComment;form.querySelector('label').textContent=replyTo?t('Votre réponse','Your reply'):t('Votre commentaire','Your comment');
  render();open(focus);if(annotating)setAnnotation(false);capture();
 }
 function open(focus=true){if(panel.hidden)returnFocus=document.activeElement;panel.hidden=false;toggle.setAttribute('aria-expanded','true');queuePins();if(focus)(data?.canComment?area:$('.review-head button')).focus({preventScroll:true})}
 function close(){capture();panel.hidden=true;toggle.setAttribute('aria-expanded','false');setAnnotation(false);queuePins();returnFocus?.isConnected&&returnFocus.focus({preventScroll:true})}
 function setAnnotation(on){annotating=on;document.body.toggleAttribute('data-review-mode',on);$('[data-review-annotate]').setAttribute('aria-pressed',String(on));for(const frame of document.querySelectorAll('iframe')){try{frame.contentDocument?.documentElement.toggleAttribute('data-review-mode',on)}catch{}}message(on?t('Cliquez sur un passage ou un élément d’écran.','Choose a passage or screen element.'):data?.canComment?t('Commentaires enregistrés dans le document.','Comments are saved in the document.'):t('Lecture seule · accès commentaire requis.','Read only · comment access required.'))}
 function date(value){if(!value)return t('Dans la source','In source');const parsed=new Date(value.replace(/^~U\[|\]$/g,''));return Number.isNaN(parsed.valueOf())?value:new Intl.DateTimeFormat(document.documentElement.lang,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(parsed)}
 function goTo(note){
  const el=targetElement(note.target);if(!el){message(t('Le passage a été modifié. Le contexte original est conservé.','The passage changed. Its original context is kept.'));return}
  const section=el.closest('section.part');if(section&&section.hidden)location.hash=section.id;
  if(note.view){const frame=el.querySelector('iframe.source-frame,iframe.cl-frame');if(frame){try{const url=new URL(frame.src,location.href);if(url.origin===location.origin){url.searchParams.set('view',note.view);frame.src=url.href}}catch{}}
   else{const button=[...el.querySelectorAll('[data-sg-to]')].find(b=>b.dataset.sgTo===note.view);button?.click()}}
  requestAnimationFrame(()=>{el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});el.classList.add('review-hit');setTimeout(()=>el.classList.remove('review-hit'),2200)});
 }
 function changed(note){const el=targetElement(note.target);if(note.detached||!el)return true;if(note.quote&&!note.view)return !textOf(el).includes(note.quote);return false}
 function render(){
  if(!data)return;
  const roots=data.comments.filter(n=>!n.replyTo),shown=roots.filter(n=>(filter==='all'||n.state===filter)&&(!author||n.author===author||data.comments.some(r=>r.replyTo===n.id&&r.author===author)));
  const scoped=active.target==='document'?shown:shown.filter(n=>n.target===active.target&&(!active.view||!n.view||n.view===active.view));
  const viewElement=[...document.querySelectorAll('[data-source-view-id],[data-view]')].find(el=>(el.dataset.sourceViewId||el.dataset.view)===active.view);const viewLabel=viewElement?.dataset.sourceViewTitle||viewElement?.dataset.title||(active.view||'').replaceAll('-',' ');
  context.innerHTML=`<div class="review-context"><strong>${esc(replyTo?t('Réponse à une discussion','Reply to discussion'):active.label||document.title)}</strong>${active.view?`<p>${esc(t('Écran : ','Screen: ')+viewLabel)}</p>`:''}${active.quote?`<p>« ${esc(active.quote)} »</p>`:''}${active.target!=='document'?`<button type="button" data-review-whole>${esc(t('Tous les commentaires du document','All document comments'))}</button>`:''}</div>`;
  list.innerHTML=scoped.map(n=>{
   const replies=data.comments.filter(r=>r.replyTo===n.id),mayResolve=data.canComment&&(data.owner||n.author===data.author);
   return `<article class="review-thread ${focusThread===n.id?'is-active':''}" id="review-${esc(n.id)}" data-review-thread="${esc(n.id)}"><header><strong>${esc(n.author)}</strong><time>${esc(date(n.created))}</time></header>${n.quote?`<blockquote>${esc(n.quote)}</blockquote>`:''}${changed(n)?`<small class="review-changed">${esc(t('Passage modifié · contexte original conservé','Passage changed · original context kept'))}</small>`:''}<p class="review-body">${esc(n.body)}</p><div class="review-thread-actions"><button type="button" data-review-goto="${esc(n.id)}">${esc(t('Voir le passage','Show passage'))}</button>${data.canComment?`<button type="button" data-review-reply="${esc(n.id)}">${esc(t('Répondre','Reply'))}</button>`:''}${mayResolve?`<button type="button" data-review-state="${esc(n.id)}" data-review-action="${n.state==='resolved'?'reopen':'resolve'}">${esc(n.state==='resolved'?t('Rouvrir','Reopen'):t('Résoudre','Resolve'))}</button>`:''}<button type="button" data-review-link="${esc(n.id)}">${esc(t('Lien','Link'))}</button></div>${replies.map(r=>`<div class="review-reply"><header><strong>${esc(r.author)}</strong><time>${esc(date(r.created))}</time></header><p class="review-body">${esc(r.body)}</p></div>`).join('')}</article>`;
  }).join('')||`<p class="review-empty">${esc(t('Aucun commentaire dans cette sélection.','No comments in this selection.'))}</p>`;
  const names=[...new Set(data.comments.map(n=>n.author))].sort(),select=$('[data-review-author]');
  select.innerHTML=`<option value="">${esc(t('Tous les auteurs','All authors'))}</option>`+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');select.value=author;
  form.hidden=!data.canComment;form.querySelector('label').textContent=replyTo?t('Votre réponse','Your reply'):t('Votre commentaire','Your comment');area.disabled=!data.canComment||pending;form.querySelector('[type=submit]').disabled=!data.canComment||pending||!area.value.trim();
  decorateCounts();queuePins();
 }
 function decorateCounts(){if(!data)return;toggle.dataset.count=String(data.comments.filter(n=>!n.replyTo&&n.state!=='resolved').length);for(const el of document.querySelectorAll('[data-review-target]')){
  const b=[...el.children].find(n=>n.matches('.review-trigger'));if(!b)continue;const count=data.comments.filter(n=>n.target===el.dataset.reviewTarget&&!n.replyTo&&n.state!=='resolved').length;
  const label=count?String(count):'';const number=b.querySelector('.review-count');if(number&&number.textContent!==label)number.textContent=label;b.classList.toggle('has-notes',count>0);b.setAttribute('aria-label',t('Commenter : ','Comment on: ')+(el.dataset.reviewLabel||document.title)+(count?` · ${count}`:''));
 }}
 async function request(payload){const response=await fetch('review',{cache:'no-store',...(payload?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});const text=await response.text();let value;try{value=JSON.parse(text)}catch{}if(!response.ok||!value?.ok)throw Error(value?.error||t(`Échec HTTP ${response.status}. Le brouillon est conservé.`,`HTTP ${response.status}. Your draft is kept.`));return value}
 async function load(){if(loading||pending)return;loading=true;const version=epoch;try{const next=await request();if(version!==epoch)return;const initial=!data,hasChanged=!data||next.revision!==data.revision||next.canComment!==data.canComment;data=next;if(hasChanged)render();if(initial)message(data.canComment?t('Commenter en tant que ','Commenting as ')+data.author:t('Lecture seule · accès commentaire requis.','Read only · comment access required.'))}catch(e){message(e.message)}finally{loading=false}}
 async function save(payload,key){if(pending)return;pending=true;epoch++;render();message(t('Enregistrement…','Saving…'));try{
  data=await request(payload);if(key){persist(key,{body:'',id:crypto.randomUUID()});if(key===draftKey())area.value=''}
  replyTo='';$('[data-review-cancel-reply]').hidden=true;message(t('Enregistré dans le document.','Saved in the document.'));render();capture();
 }catch(e){message(e.message)}finally{pending=false;render();capture()}}
 form.addEventListener('submit',e=>{e.preventDefault();capture();const key=draftKey(),d=draft(key);if(!d.body.trim()||!data?.canComment)return;save({action:replyTo?'reply':'comment',id:d.id,body:d.body,...active,...(replyTo?{replyTo}:{})},key)});
 area.addEventListener('input',capture);
 toggle.addEventListener('click',()=>{if(panel.hidden){active={target:'document',label:document.title,view:new URL(location.href).searchParams.get('view')||''};area.value=draft().body;render();open()}else close()});
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-review-close'))return close();
  if(b.hasAttribute('data-review-annotate'))return setAnnotation(!annotating);
  if(b.hasAttribute('data-review-whole'))return selectContext({target:'document',label:document.title});
  if(b.hasAttribute('data-review-cancel-reply'))return selectContext(active);
  const id=b.dataset.reviewReply||b.dataset.reviewGoto||b.dataset.reviewState||b.dataset.reviewLink,n=data?.comments.find(n=>n.id===id);if(!n)return;
  if(b.dataset.reviewReply)return selectContext({...n,label:targetElement(n.target)?.dataset.reviewLabel||t('Discussion','Discussion')},{reply:n.id,thread:n.id});
  if(b.dataset.reviewGoto)return goTo(n);
  if(b.dataset.reviewState)return save({action:b.dataset.reviewAction,id:n.id});
  if(b.dataset.reviewLink){const url=new URL(location.href);url.hash='review-'+n.id;navigator.clipboard?.writeText(url.href).then(()=>message(t('Lien copié.','Link copied.'))).catch(()=>message(url.href));history.replaceState(null,'',url.hash)}
 });
 $('[data-review-filter]').addEventListener('change',e=>{filter=e.target.value;render()});$('[data-review-author]').addEventListener('change',e=>{author=e.target.value;render()});
 const selectionButton=document.createElement('button');selectionButton.id='review-selection';selectionButton.type='button';selectionButton.textContent=t('Commenter la sélection','Comment on selection');selectionButton.hidden=true;document.body.append(selectionButton);let selected=null;
 function selection(doc,anchor){const sel=doc.getSelection();if(!sel||sel.isCollapsed||!sel.toString().trim()){if(doc===document&&!selectionButton.matches(':focus'))selectionButton.hidden=true;return}
  const range=sel.getRangeAt(0),el=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;if(el.closest?.('#dossier-review,.review-trigger'))return;
  const context=targetFrom(el,anchor,doc);if(!context)return;const target=anchor?el.closest('[data-ui-component]')||doc.body:el.closest('[data-review-target]');if(!target?.contains(range.startContainer)||!target.contains(range.endContainer))return;
  const before=range.cloneRange();before.selectNodeContents(target);before.setEnd(range.startContainer,range.startOffset);const after=range.cloneRange();after.selectNodeContents(target);after.setStart(range.endContainer,range.endOffset);
  selected={...context,quote:sel.toString().replace(/\s+/g,' ').trim().slice(0,2000),prefix:before.toString().replace(/\s+/g,' ').slice(-120),suffix:after.toString().replace(/\s+/g,' ').slice(0,120)};
  const r=range.getBoundingClientRect(),f=doc.defaultView?.frameElement?.getBoundingClientRect();selectionButton.style.left=Math.max(8,Math.min(innerWidth-220,r.left+(f?.left||0)))+'px';selectionButton.style.top=Math.max(8,Math.min(innerHeight-45,r.bottom+(f?.top||0)+8))+'px';selectionButton.hidden=false;
 }
 selectionButton.addEventListener('mousedown',e=>e.preventDefault());selectionButton.addEventListener('click',()=>{if(selected)selectContext(selected);selectionButton.hidden=true});

 const pinDocs=new Map(),pinLayers=new WeakMap();let pinsQueued=false;
 function noteElement(note,doc,anchor){
  let root=anchor?doc.body:targetElement(note.target);if(!root)return null;
  if(anchor){if(note.target!==anchor.dataset.reviewTarget)return null;const view=new URL(doc.location.href).searchParams.get('view')||'';if(note.view&&note.view!==view)return null}
  else if(note.view){const view=[...root.querySelectorAll('[data-view]')].find(el=>el.dataset.view===note.view);if(!view||!view.getClientRects().length)return null;root=view}
  if(note.component){const matches=[...root.querySelectorAll('[data-ui-component]')].filter(el=>el.dataset.uiComponent===note.component&&(!note.quote||textOf(el).includes(note.quote)));return matches.length===1?matches[0]:null}
  if(note.quote&&note.view){const matches=[...root.querySelectorAll('button,a,td,th,p,h1,h2,h3,label')].filter(el=>textOf(el)===note.quote);if(matches.length===1)return matches[0]}
  return root;
 }
 function paintPins(doc,anchor){
  let layer=pinLayers.get(doc);if(!layer){layer=doc.createElement('div');layer.className='review-pin-layer';layer.setAttribute('aria-label',t('Commentaires sur cet écran','Comments on this screen'));doc.body.append(layer);pinLayers.set(doc,layer)}
  const roots=(data?.comments||[]).filter(n=>!n.replyTo),positions=[];
  if(!panel.hidden)roots.forEach((note,index)=>{if(note.state==='resolved'||note.detached)return;const el=noteElement(note,doc,anchor);if(!el||!el.getClientRects().length)return;const r=el.getBoundingClientRect(),height=doc.defaultView.innerHeight,width=doc.defaultView.innerWidth;if(r.bottom<0||r.top>height||r.right<0||r.left>width)return;positions.push({note,index,x:Math.max(4,Math.min(width-25,r.left+6)),y:Math.max(4,Math.min(height-25,r.top+3))})});
  const signature=JSON.stringify(positions.map(p=>[p.note.id,p.index,Math.round(p.x),Math.round(p.y)]));if(layer.dataset.signature===signature)return;layer.dataset.signature=signature;layer.replaceChildren();
  for(const {note,index,x,y}of positions){const b=doc.createElement('button');b.type='button';b.className='review-pin';b.dataset.reviewPin=note.id;b.textContent=String(index+1);b.style.left=x+'px';b.style.top=y+'px';b.setAttribute('aria-label',t('Commentaire ','Comment ')+(index+1)+' · '+note.author);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectContext({...note,label:targetElement(note.target)?.dataset.reviewLabel||document.title},{thread:note.id});requestAnimationFrame(()=>document.getElementById('review-'+note.id)?.scrollIntoView({block:'nearest'}))});layer.append(b)}
 }
 function queuePins(){if(pinsQueued)return;pinsQueued=true;requestAnimationFrame(()=>{pinsQueued=false;for(const [doc,anchor]of pinDocs){try{if(!doc.defaultView?.frameElement&&doc!==document){pinDocs.delete(doc);continue}paintPins(doc,anchor)}catch{pinDocs.delete(doc)}}})}

 const bound=new WeakSet();
 function bind(doc,anchor){if(bound.has(doc))return;bound.add(doc);pinDocs.set(doc,anchor);doc.addEventListener('scroll',queuePins,true);doc.defaultView.addEventListener('resize',queuePins);if(doc!==document)doc.defaultView.addEventListener('pagehide',()=>pinDocs.delete(doc),{once:true});doc.addEventListener('mouseup',()=>setTimeout(()=>selection(doc,anchor),0));doc.addEventListener('keyup',e=>{if(e.key==='Shift'||e.key.startsWith('Arrow'))selection(doc,anchor)});
  doc.addEventListener('click',e=>{if(!annotating||e.target.closest?.('#dossier-review,#review-toggle,#review-selection,.review-trigger,.review-pin'))return;const next=targetFrom(e.target,anchor,doc);if(!next)return;e.preventDefault();e.stopImmediatePropagation();const leaf=e.target.closest?.('[data-ui-component],button,a,td,th,p,h1,h2,h3,label')||e.target;next.quote=textOf(leaf).slice(0,2000);selectContext(next);},true);
 }
 function decorate(){
  if(!document.querySelector('[data-review-target]')){const root=document.querySelector('main,.app')||document.body;root.dataset.reviewTarget='document';root.dataset.reviewLabel=document.title}
  for(const el of document.querySelectorAll('[data-review-target]')){el.classList.add('review-target');if([...el.children].some(n=>n.matches('.review-trigger')))continue;const b=document.createElement('button');b.type='button';b.className='review-trigger';const icon=$('#review-icon')?.content.firstElementChild;if(icon)b.append(icon.cloneNode(true));const number=document.createElement('span');number.className='review-count';b.append(number);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectContext(targetFrom(el))});el.append(b)}
  for(const frame of document.querySelectorAll('iframe')){if(frame.dataset.reviewBound)continue;frame.dataset.reviewBound='true';const attach=()=>{try{if(frame.contentWindow.location.origin!==location.origin||!frame.contentDocument?.body)return;const anchor=frame.closest('[data-review-target]');if(!anchor)return;frame.contentDocument.querySelector('.review-standalone')?.remove();frame.contentDocument.getElementById('dossier-review')?.remove();bind(frame.contentDocument,anchor);const style=frame.contentDocument.createElement('style');style.textContent='html[data-review-mode] *{cursor:crosshair!important}';frame.contentDocument.head.append(style);frame.contentDocument.documentElement.toggleAttribute('data-review-mode',annotating);queuePins()}catch{}};frame.addEventListener('load',attach);attach()}
  decorateCounts();queuePins();
 }
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate()})}).observe(document.getElementById('doc')||document.querySelector('main')||document.body,{childList:true,subtree:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();close()}});
 addEventListener('beforeunload',capture);bind(document);decorate();load();setInterval(()=>{if(document.visibilityState!=='hidden')load()},3000);
 const linked=location.hash.match(/^#review-([A-Za-z0-9_-]+)$/);if(linked){const wait=setInterval(()=>{if(!data)return;clearInterval(wait);const note=data.comments.find(n=>n.id===linked[1]);if(note){active={target:note.target,label:targetElement(note.target)?.dataset.reviewLabel||document.title,view:note.view};focusThread=note.id;filter='all';$('[data-review-filter]').value='all';render();open(false);goTo(note);requestAnimationFrame(()=>document.getElementById('review-'+note.id)?.scrollIntoView({block:'center'}))}},100);setTimeout(()=>clearInterval(wait),15000)}
})();
