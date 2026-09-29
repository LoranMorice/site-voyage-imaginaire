/* ==========================================================================
   VOYAGE EN IMAGINAIRE — Laurent GANNE
   Logique du site : portail, menu, visionneuse, export, papier peint.
   Aucune dépendance externe.
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   0. RÉGLAGES — c'est ici qu'on ajuste le comportement
   -------------------------------------------------------------------------- */

const CONFIG = {
  /** Nom du dossier racine à placer sur le Bureau. */
  ROOT_FOLDER: "Voyage-en-Imaginaire",

  /**
   * Tolérance, en minutes, pour le mot de passe horaire des onglets
   * Perso et Réserves. 3 signifie : les 3 minutes avant et après sont
   * acceptées, sinon il serait quasi impossible de le saisir à temps.
   */
  MINUTE_TOLERANCE: 3,

  /** Durée d'affichage d'une image en diaporama, en secondes. */
  SLIDESHOW_SECONDS: 8,

  /** Fichier de légendes facultatif, placé dans chaque dossier. */
  CAPTIONS_FILE: "legendes.txt",
};

/** Les cinq onglets, dans l'ordre du menu. */
const CATS = {
  photo:    { label: "Photo",    num: "1", dir: "1-Photo",    kind: "image", locked: false },
  graphi:   { label: "Graphi",   num: "2", dir: "2-Graphi",   kind: "image", locked: false },
  audio:    { label: "Audio",    num: "3", dir: "3-Audio",    kind: "audio", locked: false },
  perso:    { label: "Perso",    num: "4", dir: "4-Perso",    kind: "mixed", locked: true  },
  reserves: { label: "Réserves", num: "5", dir: "5-Reserves", kind: "mixed", locked: true  },
};

const EXT_IMAGE = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "heic", "heif", "tif", "tiff"];
const EXT_AUDIO = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "opus", "aiff", "aif", "wma"];

/** Un fichier a-t-il sa place dans cet onglet ? */
function fitsCat(name, cat) {
  if (name === CONFIG.CAPTIONS_FILE) return false;      // fichier de légendes
  const kind = CATS[cat].kind;
  if (kind === "image") return isImage(name);
  if (kind === "audio") return isAudio(name);
  return isImage(name) || isAudio(name);                // Perso et Réserves
}

/* --------------------------------------------------------------------------
   1. PETITS UTILITAIRES
   -------------------------------------------------------------------------- */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const pad = (n) => String(n).padStart(2, "0");

/** Code du jour : JJMMAAAA */
function dayCode(d = new Date()) {
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear();
}

/** Variante tolérée : JJMMAA (année sur deux chiffres). */
function dayCodeShort(d = new Date()) {
  return pad(d.getDate()) + pad(d.getMonth() + 1) + pad(d.getFullYear() % 100);
}

/** Code du jour + heure : JJMMAAAAHH:MM */
function minuteCode(d = new Date()) {
  return dayCode(d) + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

/** Compare une saisie au code horaire, avec tolérance. Les « : » sont optionnels. */
function isMinuteCodeValid(raw) {
  const clean = String(raw).trim().replace(/[^0-9]/g, "");
  const now = Date.now();
  const tol = CONFIG.MINUTE_TOLERANCE;
  for (let i = -tol; i <= tol; i++) {
    const expected = minuteCode(new Date(now + i * 60000)).replace(":", "");
    if (clean === expected) return true;
  }
  return false;
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

const isImage = (name) => EXT_IMAGE.includes(extOf(name));
const isAudio = (name) => EXT_AUDIO.includes(extOf(name));

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;          // force le navigateur à rejouer l'animation
  el.classList.add("shake");
}

let toastTimer = null;
function toast(message, ms = 2600) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* --------------------------------------------------------------------------
   2. MÉMOIRE LOCALE (IndexedDB) — dossier relié + papier peint
   -------------------------------------------------------------------------- */

const DB_NAME = "vei-store";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* stockage indisponible : on continue sans mémoire */ }
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readonly");
      const r = tx.objectStore("kv").get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch { return undefined; }
}

/* --------------------------------------------------------------------------
   3. ÉTAT DE L'APPLICATION
   -------------------------------------------------------------------------- */

const state = {
  rootHandle: null,                 // dossier du Bureau (mode complet)
  // "none"  : rien de chargé
  // "web"   : site publié, médias lus dans catalogue.json (mode du public)
  // "fs"    : dossier du Bureau relié, lecture + écriture (mode atelier)
  // "flat"  : dossier sélectionné, lecture seule (Safari, Firefox)
  mode: "none",
  catalog: {},                      // { photo: [item], graphi: [...], ... }
  index: {},                        // position courante dans chaque onglet
  current: "accueil",               // onglet affiché
  opened: new Set(),                // onglets protégés déverrouillés pour la session
  pendingCat: null,                 // onglet en attente de mot de passe
  objectUrls: [],                   // URLs temporaires à libérer
  captions: {},                     // légendes lues dans legendes.txt
  show: { on: false, cat: null, timer: null },   // diaporama automatique
};

