# The method

## 0. Why start with lifecycles

A screen is a place. A lifecycle is a thing that changes. People arrive with a thing on their mind ("the sample evidence", "the foundation contact", "the $20,000 ask"), not with the name of a page. If the app's structure follows pages, the person must translate their object into the app's vocabulary at every step. That translation is the cognitive cost that reads as "unusable".

One object → one lifecycle → one surface. Everything else is an index.

## 1. Inventory the objects

Read the source material, the domain model and the running app. List the nouns that a person acts on, and the verbs they use. Merge synonyms only when the domain says they are the same record. Keep these distinct:

- an **ask** and an **award** and a **receipt** and an **allocation**;
- a **suggestion** and a **commitment**;
- a **source link** and a **snapshot** and the **original**;
- a **programme** (ongoing) and a **project** (bounded) and a **delivery** (one result).

A delivery, a source, a relationship, a funding route, a week, a person's scope. If the domain has more, keep going, but stop when two objects have the same states and the same next hands; then they are one lifecycle.

## 2. Write the rail

The rail is the short, visible story of the object. Five stages maximum, because the reader must hold it while doing something else.

- Each stage is a **state of the object**, not an action of the app.
- One stage is **current**. Completed stages are marked; future stages are quiet.
- The rail is always visible on the object's surface, including on a phone. On a phone it may stack, but it does not disappear.
- Use the domain's words. "In review" is a state; "Continue" is not.

## 3. Separate exceptions from stages

Blocked, revision requested, declined, unavailable, permission denied, conflict. These are real states, but they are not steps on the happy rail. Give each one:

- a distinct name and mark (dashed, double border, brick colour, a different icon);
- exactly one **repair action**;
- the object's context and the reader's draft preserved;
- a return to the rail.

If an exception has three possible repairs, it is actually three states. Split it.

## 4. Name one primary next hand per state

For every non-terminal state, write one sentence: "The next hand is ___." Make it a verb and an object ("Attach a result", "Take it on", "Request changes"). Put that action in the loud style. Everything else is quiet or behind a menu.

A state with two equal primary actions is a decision the product has not made. Either pick one or split the state.

## 5. Give each object one surface

A surface is a composition: identity, state, evidence, the next hand, and the people involved. States change the composition, not the route.

- `?view=delivery&id=…` is the surface.
- `requested`, `working`, `in-review` are states rendered on it.
- A route per state multiplies the navigation graph, breaks deep links when the state changes, and forces the reader to know the state before they can find the object.

## 6. Budget the paths

Write the budget before drawing:

| Move | Budget | Why |
|---|---|---|
| Today → the next action on an active item | 1 | The home screen's job is to remove a search |
| Today → any lifecycle entry | 1 | A fixed five-destination nav is enough |
| Object → its source | 1 | Evidence belongs beside the object |
| Terminal state → a list | 1 | No dead ends |
| Primary choices per surface | ≤5 | Hick's law; the rest are quiet |
| Stages in a rail | ≤5 | Working memory |
| Global nav destinations | ≤5 | A room, not a sitemap |

A path is not short because the nav reaches the destination. Count the **contextual** edges; the nav is the room.

## 7. Audit the real graph

Crawl the running app. Record:

- routes and links;
- duplicate H1s (the same title on many routes);
- out-degree (links per route);
- navigation share (links that are the fixed nav / all links);
- words per screen, excluding nav and footer if possible;
- dead ends and error routes;
- shortest contextual path from the start to each lifecycle entry.

Use the numbers in the critique and keep them. "46 routes for 7 lifecycles; 68% of links are the fixed nav; one delivery appears as 8 routes" is a finding. "The app feels cluttered" is not.

## 8. Reduce the copy

Copy is not free. It competes with the mark, the rail and the next hand. For each sentence on a product surface, ask:

1. Is this a **state**? Make it a stamp.
2. Is this a **relationship**? Make it a line, a chip or a position.
3. Is this a **source fact**? Put it in the source chip, the dossier or `details`.
4. Is this a **review caveat**? Put it in the review banner or the dossier, not in every card.
5. Is this the **one thing the reader must know now**? Keep it, once.

Budget: a screen's first view should have a title, one line of orientation, one loud action, and a visible state. Everything else is an index.

## 9. Verify as a person

- Phone first, at 390 px. Can the next hand be reached with a thumb? Does the rail still read?
- Keyboard: tab order follows the visual order; focus is visible; the rail and stamps have accessible names.
- Both themes: state colours keep contrast; the stamps keep their shape.
- Failure: the draft survives, the source stays identifiable, the repair is one action.
- A stranger: can they say what this object is, what state it is in, and what happens next without reading a paragraph?

A graph audit cannot establish any of these. It only tells you where to look.
