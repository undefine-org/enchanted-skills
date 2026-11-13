#!/usr/bin/env python3
"""Audit an app's lifecycles and its real navigation graph.

Two questions, deliberately separate:

1. Does the declared experience hold together?  A lifecycle is a small state
   machine attached to ONE surface.  States must be reachable, each non-terminal
   state must name one primary next hand, and exceptions must stay exceptions.
2. What does the running app actually connect?  Crawl the same-origin screens
   and measure the graph the reader really walks: routes, links, hubs, duplicate
   titles, and how much of the graph is just the global navigation.

Usage:
  lifecycle_audit.py audit  lifecycles.json [--json]
  lifecycle_audit.py crawl  https://host/views?view=today --param view --out graph.json
  lifecycle_audit.py graph  graph.json [--nav today,work,network] [--from today] [--to delivery] [--json]

Exit codes: 0 clean, 1 findings, 2 bad input.
No third-party packages, no writes outside the requested output file.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import urllib.parse
import urllib.request

# --------------------------------------------------------------------------- #
# Declared lifecycles
# --------------------------------------------------------------------------- #


def _state_ids(lifecycle):
    return [s["id"] for s in lifecycle.get("states", [])]


def audit_declaration(doc):
    errors, warnings = [], []
    surfaces = doc.get("surfaces", [])
    surface_ids = [s["id"] for s in surfaces]
    if len(surface_ids) != len(set(surface_ids)):
        errors.append("duplicate surface id")
    lifecycles = doc.get("lifecycles", [])
    if not lifecycles:
        errors.append("no lifecycles declared")

    max_states = int(doc.get("max_states_per_lifecycle", 6))
    all_screens = set()
    state_total = 0
    screen_reuse = 0
    per_lifecycle = []

    for lc in lifecycles:
        lid = lc.get("id", "?")
        states = lc.get("states", [])
        ids = _state_ids(lc)
        state_total += len(states)
        if not states:
            errors.append(f"{lid}: no states")
            continue
        if len(ids) != len(set(ids)):
            errors.append(f"{lid}: duplicate state id")
        if len(states) > max_states:
            warnings.append(
                f"{lid}: {len(states)} states exceeds the {max_states}-state budget"
            )
        screens = {s.get("screen") for s in states}
        all_screens.update(screens)
        if len(screens) == 1:
            screen_reuse += len(states) - 1
        elif len(screens) > 1:
            warnings.append(
                f"{lid}: states spread over {len(screens)} screens "
                f"({', '.join(sorted(str(x) for x in screens))}) — one object should keep one surface"
            )
        terminal = [s for s in states if s.get("terminal")]
        if not terminal and not lc.get("ongoing"):
            warnings.append(f"{lid}: no terminal state")
        for s in states:
            sid = s["id"]
            nxt = s.get("next", [])
            for t in nxt:
                if t not in ids:
                    errors.append(f"{lid}/{sid}: next names unknown state {t}")
            primary = s.get("primary")
            if s.get("terminal"):
                if primary:
                    warnings.append(f"{lid}/{sid}: terminal state names a primary next")
            elif not primary:
                errors.append(f"{lid}/{sid}: non-terminal state has no primary next")
            elif primary not in nxt:
                errors.append(f"{lid}/{sid}: primary {primary} is not in next")
            exceptions = s.get("exceptions", [])
            for e in exceptions:
                if e not in nxt:
                    errors.append(f"{lid}/{sid}: exception {e} is not in next")
        # reachability from the first state
        start = ids[0]
        seen, q = {start}, collections.deque([start])
        by_id = {s["id"]: s for s in states}
        while q:
            cur = q.popleft()
            for t in by_id[cur].get("next", []):
                if t not in seen:
                    seen.add(t)
                    q.append(t)
        for sid in ids:
            if sid not in seen:
                errors.append(f"{lid}/{sid}: unreachable from {start}")
        per_lifecycle.append(
            {
                "id": lid,
                "label": lc.get("label", lid),
                "entry": lc.get("entry"),
                "states": len(states),
                "screens": sorted(x for x in screens if x),
                "terminals": [s["id"] for s in terminal],
            }
        )

    # Surface distance from Today, ignoring global navigation.
    edges = collections.defaultdict(set)
    for e in doc.get("edges", []):
        edges[e["from"]].add(e["to"])
        if e.get("both_ways"):
            edges[e["to"]].add(e["from"])

    def distance(start, goal):
        if start == goal:
            return 0
        q, seen = collections.deque([(start, 0)]), {start}
        while q:
            n, d = q.popleft()
            for t in edges.get(n, ()):
                if t == goal:
                    return d + 1
                if t not in seen:
                    seen.add(t)
                    q.append((t, d + 1))
        return None

    start = doc.get("start", "today")
    entries = [
        {"lifecycle": lc["id"], "entry": lc["entry"], "distance": distance(start, lc["entry"])}
        for lc in lifecycles
        if lc.get("entry")
    ]
    for e in entries:
        if e["distance"] is None:
            warnings.append(f"{e['lifecycle']}: entry {e['entry']} is unreachable from {start}")
        elif e["distance"] > int(doc.get("max_entry_distance", 1)):
            warnings.append(
                f"{e['lifecycle']}: entry needs {e['distance']} steps from {start} "
                f"(budget {doc.get('max_entry_distance', 1)})"
            )

    cross = [e for e in doc.get("edges", []) if e.get("kind") == "cross"]
    report = {
        "kind": "lifecycle-audit",
        "surfaces": len(surfaces),
        "lifecycles": len(lifecycles),
        "states": state_total,
        "avg_states": round(state_total / len(lifecycles), 2) if lifecycles else 0,
        "screen_reuse": screen_reuse,
        "state_to_surface_ratio": round(state_total / len(surfaces), 2) if surfaces else 0,
        "cross_edges": len(cross),
        "entries": entries,
        "per_lifecycle": per_lifecycle,
        "errors": errors,
        "warnings": warnings,
    }
    return report


# --------------------------------------------------------------------------- #
# Running navigation graph
# --------------------------------------------------------------------------- #

HREF = re.compile(r'href="([^"]+)"')
H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S | re.I)
TAG = re.compile(r"<[^>]+>")


def _fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "lifecycle-audit/1"})
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace")


def _clean(s):
    return re.sub(r"\s+", " ", TAG.sub(" ", s)).strip()


def crawl(base, start, param="view", limit=250):
    """Follow same-path links whose query contains `param`."""
    base = base.rstrip("/")
    parsed = urllib.parse.urlsplit(base)
    root = f"{parsed.scheme}://{parsed.netloc}"
    start_path = urllib.parse.urlsplit(start if start.startswith("/") else "/" + start).path
    seen, edges, titles = {}, collections.defaultdict(set), {}
    q = collections.deque([start if start.startswith("/") else "/" + start])
    while q and len(seen) < limit:
        path = q.popleft()
        if path in seen:
            continue
        url = root + path
        try:
            html = _fetch(url)
        except Exception as exc:  # keep crawling; report the dead route
            seen[path] = {"error": str(exc)}
            continue
        h1 = H1.search(html)
        titles[path] = _clean(h1.group(1)) if h1 else ""
        seen[path] = {"title": titles[path], "words": len(_clean(html).split())}
        for href in HREF.findall(html):
            u = urllib.parse.urlsplit(urllib.parse.urljoin(url, href))
            if u.netloc != parsed.netloc or u.path != start_path:
                continue
            val = urllib.parse.parse_qs(u.query).get(param, [""])[0]
            if not val:
                continue
            target = f"{u.path}?{param}={urllib.parse.quote(val)}"
            if target == path:
                continue
            edges[path].add(target)
            if target not in seen and len(seen) < limit:
                q.append(target)
    return {
        "kind": "screen-graph",
        "origin": root,
        "param": param,
        "nodes": [{"route": p, "title": v.get("title", ""), "words": v.get("words", 0), "error": v.get("error")} for p, v in seen.items()],
        "edges": [{"from": p, "to": t} for p, ts in edges.items() for t in ts],
    }


def graph_report(doc, nav=(), source=None, target=None):
    nodes = {n["route"]: n for n in doc.get("nodes", [])}
    edges = collections.defaultdict(set)
    for e in doc.get("edges", []):
        edges[e["from"]].add(e["to"])
    n, m = len(nodes), sum(len(v) for v in edges.values())
    nav = set(nav)
    nav_edges = sum(1 for p, ts in edges.items() for t in ts if _route_view(t) in nav)
    titles = collections.Counter(x.get("title") for x in nodes.values() if x.get("title"))
    dup = {t: c for t, c in titles.items() if c > 1}
    words = [x.get("words", 0) for x in nodes.values() if x.get("title")]
    outs = [len(edges.get(p, ())) for p in nodes]

    report = {
        "kind": "screen-graph-report",
        "nodes": n,
        "edges": m,
        "density": round(m / (n * (n - 1)), 4) if n > 1 else 0,
        "out_degree": {
            "min": min(outs) if outs else 0,
            "max": max(outs) if outs else 0,
            "avg": round(m / n, 2) if n else 0,
        },
        "nav_edges": nav_edges,
        "nav_share": round(nav_edges / m, 3) if m else 0,
        "duplicate_titles": dup,
        "dead_ends": [p for p in nodes if not edges.get(p) and not nodes[p].get("error")],
        "error_routes": [p for p, x in nodes.items() if x.get("error")],
        "words": {"avg": round(sum(words) / len(words), 1) if words else 0, "max": max(words) if words else 0},
    }
    if source and target:
        report["path"] = shortest_path(edges, source, target)
    return report


def _route_view(route):
    return urllib.parse.parse_qs(urllib.parse.urlsplit(route).query).get("view", [""])[0]


def shortest_path(edges, source, target):
    q, seen = collections.deque([(source, [source])]), {source}
    while q:
        cur, path = q.popleft()
        if cur == target:
            return path
        for nxt in edges.get(cur, ()):
            if nxt not in seen:
                seen.add(nxt)
                q.append((nxt, path + [nxt]))
    return None


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def _print_report(rep):
    for k in ("surfaces", "lifecycles", "states", "avg_states", "state_to_surface_ratio", "cross_edges"):
        if k in rep:
            print(f"{k:24} {rep[k]}")
    for e in rep.get("entries", []):
        print(f"entry {e['lifecycle']:14} {str(e['entry']):14} {e['distance']}")
    for w in rep.get("warnings", []):
        print(f"warning: {w}")
    for e in rep.get("errors", []):
        print(f"ERROR: {e}")
    for k in ("nodes", "edges", "density", "nav_edges", "nav_share"):
        if k in rep:
            print(f"{k:24} {rep[k]}")
    if rep.get("duplicate_titles"):
        print("duplicate titles:", ", ".join(f"{t!r}×{c}" for t, c in rep["duplicate_titles"].items()))
    if rep.get("path"):
        print("path:", " → ".join(rep["path"]))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("audit", help="check a declared lifecycle map")
    a.add_argument("declaration")
    a.add_argument("--json", action="store_true")

    c = sub.add_parser("crawl", help="crawl a running screen host")
    c.add_argument("url")
    c.add_argument("--start", default="/views?view=today")
    c.add_argument("--param", default="view")
    c.add_argument("--out", required=True)

    g = sub.add_parser("graph", help="measure a crawled screen graph")
    g.add_argument("graph")
    g.add_argument("--nav", default="")
    g.add_argument("--from", dest="source")
    g.add_argument("--to", dest="target")
    g.add_argument("--json", action="store_true")

    args = ap.parse_args(argv)
    if args.cmd == "audit":
        with open(args.declaration) as f:
            doc = json.load(f)
        rep = audit_declaration(doc)
        print(json.dumps(rep, indent=2) if args.json else "", end="")
        if not args.json:
            _print_report(rep)
        return 1 if rep["errors"] else 0
    if args.cmd == "crawl":
        p = urllib.parse.urlsplit(args.url)
        base = f"{p.scheme}://{p.netloc}"
        start = p.path + (("?" + p.query) if p.query else "")
        doc = crawl(base, start or args.start, args.param)
        with open(args.out, "w") as f:
            json.dump(doc, f, indent=2)
        print(f"crawled {len(doc['nodes'])} routes, {len(doc['edges'])} links → {args.out}")
        return 0
    if args.cmd == "graph":
        with open(args.graph) as f:
            doc = json.load(f)
        nav = [x for x in args.nav.split(",") if x]
        rep = graph_report(doc, nav, args.source, args.target)
        print(json.dumps(rep, indent=2) if args.json else "", end="")
        if not args.json:
            _print_report(rep)
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
