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
  $("#menu").classList.remove("ouvert");
  $("#bouton-menu").setAttribute("aria-expanded", "false");
  window.scrollTo(0, 0);
  if (nom === "bulletins") afficherListe();
  if (nom === "accueil") afficherTableauDeBord();
  if (nom === "revenus") afficherRevenus($("#annee-revenus").value);
  if (nom === "impots") afficherImpots($("#annee-impots").value);
  if (nom === "contrats") afficherContrats();
  if (nom === "echeances") afficherEcheances();
  if (nom === "courriers") preparerCourriers();
  if (nom === "profil") chargerProfil();
}
$("#bouton-menu").addEventListener("click", () => {
  const ouvert = $("#menu").classList.toggle("ouvert");
  $("#bouton-menu").setAttribute("aria-expanded", String(ouvert));
});
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

// Familles « récentes » : un bulletin (rangé ou à récupérer) dans les 6 derniers mois.
function limiteRecente() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 7);
}
try { $("#familles-recentes").checked = localStorage.getItem("familles-recentes") !== "non"; } catch { /* rien */ }

async function afficherListe() {
  const zone = $("#liste");
  const seulementManquants = $("#seulement-manquants").checked;
  const recentes = $("#familles-recentes").checked;
  const limite = limiteRecente();
  zone.innerHTML = "";

  if (etat.bulletins.length) {
    const parFamille = {};
    etat.bulletins.forEach((b) => (parFamille[b.client] ??= []).push(b));
    Object.keys(parFamille).sort((a, b) => a.localeCompare(b, "fr")).forEach((famille) => {
      const liste = parFamille[famille];
      const manq = liste.filter((b) => !b.present).length;
      if (seulementManquants && !manq) return;
      if (recentes && !liste.some((b) => b.periode >= limite)) return;
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
    if (!zone.children.length) zone.innerHTML = `<p class="vide-classeur">${recentes
      ? "Aucune famille récente à afficher : décochez « Uniquement les familles récentes » pour voir les autres."
      : "Toutes les familles sont à jour."}</p>`;
    appliquerFiltres();
    return;
  }

  // Pas encore de vérification sur Pajemploi : on montre ce qu'il y a dans le dossier.
  dossierLocal = await api("dossier").catch(() => null);
  if (!dossierLocal || !dossierLocal.configure) {
    zone.innerHTML = `<div class="vide-classeur"><p>Pour commencer, indiquez où ranger les bulletins de salaire.</p>
      <button class="principal" id="lien-param">Choisir le dossier dans « Mes fonctionnalités »</button></div>`;
    $("#lien-param").addEventListener("click", () => ouvrirOnglet("fonctionnalites"));
    return;
  }
  const familles = Object.entries(dossierLocal.clients);
  if (!familles.length) {
    zone.innerHTML = `<div class="vide-classeur"><p>Le dossier ne contient encore aucun bulletin.
      Cliquez sur « Vérifier sur Pajemploi » pour trouver ceux à récupérer.</p></div>`;
    return;
  }
  zone.innerHTML = `<p class="petit">Contenu actuel du dossier. Cliquez sur « Vérifier sur Pajemploi » pour repérer les bulletins manquants.</p>`;
  familles.filter(([, periodes]) => !recentes || periodes.some((p) => p >= limite)).forEach(([famille, periodes]) => {
    const entrees = periodes.map((p) => ({ periode: p, local: true, manquant: false, fichier: null, details: "Présent dans le dossier" }));
    zone.appendChild(intercalaire(famille, entrees, `${periodes.length} mois dans le dossier`, false, false));
  });
  appliquerFiltres();
}
$("#seulement-manquants").addEventListener("change", afficherListe);
$("#familles-recentes").addEventListener("change", (e) => {
  try { localStorage.setItem("familles-recentes", e.target.checked ? "oui" : "non"); } catch { /* rien */ }
  afficherListe();
});

// ------------------------------------------------------------- recherche instantanée
// Un champ [data-filtre="sélecteur"] masque, au fil de la frappe, les éléments qui ne contiennent pas le texte.
const sansAccents = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function appliquerFiltre(champ) {
  const mots = sansAccents(champ.value).split(/\s+/).filter(Boolean);
  $$(champ.dataset.filtre).forEach((el) => {
    const texte = sansAccents(el.textContent + " " + [...el.querySelectorAll("input")].map((i) => i.value).join(" "));
    el.classList.toggle("filtre-cache", !mots.every((m) => texte.includes(m)));
  });
}
function appliquerFiltres() { $$("[data-filtre]").forEach(appliquerFiltre); }
document.addEventListener("input", (e) => { if (e.target.matches?.("[data-filtre]")) appliquerFiltre(e.target); });

// ------------------------------------------------------------- champs obligatoires et facultatifs
// Chaque libellé de formulaire reçoit la mention « obligatoire » ou « facultatif ».
function marquerChamps(formulaire) {
  formulaire.querySelectorAll("label").forEach((label) => {
    const champ = label.querySelector("input, select, textarea");
    if (!champ || ["checkbox", "radio", "hidden"].includes(champ.type) || label.querySelector(".mention")) return;
    const obligatoire = champ.required || champ.hasAttribute("data-obligatoire");
    const texte = [...label.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!texte) return;
    const mention = document.createElement("span");
    mention.className = "mention" + (obligatoire ? " obligatoire" : "");
    mention.textContent = obligatoire ? "obligatoire" : "facultatif";
    texte.after(mention);
  });
}
$$("form.formulaire").forEach(marquerChamps);

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
  for (const [cle, val] of Object.entries(p.modules || {})) {
    const champ = form.elements["modules." + cle];
    if (champ) champ.checked = !!val;
  }
  appliquerModules(p.modules || {});
  form.elements.mot_de_passe.value = "";
  form.elements.mot_de_passe.placeholder = p.mot_de_passe_enregistre ? "•••••••• (enregistré)" : "";
  $("#info-mdp").textContent = p.mot_de_passe_enregistre
    ? "Mot de passe enregistré de façon sécurisée dans Windows. Laissez vide pour le conserver."
    : "Le mot de passe sera rangé dans le Gestionnaire d'identifiants de Windows (jamais dans un fichier).";
  apercu();
  parametresActuels = p;
  if (p.modules?.bulletins !== false && (!p.identifiant || !p.dossier_bulletins)) ouvrirOnglet("fonctionnalites");
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
  const d = { modules: {} };
  for (const champ of form.elements) {
    if (!champ.name || (champ.type === "radio" && !champ.checked)) continue;
    const valeur = champ.type === "checkbox" ? champ.checked : champ.value;
    if (champ.name.startsWith("modules.")) d.modules[champ.name.slice(8)] = valeur;
    else d[champ.name] = valeur;
  }
  if (!d.mot_de_passe) delete d.mot_de_passe;
  try {
    await api("parametres", d);
    $("#enregistre").textContent = "Réglages enregistrés.";
    setTimeout(() => ($("#enregistre").textContent = ""), 3000);
    await chargerParametres();
    dossierLocal = null;
  } catch (err) { alert(err.message); }
});

// ------------------------------------------------------------- rubriques affichées
let parametresActuels = {};

function appliquerModules(modules) {
  $$("[data-module]").forEach((el) => el.classList.toggle("cache", modules[el.dataset.module] === false));
  // Une catégorie du menu sans rubrique visible disparaît aussi.
  $$(".menu .categorie").forEach((titre) => {
    let el = titre.nextElementSibling, visible = false;
    while (el && el.tagName === "BUTTON") { visible ||= !el.classList.contains("cache"); el = el.nextElementSibling; }
    titre.classList.toggle("cache", !visible);
  });
}

