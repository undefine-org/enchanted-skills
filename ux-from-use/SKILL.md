---
name: ux-from-use
description: Turn what someone met while using an app (a bug report, a friction, a « why is this here? ») into the experience the product should establish, find the structural reason, fix the structure, try it yourself in a real browser with Beam Lisp's browser namespace, and keep it as a filmed scenario with the model on tape. Use when Othman reports things he found using an app, asks you to test manually or « use it yourself », or wants features documented as videos.
---

# From use to experience

A report names a symptom. The work is the experience behind it. « The client
vanishes when the conversation moves to the matter » is a bug. « A conversation
gathers what it is about: the client stays when its matter is added » is what
to build, check and film. Write that sentence first. Fix the structure that
allowed the symptom, then prove the sentence by using the product.

## The loop

1. **Collect the use.** Read the report, then the traces of real use: the
   person's conversations, journals, logs, presence, the files they touched.
   They hold expectations nobody wrote down (« ils en sont où ? » expects the
   points themselves, not a summary).
2. **Write the experience.** One sentence per report, present tense, from the
   person's side, no implementation words. Keep the list. It becomes the film's
   narration and the claims' messages.
3. **Find the structural reason.** Ask why the product could do this at all. One
   cause usually explains several reports (identity taken from a display name;
   two counts that share a word; a renderer that drops a class on insert). Fix
   the cause, not the screen that showed it.
4. **Use it yourself.** Drive the real app as each person involved, at desktop
   and phone width, through the browser namespace (below). Look at screenshots.
   Count what the page says, not what the code intends.
5. **Keep it.** Lift the manual steps into a scenario: actions become events,
   checks become claims, the experience sentence becomes the scene's narration.
   Put model turns on tape so the film replays in seconds, with no cost.
6. **Report the experience, not the patch.** In the summary, lead with what the
   person will now find, then the cause, then the film and how to replay it.

## When the use report is about a redesign

Read the accepted rounds and answers before restoring features. Later explicit
answers override earlier assumptions. Trace each changed interaction through
its source, durable identity, command, projection and actual destination screen.
A feature inventory is not proof of the redesign: a restored old task model
beside a new work model can pass isolated journeys while failing the experience.
Prove the crossing in one multi-person journey. If the agreed scope is a hard
cutover, carry out that cutover with preserved originals; do not quietly make
coexistence the new product decision.

Wait for the visible result of an action before taking the next action. After
Reply, wait for the reply target; after Save, wait for the other person's saved
state. Browser automation can outrun a live patch. If the UI can also lose a
quick person's intent, fix that race at the input boundary. Distinguish a delayed
patch from a rejected or misrouted command before claiming to have fixed it.
A scripted draft fixture must be labelled as such, never described as a captured
live model answer.

## House taste (what Othman has asked for, repeatedly)

- **Less copy.** State is drawn: tone, weight, placement, a ring, a mark. A
  sentence that explains a screen means the screen is wrong.
- **One word per idea.** Keep a glossary and hold it: a « critère » (judged
  against the procedure) is never a « point » (what a person decides). If two
  counts share a word, someone will add them up.
- **Things accumulate.** Tags add up (kind, then client, then matter). The
  current one is filled and the others stay as outlines. Never replace context
  the person already saw.
- **Numbers drawn before text.** A history opens on charts, one series each,
  values labelled. The text sits underneath, one line per event, and opens on
  demand.
- **Every reference leads to its place.** A paragraph number scrolls to the
  paragraph and lights it. A quote finds its passage. The scrollbar marks
  where things are, in their colours.
- **Live by default.** No full reloads. A change made by one person shows on
  every open page at once. Repeated taps on a slow page must not repeat the
  effect: gestures are idempotent.
- **Controls where the thing is,** and only for who may use them. Read-only
  people see the state without the control.
- **Know who is there.** Identity and role reach every screen and every agent.
  Don't tell a partner that « a partner must confirm ».
- **Honest edges.** Say plainly what the product does not do yet. Never point
  at a screen that cannot do it.
- **Phone width is a first-class reader:** 16px gutters, no horizontal scroll
  (`minmax(0,1fr)`, not `1fr`), and the account always reachable.
- **Mockups and narration in the product's language** (French for Knowledger).

## Testing by hand with the browser namespace

