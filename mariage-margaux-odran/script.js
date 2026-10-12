/* ==========================================================
   Margaux & Odran — 18 septembre 2027
   Navigation, compte à rebours, lien actif, formulaire RSVP
   ========================================================== */

/* ---------- Réglages ----------
   RSVP_ENDPOINT : adresse qui reçoit les réponses des invités. Deux options :
   - Google Sheets (recommandé, gratuit et sans limite) : collez l'adresse du
     « web app » Google Apps Script (elle finit par /exec).
   - Formspree : collez l'adresse du formulaire (ex : "https://formspree.io/f/abcdwxyz").
   Tant que c'est vide, le formulaire reste grisé avec le message « pas encore ouvert ».

   WEDDING_DATE : date et heure du mariage (heure de Paris, +02:00 en septembre).
   Quand vous connaîtrez l'horaire de la cérémonie, remplacez 00:00:00 (ex : 15:00:00). */
const RSVP_ENDPOINT = "";
const WEDDING_DATE = "2027-09-18T00:00:00+02:00";

const $ = (id) => document.getElementById(id);

/* ---------- Navigation ---------- */
const nav = $("nav");
const burger = $("burger");
const menu = $("menu");

function onScroll() {
  nav.classList.toggle("solid", window.scrollY > 40);
}
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

function closeMenu() {
  menu.classList.remove("open");
  burger.setAttribute("aria-expanded", "false");
}

burger.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});

menu.addEventListener("click", (e) => {
  if (e.target.closest("a")) closeMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

/* ---------- Lien actif dans le menu ---------- */
const links = [...menu.querySelectorAll('a[href^="#"]:not(.cta)')];
const sections = links
  .map((a) => document.querySelector(a.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window) {
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) =>
          a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + entry.target.id)
        );
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => spy.observe(s));
}

/* ---------- Compte à rebours ---------- */
const target = new Date(WEDDING_DATE).getTime();
let timer;

function tick() {
  const diff = target - Date.now();

  if (diff <= 0) {
    clearInterval(timer);
    const clock = $("clock");
    if (clock) {
      clock.outerHTML =
        '<p class="count-done">C\'est le grand jour. Merci d\'être là.</p>';
    }
    return;
  }

  const s = Math.floor(diff / 1000);
  $("d").textContent = Math.floor(s / 86400);
  $("h").textContent = Math.floor((s % 86400) / 3600);
  $("m").textContent = Math.floor((s % 3600) / 60);
  $("s").textContent = s % 60;
}

timer = setInterval(tick, 1000);
tick();

/* ---------- Formulaire RSVP ---------- */
const form = $("rsvp-form");
const fields = $("rsvp-fields");
const status = $("status");
const send = $("send");

function say(message, type) {
  status.textContent = message;
  status.className = "status" + (type ? " " + type : "");
}

if (!RSVP_ENDPOINT) {
  fields.disabled = true;
  $("notice").hidden = false;
}

/* Affiche ou masque une question (et la retire de l'envoi quand elle est masquée) */
function toggle(el, show) {
  el.hidden = !show;
  el.querySelectorAll("input").forEach((i) => (i.disabled = !show));
}

/* Les questions « accompagné(e) » et « enfants » n'apparaissent que si la personne vient */
function refresh() {
  const present = form.presence.value === "Oui";
  toggle($("row-accompagne"), present);
  toggle($("row-enfants"), present);
  toggle($("acc-detail"), present && form.accompagne.value === "Oui");
  toggle($("kids-detail"), present && form.enfants.value === "Oui");
}
form.addEventListener("change", refresh);
form.addEventListener("reset", () => setTimeout(refresh));
refresh();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!RSVP_ENDPOINT) return;

  if (!form.nom.value.trim()) {
    say("Indiquez votre prénom et votre nom.", "err");
    form.nom.focus();
    return;
  }
  if (!form.presence.value) {
    say("Choisissez si vous serez présent(e) ou non.", "err");
    return;
  }
  if (form.presence.value === "Oui") {
    if (form.accompagne.value === "Oui" && !form.nom_accompagnant.value.trim()) {
      say("Indiquez le nom de la personne qui vous accompagne.", "err");
      form.nom_accompagnant.focus();
      return;
    }
    if (form.enfants.value === "Oui" && !(parseInt(form.nombre_enfants.value, 10) >= 1)) {
      say("Indiquez le nombre d'enfants.", "err");
      form.nombre_enfants.focus();
      return;
    }
  }

  send.disabled = true;
  say("Envoi en cours…");

  try {
    const data = new FormData(form);
    const isGoogle = /script\.google\.com/.test(RSVP_ENDPOINT);

    if (isGoogle) {
      /* Google Apps Script : la réponse n'est pas lisible depuis le site (mode no-cors),
         une absence d'erreur signifie que l'envoi est parti. */
      await fetch(RSVP_ENDPOINT, { method: "POST", mode: "no-cors", body: new URLSearchParams(data) });
    } else {
      const res = await fetch(RSVP_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
    }

    form.reset();
    say("Merci, votre réponse est bien enregistrée.", "ok");
  } catch (err) {
    say("Votre réponse n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.", "err");
  } finally {
    send.disabled = false;
  }
});