Object.keys(CATS).forEach((k) => {
  state.catalog[k] = [];
  state.index[k] = 0;
  state.captions[k] = new Map();
});

function releaseUrls() {
  state.objectUrls.forEach(URL.revokeObjectURL);
  state.objectUrls = [];
}

function trackUrl(url) {
  state.objectUrls.push(url);
  return url;
}

/**
 * Adresse d'affichage d'un média, quel que soit le mode :
 * - site publié  → l'URL du fichier dans medias/
 * - mode atelier → une URL temporaire créée depuis le fichier du disque
 */
async function mediaUrl(item) {
  if (item.url) return item.url;
  const file = await item.getFile();
  return trackUrl(URL.createObjectURL(file));
}

/** Contenu binaire d'un média (utilisé pour le papier peint). */
async function mediaBlob(item) {
  if (item.url) return await (await fetch(item.url)).blob();
  return await item.getFile();
}

/* --------------------------------------------------------------------------
   4. PORTAIL D'ENTRÉE — mot de passe : date du jour, aucun indice affiché
   -------------------------------------------------------------------------- */

function initGate() {
  const form  = $("#gateForm");
  const input = $("#gateInput");
  const error = $("#gateError");

  input.focus();

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // On ne garde que les chiffres : les écritures 25/09/2026 ou 25 09 2026
    // sont donc acceptées telles quelles.
    const clean = input.value.trim().replace(/[^0-9]/g, "");

    if (clean === dayCode() || clean === dayCodeShort()) {
      error.hidden = true;
      enterSite();
      return;
    }

    // Refus volontairement laconique : aucune information sur le format
    // attendu ni sur la longueur de la saisie.
    error.textContent = "Mot de passe incorrect.";
    error.hidden = false;
    shake($(".keyframe"));
    input.value = "";
    input.focus();
  });
}

function enterSite() {
  const gate = $("#gate");
  gate.style.transition = "opacity .6s ease";
  gate.style.opacity = "0";

  setTimeout(() => {
    gate.remove();
    document.documentElement.removeAttribute("data-locked");
    $("#app").hidden = false;
    initApp();
  }, 600);
}

/* --------------------------------------------------------------------------
   5. LIAISON AVEC LE DOSSIER DU BUREAU
   -------------------------------------------------------------------------- */

const supportsFS = typeof window.showDirectoryPicker === "function";

async function connectFolder() {
  if (!supportsFS) {
    // Navigateur sans File System Access API (Safari, Firefox) :
    // on passe par une sélection de dossier classique, en lecture seule.
    $("#fallbackInput").click();
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ id: "vei-root", mode: "readwrite" });

    // VÉRIFICATION : le dossier choisi doit être la racine, celle qui
    // contient 1-Photo, 2-Graphi, etc. Sans ce contrôle, sélectionner un
    // sous-dossier par erreur y ferait créer cinq dossiers fantômes.
    if (!(await isRootFolder(handle))) {
      toast(
        "Ce n'est pas le bon dossier. Choisissez « " + CONFIG.ROOT_FOLDER +
        " », celui qui contient 1-Photo, 2-Graphi, 3-Audio…",
        6000
      );
      return;
    }

    state.rootHandle = handle;
    state.mode = "fs";
    await idbSet("rootHandle", handle);
    await scanAll();
    toast("Dossier relié : " + handle.name);
  } catch (err) {
    if (err && err.name !== "AbortError") toast("Liaison annulée.");
  }
}

/**
 * Le dossier donné est-il bien la racine de la base ?
 * On l'admet dès qu'au moins un des cinq sous-dossiers attendus s'y trouve.
 */
async function isRootFolder(handle) {
  for (const key of Object.keys(CATS)) {
    try {
      await handle.getDirectoryHandle(CATS[key].dir);
      return true;
    } catch { /* ce sous-dossier manque, on essaie le suivant */ }
  }
  return false;
}

/** Tente de retrouver le dossier relié lors d'une visite précédente. */
async function restoreFolder() {
  if (!supportsFS) return false;
  const handle = await idbGet("rootHandle");
  if (!handle) return false;

  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") return false;     // il faudra recliquer sur « Relier »

  // Le dossier mémorisé lors d'une visite précédente peut être le mauvais.
  // On le vérifie plutôt que de l'utiliser aveuglément, et on l'oublie
  // s'il ne contient aucun des cinq sous-dossiers attendus.
  if (!(await isRootFolder(handle))) {
    await idbSet("rootHandle", null);
    return false;
  }

  state.rootHandle = handle;
  state.mode = "fs";
  await scanAll();
  return true;
}

/* --------------------------------------------------------------------------
   5 bis. SITE PUBLIÉ — lecture du catalogue.json
   -------------------------------------------------------------------------- */

