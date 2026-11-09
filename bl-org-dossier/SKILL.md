---
name: bl-org-dossier
description: Write a design / architecture / taste dossier as a .bl.org file that renders as a live, mobile-first page with semantic components (jobs, phone screens, sequences, graphs, rosettas, matrices, decisions, questions) and executable Beam Lisp cells — and that writes the reader's answers back into the file so Claude can read them. Use when Othman asks for a dossier, design review, proposal, report, "show me the app you imagine", or any decision document he should react to, especially from his phone.
---

# .bl.org dossiers that talk back

A dossier is **one `.bl.org` file**. It is the source, the page, the
executable spec and the answer sheet. A small Beam Lisp server (the kit, next
to this file) renders it with the real `bl.doc.spans` partition, publishes it on
the tailnet, and writes every answer the reader gives into the block it answers.
No database, no second copy: `git diff` shows what Othman said.

Exemplar, read it before writing a new one:
`~/projects/tiny-tools/mobile-app/dossier/pocket-harness.bl.org` (renamed from baton.bl.org on 2026-10-31).
A desktop-heavy exemplar with desks and an executable lifecycle:
`~/projects/knowledger-interface-review/docs/reports/interface-review-20261031/knowledger-interface.bl.org`.
House taste it descends from: `~/code/undefine/omega/spikes/mobile/design-review/design-review.bl.org`.

## The loop

1. Research first. Ground every claim in a file path, a command you ran, or a cited source.
2. Write `NAME.bl.org` (structure below). Cells get no hand-written `#+RESULTS` — let `bl doc run` write them.
3. `bl doc run FILE.bl.org` then `bl doc run FILE.bl.org --check` (exit 0 = cells green and results current).
4. Look at it at phone width before claiming anything (see *Seeing it*).
5. Publish:
   ```sh
   work serve NAME --http auto --cwd ~/.claude/skills/bl-org-dossier/kit \
     --env-file ~/.config/baton-dossier/service.env --ready-timeout 120 \
     -- /etc/profiles/per-user/othman/bin/bl serve serve.bl -- /abs/path/NAME.bl.org
   ```
   The env file holds `DOSSIER_OWNER=` the owner's Tailscale login; only that
   identity may answer (Serve sets `Tailscale-User-Login`; verified 2026-10-31).
   `DOSSIER_HANDLE=timinou` is the name answers carry in `:by`; a login (an
   email) is never written into the file.
   The server re-reads the file per request: editing the `.bl.org` needs no restart.
   Editing the kit's `.bl` code does: `work restart NAME`.
6. Read the answers:
   ```sh
   bl run ~/.claude/skills/bl-org-dossier/kit/answers.bl -- /abs/path/NAME.bl.org
   ```
   Answers live on the block header: `:answer B :at "2026-10-31 17:14" :note "…"`.
   Act on them, update the dossier (flip a decision's `:status decided`, move a
   roster heading to DONE), and say what changed.

## Shape (Othman's taste)

Open with the thesis, end with what he must decide. In between, earn each section.

- `#+title:` names the thing and its promise. `#+subtitle:` one sentence. `#+kicker:` where it lives. `#+status:` honest (*Proposal · nothing built yet*).
- **In one breath** — `lede` + `stats`. Two short paragraphs, four numbers.
- **Define the words** — `terms` for every noun you will lean on. If a phrase like "seamless" carries the request, split it into the separate promises it hides, and say what it never means (`honest`).
- **Jobs** — one `job` per moment of use, each with the reference product's way and one decision.
- **Screens** — `screen` blocks, drawn from text. Real names, real repos, real machines from the actual environment — never lorem ipsum.
- **How it really works** — `sequence` for anything crossing a wire; `graph` for topology; `rosetta` for one idea across several systems.
- **The model, executable** — Beam Lisp cells with `assert`s that pin the design's invariants. The result printed under each cell is the proof.
- **Prior art** — `matrix`, sources listed, third-party claims labeled as from docs.
- **Decisions** (`decision`, with the rejected options visible) → **Questions** (`ask`) → **Roster** (`* TODO`/`DONE` headings with `:PROPERTIES:` `:JOBS: :AREA: :PROTO:`).
- Copy is short. Placement and weight carry state. No marketing adjectives. Say what is unverified.

For system and deployment reviews, make relationships visible before explaining
them: machine boundaries, dependency connectors, artifact shapes, release
markers and freshness can carry information that otherwise becomes rows of
prose. Prefer projecting these views from the declaration or executable model
already used by the design; keep observed facts separate from simulated state.
An interactive control should reveal a consequence (for example, which public
path survives a development machine going offline), with its result visible
near the control on a phone. Put supporting explanations in details. Retain
short labels and accessible names; color or an icon alone is not enough.