// ------------------------------------------------------------- tableau de bord et revenus
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const euros = (v, decimales = 0) => (v || 0).toLocaleString("fr-FR",
  { style: "currency", currency: "EUR", minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const heures = (v) => `${Math.round(v || 0).toLocaleString("fr-FR")} h`;
let revenusCharges = {};

async function chargerRevenus(annee) {
  const cle = annee || "";
  revenusCharges[cle] ??= api("revenus" + (annee ? `?annee=${annee}` : "")).catch(() => null);
  return revenusCharges[cle];
}

// Les clés « 10 », « 11 », « 12 » passeraient avant « 01 » dans un objet JS : on trie.
const moisTries = (r) => Object.keys(r.mois).sort().map((k) => r.mois[k]);

function periodeCouverte(r) {
  const mois = Object.keys(r.mois).filter((k) => r.mois[k].bulletins).map(Number);
  if (!mois.length) return "aucun bulletin";
  const a = MOIS_COURTS[Math.min(...mois) - 1], b = MOIS_COURTS[Math.max(...mois) - 1];
  return a === b ? a : `${a} à ${b}`;
}

function chiffresHtml(r) {
  const g = r.general;
  const part = g.brut ? Math.round((100 * g.cotisations) / g.brut) : 0;
  return `
    <div class="chiffre"><span class="libelle-chiffre">Salaire brut</span><span class="valeur">${euros(g.brut)}</span><span class="detail">${periodeCouverte(r)}</span></div>
    <div class="chiffre"><span class="libelle-chiffre">Cotisations prélevées</span><span class="valeur">${euros(g.cotisations)}</span><span class="detail">${part} % du brut</span></div>
    <div class="chiffre net"><span class="libelle-chiffre">Salaire net</span><span class="valeur">${euros(g.net)}</span><span class="detail">versé par les familles</span></div>
    <div class="chiffre"><span class="libelle-chiffre">Indemnités</span><span class="valeur">${euros(g.indemnites)}</span><span class="detail">entretien, repas, km</span></div>
    <div class="chiffre total"><span class="libelle-chiffre">Total encaissé</span><span class="valeur">${euros(g.encaisse)}</span><span class="detail">net payé, indemnités comprises</span></div>`;
}

function graphiqueHtml(r) {
  const mois = moisTries(r);
  const max = Math.max(1, ...mois.map((m) => m.brut + m.indemnites));
  const h = (v) => Math.round((170 * v) / max);
  return `<div class="legende-graphique"><span><i class="c-net"></i>Net</span><span><i class="c-cot"></i>Cotisations</span>
      <span><i class="c-ind"></i>Indemnités</span></div>
    <div class="defilement"><div class="graphique" role="img" aria-label="Revenus mois par mois">
    ${mois.map((m, i) => `<div class="barre-mois" title="${MOIS_COURTS[i]} : brut ${euros(m.brut, 2)}, net ${euros(m.net, 2)}, indemnités ${euros(m.indemnites, 2)}">
      <span class="montant">${m.bulletins ? euros(m.encaisse) : ""}</span>
      <div class="pile"><div class="c-ind" style="height:${h(m.indemnites)}px"></div>
        <div class="c-cot" style="height:${h(m.cotisations)}px"></div><div class="c-net" style="height:${h(m.net)}px"></div></div>
      <span class="mois">${MOIS_COURTS[i]}</span></div>`).join("")}
    </div></div>`;
}

function aucunRevenu(zone) {
  zone.innerHTML = `<p class="petit">Aucun bulletin lu pour l'instant. Les montants apparaîtront dès que des bulletins
    seront rangés dans le dossier choisi dans « Mes fonctionnalités ».</p>`;
}

async function afficherTableauDeBord() {
  const modules = parametresActuels.modules || {};
  const aFaire = [];
  const manquants = etat.bulletins.filter((b) => !b.present).length;
  if (modules.bulletins !== false && manquants)
    aFaire.push({ couleur: "attente", texte: `${manquants} bulletin${manquants > 1 ? "s" : ""} de salaire à récupérer.`, aller: "bulletins", bouton: "Récupérer" });

  const [r, ech, contrats, profil] = await Promise.all([
    modules.revenus !== false ? chargerRevenus() : null,
    modules.echeances !== false ? api("echeances").catch(() => []) : [],
    api("contrats").catch(() => []), api("profil").catch(() => ({})),
  ]);
  if (r && r.illisibles.length && !r.module_absent)
    aFaire.push({ couleur: "erreur", texte: `${r.illisibles.length} bulletin${r.illisibles.length > 1 ? "s" : ""} dont les montants n'ont pas pu être lus.`, aller: "revenus", bouton: "Voir" });
  if (modules.contrats !== false && !contrats.length)
    aFaire.push({ couleur: "", texte: "Créez la fiche de chaque famille employeur, puis une fiche par enfant accueilli (dates, emploi du temps).", aller: "contrats", bouton: "Familles" });
  // Saison de la déclaration de revenus (janvier à juin) : rappeler les jours de garde à confirmer.
  if (modules.impots !== false && new Date().getMonth() < 6) {
    const imp = await chargerImpots();
    if (imp && imp.familles.length)
      aFaire.push({ couleur: imp.a_confirmer ? "attente" : "", aller: "impots", bouton: "Impôts",
        texte: imp.a_confirmer ? `Déclaration des revenus ${imp.annee} : ${imp.a_confirmer} mois de garde à confirmer.`
          : `Déclaration des revenus ${imp.annee} : montant à déclarer prêt (${euros(imp.total[imp.total.meilleur])}).` });
  }
  if (!profil.nom || !profil.agrement_numero)
    aFaire.push({ couleur: "", texte: "Complétez votre profil (identité, agrément) pour les courriers et les échéances.", aller: "profil", bouton: "Mon profil" });
  $("#liste-a-faire").innerHTML = aFaire.length
    ? aFaire.map((a) => `<li><span class="pastille ${a.couleur}" aria-hidden="true"></span><span class="texte">${echapper(a.texte)}</span>
        <button class="secondaire" data-aller-vers="${a.aller}">${a.bouton}</button></li>`).join("")
    : `<li><span class="pastille ok" aria-hidden="true"></span><span class="texte">Rien d'urgent : tout est à jour.</span></li>`;
  $$("[data-aller-vers]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerVers)));

  if (r) {
    $("#annee-accueil").textContent = r.general.bulletins ? `en ${r.annee}` : "";
    if (r.general.bulletins) {
      $("#chiffres-accueil").innerHTML = chiffresHtml(r);
      $("#graphique-accueil").innerHTML = graphiqueHtml(r);
    } else {
      $("#chiffres-accueil").innerHTML = "";
      aucunRevenu($("#graphique-accueil"));
    }
  }
  // Principales échéances : les plus proches ; le reste est dans la rubrique Échéances.
  const MAX_ACCUEIL = 5;
  $("#echeances-accueil").innerHTML = ech.length ? ech.slice(0, MAX_ACCUEIL).map(ligneEcheance).join("")
      + (ech.length > MAX_ACCUEIL ? `<li class="plus"><button class="lien" data-aller-vers="echeances">${ech.length - MAX_ACCUEIL > 1
        ? `Voir les ${ech.length - MAX_ACCUEIL} autres échéances` : "Voir l'autre échéance"}</button></li>` : "")
    : `<li class="petit">Aucune échéance connue : complétez Mon profil et les contrats.</li>`;
  $$("#echeances-accueil [data-aller-vers]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerVers)));
}

async function afficherRevenus(annee) {
  const r = await chargerRevenus(annee);
  const choix = $("#annee-revenus");
  if (!r) return;
  choix.innerHTML = (r.annees.length ? r.annees : [r.annee]).map((a) => `<option ${a === r.annee ? "selected" : ""}>${a}</option>`).join("");
  if (!r.general.bulletins) {
    $("#chiffres-revenus").innerHTML = "";
    aucunRevenu($("#graphique-revenus"));
    $("#tableau-familles").innerHTML = $("#tableau-mois").innerHTML = "";
    return;
  }
  $("#chiffres-revenus").innerHTML = chiffresHtml(r);
  $("#graphique-revenus").innerHTML = graphiqueHtml(r);
  const total = r.general.brut || 1;
  const ligne = (nom, m, avecPart) => `<tr><td>${nom}</td><td>${m.bulletins}</td><td>${heures(m.heures)}</td><td>${euros(m.brut, 2)}</td>
    <td>${euros(m.cotisations, 2)}</td><td>${euros(m.net, 2)}</td><td>${euros(m.indemnites, 2)}</td><td>${euros(m.encaisse, 2)}</td>
    ${avecPart ? `<td><span class="part"><span style="width:${Math.round((100 * m.brut) / total)}%"></span></span>${Math.round((100 * m.brut) / total)} %</td>` : ""}</tr>`;
  const entete = (premier, avecPart) => `<thead><tr><th>${premier}</th><th>Bulletins</th><th>Heures</th><th>Brut</th><th>Cotisations</th>
    <th>Net</th><th>Indemnités</th><th>Encaissé</th>${avecPart ? "<th>Part du brut</th>" : ""}</tr></thead>`;
  $("#tableau-familles").innerHTML = entete("Famille", true)
    + `<tbody>${Object.entries(r.familles).map(([nom, m]) => ligne(`<strong>${echapper(nom)}</strong>`, m, true)).join("")}</tbody>`
    + `<tfoot>${ligne("Total", r.general, false).replace("</tr>", "<td></td></tr>")}</tfoot>`;
  $("#tableau-mois").innerHTML = entete("Mois", false)
    + `<tbody>${Object.keys(r.mois).sort().filter((k) => r.mois[k].bulletins).map((k) => ligne(MOIS_COURTS[+k - 1], r.mois[k], false)).join("")}</tbody>`
    + `<tfoot>${ligne("Total", r.general, false)}</tfoot>`;
  $("#illisibles").textContent = r.module_absent
    ? "La lecture des bulletins se prépare : un composant est en cours d'installation. Revenez sur cette page dans une ou deux minutes."
    : r.illisibles.length ? `Montants non lus pour : ${r.illisibles.map((f) => f.split(/[\\/]/).pop()).join(", ")}.` : "";
}
$("#annee-revenus").addEventListener("change", (e) => afficherRevenus(e.target.value));

// ------------------------------------------------------------- impôts
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre",
  "novembre", "décembre"];
const nombre = (v) => (v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const CHAMPS_JOURS = [
  ["jours_8h", "Jours ≥ 8 h", 1], ["jours_courts", "Jours < 8 h", 1],
  ["heures_courtes", "Heures (jours < 8 h)", 0.25], ["jours_24h", "Gardes 24 h", 1],
];
let anneeImpots = "";
const ouverts = new Set();      // fiches enfants dépliées, gardées d'un affichage à l'autre
const SOURCES = { "bulletin": "Bulletin", "emploi du temps": "Emploi du temps",
  "bulletin, limité à l'emploi du temps": "Bulletin (limité)" };

async function chargerImpots(annee) {
  return api("impots" + (annee ? `?annee=${annee}` : "")).catch(() => null);
}

function conseilImpots(t) {
  const choix = parametresActuels.regime_impots || "specifique";
  const meilleur = t.meilleur === "specifique" ? "le régime spécifique des assistantes maternelles" : "le régime classique";
  let texte = `<h2>Notre conseil</h2><p><strong>Cette année, ${meilleur} est le plus avantageux</strong> :
    ${euros(t.ecart)} de moins à déclarer qu'avec l'autre régime.</p>`;
  if (choix !== "comparer" && choix !== t.meilleur)
    texte += `<p class="petit">Vous avez choisi le régime ${choix === "specifique" ? "spécifique" : "classique"} dans
      « Mes fonctionnalités » : il vous ferait déclarer ${euros(t.ecart)} de plus.</p>`;
  texte += t.meilleur === "specifique"
    ? `<p class="petit">Comment déclarer : sur la déclaration en ligne, remplacez le montant des salaires déjà rempli
        (case 1AJ, ou 1BJ pour le second déclarant) par <strong>${euros(t.specifique)}</strong>. Ne cochez pas les frais
        réels. Gardez le détail du calcul ci-dessous : il peut vous être demandé.</p>`
    : `<p class="petit">Comment déclarer : gardez le montant des salaires déjà rempli par les impôts
        (environ ${euros(t.net_imposable)}, net imposable des bulletins). La déduction de 10 % est appliquée
        automatiquement.</p>`;
  return texte + `<p class="petit">Ces montants sont une aide au calcul : en cas de doute, le centre des impôts fait foi.</p>`;
}

function ligneJours(e, m) {
  const j = m.jours;
  const bulletin = [m.jours_bulletin ? `${nombre(m.jours_bulletin)} j` : "", m.heures_bulletin ? heures(m.heures_bulletin) : ""]
    .filter(Boolean).join(" · ") || "—";
  return `<tr data-contrat="${e.id}" data-mois="${m.mois}">
    <th scope="row">${MOIS_LONGS[+m.mois - 1]}</th><td>${bulletin}</td>
    ${CHAMPS_JOURS.map(([cle, libelle, pas]) => `<td><input type="number" min="0" step="${pas}" class="champ-jours"
      name="${cle}" value="${j[cle] || 0}" aria-label="${libelle}, ${MOIS_LONGS[+m.mois - 1]}"></td>`).join("")}
    <td title="SMIC horaire du mois : ${euros(m.smic, 2)}">${euros(m.abattement, 2)}</td>
    <td class="origine-jours">${m.confirme
      ? `<span class="etat-jours ok">Confirmé</span><button class="lien" data-annuler title="Revenir aux jours proposés">Annuler</button>`
      : `<span class="etat-jours" title="Proposé d'après : ${echapper(m.proposition.source)}">${echapper(SOURCES[m.proposition.source] || "Proposé")}</span>
         <button class="secondaire" data-confirmer>Confirmer</button>`}</td></tr>`;
}

function blocEnfant(f, e) {
  return `<details class="panneau enfant-impots" data-enfant="${e.id}" ${ouverts.has(e.id) ? "open" : ""}>
    <summary class="titre-panneau"><h3>${echapper(e.prenom)} <span class="petit">· famille ${echapper(f.famille)}</span></h3>
      <span>${e.a_confirmer ? `<span class="etat-jours">${e.a_confirmer} mois à confirmer</span>` : `<span class="etat-jours ok">Confirmé</span>`}
      Abattement : <strong>${euros(e.abattement, 2)}</strong></span></summary>
    <p class="petit">${e.majore ? "Abattement majoré (4 SMIC par jour de 8 h)" : "3 SMIC horaires par jour de 8 heures ou plus"},
      SMIC horaire du mois de garde (${[...new Set(e.mois.map((m) => euros(m.smic, 2)))].join(", puis ")}).
      ${e.a_confirmer ? `${e.a_confirmer} mois à confirmer.` : "Tous les mois sont confirmés."}</p>
    <div class="defilement"><table class="tableau tableau-jours"><thead><tr><th>Mois</th><th>Bulletin</th>
      ${CHAMPS_JOURS.map(([, libelle]) => `<th>${libelle}</th>`).join("")}<th>Abattement</th><th>Origine des jours</th></tr></thead>
      <tbody>${e.mois.map((m) => ligneJours(e, m)).join("")}</tbody></table></div>
    ${e.a_confirmer ? `<p class="actions"><button class="principal" data-tout-confirmer="${e.id}">Confirmer tous les mois de ${echapper(e.prenom)}</button></p>` : ""}
  </details>`;
}

function valeursLigne(tr) {
  return Object.fromEntries(CHAMPS_JOURS.map(([cle]) => [cle, tr.querySelector(`[name="${cle}"]`).value || "0"]));
}

async function enregistrerJours(lignes, annuler = false) {
  try {
    for (const tr of lignes)
      await api("impots/jours", { annee: anneeImpots, contrat_id: tr.dataset.contrat, mois: tr.dataset.mois,
        valeurs: annuler ? null : valeursLigne(tr) });
  } catch (e) { alert(e.message); }
  afficherImpots(anneeImpots);
}

async function afficherImpots(annee) {
  const r = await chargerImpots(annee);
  if (!r) return;
  anneeImpots = r.annee;
  $("#annee-impots").innerHTML = r.annees.map((a) => `<option ${a === r.annee ? "selected" : ""}>${a}</option>`).join("");
  const t = r.total;
  const alertes = [];
  if (r.a_confirmer)
    alertes.push(`${r.a_confirmer} mois de garde à vérifier et confirmer plus bas : en attendant, les jours proposés sont utilisés.`);
  if (r.sans_fiche.length)
    alertes.push(`Sans fiche enfant, l'abattement n'est pas calculé pour : ${r.sans_fiche.map(echapper).join(", ")}.
      <button class="lien" data-aller-vers="contrats">Ajouter une fiche</button>`);
  if (!r.bareme_deduction_connu)
    alertes.push(`Le barème de la déduction de 10 % pour ${r.annee} n'est pas encore publié : celui de l'année précédente est utilisé.`);
  $("#alertes-impots").innerHTML = alertes.map((a) => `<p class="panneau alerte">${a}</p>`).join("");

  if (!r.familles.length) {
    $("#chiffres-impots").innerHTML = $("#tableau-impots").innerHTML = $("#jours-impots").innerHTML = "";
    $("#conseil-impots").innerHTML = `<p class="petit">Aucun bulletin pour ${r.annee}. Les montants apparaîtront dès que
      des bulletins seront rangés dans le dossier choisi dans « Mes fonctionnalités ».</p>`;
    return;
  }
  $("#chiffres-impots").innerHTML = `
    <div class="chiffre"><span class="libelle-chiffre">Revenus</span><span class="valeur">${euros(t.revenus)}</span><span class="detail">net imposable + indemnités</span></div>
    <div class="chiffre"><span class="libelle-chiffre">Abattement</span><span class="valeur">${euros(t.abattement)}</span><span class="detail">selon les jours de garde</span></div>
    <div class="chiffre ${t.meilleur === "specifique" ? "total" : ""}"><span class="libelle-chiffre">Régime spécifique</span><span class="valeur">${euros(t.specifique)}</span><span class="detail">à déclarer</span></div>
    <div class="chiffre ${t.meilleur === "classique" ? "total" : ""}"><span class="libelle-chiffre">Régime classique</span><span class="valeur">${euros(t.classique)}</span><span class="detail">net imposable − ${euros(t.deduction_10)}</span></div>`;
  $("#conseil-impots").innerHTML = conseilImpots(t);

  const ligne = (nom, f) => `<tr><td>${nom}</td><td>${euros(f.net_imposable, 2)}</td><td>${euros(f.indemnites, 2)}</td>
    <td>${euros(f.revenus, 2)}</td><td>${euros(f.abattement, 2)}</td><td><strong>${euros(f.imposable ?? f.specifique, 2)}</strong></td></tr>`;
  $("#tableau-impots").innerHTML = `<thead><tr><th>Famille</th><th>Net imposable</th><th>Indemnités</th><th>Revenus</th>
      <th>Abattement</th><th>À déclarer</th></tr></thead>
    <tbody>${r.familles.map((f) => ligne(`<strong>${echapper(f.famille)}</strong>${f.sans_fiche ? ` <span class="petit">(sans fiche)</span>` : ""}`, f)).join("")}</tbody>
    <tfoot>${ligne("Total", t)}</tfoot>`;

  const blocs = r.familles.flatMap((f) => f.enfants.filter((e) => e.mois.length).map((e) => blocEnfant(f, e)));
  $("#jours-impots").innerHTML = blocs.join("") || `<p class="petit">Aucune fiche enfant ne correspond aux familles des bulletins.</p>`;
  appliquerFiltres();
  $$("#impots [data-aller-vers]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerVers)));
  $$("#jours-impots details").forEach((d) => d.addEventListener("toggle", () =>
    d.open ? ouverts.add(d.dataset.enfant) : ouverts.delete(d.dataset.enfant)));
  // Un mois déjà confirmé est enregistré dès qu'on change un de ses chiffres.
  $$("#jours-impots tr:has([data-annuler]) .champ-jours").forEach((c) => c.addEventListener("change", () => enregistrerJours([c.closest("tr")])));
  $$("#jours-impots [data-confirmer]").forEach((b) => b.addEventListener("click", () => enregistrerJours([b.closest("tr")])));
  $$("#jours-impots [data-annuler]").forEach((b) => b.addEventListener("click", () => enregistrerJours([b.closest("tr")], true)));
  $$("#jours-impots [data-tout-confirmer]").forEach((b) => b.addEventListener("click", () =>
    enregistrerJours($$(`#jours-impots tr[data-contrat="${b.dataset.toutConfirmer}"]`)
      .filter((tr) => !tr.querySelector("[data-annuler]")))));
}
$("#annee-impots").addEventListener("change", (e) => afficherImpots(e.target.value));

// Barèmes affichés dans « À propos ».
async function afficherBaremes() {
  const b = await api("bareme").catch(() => null);
  if (!b) return;
  $("#bareme-smic").innerHTML = `<thead><tr><th>Depuis le</th><th>Montant</th></tr></thead>
    <tbody>${[...b.smic].reverse().map((s) => `<tr><td>${dateFr(s.depuis)}</td><td>${euros(s.montant, 2)}</td></tr>`).join("")}</tbody>`;
  $("#bareme-deduction").innerHTML = `<thead><tr><th>Revenus de</th><th>Minimum</th><th>Maximum</th></tr></thead>
    <tbody>${[...b.deduction_10].reverse().map((d) => `<tr><td>${d.annee}</td><td>${euros(d.minimum)}</td><td>${euros(d.maximum)}</td></tr>`).join("")}</tbody>`;
}

// ------------------------------------------------------------- échéances
function ligneEcheance(e) {
  const d = new Date(e.date + "T12:00:00");
  const mois = d.toLocaleDateString("fr-FR", { month: "short" })
    + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "");
  return `<li class="${e.urgent ? "urgent" : ""}"><span class="quand"><span class="jour">${d.getDate()}</span>
    <span class="mois">${mois}</span></span>
    <span>${echapper(e.titre)}${e.detail ? `<span class="detail">${echapper(e.detail)}</span>` : ""}</span></li>`;
}

async function afficherEcheances() {
  const ech = await api("echeances").catch(() => []);
  $("#liste-echeances").innerHTML = ech.length ? ech.map(ligneEcheance).join("")
    : `<li class="petit">Aucune échéance connue pour l'instant.</li>`;
  appliquerFiltres();
}

// ------------------------------------------------------------- contrats
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const PERIODES = { scolaire: "Période scolaire", vacances: "Vacances scolaires" };
// Conditions qu'un avenant peut changer (même liste que donnees.MODIFIABLES).
const MODIFIABLES = ["semaines", "accueil", "tarif_horaire", "entretien_jour", "repas_jour", "horaires_scolaire", "horaires_vacances",
  "delai_prevenance", "planning", "delai_planning", "tarif_complementaire", "taux_majoration", "repas_fournis", "frais_km"];
const CHAMPS_SIMPLES = MODIFIABLES.filter((k) => !k.startsWith("horaires"));
// Valeurs proposées pour une nouvelle fiche (les autres champs commencent vides).
const DEFAUTS_CONTRAT = { semaines: "52", taux_majoration: "10", ferie_majoration: "10", repos_jour: "dimanche",
  repos_travaille: "majore", premier_mai: "chome" };
// Jours fériés ordinaires (mêmes clés que contrat_travail.FERIES).
const FERIES = { "1er janvier": "1er janvier", "vendredi saint": "Vendredi saint (Alsace-Moselle)", "lundi de paques": "Lundi de Pâques",
  "8 mai": "8 mai", "ascension": "Jeudi de l'Ascension", "lundi de pentecote": "Lundi de Pentecôte",
  "abolition": "Abolition de l'esclavage (DROM)", "14 juillet": "14 juillet", "15 aout": "15 août", "1er novembre": "1er novembre",
  "11 novembre": "11 novembre", "25 decembre": "25 décembre", "26 decembre": "26 décembre (Alsace-Moselle)" };
$("#cases-feries").innerHTML = Object.entries(FERIES).map(([cle, libelle]) =>
  `<label class="case-a-cocher"><input type="checkbox" data-ferie="${cle}"> ${libelle}</label>`).join("");
const lireFeries = () => $$("[data-ferie]").filter((c) => c.checked).map((c) => c.dataset.ferie).join(",");
const ecrireFeries = (texte) => { const l = (texte || "").split(",").map((x) => x.trim()); $$("[data-ferie]").forEach((c) => (c.checked = l.includes(c.dataset.ferie))); };
const formContrat = $("#form-contrat");
let contratEdite = null;
let versions = [];          // [conditions du contrat initial, puis un objet par avenant (id, date, motif…)]
let versionActive = 0;
let suggestions = { familles: [], champs: {} };

// --- emploi du temps : heures d'arrivée et de départ, une deuxième plage possible (coupure)
const plage = (periode, jour, n) => `<span class="plage" data-plage="${n}">
  <input type="time" step="300" data-h="${periode}.${jour}.${n}.debut" aria-label="${PERIODES[periode]}, ${jour}, arrivée${n ? " (2e plage)" : ""}">
  <span aria-hidden="true">à</span>
  <input type="time" step="300" data-h="${periode}.${jour}.${n}.fin" aria-label="${PERIODES[periode]}, ${jour}, départ${n ? " (2e plage)" : ""}"></span>`;
const celluleHoraires = (periode, jour) => `<td class="${periode === "vacances" ? "col-vacances" : ""}" data-titre="${PERIODES[periode]}"><div class="plages">
  ${plage(periode, jour, 0)}${plage(periode, jour, 1)}
  <button type="button" class="lien ajout-plage" data-coupure="${periode}.${jour}">+ Coupure</button></div></td>`;
$("#horaires-contrat").innerHTML = `<thead><tr><th scope="col">Jour</th><th scope="col">Période scolaire</th>
  <th scope="col" class="col-vacances">Vacances scolaires</th></tr></thead>
  <tbody>${JOURS.map((j) => `<tr><th scope="row">${j.charAt(0).toUpperCase() + j.slice(1)}</th>
    ${celluleHoraires("scolaire", j)}${celluleHoraires("vacances", j)}</tr>`).join("")}</tbody>
  <tfoot><tr><td></td>${Object.keys(PERIODES).map((p) => `<td class="${p === "vacances" ? "col-vacances" : ""}" data-titre="${PERIODES[p]}">
    <button type="button" class="lien" data-recopier="${p}">Recopier le lundi sur mardi → vendredi</button></td>`).join("")}</tr></tfoot>`;

const champH = (periode, jour, n, bout) => $(`[data-h="${periode}.${jour}.${n}.${bout}"]`);
const minutes = (v) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
const versTexte = (v) => { const [h, m] = v.split(":"); return `${+h}h${m}`; };      // « 08:30 » → « 8h30 »

// « 8h00-12h00 / 13h30-17h » → [["08:00", "12:00"], ["13:30", "17:00"]]
function lirePlages(texte) {
  const plages = [];
  for (const m of (texte || "").matchAll(/(\d{1,2})\s*[h:]\s*(\d{2})?\s*(?:-|à|a)\s*(\d{1,2})\s*[h:]?\s*(\d{2})?/gi)) {
    const f = (h, mn) => `${String(+h).padStart(2, "0")}:${(mn || "00").padStart(2, "0")}`;
    plages.push([f(m[1], m[2]), f(m[3], m[4])]);
  }
  return plages;
}

function afficherCoupure(periode, jour, visible) {
  const td = champH(periode, jour, 1, "debut").closest(".plages");
  td.querySelector('[data-plage="1"]').classList.toggle("cache", !visible);
  td.querySelector(".ajout-plage").classList.toggle("cache", visible);
}

function ecrireHoraires(periode, horaires) {
  JOURS.forEach((j) => {
    const plages = lirePlages(horaires?.[j]);
    [0, 1].forEach((n) => {
      champH(periode, j, n, "debut").value = plages[n]?.[0] || "";
      champH(periode, j, n, "fin").value = plages[n]?.[1] || "";
    });
    afficherCoupure(periode, j, plages.length > 1);
  });
}

function lireHoraires(periode) {
  const resultat = {};
  JOURS.forEach((j) => {
    const plages = [0, 1].map((n) => [champH(periode, j, n, "debut").value, champH(periode, j, n, "fin").value])
      .filter(([d, f]) => d && f);
    if (plages.length) resultat[j] = plages.map(([d, f]) => `${versTexte(d)}-${versTexte(f)}`).join(" / ");
  });
  return resultat;
}

// Durée d'une journée en heures, d'après le texte enregistré (« 8h00-12h00 / 13h30-17h »).
const dureeJour = (texte) => lirePlages(texte).reduce((t, [d, f]) => t + Math.max(0, minutes(f) - minutes(d)), 0) / 60;
const heuresFr = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`; };

function resumeSemaine(horaires) {
  const jours = JOURS.filter((j) => horaires[j]);
  if (!jours.length) return null;
  const total = jours.reduce((t, j) => t + dureeJour(horaires[j]), 0);
  return { jours, total, detail: jours.map((j) => `${j.slice(0, 3)}. ${heuresFr(dureeJour(horaires[j]))}`).join(", ") };
}

const nombreFr = (t) => parseFloat(String(t || "").replace(/\s/g, "").replace(",", ".")) || 0;
// Part du brut qui reste en net : celle des derniers bulletins lus, sinon une estimation.
const tauxNet = () => suggestions.taux_net?.taux || 0.78;

function afficherNetHoraire() {
  const brut = nombreFr(formContrat.elements.tarif_horaire.value);
  const t = suggestions.taux_net;
  $("#net-horaire").textContent = brut ? `≈ ${euros(brut * tauxNet(), 2)} net de l'heure (indicatif : ${
    t?.source === "bulletins" ? `cotisations de vos derniers bulletins, ${Math.round(100 * (1 - t.taux))} % du brut`
      : "environ 22 % de cotisations"})` : "";
}
formContrat.elements.tarif_horaire.addEventListener("input", () => { afficherNetHoraire(); afficherResume(); });
["entretien_jour", "repas_jour"].forEach((k) => formContrat.elements[k].addEventListener("input", afficherResume));

// Semaines d'école dans l'année (calendrier scolaire), pour estimer la mensualisation quand les
// horaires des vacances sont différents.
const SEMAINES_ECOLE = 36;

function afficherResume() {
  const differentes = $("#vacances-differentes").checked;
  const scolaire = resumeSemaine(lireHoraires("scolaire"));
  const vacances = differentes ? resumeSemaine(lireHoraires("vacances")) : null;
  const ligne = (titre, r) => `<p><strong>${titre} : ${heuresFr(r.total)} par semaine</strong>, sur ${r.jours.length}
    jour${r.jours.length > 1 ? "s" : ""} <span class="petit">(${r.detail})</span></p>`;
  let html = "";
  if (scolaire) html += ligne(differentes ? "Période scolaire" : "Accueil", scolaire);
  if (vacances) html += ligne("Vacances scolaires", vacances);
  else if (differentes) html += `<p class="petit">Vacances scolaires : aucun accueil prévu.</p>`;

  const semaines = Math.min(52, Math.max(0, parseInt(formContrat.elements.semaines.value, 10) || 0));
  const tarif = nombreFr(formContrat.elements.tarif_horaire.value);
  const indemnite = nombreFr(formContrat.elements.entretien_jour.value) + nombreFr(formContrat.elements.repas_jour.value);
  if (scolaire && semaines) {
    // Semaines programmées réparties entre école et vacances (toutes à l'horaire scolaire s'il n'y a pas de distinction).
    const sEcole = differentes ? Math.min(SEMAINES_ECOLE, semaines) : semaines;
    const sVacances = differentes ? semaines - sEcole : 0;
    const hVac = vacances?.total || 0, jVac = vacances?.jours.length || 0;
    const heuresMois = (scolaire.total * sEcole + hVac * sVacances) / 12;
    const joursMois = (scolaire.jours.length * sEcole + jVac * sVacances) / 12;
    const salaire = (h) => (tarif ? ` · ${euros(h * tarif)} brut, ≈ ${euros(h * tarif * tauxNet())} net` : "");
    html += `<div class="salaire-indicatif"><p><strong>Mensualisation (indicatif)</strong> : ${heuresFr(heuresMois)} par mois${salaire(heuresMois)}</p>`;
    if (differentes) {
      html += `<p class="petit">${semaines} semaines par an, comptées ${sEcole} en période scolaire et ${sVacances} pendant les vacances :
        (${heuresFr(scolaire.total)} × ${sEcole}${sVacances ? ` + ${heuresFr(hVac)} × ${sVacances}` : ""}) ÷ 12.</p>
        <ul class="petit"><li>Une semaine en période scolaire : ${heuresFr(scolaire.total)}${salaire(scolaire.total)}</li>
        <li>Une semaine de vacances : ${heuresFr(hVac)}${salaire(hVac)}</li></ul>`;
    } else {
      html += `<p class="petit">${heuresFr(scolaire.total)} × ${semaines} semaines ÷ 12${semaines === 52 ? " (année complète)" : " (année incomplète)"}.</p>`;
    }
    if (indemnite) html += `<p class="petit">Indemnités d'entretien et de repas : ≈ ${euros(joursMois * indemnite)} par mois
      (${(Math.round(joursMois * 10) / 10).toLocaleString("fr-FR")} jours en moyenne × ${euros(indemnite, 2)}).</p>`;
    if (!tarif) html += `<p class="petit hors-assistant">Indiquez le tarif horaire pour voir le salaire.</p>`;
    html += `</div>`;
  }
  $("#resume-horaires").innerHTML = html || `<p class="petit">Aucun horaire saisi pour l'instant.</p>`;
  $("#resume-salaire").innerHTML = $("#resume-horaires .salaire-indicatif")?.outerHTML || "";
  afficherCas();
}

// Modèle de l'Urssaf : cas n° 1 (accueil sur 52 semaines) ou n° 2 (46 semaines ou moins, hors congés).
function afficherCas() {
  const semaines = parseInt(formContrat.elements.semaines.value, 10) || 52;
  const incomplete = semaines < 52;
  $$("#form-contrat .annee-incomplete").forEach((e) => e.classList.toggle("cache", !incomplete));
  $$("#form-contrat .annee-complete").forEach((e) => e.classList.toggle("cache", incomplete));
  $$("#form-contrat .planning-ecrit").forEach((e) => e.classList.toggle("cache", !incomplete || formContrat.elements.planning.value !== "oui"));
  $("#cas-contrat").textContent = !incomplete ? "Contrat de travail : année complète (cas n° 1 du modèle)."
    : semaines <= 46 ? "Contrat de travail : année incomplète (cas n° 2 du modèle)."
    : "Le modèle de l'Urssaf prévoit 52 semaines, ou 46 au plus hors congés : le contrat sera rempli comme une année incomplète (cas n° 2).";
}
formContrat.elements.planning.addEventListener("change", afficherCas);
["tarif_complementaire", "taux_majoration", "frais_km"].forEach((k) => formContrat.elements[k].addEventListener("input", afficherResume));

// Période d'adaptation : date de fin calculée (jours calendaires, 30 au plus).
function calculerAdaptation() {
  const el = formContrat.elements;
  const jours = Math.min(30, parseInt(el.adaptation_jours.value, 10) || 0);
  if (!jours) return;
  if (!el.adaptation_debut.value) el.adaptation_debut.value = el.debut.value;
  if (!el.adaptation_debut.value) return;
  const d = new Date(el.adaptation_debut.value + "T12:00:00");
  d.setDate(d.getDate() + jours - 1);
  el.adaptation_fin.value = d.toISOString().slice(0, 10);
}
formContrat.elements.adaptation_jours.addEventListener("input", calculerAdaptation);
formContrat.elements.adaptation_debut.addEventListener("change", calculerAdaptation);

$("#horaires-contrat").addEventListener("input", afficherResume);
$("#horaires-contrat").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.coupure) {
    const [p, j] = b.dataset.coupure.split(".");
    afficherCoupure(p, j, true);
    champH(p, j, 1, "debut").focus();
  }
  if (b.dataset.recopier) {
    const p = b.dataset.recopier;
    ["mardi", "mercredi", "jeudi", "vendredi"].forEach((j) => {
      [0, 1].forEach((n) => ["debut", "fin"].forEach((bout) => (champH(p, j, n, bout).value = champH(p, "lundi", n, bout).value)));
      afficherCoupure(p, j, !!champH(p, j, 1, "debut").value);
    });
    afficherResume();
  }
});
formContrat.elements.semaines.addEventListener("input", afficherResume);