/**
 * Charge « catalogue.json », produit par l'outil publier.command.
 * C'est ce que voient les visiteurs du site en ligne : seuls les onglets
 * Photo, Graphi et Audio y figurent. Perso et Réserves ne sont jamais
 * exportés et restent donc invisibles.
 */
async function loadPublished() {
  try {
    const res = await fetch("catalogue.json", { cache: "no-store" });
    if (!res.ok) return false;

    const data = await res.json();
    const tabs = data.onglets || {};
    let total = 0;

    for (const key of Object.keys(CATS)) {
      const list = Array.isArray(tabs[key]) ? tabs[key] : [];
      state.catalog[key] = list.map((entry) => ({
        name: entry.nom,
        cat: key,
        // Chaque segment est encodé séparément : un nom contenant un
        // espace, un accent ou un « # » reste ainsi une adresse valide.
        url: String(entry.fichier).split("/").map(encodeURIComponent).join("/"),
      }));
      // Les légendes voyagent avec le catalogue.
      state.captions[key] = new Map(
        list.filter((e) => e.legende).map((e) => [String(e.nom).toLowerCase(), e.legende])
      );
      total += list.length;
    }

    if (!total) return false;

    state.mode = "web";
    sortCatalog();
    refreshCounts();
    applyModeUI();
    renderCurrent();
    return true;

  } catch {
    return false;                       // pas de catalogue : mode atelier
  }
}

/**
 * Adapte l'interface au mode courant.
 * En mode publié, les onglets protégés et l'outil de liaison disparaissent :
 * il n'y a rien à y montrer et rien à y écrire.
 */
function applyModeUI() {
  const web = state.mode === "web";

  $$(".tab").forEach((tab) => {
    const cat = tab.dataset.go;
    if (cat && CATS[cat] && CATS[cat].locked) tab.hidden = web;
  });

  $("#connectBtn").hidden = web && !supportsFS;
  $("#connectLabel").textContent = web ? "Mode atelier" : "Relier mon dossier";

  // Le menu d'export n'a de sens que dans un onglet protégé, et seulement
  // quand le dossier du Bureau est relié en lecture-écriture.
  $$("[data-export]").forEach((el) => {
    const cat = el.closest(".view")?.dataset.cat;
    el.hidden = !(state.mode === "fs" && cat && CATS[cat].locked);
  });
}

/** Mode lecture seule : on lit les fichiers d'un dossier sélectionné. */
function initFallbackInput() {
  $("#fallbackInput").addEventListener("change", (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    Object.keys(CATS).forEach((k) => { state.catalog[k] = []; });

    files.forEach((file) => {
      if (file.name.startsWith(".")) return;
      const parts = (file.webkitRelativePath || file.name).split("/");

      // Le fichier doit se trouver DIRECTEMENT dans un des cinq dossiers.
      // Un sous-dossier (originaux-HEIC, par exemple) est donc ignoré,
      // exactement comme en mode atelier.
      const parent = parts[parts.length - 2];
      const key = Object.keys(CATS).find((k) => CATS[k].dir === parent);
      if (!key) return;

      // Fichier de légendes : on le lit au lieu de l'afficher.
      if (file.name === CONFIG.CAPTIONS_FILE) {
        file.text().then((txt) => {
          state.captions[key] = parseCaptions(txt);
          if (state.current === key) renderView(key);
        });
        return;
      }

      if (!fitsCat(file.name, key)) return;

      state.catalog[key].push({
        name: file.name,
        cat: key,
        file,
        getFile: async () => file,
      });
    });

    sortCatalog();
    state.mode = "flat";
    refreshCounts();
    setConnected(true, "Dossier lu (lecture seule)");
    applyModeUI();
    renderCurrent();
    toast("Fichiers chargés — export indisponible dans ce navigateur.");
  });
}

/** Parcourt les 5 sous-dossiers et construit le catalogue. */
async function scanAll() {
  if (!state.rootHandle) return;

  for (const key of Object.keys(CATS)) {
    state.catalog[key] = [];
    try {
      // create: false — le site ne doit jamais fabriquer de dossier.
      const dir = await state.rootHandle.getDirectoryHandle(CATS[key].dir);
      for await (const entry of dir.values()) {
        if (entry.kind !== "file" || entry.name.startsWith(".")) continue;
        if (!fitsCat(entry.name, key)) continue;
        state.catalog[key].push({
          name: entry.name,
          cat: key,
          handle: entry,
          dirHandle: dir,
          getFile: () => entry.getFile(),
        });
      }
      await loadCaptions(key, dir);
    } catch {
      // sous-dossier illisible : on l'ignore silencieusement
    }
  }

  sortCatalog();
  refreshCounts();
  setConnected(true, state.rootHandle.name);
  applyModeUI();
  renderCurrent();
}

