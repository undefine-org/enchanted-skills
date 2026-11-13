---
name: ux-lifecycle-map
description: Turn an unusable app into a small set of lifecycles, one surface per object, and measured paths. Use when a product has too many screens, too much explanatory copy, a dashboard that reads as a card catalog, an unclear next action, or when Othman asks to define lifecycles, map screens, optimise navigation, or critique an interface. Produces a lifecycle declaration, a screen graph audit, and a path budget that a dossier can render.
---

# Lifecycles before screens

An app is not a collection of pages. It is a few objects moving through a few states, and a person deciding what to do next. When an app feels unusable, the usual cause is that states were turned into routes and explanations were used where a visual mark should have been.

This skill produces three artifacts:

1. **A lifecycle declaration** (`*.json`): objects, rail states, exception states, the one surface each state lives on, and the primary next hand.
2. **A real screen graph** (`graph.json`): what the running app actually links to, crawled rather than asserted.
3. **A path budget** and audit: entry distance, choices per surface, screen reuse, state-to-surface ratio, and the navigation share of all links.

Render the result with the `bl-org-dossier` skill: `graph` for the lifecycle map, `screen_graph` for the live product, `rosetta` for state/screen/next-hand, `claims` for coverage, `decision` for the surface model.

## The loop

1. **Observe the real thing.** Crawl the running app. Count routes, links, duplicate titles, words per screen, and how much of the graph is the global navigation. Do not accept a sitemap document as the graph.
   ```sh
   python3 -I scripts/lifecycle_audit.py crawl 'https://host/views?view=today' --out graph.json
   python3 -I scripts/lifecycle_audit.py graph graph.json \
     --nav today,work,network,money,sources,week,people \
     --from '/views?view=today' --to '/views?view=delivery'
   ```
2. **Name the objects, not the pages.** A delivery, a source, a relationship, a funding route, a week, a person's scope. One lifecycle per object. If two lifecycles share a state name but mean different things, they are separate.
3. **Keep one surface per object.** A state is a parameter of its surface. `requested`, `working`, `review`, `accepted` are the same screen with a different stamp, rail position and action. If states become routes, the reader must know which state they are in before they can navigate.
4. **Write the rail in five stages or fewer.** The rail is the thing the reader can hold in their head. Exceptions (`blocked`, `revise`, `declined`, `unavailable`) are named states with one repair action, not extra stages. The primary next hand is one per non-terminal state.
5. **Set the path budget before drawing.** Typical: entry ≤1 from Today; next action ≤1 from the object; object → its source ≤1; terminal → a list ≤1; ≤5 primary choices per surface. Write it into the declaration.
6. **Audit the declaration.** Exit 0 means every state is reachable, every non-terminal state has one primary next, exceptions are in `next`, and each lifecycle has a coherent ending or is explicitly `ongoing`.
   ```sh
   python3 -I scripts/lifecycle_audit.py audit lifecycles.json
   ```
7. **Draw the semantic graph.** Nodes are surfaces; edges are only the moves a person actually makes. Mark `hierarchy`, `context`, `cross` and `return`. If every node connects to every other node, you have drawn the navigation, not the experience.
8. **Optimise, then look.** Reduce the number of surfaces until each has one job. Move explanatory copy into the object (a stamp, a rail, a source chip) or into `details`/the dossier. Check phone first, then desktop, in both themes. A graph that fits is not proof that a screen is legible.
9. **Keep the before numbers.** They are the critique: 46 routes for 7 lifecycles, 68% of links are the fixed nav, 8 routes for one delivery. Do not replace them with adjectives.

## What to look for

- **Routes per object.** More than one route per state is a state machine leaking into the URL.
- **Duplicate titles.** The same H1 on many routes means the reader cannot tell where they are.
- **Navigation share.** Above ~50% means the graph is a hub, not a set of lifecycles; the content edges are too weak to orient anyone.
- **Choices before content.** Count nav + context filters + tabs + actions above the fold. Hick's law is not a metaphor.
- **Words per screen.** If the first screen explains the fixture, the calendar, the timezone and what is not connected before showing the next move, the explanation is the interface.
- **Missing marks.** State carried only by a sentence; unknown rendered as `0`; a source reduced to a URL; a lifecycle with no rail.
- **Dead ends and forced detours.** A terminal state with no way back; a source that requires leaving the object; a follow-up that lives only in another section.