Beam Lisp's native browser (`optional/browser-port` in the beam-lisp tree) runs
headed Chromium in a private headless Sway, with trusted input and a continuous
screencast. It is the same object a scenario drives, so a manual session grows
into a test without being rewritten. Use agent-browser for a quick look. Use the
browser namespace for anything worth keeping.

### Once per machine

```sh
cd ~/projects/beam-lisp/optional/browser-port
nix develop --command cargo build --release --locked --features native-browser
nix build .#runtime-wayland --out-link ~/.local/share/bl-browser/runtime-wayland   # chromium, sway, wayvnc
command -v ffmpeg || nix profile add nixpkgs#ffmpeg
```

Run anything that uses it with `bl run -p ~/projects/beam-lisp/optional/browser-port/bl …`
(or `bl test -p …`).

### A probe: one file, one person, real input

`templates/probe.bl` is the starting point. Its core:

```clojure
(ns probe (:require [browser.page :as page]))
(def rt (str (System/get_env "HOME") "/.local/share/bl-browser/runtime-wayland/bin/"))
(def p (page/open! {:executable (str (System/get_env "HOME") "/projects/beam-lisp/optional/browser-port/target/release/bl-browser-port")
                    :width 1440 :height 860
                    :launch {"profile" "/tmp/probe/profile" "runtime" "/tmp/probe/runtime"
                             "chromium" (str rt "chromium") "compositor" (str rt "sway") "vnc" (str rt "wayvnc")
                             "width" 1440 "height" 960}}))
(try
  ;; who is looking: the identity the proxy would add (here Tailscale headers); it reaches the live socket too
  (page/cdp! p "Network.enable" {})
  (page/cdp! p "Network.setExtraHTTPHeaders" {"headers" {"tailscale-user-login" "someone@example.com" "tailscale-user-name" "timinou"}})
  (page/record! p "/tmp/probe/take.mp4" {:fps 24})          ; optional: the whole session as a movie
  (page/navigate! p "http://127.0.0.1:24025/a/sahel-…")
  (page/wait! p "document.documentElement.dataset.live==='1'") ; a JS predicate, 30 s bound by default
  (page/click! p ".rv-rail a.para[data-goto]")               ; trusted pointer: moves, presses, releases
  (println (page/evaluate! p "scrollY"))                     ; ask the page what a person would see
  (page/screenshot! p "/tmp/probe/after.png")                ; then LOOK at it
  (page/stop-recording! p)
  (finally (page/close! p)))
```

The verbs are `navigate! wait! click! hover! fill! key! drag! evaluate! screenshot!
record! stop-recording! show-cursor! cdp!`. `cdp!` reaches anything else Chromium
offers: viewport, network, cookies, emulation (`Emulation.setDeviceMetricsOverride`
for a phone).

### Habits that make a probe worth keeping

- **Ask the page, not the code.** Every check is a JS expression that returns
  `true` when a person would see the thing: counts of rows, the text of a tag,
  `scrollY`, a class on the element under the pointer. Those expressions become
  claims unchanged.
- **Select by meaning.** Give the app stable data attributes where tests need
  them (`button.cell[data-person='Karim Saadi'][data-team='Associés']`), never
  « the fifth button ».
- **Be each person.** Open one page per person with their identity. Two pages
  side by side are how « live » gets proven: one acts, the other changes with
  no reload.
- **Check the first paint and the patched page.** Live apps render HTML once,
  then patch from data. Bugs hide in the difference (a class dropped on insert,
  a list beginning with text read as a tag name). Reach every screen once by
  URL and once by navigating to it.
- **Wait for the page to be live, not just connected.** A live client may
  replace the server-rendered page with its socket's first render. Text typed
  in between is lost, for a test and for a person typing quickly after load.
  The app should keep what was typed across that mount and then say it is live
  (`data-mounted`). Tests wait on that flag.
- **Look at phone width.** Check `document.documentElement.scrollWidth === innerWidth`
  at 390px, then look at the screenshot.
- **Never touch real data, and prove it.** Point the app at a reflink copy
  of its data (`cp -a --reflink=auto`) and a spare port. Then prove the
  isolation before trusting it: rename one thing in the copy (a canary: a team
  « AssociésX »), act on it, and check that the copy changed and the real
  file's timestamp did not. Do this once per kind of process that writes
  (page handlers, live sockets, background jobs). In Beam Lisp,
  `System/put_env` from a test reaches page handlers but not live sockets: a
  socket that reads no configured data folder falls back to the default, which
  is the real data. The app must pin its configuration VM-wide when its server
  starts (`persistent_term`) and read it from there. If you must touch live
  data, snapshot the file, act, diff to confirm only your change, restore.

