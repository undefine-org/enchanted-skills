---
name: codebase-review
description: Map a Beam Lisp application's concepts, settings and behavior to source evidence, then make the mapping reviewable as connected detail cards in a .bl.org dossier. Use for architectural or settings reviews grounded in Codebase and system modules.
---

# From source facts to a reviewable model

Use the project's pinned Beam Lisp entry point. Read source without starting the
application or reading secret environment values.

- **Codebase owns discovery.** Use `codebase/index-source` for definitions and
  alias-resolved call sites; `defn-form`, `node-data` and `name-annotation` for
  source structure. For `.bl.org` modules use `bl.doc/cells-source`. Keep paths,
  positions and source hashes. Bind reachability targets; use qualified names
  across namespaces. Dynamic dispatch and procedure prose still need inspection.
- **system owns analysis.** Use `system.analyze` for body summaries and call-flow
  dependencies, or the relevant `system` model/proof module for a precise claim.
  A model check establishes that model's claim; it does not certify the app.
  Label unresolved effects and incomplete coverage rather than guessing.
- **System is host interop.** `System/cmd` can record the Git revision or run a
  bounded project command. Discover literal `System/get_env` reads from source;
  list their names and defaults, never runtime credential values. Do not confuse
  the capitalized host module with the lowercase `system.*` analysis namespaces.

Distinguish settings (deliberate choices), reference data, operational state,
implementation limits and external constraints. For a setting record its type,
default, scope, edit role, consumers, source and proposed UI home. Derive the
simplest scope model from the actual product; don't add policy precedence layers
just because the framework could support them.

Use the included **`ontology_graph`, `settings_graph`, `code_graph`** blocks for
review: overview → connected detail → source evidence → consequence. Each card
says what exists, what changes and why. These are review surfaces, not invented
product screens or sparse database entity/attribute cards. When showing product
UI, start from existing views and keep proposals visibly distinct.

Read [the block grammar](references/blocks.md) when authoring; run the
[example](examples/review.bl.org) with the included host:

```sh
bl serve -p bl-org-dossier/kit -p codebase-review/kit \
  codebase-review/kit/serve.bl -- /absolute/path/review.bl.org
```

Run from the enchanted-skills checkout, or use absolute library paths. This host
reuses the dossier navigation, graph viewer and authenticated feedback lifecycle.
Set `DOSSIER_OWNER` before publishing; only the host may authorize writes.

Inspect the old representation and the result in a browser. Check connected
navigation, graph selection, Back, fullscreen/Escape, phone overflow and themes.
Preserve reader answers when revising a document; don't erase a rejection by
quietly replacing its block. Publish or push only within the user's authorization.