## Components

For Knowledger work, register every proposed new product component in a catalog
inside the `.bl.org` dossier before implementing it in the app or kit. Give it a
stable ID, a rendered specimen using the existing design language, its states
(including waiting, empty, failure and read-only where relevant), and its next
action. Link implementation roster items to that catalog entry. Keep proposed
and accepted entries distinct; a proposal is not approval. Prefer composing the
existing kit vocabulary before adding a renderer primitive.

Header attributes: `:key value` or `:key "quoted value"`. Bodies are line languages; `a | b | c` rows unless noted.

| Block | Body | Renders |
|---|---|---|
| `lede` | prose | large serif opening |
| `stats` | `value \| label \| note` | stat tiles |
| `terms` | `term \| meaning` | definition list |
| `principles` | `title \| text` | numbered cards |
| `note` / `warning` / `honest` (`:title`) | prose | callouts (slate / clay / ochre) |
| `rosetta` | first row = headers | aligned table; cards on a phone |
| `matrix` | first row = headers; cells `y`, `~`, `n` + optional words | dot matrix with legend |
| `roadmap :id :title` | `now \| title \| detail \| ref` (now, next, later) | three columns: what is built, what comes next, what waits |
| `job :id :title :codex :claude :decision :screen` | the JTBD sentence | job card + answer |
| `decision :id :title :status proposed\|decided` | `- [x] chosen`, `- [ ] rejected`, then rationale | decision card + Agree/Rework/Disagree |
| `ask :id :title :options "A\|B\|C"` | context | question card + options |
| `explorer :id :title :src "/explorer"` | `view ID \| Label \| family:State state:waiting` | same-origin live component Explorer, named query views and full-page link; host discovers and invokes production functions from annotations, no copied specimens |
| `screen :id :title :job :caption [:theme dark]` | screen language (below) | phone mock + reaction; consecutive screens form a swipeable strip |
| `screen_graph :id :title [:start VIEW] :caption` | `view ID \| title \| context`, desk/screen lines with `[[view:TARGET][@icon Label]]` in the actual controls | full app prototype; hover tools reveal links, expand to full screen, or switch to a connected graph of screen thumbnails; feedback writes into the block header |
| `desk :id :title :job :caption [:url]` | desk language (below) | a desktop app frame + reaction; same answer buttons as screens |
| `sequence :title` | `lanes a · sub \| b · sub`, `a -> b : label` (call), `a --> b : label` (reply), `a => b : label` (the key moment), `note a, b : text`, `== divider` | SVG on wide screens, numbered steps on phones |
| `graph :title` | `node id \| label \| sub \| col,row \| tone` (`you door station builder foreign`), `edge a -> b \| label \| style` (`baton solid dash none`; `<->`, `--` too) | SVG topology |
| `schema :id :title` | unindented `entity @icon \| gloss`; indented `attr type \| note`. Types: `text date`, `-> kind` (ref), `->> kind` (many), `a > b / c` (state flow), `a, b, c` (enum) | entity cards, refs link to `#entity-NAME`, a count of entities · attributes · states; answerable |
| `ontology_graph`, `settings_graph`, `code_graph` | Rich connected review cards: meaning, current/proposed behavior, typed fields, evidence, checks and labelled edges | Uses the [codebase-review host and grammar](../codebase-review/references/blocks.md); reuse the graph navigator for architectural reviews, rather than drawing a database schema or inventing product UI |
| `settings_pages` | `page ID \| title \| purpose \| icon`, `group title`, `setting label \| value`, optional `source`, plus `local` and `personal` scope explanations | A simple page map and selectable contents; use the codebase-review host when reviewing where settings belong |
| `procedure :id :title :makes` | the ensemble line language: `step`, `call` (code: `ns/fn`), `check`, `gate`, `route` (`role · rule \| name` binds a person), each `VERB @icon Title \| who \| output · kind · draft · auto, …`; other lines are prose | a step rail, checks dashed, gates as diamonds; answerable |
| `run :id :procedure :as :title` | `team role person … \| role person …`, optional `load person n \| …`, then `fact KIND \| target \| by \| verdict-or-note \| says` lines (`drafted shared handed-over asked-change checked called routed`) | **a person's phone screen generated from the procedure and its facts**: step rail, asks, harness chips, the next gate; joins screen strips; answerable. Prefer it to a hand-drawn `screen` whenever a procedure exists (ensemble's `format`/`run` are vendored in `kit/ensemble/`) |
| `horizons :id :now :title` | `horizon NAME \| start \| end` (the team's own horizons, widest first), `goal HORIZON \| title \| date \| a/b` (date and progress optional) | a telescope: each band is the magnified now of the one above, joined by a funnel; goals on their band, progress as an arc, undated goals on the dashed someday edge; answerable |
| `film :id :title :run :src` | prose (the experience it establishes); `missing @icon Beat \| why` lines for beats not filmed yet | a filmed `scenario.demo` run read from `:run` (its output folder, relative to the dossier): the movie (`:src`) with a chapter per scene, each scene's narration, steps and claims with their verdicts, and the gaps computed from the run (a scene that proves nothing, a gesture after its scene's last claim, a claim not witnessed, no movie yet) plus the declared ones; answerable. The server reads the run (`dossier.film/enrich`); the page stays pure |
| `milestones :id :title :start` | `milestone ID \| state \| title \| lane`, then `needs`, `step`, `check`, `gate` | clickable map and one milestone's steps, dependencies, completion criteria and access gates; selection survives live refresh; feedback remains explicit |
| `roster :id :source :title :start :who` | Ordinary Org task headings and their drawers, read from `:source` by the connected review host | A live work list with filters, inline evidence, blockers, next action, task notes and explicit roster approval; see Org-native rosters below |
| `witness :id :title :run :frames` | optional `:scope` describes what was exercised | actual Scenario Runner claims paired with their recorded browser frames, one at a time; timestamp, verdicts, full-size frame link and feedback; no fabricated movie |

