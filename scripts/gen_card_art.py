#!/usr/bin/env python3
"""
Free player card-art generator using Pollinations.ai (no API key, no cost).

  python3 scripts/gen_card_art.py [--priority-only] [--limit N] [--concurrency N]

Reads card-prompts.jsonl, generates any card that has no image yet, and saves
public/cards/players/<id>.jpg. Resume-safe (existing files are skipped). Run
scripts/gen-card-art-manifest.mjs afterwards to update the app manifest.

Runs anywhere Python 3 can reach the network (stdlib only: urllib + threads).
"""
import json
import os
import sys
import time
import threading
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS = os.path.join(ROOT, "card-prompts.jsonl")
OUT_DIR = os.path.join(ROOT, "public", "cards", "players")
EXTS = (".jpg", ".jpeg", ".png", ".webp")

def opt(name, default):
    return next((a.split("=")[1] for a in sys.argv if a.startswith(name + "=")), default)

priority_only = "--priority-only" in sys.argv
skip_priority = "--skip-priority" in sys.argv  # generate everything EXCEPT legend/elite
limit = int(opt("--limit", 0)) or None
concurrency = int(opt("--concurrency", 3))
model = opt("--model", "flux")          # flux (best) | turbo (fast)
width = int(opt("--width", 736))
height = int(opt("--height", 981))

os.makedirs(OUT_DIR, exist_ok=True)

def has_image(card_id):
    return any(os.path.exists(os.path.join(OUT_DIR, card_id + e)) for e in EXTS)

with open(PROMPTS, encoding="utf-8") as f:
    cards = [json.loads(line) for line in f if line.strip()]

if priority_only:
    cards = [c for c in cards if c["rarity"] in ("LEGEND", "ELITE")]
elif skip_priority:
    cards = [c for c in cards if c["rarity"] not in ("LEGEND", "ELITE")]
todo = [c for c in cards if not has_image(c["id"])]
if limit:
    todo = todo[:limit]

print(f"scope: {len(cards)} | to generate: {len(todo)} | model: {model} {width}x{height} | concurrency: {concurrency}", flush=True)

done = 0
failed = 0
lock = threading.Lock()
start = time.time()

def generate(card):
    global done, failed
    seed = int(str(card["id"]).split("-")[-1]) % 2_000_000_000
    q = urllib.parse.quote(card["prompt"])
    url = (f"https://image.pollinations.ai/prompt/{q}"
           f"?width={width}&height={height}&model={model}&nologo=true&seed={seed}")
    out = os.path.join(OUT_DIR, card["id"] + ".jpg")
    for attempt in range(1, 9):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "golazo-card-gen/1.0"})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            if len(data) < 2000:
                raise ValueError(f"suspiciously small ({len(data)}b)")
            with open(out, "wb") as fh:
                fh.write(data)
            with lock:
                done += 1
                n = done + failed
                el = time.time() - start
                print(f"[{n}/{len(todo)} {el:5.0f}s] OK  {card['rarity']:6} {card['id']}  {card['name']}", flush=True)
            return
        except Exception as e:  # noqa: BLE001
            if attempt == 8:
                with lock:
                    failed += 1
                    print(f"[fail] {card['id']} {card['name']}: {e}", flush=True)
                return
            # Honour Retry-After on 429; otherwise exponential backoff.
            wait = min(90, 6 * 2 ** (attempt - 1))
            if isinstance(e, urllib.error.HTTPError) and e.code == 429:
                ra = e.headers.get("Retry-After")
                wait = max(wait, int(ra)) if (ra and ra.isdigit()) else max(wait, 45)
            time.sleep(wait)

if todo:
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        list(ex.map(generate, todo))

print(f"\ndone: {done} generated, {failed} failed, {len(cards) - len(todo)} skipped in {time.time() - start:.0f}s", flush=True)