## Reviewing a whole UI you used

When the ask is « use the app and tell me what is wrong with its UI », the
review is a dossier the person can walk, not a list. The process that worked
for Pocket Harness (`~/projects/tiny-tools/mobile-app/ui-review/`):

1. **Use it, on its real renderer, with synthetic data.** A phone app runs on an
   emulator against a fake backend on loopback; a web app against a reflink
   copy. Go through first launch, every error you can provoke, the main loop,
   system dark mode, large text, losing the network. Keep each screenshot in
   order with what it showed (`spikes/proof/…`). Measure before you guess: a
   pixel read (`#616161`) settled which theme token drew a widget.
2. **Draw the product's own view functions in a browser.** A small host on the
   dossier's origin calls the pure `view` functions with illustrative states
   and projects their trees to HTML with the platform's layout rules restated
   in CSS (`/views?view=ID`), plus the screenshots as their own graph
   (`/shots?view=ID`). Taps become links when the host can name the
   destination, so `screen_graph :src` blocks get real graphs. Keep the old
   view functions (`ph.was.*`) when the screens change, so before and after
   stay side by side.
3. **Annotate the components and serve a UI Explorer** (`/explorer`,
   `/explorer.json`), discovered from `^{:ui …}` annotations with the codebase
   reader; specimens are literals or named fixtures, never browser code.
4. **Name causes, not symptoms**, in a rosetta (what you see · where it comes
   from · the fix), and keep the bugs that are not taste apart.
5. **Hold the proposal with cells**: contrast of every text pair in both
   themes, no machine words on screen, reading order, every icon drawable,
   every icon-only control 48 dp and labelled.
6. **Review the page with `templates/screen-review.bl`**, not by hand. It reads
   the page's source-backed graphs and explorers and, at phone and desktop
   width in light and dark, loads every view, checks it fits, screenshots it,
   builds each graph (one node per view), inspects a component, and runs every
   explorer query. `OUT/report.json` and the exit status say what failed;
   then look at the screenshots.

   ```sh
   bl run -p ~/projects/beam-lisp/optional/browser-port/bl \
     ~/.claude/skills/ux-from-use/templates/screen-review.bl -- http://127.0.0.1:PORT/ /tmp/review
   ```

When the answers come back and the proposal ships, the review becomes the
record: the proposal's graph is redrawn by the shipped screens, the cells hold
the shipped code, and the roster says what each answer became.

## From probe to film

For Knowledger remediation, put any new product component in the review
`.bl.org` catalog before implementation: specimen, states, user action and a
stable ID linked from the roster. Describe planned films as unfilmed until a
real run exists; a mockup or model cell does not establish app behaviour.

A `scenario.demo/defdemo` is an ordinary test (`bl test`). Steps map one to one:

| Probe | Scenario |
|---|---|
| `(page/navigate! p url)` | `(s/does :othman [:navigate url])` |
| `(page/wait! p js)` | `(s/does :othman [:wait js])` |
| `(page/click! p sel)` / `hover!` / `fill!` / `key!` | `[:click sel]` `[:hover sel]` `[:fill sel text]` `[:key "Enter"]` |
| a pause for the eye | `[:pause ms]` |
| `(page/evaluate! p js)` that must be true | `(s/sees :othman (fn [p _] (= true (page/evaluate! p js))) "the experience")` |
| a person | an actor in `browser.film/owned-worlds`, wrapped to set their identity on open |
| a paragraph of narration | `(demo/scene :id {:title … :say … :capture :video} events…)` |

`templates/feature-demo.bl` is a complete file: an isolated copy of the app's
data, the app started in the test VM on a spare port, recorded worlds with
identities, silent tracks when no voice key exists, and one demo with three
scenes. Working example: `knowledger-interface-review/apps/practice/test/features-demo.bl`
(five films: review, history, pieces, a team changed live across two people, a
conversation on tape).

Write scenes as the experience, not the fix: « Chaque point mène à sa place »,
never « fix the §-link handler ». The narration is the documentation.