A `schema` or `procedure` block is also the source a cell can compile: `bl doc run`
passes the file in `(BeamLisp/argv)`, so a cell can read its own block and turn it into
datom attributes or tasks (exemplar: `team-machine/design/work/WORK.bl.org`, cells `spine`, `procedure`).

Screen language, one verb per line: `bar Title | right` (`< Title` adds back), `sub`, `chips a* | b` (`*` = selected),
`section Label | count`, `card tone | title | meta | body` (tones `turn approve run done fail idle`),
`ask`, `actions Primary! | Plain | Quiet? | Danger^`, `msg you|agent | text`, `tool label | detail`,
`diff +12 −3 | path`, `code text`, `strip tone | text | button`, `row label | value`, `banner warn|ok | text`,
`dest icon | title | body`, `note`, `spacer`, `input placeholder | ↑`, `tabs A* | B`,
`lock time | date` + `notif app | title | body | Action, Action` (with `:theme dark`),
`sheet Title` — everything after it sits in a bottom sheet over the screen.
`card tone | title | meta | body | @check! @x @next?` — a fifth column puts icon-only actions on the card
(say what is needed in the card, keep the actions as icons; Othman finds button rows hard to parse),
`machine tone | @server name | role | detail | right` (tones `up busy asleep you`),
`search placeholder` + `pick @folder name* | detail | right` (a project picker, `*` = chosen),
`listen hint` (mic + waveform), `heard transcript`, `intent @send Verb | target | text` (voice),
`choices A | B* | C` (a multiple-choice ask, `*` = picked), `reply placeholder` (a free-text answer with mic and send).
Side facts on `pick` and `machine` flow into the text; card actions sit under the words.

Monitoring mockups also support these native lines in screens, desks and the
connected explorer. They use real same-origin screenshot assets and ordinary
`[[view:...][...]]` actions, so navigation stays inspectable in the screen graph:

- `service state | id | qualified name | port / machine | /media/image.png | metadata | actions`
- `deployment state | id | title | static/live | environment | domain | picture (optional) | actions`
- `storage state | id | title | datom/files | bound path | retention / observation | actions`
- `environment state | id | title | live/simulation | detail | actions` (`future` suppresses actions)
- `binding matched/unmatched/ambiguous | env.bl | endpoint | .foundry.bl`

The public `dossier.ui/{service,deployment,storage,environment,binding}-h`
functions accept the same facts as maps for model-driven hosts. Reuse them in
the prototype and component specimens. Captured images are not live health;
unknown measurements omit the meter. Preserve owner authorization when
selecting screenshots, and keep internal aliases distinct from public domains.
After a model-driven host changes available controls, dispatch a bubbling
`dossier:prototype-updated` event from its `.screen-graph`. The explorer rebuilds
routes/thumbnails from those actual controls while retaining navigation state.