function afficherColonneVacances() {
  $("#horaires-contrat").classList.toggle("sans-vacances", !$("#vacances-differentes").checked);
  afficherResume();
}
$("#vacances-differentes").addEventListener("change", afficherColonneVacances);

// --- contrat initial et avenants
const LIBELLES = { semaines: "semaines d'accueil", accueil: "type d'accueil", tarif_horaire: "tarif horaire",
  entretien_jour: "indemnité d'entretien", repas_jour: "indemnité de repas", horaires_scolaire: "horaires (période scolaire)", horaires_vacances: "horaires (vacances)",
  delai_prevenance: "délai de prévenance", planning: "planning", delai_planning: "délai du planning",
  tarif_complementaire: "tarif des heures complémentaires", taux_majoration: "majoration au-delà de 45 h",
  repas_fournis: "repas fournis par", frais_km: "frais de déplacement" };
// Les horaires sont comparés jour par jour (l'ordre des clés reçues du serveur peut varier).
const enTexte = (v) => (v && typeof v === "object" ? JOURS.map((j) => v[j] || "").join("|") : String(v ?? ""));
const memeValeur = (a, b) => enTexte(a) === enTexte(b);
const conditions = (c) => Object.fromEntries(MODIFIABLES.map((k) => [k, structuredClone(c?.[k] ?? (k.startsWith("horaires") ? {} : ""))]));

