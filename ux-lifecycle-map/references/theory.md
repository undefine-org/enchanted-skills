# Theory, used narrowly

The point of citing theory is to make a design choice arguable, not to decorate it. Each section below says what the theory buys, and where it stops.

## Graph structure

A product's screens form a directed graph. The useful properties are:

- **Reachability.** Every surface should be reachable from the start without relying on a remembered URL.
- **Degree.** A high out-degree means many choices at one place. It is the structural counterpart of Hick's law.
- **Density.** `edges / (nodes × (nodes − 1))`. A dense graph is not automatically good; it often means the navigation was counted as content.
- **Hub share.** The fraction of edges that are the fixed global navigation. Above ~50% means the graph is mostly a hub: short paths, weak orientation. The app can reach everything and still not tell you where anything is.
- **Local structure.** Lifecycle edges (`hierarchy`, `context`, `return`) and cross-lifecycle edges (`cross`) are the ones that carry meaning. Draw and measure them separately from the nav.
- **Components and cycles.** One giant strongly connected component is normal once a nav exists. It hides whether a lifecycle has a coherent beginning, a current state and an ending.

Do not optimise mean path length alone. A two-click path through the nav to a screen you cannot recognise is worse than a three-click path through the object you are already holding.

## Choice cost (Hick's law)

Decision time grows with the number and similarity of choices. Consequences:

- five primary destinations, not seven or twelve;
- one loud action per surface; secondary actions quiet;
- filters only where they change the object list, not on every screen;
- do not put the review scaffolding, the role switcher, the fixture notice, the timezone and the calendar caveat in the same visual band as the next move.

Hick's law is about relative choice uncertainty, not a precise stopwatch. Use it to remove choices, not to claim a millisecond budget.

## Reach and target size (Fitts's law)

On a phone, the thumb zone is the bottom third. The persistent navigation and the primary action belong there. A decorative header that pushes the only action below the fold is a reach failure even if it is pretty. Minimum touch targets: 44 × 44 px.

Fitts's law assumes a pointing task; a keyboard or a screen reader changes the cost. Keep the visual order and the focus order the same. Put the accessible name on the action, not on the icon.

## Working memory (Miller, and its limits)

The "7 ± 2" claim is often misused. The practical rule is narrower: a person can hold a small, named set of stages while doing something else. Five rail stages is a design budget, not a law of the mind. The real mechanism is **chunking**: name the stages in the domain's words so each is one chunk. "Suggested / Taken on / Working / In review / Accepted" is five chunks; "state-1 through state-9" is not.

## Information scent

A label should predict what follows. "Attach a result" predicts a result field; "Continue" predicts nothing. The next screen must confirm the scent: same object, same owner, same source, a visible state change. If the label and the destination disagree, the reader re-searches.

## Recognition over recall

The reader should not have to remember which state they left an object in. Keep the state visible as a stamp and a rail. Keep the source visible beside the object. Keep the person visible. Recognition is cheaper than recall, and the object's identity is the anchor.

## Progressive disclosure

Detail belongs beside the object, not on another page. A drawer, a sheet, a `details` element or a secondary rail preserves context. Every new page costs a re-orientation: where am I, what was I doing, how do I get back. If the detail is genuinely another object with its own lifecycle, give it a surface; otherwise disclose it in place.

## Flow

Flow needs three things: a clear goal, immediate feedback, and a sense of control. In practice:

- preserve the object's identity across transitions;
- preserve the reader's draft through failure;
- acknowledge a save with one mark, not a celebration;
- keep a return route from every terminal state;
- never silently change the object under the reader (a newer revision is shown as a newer revision).

## Figure / ground and the Von Restorff effect

One object should dominate; the rest should recede. A single distinctive element (the current rail stage, the primary action, the one stamp that needs an answer) is remembered. If everything is a card with a border and a shadow, nothing is figure. Use weight, position, scale and one accent rather than more boxes.

## Aesthetic registers (when the brief asks for a style)

Styles are vocabularies, not costumes. A register supplies motifs, materials, type and colour; the product supplies the information model. Borrow the vocabulary, refuse the pastiche:

- a **material** register (paper, linen, plaster) gives warmth and structure;
- an **archive** register (hairlines, catalogue numbers, artifact tiles) gives scannability and honesty;
- a **hand-made** register (woodcut marks, irregular edges) gives identity and orientation.

Never let a register carry state alone. A stamp needs a word, a colour and a shape. A motif needs an accessible name if it is the only mark.

## Limits

- Graph metrics describe structure, not comprehension. A clean graph can still be an unreadable screen.
- Hick and Fitts are models of simple tasks; real work includes memory, expertise and interruption.
- Contrast ratios and touch sizes are necessary, not sufficient. Test the phone, the keyboard, the failure path and a stranger.
- Aesthetic references date. Say what you borrowed and what you refused; do not claim an institution's brand.