Desk language — every screen verb, plus desktop regions and a document:
`nav @home Accueil* | @matter Affaires` (sidebar, `*` = here), `crumb a › b`,
`head Title | tone · Status | Action! | Other?` (the action slot, top right), `meta a | b`, `tabs`,
`col doc|rail|main` (columns; `doc` draws paper; repeat `col main` for a row of cards),
`page Title`, `para text` with `{+inserted+}` `{-deleted-}` `{~proposed~}` `{!to verify!}` `‹P-01›` (source chip) `^1` (comment anchor),
`point tone | @icon kind | title | body | Option* | Option`, `comment 1 | who | text` (same number as its `^1`), `opts A* | B`.
Lines before the first `col` span the full width. Desks use Knowledger's Warm Signal palette (lamp in dark mode).

Icons: `@name` anywhere in a screen or desk line draws a line icon — `home matter library playbook people audit settings
search plus send file word check x alert clock user bot chat comment link seal eye edit version diff filter more back next
down up bell wait calendar scale flag play undo lock attach grid list board split spark`. Prefer an icon to a word for kinds of things.

Answerable blocks: `ask decision screen screen_graph run desk job schema procedure film horizons`. Each needs a unique `:id`.

### Screen graphs

Use a `screen_graph` to experience the app, not a strip of miniature screens
with navigation buttons underneath. Draw a full app: navigation, header,
content and context column. Put `[[view:ID][Label]]` on the actual card titles,
tabs, breadcrumbs, buttons and icons that should navigate. Actions such as
`[[view:saved][@check Save task]]!` become native buttons with the primary style.
`go TARGET | label` remains compatible with older dossiers, but new prototypes
should connect the app's own controls. Every view target is validated.

Desk verbs (`nav`, `crumb`, `head`, `meta`, `col main`, `col rail`) structure the
screen. `brand Name | subtitle` and `identity Person` dress its sidebar;
`compose placeholder | [[view:sent][@send]]` draws an editable composer. The
prototype inherits the document's design language and adapts to phone width.

Hover reveals a floating icon toolbar. Touch devices keep it visible. H toggles
link outlines, G switches between app and graph, Expand fills the viewport and
Escape exits. Graph thumbnails show the actual screens; connections come from
their actual controls. Hover a node to see its outgoing routes; choose a node or
route to return to the app. Fit/zoom and mouse dragging help explore larger
graphs. The app view and full-screen focus scope survive live file updates.

Prototype actions stay local. Only the reaction form writes into the dossier.
Use real seed facts and label designed exchanges and future outcomes as rehearsals.
Do not invent a person's commitment. Saving a suggested task and accepting it
are distinct transitions whenever the product's rules distinguish them.

```org
#+begin_screen_graph :id handoff :title "A request becomes work" :start request
view request | Read the request | A designed exchange, not an imported message
brand Studio | Team workspace
identity Ada
nav [[view:request][@home Now]]* | [[view:committed][@chat Work]]
head Read the proposal | turn · Suggested | [[view:committed][@check I will take it]]!
col main
msg you | Can you read the proposal?
compose Ask about timing… | [[view:later][@send]]
col rail
row Source | [[view:request][@chat Original request]]
view committed | A commitment
head Read the proposal | run · Taken on
col main
msg you | I will read it.
actions [[view:request][@back Return to the source]]
view later | Clarify first
head When do you need it?
col main
actions [[view:request][@back Return to the request]]
#+end_screen_graph
```

Inspect the actual app controls, link highlighting, graph selection, Back,
reset, full screen, Escape and a live file refresh at phone and desktop widths.
Verify that modal focus stays inside the full-screen prototype, shortcuts do
not fire while typing, graph previews are inert, and external links stay external.
Custom interactive previews must also isolate form controls: inert clones still
share native radio groups unless their names are removed. Check selection after
creating thumbnails, not only before.

Plain Org works too: headings with TODO keywords and tags, `:PROPERTIES:` drawers (chips),
tables, lists, `[ ]`/`[X]` checkboxes, `=code=`, `*bold*`, `/italic/`, `[[url][label]]`, `[[#screen-ID][label]]`.

## Executable cells

```org
#+begin_src beam-lisp :id lifecycle
(ns project.model)           ; first cell names the namespace; all cells share it
(defn advance [s e] …)
(assert (= … …))             ; a failing assert becomes the result and --check exits 1
{:what "the last value is the printed proof"}
#+end_src
```
Lowercase `#+begin_src beam-lisp` only (uppercase never runs). Model the design's
invariants (one writer, ordering of effects, coverage of a mapping), not trivia.

