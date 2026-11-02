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

## Components

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
| `job :id :title :codex :claude :decision :screen` | the JTBD sentence | job card + answer |
| `decision :id :title :status proposed\|decided` | `- [x] chosen`, `- [ ] rejected`, then rationale | decision card + Agree/Rework/Disagree |
| `ask :id :title :options "A\|B\|C"` | context | question card + options |
| `screen :id :title :job :caption [:theme dark]` | screen language (below) | phone mock + reaction; consecutive screens form a swipeable strip |
| `desk :id :title :job :caption [:url]` | desk language (below) | a desktop app frame + reaction; same answer buttons as screens |
| `sequence :title` | `lanes a · sub \| b · sub`, `a -> b : label` (call), `a --> b : label` (reply), `a => b : label` (the key moment), `note a, b : text`, `== divider` | SVG on wide screens, numbered steps on phones |
| `graph :title` | `node id \| label \| sub \| col,row \| tone` (`you door station builder foreign`), `edge a -> b \| label \| style` (`baton solid dash none`; `<->`, `--` too) | SVG topology |
| `schema :id :title` | unindented `entity @icon \| gloss`; indented `attr type \| note`. Types: `text date`, `-> kind` (ref), `->> kind` (many), `a > b / c` (state flow), `a, b, c` (enum) | entity cards, refs link to `#entity-NAME`, a count of entities · attributes · states; answerable |
| `procedure :id :title :makes` | the ensemble line language: `step`, `call` (code: `ns/fn`), `check`, `gate`, `route` (`role · rule \| name` binds a person), each `VERB @icon Title \| who \| output · kind · draft · auto, …`; other lines are prose | a step rail, checks dashed, gates as diamonds; answerable |
| `run :id :procedure :as :title` | `team role person … \| role person …`, optional `load person n \| …`, then `fact KIND \| target \| by \| verdict-or-note \| says` lines (`drafted shared handed-over asked-change checked called routed`) | **a person's phone screen generated from the procedure and its facts**: step rail, asks, harness chips, the next gate; joins screen strips; answerable. Prefer it to a hand-drawn `screen` whenever a procedure exists (ensemble's `format`/`run` are vendored in `kit/ensemble/`) |
| `film :id :title :run :src` | prose (the experience it establishes); `missing @icon Beat \| why` lines for beats not filmed yet | a filmed `scenario.demo` run read from `:run` (its output folder, relative to the dossier): the movie (`:src`) with a chapter per scene, each scene's narration, steps and claims with their verdicts, and the gaps computed from the run (a scene that proves nothing, a gesture after its scene's last claim, a claim not witnessed, no movie yet) plus the declared ones; answerable. The server reads the run (`dossier.film/enrich`); the page stays pure |

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

Answerable blocks: `ask decision screen run desk job schema procedure film`. Each needs a unique `:id`.

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

Mockups can wear a product's real design language. `#+design: forest` at the top of a
dossier draws every `screen` and `desk` in it (one block can override with `:design NAME`,
or opt out with `:design none`); the mockup lines don't change. Prefer the product's own
language over the kit's default palette whenever one exists.

A language is a literate module, `kit/dossier/design/NAME.bl.org`, whose cells *are* the
namespace `dossier.design.NAME`: tokens (light and dark), type scale, radii, shadows,
motion tokens, and the CSS that re-binds the kit's mockup variables. Register it in
`kit/dossier/design.bl`. The same file is its specimen page, through four blocks that draw
themselves from the module: `#+begin_palette`, `#+begin_type`, `#+begin_shape`,
`#+begin_motion` (each with `:design NAME`, empty body). Keep a `parity` cell that checks
the tokens against the product's shipped CSS; the kit test asserts no drift.

Shipped: `forest` — Nurturing Forest, Ora's team machine (`design/forest.bl.org`,
published as the `forest-language` service).

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