function enVigueur(c, jour) {
  const avenants = (c.avenants || []).filter((a) => a.date && a.date <= jour);
  return avenants.length ? { ...c, ...conditions(avenants[avenants.length - 1]) } : c;
}

function sauverVersion() {
  const v = versions[versionActive];
  if (!v) return;
  CHAMPS_SIMPLES.forEach((k) => (v[k] = formContrat.elements[k].value.trim()));
  v.horaires_scolaire = lireHoraires("scolaire");
  v.horaires_vacances = $("#vacances-differentes").checked ? lireHoraires("vacances") : {};
  if (versionActive) { v.date = $("#avenant-date").value; v.motif = $("#avenant-motif").value.trim(); }
}

function chargerVersion(i) {
  versionActive = i;
  const v = versions[i];
  CHAMPS_SIMPLES.forEach((k) => {
    const champ = formContrat.elements[k];
    champ.value = v[k] || DEFAUTS_CONTRAT[k] || (champ.tagName === "SELECT" ? champ.options[0].value : "");
  });
  ecrireHoraires("scolaire", v.horaires_scolaire);
  ecrireHoraires("vacances", v.horaires_vacances);
  $("#vacances-differentes").checked = Object.values(v.horaires_vacances || {}).some((x) => x);
  $("#entete-avenant").classList.toggle("cache", !i);
  $("#boutons-avenant").classList.toggle("cache", !i);
  if (i) {
    $("#avenant-date").value = v.date || "";
    $("#avenant-motif").value = v.motif || "";
    const avant = versions[i - 1];
    const changes = MODIFIABLES.filter((k) => !memeValeur(v[k], avant[k])).map((k) => LIBELLES[k]);
    $("#changements-avenant").textContent = changes.length
      ? `Ce qui change par rapport ${i > 1 ? "à l'avenant précédent" : "au contrat initial"} : ${changes.join(", ")}.`
      : "Modifiez ci-dessous les conditions qui changent à partir de cette date.";
  }
  afficherOngletsVersions();
  afficherColonneVacances();
  afficherNetHoraire();
}