/** Relit un seul sous-dossier (rafraîchissement rapide à l'ouverture d'un onglet). */
async function scanCat(cat) {
  if (state.mode !== "fs" || !state.rootHandle) return;

  const fresh = [];
  try {
    const dir = await state.rootHandle.getDirectoryHandle(CATS[cat].dir);
    for await (const entry of dir.values()) {
      if (entry.kind !== "file" || entry.name.startsWith(".")) continue;
      if (!fitsCat(entry.name, cat)) continue;
      fresh.push({
        name: entry.name,
        cat,
        handle: entry,
        dirHandle: dir,
        getFile: () => entry.getFile(),
      });
    }
    await loadCaptions(cat, dir);
  } catch { return; }

  fresh.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));

  // Rien de nouveau : on évite de recharger l'affichage pour rien.
  const before = state.catalog[cat].map((x) => x.name).join("|");
  const after  = fresh.map((x) => x.name).join("|");

  state.catalog[cat] = fresh;
  if (state.index[cat] >= fresh.length) state.index[cat] = 0;
  refreshCounts();

  return before !== after;
}

/* --------------------------------------------------------------------------
   5 bis. LÉGENDES
   -------------------------------------------------------------------------- */

/**
 * Lit le fichier « legendes.txt » du dossier, s'il existe.
 * Une ligne par média, sous la forme :
 *     mon-image.jpg | Le texte de la légende
 * Les lignes vides et celles commençant par # sont ignorées.
 */
async function loadCaptions(cat, dirHandle) {
  try {
    const fh = await dirHandle.getFileHandle(CONFIG.CAPTIONS_FILE);
    const txt = await (await fh.getFile()).text();
    state.captions[cat] = parseCaptions(txt);
  } catch {
    state.captions[cat] = new Map();   // pas de fichier : légendes automatiques
  }
}

function parseCaptions(txt) {
  const map = new Map();
  txt.split(/\r?\n/).forEach((line) => {
    const row = line.trim();
    if (!row || row.startsWith("#")) return;
    // On accepte indifféremment  nom.jpg = légende  ou  nom.jpg | légende
    const cand = [row.indexOf("="), row.indexOf("|")].filter((i) => i > 0);
    if (!cand.length) return;
    const sep = Math.min(...cand);
    const file = row.slice(0, sep).trim().toLowerCase();
    const text = row.slice(sep + 1).trim();
    if (file && text) map.set(file, text);
  });
  return map;
}

/**
 * Légende d'un média : celle du fichier legendes.txt si elle existe,
 * sinon le nom du fichier rendu lisible (tirets et soulignés → espaces).
 */
function captionOf(item) {
  // Mode public : la légende est déjà dans le catalogue.
  if (item.caption) return item.caption;

  const custom = state.captions[item.cat]?.get(item.name.toLowerCase());
  if (custom) return custom;

  return item.name
    .replace(/\.[^.]+$/, "")          // retire l'extension
    .replace(/[-_]+/g, " ")           // tirets et soulignés → espaces
    .replace(/\s+/g, " ")
    .trim();
}

/* --------------------------------------------------------------------------
   5 ter. DIAPORAMA AUTOMATIQUE
   -------------------------------------------------------------------------- */

function stopShow(silent) {
  clearTimeout(state.show.timer);
  state.show = { on: false, cat: null, timer: null };
  $$("[data-timebar]").forEach((b) => { b.hidden = true; });
  $$(".chip--play").forEach((c) => {
    c.classList.remove("is-on");
    $(".chip__icon", c).textContent = "▶";
    $("[data-play-label]", c).textContent = "Diaporama";
  });
  if (!silent) toast("Diaporama arrêté.");
}

function startShow(cat) {
  if (state.catalog[cat].length < 2) {
    toast("Il faut au moins deux fichiers pour un diaporama.");
    return;
  }

  state.show.on = true;
  state.show.cat = cat;

  const view = $("#view-" + cat);
  const chip = $(".chip--play", view);
  chip.classList.add("is-on");
  $(".chip__icon", chip).textContent = "❚❚";
  $("[data-play-label]", chip).textContent = "En cours";

  toast("Diaporama lancé — une vue toutes les " + CONFIG.SLIDESHOW_SECONDS + " secondes.");
  scheduleNext(cat);
}

function toggleShow(cat) {
  if (state.show.on && state.show.cat === cat) stopShow();
  else { stopShow(true); startShow(cat); }
}

/**
 * Programme le passage au média suivant.
 * Pour un son, on attend la fin du morceau plutôt que la minuterie.
 */
function scheduleNext(cat) {
  clearTimeout(state.show.timer);
  if (!state.show.on || state.show.cat !== cat) return;

  const item = state.catalog[cat][state.index[cat]];
  const view = $("#view-" + cat);
  const bar  = $("[data-timebar]", view);
  const fill = $("[data-timebar-fill]", view);

  // Un audio enchaîne tout seul à la fin de la lecture (voir renderView).
  if (item && isAudio(item.name)) {
    bar.hidden = true;
    return;
  }

  // Barre de progression : on relance l'animation depuis zéro.
  bar.hidden = false;
  fill.style.animation = "none";
  void fill.offsetWidth;
  fill.style.animation = "timebar " + CONFIG.SLIDESHOW_SECONDS + "s linear forwards";

  state.show.timer = setTimeout(() => {
    if (state.show.on && state.show.cat === cat) step(cat, +1);
  }, CONFIG.SLIDESHOW_SECONDS * 1000);
}