Beam Lisp traps met while writing these (installed `bl`, 2026-10-31):
not in core — `ffirst`, `reductions`, `spit`, `replace`, `format`, `parse-long`, `prn`.
Use `File/read!`, `File/write!`, `File/rename!`, `String/replace`, `Regex/run|scan|split|replace`,
`erlang/binary_to_integer`, `(println (pr-str x))`. Arguments evaluate right-to-left.
Never name a public fn after a core fn. Hiccup children must be seqs (`map`/`for`), not vectors:
`(map identity v)`.

## Seeing it

```sh
chromium --headless=new --no-sandbox --hide-scrollbars --window-size=412,16000 \
  --virtual-time-budget=5000 --screenshot=/tmp/d.png http://127.0.0.1:PORT/
nix shell nixpkgs#imagemagick --command magick /tmp/d.png -crop 412x1000+0+0 +repage /tmp/d0.png
```
Pages taller than 16000 px: save the HTML with earlier `section.part`s hidden and shoot that.
Check: phone width first, every diagram readable, both themes, no `✗ failed` cell.

## Reading it as an app

On a wide screen the page is a two-column app with no change to the file: every
level-1 heading becomes a page in a sidebar (with its level-2 headings under it
when open). A section shows how many answers it still waits for, a ✓ once
answered, and a roster its DONE/total. One section shows at a time, with
previous/next at its foot and ←/→ to move. `#all` (« Whole document ») shows
everything; any `#anchor` opens the section that holds it. On a phone the chips
switch sections the same way. Write level-1 headings as the report's pages and
level-2 as their parts.

## Design languages

`#+design: forest` applies the product's language to the report as well as its
mockups: headings, prose, navigation, feedback controls and diagrams share its
font roles and palette. A block can override with `:design NAME` or opt out with
`:design none`; the mockup lines don't change. Prefer the product's own language
over the kit's default palette whenever one exists.

The kit's base CSS is in `@layer dossier`; product CSS sits outside that layer,
so an intended product heading is not silently overridden by a more specific
kit selector. Use `--font-display`, `--font-body`, `--font-ui` and `--font-data`
for deliberate roles. A one-face language can assign the first three to the
same face and reserve the data role for code and machine values. Inspect
computed fonts and weights on the report, forms and explorer at phone and
desktop widths; looking only at a mockup misses report-level drift.
Palette parity matters too: switching the report theme should change app
backgrounds, cards, navigation, diagrams and controls. Avoid a fixed dark
palette inside an otherwise themed report. For task flows, keep navigation and
the primary next action reachable on a small phone; let supporting detail
scroll behind them rather than making a diagram or explanation the navigation.

A language is a literate module, `kit/dossier/design/NAME.bl.org`, whose cells *are* the
namespace `dossier.design.NAME`: tokens (light and dark), type scale, radii, shadows,
motion tokens, and the CSS that re-binds the kit's mockup variables. Register it in
`kit/dossier/design.bl`. The same file is its specimen page, through four blocks that draw
themselves from the module: `#+begin_palette`, `#+begin_type`, `#+begin_shape`,
`#+begin_motion` (each with `:design NAME`, empty body). Keep a `parity` cell that checks
the tokens against the product's shipped CSS; the kit test asserts no drift.

Shipped: `forest` — Nurturing Forest, Ora's team machine (`design/forest.bl.org`,
published as the `forest-language` service).

A product's own language can stay in its own (private) repository: generate a
CSS file that styles `html[data-design="NAME"]` for the report's tokens and
`.design-NAME` for any mockup-specific treatment, and start the dossier service with
`DOSSIER_DESIGN_CSS=/abs/path/NAME.css` (comma-separated for several). Mockups
with `:design NAME` then wear it, and no brand material enters the kit.
Only the faces actually used by the document are requested. An external
language supplies any font assets it needs; unrelated registered language
fonts are not loaded as a side effect.

Before publishing, save and reload a real answer through the browser on a
disposable dossier. A denied-write check or pure header-patching test does not
exercise the authorized HTTP handler. Hosts can use `dossier.feedback/submit!`
after their own authentication; it returns explicit JSON outcomes for valid,
invalid, oversized and failed writes. Check that an empty/error response keeps
the reader's draft and reports the HTTP failure instead of a JSON parser error.

## Kit