function afficherOngletsVersions() {
  const debut = formContrat.elements.debut.value;
  $("#versions-contrat").innerHTML = versions.map((v, i) => `<button type="button" role="tab" data-version="${i}"
      aria-selected="${i === versionActive}" class="${i === versionActive ? "actif" : ""}">
      ${i ? `Avenant ${v.date ? `du ${dateFr(v.date)}` : "(date à choisir)"}` : `Contrat initial${debut ? ` (${dateFr(debut)})` : ""}`}</button>`).join("")
    + `<button type="button" class="ajout" id="ajouter-avenant">+ Ajouter un avenant</button>`;
}

$("#versions-contrat").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  sauverVersion();
  if (b.id === "ajouter-avenant") {
    // Le nouvel avenant part des conditions les plus récentes : on ne modifie que ce qui change.
    versions.push({ ...conditions(versions[versions.length - 1]), id: "", date: "", motif: "" });
    chargerVersion(versions.length - 1);
    $("#avenant-date").focus();
  } else chargerVersion(+b.dataset.version);
});
$("#avenant-date").addEventListener("change", () => { sauverVersion(); afficherOngletsVersions(); });
$("#supprimer-avenant").addEventListener("click", () => {
  if (!confirm("Supprimer cet avenant ? Les conditions précédentes s'appliqueront de nouveau.")) return;
  versions.splice(versionActive, 1);
  chargerVersion(Math.min(versionActive, versions.length - 1));
});

// --- valeurs déjà connues proposées pendant la saisie
const options = (valeurs) => [...new Set(valeurs.filter(Boolean))].map((v) => `<option value="${echapper(v)}">`).join("");
const texteParent = (p) => [p.civilite, p.prenom, p.nom].filter(Boolean).join(" ");
const formFamille = $("#form-famille");
let familles = [];
let familleEditee = null;
// Nom affiché d'une famille : celui du parent qui gère le contrat (le « nom » enregistré reste celui du
// dossier des bulletins, qui sert à les relier).
const nomFamille = (f) => f?.parent1_nom || f?.nom || "";

async function chargerSuggestions() {
  suggestions = await api("suggestions").catch(() => ({ familles: [], champs: {} }));
  // Fiche famille : noms des parents lus dans les bulletins, avec la famille et les enfants en indication.
  $("#liste-parents-bulletins").innerHTML = suggestions.familles.flatMap((f) => f.parents.map((p) =>
    `<option value="${echapper(p.nom)}">${echapper([texteParent(p), f.enfants.join(", ")].filter(Boolean).join(" · "))}</option>`)).join("");
  $("#liste-tarifs").innerHTML = options(suggestions.champs.tarif_horaire || []);
  $("#liste-entretiens").innerHTML = options(suggestions.champs.entretien_jour || []);
  $("#liste-repas").innerHTML = options(suggestions.champs.repas_jour || []);
  $("#liste-villes").innerHTML = options(familles.map((f) => f.ville));
  return suggestions;
}
const suggestionFamille = (nom) => suggestions.familles.find((x) => x.nom.toLowerCase() === (nom || "").trim().toLowerCase());