function sortCatalog() {
  Object.keys(state.catalog).forEach((k) => {
    state.catalog[k].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
    if (state.index[k] >= state.catalog[k].length) state.index[k] = 0;
  });
}

function setConnected(on, label) {
  $("#connectDot").classList.toggle("is-on", !!on);
  $("#connectLabel").textContent = on ? label : "Relier mon dossier";
}

function refreshCounts() {
  $$("[data-count]").forEach((el) => {
    const n = state.catalog[el.dataset.count].length;
    el.textContent = n ? n : "";
  });
}

/* --------------------------------------------------------------------------
   6. NAVIGATION ENTRE ONGLETS
   -------------------------------------------------------------------------- */

function go(target) {
  // Onglet protégé encore verrouillé → on demande le mot de passe horaire.
  if (CATS[target] && CATS[target].locked && !state.opened.has(target)) {
    askMinutePassword(target);
    return;
  }

  // Changer d'onglet interrompt le diaporama en cours.
  if (state.show.on && state.show.cat !== target) stopShow(true);

  state.current = target;

  $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === "view-" + target));
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.go === target));

  if (CATS[target]) {
    applyModeUI();
    renderView(target);
    // On relit le dossier en arrière-plan : les fichiers ajoutés depuis
    // le Finder apparaissent sans avoir à recharger la page.
    scanCat(target).then((changed) => {
      if (changed && state.current === target) renderView(target);
    });
    setTimeout(() => $("[data-viewer]", $("#view-" + target))?.focus(), 60);
  }
}

function renderCurrent() {
  if (CATS[state.current]) renderView(state.current);
}

/* --------------------------------------------------------------------------
   7. MOT DE PASSE HORAIRE (JJMMAAAAHH:MM — format NON visible)
   -------------------------------------------------------------------------- */

function askMinutePassword(cat) {
  state.pendingCat = cat;
  $("#lockSub").textContent = CATS[cat].num + " · " + CATS[cat].label;
  $("#lockError").hidden = true;
  $("#lockInput").value = "";
  $("#lockModal").hidden = false;
  setTimeout(() => $("#lockInput").focus(), 50);
}

function closeMinuteModal() {
  $("#lockModal").hidden = true;
  state.pendingCat = null;
}

function initLockModal() {
  $("#lockCancel").addEventListener("click", closeMinuteModal);

  $("#lockModal").addEventListener("click", (e) => {
    if (e.target.id === "lockModal") closeMinuteModal();
  });

  $("#lockForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const cat = state.pendingCat;
    if (!cat) return;

    if (isMinuteCodeValid($("#lockInput").value)) {
      state.opened.add(cat);
      $$(".tab").find((t) => t.dataset.go === cat)?.classList.add("is-open");
      closeMinuteModal();
      go(cat);
    } else {
      $("#lockError").hidden = false;
      shake($(".modal__box"));
      $("#lockInput").value = "";
      $("#lockInput").focus();
    }
  });
}

/* --------------------------------------------------------------------------
   8. CONSTRUCTION D'UN ONGLET
   -------------------------------------------------------------------------- */

function buildView(cat) {
  const view = $("#view-" + cat);
  if (view.dataset.built) return view;

  view.appendChild($("#tplView").content.cloneNode(true));
  view.dataset.built = "1";

  $(".view__title", view).textContent = CATS[cat].num + " · " + CATS[cat].label;

  // Le menu « Exporter vers » n'existe que dans Perso et Réserves.
  if (CATS[cat].locked) $("[data-export]", view).hidden = false;

  // ---- Interactions de l'onglet ----
  view.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act], [data-go], [data-export-to]");
    if (!btn) return;

    if (btn.dataset.go)  { go(btn.dataset.go); return; }

    switch (btn.dataset.act) {
      case "prev": step(cat, -1); break;
      case "next": step(cat, +1); break;
      case "play": toggleShow(cat); break;
      case "wall": await setWallpaperFromCurrent(cat); break;
      case "export-open": $(".export", view).classList.toggle("is-open"); break;
    }

    if (btn.dataset.exportTo) {
      $(".export", view).classList.remove("is-open");
      await exportCurrent(cat, btn.dataset.exportTo);
    }
  });

  // Défilement au clavier quand la visionneuse a le focus.
  $("[data-viewer]", view).addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(cat, +1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); step(cat, -1); }
  });

  return view;
}