`kit/serve.bl` (routes `/ /doc /rev /src /answers POST /answer`), `kit/answers.bl`,
`kit/dossier/{org,attrs,ui,page,answer,design}.bl` (pure), `kit/dossier/design/*.bl.org`,
`kit/style.css`, `kit/live.js`.
Tests: `bl test -p ~/.claude/skills/bl-org-dossier/kit kit/test/kit_test.bl`.
A new component = one `-h` fn in `ui.bl`, a case in `block->h`, CSS, a needle in the test.
Answers are written by `patch-line`: only `:answer :note :at :by` change; every other byte of the file stays.

The skill lives in `~/projects/enchanted-skills/bl-org-dossier` (the public
`undefine-org/enchanted-skills` repo); `~/.claude/skills/bl-org-dossier` is a symlink to it.
It is shared by every session that uses this skill. Commit as you go, one idea per
commit, and stage only your own files (`git status` first: another session may be mid-edit). A
`work restart` of a dossier service loads whatever is on disk, uncommitted edits included.
Keep a reader's answers in their own commit in the dossier's repo, so `git diff` shows what they said.

## Component Explorers from the codebase

Prefer code discovery to a parallel catalog manifest. Annotate the public renderer
with stable id, family, purpose, usage and literal specimen arguments. Read the
function through `codebase/defn-form`, `name-annotation` and `node-data`; resolve
that definition through `BeamLisp.Env/fetch`, then apply the specimen arguments.
For literate modules, `bl.doc/cells-source` is the source to inspect. Never eval
browser-supplied code or expose arbitrary function invocation.

The `explorer` block embeds the product's same-origin `/explorer` route. Its
`view ID | Label | query` rows are projections over the same functions. Implement
queries as data selectors (for example `family:State state:waiting`, with AND
between terms and OR via `|`), show parse errors, preserve accessible names, and
label specimens and future states honestly. Query views must narrow examples,
not merely cards, when selecting states. Keep the host's product fonts and theme
inside the frame; review its actual renderers at phone and desktop widths.

## Exploring a Datom schema

`kit/schema-graph.js` and `kit/schema-graph.css` provide `SchemaGraph.mount`:
the relationship-oriented counterpart to the screen explorer. Use HTML entity
cards and SVG connections, with focused neighbourhoods, a whole-domain lens,
search, labelled cardinality, reverse navigation, Back, fit/zoom, panning,
fullscreen and keyboard controls. Computed dependencies and compound tuples
are selectable hyperedges: all input attributes converge on one junction,
then its result. A wildcard ref is one domain-scope node, not invented edges
to every type. Keep the existing field view as an alternative.

Read the data contract and integration recipe in
[`references/schema-graph.md`](references/schema-graph.md). The host should
project installed `datom/schema` definitions and registered relation `:reads`;
label domain annotations such as target types and requiredness separately.
Do not imply a native ref attribute enforces a particular target namespace.
The graph draws schema definitions only; no arbitrary evaluation or business record writes.
For source examples and durable feedback, optionally compose `kit/schema-review`
through the inspector contract in the same reference. Keep owner feedback in a
separate store, identify its model basis and context sources, and distinguish
local saves from verified provider delivery. The host owns every authority and
provider boundary; the graph kit never edits a schema or operating record.
Embed the product's same renderer with a source-backed `screen_graph`, rather
than maintaining a second diagram in the dossier. Review References, Computed
and Identity at desktop/phone widths and in both themes. Prove graph navigation,
deep links, history, scope isolation, focus trapping and missing-relationship
states. Product example: `~/projects/umriden/awnad`, `/founder?view=model`.

## Shared view libraries and component inspection

When reviewing a product with a component library, use three levels: tokens,
components, and views. A view composes components into a meaningful workspace
(collection, selected entity, context and next action). The actual app and the
screen preview must call those same functions. Do not draw a second sidebar or
navigation system in the dossier's mini-language after a production renderer
exists. Keep breadcrumbs, collection navigation and local destinations visible;
a single entity by itself is not a navigable product.

For source-backed screens use:

```org
#+begin_screen_graph :id desk :title "Shared product views" :src "/views" :catalog "/explorer.json" :explorer "/explorer" :start inbox
view inbox | Conversations
view guest | Guest conversation
#+end_screen_graph
```

The same-origin host receives `?view=ID` and returns the product's actual frame,
composed views and components using explicitly illustrative records. Its links
stay within preview routes and its forms cannot invoke real procedures. Render
component roots with `data-ui-component="stable-id"`; use
`data-ui-composition="view-id"` when the same DOM root represents a composition.
The catalog endpoint receives `?q=id:ID` and returns discovered annotations with
`id`, `title`, `qualified`, `family`, `use`, `source`, `line` and `examples`.

