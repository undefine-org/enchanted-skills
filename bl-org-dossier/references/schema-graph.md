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

### Evidence and review as an optional inspector

Load `schema-review.css` and `schema-review.js` after the graph assets. The host
may attach the same source-backed examples and feedback inspector:

```js
let explorer;
const inspector = SchemaReview.create(graph, {
  api: {load: readOwnerSession, save: appendOwnerNote, export: exportDomainReview},
  onPanel: panel => explorer.inspect(panel),
  refresh: () => explorer.refreshInspector()
});
explorer = SchemaGraph.mount(root, graph, {inspector, panel: 'examples', onChange});
```

`inspector` is optional: hosts that omit it keep the original schema-only view.
Its `render(context)` receives graph, navigation state, selected node/reference/
hyperedge and `modelHTML`. `afterRender(element, context)` binds the current DOM;
`destroy` releases its listeners and polling. `inspect(panel)` and
`refreshInspector()` change only inspector presentation. `panel` belongs in the
host's shareable navigation state (`model`, `examples`, `review`).

Examples are contextual metadata on native nodes/references/hyperedges, never
additional edges or records inferred from labels. Each has stable `id`, `title`,
`kind` (`source-scenario`, `source-suggestion`, `stated-intention`,
`design-example`), `sources` (id/title/url/locator), and optional fields, inputs,
result. Keep all examples available; after the first three they collapse under
“more examples”. Nodes may also have `questions` and concrete `journeys` with
URLs to existing screens. Retain unknown values and dates on the source snapshot.
A computed example must use the registered native provider, not a copied answer.

The adapter owns authentication, CSRF, authority, persistence and provider calls.
`load()` returns `canReview`, `canExport`, `basis`, `revision`, `notes`, and
`drive: {status,url}`. `save(payload)` accepts id/domain/targetKind/target/kind/
body/basis and returns updated state. `export({domain,basis})` returns state only
after verified delivery. An HTTP error must reject with a safe user message.
Never expose credentials to the component. `deliveryMode: 'fixture'` visibly
labels simulated provider rehearsal. Without owner access, no note body or
write control is shown. No business schema mutation is implemented by this kit.

Targets are identified by domain + kind + key, including a whole hyperedge or
`scope/$scope`. Saved notes additionally carry trusted author, timestamp,
model basis and frozen context sources. Render bodies as text. Request ids make
exact retries idempotent. Persist before claiming saved; downloaded provider
bytes must match before claiming Drive verified. A model change makes old notes
visibly earlier-version feedback and new saves must use the current basis.

Desktop keeps the graph beside three inspector tabs. Phone gives each tab one
surface: Model returns to the graph; Examples and Review focus the selected
object. Drafts survive navigation and failed requests in local browser storage.
Same-owner polling updates note badges and saved notes while preserving a
focused draft. Read responses started before a save or export are discarded;
a delayed background request cannot undo the confirmed result in the UI.
This is not a multiuser authorization model.