async function renderView(cat) {
  const view  = buildView(cat);
  const items = state.catalog[cat];
  const meta  = $(".view__meta", view);
  const empty = $("[data-empty]", view);
  const media = $("[data-media]", view);
  const bar   = $("[data-bar]", view);

  releaseUrls();

  // ---- Aucun fichier ----
  if (!items.length) {
    empty.hidden = false;
    media.hidden = true;
    bar.hidden = true;
    $("[data-act='prev']", view).hidden = true;
    $("[data-act='next']", view).hidden = true;
    $("[data-act='wall']", view).hidden = true;
    $("[data-act='play']", view).hidden = true;
    $("[data-timebar]", view).hidden = true;
    meta.textContent = state.mode === "none" ? "Dossier non relié" : "Aucun fichier";

    $(".viewer__empty-text", view).innerHTML =
      state.mode === "none"
        ? "Cliquez sur <strong>Relier mon dossier</strong> en bas à gauche, puis choisissez " +
          "<code>" + CONFIG.ROOT_FOLDER + "</code> sur votre Bureau."
        : "Déposez vos fichiers dans <code>" + CONFIG.ROOT_FOLDER + "/" + CATS[cat].dir + "</code> " +
          "sur le Bureau, puis recliquez sur l'onglet pour rafraîchir.";
    return;
  }

  // ---- Affichage du média courant ----
  empty.hidden = true;
  media.hidden = false;
  bar.hidden = false;

  const multi = items.length > 1;
  $("[data-act='prev']", view).hidden = !multi;
  $("[data-act='next']", view).hidden = !multi;
  $("[data-act='play']", view).hidden = !multi;

  const i    = state.index[cat];
  const item = items[i];

  meta.textContent = items.length + (items.length > 1 ? " éléments" : " élément");
  $("[data-name]", view).textContent = item.name;
  $("[data-counter]", view).textContent = (i + 1) + " / " + items.length;

  // Le papier peint n'a de sens que pour une image.
  $("[data-act='wall']", view).hidden = !isImage(item.name);

  media.innerHTML = "";

  try {
    const url = await mediaUrl(item);

    if (isImage(item.name)) {
      // <figure> : l'image, puis sa légende juste en dessous.
      const fig = document.createElement("figure");
      fig.className = "shot";

      const img = document.createElement("img");
      img.src = url;
      img.alt = captionOf(item);

      // Un HEIC/HEIF n'est affichable par aucun navigateur : on l'explique
      // plutôt que de laisser une image cassée.
      img.addEventListener("error", () => {
        const ext = extOf(item.name).toUpperCase();
        fig.innerHTML =
          '<div class="viewer__empty">' +
          '<p class="viewer__empty-title">Image non affichable</p>' +
          '<p class="viewer__empty-text"><code>' + item.name + "</code><br />" +
          (ext === "HEIC" || ext === "HEIF"
            ? "Le format HEIC n'est lu par aucun navigateur. Convertissez ce " +
              "fichier en JPEG pour le voir ici."
            : "Format " + ext + " refusé par le navigateur.") +
          "</p></div>";
      });

      fig.appendChild(img);

      const cap = document.createElement("figcaption");
      cap.className = "shot__caption";
      cap.textContent = captionOf(item);
      fig.appendChild(cap);

      media.appendChild(fig);

    } else if (isAudio(item.name)) {
      const card = document.createElement("div");
      card.className = "audio-card";
      card.innerHTML =
        '<div class="audio-card__disc"></div>' +
        '<h3 class="audio-card__title"></h3>' +
        '<audio controls preload="metadata"></audio>';
      $(".audio-card__title", card).textContent = captionOf(item);
      const audio = $("audio", card);
      audio.src = url;

      // En diaporama, la piste suivante s'enchaîne à la fin du morceau
      // (plutôt qu'après un délai fixe, qui couperait la musique).
      audio.addEventListener("ended", () => {
        if (state.show.on && state.show.cat === cat) step(cat, +1);
      });
      if (state.show.on && state.show.cat === cat) audio.play().catch(() => {});

      media.appendChild(card);

    } else {
      const box = document.createElement("div");
      box.className = "viewer__empty";
      box.innerHTML =
        '<p class="viewer__empty-title">Aperçu indisponible</p>' +
        '<p class="viewer__empty-text">Format non affichable : <code>' + item.name + "</code></p>";
      media.appendChild(box);
    }
  } catch {
    media.innerHTML = '<p class="viewer__empty-text">Fichier illisible : ' + item.name + "</p>";
  }

  // Relance la minuterie du diaporama pour ce nouveau média.
  if (state.show.on && state.show.cat === cat) scheduleNext(cat);
}

/** Avance ou recule dans l'onglet (défilement circulaire). */
function step(cat, delta) {
  const n = state.catalog[cat].length;
  if (n < 2) return;
  state.index[cat] = (state.index[cat] + delta + n) % n;
  renderView(cat);
}

/* --------------------------------------------------------------------------
   9. EXPORT : Perso / Réserves  →  Photo / Graphi / Audio
   -------------------------------------------------------------------------- */

