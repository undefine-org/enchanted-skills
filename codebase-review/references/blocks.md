# Connected review blocks

## Organising settings pages

Use `settings_pages` when the question is “what goes on each page?” It shows
the page destinations together, a selected page's contents below, then the
separate conversation and personal scopes. Native radio controls select a page;
there is no simulated product action, graph toolbar or entity explorer.

```org
#+begin_settings_pages :id pages :title "Hotel settings"
page assistant | AI & reception | How guests get help. | bot
group Conversations
setting Keep helping while staff work | On, for every request category.
source Existing Hotel area; agent and conversation commands.
local In the conversation | Pause AI for this guest; reset to inherit the hotel default.
personal My account | Own interface language and notifications.
#+end_settings_pages
```

`page ID | TITLE | PURPOSE | ICON` starts a page. `group TITLE` groups its
`setting LABEL | VALUE-OR-BEHAVIOR` rows. `source TEXT` is optional, collapsed
evidence. One `local TITLE | DESCRIPTION` and one `personal TITLE | DESCRIPTION`
explain the smaller scopes. Use a small, concrete page set. The source audit
can remain a separate artifact; it should not occupy the main review.

## Reviewing relationships

Three real `.bl.org` block types share a grammar and the dossier's graph viewer:

| Block | Focus | Card information |
|---|---|---|
| `ontology_graph` | What the system's words mean and how concepts relate | Meaning, current representation, proposed boundary, rules, examples, code evidence |
| `settings_graph` | Choices, scopes and exceptions | Current/default/proposed behavior, type, scope, role, UI home, consumers, consequences |
| `code_graph` | How an observed behavior happens | Definition, source location, callers/consumers, current behavior, proposed seam, verification and limits |

Each starts as a readable detail card with a compact index. **Map** opens
connected thumbnails; selecting one opens its full detail. Connections are
labelled navigation controls derived from declared edges. Graph zoom, Back,
fullscreen, keyboard navigation and live refresh reuse the dossier viewer.
Cards are authored from evidence; a proposed link is labelled as proposed.
These blocks never invoke functions or execute code supplied by the browser.

```org
#+begin_settings_graph :id policy :title "One policy, visible exceptions" :start reply
node reply | setting | AI reply mode | proposed
summary Whether the AI may answer, independently of staff work.
current A handoff switches the whole conversation to staff control.
proposed Workspace default = continue; a conversation may explicitly pause it.
field Type | continue or staff-only
field Scope | Workspace → conversation exception
field Editor | Manager globally; reception per conversation
field UI home | Settings; selected inbox conversation
rule Creating or assigning staff work never changes reply mode.
example Reception decides on a discount while the AI answers a parking question.
source src/desk/desk.bl:417 | desk.desk/handoff! | Switches conversation control today.
check Behavioral integration | Not implemented; the model checks the proposed rule only.
node work | concept | Staff work | existing
summary An answer or action owed by staff.
current Service tasks keep the AI active; handoffs pause it.
proposed One lifecycle for every need; category remains descriptive.
edge reply -> work | independent of
#+end_settings_graph
```

## Grammar

- Header: unique `:id`, `:title`, optional `:start NODE`, `:mode graph` and `:caption`; existing
  `:answer :note :at :by` feedback attributes are preserved.
- `node ID | KIND | TITLE | STATUS` begins a card. Kind is `concept`, `setting`,
  `code`, `view` or `constraint`. Status is a visible word such as `existing`,
  `proposed`, `missing` or `partial`; it is not inferred from color.
- `summary TEXT`, `current TEXT`, `proposed TEXT`, `rule TEXT`, `example TEXT`
  add explanations. Repeated explanatory lines accumulate.
- `field LABEL | VALUE` adds a fact in a readable two-column list.
- `source PATH[:LINE] | QUALIFIED-DEFINITION | FINDING` attaches source evidence.
  Source paths are displayed as text, not misleading links to a file server.
- `check LABEL | RESULT` states verification and its limits.
- `edge FROM -> TO | RELATION` declares a directed relationship and navigation.
  Incoming relationships are visible in the card; their reverse navigation is
  excluded from the graph's semantic edges.
- `open URL | LABEL` links an existing view or published source; accepted schemes
  are `https://`, `http://`, same-origin `/…` and local document `#…` anchors.
  `javascript:`, protocol-relative URLs and backslash paths are rejected.
- Blank lines and `#` comments are ignored. A literal `|` may appear in a final
  text field; split structured values into fields instead of encoding tables.

Unknown verbs, empty required fields, duplicate IDs, missing endpoints and an
invalid start show an authoring error. A failed review does not silently drop
relationships or produce an apparently complete diagram.

Use the same concept IDs across diagrams where useful, but block IDs must be
unique. Favor a focused map per decision over an unreadable whole-repo hairball.
Keep the observed code snapshot and designed future behavior visibly separate.

## Host and reuse

`kit/codebase_review/blocks.bl` parses and renders cards, then enriches the
ordinary dossier nodes. `kit/review.css` supplies scoped layout using the host's
theme tokens. The shared screen graph accepts a trusted renderer callback;
review blocks supply content while the established viewer owns interaction.
Feedback writes to the original review block header, not a generated copy.

The host defaults to the sibling dossier kit and this kit under
`~/projects/enchanted-skills`. Override `DOSSIER_KIT_DIR` and `REVIEW_KIT_DIR` when
installed elsewhere. Add both library roots with `-p`. Other dossier hosts can
call `codebase-review.blocks/enrich` before `dossier.page/page-h` and append
`review.css` to their stylesheet. The three review block names are registered
with the shared feedback parser.
