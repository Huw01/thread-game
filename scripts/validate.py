#!/usr/bin/env python3
"""Light automatic checks on game/config.json before the bot commits a change.
Usage: python3 scripts/validate.py [path]  -> exit 0 ok, 1 rejected."""
import json, re, sys
MAX_BYTES = 64_000; MAX_ENTITIES = 200; MAX_STR = 280
BAD_WORDS = {"nigger","faggot","retard","kike","chink","spic","tranny","rape","nazi","hitler"}
URL = re.compile(r"(https?:|//|javascript:|data:|<\s*script|<\s*iframe|on\w+\s*=|import\s*\(|eval\s*\()", re.I)
ALLOWED_URL = re.compile(r"^https://(x|twitter)\.com/[A-Za-z0-9_]+/status/\d+")

def walk(v, path, errs):
    if isinstance(v, dict):
        for k, x in v.items(): walk(x, f"{path}.{k}", errs)
    elif isinstance(v, list):
        for i, x in enumerate(v): walk(x, f"{path}[{i}]", errs)
    elif isinstance(v, str):
        if len(v) > MAX_STR: errs.append(f"{path}: string too long")
        if path.endswith(".reply_url"):
            if not ALLOWED_URL.match(v): errs.append(f"{path}: reply_url must be an x.com status link")
        elif URL.search(v): errs.append(f"{path}: URLs/scripts not allowed")
        low = re.sub(r"[^a-z]", " ", v.lower())
        if any(w in low.split() for w in BAD_WORDS): errs.append(f"{path}: offensive text")

def main(p="game/config.json"):
    raw = open(p, "rb").read(); errs = []
    if len(raw) > MAX_BYTES: errs.append(f"file too large ({len(raw)} > {MAX_BYTES})")
    try:
        cfg = json.loads(raw)
        assert isinstance(cfg, dict), "top level must be an object"
    except Exception as e: print("REJECT: invalid JSON:", e); return 1
    for k in ("arena", "player", "entities", "rules", "scoring", "changelog"):
        if k not in cfg: errs.append(f"missing key: {k}")
    if len(cfg.get("entities", [])) > MAX_ENTITIES: errs.append("too many entities")
    a = cfg.get("arena") if isinstance(cfg.get("arena"), dict) else {}
    if not isinstance(cfg.get("entities", []), list): errs.append("entities must be a list"); cfg["entities"] = []
    if not (100 <= a.get("width", 0) <= 1600 and 100 <= a.get("height", 0) <= 1200): errs.append("arena size out of range")
    walk(cfg, "$", errs)
    if errs: print("REJECT:\n  " + "\n  ".join(errs)); return 1
    print("OK"); return 0

if __name__ == "__main__": sys.exit(main(*sys.argv[1:]))