async function exportCurrent(fromCat, toCat) {
  const items = state.catalog[fromCat];
  const item  = items[state.index[fromCat]];

  if (!item) { toast("Aucun fichier à exporter."); return; }

  if (state.mode !== "fs") {
    toast("Export possible uniquement avec Chrome ou Edge, dossier relié.");
    return;
  }

  // Cohérence : une image ne va pas dans Audio, et inversement.
  if (toCat === "audio" && !isAudio(item.name)) {
    toast("Ce fichier n'est pas un audio.");
    return;
  }
  if (toCat !== "audio" && !isImage(item.name)) {
    toast("Ce fichier n'est pas une image.");
    return;
  }

  try {
    const destDir = await state.rootHandle.getDirectoryHandle(CATS[toCat].dir, { create: true });
    const destName = await freeName(destDir, item.name);

    let moved = false;

    // Déplacement natif si le navigateur le propose (Chrome récent).
    if (typeof item.handle.move === "function") {
      try {
        await item.handle.move(destDir, destName);
        moved = true;
      } catch { /* on bascule sur copie + suppression */ }
    }

    if (!moved) {
      const file = await item.getFile();
      const dest = await destDir.getFileHandle(destName, { create: true });
      const w = await dest.createWritable();
      await w.write(file);
      await w.close();
      await item.dirHandle.removeEntry(item.name);
    }

    // Mise à jour du catalogue sans relire tout le disque.
    items.splice(state.index[fromCat], 1);
    if (state.index[fromCat] >= items.length) state.index[fromCat] = Math.max(0, items.length - 1);

    state.catalog[toCat].push({
      name: destName,
      cat: toCat,
      handle: await destDir.getFileHandle(destName),
      dirHandle: destDir,
      getFile: async () => (await destDir.getFileHandle(destName)).getFile(),
    });

    sortCatalog();
    refreshCounts();
    renderView(fromCat);
    toast("« " + destName + " » exporté vers " + CATS[toCat].label + ".");

  } catch (err) {
    toast("Export impossible : " + (err && err.message ? err.message : "erreur inconnue"));
  }
}

/** Trouve un nom libre dans le dossier de destination (ajoute -1, -2, …). */
async function freeName(dirHandle, name) {
  const dot  = name.lastIndexOf(".");
  const base = dot < 0 ? name : name.slice(0, dot);
  const ext  = dot < 0 ? "" : name.slice(dot);

  let candidate = name;
  for (let i = 1; i < 500; i++) {
    try {
      await dirHandle.getFileHandle(candidate);       // existe déjà
      candidate = base + "-" + i + ext;
    } catch {
      return candidate;                               // libre
    }
  }
  return base + "-" + Date.now() + ext;
}

/* --------------------------------------------------------------------------
   10. PAPIER PEINT (portail + accueil)
   -------------------------------------------------------------------------- */

async function applyWallpaper(blob) {
  const url = URL.createObjectURL(blob);
  const css = 'url("' + url + '")';
  const wall = $("#homeWall");
  const gateWall = $("#gateWall");
  if (wall) wall.style.setProperty("--wall", css);
  if (gateWall) gateWall.style.setProperty("--wall", css);
}

async function setWallpaperFromCurrent(cat) {
  const item = state.catalog[cat][state.index[cat]];
  if (!item || !isImage(item.name)) { toast("Choisissez une image."); return; }

  const file = await mediaBlob(item);
  await idbSet("wallpaper", file);
  await applyWallpaper(file);
  toast("Papier peint mis à jour.");
}

async function restoreWallpaper() {
  const blob = await idbGet("wallpaper");
  if (blob) await applyWallpaper(blob);
}

/* --------------------------------------------------------------------------
   10 bis. CIEL VIVANT — trajectoire du soleil, heure, luminosité
   -------------------------------------------------------------------------- */

/**
 * Recalcule, à partir de l'heure courante :
 *   - la position de l'astre sur son arc (est → ouest)
 *   - sa hauteur (bas au lever/coucher, haut à midi)
 *   - sa couleur (soleil doré le jour, lune pâle la nuit)
 *   - l'heure affichée en son centre, au format HH:MM
 *   - la luminosité générale de la page d'accueil
 *
 * Tout se cale sur l'horloge de l'appareil du visiteur.
 */
