# Shared dossier review

Existing documents need no migration. `dossier.page/page-h` adds the shared
review UI. The standard server handles its routes; custom hosts delegate to
`dossier.review.http/route` before their own routing. `decorate-page` adds the
same controls to standalone mockup and explorer HTML. These are the only host
hooks; comment parsing, permissions, persistence and UI live in the kit.

Readers use passage buttons, selected text, or explicit annotation mode on
same-origin mockups. Desktop uses a side panel and phones a bottom sheet.
Threads support replies, open/resolved filters, author filtering (including replies) and links. Numbered markers attach to matching visible mockup elements while the review panel is open.
A changed or missing target retains its original quotation. Drafts stay in the
browser through failed saves and reloads. Source prose gets content-derived
anchors without editing the document; authored block/view/component IDs are
preferred. Existing approval answers remain separate.

## Identity and grants

`DOSSIER_OWNER` retains approval rights. `DOSSIER_HANDLE` is its display handle.
`DOSSIER_REVIEWERS` is a private service-environment JSON object mapping exact
Tailscale logins to display handles, for example:

```sh
DOSSIER_REVIEWERS='{"reviewer@example.test":"reviewer"}'
```

Only handles reach Org source. Anonymous and unlisted readers cannot post.
A reviewer can comment and reply, and resolve/reopen their own threads; the
owner can resolve/reopen any thread. Comment grants never authorize `/answer`.
Read access follows the host's existing dossier policy. Keep the listener on
loopback behind the existing trusted Tailscale Serve identity headers.

## Native Org source

The native `#+begin_comment` / `#+end_comment` container stores annotations.
Plain comment blocks also appear as manually authored review notes, with a
stable synthetic ID; ordinary `#` source comment lines are not review records.
Generated notes carry Org description-list metadata followed by their body:

```org
#+begin_comment
- Review :: c-example
- Author :: reviewer
- Created :: 2026-11-11T15:00:00Z
- Target :: block:proposal
- View :: overview
- State :: open
- Encoding :: org-escaped

Who validates this step?
#+end_comment
```

`Target` is optional for handwritten notes: the nearest preceding rendered
node is used, or the enclosing component for a nested note. `View`, `Component`,
`Quote`, `Prefix` and `Suffix` retain finer context. Replies add `Reply-to`.

Comments can be nested in greater/custom Org blocks such as claims, quote and
screen_graph. They are extracted before any component interprets its lines.
Source, example, export, verse and comment bodies are literal: apparent blocks
inside them are never recursively interpreted. A COMMENT cannot nest another
COMMENT. Generated bodies escape delimiter/heading lines with Org's comma
escape; readback restores their literal text, indentation, trailing whitespace and original literal commas. Comments never execute code.

Comment-only writes refresh the review state without reloading the document or its mockups. Duplicate source passages are treated as ambiguous rather than silently reassigned, and unfinished Org blocks reject annotation insertion while preserving the draft.

Browser-created annotations are inserted after their enclosing source element;
heading properties and recorded code results stay together. Existing source
bytes outside the insertion/replaced comment are preserved. The shared writer
serializes in-process operations and uses an OS advisory lock plus byte-level
compare-and-replace across processes. Concurrent changes are retried against
fresh source. Saves are idempotent by comment ID; invalid/stale saves preserve
the browser draft and return an explicit error. External editors do not take
the advisory lock: a conflicting editor save observed before replacement is
rejected, but no filesystem API can promise coordination with an editor that
ignores locks and writes after the final comparison.

`kit/answers.bl` reports both approval answers and review discussions. Preserve
reader comments and answers; commit their feedback separately from responses.

## Nested span compatibility

`dossier.compat.spans` is a temporary namespaced copy of Enchant's
`bl.doc.spans`, with nested absolute-coordinate `:children` on container spans.
The top-level partition and executable-cell discovery stay unchanged. The same
fix and focused tests were committed directly to Enchant main as `338f039c2` and `da0cb75c3`.
The currently installed SDK rejects overriding its protected forwarders with
`:sdk_forwarder_route_changed`; an active `kit/bl/doc/spans.bl` override is
therefore unsafe. Retire the compatibility copy after an SDK containing that
upstream change is installed; require `bl.doc.spans` directly and run the same
nested-span tests before removing it.

## Verification

`kit/test/fixtures/review.bl.org` catalogs the accepted controls and is the
literal synthetic fixture. Use a disposable copy for HTTP/browser writes.
Run `kit/test/{nested_spans,review,feedback,kit}_test.bl` in one bounded BL VM.
Run `python3 kit/test/review_write_test.py` for interprocess CAS verification.
`review_browser_test.cjs` exercises authorized saves through the real server,
read-only readers, replies/resolution, stale targets, drafts, selection,
annotation and desktop/phone layouts. Set `REVIEW_BASE_URL` and `REVIEW_ARTIFACT_DIR`.