## Theory, used narrowly

- **Graph.** A hub-and-spoke nav gives short paths but poor orientation. Local lifecycle edges plus a small fixed hub give short paths *and* a sense of place. Measure density, degree and navigation share; do not worship them.
- **Hick / choice cost.** Every visible option adds decision time. Five primary destinations, one loud action, exceptions behind one quiet control.
- **Fitts / reach.** On a phone, primary actions and the persistent nav belong in the thumb zone. Do not put the only next action under a decorative header.
- **Miller / working memory.** Five rail stages, one object, one next hand. Exceptions are named, not memorised.
- **Information scent.** A label must name the object and the move (`Attach a result`, not `Continue`). The next screen must confirm the label.
- **Recognition over recall.** A stamp and a rail beat a paragraph. The reader should never have to remember which state they left the object in.
- **Progressive disclosure.** Detail opens beside the object, not on a new page. Keep drafts and context across the opening.
- **Flow.** Preserve object identity, the reader's draft and a return route across every transition. A failure keeps the draft and offers one repair.

Read [references/method.md](references/method.md) for the full procedure and [references/theory.md](references/theory.md) for the design-theory grounding and the metrics' limits.

## Declaration shape

```json
{
  "name": "Product",
  "start": "today",
  "max_states_per_lifecycle": 8,
  "max_entry_distance": 1,
  "surfaces": [{"id": "delivery", "label": "Delivery", "job": "What is its next hand?"}],
  "lifecycles": [{
    "id": "delivery",
    "entry": "work",
    "rail": ["suggested", "taken_on", "working", "in_review", "accepted"],
    "states": [
      {"id": "suggested", "label": "Suggested", "screen": "delivery",
       "next": ["taken_on", "declined"], "primary": "taken_on", "exceptions": ["declined"]},
      {"id": "accepted", "label": "Accepted", "screen": "delivery", "terminal": true}
    ]
  }],
  "edges": [{"from": "today", "to": "work", "kind": "context"}],
  "path_budget": {"today_to_next_action": 1, "object_to_its_source": 1}
}
```

Rules the auditor enforces:

- every state is reachable from the first state of its lifecycle;
- every non-terminal state names one `primary` that is also in `next`;
- exceptions are in `next`, and nowhere else;
- a lifecycle without a terminal state must be marked `"ongoing": true`;
- every lifecycle entry is within `max_entry_distance` of `start`;
- states of one lifecycle should share one surface (warned, not failed, because a review might deliberately split).

## Working with `bl-org-dossier`

- `graph` — the semantic map: surfaces as nodes, lifecycle edges labelled with the move. Keep the nav out of this graph; it is the room, not the route.
- `screen_graph` — the live product, with the actual controls as the edges. Use it after the map, not instead of it.
- `rosetta` — one row per lifecycle: stages, screen, primary next hand, exception, evidence.
- `claims` — every promised path names the screen that shows it; a path with no screen is an open promise.
- `decision` — the surface model and the path budget are decisions, not implementation notes.

## Do not

- Turn every state into a route "so it can be linked".
- Draw a graph of the sidebar and call it a journey.
- Use a card grid as an information model.
- Add explanatory copy to compensate for a missing mark.
- Claim a path is short because the nav can reach it. Navigation is not the experience.
- Invent users, owners or commitments to make a lifecycle look complete.

## Verify

```sh
python3 -I scripts/lifecycle_audit.py audit prototype/fixtures/lifecycles.json
python3 -I test/test_audit.py
```

The first must exit 0 on the declaration you are proposing. The second proves the auditor itself rejects an unreachable state and an ambiguous next hand.
