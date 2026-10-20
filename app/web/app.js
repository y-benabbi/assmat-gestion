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
  if (r && r.illisibles.length)
    aFaire.push({ couleur: "erreur", texte: `${r.illisibles.length} bulletin${r.illisibles.length > 1 ? "s" : ""} dont les montants n'ont pas pu être lus.`, aller: "revenus", bouton: "Voir" });
  ech.filter((e) => e.urgent).forEach((e) => aFaire.push({ couleur: "attente", texte: `${dateFr(e.date)} : ${e.titre}.`, aller: "echeances", bouton: "Voir" }));
  if (modules.contrats !== false && !contrats.length)
    aFaire.push({ couleur: "", texte: "Ajoutez une fiche par enfant accueilli (dates, emploi du temps).", aller: "contrats", bouton: "Contrats" });
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
  $("#echeances-accueil").innerHTML = ech.length ? ech.slice(0, 4).map(ligneEcheance).join("")
    : `<li class="petit">Aucune échéance connue : complétez Mon profil et les contrats.</li>`;
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
  $("#illisibles").textContent = r.illisibles.length
    ? `Montants non lus pour : ${r.illisibles.map((f) => f.split(/[\\/]/).pop()).join(", ")}.` : "";
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
  const quand = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "");
  return `<li class="${e.urgent ? "urgent" : ""}"><span class="quand">${quand}</span>
    <span>${echapper(e.titre)}${e.detail ? `<span class="detail">${echapper(e.detail)}</span>` : ""}</span></li>`;
}

async function afficherEcheances() {
  const ech = await api("echeances").catch(() => []);
  $("#liste-echeances").innerHTML = ech.length ? ech.map(ligneEcheance).join("")
    : `<li class="petit">Aucune échéance connue pour l'instant.</li>`;
}

// ------------------------------------------------------------- contrats
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const formContrat = $("#form-contrat");
let contratEdite = null;

// Une ligne par jour ; la colonne « vacances » n'apparaît que si la case « différent » est cochée.
$("#horaires-contrat").innerHTML = `<thead><tr><th scope="col">Jour</th><th scope="col">Période scolaire</th>
  <th scope="col" class="col-vacances">Vacances scolaires</th></tr></thead>
  <tbody>${JOURS.map((j) => `<tr><th scope="row">${j.charAt(0).toUpperCase() + j.slice(1)}</th>
    <td><input name="horaires_scolaire.${j}" aria-label="Période scolaire, ${j}" placeholder="—"></td>
    <td class="col-vacances"><input name="horaires_vacances.${j}" aria-label="Vacances scolaires, ${j}" placeholder="—"></td></tr>`).join("")}</tbody>`;

function afficherColonneVacances() {
  $("#horaires-contrat").classList.toggle("sans-vacances", !$("#vacances-differentes").checked);
}
$("#vacances-differentes").addEventListener("change", afficherColonneVacances);

async function afficherContrats() {
  const liste = await api("contrats").catch(() => []);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  $("#liste-contrats").innerHTML = liste.length ? "" : `<p class="vide-classeur">Aucune fiche pour l'instant.</p>`;
  liste.forEach((c) => {
    const b = document.createElement("button");
    const termine = c.fin && c.fin < aujourdhui;
    b.className = "carte-contrat" + (termine ? " termine" : "");
    const jours = JOURS.filter((j) => c.horaires_scolaire?.[j]).map((j) => j.slice(0, 3) + ".").join(" ");
    b.innerHTML = `<span class="nom">${echapper(c.enfant_prenom)} ${echapper(c.enfant_nom || "")}</span>
      <span class="petit">Famille ${echapper(c.famille)}${c.debut ? ` · depuis ${dateFr(c.debut)}` : ""}${termine ? " · terminé" : ""}</span>
      <span class="petit">${c.semaines === "52" ? "52 semaines" : "46 semaines ou moins"} · ${c.accueil === "periscolaire" ? "périscolaire" : "journée"}${jours ? ` · ${jours}` : ""}</span>`;
    b.addEventListener("click", () => editerContrat(c));
    $("#liste-contrats").appendChild(b);
  });
  return liste;
}

function editerContrat(c) {
  contratEdite = c;
  formContrat.reset();
  for (const champ of formContrat.elements) {
    if (!champ.name) continue;
    const [cle, jour] = champ.name.split(".");
    champ.value = (jour ? c?.[cle]?.[jour] : c?.[cle]) ?? (champ.tagName === "SELECT" ? champ.options[0].value : "");
  }
  $("#vacances-differentes").checked = Object.values(c?.horaires_vacances || {}).some((v) => v);
  afficherColonneVacances();
  $("#titre-form-contrat").textContent = c ? `${c.enfant_prenom} ${c.enfant_nom || ""}` : "Nouvel enfant";
  $("#supprimer-contrat").classList.toggle("cache", !c);
  formContrat.classList.remove("cache");
  formContrat.scrollIntoView({ behavior: "smooth" });
}
$("#nouveau-contrat").addEventListener("click", () => editerContrat(null));
$("#annuler-contrat").addEventListener("click", () => formContrat.classList.add("cache"));
$("#supprimer-contrat").addEventListener("click", async () => {
  if (!contratEdite || !confirm(`Supprimer la fiche de ${contratEdite.enfant_prenom} ?`)) return;
  await api("contrats/supprimer", { id: contratEdite.id });
  formContrat.classList.add("cache");
  afficherContrats();
});
formContrat.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = { id: contratEdite?.id, horaires_scolaire: {}, horaires_vacances: {} };
  for (const champ of formContrat.elements) {
    if (!champ.name) continue;
    const [cle, jour] = champ.name.split(".");
    if (jour) d[cle][jour] = champ.value; else d[cle] = champ.value;
  }
  // Case décochée : mêmes horaires qu'en période scolaire.
  if (!$("#vacances-differentes").checked) d.horaires_vacances = {};
  await api("contrats", d).catch((err) => alert(err.message));
  formContrat.classList.add("cache");
  afficherContrats();
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

async function preparerCourriers() {
  contratsCourrier = await api("contrats").catch(() => []);
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
