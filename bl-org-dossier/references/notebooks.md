# Semantic notebooks in Org

Use this mode when a dossier needs scenarios, linked evidence, impact measures
or pricing comparisons. Keep the Org file as the editable source of facts and
meaning; compose `screen_graph`, `explorer`, `schema`, executable cells and the
shared review layer before adding a block primitive.

## Start with the reader's question

For an explanation of mission value, first show the client's work, its losses
and capacity limits, the intervention, then the resulting value and its pricing.
Begin from the documentary source the user selected. An earlier commercial
attempt is not an anchor unless the user wants it considered.

A slide-like progression can be more useful than a sidebar taxonomy. Keep one
question and its graph in focus; place the changing inputs beside the result.
Preserve the same scenario across steps. Use before/after bars, flows,
constraints and allocations to expose the calculation. Human labels and units
belong on the surface; identities, operations and complete registers belong
in supporting detail. Counts of records or formulas do not explain value.

An interactive value model should show what the client does, what the mission
changes, and how that effect becomes value. Connect the consultant's effort and
cost to that chain before exploring a price. Explain the default example through
its visible inputs, rather than presenting unexplained headline figures.

## The notebook blocks

A document with named `inputs` and `formulas` tables is a notebook. The kit
(`dossier/notebook.bl`) reads the tables, checks them, renders the default
scenario on the server and carries the closed model to the browser, where
`live.js` recomputes the same expressions when the reader switches scenario
or moves a slider. **Every figure is a button**: hovering shows its formula in
words, clicking opens it term by term; each term opens in turn, down to the
assumption with its slider, the person who can confirm it and the claims it
stands on. Nothing the reader adjusts is written to the file.

Write formulas people can say out loud and stand by: one line, named terms.

```org
#+name: people
| id | name | role |
|---+---+---|
| ghizlane | Ghizlane | Cellule Marchés |

#+name: claims
| id | phase | lot | text | source |
|---+---+---+---+---|
| c-exigences | p1 | veille | Les exigences d'un DCE sont extraites en quelques minutes | P p. 8 |

#+name: inputs
| id | title | unit | low | mid | high | min | max | step | who | claims | source |
|---+---+---+---+---+---+---+---+---+---+---+---|
| dce_now | Lire un DCE · aujourd'hui | h | 2.5 | 3 | 4 | 0.5 | 10 | 0.25 | ghizlane | c-exigences | M14 |
| usage | Usage réel de l'outil | % | 60 | 80 | 90 | 0 | 100 | 5 | amal | c-adoption | HYP |

#+name: formulas
| id | title | expr | unit | claims |
|---+---+---+---+---|
| f1_gain | Lire les DCE · heures rendues | dce_count × (dce_now − dce_after) × usage | h/an | c-exigences |
```

- One input column per scenario id (`scenarios` table); without one, a `value`
  column. Decimals are fine. A `%` input is written as a percentage (25) and
  enters an expression as a share (0,25); formulas never carry `%` (format
  them `share`).
- `expr`: ids, numbers, `+ − × ÷` (or `- * /`), parentheses, `min(…)`, `max(…)`.
  Nothing else parses; the browser never evaluates code. A formula reads only
  ids defined above it.
- `who` names `people` ids, `claims` names `claims` ids; `nb/problems` reports
  unknown people and claims, out-of-bound values, unreadable expressions and
  forward reads, and the blocks show the problems in place of figures.
- Optional tables: `phases` (`id | label`), `lots` (`id | title | phase`) label
  ledger groups; `sources` (`id | label`) labels source ids (`HYP` is never shown).
- `#+import: other.bl.org` puts that document's tables first (the kit host
  reads it; `nb/read-model PATH` does the same in a cell). An internal pricing
  dossier imports the client value model instead of copying its figures.
- Pin claims copied from another dossier with a cell that compares text and phase.