// Fiche enfant : prénoms connus pour la famille choisie ; nom prérempli avec le seul nom de la famille.
function proposerSelonFamille() {
  const cle = formContrat.elements.famille.value;
  const f = familles.find((x) => x.nom === cle);
  $("#liste-prenoms").innerHTML = options(suggestionFamille(cle)?.enfants || []);
  $("#liste-noms").innerHTML = options([nomFamille(f), ...(suggestions.champs.enfant_nom || [])]);
  if (f && !formContrat.elements.enfant_nom.value) formContrat.elements.enfant_nom.value = nomFamille(f);
}
formContrat.elements.famille.addEventListener("change", () => {
  formContrat.elements.enfant_nom.value = "";
  proposerSelonFamille();
});

// Fiche famille : un parent des bulletins complète prénom et civilité (et le 2e parent s'il est connu).
function completerFamille(cleDossier) {
  const nom = (formFamille.elements.parent1_nom.value || "").trim().toLowerCase();
  const f = cleDossier ? suggestionFamille(cleDossier)
    : suggestions.familles.find((x) => x.parents.some((p) => p.nom.toLowerCase() === nom));
  if (!f) return;
  f.parents.slice(0, 2).forEach((p, i) => {
    const n = i + 1;
    if (n === 1 && formFamille.elements.parent1_prenom.value) return;
    if (n === 2 && (formFamille.elements.parent2_nom.value || formFamille.elements.parent2_prenom.value)) return;
    formFamille.elements[`parent${n}_civilite`].value = p.civilite || "";
    formFamille.elements[`parent${n}_prenom`].value = p.prenom || "";
    formFamille.elements[`parent${n}_nom`].value = p.nom || "";
  });
}
formFamille.elements.parent1_nom.addEventListener("change", () => completerFamille());

// --- familles et leurs enfants
function carteEnfant(c, aujourdhui) {
  const b = document.createElement("button");
  const termine = c.fin && c.fin < aujourdhui;
  const v = enVigueur(c, aujourdhui);
  const semaine = resumeSemaine(v.horaires_scolaire || {});
  const nb = (c.avenants || []).length;
  b.className = "carte-contrat" + (termine ? " termine" : "");
  b.innerHTML = `<span class="nom">${echapper(c.enfant_prenom)} ${echapper(c.enfant_nom || "")}</span>
    <span class="petit">${c.debut ? `Depuis le ${dateFr(c.debut)}` : "Date de début à compléter"}${termine ? " · terminé" : ""}</span>
    <span class="petit">${v.semaines || 52} semaines par an · ${v.accueil === "periscolaire" ? "périscolaire" : "journée"}${
      semaine ? ` · ${heuresFr(semaine.total)} par semaine (${semaine.jours.map((j) => j.slice(0, 3) + ".").join(" ")})` : ""}</span>
    ${nb ? `<span class="petit">${nb} avenant${nb > 1 ? "s" : ""}</span>` : ""}`;
  b.addEventListener("click", () => editerContrat(c));
  return b;
}

function coordonnees(f) {
  const lignes = [];
  const adresse = [f.adresse, [f.code_postal, f.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (adresse) lignes.push(`<span>${echapper(adresse)}</span>`);
  if (f.telephone) lignes.push(`<a href="tel:${echapper(f.telephone.replace(/\s/g, ""))}">${echapper(f.telephone)}</a>`);
  if (f.email) lignes.push(`<a href="mailto:${echapper(f.email)}">${echapper(f.email)}</a>`);
  if (f.numero_pajemploi) lignes.push(`<span>N° Pajemploi ${echapper(f.numero_pajemploi)}</span>`);
  return lignes.length ? `<p class="coordonnees">${lignes.join("")}</p>` : "";
}

async function afficherContrats() {
  const [liste, fams] = await Promise.all([api("contrats").catch(() => []), api("familles").catch(() => [])]);
  familles = fams;
  await chargerSuggestions();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const zone = $("#liste-familles-contrats");
  // Les formulaires sont rangés à leur place d'origine avant de redessiner la liste.
  zone.before(formFamille);
  zone.after(formContrat);
  zone.innerHTML = familles.length ? "" : `<p class="vide-classeur">Aucune famille pour l'instant : commencez par « Ajouter une famille ».</p>`;
  familles.forEach((f) => {
    const enfants = liste.filter((c) => (c.famille || "").trim().toLowerCase() === f.nom.toLowerCase());
    const bloc = document.createElement("section");
    bloc.className = "panneau famille";
    bloc.dataset.famille = f.nom;
    const parents = [1, 2].map((n) => [f[`parent${n}_civilite`], f[`parent${n}_prenom`], f[`parent${n}_nom`]].filter(Boolean).join(" ")).filter(Boolean);
    bloc.innerHTML = `<div class="titre-panneau"><h2>Famille ${echapper(nomFamille(f))}</h2>
        <div class="boutons-famille"><button class="secondaire" data-modifier>${f.id ? "Modifier la famille" : "Compléter la fiche famille"}</button>
        <button class="principal" data-enfant>Ajouter un enfant</button></div></div>
      <p class="petit">${echapper(parents.join(" et ") || "Parents à compléter")}${f.id ? "" : " · fiche famille à compléter"}</p>
      ${coordonnees(f)}
      <div class="cartes-contrats"></div>`;
    enfants.forEach((c) => bloc.querySelector(".cartes-contrats").appendChild(carteEnfant(c, aujourdhui)));
    if (!enfants.length) bloc.querySelector(".cartes-contrats").innerHTML = `<p class="petit">Aucun enfant pour l'instant.</p>`;
    bloc.querySelector("[data-modifier]").addEventListener("click", () => editerFamille(f));
    bloc.querySelector("[data-enfant]").addEventListener("click", () => demarrerAssistant(f.nom));
    zone.appendChild(bloc);
  });
  // Familles des bulletins qui n'ont pas encore de fiche : création en un clic.
  const connues = new Set(familles.map((f) => f.nom.toLowerCase()));
  const nouvelles = suggestions.familles.filter((f) => !connues.has(f.nom.toLowerCase()));
  $("#familles-a-creer").classList.toggle("cache", !nouvelles.length);
  $("#familles-a-creer").innerHTML = nouvelles.length ? `<h2>Familles trouvées dans vos bulletins</h2>
    <p class="petit">Elles n'ont pas encore de fiche : un clic la prépare avec le nom du parent employeur lu sur le bulletin.</p>
    <div class="boutons">${nouvelles.map((f, i) => `<button class="secondaire" data-nouvelle="${i}">+ ${echapper(f.nom)}${
      f.parents[0] ? ` (${echapper(texteParent(f.parents[0]))})` : ""}</button>`).join("")}</div>` : "";
  $$("#familles-a-creer [data-nouvelle]").forEach((b) => b.addEventListener("click", () => {
    const nom = nouvelles[+b.dataset.nouvelle].nom;
    editerFamille({ id: "", nom });
    completerFamille(nom);
  }));
  appliquerFiltres();
  return liste;
}

// Les formulaires s'ouvrent juste sous la famille concernée (en haut de la liste pour une nouvelle famille).
function placerSous(formulaire, cleFamille) {
  const bloc = $$("#liste-familles-contrats > section.famille").find((b) => b.dataset.famille === cleFamille);
  if (bloc) bloc.after(formulaire); else $("#liste-familles-contrats").before(formulaire);
}

function editerFamille(f) {
  familleEditee = f;
  formContrat.classList.add("cache");
  formFamille.reset();
  for (const champ of formFamille.elements) if (champ.name) champ.value = f?.[champ.name] ?? "";
  if (f && !f.id) completerFamille(f.nom);     // famille sans fiche : parents lus sur les bulletins
  $("#titre-form-famille").textContent = f ? `Famille ${nomFamille(f)}` : "Nouvelle famille";
  // Le nom enregistré relie la famille au dossier de ses bulletins : on l'indique s'il diffère.
  const dossier = f?.nom && f.nom !== nomFamille(f) ? f.nom : "";
  $("#dossier-famille").textContent = dossier ? `Bulletins rangés dans le dossier « ${dossier} ».` : "";
  $("#dossier-famille").classList.toggle("cache", !dossier);
  placerSous(formFamille, f?.nom);
  $("#supprimer-famille").classList.toggle("cache", !f?.id);
  formFamille.classList.remove("cache");
  formFamille.scrollIntoView({ behavior: "smooth" });
}
$("#nouvelle-famille").addEventListener("click", () => editerFamille(null));
$("#annuler-famille").addEventListener("click", () => formFamille.classList.add("cache"));
$("#supprimer-famille").addEventListener("click", async () => {
  if (!familleEditee?.id || !confirm(`Supprimer la fiche de la famille ${nomFamille(familleEditee)} ?`)) return;
  try { await api("familles/supprimer", { id: familleEditee.id }); } catch (err) { alert(err.message); return; }
  formFamille.classList.add("cache");
  afficherContrats();
});
formFamille.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries([...formFamille.elements].filter((c) => c.name).map((c) => [c.name, c.value]));
  d.id = familleEditee?.id || "";
  // Famille existante : son nom (lien avec le dossier des bulletins) ne change pas.
  d.nom = familleEditee?.nom || "";
  try { await api("familles", d); } catch (err) { alert(err.message); return; }
  formFamille.classList.add("cache");
  afficherContrats();
});

const NOUVELLE_FAMILLE = "__nouvelle";

function editerContrat(c, famille, assistant = false) {
  contratEdite = c;
  formFamille.classList.add("cache");
  formContrat.reset();
  formContrat.elements.famille.innerHTML = familles.map((f) => `<option value="${echapper(f.nom)}">${
    echapper([nomFamille(f), f.parent1_prenom && `(${f.parent1_prenom})`].filter(Boolean).join(" "))}</option>`).join("")
    + (assistant ? `<option value="${NOUVELLE_FAMILLE}">Nouvelle famille…</option>` : "");
  for (const champ of formContrat.elements) {
    if (!champ.name || MODIFIABLES.includes(champ.name) || champ.name.startsWith("f_")) continue;
    champ.value = c?.[champ.name] || DEFAUTS_CONTRAT[champ.name] || (champ.tagName === "SELECT" ? champ.options[0]?.value ?? "" : "");
  }
  ecrireFeries(c?.feries_travailles);
  $("#contrat-cree").textContent = "";
  if (!c && famille) formContrat.elements.famille.value = famille;
  versions = [conditions(c), ...(c?.avenants || []).map((a) => ({ ...conditions(a), id: a.id, date: a.date, motif: a.motif }))];
  chargerVersion(0);
  proposerSelonFamille();
  const fam = familles.find((f) => f.nom === (c?.famille || famille));
  $("#titre-form-contrat").textContent = c ? `${c.enfant_prenom} ${c.enfant_nom || ""}` : `Nouvel enfant${fam ? ` · famille ${nomFamille(fam)}` : ""}`;
  $("#supprimer-contrat").classList.toggle("cache", !c);
  $("#pdf-contrat").classList.toggle("cache", !c);
  modeAssistant(assistant);
  formContrat.classList.remove("cache");
  if (assistant) {
    remplirEmployeur();
    if (!formContrat.elements.signature_lieu.value) formContrat.elements.signature_lieu.value = profilConnu.ville || "";
    allerEtape(0);
  } else {
    placerSous(formContrat, c?.famille || famille);
    formContrat.scrollIntoView({ behavior: "smooth" });
  }
}

