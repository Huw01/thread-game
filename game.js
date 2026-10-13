(async () => {
  const $ = (id) => document.getElementById(id);
  const cfg = await (await fetch("game/config.json", { cache: "no-store" })).json();
  $("title").textContent = cfg.title || "Thread Game";

  const app = new PIXI.Application();
  await app.init({ width: cfg.arena.width, height: cfg.arena.height, background: cfg.arena.background, antialias: true });
  $("stage").appendChild(app.canvas);

  const me = { id: (crypto.randomUUID?.() || String(Math.random()).slice(2)), name: "player-" + Math.floor(Math.random() * 1000), x: cfg.arena.width / 2, y: cfg.arena.height / 2, score: 0 };
  const shape = (color, size, kind) => {
    const g = new PIXI.Graphics();
    if (kind === "square") g.rect(-size, -size, size * 2, size * 2); else g.circle(0, 0, size);
    return g.fill(color);
  };

  // Data-driven entities (added by the bot from X replies)
  const entities = (cfg.entities || []).flatMap((e) => Array.from({ length: Math.min(e.count || 1, 50) }, () => {
    const s = shape(e.color || "#ff0", e.size || 10, e.shape);
    if (e.glow) { const h = new PIXI.Graphics().circle(0, 0, (e.size || 10) * 2).fill({ color: e.color || "#ff0", alpha: 0.25 }); s.addChildAt(h, 0); }
    s.x = e.x ?? Math.random() * cfg.arena.width; s.y = e.y ?? Math.random() * cfg.arena.height;
    s.meta = e; app.stage.addChild(s); return s;
  }));

  const mine = shape(cfg.player.color, cfg.player.size, cfg.player.shape);
  app.stage.addChild(mine);
  const others = new Map();

  // Input: keys + touch/pointer drag target
  const keys = {}; let target = null;
  addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
  addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
  app.canvas.addEventListener("pointerdown", (e) => { target = e; });
  app.canvas.addEventListener("pointermove", (e) => { if (target) target = e; });
  addEventListener("pointerup", () => { target = null; });

  const now0 = () => performance.now();
  let net = null, lastSend = 0, alive = 0;
  app.ticker.add((t) => {
    const sp = cfg.player.speed * t.deltaTime;
    if (keys.arrowleft || keys.a) me.x -= sp;
    if (keys.arrowright || keys.d) me.x += sp;
    if (keys.arrowup || keys.w) me.y -= sp;
    if (keys.arrowdown || keys.s) me.y += sp;
    if (target) {
      const r = app.canvas.getBoundingClientRect();
      const dx = target.clientX - r.left - me.x, dy = target.clientY - r.top - me.y, d = Math.hypot(dx, dy);
      if (d > 2) { me.x += (dx / d) * sp; me.y += (dy / d) * sp; }
    }
    me.x = Math.max(0, Math.min(cfg.arena.width, me.x));
    me.y = Math.max(0, Math.min(cfg.arena.height, me.y));
    mine.x = me.x; mine.y = me.y;

    for (const s of entities) {
      if (s.visible && s.meta.type === "collectible" && Math.hypot(s.x - me.x, s.y - me.y) < (s.meta.size || 10) + cfg.player.size) {
        s.visible = false; me.score += s.meta.points ?? (cfg.scoring.pointsPerCollect || 1);
        setTimeout(() => { s.x = Math.random() * cfg.arena.width; s.y = Math.random() * cfg.arena.height; s.visible = true; }, 1500);
      }
    }
    // Enemies: chase closest visible player (local + others), touch deducts score once per hit
    const players = [{ x: me.x, y: me.y, local: true }];
    for (const o of others.values()) if (o && Number.isFinite(o.x)) players.push({ x: o.x, y: o.y, local: false });
    for (const s of entities) {
      if (!s.visible || s.meta.type !== "enemy" || s.meta.behavior !== "chase_closest") continue;
      let best = null, bestD = Infinity;
      for (const p of players) {
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best && bestD > 0.5) {
        const esp = (s.meta.speed || 2) * t.deltaTime;
        s.x += ((best.x - s.x) / bestD) * esp;
        s.y += ((best.y - s.y) / bestD) * esp;
        s.x = Math.max(0, Math.min(cfg.arena.width, s.x));
        s.y = Math.max(0, Math.min(cfg.arena.height, s.y));
      }
      if (best && best.local && bestD < (s.meta.size || 10) + cfg.player.size) {
        if (!s._hitCool) {
          s._hitCool = true;
          if (s.meta.onHit === "score-1") me.score = Math.max(0, me.score - 1);
          setTimeout(() => { s._hitCool = false; }, 800);
        }
      }
    }
    for (const s of entities) if (s.meta.glow && s.visible) s.alpha = 0.75 + 0.25 * Math.sin(now0() / 200);
    alive += t.deltaMS / 1000;
    if (cfg.scoring.pointsPerSecondAlive && alive >= 1) { me.score += cfg.scoring.pointsPerSecondAlive; alive = 0; }

    const now = performance.now();
    if (net && now - lastSend > 100) { lastSend = now; net.move(); }
  });

  // Changelog panel
  const cl = $("changelog");
  const log = cfg.changelog || [];
  if (!log.length) cl.innerHTML = "<li>Blank. Reply on the X thread to build it.</li>";
  for (const c of [...log].reverse()) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = c.reply_url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "@" + (c.author || "?");
    li.append(a, document.createTextNode(": " + (c.summary || "")));
    cl.appendChild(li);
  }

  // Top builders: accepted changes per X author, from the changelog
  const tb = $("builders"); const counts = {};
  for (const c of log) counts[c.author || "?"] = (counts[c.author || "?"] || 0) + 1;
  const rowsB = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!rowsB.length) tb.innerHTML = "<li>No builders yet.</li>";
  for (const [n, k] of rowsB) { const li = document.createElement("li"); li.textContent = `@${n}: ${k} change${k === 1 ? "" : "s"}`; tb.appendChild(li); }

  // Scoreboard
  const local = new Map();
  const renderScores = (rows) => {
    const ul = $("scores"); ul.innerHTML = "";
    for (const r of rows.sort((a, b) => b.score - a.score).slice(0, 10)) {
      const li = document.createElement("li"); li.textContent = `${r.name}: ${r.score}`; ul.appendChild(li);
    }
  };

  const C = window.THREAD_GAME_CONFIG || {};
  const configured = C.SUPABASE_URL && !C.SUPABASE_URL.startsWith("YOUR_") && window.supabase;
  if (!configured) {
    $("status").textContent = "Single-player (Supabase not configured)";
    setInterval(() => renderScores([{ name: me.name + " (you)", score: me.score }]), 500);
    return;
  }

  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const { data: auth } = await sb.auth.signInAnonymously();
  const uid = auth?.user?.id;
  const ch = sb.channel("arena", { config: { presence: { key: me.id }, broadcast: { self: false } } });
  ch.on("broadcast", { event: "move" }, ({ payload: p }) => {
    let o = others.get(p.id);
    if (!o) { o = shape("#4af", cfg.player.size, cfg.player.shape); app.stage.addChild(o); others.set(p.id, o); }
    o.x = p.x; o.y = p.y;
  });
  ch.on("presence", { event: "leave" }, ({ key }) => { const o = others.get(key); if (o) { o.destroy(); others.delete(key); } });
  ch.on("presence", { event: "sync" }, () => { $("status").textContent = `Online: ${Object.keys(ch.presenceState()).length}`; });
  await ch.subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ name: me.name }); });
  net = { move: () => ch.send({ type: "broadcast", event: "move", payload: { id: me.id, x: me.x, y: me.y } }) };

  const loadScores = async () => {
    const { data } = await sb.from("scores").select("name,score").order("score", { ascending: false }).limit(10);
    if (data) renderScores(data);
  };
  sb.channel("scores-db").on("postgres_changes", { event: "*", schema: "public", table: "scores" }, loadScores).subscribe();
  loadScores();
  let lastScore = -1;
  setInterval(async () => {   // light usage: upsert at most every 5s, only on change
    if (uid && me.score !== lastScore) { lastScore = me.score; await sb.from("scores").upsert({ user_id: uid, name: me.name, score: me.score }); }
  }, 5000);
})();
