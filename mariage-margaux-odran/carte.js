/* ============================================================================
   Rubrique « Où dormir ? » : carte Leaflet + OpenStreetMap, filtres, liste.
   Les données sont dans hebergements.js (c'est ce fichier-là qu'on modifie).
   ========================================================================== */
(() => {
  const root = document.getElementById("dormir");
  if (!root || !Array.isArray(window.HEBERGEMENTS) || !window.DOMAINE) return;

  const NEARBY_KM = 3; // « À proximité du domaine » = à moins de 3 km à vol d'oiseau
  const GEO_CACHE_KEY = "mo_geo_v1";

  const $ = (sel) => root.querySelector(sel);
  const mapEl = $("#stay-map");
  const listEl = $("#stay-list");
  const countEl = $("#stay-count");
  const emptyEl = $("#stay-empty");
  const hintEl = $("#stay-hint");
  const filterBtns = Array.from(root.querySelectorAll("[data-filter]"));

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Données ---------- */
  const domaine = Object.assign({}, window.DOMAINE, { pos: null });
  const items = window.HEBERGEMENTS.map((h) =>
    Object.assign({}, h, {
      pos: typeof h.lat === "number" && typeof h.lng === "number" ? [h.lat, h.lng] : null,
      dist: null
    })
  );
  const byId = new Map(items.map((h) => [h.id, h]));
  const fullAddress = (h) => `${h.adresse}, ${h.codePostal} ${h.ville}`;

  /* ---------- Distance à vol d'oiseau (haversine) ---------- */
  function km(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fmtDist(d) {
    if (d < 1) return `≈ ${Math.round(d * 10) * 100} m du domaine`;
    return `≈ ${d.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km du domaine`;
  }

  /* ---------- Liens ---------- */
  const itineraryUrl = (h) =>
    "https://www.google.com/maps/dir/?api=1&origin=" +
    encodeURIComponent(`${domaine.nom}, ${fullAddress(domaine)}`) +
    "&destination=" + encodeURIComponent(`${h.nom}, ${fullAddress(h)}`);
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

  /* ---------- Liste ---------- */
  function cardHtml(h) {
    const book = safeUrl(h.reservation);
    const photo = h.photo ? `<img class="stay-photo" src="${esc(h.photo)}" alt="" loading="lazy">` : "";
    return `
      ${photo}
      <p class="stay-kind">${esc(h.categorie)}</p>
      <h3>${esc(h.nom)}</h3>
      <p class="stay-addr">${esc(h.adresse)}<br>${esc(h.codePostal)} ${esc(h.ville)}</p>
      <p class="stay-dist" hidden></p>
      <div class="stay-actions">
        <button type="button" class="stay-focus">Voir sur la carte</button>
        <a class="stay-link" href="${esc(itineraryUrl(h))}" target="_blank" rel="noopener">Itinéraire</a>
        ${book ? `<a class="stay-book" href="${esc(book)}" target="_blank" rel="noopener">Réserver</a>` : ""}
      </div>`;
  }

  items.forEach((h) => {
    const li = document.createElement("li");
    li.className = "stay-card";
    li.dataset.id = h.id;
    li.innerHTML = cardHtml(h);
    li.querySelector(".stay-focus").addEventListener("click", () => select(h.id, { scrollMap: true }));
    h.li = li;
    listEl.appendChild(li);
  });

  /* ---------- Filtres ---------- */
  let filter = "tous";
  const predicates = {
    tous: () => true,
    proche: (h) => h.dist !== null && h.dist <= NEARBY_KM,
    hotel: (h) => h.type === "hotel",
    chambres: (h) => h.type === "chambres",
    budget: (h) => h.budget === true
  };
  const visible = () => items.filter(predicates[filter] || predicates.tous);

  function applyFilter() {
    const vis = new Set(visible().map((h) => h.id));
    items.forEach((h) => { h.li.hidden = !vis.has(h.id); });
    filterBtns.forEach((b) => {
      const on = b.dataset.filter === filter;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      const n = items.filter(predicates[b.dataset.filter]).length;
      const badge = b.querySelector(".n");
      if (badge) badge.textContent = n;
    });
    const n = vis.size;
    countEl.textContent = n === 0 ? "" : n === 1 ? "1 hébergement" : `${n} hébergements`;
    emptyEl.hidden = n !== 0;
    if (activeId && !vis.has(activeId)) select(null);
    drawMarkers();
    fit();
  }
  filterBtns.forEach((b) =>
    b.addEventListener("click", () => { filter = b.dataset.filter; applyFilter(); })
  );

  /* ---------- Carte ---------- */
  let map = null, layer = null, domaineMarker = null, activeId = null;
  const markers = new Map();

  const ICON_BED =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 15h18M3 19v1.5M21 19v1.5M7 9V7.5A1.5 1.5 0 0 1 8.5 6h2A1.5 1.5 0 0 1 12 7.5V9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_RINGS =
    '<svg viewBox="0 0 32 24" aria-hidden="true"><circle cx="11.5" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="20.5" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.2 3.4 11.5 6l2.3-2.6-1.2-1.9h-2.2z" fill="currentColor"/></svg>';

  const hotelIcon = (active) =>
    L.divIcon({
      className: "mk-wrap",
      html: `<span class="mk${active ? " is-active" : ""}">${ICON_BED}</span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -20]
    });
  const domaineIcon = () =>
    L.divIcon({
      className: "mk-wrap",
      html: `<span class="mk mk-domaine">${ICON_RINGS}</span>`,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      popupAnchor: [0, -28]
    });

  function popupHtml(h) {
    const book = safeUrl(h.reservation);
    const photo = h.photo ? `<img class="pop-photo" src="${esc(h.photo)}" alt="">` : "";
    return `
      <div class="pop">
        ${photo}
        <p class="pop-kind">${esc(h.categorie)}</p>
        <h4>${esc(h.nom)}</h4>
        <p class="pop-addr">${esc(h.adresse)}, ${esc(h.codePostal)} ${esc(h.ville)}</p>
        ${h.dist !== null ? `<p class="pop-dist">${esc(fmtDist(h.dist))}</p>` : ""}
        <div class="pop-actions">
          <a class="pop-btn pop-btn--ghost" href="${esc(itineraryUrl(h))}" target="_blank" rel="noopener">Voir l'itinéraire</a>
          ${book ? `<a class="pop-btn" href="${esc(book)}" target="_blank" rel="noopener">Réserver</a>` : ""}
        </div>
      </div>`;
  }

  function drawMarkers() {
    if (!map || !layer) return;
    layer.clearLayers();
    markers.clear();
    visible().forEach((h) => {
      if (!h.pos) return;
      const m = L.marker(h.pos, { icon: hotelIcon(h.id === activeId), title: h.nom, keyboard: true });
      m.bindPopup(popupHtml(h), { maxWidth: 290, minWidth: 220, className: "mo-popup", autoPanPadding: [30, 30] });
      m.on("click", () => select(h.id, { fromMarker: true }));
      m.on("popupclose", () => { if (activeId === h.id) select(null); });
      m.addTo(layer);
      markers.set(h.id, m);
    });
  }

  function fit() {
    if (!map) return;
    const pts = [];
    if (domaine.pos) pts.push(domaine.pos);
    visible().forEach((h) => h.pos && pts.push(h.pos));
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 });
    else if (pts.length === 1) map.setView(pts[0], 14);
  }

  function select(id, opts = {}) {
    const prev = activeId;
    activeId = id;
    items.forEach((h) => h.li.classList.toggle("is-active", h.id === id));
    if (map) {
      [prev, id].forEach((k) => {
        const m = k && markers.get(k);
        if (m) m.setIcon(hotelIcon(k === id));
      });
    }
    if (!id) return;
    const h = byId.get(id);
    if (opts.fromMarker) {
      h.li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (map && h.pos && markers.get(id)) {
      if (opts.scrollMap) mapEl.scrollIntoView({ block: "center", behavior: "smooth" });
      map.setView(h.pos, Math.max(map.getZoom(), 15), { animate: true });
      markers.get(id).openPopup();
    }
  }

  /* ---------- Géocodage (Base Adresse Nationale, service public gratuit) ---------- */
  function readCache() {
    try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function writeCache(c) {
    try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c)); } catch (e) {}
  }
  async function geocode(h, cache) {
    const key = `${h.adresse}|${h.codePostal}|${h.ville}`;
    if (cache[key]) return cache[key];
    const url =
      "https://api-adresse.data.gouv.fr/search/?limit=1&postcode=" + encodeURIComponent(h.codePostal) +
      "&q=" + encodeURIComponent(`${h.adresse} ${h.ville}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error("geocode " + res.status);
    const json = await res.json();
    const f = json.features && json.features[0];
    if (!f || !f.properties || f.properties.postcode !== h.codePostal) return null;
    const [lng, lat] = f.geometry.coordinates;
    cache[key] = [lat, lng];
    return cache[key];
  }

  async function locateAll() {
    const cache = readCache();
    const targets = [domaine].concat(items.filter((h) => !h.pos));
    await Promise.all(
      targets.map(async (h) => {
        if (h.pos) return;
        try { h.pos = await geocode(h, cache); } catch (e) { h.pos = null; }
      })
    );
    writeCache(cache);

    if (domaine.pos) {
      if (domaineMarker) domaineMarker.remove();
      if (map) {
        domaineMarker = L.marker(domaine.pos, { icon: domaineIcon(), title: domaine.nom, zIndexOffset: 1000, keyboard: false });
        domaineMarker.bindTooltip(domaine.nom, { direction: "top", offset: [0, -26], className: "mo-tip" });
        domaineMarker.addTo(map);
      }
      items.forEach((h) => { h.dist = h.pos ? km(domaine.pos, h.pos) : null; });
    }

    // Tri par distance au domaine (ceux sans position à la fin) + affichage des distances
    const sorted = items.slice().sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
    sorted.forEach((h) => {
      listEl.appendChild(h.li);
      const d = h.li.querySelector(".stay-dist");
      if (h.dist !== null) { d.textContent = fmtDist(h.dist); d.hidden = false; }
    });
    applyFilter();
  }

  /* ---------- Initialisation (paresseuse : quand la rubrique devient visible) ---------- */
  let started = false;
  function start() {
    if (started) return;
    started = true;

    if (!window.L) {
      mapEl.classList.add("is-failed");
      mapEl.innerHTML = '<p class="stay-fail">La carte n\'a pas pu se charger. Retrouvez tous les hébergements dans la liste ci-dessous.</p>';
      if (hintEl) hintEl.hidden = true;
      locateAll();
      return;
    }

    const touch = !!(L.Browser && L.Browser.mobile);
    map = L.map(mapEl, {
      center: [47.8706713, 1.8826509], // vue de départ sur Olivet, ajustée ensuite automatiquement
      zoom: 14,
      scrollWheelZoom: false,
      dragging: !touch,   // sur téléphone : 2 doigts pour déplacer, la page reste faisable à faire défiler
      tap: false,
      zoomControl: true,
      attributionControl: true
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Contributeurs OpenStreetMap</a>'
    }).addTo(map);
    L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);
    layer = L.layerGroup().addTo(map);

    // Molette : activée seulement après un clic dans la carte, pour ne pas bloquer le défilement de la page
    map.on("click", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());

    if (hintEl) {
      hintEl.textContent = touch
        ? "Déplacez la carte avec deux doigts, pincez pour zoomer."
        : "Cliquez dans la carte pour zoomer à la molette.";
    }

    setTimeout(() => map.invalidateSize(), 150);
    drawMarkers();
    locateAll();
  }

  applyFilter(); // la liste fonctionne même sans carte
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); } },
      { rootMargin: "300px" }
    );
    io.observe(mapEl);
  } else {
    start();
  }
})();
