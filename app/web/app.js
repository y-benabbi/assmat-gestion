const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

async function api(chemin, donnees) {
  const r = await fetch("/api/" + chemin, donnees === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donnees),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.erreur || r.statusText);
  return json;
}

function libelleMois(p) {
  const [a, m] = p.split("-");
  return `${MOIS[+m - 1]} ${a}`;
}

// ------------------------------------------------------------- onglets
function ouvrirOnglet(nom) {
  $$("nav button").forEach((b) => b.classList.toggle("actif", b.dataset.onglet === nom));
  $$(".onglet").forEach((s) => s.classList.toggle("actif", s.id === nom));
  if (nom === "bulletins") afficherListe();
}
$$("nav button").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.onglet)));
$$("[data-aller]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.aller)));
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

  if (etat.bulletins.length) {
    $("#tuile-bulletins").textContent = manquants
      ? `${manquants} bulletin(s) à récupérer.` : "Tous les bulletins sont à jour.";
  }
  $("#journal").textContent = etat.journal.join("\n");
}

// ------------------------------------------------------------- liste
async function afficherListe() {
  const zone = $("#liste");
  const seulementManquants = $("#seulement-manquants").checked;
  if (etat.bulletins.length) {
    const parClient = {};
    etat.bulletins.forEach((b) => (parClient[b.client] ??= []).push(b));
    zone.innerHTML = "";
    Object.keys(parClient).sort().forEach((client) => {
      const liste = parClient[client];
      const manq = liste.filter((b) => !b.present).length;
      if (seulementManquants && !manq) return;
      const bloc = document.createElement("div");
      bloc.className = "client";
      bloc.innerHTML = `<h3>${echapper(client)} <span class="petit">${liste.length} bulletin(s)${manq ? ` — ${manq} manquant(s)` : " — complet"}</span></h3><div class="mois"></div>`;
      const mois = bloc.querySelector(".mois");
      liste.slice().reverse().forEach((b) => {
        if (seulementManquants && b.present) return;
        const s = document.createElement("span");
        s.className = b.present ? "present" : "manquant";
        const plusieurs = liste.filter((x) => x.periode === b.periode).length > 1;
        s.textContent = libelleMois(b.periode) + (plusieurs ? ` · ${b.enfant || b.rang}` : "");
        const detail = `Pajemploi : ${b.employeur}${b.enfant ? ` — enfant : ${b.enfant}` : ""}`;
        s.title = b.present ? `Présent : ${b.fichier_existant}\n${detail}\n(cliquer pour ouvrir)` : `Manquant — sera enregistré ici :\n${b.cible}\n${detail}`;
        if (b.present) s.addEventListener("click", () => api("ouvrir", { quoi: b.fichier_existant }).catch(() => {}));
        mois.appendChild(s);
      });
      zone.appendChild(bloc);
    });
    return;
  }
  // Pas encore d'analyse Pajemploi : montrer ce qu'il y a sur le disque.
  dossierLocal = await api("dossier").catch(() => null);
  if (!dossierLocal || !dossierLocal.configure) {
    zone.innerHTML = `<p class="petit">Choisissez d'abord le dossier des bulletins dans l'onglet <a href="#" id="lien-param">Paramètres</a>.</p>`;
    $("#lien-param").addEventListener("click", (e) => { e.preventDefault(); ouvrirOnglet("parametres"); });
    return;
  }
  const clients = Object.entries(dossierLocal.clients);
  zone.innerHTML = `<p class="petit">Contenu actuel du dossier (sans connexion). Cliquez sur « Vérifier sur Pajemploi » pour trouver les bulletins manquants.</p>`;
  if (!clients.length) zone.innerHTML += `<p class="petit">Aucun bulletin trouvé dans ce dossier.</p>`;
  clients.forEach(([client, periodes]) => {
    const bloc = document.createElement("div");
    bloc.className = "client";
    bloc.innerHTML = `<h3>${echapper(client)} <span class="petit">${periodes.length} mois</span></h3><div class="mois">${
      periodes.slice().reverse().map((p) => `<span class="local">${libelleMois(p)}</span>`).join("")}</div>`;
    zone.appendChild(bloc);
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

async function apercu() {
  const r = await api("apercu-nom", {
    dossier_bulletins: form.elements.dossier_bulletins.value,
    format_fichier: form.elements.format_fichier.value,
    format_dossier: form.elements.format_dossier.value,
  }).catch(() => null);
  if (r) $("#apercu").textContent = r.chemin;
}
["dossier_bulletins", "format_fichier", "format_dossier"].forEach((n) => form.elements[n].addEventListener("input", apercu));

$("#choisir-dossier").addEventListener("click", async () => {
  const r = await api("choisir-dossier", {});
  if (r.chemin) { form.elements.dossier_bulletins.value = r.chemin; apercu(); }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = {};
  for (const champ of form.elements) {
    if (!champ.name) continue;
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
async function verifierVersion() {
  const v = await api("version").catch(() => null);
  if (!v) return;
  $("#version").textContent = v.locale;
  if (v.mise_a_jour) {
    $("#texte-maj").textContent = `Une nouvelle version (${v.distante}) est disponible.`;
    $("#bandeau-maj").classList.remove("cache");
  }
}
$("#btn-maj").addEventListener("click", async () => {
  if (!confirm("L'application va se fermer, se mettre à jour puis se rouvrir. Continuer ?")) return;
  await api("mettre-a-jour", {}).catch((e) => alert(e.message));
  document.body.innerHTML = "<main><p>Mise à jour en cours… L'application se rouvrira automatiquement.</p></main>";
});

chargerParametres();
verifierVersion();
rafraichir();
setInterval(rafraichir, 1500);