**Write every film for someone who has never seen the product**, and make it
about what they gain, even when it was made to prove a bug fix:

- The first scene says in one sentence who is there, in which product, and
  what they are trying to get done (« Dans Knowledger, le bureau du cabinet,
  Othman relit la lettre qu'un agent a rédigée pour un client. »).
- Each scene names the benefit before the gesture: what the person no longer
  has to do, find or fear (« Plus besoin de chercher le passage : chaque point
  y mène. »). Name no internal term (socket, intent, criterion id) without
  saying what it is for.
- The last scene closes on the result, in the person's terms.
- One idea per scene, two subtitle lines at most. If a film needs more, it is
  two films.
- Before rendering, read the narration alone, as a stranger: does it make
  sense without the images? Then watch the frames: does each image show what
  its sentence says?

### Model turns on tape

Anything an agent does should go through the app's own tool door, so only the
model's choices are the model's. A tape keeps, for one model run, the door calls
it made in order and its final answer, keyed by a hash of model, system prompt
and prompt (with clocks, epoch-like numbers and hex ids masked).

- `record`: replay what is on tape, run the model for what is not, keep it.
- `replay` (the default): a run not on tape is an error turn. A replay never
  falls back to the model in silence.
- Replay makes the same calls through the same door, paced, so the product does
  the work again and the screen shows it, in seconds and for free.

Pin everything that reaches the prompt (the firm's name, the date if any) in the
test data, or the key will drift. Commit the tapes. Reference implementation:
`apps/practice/src/practice/cassette.bl` and its two hooks in `conversation.bl`
(the turn and the door).

### Running and rendering

```sh
bl test -p ~/projects/beam-lisp/optional/browser-port/bl app/test/features-demo.bl             # replay, prove, capture
DEMO_RECORD=1 bl test -p …                       # put missing model turns on tape (needs model credentials)
BL_DEMO_EXPORT=1 bl test -p …                    # also render MP4 + subtitles + chapters per film
```

Each film clears its last take in its fixture, because a recording never
overwrites one. Keep each narration within two subtitle lines (about 130
characters), or the render refuses it. A loaded machine can starve the
screencast encoder: check `frames/recordings.json`, where `encodedFrames`
should be about seconds × fps, and rerun when a take is short.

Rendering (`scenario.film/export!`) needs Python 3 and FFmpeg with libass.

### A voice

The renderer speaks a scene with its built-in voice (Deepgram, when
`DEEPGRAM_API_KEY` is set), unless the scene carries local `:audio`. That is
the override point: a small module turns each sentence into a WAV with
another provider, cached by voice, model and text, and the scene passes it as
`:audio`. The renderer itself never changes. `templates/narration.bl` does this
for ElevenLabs. It uses the workstation gateway's `/elevenlabs` route (the
gateway adds the credentials) or `ELEVENLABS_BASE_URL` with
`ELEVENLABS_API_KEY`, and a multilingual model, so French works with any voice.

Make voices only when rendering (`BL_DEMO_EXPORT=1`). With no voice reachable,
give each scene a silent track as long as its subtitle takes to read. Never
assume a key exists. A key, when used, reaches curl through a mode-600 header
file, never a command line.

### Reading films, and their gaps

Browse the films with `(scenario.demo/serve! dir {:port 4163})` on loopback,
or publish that with `work serve`. To review them, and to answer, put them in
a dossier. The bl-org-dossier kit's `film` block reads a run folder
(`:run`) and draws the movie with a chapter per scene, then each scene's
narration, steps and claims with their verdicts, then the gaps computed from
the run: a scene that proves nothing, a gesture after its scene's last claim,
a claim not witnessed, no movie yet. `missing Beat | why` lines declare what
cannot be filmed yet. Add a coverage `matrix` of every experience against the
films, so the scenarios that are missing show as plainly as the steps.

## Before you say it is done

- Each reported item has its experience sentence, its cause, and a claim that
  proves it in a real browser, as each person concerned.
- Desktop and phone width looked at, in screenshots, not only asserted.
- First paint and patched page both checked for every screen touched.
- Live behaviour proven with two people, where it matters.
- No real data changed by the testing. Anything touched is restored, with the
  diff shown.
- Films replay from tape with no network. Tapes and scenarios are committed,
  renders are not.
- The summary leads with what the person will find now.
