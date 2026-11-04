# Schema relationships, explored

Load `kit/schema-graph.css`, then `kit/schema-graph.js`, from same-origin host
routes. Pass a trusted schema projection to `SchemaGraph.mount(element, graph,
options)`. The module is shared by the product and its dossier preview. It has
no network requests, model calls, code evaluation or business writes.

The graph contract is ordinary JSON:

```js
{
  id: 'company', title: 'Company', origin: 'datom/schema',
  nodes: [{id:'pilot', title:'Pilot', namespace:'pilot', fields:[
    {name:'pilot/partners', label:'Partners', type:'ref', target:'cooperative', many:true}
  ]}, {id:'cooperative', title:'Cooperative', namespace:'cooperative', fields:[]}],
  refs: [{id:'pilot/partners', attribute:'pilot/partners', from:'pilot',
    to:'cooperative', label:'Partners', many:true, required:false}],
  hyperedges: []
}
```

Types, `many`, uniqueness, indexes and tuple components come from the installed
schema. Entity grouping and names can come from the domain's declaration.
Reference target namespaces and requiredness are domain annotations, not native
Datom type enforcement. A target `'*'` is quantified over this owning domain.
It is never expanded to a pile of presumed concrete record relationships.

A hyperedge has `id`, `kind` (`computed` or `identity`), `owner` (an entity id),
`title`, `inputs` (attribute names), `output`, `origin`, and optional `doc`,
`unique` and `arity`. Computed inputs come from the registered relation's
`:reads`; composite inputs from native `:db/tupleAttrs`. One junction and all
its wires share one identity and one selection. Several inputs are not separate
independent rules. Unknown dependencies should remain unknown.

Options are `selected`, `layer` (`links`, `derived`, `identity`), `lens`
(`neighbors`, `domain`), `edge`, and a host-owned `onChange(state)` callback.
The callback can persist this navigation in the URL. The returned object has
`destroy`, `select`, `state`, and `fit`. Destroy before replacing the host's
DOM; it releases listeners, observers and fullscreen state. Supply one owning
domain per mount. Switching domains must select that domain's own graph.

```org
#+begin_screen_graph :id company-model :title "The model, connected" :src "/founder?view=model&context=umriden&type=cooperative&mode=graph" :start model
view model | Entity relationships
#+end_screen_graph
```

This embeds the exact app renderer. Navigation and view controls remain real
controls; the dossier owns only its surrounding review and feedback.

The graph inherits `--f-*` product tokens, with the standard dossier palette as
fallback. Entity cards retain stable identity, visible namespaces and field
counts. The selected card uses figure/ground contrast. Dashed lines mean domain
scope, rounded junctions mean shared computation or identity. Detail belongs in
the inspector, not every node. Search stays local to the owning domain. Tooltips
are supplementary; button names, focus order and cardinality labels carry the
meaning without colour. Reduced-motion preferences disable transitions.
