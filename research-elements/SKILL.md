---
name: research-elements
description: Build evidence-backed research harnesses that emit finite, inspectable visual elements and persist their snapshots as native Org records.
---

Read the product's AGENTS.md and research first. Use `kit/research/elements.bl`
for the portable contract. Keep the product's design language, entity ontology,
source files, credentials and saved elements in the product repository.

1. Define source revisions, document locators, entity identity and relation semantics.
2. Return finite element data from a tool. Choose an installed renderer from
   `network`, `comparison`, `timeline`, `shortlist`, `gaps`. Never evaluate model output.
3. Supported graph edges require an exact source locator and temporal bounds.
   Candidate and disputed claims remain visible separately. Co-location does
   not establish ownership; a missing fact is not a negative fact.
4. Preserve question, scope, period, source basis, renderer/function version,
   evidence references and the saved snapshot in `#+begin_research_element`.
5. On reopening, compare source basis. Keep the prior snapshot and offer an
   explicit refresh. Do not silently rewrite an answer against changed sources.
6. Register the same pure renderers for tool results, workspace, dossier and
   component specimens. Arbitrary browser inputs cannot select a callable.
7. If using Enchant editable projections, adapt `editor-descriptor` to the
   installed `live.edit.app` package and resolve the saved element ID through
   the authority. The descriptor alone does not install or qualify that editor.
8. Check real native traversal, unsupported facts, period bounds, round-trip
   Org persistence, stale basis, rejected renderer IDs, and durable browser saves.

This is a graph retrieval and element contract. It does not implement embeddings,
LLM extraction, Leiden community detection or Microsoft GraphRAG global search.
Those require explicit adapters and their own evidence. Label deterministic
fixtures and provider-backed runs where the user sees their results.