| Block | Body | Renders |
|---|---|---|
| `scenarios :start ID` | `measure ID \| label \| format \| tone`, then prose | scenario switch in place, and a sticky bar on every section with the measures |
| `measure` | `value ID \| label \| format \| tone \| note` | large figures; the note may hold inline values |
| `ledger :table T [:where "col=v"] [:group col]` | `column NAME \| label \| format` (`@col` takes the row's format) | the rows of a table as cards: a cell naming people draws them, naming claims draws their words, naming a model id draws its live value |
| `assumptions [:people "a,b"]` | — | every assumption under the person who confirms it, with slider, scenario values and claims |
| `bars :format F` | `bar ID \| label \| note \| tone`, `minus …`, `total …` | horizontal bars scaled to the largest; `minus` hatched |
| `limit :format F` | `value ID \| label`, `limit ID \| label`, `kept ID \| label` | what was won against what can be absorbed; the excess hatched |
| `chain` | `term ID \| label \| format`, `op ×` | an equation strip |
| `compare` | `row ID \| label \| format` | every scenario side by side, the chosen one marked |
| `range :value ID :format F` | — | the scenarios on one line; an adjusted value as a marker |
| `funnel` | `kind`, `step`, `lever` lines | a flow of shares of the first step, with levers that open |
| `controls :inputs "a,b"` | or `input ID` lines | sliders in a closed « Adjust the assumptions » |

Inline: `{{ID|format}}` in a paragraph, a list item or a note. Formats: `mad`
(two significant digits, MAD/kMAD/MMAD), `hours`, `days`, `months`, `count`,
`pct` (an input in %), `share` (a fraction shown in %), `num`. Tones: `ink
green blue gold violet signal dim`. Keep the model tables in a late section so
reading sections stay figures and sentences; the tables remain the source.

## Record meaning before drawing numbers

Use normal headings with `:ID:` and property drawers for individually linked
records, named Org tables for series, and ordinary file links for evidence.
Keep source statements, observed measurements, proposal targets, illustrative
fixtures and scenario assumptions distinguishable in the model and interface.
A source reference should identify its edition, locator/page, viewpoint and
observation date. A fixture is evidence of an intended interface, not evidence
of a customer outcome.

A metric needs a unit, period, population/denominator, scope, owner and status.
An absent baseline is not zero. Preserve active work, review/rework, added
capture effort and external waiting time separately. If a qualitative severity
is all the source supports, do not turn it into a probability or score.

Record formulas with stable IDs, operations, declared inputs and output units.
Project both the calculation and its inspector from these records. Reject
duplicate identities, unresolved references, cycles, invalid inputs and unlike
additions. State the actual level of dimensional checking; validating sums is
not a complete dimensional algebra. Browser requests select registered IDs
and bounded values, never executable expressions or arbitrary file paths.

## Scenarios and comparisons

Treat a scenario as an overlay on an identified model revision, with its
parameters, scope and horizon. Local controls may explore freely. Persisting a
scenario into Org is a separate explicit write, with the shared host identity
and conflict handling; changing a slider must not rewrite a source fact or
answer a decision. Preserve/reconcile drafts when the model revision changes.
An export should carry its basis and assumptions, without becoming a second
canonical business ledger.

For impact, keep capacity released, cash expenditure avoided, margin protected,
cash timing, financing capacity, risk exposure and nonfinancial capital in
their own registers. Monetary equivalents require an explicit conversion.
A released guarantee limit is not cash received. An alert is not a prevented
loss. Track attribution, evidence and overlapping episodes before aggregating
effects; exclude benefits outside the sold or enabled scope.

For pricing, compare the same scope, rights, acceptance criteria, horizon,
currency and tax basis. Distinguish one-off costs, included first-year costs,
renewals, internal capacity and unknown third-party expenses. A perpetual
license does not imply free future maintenance. Preserve unknown costs in a
total rather than silently treating them as zero. Low/central/high scenario
inputs are sensitivity assumptions unless an actual statistical method and
data justify a confidence interval.

## Enchant and the host

`bl.doc` owns executable cell/result spans and recognizes the Org dialect by
`.org`; a user-chosen suffix before `.org` need not imply a new dialect. Check
the installed runtime: document runners may require `BEAM_LISP_PATH` for kit
dependencies even when a serve command accepts `-p`. Do not claim that
`#+TBLFM` or a dynamic block is a reactive web calculation engine without
implementing and verifying that bridge.

Datom can provide temporal indexed projections, Datalog and computed relations;
relation `:reads` declarations support dependency-aware watches. `live.app`
can provide pure screens, routing and guarded contexts. These are candidate
building blocks, not proof that a particular notebook already uses them. For a
small design rehearsal, a read-only projection of Org and a closed calculator
may suffice. Reuse the same model for executable proofs and interactive views.

Show dependency/provenance inspection beside results. Encode missing, zero,
negative, excluded-scope and stale values through shape and short labels as
well as color. Keep the productive next action close on a phone, and keep
scenario exploration separate from explicit review/approval.

## Useful verification

Exercise changed inputs through the actual UI and verify the result against
the same model engine. Check unknown propagation, zero and negative values,
scope exclusions, recurring-cost horizons and double-counting boundaries.
Change an Org input and verify that the projection changes without editing the
view code. Exercise revision changes and invalid bounds. Inspect real pointer
interactions, keyboard focus, phone/desktop layouts and both themes.

Test durable feedback on a disposable copy. Preserve existing reader feedback
and unrelated kit work. Keep domain-specific data and pricing rules in the
private dossier/project; extract a shared renderer or engine only after its
reusable contract is clear from actual use.
