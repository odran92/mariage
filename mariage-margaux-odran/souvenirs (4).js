/* ============================================================================
   Rubrique « Nos plus beaux souvenirs » : dépôt des photos + galerie.
   Les réglages sont dans souvenirs-config.js, le serveur dans Code.gs.
   ========================================================================== */
(() => {
  const root = document.getElementById("souvenirs");
  if (!root) return;
  const C = Object.assign({ PHOTOS_ENDPOINT: "", UPLOAD_PAGE_URL: "", LEGACY_FORM_URL: "", VIDEOS_OUVERTES: false, GALERIE_ACTIVE: false, GALERIE: [] }, window.SOUVENIRS_CONFIG || {});
  const $ = (s) => root.querySelector(s);
  const el = {
    photosBtn: $("#memo-photos"), videosBtn: $("#memo-videos"), videosNote: $("#memo-videos-note"),
    input: $("#memo-input"), panel: $("#memo-panel"), summary: $("#memo-summary"), pick: $("#memo-pick"),
    send: $("#memo-send"), bar: $("#memo-bar"), barFill: $("#memo-bar-fill"), status: $("#memo-status"),
    list: $("#memo-list"), retry: $("#memo-retry"), again: $("#memo-again"), done: $("#memo-done"), warn: $("#memo-warn"),
    gallery: $("#memo-gallery"), galleryGrid: $("#memo-gallery-grid"), galleryEmpty: $("#memo-gallery-empty"), test: $("#memo-test")
  };

  const CHUNK = 3 * 1024 * 1024;           // 3 Mo (multiple de 256 Ko, exigé par Google Drive)
  const MAX_TRIES = 4;
  const SENT_KEY = "mo_souvenirs_sent_v1";
  const guest = (() => {
    try { let g = localStorage.getItem("mo_guest"); if (!g) { g = rnd(12); localStorage.setItem("mo_guest", g); } return g; } catch (e) { return rnd(12); }
  })();
  function rnd(n) { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(n)); r.forEach((v) => (s += a[v % a.length])); return s; }

  let items = [];       // {id, file, state: wait|up|ok|err, sent, error}
  let running = false;
  let seq = 0;
  let wake = null;
  const sentSet = (() => { try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || "[]")); } catch (e) { return new Set(); } })();
  const sig = (f) => `${f.name}|${f.size}|${f.lastModified}`;
  const saveSent = () => { try { localStorage.setItem(SENT_KEY, JSON.stringify([...sentSet].slice(-3000))); } catch (e) {} };
  const mb = (b) => (b / 1048576 >= 10 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1).replace(".", ",")) + " Mo";

  /* ---------- Messages d'erreur lisibles ---------- */
  const MSG = {
    too_large: "Fichier trop volumineux.", type_not_allowed: "Ce type de fichier n'est pas accepté (photos uniquement).",
    videos_closed: "Le dépôt de vidéos n'est pas encore ouvert.", rate_limited: "Trop d'envois pour aujourd'hui.",
    storage_full: "L'espace de stockage est plein. Merci de prévenir les mariés !", drive_refused: "Google Drive a refusé le fichier.",
    network: "Connexion interrompue.", server: "Le serveur ne répond pas."
  };
  const FATAL = new Set(["too_large", "type_not_allowed", "videos_closed", "rate_limited", "storage_full"]);

  /* ---------- Dialogue avec le serveur ---------- */
  async function call(payload) {
    const res = await fetch(C.PHOTOS_ENDPOINT, { method: "POST", body: JSON.stringify(payload) }); // texte simple : pas de « preflight »
    if (!res.ok) throw Object.assign(new Error("http"), { kind: "server" });
    let json;
    try { json = await res.json(); } catch (e) { throw Object.assign(new Error("json"), { kind: "server" }); }
    if (!json.ok) throw Object.assign(new Error(json.error || "server"), { kind: json.error || "server", fatal: FATAL.has(json.error) });
    return json;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function b64(blob) {
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1] || "");
      r.onerror = () => ko(r.error);
      r.readAsDataURL(blob);
    });
  }
  async function retrying(fn) {
    let last;
    for (let t = 0; t < MAX_TRIES; t++) {
      try { return await fn(t); } catch (e) {
        last = e; if (e.fatal) throw e;
        await sleep([1000, 3000, 7000][t] || 7000);
      }
    }
    throw last;
  }

  async function uploadOne(it, onBytes) {
    const f = it.file, total = f.size;
    const start = await retrying(() => call({ action: "start", uid: guest, idx: it.idx, name: f.name, size: total, mime: f.type || "" }));
    if (start.done) { onBytes(total); return; }
    const session = start.session;
    let offset = 0;
    while (offset < total) {
      const end = Math.min(offset + CHUNK, total);
      const data = await b64(f.slice(offset, end));
      let reply;
      try {
        reply = await retrying(async (t) => {
          if (t > 0) { // après une coupure : on demande au serveur où en est Google Drive
            const st = await call({ action: "status", session, total });
            if (st.done) return st;
            if (st.next >= end) return { ok: true, done: false, next: st.next };
            if (st.next !== offset) throw Object.assign(new Error("resume"), { kind: "server", resume: st.next });
          }
          return call({ action: "chunk", session, start: offset, end, total, data });
        });
      } catch (e) {
        if (typeof e.resume === "number") { offset = e.resume; continue; }
        throw e;
      }
      if (reply.done) { onBytes(total); return; }
      offset = reply.next && reply.next > offset ? reply.next : end;
      onBytes(offset);
    }
    // Dernière vérification : Google Drive doit confirmer que le fichier est complet
    const fin = await retrying(() => call({ action: "status", session, total }));
    if (!fin.done) throw Object.assign(new Error("incomplete"), { kind: "server" });
  }

  /* ---------- Interface ---------- */
  function render() {
    const waiting = items.filter((i) => i.state === "wait" || i.state === "up");
    const ok = items.filter((i) => i.state === "ok").length;
    const err = items.filter((i) => i.state === "err");
    const n = items.length;
    const totalBytes = items.reduce((s, i) => s + i.file.size, 0);
    const doneBytes = items.reduce((s, i) => s + (i.state === "ok" ? i.file.size : i.sent || 0), 0);

    el.panel.hidden = n === 0 && !running;
    el.summary.textContent = n === 0 ? "" : `${n} photo${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""} · ${mb(totalBytes)}`;
    el.send.hidden = running || waiting.length === 0 || ok + err.length === n && waiting.length === 0;
    el.send.textContent = `Envoyer mes souvenirs (${waiting.length})`;
    el.pick.hidden = running;
    el.bar.hidden = !(running || ok + err.length > 0);
    el.barFill.style.width = (totalBytes ? Math.min(100, (doneBytes / totalBytes) * 100) : 0) + "%";
    el.bar.setAttribute("aria-valuenow", Math.round(totalBytes ? (doneBytes / totalBytes) * 100 : 0));
    if (running) el.status.textContent = `${ok} envoyée${ok > 1 ? "s" : ""} sur ${n} · ${n - ok - err.length} restante${n - ok - err.length > 1 ? "s" : ""}${err.length ? " · " + err.length + " en erreur" : ""}`;
    el.warn.hidden = !running;
    el.retry.hidden = running || err.length === 0;
    el.retry.textContent = err.length > 1 ? `Réessayer les ${err.length} photos échouées` : "Réessayer la photo échouée";
    el.done.hidden = !(!running && n > 0 && waiting.length === 0 && err.length === 0);
    el.again.hidden = el.done.hidden;
    if (!running && n > 0 && waiting.length === 0) {
      el.status.textContent = err.length ? `${ok} envoyée${ok > 1 ? "s" : ""} sur ${n} — ${err.length} n'${err.length > 1 ? "ont" : "a"} pas pu être envoyée${err.length > 1 ? "s" : ""}.` : "";
      el.done.textContent = `Merci ! Vos ${ok} photo${ok > 1 ? "s ont" : " a"} bien été reçue${ok > 1 ? "s" : ""}. Vous pouvez en ajouter d'autres si vous le souhaitez.`;
    }
    // liste détaillée (limitée pour rester fluide avec 100+ photos)
    const show = items.filter((i) => i.state !== "ok").slice(0, 40);
    el.list.innerHTML = "";
    show.forEach((i) => {
      const li = document.createElement("li");
      li.className = "memo-item is-" + i.state;
      const label = { wait: "En attente", up: "Envoi…", err: i.error || "Erreur" }[i.state];
      li.innerHTML = `<span class="memo-name"></span><span class="memo-state"></span>`;
      li.firstChild.textContent = i.file.name;
      li.lastChild.textContent = label;
      el.list.appendChild(li);
    });
    if (items.filter((i) => i.state !== "ok").length > 40) {
      const li = document.createElement("li"); li.className = "memo-item"; li.textContent = "…et les suivantes"; el.list.appendChild(li);
    }
  }

  function addFiles(files) {
    const known = new Set(items.map((i) => sig(i.file)));
    let skipped = 0, rejected = 0;
    Array.from(files).forEach((f) => {
      const isImg = (f.type || "").startsWith("image/") || /\.(jpe?g|png|heic|heif|webp|gif|tiff?|avif|dng)$/i.test(f.name);
      if (!isImg) { rejected++; return; }
      if (known.has(sig(f)) || sentSet.has(sig(f))) { skipped++; return; }
      known.add(sig(f));
      items.push({ id: ++seq, idx: seq, file: f, state: "wait", sent: 0 });
    });
    const parts = [];
    if (skipped) parts.push(skipped > 1 ? skipped + " photos déjà envoyées ou déjà sélectionnées ont été ignorées." : "1 photo déjà envoyée ou déjà sélectionnée a été ignorée.");
    if (rejected) parts.push(`${rejected} fichier${rejected > 1 ? "s ne sont" : " n'est"} pas une photo (les vidéos auront leur propre bouton).`);
    el.summary.dataset.note = parts.join(" ");
    render();
    if (parts.length) el.summary.textContent += " — " + parts.join(" ");
  }

  async function lock() { try { if ("wakeLock" in navigator) wake = await navigator.wakeLock.request("screen"); } catch (e) {} }
  function unlock() { try { wake && wake.release(); } catch (e) {} wake = null; }
  const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };

  async function run() {
    if (running) return;
    running = true; window.addEventListener("beforeunload", beforeUnload); lock(); render();
    for (const it of items) {
      if (it.state !== "wait") continue;
      it.state = "up"; it.error = ""; render();
      try {
        await uploadOne(it, (b) => { it.sent = b; render(); });
        it.state = "ok"; sentSet.add(sig(it.file)); saveSent();
      } catch (e) {
        it.state = "err"; it.sent = 0;
        it.error = MSG[e.kind] || (e.kind === "server" || e.name === "TypeError" ? MSG.network : MSG.server);
        if (e.kind === "storage_full" || e.kind === "rate_limited") { // inutile d'insister : on arrête proprement
          items.filter((x) => x.state === "wait").forEach((x) => { x.state = "err"; x.error = MSG[e.kind]; });
        }
      }
      render();
    }
    running = false; window.removeEventListener("beforeunload", beforeUnload); unlock(); render();
  }

  /* ---------- Branchements ---------- */
  el.photosBtn.addEventListener("click", () => {
    if (!C.PHOTOS_ENDPOINT) { window.open(C.UPLOAD_PAGE_URL || C.LEGACY_FORM_URL, "_blank", "noopener"); return; } // secours : ancien formulaire
    el.panel.hidden = false; el.input.click();
  });
  el.pick.addEventListener("click", () => el.input.click());
  el.input.addEventListener("change", () => { addFiles(el.input.files); el.input.value = ""; });
  el.send.addEventListener("click", run);
  el.retry.addEventListener("click", () => { items.forEach((i) => { if (i.state === "err") { i.state = "wait"; i.error = ""; } }); run(); });
  el.again.addEventListener("click", () => { items = items.filter((i) => i.state !== "ok"); render(); el.input.click(); });

  /* Vidéos */
  if (el.videosBtn) el.videosBtn.addEventListener("click", () => {
    if (!C.VIDEOS_OUVERTES) { el.videosNote.textContent = C.VIDEOS_MESSAGE || ""; el.videosNote.hidden = false; return; }
    if (!C.PHOTOS_ENDPOINT) window.open(C.UPLOAD_PAGE_URL || C.LEGACY_FORM_URL, "_blank", "noopener");
  });

  /* Galerie « Revivez notre mariage » (masquée tant que GALERIE_ACTIVE est false) */
  if (el.gallery && C.GALERIE_ACTIVE && Array.isArray(C.GALERIE) && C.GALERIE.length) {
    el.galleryEmpty.hidden = true;
    C.GALERIE.forEach((m) => {
      const fig = document.createElement("figure"); fig.className = "memo-fig";
      if (m.type === "video") { const v = document.createElement("video"); v.src = m.src; v.controls = true; v.preload = "metadata"; v.playsInline = true; fig.appendChild(v); }
      else { const i = document.createElement("img"); i.src = m.src; i.alt = m.alt || ""; i.loading = "lazy"; fig.appendChild(i); }
      el.galleryGrid.appendChild(fig);
    });
  }

  /* ---------- Mode test (ajoutez ?test=1 à l'adresse du site) ---------- */
  if (/[?&]test=1/.test(location.search) && el.test) {
    el.test.hidden = false;
    const out = el.test.querySelector("#memo-test-out");
    const log = (t, ok) => { const p = document.createElement("p"); p.textContent = (ok === undefined ? "• " : ok ? "✅ " : "❌ ") + t; out.appendChild(p); };
    el.test.querySelector("#memo-test-run").addEventListener("click", async () => {
      out.innerHTML = "";
      if (!C.PHOTOS_ENDPOINT) { log("PHOTOS_ENDPOINT est vide dans souvenirs-config.js.", false); return; }
      const mk = (name, bytes) => new File([new Uint8Array(bytes).map((_, i) => (i * 31) & 255)], name, { type: "image/png" });
      for (const [label, f] of [["Petit fichier (1 morceau)", mk("TEST-petit.png", 40000)], ["Fichier de 7 Mo (3 morceaux)", mk("TEST-7mo.png", 7 * 1048576)]]) {
        const it = { idx: 9000 + Math.floor(Math.random() * 900), file: f };
        const t0 = Date.now();
        try { await uploadOne(it, () => {}); log(`${label} : reçu par Google Drive en ${((Date.now() - t0) / 1000).toFixed(1)} s`, true); }
        catch (e) { log(`${label} : échec (${e.kind || e.name}: ${e.message})`, false); }
      }
      log("Vérifiez maintenant dans le dossier Drive : 2 fichiers « TEST-… » doivent être arrivés (à supprimer ensuite).");
    });
  }

  render();
})();