The screen toolbar offers Highlight links (H), Explore graph (G), Inspect
components (I), Back, full screen and reset. These capabilities are additive;
never replace link highlighting or graph exploration with a dropdown when
introducing component inspection. Hover or keyboard focus reveals a component's identity, source, states
and composition ancestry. Click opens its exact UI Explorer entry; the box also
has a link usable by keyboard or touch. Inspect mode intercepts product actions.
Escape leaves inspect mode, then full screen. Themes propagate into source
frames. Preserve navigation and inspect state over dossier live refreshes.
Verify real pointer hit-testing, nested metadata, click-through, touch selection,
keyboard focus, full-screen focus boundaries, theme changes and source-backed
navigation in a browser. Include the shared view specimens in the component
catalog at a useful width. Palette accessibility includes distinguishable
surfaces, not just passing foreground/background text pairs.

For composed catalog specimens, prefer authored data slots such as
`{:ui/call "product.ui/status" :args ["success" "Confirmed"]}` and
`{:ui/join [...]}` to copied HTML. Resolve calls only against the discovered
public renderer set, recursively compose their values, and cache the discovered
set for the current projection. Browser selectors must never become callable
code. Namespace specimen IDs and label/help references when multiple instances
appear together. Content-version product stylesheet URLs so browser caching
cannot conceal a changed palette or component implementation.

Source-backed graphs read the preview host's actual normalized anchors (same
preview pathname with a `view` query) or equivalent explicit route metadata.
Their nodes contain inert, script-free snapshots of those rendered screens.
Keep persistent navigation available in the connection inspector; draw the
content transitions as wires. Preserve node and route selection, hover,
fit/zoom, panning, keyboard shortcuts and component inspection together.
Test capability parity after replacing a renderer, not just the new feature.

Both native and source-hosted screen graphs use `screen-tools-h`, the same
floating bottom-right icon bar: Back, Highlight links (H), Explore graph (G),
Inspect components (I), Full screen, and Reset. Reveal it on hover or keyboard
focus; keep it visible on touch devices. Extend this shared renderer and skin
rather than introducing a separate top bar or replacing tools with a dropdown.
Native inspection reads the rendered declaration; source inspection reads the
host's annotated component catalog and links to its UI Explorer.

## Browsable milestones and native scenario evidence

Use `milestones` for a delivery sequence someone should review one milestone
at a time. Its map and detail pane share one declaration; selecting a tile,
dependency or Next changes only the local view. Approval stays in the explicit
feedback form or decision block. The selection survives a live document update.

```org
#+begin_milestones :id delivery :title "Delivery sequence" :start M1
milestone M0 | done | Existing foundation | Foundation
check Its behavioral evidence is retained.
milestone M1 | proposed | Configuration | Core delivery
needs M0
step Establish the appropriate administration boundary.
check The intended operator can change a setting and verify its effect.
gate Agree on the next delivery scope.
#+end_milestones
```

The line verbs are `milestone ID | STATE | TITLE | LANE`, `needs ID ID`, `step`,
`check` and `gate`. States are `done`, `active`, `proposed`, `waiting`, `optional`.
Duplicate IDs, unknown states, missing dependencies and cycles are authoring
errors. A proposal is never marked delivered merely because its prototype exists.

Use `witness` to browse **actual Scenario Runner browser frames** directly in
the dossier, including runs that have no exported movie. It complements `film`.

```org
#+begin_witness :id recovery :title "A colleague sees the result" :run "../evidence/recovery.json" :frames "../evidence/recovery" :scope "Isolated customer data; simulated write providers"
#+end_witness
```

The run JSON is the serialized projection of `scenario/run-world`:
`{"name":"recovery","world":"browser","ok":true,"recorded-at":1794057600000,
"verdicts":[{"step":7,"msg":"A colleague sees the result","verdict":"witnessed"}]}`.
`browser.film/world` saves each step's actual `frame-N.png`. The gallery uses the
claim's recorded step number; it never creates a screenshot or substitutes a
mockup. `model` runs are labelled model proofs and expose no browser image.
Missing, invalid, unknown and refuted evidence remain visible.

The kit server resolves `/witness-media/ID/frame-N.png` only for a declared
claim frame. Custom hosts call `dossier.witness/enrich` before rendering and
`dossier.witness/media-path` to authorize frame paths; `:src` may set another
same-origin media prefix. Include the projected witness data in the document
revision so a new run refreshes the page without editing prose. Keep frames in
private application artifacts, validate their scope and credentials, and retain
recorded timestamps. A frame is recorded evidence, never live service health.