function updateSky() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;   // heure décimale 0–24

  // ---- Heure affichée dans l'astre ----
  const clock = pad(now.getHours()) + ":" + pad(now.getMinutes());
  const clockEl = $("#skyClock");
  if (clockEl) clockEl.textContent = clock;

  const body = $("#skyBody");
  const glow = $("#skyGlow");
  const home = $(".home");
  if (!body) return;

  // ---- Jour ou nuit ? Lever ~7h, coucher ~19h (repères visuels simples) ----
  const LEVER = 7, COUCHER = 19;
  const jour = h >= LEVER && h < COUCHER;

  // t : progression sur l'arc visible (0 au lever/début de nuit, 1 à la fin)
  let t;
  if (jour) {
    t = (h - LEVER) / (COUCHER - LEVER);              // course diurne
  } else {
    // Course nocturne : du coucher (19h) au lever (7h), soit 12h à cheval
    // sur minuit. On ramène ça sur 0→1 pour faire voyager la lune aussi.
    const nuit = (h < LEVER) ? h + 24 : h;            // 19…31
    t = (nuit - COUCHER) / ((24 - COUCHER) + LEVER);  // 0→1
  }
  t = Math.max(0, Math.min(1, t));

  // Position horizontale (gauche→droite) et hauteur en arc (sin).
  body.style.setProperty("--x", t.toFixed(4));
  body.style.setProperty("--lift", Math.sin(t * Math.PI).toFixed(4));

  // ---- Palette selon le moment ----
  let astre, halo, clockColor, luminosite;

  if (!jour) {
    // Lune : disque pâle, halo froid, page sombre
    astre = "radial-gradient(circle at 42% 40%, #f2f4ff, #cdd6f0 60%, #9aa6c8)";
    halo = "radial-gradient(circle, rgba(180,200,255,0.30) 0%, rgba(180,200,255,0) 70%)";
    clockColor = "rgba(30, 40, 70, 0.78)";
    luminosite = 0.34;                                // nuit : bien assombri
  } else if (h < LEVER + 2 || h > COUCHER - 2) {
    // Aube / crépuscule : soleil orangé, page tamisée
    astre = "radial-gradient(circle at 40% 38%, #fff0cf, #ffb057 55%, #ff7e30)";
    halo = "radial-gradient(circle, rgba(255,150,70,0.50) 0%, rgba(255,150,70,0) 70%)";
    clockColor = "rgba(70, 35, 5, 0.78)";
    luminosite = 0.72;
  } else {
    // Plein jour : soleil éclatant, page lumineuse
    astre = "radial-gradient(circle at 40% 38%, #fffce8, #ffd94d 55%, #ff9e2c)";
    halo = "radial-gradient(circle, rgba(255,220,90,0.55) 0%, rgba(255,220,90,0) 68%)";
    clockColor = "rgba(60, 40, 10, 0.72)";
    luminosite = 1;                                   // clair
  }

  body.style.setProperty("--astre", astre);
  body.style.setProperty("--clock", clockColor);
  if (glow) glow.style.setProperty("--halo", halo);

  // La luminosité agit sur le voile : plus il est opaque, plus c'est sombre.
  // On pilote une variable que le voile de l'accueil peut utiliser.
  if (home) home.style.setProperty("--nuit", (1 - luminosite).toFixed(3));
}

/** Lance l'horloge du ciel et la rafraîchit chaque minute. */
function initSky() {
  updateSky();
  // Cadence sur le changement de minute pour rester précis sans surcharger.
  const now = new Date();
  const versMinute = (60 - now.getSeconds()) * 1000;
  setTimeout(() => {
    updateSky();
    setInterval(updateSky, 60000);
  }, versMinute);
}

/* --------------------------------------------------------------------------
   11. DÉMARRAGE
   -------------------------------------------------------------------------- */

function initApp() {
  initSky();
  // Menu de gauche
  $("#rail").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-go]");
    if (!btn) return;
    e.preventDefault();
    go(btn.dataset.go);
  });

  $("#connectBtn").addEventListener("click", connectFolder);

  // Raccourcis clavier globaux
  document.addEventListener("keydown", (e) => {
    if (!$("#lockModal").hidden) {
      if (e.key === "Escape") closeMinuteModal();
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;

    if (e.key === "Escape") { go("accueil"); return; }

    // Barre d'espace : lance ou arrête le diaporama de l'onglet courant.
    // (ignorée si le focus est sur un bouton, qui réagit déjà à l'espace)
    if (e.key === " " || e.code === "Space") {
      if (document.activeElement?.tagName === "BUTTON") return;
      if (CATS[state.current]) { e.preventDefault(); toggleShow(state.current); }
      return;
    }

    // Chiffres 1 à 5 : accès direct aux onglets
    const byNum = Object.keys(CATS).find((k) => CATS[k].num === e.key);
    if (byNum) { go(byNum); return; }

    // Flèches : défilement même si la visionneuse n'a pas le focus
    if (CATS[state.current] && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      step(state.current, e.key === "ArrowRight" ? +1 : -1);
    }
  });

  // Fermer le menu d'export en cliquant ailleurs
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".export")) $$(".export").forEach((x) => x.classList.remove("is-open"));
  });

  initFallbackInput();
  initLockModal();

  // Démarrage : on essaie d'abord le dossier du Bureau (mode atelier), puis
  // le catalogue publié. Le premier qui répond gagne.
  (async () => {
    if (await restoreFolder()) return;      // atelier retrouvé
    if (await loadPublished()) return;      // site publié
    setConnected(false);
    applyModeUI();

    if (!supportsFS) {
      $("#homeGuide").innerHTML =
        "Pour relier vos dossiers et exporter des fichiers, ouvrez ce site " +
        "avec <strong>Chrome</strong> ou <strong>Edge</strong>.";
    }
  })();
}

/* Le portail s'initialise immédiatement ; le reste attend le mot de passe. */
initGate();
restoreWallpaper();
