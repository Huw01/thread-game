# Thread Game

An experiment: a browser game that starts **blank** and is built live by replies on an X thread.

1. F.rl posts a thread. People reply with ideas ("add yellow coins", "make players squares").
2. A bot reads the replies, turns each idea into an edit to `game/config.json`, runs `scripts/validate.py`
   (valid JSON, no external scripts/URLs, size limits, no offensive text) and commits it. No human review.
3. GitHub Pages redeploys; everyone playing sees the new game. The changelog panel links each change to the reply that caused it.

Multiplayer presence and the live scoreboard use Supabase (free tier). Without keys it runs single-player.

## Stack
- PixiJS 8.6.6 and supabase-js 2.45.4, vendored in `vendor/` (no CDN at runtime)
- Static files only, hosted on GitHub Pages

## Setup
1. Create a free Supabase project. Run `supabase/schema.sql` in the SQL editor and enable anonymous sign-ins.
2. Put the project URL and anon key in `config.js`.
3. Run locally: `python3 -m http.server` then open http://localhost:8000

## Controls
Arrow keys / WASD, or touch/drag.