Inspect milestone selection, dependency navigation, frame stepping, keyboard
arrows, live-refresh continuity, phone overflow and both themes in a real
browser. Save a reaction on a disposable dossier to verify the authorized path.


## Org-native rosters

A roster is a generated view of normal Org, not another task inventory:

```org
#+begin_roster :id delivery :source "../PROJECT.bl.org" :title "Progress, in plain sight." :start R41 :who "othman hotel"
#+end_roster
```

Serve it with the connected `codebase-review/kit/serve.bl` host and set
`DOSSIER_ROSTER_ROOT` to the trusted project root. The source must be an Org
file under that root, including after symlink resolution. Keep `DOSSIER_OWNER`
configured for a published review. The basic dossier host does not enrich
rosters; custom hosts call `dossier.roster/enrich` at the I/O boundary.

Tasks use their own `#+TODO` workflow, headings, `:PROPERTIES:` drawers,
planning dates and ordinary file links. Prefer a native `:ID:`; legacy IDs at
the start of a heading also work. A task without stable identity can be read
but cannot receive a note. Child progress comes from the actual outline;
siblings are never children. Missing dependencies and cycles are visible errors.

Existing properties: `OWNER`, `PRIORITY`, `AREA`, `BLOCKED_BY`, `COMMIT`,
`TEST`, `EVIDENCE`. Optional presentation/progress properties:

| Property | Meaning |
|---|---|
| `ROSTER_TITLE`, `OUTCOME` | Short title and the person's outcome; full source stays in details |
| `NEXT_ACTION`, `ACTION_OWNER` | Concrete next move and its responsible person (defaults to OWNER) |
| `HORIZON: later` | Deferred work; P3 also appears under Later |
| `BUILD`, `CHECKED`, `LIVE` | Explicit, separately scoped implementation/check/live labels |
| `PROOF` | Ordinary `[[file:record.json][Label]]` evidence links |
| `WITNESS`, `FRAMES`, `PROOF_SCOPE`, `PROOF_STEP` | An actual Scenario Runner JSON record, its recorded frames, scope and preferred step |
| `PREVIEW`, `PREVIEW_SCOPE` | Existing same-origin source view (or HTTPS view), lazily opened in place |
| `FILM` | Actual recorded video URL; never synthesize a movie or a claim |

`Open`, `All work`, `Needs you`, `Ready`, `Blocked`, `Done`, `Later`, search
and workstream selection are local projections. Counts come from matching
Org tasks. The progress strip counts tasks; it does not measure production
readiness. `DROP` is retained as superseded work. `WAIT` and `REVIEW` remain
visible. Comments save `REVIEW_NOTE`, `REVIEW_DECISION`, `REVIEW_AT` and
`REVIEW_BY` into that task's drawer, preserving TODO, ownership and evidence.
Approval of the roster writes to its own block; it does not approve product
expansion or activate a provider.

The pure public renderers live in `dossier.roster.view` and carry `:ui`
annotations and authored examples. `dossier.roster/enrich` accepts trusted
`:root`, `:can-write?` and optional `:evidence` host options. The latter is a
server-owned `(fn [item context] ...)` projection of existing evidence records;
its output is a `:proofs` vector plus an optional source `:fingerprint`.
A file existing is not evidence that its check passed. Retain the actual
recorded scope/date and show missing or changed-source evidence honestly.

Custom hosts serve the declared `/roster-media/ROSTER/TASK/frame-N.png` through
`dossier.roster/media-path`, and authenticated, bounded `/roster-note` requests
through `submit-note!`. HTTP input only names roster/task IDs; it never names
files or executable code. Include `roster.css` and `roster.js` alongside the
standard assets. Live revisions include enriched roster data, so source/evidence
changes refresh open views. Selection, filters and review drafts survive
ordinary refresh. Embed source views as local previews, not provider actions.

Before publishing, use the actual UI on phone and desktop in both themes.
Inspect measured bars, proof enlargement, gallery controls, dependency/back
navigation, empty filters, task-picker close, saved/reloaded notes, live draft
preservation, denied writes and a disposable roster approval. Keep the real
approval unanswered until the owner decides.

Parsed task models use a bounded content-hash cache; source edits invalidate it.
Evidence projections may memoize records only within a request. Authentication
and viewer permissions are resolved per request and never cached in task models.
Browser note writes include a task version; a conflicting edit returns 409 and
keeps the draft, preserving the newer source instead of overwriting it.