// --- assistant « Ajouter un enfant » : tout le contrat de travail, en plein écran, une étape à la fois
const etapes = () => $$("#form-contrat [data-etape]");
let etapeActive = 0;
let profilConnu = {};
// Rubriques du profil reprises dans le contrat (même liste que contrat_travail.REQUIS_PROFIL).
const PROFIL_CONTRAT = { nom: "nom", prenom: "prénom", adresse: "adresse", code_postal: "code postal", ville: "ville",
  numero_secu: "n° de Sécurité sociale", agrement_numero: "référence de l'agrément", agrement_debut: "date de l'agrément",
  assurance_rc_compagnie: "assurance responsabilité civile professionnelle" };

function modeAssistant(actif) {
  formContrat.classList.toggle("assistant", actif);
  document.body.classList.toggle("assistant-ouvert", actif);
  $("#assistant-fin").classList.add("cache");
  $("#assistant-nav").classList.remove("cache");
  $("#assistant-quitter").classList.remove("cache");
  // Dans l'assistant, toutes les informations du contrat de travail sont demandées.
  $$("#form-contrat [data-requis]").forEach((c) => (c.required = actif));
  formContrat.querySelectorAll(".mention").forEach((m) => m.remove());
  marquerChamps(formContrat);
}

function allerEtape(n) {
  const liste = etapes();
  etapeActive = Math.max(0, Math.min(n, liste.length - 1));
  liste.forEach((e, i) => e.classList.toggle("etape-active", i === etapeActive));
  const reste = liste.length - 1 - etapeActive;
  $("#assistant-etape").textContent = `Étape ${etapeActive + 1} sur ${liste.length} · ${
    reste ? `encore ${reste} étape${reste > 1 ? "s" : ""} après celle-ci` : "dernière étape"}`;
  $("#assistant-titre").textContent = liste[etapeActive].dataset.titre;
  $("#assistant-barre").style.width = `${Math.round(100 * (etapeActive + 1) / liste.length)}%`;
  $("#assistant-plan").innerHTML = liste.map((e, i) => `<li class="${i < etapeActive ? "faite" : i === etapeActive ? "active" : ""}">${
    echapper(e.dataset.titre)}</li>`).join("");
  $("#assistant-precedent").classList.toggle("invisible", !etapeActive);
  $("#assistant-suivant").textContent = reste ? "Suivant" : "Enregistrer la fiche";
  if (liste[etapeActive].dataset.etape === "signature") afficherRecapitulatif();
  if (liste[etapeActive].dataset.etape === "remuneration") afficherResume();
  formContrat.scrollTo(0, 0);
  liste[etapeActive].querySelector("input:not([type=checkbox]), select, textarea")?.focus({ preventScroll: true });
}

function etapeValide(el) {
  const invalide = [...el.querySelectorAll("input, select, textarea")].find((c) => c.offsetParent !== null && !c.checkValidity());
  if (invalide) { invalide.reportValidity(); return false; }
  if (el.dataset.etape === "horaires" && formContrat.elements.planning.value !== "oui" && !resumeSemaine(lireHoraires("scolaire"))) {
    alert("Indiquez l'emploi du temps de l'enfant : heure d'arrivée et heure de départ des jours d'accueil.");
    return false;
  }
  return true;
}

$("#assistant-suivant").addEventListener("click", () => {
  if (!etapeValide(etapes()[etapeActive])) return;
  if (etapeActive === etapes().length - 1) formContrat.requestSubmit();
  else allerEtape(etapeActive + 1);
});
$("#assistant-precedent").addEventListener("click", () => allerEtape(etapeActive - 1));
$("#assistant-quitter").addEventListener("click", () => {
  if (!$("#assistant-fin").classList.contains("cache") || confirm("Quitter sans enregistrer ? Les informations saisies seront perdues.")) fermerContrat();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && formContrat.classList.contains("assistant")) $("#assistant-quitter").click();
});

function fermerContrat() {
  formContrat.classList.add("cache");
  modeAssistant(false);
}

// Étape « parent employeur » : reprise de la fiche famille choisie (vide pour une nouvelle famille).
function remplirEmployeur() {
  const f = familles.find((x) => x.nom === formContrat.elements.famille.value) || {};
  for (const champ of formContrat.elements)
    if (champ.name?.startsWith("f_")) champ.value = f[champ.name.slice(2)] || "";
  $("#qualite-autre").classList.toggle("cache", formContrat.elements.f_parent1_qualite.value !== "autre");
}
formContrat.elements.famille.addEventListener("change", () => { if (formContrat.classList.contains("assistant")) remplirEmployeur(); });
formContrat.elements.f_parent1_qualite.addEventListener("change", (e) => $("#qualite-autre").classList.toggle("cache", e.target.value !== "autre"));
formContrat.elements.f_parent1_nom.addEventListener("change", () => {
  // Nouvelle famille : le nom de l'enfant reprend celui du parent s'il est encore vide.
  if (!formContrat.elements.enfant_nom.value) formContrat.elements.enfant_nom.value = formContrat.elements.f_parent1_nom.value;
});

