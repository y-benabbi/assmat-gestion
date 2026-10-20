const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

async function api(chemin, donnees) {
  const r = await fetch("/api/" + chemin, donnees === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donnees),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.erreur || r.statusText);
  return json;
}

// ------------------------------------------------------------- onglets
function ouvrirOnglet(nom) {
  $$("[data-onglet]").forEach((b) => b.classList.toggle("actif", b.dataset.onglet === nom));
  $$(".onglet").forEach((s) => s.classList.toggle("actif", s.id === nom));
  window.scrollTo(0, 0);
  if (nom === "bulletins") afficherListe();
}
$$("[data-onglet]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.onglet)));
$$("[data-aller]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); ouvrirOnglet(b.dataset.aller); }));

$("#date-du-jour").textContent = new Date().toLocaleDateString("fr-FR",
  { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
$$("[data-ouvrir]").forEach((b) => b.addEventListener("click", () =>
  api("ouvrir", { quoi: b.dataset.ouvrir }).catch((e) => alert(e.message))));

$("#quitter").addEventListener("click", async () => {
  if (!confirm("Arrêter l'application ?")) return;
  await api("quitter", {}).catch(() => {});
  document.body.innerHTML = "<main><p>L'application est arrêtée. Vous pouvez fermer cet onglet.</p></main>";
});

// ------------------------------------------------------------- état
let etat = { phase: "deconnecte", bulletins: [] };
let dossierLocal = null;

async function rafraichir() {
  try {
    const nouvel = await api("etat");
    const changementListe = JSON.stringify(nouvel.bulletins) !== JSON.stringify(etat.bulletins);
    etat = nouvel;
    afficherEtat();
    if (changementListe) afficherListe();
  } catch (e) { /* serveur arrêté */ }
}

function afficherEtat() {
  const occupe = ["connexion", "analyse", "telechargement", "code_requis", "verification_manuelle"].includes(etat.phase);
  $("#message").textContent = etat.message;
  $("#pastille").className = "pastille " + (etat.phase === "erreur" ? "erreur" : occupe ? "attente" : etat.phase === "connecte" ? "ok" : "");

  const code = etat.phase === "code_requis";
  $("#form-code").classList.toggle("cache", !code);
  $("#consigne-code").textContent = etat.detail_code || "";
  if (code && document.activeElement !== $("#code")) $("#code").focus();

  const p = etat.progression;
  $("#progression").classList.toggle("cache", !p);
  if (p) $("#progression div").style.width = `${(100 * p.fait) / Math.max(p.total, 1)}%`;

  const manquants = etat.bulletins.filter((b) => !b.present).length;
  const btn = $("#btn-telecharger");
  btn.classList.toggle("cache", manquants === 0);
  btn.textContent = `Récupérer les ${manquants} bulletin${manquants > 1 ? "s" : ""} de salaire manquant${manquants > 1 ? "s" : ""}`;
  $$("#btn-analyser, #btn-telecharger, #btn-visible, #btn-page").forEach((b) => (b.disabled = occupe));
  $("#btn-diag-erreur").classList.toggle("cache", etat.phase !== "erreur");

  const telechargement = etat.phase === "telechargement";
  const interrompre = $("#btn-interrompre");
  interrompre.classList.toggle("cache", !telechargement);
  btn.classList.toggle("cache", manquants === 0 || telechargement);
  if (!telechargement) interrompre.disabled = false;

  if (etat.bulletins.length) {
    const familles = new Set(etat.bulletins.filter((b) => !b.present).map((b) => b.client)).size;
    $("#tuile-bulletins").textContent = manquants
      ? `${manquants} bulletin${manquants > 1 ? "s" : ""} à récupérer, pour ${familles} famille${familles > 1 ? "s" : ""}.`
      : "Tous les bulletins sont rangés.";
    $("#tuile-bulletins").classList.toggle("a-faire", manquants > 0);
  }
  $("#journal").textContent = etat.journal.join("\n");
}

// ------------------------------------------------------------- liste
const INITIALES_MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Un intercalaire par famille : une ligne par année, une case par mois.
// entrees : [{periode: "AAAA-MM", present, manquant, fichier, details}]
function intercalaire(famille, entrees, resume, aCompleter, seulementManquants) {
  const parMois = {};
  entrees.forEach((e) => (parMois[e.periode] ??= []).push(e));
  let annees = [...new Set(entrees.map((e) => e.periode.slice(0, 4)))].sort().reverse();
  if (seulementManquants) annees = annees.filter((a) => entrees.some((e) => e.manquant && e.periode.startsWith(a)));

  const bloc = document.createElement("article");
  bloc.className = "intercalaire" + (aCompleter ? " a-completer" : "");
  bloc.innerHTML = `<div class="intercalaire-onglet"><h3>${echapper(famille)}</h3><span class="petit">${echapper(resume)}</span></div>
    <div class="intercalaire-feuille"></div>`;
  const feuille = bloc.querySelector(".intercalaire-feuille");

  const entete = document.createElement("div");
  entete.className = "grille-annee";
  entete.setAttribute("aria-hidden", "true");
  entete.innerHTML = `<span></span>` + INITIALES_MOIS.map((m) => `<span class="nom-mois">${m}</span>`).join("");
  feuille.appendChild(entete);

  annees.forEach((annee) => {
    const ligne = document.createElement("div");
    ligne.className = "grille-annee";
    ligne.innerHTML = `<span class="annee">${annee}</span>`;
    for (let m = 1; m <= 12; m++) {
      const periode = `${annee}-${String(m).padStart(2, "0")}`;
      const liste = parMois[periode] || [];
      const caseMois = document.createElement("button");
      caseMois.type = "button";
      const manquant = liste.some((e) => e.manquant);
      caseMois.className = "case-mois " + (!liste.length ? "vide" : manquant ? "manquant" : liste[0].local ? "local" : "present");
      if (liste.length > 1) caseMois.innerHTML = `<span class="nombre">${liste.length}</span>`;
      const titre = `${INITIALES_MOIS[m - 1]} ${annee}`;
      caseMois.title = liste.length ? `${titre}\n${liste.map((e) => e.details).join("\n\n")}` : `${titre} : aucun bulletin`;
      caseMois.setAttribute("aria-label", liste.length
        ? `${titre} : ${manquant ? "à récupérer" : "rangé"}` : `${titre} : aucun bulletin`);
      const fichier = liste.find((e) => e.fichier);
      if (fichier && !manquant) {
        caseMois.addEventListener("click", () => api("ouvrir", { quoi: fichier.fichier }).catch(() => {}));
      } else {
        caseMois.tabIndex = -1;
      }
      ligne.appendChild(caseMois);
    }
    feuille.appendChild(ligne);
  });
  return bloc;
}

async function afficherListe() {
  const zone = $("#liste");
  const seulementManquants = $("#seulement-manquants").checked;
  zone.innerHTML = "";

  if (etat.bulletins.length) {
    const parFamille = {};
    etat.bulletins.forEach((b) => (parFamille[b.client] ??= []).push(b));
    Object.keys(parFamille).sort((a, b) => a.localeCompare(b, "fr")).forEach((famille) => {
      const liste = parFamille[famille];
      const manq = liste.filter((b) => !b.present).length;
      if (seulementManquants && !manq) return;
      const entrees = liste.map((b) => ({
        periode: b.periode,
        manquant: !b.present,
        fichier: b.present ? b.fichier_existant : null,
        details: (b.enfant ? `Enfant : ${b.enfant}\n` : "")
          + (b.present ? `Rangé : ${b.fichier_existant}` : `À récupérer, sera rangé ici :\n${b.cible}`),
      }));
      const resume = `${liste.length} bulletin${liste.length > 1 ? "s" : ""}`
        + (manq ? `, ${manq} à récupérer` : ", tous rangés");
      zone.appendChild(intercalaire(famille, entrees, resume, manq > 0, seulementManquants));
    });
    if (!zone.children.length) zone.innerHTML = `<p class="vide-classeur">Toutes les familles sont à jour.</p>`;
    return;
  }

  // Pas encore de vérification sur Pajemploi : on montre ce qu'il y a dans le dossier.
  dossierLocal = await api("dossier").catch(() => null);
  if (!dossierLocal || !dossierLocal.configure) {
    zone.innerHTML = `<div class="vide-classeur"><p>Pour commencer, indiquez où ranger les bulletins de salaire.</p>
      <button class="principal" id="lien-param">Choisir le dossier dans les paramètres</button></div>`;
    $("#lien-param").addEventListener("click", () => ouvrirOnglet("parametres"));
    return;
  }
  const familles = Object.entries(dossierLocal.clients);
  if (!familles.length) {
    zone.innerHTML = `<div class="vide-classeur"><p>Le dossier ne contient encore aucun bulletin.
      Cliquez sur « Vérifier sur Pajemploi » pour trouver ceux à récupérer.</p></div>`;
    return;
  }
  zone.innerHTML = `<p class="petit">Contenu actuel du dossier. Cliquez sur « Vérifier sur Pajemploi » pour repérer les bulletins manquants.</p>`;
  familles.forEach(([famille, periodes]) => {
    const entrees = periodes.map((p) => ({ periode: p, local: true, manquant: false, fichier: null, details: "Présent dans le dossier" }));
    zone.appendChild(intercalaire(famille, entrees, `${periodes.length} mois dans le dossier`, false, false));
  });
}
$("#seulement-manquants").addEventListener("change", afficherListe);

function echapper(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// ------------------------------------------------------------- actions
function action(nom) {
  return api("action", { action: nom }).then(rafraichir).catch((e) => alert(e.message));
}
$("#btn-analyser").addEventListener("click", () => action("connecter_et_analyser"));
$("#btn-telecharger").addEventListener("click", () => action("telecharger_manquants"));
$("#btn-visible").addEventListener("click", () => action("ouvrir_visible"));
$("#btn-page").addEventListener("click", () => action("analyser_page_affichee"));
$("#btn-diagnostic").addEventListener("click", () => action("diagnostic"));
$("#btn-interrompre").addEventListener("click", async () => {
  const bouton = $("#btn-interrompre");
  bouton.disabled = true;
  await api("interrompre", {}).catch((e) => { bouton.disabled = false; alert(e.message); });
  rafraichir();
});
$("#form-code").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("code", { code: $("#code").value });
  $("#code").value = "";
  rafraichir();
});

// ------------------------------------------------------------- paramètres
const form = $("#form-parametres");

async function chargerParametres() {
  const p = await api("parametres");
  for (const [cle, val] of Object.entries(p)) {
    const champ = form.elements[cle];
    if (!champ) continue;
    if (champ.type === "checkbox") champ.checked = !!val; else champ.value = val ?? "";
  }
  form.elements.mot_de_passe.value = "";
  form.elements.mot_de_passe.placeholder = p.mot_de_passe_enregistre ? "•••••••• (enregistré)" : "";
  $("#info-mdp").textContent = p.mot_de_passe_enregistre
    ? "Mot de passe enregistré de façon sécurisée dans Windows. Laissez vide pour le conserver."
    : "Le mot de passe sera rangé dans le Gestionnaire d'identifiants de Windows (jamais dans un fichier).";
  apercu();
  if (!p.identifiant || !p.dossier_bulletins) ouvrirOnglet("parametres");
}

// Arborescence d'exemple : [["Dupont", "2025", "Bulletin….pdf"], …] -> listes imbriquées.
function arbreHtml(fichiers) {
  const racine = {};
  fichiers.forEach((parties) => {
    let noeud = racine;
    parties.forEach((p) => (noeud = noeud[p] ??= {}));
  });
  const rendu = (noeud) => Object.keys(noeud).map((nom) => {
    const enfants = Object.keys(noeud[nom]);
    return enfants.length
      ? `<li class="dossier"><span>${echapper(nom)}</span><ul>${rendu(noeud[nom])}</ul></li>`
      : `<li class="fichier"><span>${echapper(nom)}</span></li>`;
  }).join("");
  return rendu(racine);
}

async function apercu() {
  const r = await api("apercu-nom", {
    dossier_bulletins: form.elements.dossier_bulletins.value,
    format_fichier: form.elements.format_fichier.value,
    organisation: form.elements.organisation.value || "client",
  }).catch(() => null);
  if (r) $("#apercu").innerHTML = `<li class="dossier"><span>${echapper(r.racine)}</span><ul>${arbreHtml(r.fichiers)}</ul></li>`;
}
form.elements.dossier_bulletins.addEventListener("input", apercu);
form.elements.format_fichier.addEventListener("input", apercu);
$$("input[name=organisation]").forEach((r) => r.addEventListener("change", apercu));

$("#choisir-dossier").addEventListener("click", async () => {
  const r = await api("choisir-dossier", {});
  if (r.chemin) { form.elements.dossier_bulletins.value = r.chemin; apercu(); }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = {};
  for (const champ of form.elements) {
    if (!champ.name || (champ.type === "radio" && !champ.checked)) continue;
    d[champ.name] = champ.type === "checkbox" ? champ.checked : champ.value;
  }
  if (!d.mot_de_passe) delete d.mot_de_passe;
  try {
    await api("parametres", d);
    $("#enregistre").textContent = "Paramètres enregistrés.";
    setTimeout(() => ($("#enregistre").textContent = ""), 3000);
    await chargerParametres();
    dossierLocal = null;
  } catch (err) { alert(err.message); }
});

// ------------------------------------------------------------- mises à jour
async function verifierVersion(manuel = false) {
  const bouton = $("#btn-verifier-maj");
  if (manuel) { bouton.disabled = true; bouton.textContent = "Recherche…"; }
  const v = await api("version").catch(() => null);
  if (manuel) { bouton.disabled = false; bouton.textContent = "Rechercher une mise à jour"; }
  if (!v) {
    if (manuel) alert("Impossible de vérifier les mises à jour (connexion Internet ?).");
    return;
  }
  $("#version").textContent = v.locale;
  $("#apropos-version").textContent = v.locale;
  if (v.mise_a_jour) {
    $("#texte-maj").textContent = `Une nouvelle version (${v.distante}) est disponible.`;
    $("#bandeau-maj").classList.remove("cache");
    afficherNotesDisponibles(v.locale, v.distante);
    if (manuel) lancerMiseAJour(v.distante);
  } else if (manuel) {
    alert(v.distante
      ? `Vous avez la dernière version (${v.locale}).`
      : "Impossible de joindre GitHub pour vérifier les mises à jour (connexion Internet ?).");
  }
}

async function lancerMiseAJour(nouvelle) {
  if (!confirm(`Installer la version ${nouvelle || ""} ?\n\nL'application va se fermer, se mettre à jour `
    + "puis se rouvrir toute seule (environ une minute).")) return;
  try {
    await api("mettre-a-jour", {});
  } catch (e) { alert(e.message); return; }
  clearInterval(minuterieEtat);
  document.body.innerHTML = `<main><div class="attente-maj">
    <h2>Mise à jour en cours…</h2>
    <p>Une fenêtre noire affiche la progression. Cette page se rechargera automatiquement
       dès que l'application aura redémarré.</p>
    <p class="petit" id="suivi-maj">Arrêt de l'application…</p></div></main>`;
  attendreRedemarrage();
}

// Attend que l'ancien serveur s'arrête puis que le nouveau réponde, et recharge la page.
async function attendreRedemarrage() {
  let arrete = false;
  const debut = Date.now();
  for (;;) {
    await new Promise((ok) => setTimeout(ok, 2000));
    const repond = await fetch("/api/etat", { cache: "no-store" }).then((r) => r.ok).catch(() => false);
    const suivi = $("#suivi-maj");
    if (!repond) {
      arrete = true;
      if (suivi) suivi.textContent = "Téléchargement et installation de la nouvelle version…";
    } else if (arrete) {
      if (suivi) suivi.textContent = "Redémarrage…";
      location.reload();
      return;
    }
    if (Date.now() - debut > 15 * 60 * 1000 && suivi) {
      suivi.textContent = "C'est plus long que prévu. Regardez la fenêtre noire de mise à jour, "
        + "ou relancez l'application avec son raccourci.";
    }
  }
}

$("#btn-maj").addEventListener("click", () => lancerMiseAJour());
$("#btn-maj-2").addEventListener("click", () => lancerMiseAJour($("#nouvelle-version").textContent));
$("#btn-verifier-maj").addEventListener("click", () => verifierVersion(true));
$("#btn-verifier-maj-2").addEventListener("click", () => verifierVersion(true));

// ------------------------------------------------------------- à propos
function comparerVersions(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

function dateFr(iso) {
  return iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
}

function blocNotes(n, ouvert) {
  return `<details class="note-version" ${ouvert ? "open" : ""}>
    <summary><span class="numero">Version ${echapper(n.version)}</span>
      <span>${echapper(n.titre || "")}</span><span class="date">${dateFr(n.date)}</span></summary>
    <ul>${(n.nouveautes || []).map((x) => `<li>${echapper(x)}</li>`).join("")}</ul></details>`;
}

async function afficherNotes() {
  const notes = await fetch("/web/notes-versions.json", { cache: "no-store" }).then((r) => r.json()).catch(() => []);
  $("#notes-versions").innerHTML = notes.length
    ? notes.map((n, i) => blocNotes(n, i === 0)).join("")
    : `<p class="petit">Notes de version indisponibles.</p>`;
}

// Nouveautés de la version publiée, absentes de la version installée.
async function afficherNotesDisponibles(locale, distante) {
  const notes = await api("notes-distantes").catch(() => []);
  const nouvelles = (notes || []).filter((n) => comparerVersions(n.version, locale) > 0);
  $("#nouvelle-version").textContent = distante;
  $("#notes-disponibles").innerHTML = nouvelles.length
    ? nouvelles.map((n) => blocNotes(n, true)).join("")
    : `<p class="petit">Détail des nouveautés indisponible.</p>`;
  $("#carte-nouvelle-version").classList.remove("cache");
}

chargerParametres();
afficherNotes();
verifierVersion();
rafraichir();
const minuterieEtat = setInterval(rafraichir, 1500);