function afficherRecapitulatif() {
  const el = formContrat.elements;
  const h = resumeSemaine(lireHoraires("scolaire"));
  const manquants = Object.entries(PROFIL_CONTRAT).filter(([k]) => !(profilConnu[k] || "").trim()).map(([, l]) => l);
  $("#recapitulatif").innerHTML = `<h3 class="sous-titre">Récapitulatif</h3>
    <ul class="recap">
      <li><strong>${echapper(el.enfant_prenom.value)} ${echapper(el.enfant_nom.value)}</strong>, accueilli${el.enfant_genre.value === "fille" ? "e" : ""}
        à partir du ${dateFr(el.debut.value)}${el.essai.value ? `, période d'essai de ${echapper(el.essai.value)}` : ""}</li>
      <li>Employeur : ${echapper([el.f_parent1_civilite.value, el.f_parent1_prenom.value, el.f_parent1_nom.value].filter(Boolean).join(" "))}</li>
      <li>${el.semaines.value} semaines par an${h ? `, ${heuresFr(h.total)} par semaine sur ${h.jours.length} jour${h.jours.length > 1 ? "s" : ""}` : ""}</li>
      <li>${el.tarif_horaire.value ? `${echapper(el.tarif_horaire.value)} € brut de l'heure` : "Tarif à compléter"}${
        el.entretien_jour.value ? `, entretien ${echapper(el.entretien_jour.value)} € par jour` : ""}, salaire versé le ${echapper(el.jour_paiement.value)} du mois</li>
    </ul>
    ${manquants.length ? `<p class="alerte-texte">Votre profil ne contient pas encore : ${manquants.join(", ")}. Ces rubriques
      resteront vides dans le contrat ; vous pourrez les compléter dans « Mon profil » puis recréer le PDF.</p>` : ""}
    <p class="petit">Après l'enregistrement, vous pourrez créer le contrat de travail en PDF, sur le modèle officiel de l'Urssaf.</p>`;
}

async function demarrerAssistant(famille) {
  profilConnu = await api("profil").catch(() => ({}));
  editerContrat(null, famille, true);
}
$("#nouvel-enfant").addEventListener("click", async () => { await afficherContrats(); demarrerAssistant(""); });

// Contrat de travail en PDF : résultat affiché avec un lien pour l'ouvrir.
async function creerContratTravail(contratId, zone) {
  zone.innerHTML = `<p class="petit">Création du contrat…</p>`;
  try {
    const r = await api("contrat-travail", { contrat_id: contratId || "" });
    zone.innerHTML = `<p>Contrat enregistré : ${echapper(r.chemin)} <button type="button" class="lien" data-ouvrir-pdf>Ouvrir</button></p>
      ${r.manquants.length ? `<p class="alerte-texte">Rubriques laissées vides (à compléter dans le PDF, ou dans les fiches avant de le recréer) :
        ${r.manquants.map(echapper).join(", ")}.</p>` : ""}`;
    zone.querySelector("[data-ouvrir-pdf]").addEventListener("click", () => api("ouvrir", { quoi: r.chemin }).catch((err) => alert(err.message)));
  } catch (err) { zone.innerHTML = `<p class="alerte-texte">${echapper(err.message)}</p>`; }
}

formContrat.elements.debut.addEventListener("change", () => { afficherOngletsVersions(); calculerAdaptation(); });
$("#annuler-contrat").addEventListener("click", fermerContrat);
$("#supprimer-contrat").addEventListener("click", async () => {
  if (!contratEdite || !confirm(`Supprimer la fiche de ${contratEdite.enfant_prenom} ?`)) return;
  await api("contrats/supprimer", { id: contratEdite.id });
  fermerContrat();
  afficherContrats();
});
let pdfApresEnregistrement = false;
$("#pdf-contrat").addEventListener("click", () => { pdfApresEnregistrement = true; formContrat.requestSubmit(); });

formContrat.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pdf = pdfApresEnregistrement;
  pdfApresEnregistrement = false;
  const assistant = formContrat.classList.contains("assistant");
  sauverVersion();
  const d = { id: contratEdite?.id, ...versions[0], avenants: versions.slice(1) };
  for (const champ of formContrat.elements)
    if (champ.name && !MODIFIABLES.includes(champ.name) && !champ.name.startsWith("f_")) d[champ.name] = champ.value;
  d.feries_travailles = lireFeries();
  const sansDate = d.avenants.findIndex((a) => !a.date);
  const tropTot = d.avenants.findIndex((a) => d.debut && a.date && a.date <= d.debut);
  if (sansDate >= 0 || tropTot >= 0) {
    chargerVersion((sansDate >= 0 ? sansDate : tropTot) + 1);
    alert(sansDate >= 0 ? "Indiquez la date d'effet de l'avenant." : "La date d'effet de l'avenant doit être après le début de l'accueil.");
    $("#avenant-date").focus();
    return;
  }
  let enregistre;
  try {
    if (assistant) {
      // La fiche famille est créée ou mise à jour avec les informations du parent employeur.
      const avant = familles.find((x) => x.nom === d.famille);
      const f = { ...(avant || {}), id: avant?.id || "", nom: avant?.nom || "" };
      for (const champ of formContrat.elements) if (champ.name?.startsWith("f_")) f[champ.name.slice(2)] = champ.value.trim();
      if (!avant?.id || Object.keys(f).some((k) => (f[k] ?? "") !== (avant[k] ?? ""))) d.famille = (await api("familles", f)).nom;
    }
    enregistre = await api("contrats", d);
  } catch (err) { alert(err.message); return; }
  const liste = afficherContrats();
  if (assistant) {
    // Fin de l'assistant : proposition de créer le contrat de travail tout de suite.
    etapes().forEach((x) => x.classList.remove("etape-active"));
    $("#assistant-etape").textContent = "Terminé";
    $("#assistant-titre").textContent = `La fiche de ${enregistre.enfant_prenom} est enregistrée`;
    $("#assistant-barre").style.width = "100%";
    $("#assistant-plan").innerHTML = "";
    const fin = $("#assistant-fin");
    fin.innerHTML = `<p>Toutes les informations du contrat sont enregistrées. Vous pouvez maintenant créer le contrat de travail,
      rempli sur le modèle officiel de l'Urssaf, à imprimer en deux exemplaires et à signer avec la famille.</p>
      <div class="boutons"><button type="button" class="principal" data-creer>Créer le contrat de travail (PDF)</button>
      <button type="button" class="secondaire" data-fermer>Fermer</button></div><div data-resultat role="status"></div>`;
    fin.classList.remove("cache");
    fin.querySelector("[data-creer]").addEventListener("click", () => creerContratTravail(enregistre.id, fin.querySelector("[data-resultat]")));
    fin.querySelector("[data-fermer]").addEventListener("click", fermerContrat);
    $("#assistant-nav").classList.add("cache");
    $("#assistant-quitter").classList.add("cache");
    return;
  }
  fermerContrat();
  if (pdf) {
    await liste;
    const zone = $("#message-contrats");
    zone.classList.remove("cache");
    await creerContratTravail(enregistre.id, zone);
    zone.scrollIntoView({ behavior: "smooth" });
  }
});

// ------------------------------------------------------------- mon profil
const formProfil = $("#form-profil");
async function chargerProfil() {
  const p = await api("profil").catch(() => ({}));
  for (const [cle, val] of Object.entries(p)) if (formProfil.elements[cle]) formProfil.elements[cle].value = val ?? "";
  return p;
}
formProfil.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries([...formProfil.elements].filter((c) => c.name).map((c) => [c.name, c.value]));
  await api("profil", d).catch((err) => alert(err.message));
  $("#profil-enregistre").textContent = "Profil enregistré.";
  setTimeout(() => ($("#profil-enregistre").textContent = ""), 3000);
});

// ------------------------------------------------------------- courriers
const formDerog = $("#form-derogation");
const formTexte = $("#form-texte");
let propositionCourrier = null;
let contratsCourrier = [];

// Modèles de courriers : un seul formulaire affiché à la fois.
const formContratTravail = $("#form-contrat-travail");
function choisirModele(nom) {
  $$("#courriers .modele[data-modele]").forEach((b) => b.classList.toggle("actif", b.dataset.modele === nom));
  $$("#courriers [data-courrier]").forEach((f) => f.classList.toggle("cache", f.dataset.courrier !== nom));
  const derogation = nom === "derogation";
  $("#manquants").classList.toggle("cache", !derogation || !$("#manquants").innerHTML.trim());
  formTexte.classList.toggle("cache", !derogation || !propositionCourrier);
}
$$("#courriers .modele[data-modele]").forEach((b) => b.addEventListener("click", () => choisirModele(b.dataset.modele)));

function expliquerContratTravail() {
  $("#explication-contrat-travail").textContent = formContratTravail.elements.contrat_id.value
    ? "Version complète : tout est rempli d'après votre profil, la fiche de la famille et celle de l'enfant (conditions du début du contrat)."
    : "Version à remplir : seules vos informations (identité, agrément, assurances, lieu d'accueil) sont remplies ; le reste se complète avec la famille.";
}
formContratTravail.elements.contrat_id.addEventListener("change", expliquerContratTravail);
formContratTravail.addEventListener("submit", (e) => {
  e.preventDefault();
  creerContratTravail(formContratTravail.elements.contrat_id.value, $("#resultat-contrat-travail"));
});

async function preparerCourriers() {
  contratsCourrier = await api("contrats").catch(() => []);
  const choixContrat = formContratTravail.elements.contrat_id;
  const actuelContrat = choixContrat.value;
  choixContrat.innerHTML = `<option value="">Aucun : version à remplir avec la famille</option>` + contratsCourrier.map((c) =>
    `<option value="${c.id}">${echapper(c.enfant_prenom)} ${echapper(c.enfant_nom || "")} (famille ${echapper(c.famille)}) : version complète</option>`).join("");
  choixContrat.value = actuelContrat;
  expliquerContratTravail();
  const choix = formDerog.elements.contrat_id;
  const actuel = choix.value;
  choix.innerHTML = contratsCourrier.length
    ? contratsCourrier.map((c) => `<option value="${c.id}">${echapper(c.enfant_prenom)} ${echapper(c.enfant_nom || "")} (famille ${echapper(c.famille)})</option>`).join("")
    : `<option value="">Aucune fiche contrat : ajoutez d'abord l'enfant dans Contrats</option>`;
  if (actuel) choix.value = actuel;
  if (!formDerog.elements.date_courrier.value) formDerog.elements.date_courrier.value = new Date().toISOString().slice(0, 10);
}

$("#jusqua-6-ans").addEventListener("click", () => {
  const c = contratsCourrier.find((x) => x.id === formDerog.elements.contrat_id.value);
  if (!c?.enfant_naissance) { alert("Indiquez d'abord la date de naissance de l'enfant dans sa fiche contrat."); return; }
  const n = new Date(c.enfant_naissance + "T12:00:00");
  n.setFullYear(n.getFullYear() + 6);
  formDerog.elements.date_fin.value = n.toISOString().slice(0, 10);
});

const CHAMPS_TEXTE = ["entete", "lieu_date", "objet", "destinataire", "corps", "suite", "annexe_intro", "conclusion", "signature"];

function texteCourrier() {
  const t = { ...propositionCourrier };
  CHAMPS_TEXTE.forEach((k) => (t[k] = formTexte.elements[k].value));
  t.periodes = formTexte.elements.periodes.value.split("\n").map((l) => l.trim()).filter(Boolean);
  const c = contratsCourrier.find((x) => x.id === formDerog.elements.contrat_id.value);
  t.enfant = c?.enfant_prenom || "";
  return t;
}

let minuterieApercu = null;
async function rafraichirApercu() {
  const r = await fetch("/api/courriers/apercu", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(texteCourrier()) });
  $("#apercu-courrier").srcdoc = await r.text();
}
formTexte.addEventListener("input", () => { clearTimeout(minuterieApercu); minuterieApercu = setTimeout(rafraichirApercu, 400); });

formDerog.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries([...formDerog.elements].filter((c) => c.name).map((c) => [c.name, c.value]));
  const bouton = formDerog.querySelector("button.principal");
  bouton.disabled = true; bouton.textContent = "Préparation…";
  const r = await api("courriers/derogation", d).catch((err) => ({ erreur: err.message }));
  bouton.disabled = false; bouton.textContent = "Préparer le courrier";
  const zone = $("#manquants");
  if (r.erreur) { zone.innerHTML = `<p>${echapper(r.erreur)}</p>`; zone.classList.remove("cache"); return; }
  zone.classList.toggle("cache", !r.manquants.length);
  zone.innerHTML = r.manquants.length ? `<strong>Informations à compléter pour un courrier complet :</strong>
    <ul>${r.manquants.map((m) => `<li>${echapper(m)}</li>`).join("")}</ul>
    <div class="boutons"><button class="secondaire" data-aller-vers="profil">Mon profil</button>
    <button class="secondaire" data-aller-vers="contrats">Contrats</button></div>` : "";
  zone.querySelectorAll("[data-aller-vers]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerVers)));
  propositionCourrier = r.proposition;
  CHAMPS_TEXTE.forEach((k) => (formTexte.elements[k].value = r.proposition[k] || ""));
  formTexte.elements.periodes.value = (r.proposition.periodes || []).join("\n");
  $("#source-periodes").textContent = { calendrier: "(vacances de votre zone, calendrier de l'Éducation nationale)",
    aucune: "(calendrier indisponible ou zone non renseignée dans Mon profil : saisissez-les)" }[r.source_periodes] || "";
  $("#pdf-cree").textContent = "";
  formTexte.classList.remove("cache");
  await rafraichirApercu();
  formTexte.scrollIntoView({ behavior: "smooth" });
});

formTexte.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bouton = formTexte.querySelector("button.principal");
  bouton.disabled = true; bouton.textContent = "Création du PDF…";
  try {
    const r = await api("courriers/pdf", texteCourrier());
    $("#pdf-cree").innerHTML = `PDF enregistré : ${echapper(r.chemin)} <button type="button" class="lien" id="ouvrir-pdf">Ouvrir</button>`;
    $("#ouvrir-pdf").addEventListener("click", () => api("ouvrir", { quoi: r.chemin }).catch((err) => alert(err.message)));
  } catch (err) { alert(err.message); }
  bouton.disabled = false; bouton.textContent = "Créer le PDF";
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

chargerParametres().then(afficherTableauDeBord);
afficherNotes();
afficherBaremes();
verifierVersion();
rafraichir();
const minuterieEtat = setInterval(rafraichir, 1500);
