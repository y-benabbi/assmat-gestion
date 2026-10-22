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

// ------------------------------------------------------------- pictogrammes
const PICTOS = {
  chevron: '<path d="M6 9l6 6 6-6"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  recherche: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  avenant: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  modifier: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  ouvrir: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  supprimer: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  enfant: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  famille: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2 20a6 6 0 0 1 12 0M13 20a4.5 4.5 0 0 1 9 0"/>',
  introuvable: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dossier: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  telecharger: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  coche: '<path d="m5 12 5 5 9-10"/>',
  actualiser: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  bulletin: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',
  impots: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2"/>',
  agrement: '<circle cx="12" cy="9" r="5"/><path d="m9 13-2 8 5-3 5 3-2-8"/>',
  assurance: '<path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  anniversaire: '<path d="M4 21h16v-8H4zM4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 .5"/><path d="M12 13V9M12 6.5V5"/>',
  calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  stylo: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  contrat: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 9h4M9 13h7M9 17h3"/><path d="m14 17 1.5 1.5L19 15"/>',
  changement: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  attestation: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/>',
  alerte: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  monter: '<path d="m6 15 6-6 6 6"/>',
  descendre: '<path d="m6 9 6 6 6-6"/>',
  lieu: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  telephone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  courriel: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  numero: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h7M16 9.5v5"/>',
  profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  maison: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  telephone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  courriel: '<path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/>',
  appareil: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  impression: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  annuler: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  activite: '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2 0-1.5-1.2-1.6-1.2-2.8 0-1 .8-1.7 2-1.7H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/>',
};
// Icônes des activités : [clé, nom, mots du titre qui la font proposer, dessin]. Même trait que PICTOS.
const ICONES_ACTIVITES = [
  ["palette", "Arts plastiques", "art bricolage creation", '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2 0-1.5-1.2-1.6-1.2-2.8 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.2-4-7.5-9-7.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>'],
  ["pinceau", "Peinture", "peinture peindre gouache aquarelle pinceau", '<path d="M20 4l-8.5 8.5"/><path d="M11.5 12.5c-2-1.5-5-.5-5.7 2S5 19 3 20c3 1.2 7 1 8.6-1.6 1-1.7.6-3.9-.1-5.9z"/>'],
  ["crayon", "Dessin", "dessin dessiner crayon feutre", '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>'],
  ["ciseaux", "Découpage, collage", "decoupage collage ciseaux coller", '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 18M8.5 16.5 20 6"/>'],
  ["etoile", "Gommettes", "gommette etoile autocollant", '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z"/>'],
  ["rouleau", "Pâte à modeler", "pate modeler sel argile modelage", '<rect x="5" y="5" width="14" height="5" rx="2.5"/><path d="M2 7.5h3M19 7.5h3"/><path d="M4 19c1.5-4 14.5-4 16 0z"/>'],
  ["tampon", "Tampons, empreintes", "tampon empreinte", '<rect x="5" y="15" width="14" height="4" rx="1"/><path d="M8 15v-2h8v2"/><path d="M10 13V7a2 2 0 0 1 4 0v6"/><path d="M4 21h16"/>'],
  ["main", "Peinture au doigt, sensoriel", "doigt main sensoriel toucher", '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 10V3.5a1.5 1.5 0 0 1 3 0V11M14 10V5a1.5 1.5 0 0 1 3 0v8c0 4-2.5 8-7 8-3 0-4.5-2-6-5l-1.5-3a1.5 1.5 0 0 1 2.5-1.5L8 13"/>'],
  ["perles", "Perles, enfilage", "perle enfilage collier", '<path d="M3 6c4 10 14 10 18 0"/><circle cx="6.5" cy="11.5" r="2"/><circle cx="12" cy="13.5" r="2"/><circle cx="17.5" cy="11.5" r="2"/>'],
  ["livre", "Lecture, histoires", "lecture livre histoire conte", '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>'],
  ["bibliotheque", "Bibliothèque", "bibliotheque mediatheque", '<path d="M5 4v15M9 4v15M5 4h4M5 19h4"/><path d="M12 5.5l3-.8 3.6 14-3 .8z"/><path d="M3 21h18"/>'],
  ["note", "Comptines, chansons", "comptine chanson chant chanter", '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'],
  ["tambour", "Éveil musical", "musique musical instrument tambour eveil", '<ellipse cx="12" cy="9" rx="8" ry="3"/><path d="M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9"/><path d="M7 3l4 5M17 3l-4 5"/>'],
  ["danse", "Danse, motricité", "danse motricite gym bouger", '<circle cx="12" cy="4" r="2"/><path d="M12 7v7l-3 7M12 14l3 7M12 9 7 5M12 9l5-4"/>'],
  ["cones", "Parcours", "parcours obstacle", '<path d="M3 20h8M4.5 20 7 8l2.5 12M5.5 15h3"/><path d="M13 20h8M14.5 20 17 8l2.5 12M15.5 15h3"/>'],
  ["puzzle", "Puzzle", "puzzle encastrement", '<path d="M4 7h4.5a2 2 0 1 1 3 0H16v4.5a2 2 0 1 1 0 3V19H4z"/>'],
  ["cubes", "Construction", "construction cube kapla", '<rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><rect x="8" y="3" width="8" height="8" rx="1"/>'],
  ["brique", "Briques à emboîter", "lego duplo brique", '<rect x="3" y="9" width="18" height="10" rx="1.5"/><path d="M6 9V6h4v3M14 9V6h4v3"/>'],
  ["de", "Jeux de société", "jeu societe de loto memory", '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/>'],
  ["tasse", "Dînette, jeu d'imitation", "dinette imitation marchande", '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M3 21h14"/>'],
  ["masque", "Déguisement", "deguisement masque carnaval", '<path d="M3 8c3-1 6-1 9 1 3-2 6-2 9-1 0 6-2 9-5 9-2 0-3-2-4-2s-2 2-4 2c-3 0-5-3-5-9z"/><path d="M7 11h2M15 11h2"/>'],
  ["marionnette", "Marionnettes", "marionnette spectacle theatre", '<path d="M7 21v-9a5 5 0 0 1 10 0v9"/><path d="M10 11h.01M14 11h.01"/><path d="M10 15c1 1 3 1 4 0"/><path d="M5 21h14"/>'],
  ["voiture", "Petites voitures", "voiture garage", '<path d="M3 16v-3l2-5h11l3 5h2v3z"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/><path d="M6 13h13"/>'],
  ["train", "Train", "train", '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M9 13.5h.01M15 13.5h.01"/><path d="M8 21l2-4M16 21l-2-4"/>'],
  ["bulles", "Bulles de savon", "bulle savon", '<circle cx="9" cy="14" r="5"/><circle cx="17" cy="7" r="3"/><circle cx="18" cy="15" r="1.5"/><path d="M7 12a2 2 0 0 1 2-2"/>'],
  ["emotions", "Émotions", "emotion humeur visage", '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c2 2 5 2 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'],
  ["lune", "Relaxation", "relaxation calme yoga sieste", '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>'],
  ["toque", "Cuisine", "cuisine recette", '<path d="M7 14a4 4 0 0 1-1-7.9A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 6 2.1A4 4 0 0 1 17 14z"/><path d="M7 14v6h10v-6M7 17h10"/>'],
  ["gateau", "Pâtisserie", "gateau patisserie biscuit crepe muffin", '<path d="M6 12h12l-2 9H8z"/><path d="M5 12a7 5 0 0 1 14 0"/><path d="M10.5 12l.5 9M13.5 12l-.5 9"/>'],
  ["pomme", "Fruits, goûter", "fruit pomme gouter legume", '<path d="M12 7c-2-1.5-7-1-7 5 0 5 3 9 5 9 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-9 0-6-5-6.5-7-5z"/><path d="M12 7c0-2 1-4 3-4"/>'],
  ["panier", "Marché, pique-nique", "marche pique nique panier course", '<path d="M3 10h18l-2 10H5z"/><path d="M7 10l4-6M17 10l-4-6M9 14v3M12 14v3M15 14v3"/>'],
  ["pousse", "Semis, plantations", "semis plantation graine pousse potager", '<path d="M12 21v-9"/><path d="M12 12C12 8 9 6 5 6c0 4 3 6 7 6z"/><path d="M12 14c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5z"/><path d="M7 21h10"/>'],
  ["arrosoir", "Jardinage", "jardin jardinage arroser arrosoir", '<path d="M4 10h11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M15 13l5-5M18.5 6.5l3 3"/><path d="M7 10V7a2.5 2.5 0 0 1 5 0v3"/>'],
  ["fleur", "Fleurs", "fleur bouquet printemps", '<path d="M7 4l2.5 2L12 3l2.5 3L17 4v5a5 5 0 0 1-10 0z"/><path d="M12 14v7M12 19c-2-2-4-2.5-6-2 1.5 2 4 3 6 2zM12 18c1.5-1.5 3.5-2 5.5-1.5-1 1.8-3.5 2.5-5.5 1.5z"/>'],
  ["feuille", "Nature, feuilles", "nature feuille automne", '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z"/><path d="M5 19 13 11"/>'],
  ["arbre", "Forêt, parc", "foret arbre bois parc", '<circle cx="12" cy="9" r="6"/><path d="M12 15v6M9 21h6M12 12l2.5-2.5"/>'],
  ["empreintes", "Promenade", "promenade balade marche sortie", '<path d="M7 4c2 0 3 2 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5zM17 9c2 0 3 2 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5z"/><path d="M5.5 16h3M15.5 21h3"/>'],
  ["toboggan", "Aire de jeux", "aire jeux toboggan square", '<path d="M5 21V6h4v15M5 10h4M5 14h4"/><path d="M9 6c3 0 4 3 6 8s3 7 6 7"/>'],
  ["balancoire", "Balançoire", "balancoire", '<path d="M3 21 7 3h10l4 18"/><path d="M10 3v11M14 3v11M9 14h6"/>'],
  ["ballon", "Jeux de ballon", "ballon balle foot", '<circle cx="12" cy="12" r="9"/><path d="M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18M3.5 9h17M3.5 15h17"/>'],
  ["velo", "Vélo, draisienne", "velo draisienne tricycle porteur", '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-7h5l3 7M15 9l-1-3h2.5M10 9 9 7H7"/>'],
  ["trottinette", "Trottinette", "trottinette", '<circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/><path d="M8 18h8M17.5 16 14.5 4M12 4h5"/>'],
  ["seau", "Bac à sable", "sable seau pelle chateau plage", '<path d="M5 9h10l-1.5 11h-7z"/><path d="M5 9a5 5 0 0 1 10 0"/><path d="M19 3v12M17 15h4l-2 4z"/>'],
  ["goutte", "Jeux d'eau", "eau transvasement", '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'],
  ["vagues", "Piscine, bébés nageurs", "piscine nageur nage", '<path d="M2 7c2.5-2 4.5-2 7 0s4.5 2 7 0 3.5-1.5 6 0M2 12c2.5-2 4.5-2 7 0s4.5 2 7 0 3.5-1.5 6 0M2 17c2.5-2 4.5-2 7 0s4.5 2 7 0 3.5-1.5 6 0"/>'],
  ["cerf-volant", "Cerf-volant, vent", "cerf volant vent moulin", '<path d="M12 2l6 7-6 8-6-8z"/><path d="M6 9h12M12 2v15"/><path d="M12 17c-1 2 1 3 0 5"/>'],
  ["papillon", "Petites bêtes", "papillon insecte bete coccinelle", '<path d="M12 7v13"/><path d="M12 10C9 4 3 4 3 8s4 5 9 3M12 10c3-6 9-6 9-2s-4 5-9 3M12 13c-3 0-7 2-6 5s5 0 6-3M12 13c3 0 7 2 6 5s-5 0-6-3"/><path d="M10 4l2 3 2-3"/>'],
  ["escargot", "Escargots", "escargot limace", '<path d="M3 18h15a3 3 0 0 0 3-3V8"/><circle cx="11" cy="12" r="6"/><path d="M11 12a2.5 2.5 0 1 1 2.5 2.5"/><path d="M19 8l-1-3M21 8l1-3"/>'],
  ["patte", "Animaux", "animal animaux chien chat", '<ellipse cx="12" cy="16" rx="4" ry="3.5"/><circle cx="6" cy="10" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="10" r="2"/>'],
  ["ferme", "Ferme", "ferme poule mouton vache", '<path d="M3 21V10l9-6 9 6v11z"/><path d="M8 21v-7h8v7M8 14l8 7M16 14l-8 7"/>'],
  ["oiseau", "Oiseaux", "oiseau mangeoire nichoir", '<path d="M16 6a3 3 0 0 0-3 3v.5C9 9 4 11 4 15c0 2.5 2 4 4.5 4H13a5 5 0 0 0 5-5V9.5l3-1-3-1.2A3 3 0 0 0 16 6z"/><path d="M15.5 8.5h.01M8 14c1.5 1.5 3.5 1.5 5 0"/>'],
  ["poisson", "Poissons, aquarium", "poisson aquarium mer", '<path d="M3 12c3-5 9-6 14 0-5 6-11 5-14 0z"/><path d="M17 12l4-4v8z"/><path d="M8 11h.01"/>'],
  ["loupe", "Observation", "observation loupe exploration decouverte", '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'],
  ["soleil", "Soleil, été", "soleil ete", '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  ["parapluie", "Pluie", "pluie parapluie flaque", '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v7a2 2 0 0 0 4 0M12 2v1"/>'],
  ["flocon", "Neige, hiver", "neige hiver flocon", '<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>'],
  ["arc-en-ciel", "Arc-en-ciel, couleurs", "arc ciel couleur", '<path d="M2 18a10 10 0 0 1 20 0M6 18a6 6 0 0 1 12 0M10 18a2 2 0 0 1 4 0"/>'],
  ["tente", "Cabane", "cabane tente", '<path d="M2 20 12 4l10 16z"/><path d="M9 20l3-6 3 6"/>'],
  ["sapin", "Noël", "noel sapin", '<path d="M12 2l1.2 2.2 2.3.3-1.7 1.6.4 2.4L12 7.4l-2.2 1.1.4-2.4-1.7-1.6 2.3-.3z"/><path d="M12 9l-5 6h3l-4 5h12l-4-5h3z"/>'],
  ["citrouille", "Halloween", "halloween citrouille sorciere", '<path d="M12 7c-5 0-8 3-8 7s3 6 8 6 8-2 8-6-3-7-8-7z"/><path d="M12 7c-2 0-3 3-3 6.5S10 20 12 20s3-3 3-6.5S14 7 12 7z"/><path d="M12 7c0-2 1-3 3-4"/>'],
  ["oeuf", "Pâques", "paques oeuf lapin", '<path d="M12 3c-4 0-7 6-7 11a7 7 0 0 0 14 0c0-5-3-11-7-11z"/><path d="M5.5 12l3 2 3-2 3 2 3-2 1.2.8"/>'],
  ["coeur", "Fête des parents", "fete mere pere cadeau coeur", '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>'],
  ["ballons", "Fête, anniversaire", "fete anniversaire ballon baudruche", '<ellipse cx="9" cy="8" rx="4" ry="5"/><ellipse cx="16" cy="10" rx="3.5" ry="4.5"/><path d="M9 13c0 3 2 4 2 8M16 14.5c0 2-2 3-2 6.5"/>'],
];
ICONES_ACTIVITES.forEach(([cle, , , dessin]) => { PICTOS[`a-${cle}`] = dessin; });

// Icône proposée d'après le titre (« Peinture d'automne » → pinceau), sinon la palette.
function iconeProposee(titre) {
  const mots = String(titre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/).filter((m) => m.length > 2);
  const trouvee = ICONES_ACTIVITES.find(([, , cles]) => cles.split(" ").some((c) => mots.some((m) => m === c || (c.length > 3 && m.startsWith(c)))));
  return trouvee ? trouvee[0] : "palette";
}
// Pictogramme d'une activité : celui choisi, ou celui proposé d'après son titre.
const iconeActivite = (a) => `a-${PICTOS[`a-${a?.icone}`] ? a.icone : iconeProposee(a?.titre)}`;

const picto = (nom) => `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true">${PICTOS[nom]}</svg>`;
// Pastille colorée selon la catégorie du menu : argent (menthe), familles (lavande), demarches (beurre), moi (rose).
const pastille = (nom, categorie) => `<span class="pic ${categorie}">${picto(nom)}</span>`;
// Boutons écrits dans la page : <button data-picto="dossier"> reçoit son pictogramme devant le texte.
document.querySelectorAll("[data-picto]").forEach((el) => el.insertAdjacentHTML("afterbegin", picto(el.dataset.picto)));

// ------------------------------------------------------------- onglets
function ouvrirOnglet(nom) {
  // Formulaire modifié mais pas enregistré dans la rubrique qu'on quitte : on prévient.
  const quitte = $(".onglet.actif");
  if (quitte && quitte.id !== nom && quitte.querySelector("form.suivi-modifs.modifie")) {
    if (!confirm("Vos modifications ne sont pas enregistrées. Quitter cette page sans les enregistrer ?")) return;
    quitte.querySelectorAll("form.suivi-modifs.modifie").forEach((f) => f.classList.remove("modifie"));
  }
  $$("[data-onglet]").forEach((b) => b.classList.toggle("actif", b.dataset.onglet === nom));
  $$(".onglet").forEach((s) => s.classList.toggle("actif", s.id === nom));
  fermerMenuLateral();
  window.scrollTo(0, 0);
  if (nom === "bulletins") afficherListe();
  if (nom === "accueil") afficherTableauDeBord();
  if (nom === "revenus") afficherRevenus($("#annee-revenus").value);
  if (nom === "impots") afficherImpots($("#annee-impots").value);
  if (nom === "contrats") afficherContrats();
  if (nom === "echeances") afficherEcheances();
  if (nom === "courriers") preparerCourriers();
  if (nom === "profil") chargerProfil();
  if (nom === "acces-rapide") afficherSites();
  if (nom === "photos") afficherPhotos();
  if (nom === "ateliers") afficherAteliers();
  if (nom === "fonctionnalites") afficherPrincipal();
}
$("#bouton-menu").addEventListener("click", (e) => {
  e.stopPropagation();
  const ouvert = $("#menu").classList.toggle("ouvert");
  $("#bouton-menu").setAttribute("aria-expanded", String(ouvert));
});
// Sur téléphone, le menu glisse par-dessus la page : un clic à côté ou Échap le referme.
const fermerMenuLateral = () => { $("#menu").classList.remove("ouvert"); $("#bouton-menu").setAttribute("aria-expanded", "false"); };
document.addEventListener("click", (e) => { if ($("#menu").classList.contains("ouvert") && !$("#menu").contains(e.target)) fermerMenuLateral(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#menu").classList.contains("ouvert")) fermerMenuLateral(); });
$$("[data-onglet]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.onglet)));
$$("[data-aller]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); ouvrirOnglet(b.dataset.aller); }));

$("#date-du-jour").textContent = new Date().toLocaleDateString("fr-FR",
  { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
$("#mois-precedent").innerHTML = picto("monter").replace("m6 15 6-6 6 6", "m15 6-6 6 6 6");
$("#mois-suivant").innerHTML = picto("monter").replace("m6 15 6-6 6 6", "m9 6 6 6-6 6");
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
    if (changementListe) {
      afficherListe();
      badgeBulletins();
      if ($("#accueil").classList.contains("actif")) afficherTableauDeBord();
    }
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
  btn.innerHTML = `${picto("telecharger")}Récupérer ${manquants > 1 ? `les ${manquants} bulletins` : "le bulletin"}`;
  // Résumé en tête : combien manquent, lesquels ; « Vérifier » passe en second quand il y a à récupérer.
  $("#resume-titre").textContent = manquants ? `${manquants} bulletin${manquants > 1 ? "s" : ""} à récupérer`
    : etat.bulletins.length ? "Tous les bulletins sont rangés" : "Bulletins pas encore vérifiés sur Pajemploi";
  $("#resume-detail").textContent = manquants ? detailManquants()
    : etat.bulletins.length ? "Le dossier contient tous les bulletins déclarés sur Pajemploi."
    : "Vérifiez sur Pajemploi pour savoir quels bulletins manquent dans le dossier.";
  const analyser = $("#btn-analyser");
  analyser.className = manquants ? "secondaire" : "principal";
  analyser.innerHTML = `${picto("actualiser")}${etat.bulletins.length ? "Vérifier à nouveau" : "Vérifier sur Pajemploi"}`;
  $$("#btn-analyser, #btn-telecharger, #btn-visible, #btn-page").forEach((b) => (b.disabled = occupe));
  $("#btn-diag-erreur").classList.toggle("cache", etat.phase !== "erreur");

  const telechargement = etat.phase === "telechargement";
  const interrompre = $("#btn-interrompre");
  interrompre.classList.toggle("cache", !telechargement);
  btn.classList.toggle("cache", manquants === 0 || telechargement);
  if (!telechargement) interrompre.disabled = false;

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
      caseMois.innerHTML = (manquant ? picto("telecharger") : "") + (liste.length > 1 ? `<span class="nombre">${liste.length}</span>` : "");
      const titre = `${INITIALES_MOIS[m - 1]} ${annee}`;
      caseMois.title = liste.length ? `${titre}\n${liste.map((e) => e.details).join("\n\n")}` : `${titre} : aucun bulletin`;
      caseMois.setAttribute("aria-label", liste.length
        ? `${titre} : ${manquant ? "à récupérer" : "rangé"}` : `${titre} : aucun bulletin`);
      // Case rangée : ouvrir le bulletin ou le montrer dans son dossier ; case à récupérer : celui-ci ou tous.
      if (liste.some((e) => e.manquant || e.fichier)) {
        caseMois.setAttribute("aria-haspopup", "menu");
        caseMois.addEventListener("click", () => menuContextuel(caseMois, choixCase(liste, titre)));
      } else caseMois.tabIndex = -1;
      ligne.appendChild(caseMois);
    }
    feuille.appendChild(ligne);
  });
  return bloc;
}

function choixCase(liste, titre) {
  const plusieurs = liste.length > 1;
  const groupes = liste.map((e) => {
    // Plusieurs bulletins le même mois : prénom de l'enfant, ou nom du fichier tant que Pajemploi n'a pas été consulté.
    // (« … - 2026-09 - Léa.pdf » → « Léa »).
    const fichier = e.local && e.fichier ? e.fichier.split(/[\\/]/).pop().replace(/\.pdf$/i, "") : "";
    const fin = fichier.split(" - ").pop();
    const nom = e.enfant || (/\d/.test(fin) ? fichier : fin);
    const qui = plusieurs && nom ? ` (${nom})` : "";
    if (e.manquant) return [{ picto: "telecharger", texte: `Récupérer ce bulletin${qui}`,
      action: () => api("action", { action: "telecharger_manquants", cibles: [e.cible] }).then(rafraichir).catch((err) => alert(err.message)) }];
    if (!e.fichier) return [];
    return [{ picto: "ouvrir", texte: `Ouvrir${qui}`, action: () => api("ouvrir", { quoi: e.fichier }).catch((err) => alert(err.message)) },
      { picto: "dossier", texte: `Afficher dans le dossier${qui}`, action: () => api("montrer", { quoi: e.fichier }).catch((err) => alert(err.message)) }];
  });
  const items = groupes.flat();
  const manquants = etat.bulletins.filter((b) => !b.present).length;
  if (liste.some((e) => e.manquant) && manquants > 1)
    items.push({ separateur: true }, { picto: "telecharger", texte: `Tout récupérer (${manquants} bulletins)`, action: () => action("telecharger_manquants") });
  return { titre, items };
}

// Menu contextuel (ouvert par un clic) : liste d'actions avec pictogramme, sous l'élément cliqué ;
// fermé par Échap, un clic ailleurs, le défilement ou le choix d'une action.
let menuOuvert = null;
function fermerMenu(rendreFocus = false) {
  if (!menuOuvert) return;
  const { menu, source } = menuOuvert;
  menuOuvert = null;
  menu.remove();
  source.setAttribute("aria-expanded", "false");
  if (rendreFocus) source.focus();
}
function menuContextuel(source, { titre, items }) {
  const dejaOuvert = menuOuvert?.source === source;
  fermerMenu();
  if (dejaOuvert || !items.length) return;
  const menu = document.createElement("div");
  menu.className = "menu-contextuel";
  menu.setAttribute("role", "menu");
  menu.innerHTML = (titre ? `<p class="titre-menu">${echapper(titre)}</p>` : "") + items.map((it, i) => it.separateur
    ? `<hr>` : `<button type="button" role="menuitem" data-i="${i}" class="${it.picto === "telecharger" ? "a-recuperer" : ""}">${picto(it.picto)}<span>${echapper(it.texte)}</span></button>`).join("");
  document.body.appendChild(menu);
  const r = source.getBoundingClientRect();
  const largeur = menu.offsetWidth, hauteur = menu.offsetHeight;
  let gauche = Math.min(r.left, innerWidth - largeur - 12), haut = r.bottom + 6;
  if (haut + hauteur > innerHeight - 12) haut = Math.max(12, r.top - hauteur - 6);
  menu.style.left = `${Math.max(12, gauche) + scrollX}px`;
  menu.style.top = `${haut + scrollY}px`;
  source.setAttribute("aria-expanded", "true");
  menuOuvert = { menu, source, depuis: Date.now() };
  const boutons = [...menu.querySelectorAll("[role=menuitem]")];
  boutons[0]?.focus({ preventScroll: true });
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    fermerMenu(true);
    items[+b.dataset.i].action();
  });
  menu.addEventListener("keydown", (e) => {
    const i = boutons.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      boutons[(i + (e.key === "ArrowDown" ? 1 : -1) + boutons.length) % boutons.length].focus();
    } else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); fermerMenu(true); }
  });
}
document.addEventListener("pointerdown", (e) => { if (menuOuvert && !menuOuvert.menu.contains(e.target) && !menuOuvert.source.contains(e.target)) fermerMenu(); });
addEventListener("resize", () => fermerMenu());
// Défilement : seulement s'il vient de l'utilisatrice (pas du défilement qui amène la case à l'écran à l'ouverture).
document.addEventListener("scroll", () => { if (menuOuvert && Date.now() - menuOuvert.depuis > 400) fermerMenu(); }, true);

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
        cible: b.cible, enfant: b.enfant || "",
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
      <button class="principal" id="lien-param">Choisir le dossier dans « Paramètres »</button></div>`;
    $("#lien-param").addEventListener("click", () => ouvrirOnglet("fonctionnalites"));
    return;
  }
  const familles = Object.entries(dossierLocal.clients);
  if (!familles.length) {
    zone.innerHTML = `<div class="vide-classeur"><p>Le dossier ne contient encore aucun bulletin.
      Cliquez sur « Vérifier sur Pajemploi » pour trouver ceux à récupérer.</p></div>`;
    return;
  }
  zone.innerHTML = "";
  familles.filter(([, periodes]) => !recentes || periodes.some((p) => p >= limite)).forEach(([famille, periodes]) => {
    // Un bulletin par fichier trouvé : la case ouvre le même menu qu'après la vérification (ouvrir, afficher dans le dossier).
    const entrees = periodes.flatMap((p) => (dossierLocal.fichiers?.[famille]?.[p] || [null]).map((fichier) => ({
      periode: p, local: true, manquant: false, fichier,
      details: fichier ? `Rangé : ${fichier}` : "Présent dans le dossier" })));
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
// Chaque libellé de formulaire reçoit la mention « obligatoire » ou « facultatif ». Le texte du libellé est
// regroupé dans <span class="intitule"> : dans une grille, les champs d'une même ligne s'alignent ainsi.
function marquerChamps(formulaire) {
  formulaire.querySelectorAll("label").forEach((label) => {
    const champ = label.querySelector("input, select, textarea");
    if (!champ || ["checkbox", "radio", "hidden"].includes(champ.type) || label.querySelector(".mention")) return;
    let intitule = label.querySelector(":scope > .intitule");
    if (!intitule) {
      const avant = [];
      for (const n of label.childNodes) { if (n === champ || n.contains?.(champ)) break; avant.push(n); }
      if (!avant.some((n) => n.textContent.trim())) return;
      intitule = document.createElement("span");
      intitule.className = "intitule";
      avant.forEach((n) => intitule.appendChild(n));
      label.prepend(intitule);
    }
    const obligatoire = champ.required || champ.hasAttribute("data-obligatoire");
    const mention = document.createElement("span");
    mention.className = "mention" + (obligatoire ? " obligatoire" : "");
    mention.textContent = obligatoire ? "obligatoire" : "facultatif";
    intitule.appendChild(mention);
  });
}

// Champs remplis légèrement mis en valeur (et rafraîchis après chaque remplissage par le programme).
function marquerRemplis(racine = document) {
  racine.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea")
    .forEach((c) => c.classList.toggle("rempli", !!c.value.trim()));
}
document.addEventListener("input", (e) => { if (e.target.matches?.("input, select, textarea")) marquerRemplis(e.target.parentElement); });
document.addEventListener("change", (e) => { if (e.target.matches?.("input, select, textarea")) marquerRemplis(e.target.parentElement); });
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

// ------------------------------------------------------------- modifications non enregistrées
// Mon profil et Paramètres sont de longues pages : dès qu'un champ change, la barre « Enregistrer » reste
// visible en bas de l'écran (classe « modifie ») jusqu'à l'enregistrement ou l'annulation.
$$("form.suivi-modifs").forEach((f) => {
  const marquer = (e) => { if (!e.target.matches?.("[data-filtre]")) f.classList.add("modifie"); };
  f.addEventListener("input", marquer);
  f.addEventListener("change", marquer);
});
const sansModifs = (f) => f.classList.remove("modifie");
window.addEventListener("beforeunload", (e) => { if ($("form.suivi-modifs.modifie")) e.preventDefault(); });

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
  dossiersPhotos = [...(p.dossiers_photos || [])];
  afficherDossiersPhotos();
  const marge = Number(p.marge_photos ?? 30);
  $("#marge-unite").value = marge && marge % 60 === 0 ? "60" : "1";
  $("#marge-valeur").value = marge / Number($("#marge-unite").value);
  form.elements.marge_photos.value = marge;
  parametresActuels = p;
  apercu();
  sansModifs(form);
  if (!p.dossier_principal || (p.modules?.bulletins !== false && !p.identifiant)) ouvrirOnglet("fonctionnalites");
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
    dossier_bulletins: parametresActuels.dossier_bulletins || "Bulletins de salaire",
    format_fichier: form.elements.format_fichier.value,
    organisation: form.elements.organisation.value || "client",
  }).catch(() => null);
  if (r) $("#apercu").innerHTML = `<li class="dossier"><span>${echapper(r.racine)}</span><ul>${arbreHtml(r.fichiers)}</ul></li>`;
}
form.elements.format_fichier.addEventListener("input", apercu);
$$("input[name=organisation]").forEach((r) => r.addEventListener("change", apercu));

// Dossiers où arrivent les photos (iCloud…) : liste modifiée ici, enregistrée avec les autres réglages.
let dossiersPhotos = [];
function afficherDossiersPhotos() {
  $("#dossiers-photos").innerHTML = dossiersPhotos.length ? dossiersPhotos.map((d, i) => `<li>${picto("dossier")}<span>${echapper(d)}</span>
    <button type="button" class="action danger" data-retirer-dossier="${i}">${picto("supprimer")}Retirer</button></li>`).join("")
    : `<li class="petit">Aucun dossier pour l'instant : seul « À trier » est lu.</li>`;
}
$("#dossiers-photos").addEventListener("click", (e) => {
  const b = e.target.closest("[data-retirer-dossier]");
  if (!b) return;
  dossiersPhotos.splice(+b.dataset.retirerDossier, 1);
  afficherDossiersPhotos();
  form.classList.add("modifie");
});
$("#ajouter-dossier-photos").addEventListener("click", async () => {
  const r = await api("choisir-dossier", { titre: "Dossier où arrivent vos photos" })
    .catch(() => ({ chemin: prompt("Chemin complet du dossier où arrivent vos photos :") }));
  if (r?.chemin && !dossiersPhotos.includes(r.chemin)) {
    dossiersPhotos.push(r.chemin);
    afficherDossiersPhotos();
    form.classList.add("modifie");
  }
});
const lireMarge = () => {
  const unite = Number($("#marge-unite").value);
  $("#marge-valeur").max = unite === 60 ? 24 : 600;
  form.elements.marge_photos.value = Math.max(0, Math.round(nombreFr($("#marge-valeur").value) * unite));
};
$("#marge-valeur").addEventListener("input", lireMarge);
$("#marge-unite").addEventListener("change", lireMarge);
form.querySelector(".annuler-modifs").addEventListener("click", () => chargerParametres());

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
  d.dossiers_photos = dossiersPhotos;
  d.marge_photos = Number(d.marge_photos || 0);
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

function graphiqueHtml(r, compact = false) {
  const mois = moisTries(r);
  const max = Math.max(1, ...mois.map((m) => (compact ? m.net : m.brut) + m.indemnites));
  const haut = compact ? 130 : 170;
  const h = (v) => Math.round((haut * v) / max);
  return `<div class="legende-graphique"><span><i class="c-net"></i>Net</span>${compact ? "" : `<span><i class="c-cot"></i>Cotisations</span>`}
      <span><i class="c-ind"></i>Indemnités</span></div>
    <div class="defilement"><div class="graphique${compact ? " compact" : ""}" role="img" aria-label="Revenus mois par mois">
    ${mois.map((m, i) => `<div class="barre-mois" title="${MOIS_COURTS[i]} : brut ${euros(m.brut, 2)}, net ${euros(m.net, 2)}, indemnités ${euros(m.indemnites, 2)}">
      ${compact ? "" : `<span class="montant">${m.bulletins ? euros(m.encaisse).replace(/\s?€/, "") : ""}</span>`}
      <div class="pile"><div class="c-ind" style="height:${h(m.indemnites)}px"></div>
        ${compact ? "" : `<div class="c-cot" style="height:${h(m.cotisations)}px"></div>`}<div class="c-net" style="height:${h(m.net)}px"></div></div>
      <span class="mois">${compact ? MOIS_COURTS[i].charAt(0).toUpperCase() : MOIS_COURTS[i]}</span></div>`).join("")}
    </div></div>`;
}

function aucunRevenu(zone) {
  zone.innerHTML = `<p class="petit">Aucun bulletin lu pour l'instant. Les montants apparaîtront dès que des bulletins
    seront rangés dans le dossier choisi dans « Paramètres ».</p>`;
}

// Pastille du menu « Bulletins de salaire » : nombre de bulletins à récupérer.
function badgeBulletins() {
  const manquants = etat.bulletins.filter((b) => !b.present).length;
  $("#badge-bulletins").textContent = manquants;
  $("#badge-bulletins").classList.toggle("cache", !manquants);
}

// Carte du tableau de bord : les six derniers mois de chaque famille récente (rangé, à récupérer, rien).
async function tuileBulletins() {
  const zone = $("#mini-classeur");
  if (!etat.bulletins.length && !dossierLocal) dossierLocal = await api("dossier").catch(() => null);
  const mois = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - 1 - i, 1);
    mois.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const etats = {};      // famille -> {periode: "present" | "manquant"}
  Object.entries(dossierLocal?.clients || {}).forEach(([f, periodes]) => periodes.forEach((p) => ((etats[f] ??= {})[p] = "present")));
  etat.bulletins.forEach((b) => ((etats[b.client] ??= {})[b.periode] = b.present ? "present" : "manquant"));
  const familles = Object.keys(etats).filter((f) => mois.some((m) => etats[f][m])).sort((a, b) => a.localeCompare(b, "fr")).slice(0, 8);
  zone.innerHTML = familles.length ? `<span></span>${mois.map((m) => `<span class="nom-mois">${INITIALES_MOIS[+m.slice(5) - 1]}</span>`).join("")}
    ${familles.map((f) => `<span class="nom-famille">${echapper(f)}</span>${mois.map((m) => `<i class="${etats[f][m] || "vide"}" title="${
      echapper(f)} : ${INITIALES_MOIS[+m.slice(5) - 1]} ${m.slice(0, 4)} ${etats[f][m] === "manquant" ? "à récupérer" : etats[f][m] ? "rangé" : "aucun bulletin"}"></i>`).join("")}`).join("")}` : "";
  const manquants = etat.bulletins.filter((b) => !b.present).length;
  const nbFamilles = new Set(etat.bulletins.filter((b) => !b.present).map((b) => b.client)).size;
  $("#tuile-bulletins").textContent = !etat.bulletins.length
    ? "Pas encore vérifiés sur Pajemploi depuis l'ouverture de l'application."
    : manquants ? `${manquants} bulletin${manquants > 1 ? "s" : ""} à récupérer, pour ${nbFamilles} famille${nbFamilles > 1 ? "s" : ""}.`
      : "Tous les bulletins sont rangés.";
  const bouton = $("#tuile-recuperer");
  bouton.classList.toggle("cache", !manquants || etat.phase === "telechargement");
  bouton.innerHTML = `${picto("telecharger")}Récupérer ${manquants > 1 ? `les ${manquants} bulletins` : "le bulletin"}`;
}
$("#tuile-recuperer").addEventListener("click", () => { ouvrirOnglet("bulletins"); action("telecharger_manquants"); });

// « 2 bulletins : Durand (août), Bernard (septembre) » : familles et mois des bulletins à récupérer.
function detailManquants() {
  const parFamille = {};
  etat.bulletins.filter((b) => !b.present).forEach((b) => (parFamille[b.client] ??= new Set()).add(b.periode));
  return Object.entries(parFamille).map(([famille, periodes]) => `${famille} (${[...periodes].sort().map((p) =>
    new Date(p + "-15").toLocaleDateString("fr-FR", { month: "long" })
    + (p.slice(0, 4) !== String(new Date().getFullYear()) ? ` ${p.slice(0, 4)}` : "")).join(", ")})`).join(", ");
}

async function afficherTableauDeBord() {
  const modules = parametresActuels.modules || {};
  if (modules.activites !== false) afficherSites();
  // « À faire » : seulement des actions possibles tout de suite, chacune avec le bouton qui la lance.
  const aFaire = [];
  const manquants = etat.bulletins.filter((b) => !b.present).length;
  if (modules.bulletins !== false && manquants)
    aFaire.push({ picto: "telecharger", categorie: "argent", principal: true, aller: "bulletins", bouton: "Récupérer",
      lancer: "telecharger_manquants",
      texte: `${manquants} bulletin${manquants > 1 ? "s" : ""} de salaire à récupérer`, detail: detailManquants() });

  const [r, ech, contrats, profil] = await Promise.all([
    modules.revenus !== false ? chargerRevenus() : null,
    modules.echeances !== false ? api("echeances").catch(() => []) : [],
    api("contrats").catch(() => []), api("profil").catch(() => ({})),
  ]);
  if (r && r.illisibles.length && !r.module_absent)
    aFaire.push({ picto: "alerte", categorie: "alerte", aller: "revenus", bouton: "Voir les bulletins concernés",
      texte: `${r.illisibles.length} bulletin${r.illisibles.length > 1 ? "s" : ""} dont les montants n'ont pas pu être lus` });
  if (modules.contrats !== false && !contrats.length)
    aFaire.push({ picto: "famille", categorie: "familles", aller: "contrats", bouton: "Ajouter mes familles",
      texte: "Créez la fiche de chaque famille employeur, puis une fiche par enfant accueilli",
      detail: "Dates, emploi du temps et tarif servent aux échéances, aux impôts et aux courriers." });
  // Saison de la déclaration de revenus (janvier à juin) : rappeler les jours de garde à confirmer.
  if (modules.impots !== false && new Date().getMonth() < 6) {
    const imp = await chargerImpots();
    if (imp && imp.familles.length)
      aFaire.push({ picto: "impots", categorie: "argent", aller: "impots", bouton: imp.a_confirmer ? "Confirmer les jours" : "Voir le montant",
        texte: imp.a_confirmer ? `Déclaration des revenus ${imp.annee} : ${imp.a_confirmer} mois de garde à confirmer`
          : `Déclaration des revenus ${imp.annee} : montant à déclarer prêt (${euros(imp.total[imp.total.meilleur])})` });
  }
  if (!parametresActuels.dossier_principal)
    aFaire.push({ picto: "dossier", categorie: "moi", aller: "fonctionnalites", bouton: "Choisir le dossier",
      texte: "Choisissez le dossier principal", detail: "Bulletins, courriers, photos et activités y seront rangés." });
  if (modules.photos !== false && parametresActuels.dossier_principal) {
    const n = await compterPhotos();
    if (n) aFaire.push({ picto: "appareil", categorie: "familles", aller: "photos", bouton: "Trier les photos",
      texte: `${n} photo${n > 1 ? "s" : ""} à trier`, detail: "Indiquez quels enfants sont sur chaque photo : l'application les range." });
  }
  if (!profil.nom || !profil.agrement_numero)
    aFaire.push({ picto: "profil", categorie: "moi", aller: "profil", bouton: "Compléter mon profil",
      texte: "Complétez votre profil (identité, agrément)", detail: "Il sert aux courriers, aux contrats de travail et aux échéances." });
  // Sans vérification sur Pajemploi, on ne sait pas s'il manque des bulletins : on le dit plutôt que « tout est à jour ».
  const nonVerifie = modules.bulletins !== false && !etat.bulletins.length;
  $("#nb-a-faire").textContent = aFaire.length;
  $("#nb-a-faire").classList.toggle("cache", !aFaire.length);
  $("#a-faire").classList.toggle("calme", !aFaire.length && !nonVerifie);
  $("#liste-a-faire").innerHTML = aFaire.length
    ? aFaire.map((a) => `<li>${pastille(a.picto, a.categorie)}<span class="texte">${echapper(a.texte)}${
        a.detail ? `<small>${echapper(a.detail)}</small>` : ""}</span>
        <button class="${a.principal ? "principal" : "secondaire"}" data-aller-vers="${a.aller}"${a.lancer ? ` data-lancer="${a.lancer}"` : ""}>${a.principal ? picto(a.picto) : ""}${a.bouton}</button></li>`).join("")
    : nonVerifie
      ? `<li>${pastille("actualiser", "argent")}<span class="texte">Regarder s'il y a de nouveaux bulletins sur Pajemploi<small>Rien d'autre
        à faire pour l'instant.</small></span>
        <button class="secondaire" data-aller-vers="bulletins" data-lancer="connecter_et_analyser">${picto("actualiser")}Vérifier sur Pajemploi</button></li>`
      : `<li>${pastille("coche", "argent")}<span class="texte">Rien d'urgent : tout est à jour.</span></li>`;
  $$("#liste-a-faire [data-aller-vers]").forEach((b) => b.addEventListener("click", () => {
    ouvrirOnglet(b.dataset.allerVers);
    if (b.dataset.lancer) action(b.dataset.lancer);
  }));

  salutation(profil);
  statsAccueil(r, ech, contrats);
  if (modules.bulletins !== false) tuileBulletins();
  echeancesAccueil = ech;
  afficherAgenda();
  contratsAccueil = contrats;
  afficherJour();

  if (r) {
    $("#annee-accueil").textContent = r.general.bulletins ? `en ${r.annee}` : "";
    if (r.general.bulletins) {
      $("#chiffres-accueil").innerHTML = `<p class="montant-cle"><span class="valeur">${euros(r.general.encaisse)}</span>
        <span>encaissés (${periodeCouverte(r)}), dont ${euros(r.general.indemnites)} d'indemnités</span></p>`;
      $("#graphique-accueil").innerHTML = graphiqueHtml(r, true);
    } else {
      $("#chiffres-accueil").innerHTML = "";
      aucunRevenu($("#graphique-accueil"));
    }
  }
}

// « Bonjour Marie » (prénom du profil) et initiale dans l'en-tête.
function salutation(profil) {
  const prenom = (profil.prenom || "").trim();
  $(".salutation").textContent = prenom ? `Bonjour ${prenom} !` : "Bonjour !";
  $("#avatar").textContent = (prenom || profil.nom || "?").trim().charAt(0).toUpperCase();
}

// Trois repères sous le bonjour : enfants accueillis, bulletins rangés, prochaine échéance.
function statsAccueil(r, ech, contrats) {
  const jour = new Date().toISOString().slice(0, 10);
  const accueillis = contrats.filter((c) => (!c.debut || c.debut <= jour) && !(c.fin && c.fin < jour)).length;
  const stats = [
    ["famille", "familles", "Enfants accueillis", accueillis],
    r && r.general.bulletins ? ["bulletin", "argent", `Bulletins rangés en ${r.annee}`, r.general.bulletins] : null,
    ech[0] ? ["calendrier", "demarches", "Prochaine échéance", dateCourte(ech[0].date)] : null,
  ].filter(Boolean);
  $("#stats-accueil").innerHTML = stats.map(([nom, cat, libelle, valeur]) =>
    `<li><span class="pic ${cat} grand">${picto(nom)}</span><span><span class="libelle-stat">${libelle}</span>
      <span class="valeur-stat">${valeur}</span></span></li>`).join("");
}

// ------------------------------------------------------------- agenda du tableau de bord
let echeancesAccueil = [];
let moisAgenda = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function afficherAgenda() {
  const premier = moisAgenda;
  const cle = isoJour(premier).slice(0, 7);
  $("#titre-mois").textContent = premier.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
  const parJour = {};
  echeancesAccueil.forEach((e) => (parJour[e.date] ??= []).push(e));
  const debut = new Date(premier);
  debut.setDate(1 - ((premier.getDay() + 6) % 7));        // lundi de la première semaine
  const aujourdhui = isoJour(new Date());
  const cases = [];
  for (let d = new Date(debut); cases.length < 42; d.setDate(d.getDate() + 1)) {
    const iso = isoJour(d);
    if (cases.length % 7 === 0 && cases.length >= 35 && iso.slice(0, 7) !== cle) break;
    const ech = parJour[iso] || [];
    cases.push(`<span class="jour${iso.slice(0, 7) !== cle ? " hors-mois" : ""}${iso === aujourdhui ? " aujourdhui" : ""}${
      ech.length ? (ech.some((e) => e.urgent) ? " a-echeance urgent" : " a-echeance") : ""}"${
      ech.length ? ` title="${echapper(ech.map((e) => e.titre).join(", "))}"` : ""}><span>${d.getDate()}</span></span>`);
  }
  $("#calendrier").innerHTML = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((j) => `<span class="nom-jour">${j}</span>`).join("")
    + cases.join("");
  // Mois en cours : les 3 prochaines échéances, même au-delà du mois (une échéance du 1er du mois suivant ne doit
  // pas disparaître derrière « aucune échéance ») ; autre mois : celles de ce mois.
  const liste = cle === aujourdhui.slice(0, 7)
    ? echeancesAccueil.filter((e) => e.date >= aujourdhui).slice(0, 3)
    : echeancesAccueil.filter((e) => e.date.startsWith(cle));
  $("#echeances-accueil").innerHTML = liste.length ? liste.map((e) => ligneEcheance(e, true)).join("")
    : `<li class="petit">Aucune échéance ${cle === aujourdhui.slice(0, 7) ? "à venir" : "ce mois-ci"}.</li>`;
  $$("#echeances-accueil [data-aller-vers]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerVers)));
}
$("#mois-precedent").addEventListener("click", () => { moisAgenda = new Date(moisAgenda.getFullYear(), moisAgenda.getMonth() - 1, 1); afficherAgenda(); });
$("#mois-suivant").addEventListener("click", () => { moisAgenda = new Date(moisAgenda.getFullYear(), moisAgenda.getMonth() + 1, 1); afficherAgenda(); });

// ------------------------------------------------------------- horaires du jour
// Le jour affiché : aujourd'hui tant qu'un enfant est encore là ou attendu, sinon le prochain jour d'accueil.
// Une ligne par plage d'accueil (un enfant avec une coupure apparaît deux fois), dans l'ordre d'arrivée.
// L'application ne connaît pas le calendrier des vacances scolaires : on choisit les horaires à utiliser.
let contratsAccueil = [];

function periodeChoisie(iso) {
  try {
    const p = JSON.parse(localStorage.getItem("periode-jour") || "{}");
    if (p.jour === iso) return p.valeur;
  } catch (e) { /* stockage indisponible */ }
  return "scolaire";
}

function plagesDuJour(d, periode) {
  const iso = isoJour(d);
  const nomJour = JOURS[(d.getDay() + 6) % 7];
  const lignes = [];
  contratsAccueil.filter((c) => (!c.debut || c.debut <= iso) && !(c.fin && c.fin < iso)).forEach((c) => {
    const v = enVigueur(c, iso);
    const vacances = Object.values(v.horaires_vacances || {}).some(Boolean);
    const horaires = periode === "vacances" && vacances ? v.horaires_vacances : v.horaires_scolaire;
    lirePlages((horaires || {})[nomJour]).forEach(([debut, fin]) => lignes.push({ c, debut, fin }));
  });
  return lignes.sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin));
}

function afficherJour() {
  const zone = $("#enfants-jour");
  if (!zone) return;
  const maintenant = new Date();
  const heure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;
  let jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  let lignes = plagesDuJour(jour, periodeChoisie(isoJour(jour)));
  if (!lignes.some((l) => l.fin > heure)) {
    lignes = [];
    for (let i = 1; i <= 14 && !lignes.length; i++) {
      jour = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() + 1);
      lignes = plagesDuJour(jour, periodeChoisie(isoJour(jour)));
    }
  }
  const iso = isoJour(jour);
  const ecart = Math.round((jour - new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())) / 86400000);
  const date = jour.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("#titre-jour").textContent = ecart === 0 ? `Aujourd'hui, ${date}` : ecart === 1 ? `Demain, ${date}` : date.replace(/^./, (c) => c.toUpperCase());
  const aVacances = contratsAccueil.some((c) => Object.values(enVigueur(c, iso).horaires_vacances || {}).some(Boolean));
  $("#choix-periode").classList.toggle("cache", !aVacances);
  $("#choix-periode").dataset.jour = iso;
  $$("#choix-periode input").forEach((i) => (i.checked = i.value === periodeChoisie(iso)));
  zone.innerHTML = lignes.length ? `<table class="tableau-jour">
      <thead><tr><th scope="col">Enfant</th><th scope="col">Arrivée</th><th scope="col">Départ</th></tr></thead>
      <tbody>${lignes.map((l) => `<tr><th scope="row"><span class="initiale ${couleurEnfant(l.c.enfant_prenom)}" aria-hidden="true">${
        echapper((l.c.enfant_prenom || "?").trim().charAt(0).toUpperCase())}</span>${echapper(l.c.enfant_prenom || "")}</th>
        <td>${versTexte(l.debut)}</td><td class="depart">${versTexte(l.fin)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="petit">${contratsAccueil.length ? "Aucun accueil prévu dans les deux prochaines semaines d'après les emplois du temps des fiches enfants."
      : "Ajoutez les fiches enfants (Familles et contrats) pour voir ici les horaires du jour."}</p>`;
}
$("#choix-periode").addEventListener("change", (e) => {
  try { localStorage.setItem("periode-jour", JSON.stringify({ jour: $("#choix-periode").dataset.jour, valeur: e.target.value })); }
  catch (err) { /* stockage indisponible : le choix vaut jusqu'au prochain affichage */ }
  afficherJour();
});

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
      « Paramètres » : il vous ferait déclarer ${euros(t.ecart)} de plus.</p>`;
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
      des bulletins seront rangés dans le dossier choisi dans « Paramètres ».</p>`;
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
// Pictogramme (et couleur de catégorie) de chaque type d'échéance, et libellé du lien vers la rubrique où agir.
const PICTO_ECHEANCE = { bulletins: ["bulletin", "argent"], impots: ["impots", "argent"], agrement: ["agrement", "demarches"],
  assurance: ["assurance", "demarches"], conges: ["calendrier", "familles"], contrat: ["contrat", "familles"],
  anniversaire: ["anniversaire", "familles"], activite: ["activite", "familles"] };
const ACTION_ECHEANCE = { bulletins: "Bulletins", profil: "Mon profil", impots: "Impôts", contrats: "Familles", courriers: "Courriers",
  ateliers: "Activités" };

function dateCourte(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${d.toLocaleDateString("fr-FR", { month: "short" })}`
    + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "");
}

// compact : pour le tableau de bord (date et lien sous le titre, sans le détail).
function ligneEcheance(e, compact = false) {
  const [nom, categorie] = PICTO_ECHEANCE[e.type] || ["calendrier", "demarches"];
  const lien = e.aller && ACTION_ECHEANCE[e.aller]
    ? `<button class="lien lien-echeance" data-aller-vers="${e.aller}">${ACTION_ECHEANCE[e.aller]}</button>` : "";
  const quand = `<span class="quand">${dateCourte(e.date)}</span>`;
  if (compact) return `<li class="${e.urgent ? "urgent" : ""}">${pastille(nom, categorie)}<span class="corps">${echapper(e.titre)}
    <span class="detail">${quand}${lien ? ` · ${lien}` : ""}</span></span></li>`;
  return `<li class="${e.urgent ? "urgent" : ""}">${pastille(nom, categorie)}
    <span class="corps">${echapper(e.titre)}${e.detail ? `<span class="detail">${echapper(e.detail)}</span>` : ""}</span>
    ${quand}<span class="zone-lien">${lien}</span></li>`;
}

async function afficherEcheances() {
  const ech = await api("echeances").catch(() => []);
  const limite = new Date();
  limite.setMonth(limite.getMonth() + 2);
  const bientot = ech.filter((e) => e.date <= limite.toISOString().slice(0, 10));
  const plusTard = ech.slice(bientot.length);
  const groupe = (titre, liste) => liste.length ? `<h2 class="groupe-echeances">${titre}</h2>
    <ul class="liste-echeances">${liste.map((e) => ligneEcheance(e)).join("")}</ul>` : "";
  $("#liste-echeances").innerHTML = ech.length ? groupe("Dans les deux prochains mois", bientot) + groupe("Plus tard", plusTard)
    : `<p class="petit">Aucune échéance connue pour l'instant.</p>`;
  $$("#liste-echeances [data-aller-vers]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerVers)));
  appliquerFiltres();
}

// ------------------------------------------------------------- contrats
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const PERIODES = { scolaire: "Période scolaire", vacances: "Vacances scolaires" };
// Conditions qu'un avenant peut changer (même liste que donnees.MODIFIABLES).
const MODIFIABLES = ["semaines", "accueil", "tarif_horaire", "entretien_jour", "repas_jour", "horaires_scolaire", "horaires_vacances",
  "delai_prevenance", "planning", "delai_planning", "tarif_complementaire", "taux_majoration", "repas_fournis", "frais_km",
  "jour_paiement", "repos_jour", "repos_travaille", "premier_mai", "feries_travailles", "ferie_majoration", "conges_paiement",
  "conditions_particulieres"];
const CHAMPS_SIMPLES = MODIFIABLES.filter((k) => !k.startsWith("horaires") && k !== "feries_travailles");
// Valeurs proposées pour une nouvelle fiche (les autres champs commencent vides).
const DEFAUTS_CONTRAT = { semaines: "52", taux_majoration: "10", ferie_majoration: "10", repos_jour: "dimanche",
  premier_mai: "chome" };
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
// Saisie en cours : « fiche » (formulaire sur une page), ou assistant plein écran : « nouveau » (ajout d'un enfant),
// « modification » (contrat existant), « avenant ».
let modeSaisie = "fiche";
const ETAPES_AVENANT = ["avenant", "horaires", "remuneration", "repos", "feries", "conges", "signature"];
let suggestions = { familles: [], champs: {} };

// --- emploi du temps : heures d'arrivée et de départ, une deuxième plage possible (coupure)
// Icônes des outils de chaque plage horaire : copier, coller, vider.
const ICONES = {
  copier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  coller: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/></svg>',
  vider: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const TITRES_OUTILS = { copier: "Copier cette plage", coller: "Coller la plage copiée ici", vider: "Vider cette plage" };
const plage = (periode, jour, n) => `<span class="plage" data-plage="${n}">
  <input type="time" step="300" data-h="${periode}.${jour}.${n}.debut" aria-label="${PERIODES[periode]}, ${jour}, arrivée${n ? " (2e plage)" : ""}">
  <span aria-hidden="true">à</span>
  <input type="time" step="300" data-h="${periode}.${jour}.${n}.fin" aria-label="${PERIODES[periode]}, ${jour}, départ${n ? " (2e plage)" : ""}">
  <span class="outils-plage">${Object.keys(ICONES).map((o) => `<button type="button" class="icone" data-outil="${o}"
    data-cible="${periode}.${jour}.${n}" title="${TITRES_OUTILS[o]}" aria-label="${TITRES_OUTILS[o]} (${jour})">${ICONES[o]}</button>`).join("")}</span></span>`;
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

// Champ calculé : valeur bien visible (« — » quand elle ne peut pas encore être calculée) et précision dessous.
function calcule(id, valeur, aide = "") {
  $("#" + id).textContent = valeur || "—";
  $("#" + id).closest(".champ-calcule").classList.toggle("vide", !valeur);
  const zone = $(`#${id}-aide`);
  if (zone) zone.textContent = aide;
}

// À chaque montant brut, son équivalent net indicatif. Heures complémentaires et heures majorées : le
// pourcentage et le salaire horaire majoré sont liés, chacun se calcule quand on modifie l'autre.
const montantFr = (v) => (v ? v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const pourcentFr = (v) => (Math.round(v * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

function afficherNetHoraire(source = "chargement") {
  const el = formContrat.elements;
  const brut = nombreFr(el.tarif_horaire.value);
  const tauxComp = $("#taux-complementaire"), tarifMajore = $("#tarif-majore");
  // Heures complémentaires : sans majoration, les deux champs restent vides.
  if (source === "taux-complementaire" || (source === "tarif_horaire" && tauxComp.value.trim()))
    el.tarif_complementaire.value = brut && tauxComp.value.trim() ? montantFr(brut * (1 + nombreFr(tauxComp.value) / 100)) : "";
  else if (source !== "tarif_horaire" || !tauxComp.value.trim()) {
    const comp = nombreFr(el.tarif_complementaire.value);
    tauxComp.value = brut && comp ? pourcentFr((comp / brut - 1) * 100) : "";
  }
  // Heures majorées (au-delà de 45 h) : 10 % au moins.
  if (source === "tarif-majore") {
    const tm = nombreFr(tarifMajore.value);
    el.taux_majoration.value = brut && tm ? pourcentFr((tm / brut - 1) * 100) : "";
  } else tarifMajore.value = brut ? montantFr(brut * (1 + (nombreFr(el.taux_majoration.value) || 10) / 100)) : "";
  const taux = el.taux_majoration.value.trim() ? nombreFr(el.taux_majoration.value) : 10;
  el.taux_majoration.setCustomValidity(taux < 10 ? "La majoration des heures au-delà de 45 h est de 10 % au moins." : "");
  [tauxComp, el.tarif_complementaire, el.taux_majoration, tarifMajore].forEach((c) => c.classList.toggle("rempli", !!c.value.trim()));

  const t = suggestions.taux_net;
  const source_ = t?.source === "bulletins" ? `cotisations de vos derniers bulletins : ${Math.round(100 * (1 - t.taux))} % du brut`
    : "environ 22 % de cotisations";
  calcule("net-horaire", brut ? `${euros(brut * tauxNet(), 2)} net` : "", brut ? `Estimation : ${source_}.` : "Indiquez le salaire brut.");
  const comp = nombreFr(el.tarif_complementaire.value);
  calcule("net-complementaire", comp ? `${euros(comp * tauxNet(), 2)} net` : brut ? `${euros(brut * tauxNet(), 2)} net` : "",
    comp ? "" : "Sans majoration : au tarif normal.");
  const tm = nombreFr(tarifMajore.value);
  calcule("net-majore", tm ? `${euros(tm * tauxNet(), 2)} net` : "", taux < 10 ? "10 % au moins." : "");
}
$("#taux-complementaire").addEventListener("input", () => afficherNetHoraire("taux-complementaire"));
formContrat.elements.tarif_complementaire.addEventListener("input", () => afficherNetHoraire("tarif_complementaire"));
formContrat.elements.taux_majoration.addEventListener("input", () => afficherNetHoraire("taux_majoration"));
$("#tarif-majore").addEventListener("input", () => afficherNetHoraire("tarif-majore"));
formContrat.elements.tarif_horaire.addEventListener("input", () => { afficherNetHoraire("tarif_horaire"); afficherResume(); });
["entretien_jour", "repas_jour"].forEach((k) => formContrat.elements[k].addEventListener("input", afficherResume));

// Semaines d'école dans l'année (calendrier scolaire), pour estimer la mensualisation quand les
// horaires des vacances sont différents.
const SEMAINES_ECOLE = 36;
// Heures et jours d'accueil par mois en moyenne : semaines programmées réparties entre école et vacances.
function mensuel(semaines, scolaire, vacances, differentes) {
  const sEcole = differentes ? Math.min(SEMAINES_ECOLE, semaines) : semaines;
  const sVacances = differentes ? semaines - sEcole : 0;
  const hVac = vacances?.total || 0, jVac = vacances?.jours.length || 0;
  return { sEcole, sVacances, hVac, heuresMois: (scolaire.total * sEcole + hVac * sVacances) / 12,
    joursMois: (scolaire.jours.length * sEcole + jVac * sVacances) / 12 };
}

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
    const { sEcole, sVacances, hVac, heuresMois, joursMois } = mensuel(semaines, scolaire, vacances, differentes);
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
  calcule("cas-contrat", incomplete ? "Année incomplète (cas n° 2)" : "Année complète (cas n° 1)",
    !incomplete ? "Accueil sur 52 semaines, congés compris." : semaines <= 46 ? "46 semaines d'accueil ou moins, hors congés."
    : "Le modèle de l'Urssaf prévoit 52 semaines, ou 46 au plus : le contrat sera rempli comme une année incomplète.");
}
formContrat.elements.planning.addEventListener("change", afficherCas);
formContrat.elements.frais_km.addEventListener("input", afficherResume);

// --- période d'essai : case « il y a une période d'essai », nombre + unité, dernier jour calculé.
// Enregistrée en texte (« 2 mois », « aucune » quand il n'y en a pas).
const ESSAI_DEFAUT = "2 mois";
function ecrireEssai(texte) {
  const aucune = texte === "aucune" || !texte;
  const m = /(\d+)\s*(jour|semaine|mois)/i.exec(texte || "");
  $("#essai-oui").checked = !aucune;
  $("#essai-nombre").value = m ? m[1] : "2";
  $("#essai-unite").value = m ? { jour: "jours", semaine: "semaines", mois: "mois" }[m[2].toLowerCase()] : "mois";
  afficherEssai();
}
function lireEssai() {
  const n = parseInt($("#essai-nombre").value, 10);
  if (!$("#essai-oui").checked) return "aucune";
  if (!n) return "";
  return `${n} ${n === 1 ? { jours: "jour", semaines: "semaine", mois: "mois" }[$("#essai-unite").value] : $("#essai-unite").value}`;
}
function afficherEssai() {
  const oui = $("#essai-oui").checked;
  $("#ligne-essai").classList.toggle("cache", !oui);
  $("#essai-nombre").required = oui && formContrat.classList.contains("assistant");
  formContrat.elements.essai.value = lireEssai();
  const n = parseInt($("#essai-nombre").value, 10);
  const debut = formContrat.elements.debut.value;
  let fin = "";
  if (oui && n && debut) {
    const d = new Date(debut + "T12:00:00");
    const unite = $("#essai-unite").value;
    if (unite === "mois") d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * (unite === "semaines" ? 7 : 1));
    d.setDate(d.getDate() - 1);
    fin = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  calcule("fin-essai", fin, fin || !n ? "" : "D'après la date d'embauche, à indiquer plus haut.");
}
["#essai-oui", "#essai-nombre", "#essai-unite"].forEach((c) => $(c).addEventListener("input", afficherEssai));
$("#essai-oui").addEventListener("change", afficherEssai);

// --- période d'adaptation : nombre de jours calendaires calculé d'après les dates (30 au plus).
function calculerAdaptation() {
  const el = formContrat.elements;
  if (el.adaptation_fin.value && !el.adaptation_debut.value) el.adaptation_debut.value = el.debut.value;
  const du = el.adaptation_debut.value, au = el.adaptation_fin.value;
  const jours = du && au ? Math.round((new Date(au + "T12:00:00") - new Date(du + "T12:00:00")) / 864e5) + 1 : 0;
  el.adaptation_jours.value = jours > 0 ? String(jours) : "";
  const message = du && au && jours < 1 ? "Le dernier jour doit être après le premier."
    : jours > 30 ? "La période d'adaptation dure 30 jours calendaires au plus." : "";
  el.adaptation_fin.setCustomValidity(message);
  calcule("jours-adaptation", jours > 0 ? `${jours} jour${jours > 1 ? "s" : ""}` : "", message || (jours > 0 ? "Jours calendaires, 30 au plus." : ""));
}
formContrat.elements.adaptation_debut.addEventListener("input", calculerAdaptation);
formContrat.elements.adaptation_fin.addEventListener("input", calculerAdaptation);

$("#horaires-contrat").addEventListener("input", afficherResume);
let plageCopiee = null;     // [arrivée, départ] de la dernière plage copiée
$("#horaires-contrat").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.outil) {
    const [p, j, n] = b.dataset.cible.split(".");
    const debut = champH(p, j, n, "debut"), fin = champH(p, j, n, "fin");
    if (b.dataset.outil === "copier") {
      if (!debut.value && !fin.value) return;
      plageCopiee = [debut.value, fin.value];
      $("#horaires-contrat").classList.add("a-coller");
      $$("#horaires-contrat .plage.copiee").forEach((x) => x.classList.remove("copiee"));
      b.closest(".plage").classList.add("copiee");
    } else if (b.dataset.outil === "coller" && plageCopiee) [debut.value, fin.value] = plageCopiee;
    else if (b.dataset.outil === "vider") { debut.value = ""; fin.value = ""; }
    marquerRemplis(b.closest(".plage"));
    afficherResume();
    return;
  }
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
  repas_fournis: "repas fournis par", frais_km: "frais de déplacement", jour_paiement: "date de paiement du salaire",
  repos_jour: "jour de repos", repos_travaille: "travail le jour de repos", premier_mai: "1er mai",
  feries_travailles: "jours fériés travaillés", ferie_majoration: "majoration des jours fériés",
  conges_paiement: "paiement des congés payés", conditions_particulieres: "conditions particulières" };
// Les horaires sont comparés jour par jour (l'ordre des clés reçues du serveur peut varier).
const enTexte = (v) => (v && typeof v === "object" ? JOURS.map((j) => v[j] || "").join("|") : String(v ?? "").trim());
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
  v.feries_travailles = lireFeries();
  v.horaires_scolaire = lireHoraires("scolaire");
  v.horaires_vacances = $("#vacances-differentes").checked ? lireHoraires("vacances") : {};
  if (versionActive) {
    const [date, motif] = champsDateAvenant();
    v.date = date.value; v.motif = motif.value.trim();
    // Avenant saisi avec l'assistant : la signature est celle de l'avenant, pas celle du contrat.
    if (modeSaisie === "avenant") { v.signature_lieu = formContrat.elements.signature_lieu.value; v.signature_date = formContrat.elements.signature_date.value; }
  }
}
// Date d'effet et objet de l'avenant : dans l'en-tête des onglets, ou à la première étape de l'assistant.
const champsDateAvenant = () => (modeSaisie === "avenant" ? [$("#av-date"), $("#av-motif")] : [$("#avenant-date"), $("#avenant-motif")]);

function chargerVersion(i) {
  versionActive = i;
  const v = versions[i];
  CHAMPS_SIMPLES.forEach((k) => {
    const champ = formContrat.elements[k];
    champ.value = v[k] || DEFAUTS_CONTRAT[k] || (champ.tagName === "SELECT" ? champ.options[0].value : "");
  });
  ecrireFeries(v.feries_travailles);
  ecrireHoraires("scolaire", v.horaires_scolaire);
  ecrireHoraires("vacances", v.horaires_vacances);
  $("#vacances-differentes").checked = Object.values(v.horaires_vacances || {}).some((x) => x);
  $("#entete-avenant").classList.toggle("cache", !i);
  $("#boutons-avenant").classList.toggle("cache", !i);
  if (i) {
    const [date, motif] = champsDateAvenant();
    date.value = v.date || "";
    motif.value = v.motif || "";
    if (modeSaisie === "avenant") {
      formContrat.elements.signature_lieu.value = v.signature_lieu || "";
      formContrat.elements.signature_date.value = v.signature_date || "";
    }
    const avant = versions[i - 1];
    const changes = MODIFIABLES.filter((k) => !memeValeur(v[k], avant[k])).map((k) => LIBELLES[k]);
    $("#changements-avenant").textContent = changes.length
      ? `Ce qui change par rapport ${i > 1 ? "à l'avenant précédent" : "au contrat initial"} : ${changes.join(", ")}.`
      : "Modifiez ci-dessous les conditions qui changent à partir de cette date.";
  }
  afficherOngletsVersions();
  afficherColonneVacances();
  afficherNetHoraire();
  actualiserRetablir();
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

// --- avenant : à côté de chaque condition modifiée, une icône rétablit la valeur d'avant l'avenant.
const ICONE_RETABLIR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>';
const boutonRetablir = (cle, quoi) => `<button type="button" class="icone retablir" data-retablir="${cle}"
  title="Rétablir l'ancienne valeur" aria-label="Rétablir l'ancienne valeur : ${echapper(quoi)}">${ICONE_RETABLIR}</button>`;
const valeurAffichee = (k, v) => { const champ = formContrat.elements[k];
  return String(v[k] || DEFAUTS_CONTRAT[k] || (champ.tagName === "SELECT" ? champ.options[0]?.value ?? "" : "")).trim(); };
const avantAvenant = () => (modeSaisie === "avenant" && versionActive ? versions[versionActive - 1] : null);

function actualiserRetablir() {
  const avant = avantAvenant();
  if (!avant) {
    $$("#form-contrat .retablir").forEach((b) => b.classList.add("cache"));
    $$("#form-contrat .modifie").forEach((x) => x.classList.remove("modifie"));
    return;
  }
  CHAMPS_SIMPLES.forEach((k) => {
    const champ = formContrat.elements[k];
    const intitule = champ.closest("label")?.querySelector(".intitule");
    if (!intitule) return;
    let b = intitule.querySelector(".retablir");
    if (!b) { intitule.querySelector(".mention")?.insertAdjacentHTML("beforebegin", boutonRetablir(k, LIBELLES[k]));
      if (!(b = intitule.querySelector(".retablir"))) { intitule.insertAdjacentHTML("beforeend", boutonRetablir(k, LIBELLES[k])); b = intitule.querySelector(".retablir"); } }
    const ancienne = valeurAffichee(k, avant);
    const change = champ.value.trim() !== ancienne;
    b.classList.toggle("cache", !change);
    const texte = champ.tagName === "SELECT" ? [...champ.options].find((o) => o.value === ancienne)?.textContent.trim() : ancienne;
    b.title = `Rétablir l'ancienne valeur : ${texte && texte !== "—" ? texte : "vide"}`;
    champ.classList.toggle("modifie", change);
  });
  const scolaire = lireHoraires("scolaire"), vacances = $("#vacances-differentes").checked ? lireHoraires("vacances") : {};
  JOURS.forEach((j) => {
    const th = $(`#horaires-contrat tbody tr:nth-child(${JOURS.indexOf(j) + 1}) th`);
    if (!th.querySelector(".retablir")) th.insertAdjacentHTML("beforeend", boutonRetablir("jour:" + j, `horaires du ${j}`));
    const change = (scolaire[j] || "") !== (avant.horaires_scolaire?.[j] || "") || (vacances[j] || "") !== (avant.horaires_vacances?.[j] || "");
    th.querySelector(".retablir").classList.toggle("cache", !change);
    th.closest("tr").classList.toggle("modifie", change);
  });
  const titreFeries = $("#cases-feries").previousElementSibling.previousElementSibling;
  if (!titreFeries.querySelector(".retablir")) titreFeries.insertAdjacentHTML("beforeend", boutonRetablir("feries", "jours fériés travaillés"));
  titreFeries.querySelector(".retablir").classList.toggle("cache", lireFeries() === (avant.feries_travailles || ""));
}

formContrat.addEventListener("click", (e) => {
  const b = e.target.closest("[data-retablir]");
  const avant = avantAvenant();
  if (!b || !avant) return;
  e.preventDefault();          // le bouton est dans un libellé : pas de clic transmis au champ
  const cle = b.dataset.retablir;
  if (cle === "feries") ecrireFeries(avant.feries_travailles);
  else if (cle.startsWith("jour:")) {
    const j = cle.slice(5);
    ["scolaire", "vacances"].forEach((p) => {
      const plages = lirePlages(avant[`horaires_${p}`]?.[j]);
      [0, 1].forEach((n) => { champH(p, j, n, "debut").value = plages[n]?.[0] || ""; champH(p, j, n, "fin").value = plages[n]?.[1] || ""; });
      afficherCoupure(p, j, plages.length > 1);
    });
    if (avant.horaires_vacances?.[j] && !$("#vacances-differentes").checked) {
      $("#vacances-differentes").checked = true;
      afficherColonneVacances();
    }
    afficherResume();
  } else {
    const champ = formContrat.elements[cle];
    champ.value = valeurAffichee(cle, avant);
    champ.dispatchEvent(new Event("input", { bubbles: true }));
    champ.dispatchEvent(new Event("change", { bubbles: true }));
  }
  marquerRemplis(formContrat);
  actualiserRetablir();
});
["input", "change"].forEach((t) => formContrat.addEventListener(t, () => { if (avantAvenant()) actualiserRetablir(); }));

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
// Icônes de la liste des familles et de la fiche d'un enfant (même tracé que les outils des horaires).

// Conditions de chaque version du contrat : contrat initial, puis un objet par avenant. Un avenant ancien
// reprend les conditions précédentes pour les rubriques qu'il ne contient pas.
function versionsDe(c) {
  const liste = [conditions(c)];
  for (const a of c?.avenants || [])
    liste.push({ ...structuredClone(liste[liste.length - 1]),
      ...Object.fromEntries(MODIFIABLES.filter((k) => k in a).map((k) => [k, structuredClone(a[k])])),
      id: a.id, date: a.date, motif: a.motif, signature_lieu: a.signature_lieu || "", signature_date: a.signature_date || "" });
  return liste;
}
const changementsEntre = (avant, apres) => MODIFIABLES.filter((k) => !memeValeur(avant[k], apres[k])).map((k) => LIBELLES[k]);

let enfantOuvert = "";          // fiche enfant dépliée (id), gardée quand la liste est redessinée
// Familles repliées par défaut ; celles que l'on ouvre restent ouvertes tant que l'application est affichée.
const famillesOuvertes = new Set();

const TYPES_ACCUEIL = { journee: "accueil à la journée", periscolaire: "accueil périscolaire" };
const PAIEMENT_CONGES = { juin: "payés en juin", principale: "payés lors des congés principaux", prorata: "payés au fur et à mesure" };

// Résumé du contrat tel qu'il s'applique aujourd'hui, avenants compris.
function resumeEnVigueur(c, v) {
  const lignes = [];
  const ligne = (titre, valeur, detail = "") => valeur && lignes.push(`<div><dt>${titre}</dt><dd>${valeur}${detail ? `<span class="petit">${detail}</span>` : ""}</dd></div>`);
  const scolaire = resumeSemaine(v.horaires_scolaire || {});
  const differentes = Object.values(v.horaires_vacances || {}).some(Boolean);
  const vacances = differentes ? resumeSemaine(v.horaires_vacances) : null;
  const semaines = Math.min(52, Math.max(0, parseInt(v.semaines, 10) || 52));
  ligne("Accueil", `${semaines} semaines par an`, `${semaines < 52 ? "année incomplète" : "année complète"} · ${TYPES_ACCUEIL[v.accueil] || "accueil à la journée"}`);
  if (scolaire) ligne(differentes ? "Période scolaire" : "Horaires", `${heuresFr(scolaire.total)} par semaine`, scolaire.detail);
  if (vacances) ligne("Vacances scolaires", `${heuresFr(vacances.total)} par semaine`, vacances.detail);
  else if (differentes) ligne("Vacances scolaires", "pas d'accueil");
  const tarif = nombreFr(v.tarif_horaire);
  if (tarif) ligne("Salaire horaire", `${euros(tarif, 2)} brut`, `≈ ${euros(tarif * tauxNet(), 2)} net`);
  const m = scolaire && mensuel(semaines, scolaire, vacances, differentes);
  if (m) ligne("Mensualisation", `${heuresFr(m.heuresMois)} par mois`, tarif ? `${euros(m.heuresMois * tarif)} brut, ≈ ${euros(m.heuresMois * tarif * tauxNet())} net` : "");
  const indemnites = [nombreFr(v.entretien_jour) && `entretien ${euros(nombreFr(v.entretien_jour), 2)}`,
    nombreFr(v.repas_jour) && `repas ${euros(nombreFr(v.repas_jour), 2)}`].filter(Boolean);
  if (indemnites.length) ligne("Indemnités par jour", indemnites.join(", "));
  if (v.jour_paiement) ligne("Paiement du salaire", `le ${echapper(v.jour_paiement)} du mois`, PAIEMENT_CONGES[v.conges_paiement] ? `congés ${PAIEMENT_CONGES[v.conges_paiement]}` : "");
  return lignes.length ? `<dl class="resume-contrat">${lignes.join("")}</dl>` : `<p class="petit">Conditions à compléter : « Modifier le contrat ».</p>`;
}

// Âge court pour les cartes : « 8 mois », « 1 an », « 3 ans ».
function ageCourt(naissance) {
  if (!naissance) return "";
  const n = new Date(naissance + "T12:00:00"), j = new Date();
  const mois = (j.getFullYear() - n.getFullYear()) * 12 + j.getMonth() - n.getMonth() - (j.getDate() < n.getDate() ? 1 : 0);
  if (mois < 0 || isNaN(mois)) return "";
  return mois < 12 ? `${mois} mois` : `${Math.floor(mois / 12)} an${mois >= 24 ? "s" : ""}`;
}
// Couleur de l'initiale : toujours la même pour un prénom donné.
const couleurEnfant = (prenom) => ["argent", "familles", "demarches", "moi"][[...(prenom || "")].reduce((s, c) => s + c.charCodeAt(0), 0) % 4];

function carteEnfant(c, aujourdhui, famille) {
  const carte = document.createElement("article");
  const termine = c.fin && c.fin < aujourdhui;
  const v = enVigueur(c, aujourdhui);
  const semaine = resumeSemaine(v.horaires_scolaire || {});
  const nb = (c.avenants || []).length;
  const ouverte = enfantOuvert === c.id;
  const nom = `${echapper(c.enfant_prenom)} ${echapper(c.enfant_nom || "")}`;
  carte.className = "carte-contrat enfant" + (termine ? " termine" : "") + (ouverte ? " ouverte" : "");
  carte.dataset.contrat = c.id;
  Object.assign(carte, { _contrat: c, _famille: famille });
  const age = ageCourt(c.enfant_naissance);
  const jours = semaine ? (semaine.jours.length === 5 && semaine.jours[0] === "lundi" && semaine.jours[4] === "vendredi"
    ? "du lundi au vendredi" : semaine.jours.map((j) => j.slice(0, 3) + ".").join(" ")) : "";
  carte.innerHTML = `<button type="button" class="entete-carte" aria-expanded="${ouverte}">
      <span class="initiale ${couleurEnfant(c.enfant_prenom)}" aria-hidden="true">${echapper((c.enfant_prenom || "?").trim().charAt(0).toUpperCase())}</span>
      <span class="nom">${nom}${age ? ` <span class="age">· ${age}</span>` : ""}</span>
      <span class="petit">${v.accueil === "periscolaire" ? "Périscolaire" : `${v.semaines || 52} semaines par an`}${
        semaine ? ` · ${heuresFr(semaine.total)} par semaine, ${jours}` : ""}</span>
      <span class="petit">${c.debut ? `Depuis le ${dateFr(c.debut)}` : "Date de début à compléter"}${termine ? " · terminé" : ""}${
        nb ? ` · ${nb} avenant${nb > 1 ? "s" : ""}` : ""}</span>
      <span class="chevron" aria-hidden="true">${picto("chevron")}</span>
      <span class="sr-only">${ouverte ? "Refermer" : "Ouvrir"} la fiche de ${nom}</span>
    </button>`;
  carte.querySelector(".entete-carte").addEventListener("click", () => basculerEnfant(c, carte, aujourdhui, famille));
  if (ouverte) carte.appendChild(dossierEnfant(c, aujourdhui));
  return carte;
}

function basculerEnfant(c, carte, aujourdhui, famille) {
  const remplacer = (id) => {
    const ancienne = $(`#liste-familles-contrats [data-contrat="${CSS.escape(id)}"]`);
    if (ancienne) ancienne.replaceWith(carteEnfant(ancienne._contrat, aujourdhui, ancienne._famille));
  };
  const avant = enfantOuvert;
  enfantOuvert = avant === c.id ? "" : c.id;
  if (avant && avant !== c.id) remplacer(avant);
  const nouvelle = carteEnfant(c, aujourdhui, famille);
  carte.replaceWith(nouvelle);
  nouvelle.querySelector(".entete-carte").focus({ preventScroll: true });
  if (enfantOuvert) nouvelle.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Fiche dépliée : contrat en vigueur, historique (contrat initial puis avenants), documents, actions.
function dossierEnfant(c, aujourdhui) {
  const div = document.createElement("div");
  div.className = "dossier-enfant";
  const liste = versionsDe(c);
  const v = enVigueur(c, aujourdhui);
  const enCours = (i) => (c.avenants || []).filter((a) => a.date && a.date <= aujourdhui).length === i;
  const historique = liste.map((x, i) => {
    const changes = i ? changementsEntre(liste[i - 1], x) : [];
    const futur = i && x.date > aujourdhui;
    return `<li class="${enCours(i) ? "en-cours" : ""}">
      <p class="titre-version">${i ? `Avenant n° ${i}` : "Contrat de travail"}${enCours(i) ? ` <span class="etat-version">en vigueur</span>` : ""}${
        futur ? ` <span class="etat-version a-venir">à venir</span>` : ""}</p>
      <p class="petit">${i ? `À partir du ${dateFr(x.date)}${x.motif ? ` · ${echapper(x.motif)}` : ""}` : c.debut ? `Depuis le ${dateFr(c.debut)}` : "Date de début à compléter"}</p>
      ${i ? `<p class="petit">${changes.length ? `Change : ${changes.join(", ")}.` : "Aucune condition modifiée."}</p>
        <div class="actions-version">
          <button type="button" class="action" data-pdf-avenant="${echapper(x.id)}">${picto("pdf")}PDF de l'avenant</button>
          <button type="button" class="action" data-modifier-avenant="${echapper(x.id)}">${picto("modifier")}Modifier</button>
          <button type="button" class="action danger" data-supprimer-avenant="${echapper(x.id)}">${picto("supprimer")}Supprimer</button>
        </div>` : ""}
    </li>`;
  }).join("");
  div.innerHTML = `
    <div class="barre-dossier">
      <button type="button" class="principal" data-avenant>${picto("avenant")}Créer un avenant</button>
      <button type="button" class="secondaire" data-modifier-contrat>${picto("modifier")}Modifier le contrat de travail</button>
      <button type="button" class="secondaire" data-pdf-contrat>${picto("pdf")}Contrat de travail (PDF)</button>
    </div>
    <div class="resultat-dossier" role="status"></div>
    <div class="colonnes-dossier">
      <section class="contrat-aujourdhui"><h3>Contrat aujourd'hui</h3>
        <p class="petit">${(c.avenants || []).some((a) => a.date && a.date <= aujourdhui) ? "Conditions du contrat, avenants compris." : "Conditions du contrat de travail."}</p>
        ${resumeEnVigueur(c, v)}</section>
      <div class="suivi-contrat">
        <section><h3>Historique du contrat</h3><ol class="historique">${historique}</ol></section>
        <section><h3>Documents</h3><ul class="documents" data-documents><li class="petit">Chargement…</li></ul></section>
      </div>
    </div>
    <p class="pied-dossier"><button type="button" class="lien" data-une-page>Modifier la fiche sur une seule page</button>
      <button type="button" class="lien danger" data-supprimer-fiche>${picto("supprimer")}Supprimer la fiche</button></p>`;
  const resultat = div.querySelector(".resultat-dossier");
  div.querySelector("[data-avenant]").addEventListener("click", () => ouvrirAssistant(c, "avenant"));
  div.querySelector("[data-modifier-contrat]").addEventListener("click", () => ouvrirAssistant(c, "modification"));
  div.querySelector("[data-pdf-contrat]").addEventListener("click", () => creerContratTravail(c.id, resultat));
  div.querySelector("[data-une-page]").addEventListener("click", () => editerContrat(c));
  div.querySelector("[data-supprimer-fiche]").addEventListener("click", async () => {
    if (!confirm(`Supprimer la fiche de ${c.enfant_prenom} ? Son contrat et ses avenants seront effacés de l'application (les PDF déjà créés restent dans votre dossier).`)) return;
    try { await api("contrats/supprimer", { id: c.id }); } catch (err) { alert(err.message); return; }
    enfantOuvert = "";
    afficherContrats();
  });
  div.querySelectorAll("[data-pdf-avenant]").forEach((b) => b.addEventListener("click", () => creerAvenantPdf(c.id, b.dataset.pdfAvenant, resultat)));
  div.querySelectorAll("[data-modifier-avenant]").forEach((b) => b.addEventListener("click", () => ouvrirAssistant(c, "avenant", b.dataset.modifierAvenant)));
  div.querySelectorAll("[data-supprimer-avenant]").forEach((b) => b.addEventListener("click", async () => {
    const n = (c.avenants || []).findIndex((a) => a.id === b.dataset.supprimerAvenant) + 1;
    if (!confirm(`Supprimer l'avenant n° ${n} ? Les conditions précédentes s'appliqueront de nouveau (le PDF déjà créé reste dans votre dossier).`)) return;
    try { await api("contrats", { ...c, avenants: c.avenants.filter((a) => a.id !== b.dataset.supprimerAvenant) }); } catch (err) { alert(err.message); return; }
    afficherContrats();
  }));
  rafraichirDocuments(c.id, div.querySelector("[data-documents]"));
  return div;
}

// Documents créés pour un enfant (contrat de travail, avenants) : un lien ouvre le PDF.
async function rafraichirDocuments(contratId, zone) {
  zone ??= $(`#liste-familles-contrats [data-contrat="${CSS.escape(contratId || "")}"] [data-documents]`);
  if (!zone || !contratId) return;
  const docs = await api("documents?contrat_id=" + encodeURIComponent(contratId)).catch(() => []);
  zone.innerHTML = docs.length ? docs.map((d, i) => `<li class="${d.existe ? "" : "introuvable"}">
      ${picto(d.existe ? "pdf" : "introuvable")}
      <span><strong>${echapper(d.titre)}</strong><span class="petit">${d.existe ? `créé le ${dateFr(d.date.slice(0, 10))}`
        : "fichier déplacé ou supprimé : recréez-le"}</span></span>
      ${d.existe ? `<button type="button" class="action" data-doc="${i}">${picto("ouvrir")}Ouvrir</button>` : ""}</li>`).join("")
    : `<li class="petit">Aucun document pour l'instant. Le contrat de travail et les avenants créés en PDF apparaîtront ici.</li>`;
  zone.querySelectorAll("[data-doc]").forEach((b) => b.addEventListener("click", () =>
    api("ouvrir", { quoi: docs[+b.dataset.doc].chemin }).catch((err) => alert(err.message))));
}

// Informations de la famille : une ligne par information, chacune avec son pictogramme.
const QUALITES = { mere: "mère", pere: "père", tuteur: "tuteur" };
function infosFamille(f) {
  const ligne = (icone, titre, valeur) => `<li><span class="picto-info" title="${titre}">${picto(icone)}</span>
    <span class="texte-info"><span class="sr-only">${titre} : </span>${valeur}</span></li>`;
  const parent = (n) => {
    const nom = [f[`parent${n}_civilite`], f[`parent${n}_prenom`], f[`parent${n}_nom`]].filter(Boolean).join(" ");
    const qualite = n === 1 ? (f.parent1_qualite === "autre" ? f.parent1_qualite_autre : QUALITES[f.parent1_qualite]) : "";
    return nom && `${echapper(nom)}${qualite ? ` <span class="petit">(${echapper(qualite)})</span>` : ""}`;
  };
  const parents = [parent(1), parent(2)].filter(Boolean);
  const adresse = [f.adresse, [f.code_postal, f.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const lignes = [ligne("famille", "Parents", parents.length ? parents.join("<br>") : `<span class="petit">Parents à compléter</span>`)];
  if (adresse) lignes.push(ligne("lieu", "Adresse", echapper(adresse)));
  if (f.telephone) lignes.push(ligne("telephone", "Téléphone", `<a href="tel:${echapper(f.telephone.replace(/\s/g, ""))}">${echapper(f.telephone)}</a>`));
  if (f.email) lignes.push(ligne("courriel", "E-mail", `<a href="mailto:${echapper(f.email)}">${echapper(f.email)}</a>`));
  if (f.numero_pajemploi) lignes.push(ligne("numero", "N° Pajemploi", `N° Pajemploi ${echapper(f.numero_pajemploi)}`));
  if (!f.id) lignes.push(ligne("alerte", "À faire", `<span class="petit">Fiche famille à compléter</span>`));
  return `<ul class="infos-liste">${lignes.join("")}</ul>`;
}

async function afficherContrats() {
  const [liste, fams, brouillons] = await Promise.all([api("contrats").catch(() => []), api("familles").catch(() => []),
    api("brouillons").catch(() => [])]);
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
    const siens = brouillons.filter((b) => (b.contrat?.famille || "").toLowerCase() === f.nom.toLowerCase());
    // Bloc replié par défaut : on ne voit que le nom de la famille, le nombre d'enfants et la flèche.
    const bloc = document.createElement("details");
    bloc.className = "panneau famille";
    bloc.dataset.famille = f.nom;
    bloc.open = famillesOuvertes.has(f.nom) || enfants.some((c) => c.id === enfantOuvert);
    const actifs = enfants.filter((c) => !(c.fin && c.fin < aujourdhui)).length;
    const compte = [enfants.length ? `${enfants.length} enfant${enfants.length > 1 ? "s" : ""}` : "aucun enfant",
      enfants.length && actifs < enfants.length ? `${enfants.length - actifs} terminé${enfants.length - actifs > 1 ? "s" : ""}` : "",
      siens.length ? `${siens.length} brouillon${siens.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ");
    bloc.innerHTML = `<summary class="entete-famille">
        <span class="picto-famille" aria-hidden="true">${picto("famille")}</span>
        <span class="titre-famille"><h2>Famille ${echapper(nomFamille(f))}</h2><span class="compte">${compte}</span></span>
        <span class="chevron" aria-hidden="true">${picto("chevron")}</span>
      </summary>
      <div class="contenu-famille">
        <div class="infos-famille">
          ${infosFamille(f)}
          <button class="action" data-modifier>${picto("modifier")}${f.id ? "Modifier la famille" : "Compléter la fiche famille"}</button>
        </div>
        <div class="cartes-contrats"></div>
      </div>`;
    enfants.forEach((c) => bloc.querySelector(".cartes-contrats").appendChild(carteEnfant(c, aujourdhui, f)));
    siens.forEach((b) => bloc.querySelector(".cartes-contrats").appendChild(carteBrouillon(b)));
    // Ajouter un enfant : à l'endroit où sa carte apparaîtra, après les enfants de la famille.
    bloc.querySelector(".cartes-contrats").insertAdjacentHTML("beforeend",
      `<button type="button" class="carte-ajout" data-enfant>${picto("plus")}Ajouter un enfant${enfants.length ? "" : " à cette famille"}</button>`);
    bloc.querySelector("[data-modifier]").addEventListener("click", () => editerFamille(f));
    bloc.querySelector("[data-enfant]").addEventListener("click", () => demarrerAssistant(f.nom));
    bloc.addEventListener("toggle", () => {
      if (bloc.dataset.recherche) { delete bloc.dataset.recherche; return; }     // ouverte par la recherche
      if (bloc.open) famillesOuvertes.add(f.nom); else famillesOuvertes.delete(f.nom);
    });
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
  // Brouillons d'une nouvelle famille (pas encore de fiche) : rangés en haut de la liste.
  const connuesFiches = new Set(familles.map((f) => f.nom.toLowerCase()));
  const orphelins = brouillons.filter((b) => !connuesFiches.has((b.contrat?.famille || "").toLowerCase()));
  const zoneB = $("#brouillons-nouvelles");
  zoneB.classList.toggle("cache", !orphelins.length);
  zoneB.innerHTML = orphelins.length ? `<h2>Brouillons pour une nouvelle famille</h2><div class="cartes-contrats"></div>` : "";
  orphelins.forEach((b) => zoneB.querySelector(".cartes-contrats").appendChild(carteBrouillon(b)));
  appliquerFiltres();
  return liste;
}

// Recherche : les familles trouvées s'ouvrent pour montrer l'enfant cherché ; sans recherche, chacune reprend son état.
$("#recherche-familles").addEventListener("input", (e) => {
  const cherche = e.target.value.trim();
  appliquerFiltre(e.target);
  $$("#liste-familles-contrats > details.famille").forEach((b) => {
    const ouvrir = cherche ? !b.classList.contains("filtre-cache") : famillesOuvertes.has(b.dataset.famille);
    if (b.open !== ouvrir) { b.dataset.recherche = "1"; b.open = ouvrir; }
  });
});

// Les formulaires s'ouvrent juste sous la famille concernée (en haut de la liste pour une nouvelle famille).
function placerSous(formulaire, cleFamille) {
  const bloc = $$("#liste-familles-contrats > .famille").find((b) => b.dataset.famille === cleFamille);
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
  // Famille existante : le formulaire prend la place de ses informations, dans son encadré ; nouvelle famille :
  // en haut de la liste.
  fermerFamille();
  const bloc = $$("#liste-familles-contrats > .famille").find((b) => b.dataset.famille === f?.nom);
  if (bloc) {
    bloc.open = true;
    bloc.classList.add("en-edition");
    bloc.querySelector(".infos-famille").classList.add("cache");
    bloc.querySelector(".infos-famille").after(formFamille);
    $("#titre-form-famille").textContent = "Modifier les informations de la famille";
  } else $("#liste-familles-contrats").before(formFamille);
  formFamille.classList.toggle("dans-famille", !!bloc);
  $("#supprimer-famille").classList.toggle("cache", !f?.id);
  formFamille.classList.remove("cache");
  marquerRemplis(formFamille);
  (bloc || formFamille).scrollIntoView({ behavior: "smooth", block: "start" });
}
// Fermeture du formulaire : la famille retrouve ses informations.
function fermerFamille() {
  formFamille.classList.add("cache");
  $$("#liste-familles-contrats > .famille.en-edition").forEach((b) => {
    b.classList.remove("en-edition");
    b.querySelector(".infos-famille").classList.remove("cache");
  });
}
$("#nouvelle-famille").addEventListener("click", () => editerFamille(null));
$("#annuler-famille").addEventListener("click", fermerFamille);
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
  let enregistree;
  try { enregistree = await api("familles", d); } catch (err) { alert(err.message); return; }
  famillesOuvertes.add(enregistree?.nom || d.nom);     // la famille reste ouverte pour voir ses informations
  formFamille.classList.add("cache");
  afficherContrats();
});

const NOUVELLE_FAMILLE = "__nouvelle";

function editerContrat(c, famille, mode = "fiche", avenantId = "") {
  const assistant = mode !== "fiche";
  modeSaisie = mode;
  contratEdite = c;
  fermerFamille();
  formContrat.reset();
  formContrat.elements.famille.innerHTML = familles.map((f) => `<option value="${echapper(f.nom)}">${
    echapper([nomFamille(f), f.parent1_prenom && `(${f.parent1_prenom})`].filter(Boolean).join(" "))}</option>`).join("")
    + (assistant ? `<option value="${NOUVELLE_FAMILLE}">Nouvelle famille…</option>` : "");
  for (const champ of formContrat.elements) {
    if (!champ.name || MODIFIABLES.includes(champ.name) || champ.name.startsWith("f_")) continue;
    if (champ.type === "radio") { champ.checked = champ.value === (c?.[champ.name] || ""); continue; }
    champ.value = c?.[champ.name] || DEFAUTS_CONTRAT[champ.name] || (champ.tagName === "SELECT" ? champ.options[0]?.value ?? "" : "");
  }
  // Nouvelle fiche : période d'essai de 2 mois proposée ; fiche existante sans essai renseigné : case décochée.
  ecrireEssai(c ? c.essai : ESSAI_DEFAUT);
  calculerAdaptation();
  $("#contrat-cree").textContent = "";
  if (!c && famille) formContrat.elements.famille.value = famille;
  versions = versionsDe(c);
  if (mode === "avenant") {
    // Nouvel avenant : il part des conditions les plus récentes ; avenant existant : on le reprend.
    let i = versions.findIndex((v, n) => n && v.id === avenantId);
    if (i < 0) {
      versions.push({ ...structuredClone(versions[versions.length - 1]), id: "", date: "", motif: "",
        signature_lieu: profilConnu.ville || "", signature_date: "" });
      i = versions.length - 1;
    }
    chargerVersion(i);
  } else chargerVersion(0);
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
    etapesVues.clear();
    if (mode !== "nouveau") etapes().forEach((_, i) => etapesVues.add(i));
    allerEtape(0);
  } else {
    marquerRemplis(formContrat);
    placerSous(formContrat, c?.famille || famille);
    formContrat.scrollIntoView({ behavior: "smooth" });
  }
}

// --- assistant « Ajouter un enfant » : tout le contrat de travail, en plein écran, une étape à la fois
const etapes = () => $$("#form-contrat [data-etape]").filter((e) =>
  (modeSaisie === "avenant" ? ETAPES_AVENANT.includes(e.dataset.etape) : e.dataset.etape !== "avenant"));
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
  formContrat.classList.toggle("mode-avenant", modeSaisie === "avenant");
  $("#titre-signature").textContent = modeSaisie === "avenant" ? "Signature de l'avenant" : "Signature du contrat";
  $("#assistant-brouillon").closest(".assistant-brouillon").classList.toggle("invisible", modeSaisie !== "nouveau");
  // Dans l'assistant, toutes les informations du contrat de travail sont demandées (pour un avenant :
  // celles des étapes de l'avenant).
  // Un avenant ne cite que ce qui change : seule sa date d'effet est alors obligatoire (une ancienne fiche
  // incomplète ne doit pas bloquer l'avenant).
  const visibles = new Set(etapes());
  $$("#form-contrat [data-requis]").forEach((c) => (c.required = actif && visibles.has(c.closest("[data-etape]"))
    && (modeSaisie !== "avenant" || c.id === "av-date")));
  formContrat.querySelectorAll(".mention:not(.calcule)").forEach((m) => m.remove());
  marquerChamps(formContrat);
  afficherEssai();
}

const etapesVues = new Set();

function allerEtape(n) {
  marquerRemplis(formContrat);
  const liste = etapes();
  etapeActive = Math.max(0, Math.min(n, liste.length - 1));
  etapesVues.add(etapeActive);
  liste.forEach((e, i) => e.classList.toggle("etape-active", i === etapeActive));
  const reste = liste.length - 1 - etapeActive;
  $("#assistant-etape").textContent = `Étape ${etapeActive + 1} sur ${liste.length} · ${
    reste ? `encore ${reste} étape${reste > 1 ? "s" : ""} après celle-ci` : "dernière étape"}`;
  $("#assistant-titre").textContent = liste[etapeActive].dataset.titre;
  $("#assistant-barre").style.width = `${Math.round(100 * (etapeActive + 1) / liste.length)}%`;
  // Plan des étapes : un clic sur un titre y mène directement.
  $("#assistant-plan").innerHTML = liste.map((e, i) => `<li><button type="button" data-aller-etape="${i}"
    class="${i === etapeActive ? "active" : etapesVues.has(i) ? "faite" : ""}" ${i === etapeActive ? 'aria-current="step"' : ""}>${
    echapper(e.dataset.titre)}</button></li>`).join("");
  $("#assistant-plan [aria-current]")?.scrollIntoView({ block: "nearest", inline: "center" });
  $("#assistant-precedent").classList.toggle("invisible", !etapeActive);
  $("#assistant-suivant").textContent = reste ? "Suivant" : modeSaisie === "avenant" ? "Enregistrer l'avenant" : "Enregistrer la fiche";
  if (liste[etapeActive].dataset.etape === "signature") (modeSaisie === "avenant" ? afficherRecapAvenant : afficherRecapitulatif)();
  if (liste[etapeActive].dataset.etape === "avenant") $("#resume-avant").innerHTML = `<h3 class="sous-titre">${
    versionActive > 1 ? `Conditions de l'avenant n° ${versionActive - 1}` : "Conditions du contrat de travail"} (avant cet avenant)</h3>
    ${resumeEnVigueur(contratEdite, versions[versionActive - 1])}`;
  if (liste[etapeActive].dataset.etape === "remuneration") afficherResume();
  formContrat.scrollTo(0, 0);
  liste[etapeActive].querySelector("input:not([type=checkbox]):not([type=radio]), select, textarea")?.focus({ preventScroll: true });
}
$("#assistant-plan").addEventListener("click", (e) => {
  const b = e.target.closest("[data-aller-etape]");
  if (b) allerEtape(+b.dataset.allerEtape);
});

function etapeValide(el) {
  const invalide = [...el.querySelectorAll("input, select, textarea")].find((c) => c.offsetParent !== null && !c.checkValidity());
  if (invalide) { invalide.reportValidity(); return false; }
  if (el.dataset.etape === "avenant") {
    const date = $("#av-date").value, debut = formContrat.elements.debut.value;
    const autre = versions.some((v, n) => n && n !== versionActive && v.date === date);
    $("#av-date").setCustomValidity(debut && date && date <= debut ? `La date d'effet doit être après le début du contrat (${dateFr(debut)}).`
      : autre ? "Un autre avenant prend déjà effet à cette date." : "");
    if (!$("#av-date").reportValidity()) return false;
  }
  if (el.dataset.etape === "signature" && modeSaisie === "avenant") {
    sauverVersion();
    if (!MODIFIABLES.some((k) => !memeValeur(versions[versionActive - 1][k], versions[versionActive][k]))) {
      alert("Cet avenant ne change aucune condition : modifiez au moins une rubrique (horaires, salaire…) aux étapes précédentes.");
      return false;
    }
  }
  if (el.dataset.etape === "horaires" && formContrat.elements.planning.value !== "oui" && !resumeSemaine(lireHoraires("scolaire"))) {
    alert("Indiquez l'emploi du temps de l'enfant : heure d'arrivée et heure de départ des jours d'accueil.");
    return false;
  }
  return true;
}

$("#assistant-suivant").addEventListener("click", () => {
  if (!etapeValide(etapes()[etapeActive])) return;
  if (etapeActive < etapes().length - 1) { allerEtape(etapeActive + 1); return; }
  // Enregistrement : toutes les étapes doivent être complètes (on a pu en sauter en cliquant sur leur titre).
  for (let i = 0; i < etapes().length; i++) {
    allerEtape(i);
    if (!etapeValide(etapes()[i])) return;
  }
  formContrat.requestSubmit();
});
$("#assistant-precedent").addEventListener("click", () => allerEtape(etapeActive - 1));
$("#assistant-quitter").addEventListener("click", () => {
  if (!$("#assistant-fin").classList.contains("cache") || brouillonAJour
    || confirm("Quitter sans enregistrer ? Les informations saisies depuis le dernier brouillon seront perdues.")) {
    fermerContrat();
    if (brouillonEdite) afficherContrats();      // le brouillon apparaît dans la liste
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && formContrat.classList.contains("assistant")) $("#assistant-quitter").click();
});

// --- brouillons : la saisie de l'assistant peut être enregistrée puis reprise plus tard.
let brouillonEdite = null;       // brouillon repris (id), effacé quand la fiche est enregistrée
let brouillonAJour = false;
formContrat.addEventListener("input", () => { brouillonAJour = false; $("#brouillon-enregistre").textContent = ""; });

function photoBrouillon() {
  sauverVersion();
  const famille = {};
  for (const champ of formContrat.elements) if (champ.name?.startsWith("f_")) famille[champ.name] = champ.value;
  return { id: brouillonEdite || "", etape: etapeActive, contrat: { ...versions[0], ...champsFiche() }, famille };
}

$("#assistant-brouillon").addEventListener("click", async () => {
  try {
    const b = await api("brouillons", photoBrouillon());
    brouillonEdite = b.id;
    brouillonAJour = true;
    $("#brouillon-enregistre").textContent = `Brouillon enregistré à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`;
  } catch (err) { alert(err.message); }
});

async function reprendreBrouillon(b) {
  profilConnu = await api("profil").catch(() => ({}));
  editerContrat({ ...b.contrat, avenants: [] }, "", "nouveau");
  contratEdite = null;
  brouillonEdite = b.id;
  etapesVues.clear();
  for (const [nom, valeur] of Object.entries(b.famille || {})) if (formContrat.elements[nom]) formContrat.elements[nom].value = valeur;
  $("#qualite-autre").classList.toggle("invisible", formContrat.elements.f_parent1_qualite.value !== "autre");
  $("#titre-form-contrat").textContent = "Nouvel enfant";
  brouillonAJour = true;
  etapes().forEach((_, i) => i <= b.etape && etapesVues.add(i));
  allerEtape(b.etape || 0);
}

function carteBrouillon(b) {
  const div = document.createElement("div");
  const nom = [b.contrat?.enfant_prenom, b.contrat?.enfant_nom].filter(Boolean).join(" ") || "Enfant sans prénom";
  const total = etapes().length;
  div.className = "carte-contrat brouillon";
  div.innerHTML = `<span class="etiquette-brouillon">Brouillon</span>
    <span class="nom">${echapper(nom)}</span>
    <span class="petit">Arrêté à l'étape ${(b.etape || 0) + 1} sur ${total} · enregistré le ${dateFr(b.date.slice(0, 10))}</span>
    <span class="boutons-brouillon"><button type="button" class="principal" data-reprendre>Reprendre</button>
    <button type="button" class="lien danger" data-supprimer>Supprimer le brouillon</button></span>`;
  div.querySelector("[data-reprendre]").addEventListener("click", () => reprendreBrouillon(b));
  div.querySelector("[data-supprimer]").addEventListener("click", async () => {
    if (!confirm(`Supprimer le brouillon de ${nom} ? Les informations saisies seront perdues.`)) return;
    await api("brouillons/supprimer", { id: b.id }).catch((err) => alert(err.message));
    afficherContrats();
  });
  return div;
}

// Champs de la fiche hors conditions modifiables par avenant (boutons radio : la valeur cochée).
function champsFiche() {
  const d = {};
  for (const champ of formContrat.elements) {
    if (!champ.name || MODIFIABLES.includes(champ.name) || champ.name.startsWith("f_")) continue;
    if (champ.type === "radio") { if (champ.checked || !(champ.name in d)) d[champ.name] = champ.checked ? champ.value : ""; }
    else d[champ.name] = champ.value;
  }
  return d;
}

function fermerContrat() {
  formContrat.classList.add("cache");
  modeSaisie = "fiche";
  modeAssistant(false);
}

// Étape « parent employeur » : reprise de la fiche famille choisie (vide pour une nouvelle famille).
function remplirEmployeur() {
  const f = familles.find((x) => x.nom === formContrat.elements.famille.value) || {};
  for (const champ of formContrat.elements)
    if (champ.name?.startsWith("f_")) champ.value = f[champ.name.slice(2)] || "";
  $("#qualite-autre").classList.toggle("invisible", formContrat.elements.f_parent1_qualite.value !== "autre");
}
formContrat.elements.famille.addEventListener("change", () => { if (formContrat.classList.contains("assistant")) remplirEmployeur(); });
formContrat.elements.f_parent1_qualite.addEventListener("change", (e) => $("#qualite-autre").classList.toggle("invisible", e.target.value !== "autre"));
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

// Avenant : récapitulatif de ce qui change (le PDF de l'avenant ne cite que ces lignes).
function texteCondition(k, v) {
  if (k.startsWith("horaires")) { const r = resumeSemaine(v[k] || {}); return r ? `${heuresFr(r.total)} par semaine (${r.detail})` : "aucun"; }
  if (k === "feries_travailles") return (v[k] || "").split(",").filter(Boolean).map((x) => FERIES[x.trim()] || x).join(", ") || "aucun";
  const champ = formContrat.elements[k];
  const brut = valeurAffichee(k, v);
  const texte = champ.tagName === "SELECT" ? [...champ.options].find((o) => o.value === brut)?.textContent.trim() : brut;
  if (!texte || texte === "—") return "non précisé";
  const unite = { tarif_horaire: " €", tarif_complementaire: " €", entretien_jour: " €", repas_jour: " €", frais_km: " €",
    taux_majoration: " %", ferie_majoration: " %" }[k] || "";
  return texte + (unite && /\d$/.test(texte) ? unite : "");
}
function afficherRecapAvenant() {
  sauverVersion();
  const v = versions[versionActive], avant = versions[versionActive - 1];
  const changes = MODIFIABLES.filter((k) => !memeValeur(avant[k], v[k]));
  $("#recapitulatif").innerHTML = `<h3 class="sous-titre">Ce qui change le ${v.date ? dateFr(v.date) : "(date à choisir)"}</h3>
    ${changes.length ? `<table class="tableau-changements"><thead><tr><th scope="col">Condition</th><th scope="col">Avant</th>
      <th scope="col">À partir du ${v.date ? dateFr(v.date) : "…"}</th></tr></thead><tbody>${changes.map((k) => `<tr>
      <th scope="row">${LIBELLES[k].charAt(0).toUpperCase() + LIBELLES[k].slice(1)}</th>
      <td>${echapper(texteCondition(k, avant))}</td><td><strong>${echapper(texteCondition(k, v))}</strong></td></tr>`).join("")}</tbody></table>
      <p class="petit">Les autres clauses du contrat restent inchangées.</p>`
    : `<p class="alerte-texte">Aucune condition n'a changé : revenez aux étapes précédentes pour modifier ce qui change.</p>`}`;
}

async function demarrerAssistant(famille) {
  profilConnu = await api("profil").catch(() => ({}));
  brouillonEdite = null;
  brouillonAJour = false;
  etapesVues.clear();
  editerContrat(null, famille, "nouveau");
}

// Contrat existant : modification ou avenant, avec l'assistant plein écran.
async function ouvrirAssistant(c, mode, avenantId = "") {
  profilConnu = await api("profil").catch(() => ({}));
  brouillonEdite = null;
  brouillonAJour = true;
  editerContrat(c, c.famille, mode, avenantId);
}
$("#nouvel-enfant").addEventListener("click", async () => { await afficherContrats(); demarrerAssistant(""); });

// Contrat de travail ou avenant en PDF : résultat affiché avec un lien pour l'ouvrir.
const creerAvenantPdf = (contratId, avenantId, zone) => creerContratTravail(contratId, zone, avenantId);
async function creerContratTravail(contratId, zone, avenantId = "") {
  zone.innerHTML = `<p class="petit">Création du ${avenantId ? "PDF de l'avenant" : "contrat"}…</p>`;
  try {
    const r = avenantId ? await api("avenant-pdf", { contrat_id: contratId, avenant_id: avenantId })
      : await api("contrat-travail", { contrat_id: contratId || "" });
    zone.innerHTML = `<p>${avenantId ? "Avenant" : "Contrat"} enregistré : ${echapper(r.chemin)} <button type="button" class="lien" data-ouvrir-pdf>Ouvrir</button></p>
      ${r.manquants.length ? `<p class="alerte-texte">Rubriques laissées vides (à compléter dans le PDF, ou dans les fiches avant de le recréer) :
        ${r.manquants.map(echapper).join(", ")}.</p>` : ""}`;
    zone.querySelector("[data-ouvrir-pdf]").addEventListener("click", () => api("ouvrir", { quoi: r.chemin }).catch((err) => alert(err.message)));
    rafraichirDocuments(contratId);
  } catch (err) { zone.innerHTML = `<p class="alerte-texte">${echapper(err.message)}</p>`; }
}

formContrat.elements.debut.addEventListener("change", () => { afficherOngletsVersions(); calculerAdaptation(); afficherEssai(); });
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
  const mode = modeSaisie;
  sauverVersion();
  const d = { id: contratEdite?.id, ...versions[0], avenants: versions.slice(1) };
  Object.assign(d, champsFiche());
  // Avenant : la signature saisie est celle de l'avenant ; celle du contrat ne change pas.
  if (mode === "avenant") { d.signature_lieu = contratEdite.signature_lieu || ""; d.signature_date = contratEdite.signature_date || ""; }
  const avenantSaisi = mode === "avenant" ? versions[versionActive] : null;
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
    if (assistant && mode !== "avenant") {
      // La fiche famille est créée ou mise à jour avec les informations du parent employeur.
      const avant = familles.find((x) => x.nom === d.famille);
      const f = { ...(avant || {}), id: avant?.id || "", nom: avant?.nom || "" };
      for (const champ of formContrat.elements) if (champ.name?.startsWith("f_")) f[champ.name.slice(2)] = champ.value.trim();
      if (!avant?.id || Object.keys(f).some((k) => (f[k] ?? "") !== (avant[k] ?? ""))) d.famille = (await api("familles", f)).nom;
    }
    enregistre = await api("contrats", d);
    if (assistant && brouillonEdite) await api("brouillons/supprimer", { id: brouillonEdite }).catch(() => {});
    brouillonEdite = null;
  } catch (err) { alert(err.message); return; }
  const liste = afficherContrats();
  if (assistant) {
    // Fin de l'assistant : proposition de créer le contrat de travail tout de suite.
    etapes().forEach((x) => x.classList.remove("etape-active"));
    $("#assistant-etape").textContent = "Terminé";
    $("#assistant-barre").style.width = "100%";
    $("#assistant-plan").innerHTML = "";
    const fin = $("#assistant-fin");
    const av = avenantSaisi && enregistre.avenants.find((a) => a.date === avenantSaisi.date);
    const numero = av ? enregistre.avenants.indexOf(av) + 1 : 0;
    $("#assistant-titre").textContent = av ? `L'avenant n° ${numero} de ${enregistre.enfant_prenom} est enregistré`
      : mode === "modification" ? `Le contrat de ${enregistre.enfant_prenom} est modifié` : `La fiche de ${enregistre.enfant_prenom} est enregistrée`;
    fin.innerHTML = av ? `<p>L'avenant prend effet le ${dateFr(av.date)}. Créez-le en PDF : il ne cite que ce qui change,
        à imprimer en deux exemplaires et à signer avec la famille.</p>
        <div class="boutons"><button type="button" class="principal" data-creer>Créer l'avenant (PDF)</button>
        <button type="button" class="secondaire" data-fermer>Fermer</button></div><div data-resultat role="status"></div>`
      : `<p>Toutes les informations du contrat sont enregistrées. Vous pouvez maintenant créer le contrat de travail,
      rempli sur le modèle officiel de l'Urssaf, à imprimer en deux exemplaires et à signer avec la famille.</p>
      <div class="boutons"><button type="button" class="principal" data-creer>Créer le contrat de travail (PDF)</button>
      <button type="button" class="secondaire" data-fermer>Fermer</button></div><div data-resultat role="status"></div>`;
    fin.classList.remove("cache");
    fin.querySelector("[data-creer]").addEventListener("click", () => (av
      ? creerAvenantPdf(enregistre.id, av.id, fin.querySelector("[data-resultat]"))
      : creerContratTravail(enregistre.id, fin.querySelector("[data-resultat]"))));
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

// ------------------------------------------------------------- sites d'activités
// Raccourcis carrés façon application de téléphone : l'icône du site (récupérée par l'application sur le site
// lui-même, /api/icone-site), sinon l'initiale sur une couleur pastel (une couleur différente pour chaque site voisin).
let sites = [];
let siteEdite = -1;
const COULEURS_SITES = ["#f7d3de", "#ddd4f6", "#ffe2b0", "#ecd6f2", "#fbe0e8", "#e6e0f8"];
const domaine = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
function tuileSite(site, i) {
  const couleur = COULEURS_SITES[i % COULEURS_SITES.length];
  const icone = `<img alt="" src="/api/icone-site?url=${encodeURIComponent(site.url)}">`;
  return `<a class="tuile-site" href="${echapper(site.url)}" target="_blank" rel="noopener noreferrer" data-site="${i}"
      title="${echapper(site.description || domaine(site.url))}">
    <span class="icone-site" style="--fond:${couleur}"><span class="initiale-site" aria-hidden="true">${echapper([...site.nom][0] || "?")}</span>${icone}</span>
    <span class="nom-site">${echapper(site.nom)}</span></a>`;
}
// Couleur principale d'une icône : la teinte la plus présente parmi ses pixels colorés (ni transparents, ni
// presque blancs, ni gris), pour un fond blanc légèrement teinté derrière les parties transparentes.
function couleurPrincipale(img) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 32, 32);
  let pixels;
  try { pixels = ctx.getImageData(0, 0, 32, 32).data; } catch { return null; }
  const teintes = {};
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (a < 160 || max - min < 40 || min > 225) continue;
    const t = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    const cle = Math.round(t * 2) % 12;           // 12 familles de teintes
    const p = teintes[cle] ??= { n: 0, r: 0, g: 0, b: 0 };
    p.n++; p.r += r; p.g += g; p.b += b;
  }
  const choix = Object.values(teintes).sort((x, y) => y.n - x.n)[0];
  return choix && choix.n >= 6 ? [choix.r / choix.n, choix.g / choix.n, choix.b / choix.n] : null;
}
const fondTeinte = (rgb) => (rgb ? `rgb(${rgb.map((v) => Math.round(255 - (255 - v) * 0.12)).join(", ")})` : "#f6f5f9");

// Grande icône : elle remplit la tuile ; petite (favicon) : centrée. Fond blanc teinté de la couleur du logo
// (visible dans les parties transparentes), l'initiale est masquée ; aucune icône : l'initiale reste.
function surveillerIcones(zone) {
  zone.querySelectorAll(".icone-site img").forEach((img) => {
    const verifier = () => {
      if (!img.naturalWidth) return;
      img.classList.add("chargee", img.naturalWidth >= 96 ? "pleine" : "petite");
      const tuile = img.closest(".icone-site");
      tuile.classList.add("avec-image");
      tuile.style.background = fondTeinte(couleurPrincipale(img));
    };
    img.addEventListener("load", verifier);
    img.addEventListener("error", () => img.remove());
    if (img.complete) verifier();
  });
}

async function afficherSites() {
  sites = await api("sites").catch(() => sites);
  const ajout = `<button type="button" class="tuile-site ajout-site" data-ajouter-site><span class="icone-site">${picto("plus")}</span>
    <span class="nom-site">Ajouter</span></button>`;
  // En-tête : les icônes seules, en miniature (le nom s'affiche au survol).
  $("#sites-entete").innerHTML = sites.map((site, i) => tuileSite(site, i).replace('class="tuile-site"', 'class="tuile-site miniature"')
    .replace(/title="[^"]*"/, `title="${echapper(site.nom)}" aria-label="${echapper(site.nom)}"`)).join("");
  surveillerIcones($("#sites-entete"));
  ["#sites-accueil", "#sites-grille"].forEach((sel) => {
    $(sel).innerHTML = sites.map(tuileSite).join("") + ajout;
    surveillerIcones($(sel));
    $(sel).querySelector("[data-ajouter-site]").addEventListener("click", () => {
      ouvrirOnglet("acces-rapide");
      editerSite(-1);
      $("#form-site").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
  $("#liste-sites").innerHTML = sites.length ? sites.map((site, i) => `<li>
      ${tuileSite(site, i).replace('class="tuile-site"', 'class="tuile-site mini" tabindex="-1"')}
      <span class="infos-site"><strong>${echapper(site.nom)}</strong><span class="petit">${echapper(domaine(site.url))}${
        site.description ? ` · ${echapper(site.description)}` : ""}</span></span>
      <span class="actions-site">
        <button type="button" class="icone" data-monter="${i}" title="Monter" aria-label="Monter ${echapper(site.nom)}" ${i ? "" : "disabled"}>${picto("monter")}</button>
        <button type="button" class="icone" data-descendre="${i}" title="Descendre" aria-label="Descendre ${echapper(site.nom)}" ${i < sites.length - 1 ? "" : "disabled"}>${picto("descendre")}</button>
        <button type="button" class="action" data-modifier-site="${i}">${picto("modifier")}Modifier</button>
        <button type="button" class="action danger" data-supprimer-site="${i}">${picto("supprimer")}Supprimer</button>
      </span></li>`).join("")
    : `<li class="petit">Aucun site pour l'instant : ajoutez-en un ci-dessous.</li>`;
  surveillerIcones($("#liste-sites"));
  editerSite(siteEdite >= sites.length ? -1 : siteEdite);
}

async function enregistrerSites(liste) {
  try { sites = await api("sites", liste); } catch (err) { alert(err.message); return false; }
  siteEdite = -1;
  await afficherSites();
  return true;
}

function editerSite(i) {
  siteEdite = i;
  const form = $("#form-site");
  if (i >= 0) for (const k of ["nom", "url", "description"]) form.elements[k].value = sites[i][k] || "";
  else if (form.dataset.edition) form.reset();
  form.dataset.edition = i >= 0 ? "1" : "";
  $("#titre-form-site").textContent = i >= 0 ? `Modifier « ${sites[i].nom} »` : "Ajouter un site";
  $("#bouton-site").innerHTML = i >= 0 ? `${picto("coche")}Enregistrer` : `${picto("plus")}Ajouter le site`;
  $("#annuler-site").classList.toggle("cache", i < 0);
  marquerRemplis(form);
}

$("#liste-sites").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const liste = sites.map((x) => ({ ...x }));
  if (b.dataset.monter) { const i = +b.dataset.monter; [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]]; enregistrerSites(liste); }
  else if (b.dataset.descendre) { const i = +b.dataset.descendre; [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]]; enregistrerSites(liste); }
  else if (b.dataset.modifierSite) { editerSite(+b.dataset.modifierSite); $("#form-site").scrollIntoView({ behavior: "smooth", block: "center" }); }
  else if (b.dataset.supprimerSite) {
    const i = +b.dataset.supprimerSite;
    if (!confirm(`Retirer « ${sites[i].nom} » de vos sites ?`)) return;
    liste.splice(i, 1);
    enregistrerSites(liste);
  }
});
$("#form-site").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const site = { nom: form.elements.nom.value.trim(), url: form.elements.url.value.trim(), description: form.elements.description.value.trim() };
  const liste = sites.map((x) => ({ ...x }));
  if (siteEdite >= 0) liste[siteEdite] = site; else liste.push(site);
  if (await enregistrerSites(liste)) { form.reset(); form.dataset.edition = ""; editerSite(-1); }
});
$("#annuler-site").addEventListener("click", () => { $("#form-site").reset(); editerSite(-1); });
$("#sites-defaut").addEventListener("click", async () => {
  if (!confirm("Remplacer votre liste par les sites proposés (Pinterest, Marmiton, Tête à modeler, Hugo l'escargot) ?")) return;
  enregistrerSites(null);
});

// ------------------------------------------------------------- mon profil
const formProfil = $("#form-profil");
async function chargerProfil() {
  const p = await api("profil").catch(() => ({}));
  for (const [cle, val] of Object.entries(p)) if (formProfil.elements[cle]) formProfil.elements[cle].value = val ?? "";
  marquerRemplis(formProfil);
  sansModifs(formProfil);
  return p;
}
formProfil.querySelector(".annuler-modifs").addEventListener("click", () => chargerProfil());
formProfil.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries([...formProfil.elements].filter((c) => c.name).map((c) => [c.name, c.value]));
  try { await api("profil", d); } catch (err) { alert(err.message); return; }
  sansModifs(formProfil);
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

// ------------------------------------------------------------- dossier principal
// Un seul dossier choisi par l'utilisatrice : l'application y crée Bulletins de salaire, Courriers, Photos et vidéos,
// Activités, À trier et Sauvegarde. En le choisissant, les anciens dossiers y sont déplacés (barre de progression).
let suiviDeplacement = null;
const nomDossier = (chemin) => String(chemin || "").split(/[\\/]/).filter(Boolean).pop() || chemin;

async function afficherPrincipal() {
  const r = await api("principal").catch(() => null);
  if (!r) return;
  const choisi = !!r.principal;
  $("#chemin-principal").innerHTML = choisi ? `${picto("dossier")}<strong>${echapper(r.principal)}</strong>`
    : `Pas encore choisi.${r.anciens.length ? ` Vos fichiers actuels (${r.anciens.map(echapper).join(", ")}) y seront déplacés.` : ""}`;
  $("#arbre-principal").innerHTML = choisi ? `<li class="dossier"><span>${echapper(nomDossier(r.principal))}</span><ul>${
    r.sous_dossiers.map((d) => `<li class="dossier"><span>${echapper(d)}</span></li>`).join("")}</ul></li>` : "";
  $("#choisir-principal").lastChild.textContent = choisi ? "Changer de dossier" : "Choisir le dossier principal";
  $("#choisir-principal").className = choisi ? "secondaire" : "principal";
  $('#reglages-dossier [data-ouvrir="principal"]').classList.toggle("cache", !choisi);
  afficherDeplacement(r.deplacement);
  if (r.deplacement.en_cours) suivreDeplacement();
}

function afficherDeplacement(d) {
  const visible = d.en_cours || d.termine;
  $("#deplacement").classList.toggle("cache", !visible);
  $("#choisir-principal").disabled = !!d.en_cours;
  if (!visible) return;
  $("#texte-deplacement").textContent = d.en_cours && d.total ? `Déplacement des fichiers : ${d.fait} sur ${d.total}` : d.message;
  $("#barre-deplacement").style.width = `${d.total ? (100 * d.fait) / d.total : d.en_cours ? 5 : 100}%`;
  $("#fichier-deplacement").textContent = d.en_cours ? d.fichier : "";
  $("#erreurs-deplacement").innerHTML = (d.erreurs || []).map((e) => `<li>${echapper(e)}</li>`).join("");
}

function suivreDeplacement() {
  clearInterval(suiviDeplacement);
  suiviDeplacement = setInterval(async () => {
    const d = (await api("principal").catch(() => null))?.deplacement;
    if (!d) return;
    afficherDeplacement(d);
    if (!d.en_cours) {
      clearInterval(suiviDeplacement);
      dossierLocal = null;
      await chargerParametres();
      afficherPrincipal();
    }
  }, 600);
}

$("#choisir-principal").addEventListener("click", async () => {
  const info = await api("principal").catch(() => null);
  // Sans fenêtre de choix (tkinter absent), le chemin se saisit à la main.
  const r = await api("choisir-dossier", { titre: "Dossier principal de l'application" })
    .catch(() => ({ chemin: prompt("Chemin complet du dossier principal (par exemple C:\\Users\\…\\Documents\\Assistante maternelle) :", info?.proposition || "") }));
  if (!info || !r?.chemin || r.chemin === info.principal) return;
  const deplaces = info.principal ? [info.principal] : info.anciens;
  if (!confirm(`Tout ranger dans « ${r.chemin} » ?` + (deplaces.length
    ? `\n\nLes fichiers rangés dans ${deplaces.join(", ")} (bulletins, courriers…) y seront déplacés. Cela peut prendre quelques minutes.` : ""))) return;
  try {
    afficherDeplacement(await api("principal", { chemin: r.chemin }));
    suivreDeplacement();
  } catch (e) { alert(e.message); }
});

// ------------------------------------------------------------- photos
// Les photos rangées occupent la page (filtres : enfants, activité). « À trier » est un bouton fixe en bas à droite qui
// ouvre un grand panneau (photos groupées par moment). On choisit des photos, puis les enfants présents (proposés d'après
// les horaires des contrats) dans la barre fixée en bas, et éventuellement une activité. Glisser des photos sur un enfant
// les range pour lui seul ; avec Ctrl, l'enfant est ajouté au choix pour répartir. Une photo rangée glissée sur
// « À trier » y retourne. Une seule sélection à la fois (à trier ou rangées).
let donneesPhotos = null;
let activitesConnues = [];
let groupesCourants = [];
const selTri = new Set();          // clés des photos à trier choisies
const selRangees = new Set();      // numéros des photos rangées choisies
const selHors = new Set(), selIgnorees = new Set();
const enfantsTri = new Set();      // enfants choisis pour « Ranger »
let tousLesEnfants = false;        // « Autre enfant… » : toutes les fiches sont proposées
let filtreEnfant = "", filtreActivite = "", rechercheEnfant = "";
let derniereCle = null;
const ECART_GROUPE = 10 * 60000;   // photos prises à moins de 10 minutes d'écart : un même moment

const heureFr = (iso) => (iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "");
const jourLong = (jour) => new Date(jour + "T12:00:00").toLocaleDateString("fr-FR",
  { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function badgePhotos() {
  const n = donneesPhotos?.a_trier.length || 0;
  $("#badge-photos").textContent = n;
  $("#badge-photos").classList.toggle("cache", !n);
}

async function compterPhotos() {
  const d = await api("photos").catch(() => null);
  if (d) { donneesPhotos = d; badgePhotos(); }
  return d?.a_trier.length || 0;
}

const enfantPar = (id) => donneesPhotos?.enfants.find((e) => e.id === id);
const initialeEnfant = (e) => `<span class="initiale ${couleurEnfant(e.prenom)}" aria-hidden="true">${echapper((e.prenom || "?").charAt(0).toUpperCase())}</span>`;

function vignette(e, attribut, choisie, etiquette = "") {
  const src = e.cle ? `/api/photos/miniature?cle=${e.cle}` : `/api/photos/miniature?numero=${e.numero}`;
  const media = e.genre === "video" ? `<span class="icone-video">${picto("video")}<small>${heureFr(e.date) || "Vidéo"}</small></span>`
    : `<img loading="lazy" alt="" src="${src}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sans-apercu',textContent:'Aperçu indisponible'}))">`;
  const quand = e.date ? new Date(e.date).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    + (e.date_du_fichier ? " (date du fichier, la photo n'en indique pas)" : "") : "date de prise de vue inconnue";
  const titre = `${e.nom || (e.genre === "video" ? "Vidéo " : "Photo ") + e.numero} — ${quand}. Double-clic : ouvrir.`;
  return `<button type="button" class="vignette${choisie ? " choisie" : ""}" ${attribut} draggable="true" aria-pressed="${choisie}"
    title="${echapper(titre)}">${media}<span class="coche-vignette" aria-hidden="true">${picto("coche")}</span>${etiquette}</button>`;
}

// Photos prises à moins de 10 minutes d'écart, le même jour : un groupe. Les photos sans date à la fin.
function grouper(liste) {
  const res = [];
  let courant = null, precedent = 0;
  liste.filter((e) => e.date).forEach((e) => {
    const t = new Date(e.date).getTime();
    if (!courant || t - precedent > ECART_GROUPE || e.date.slice(0, 10) !== courant.jour) res.push(courant = { jour: e.date.slice(0, 10), elements: [] });
    courant.elements.push(e);
    precedent = t;
  });
  const sans = liste.filter((e) => !e.date);
  if (sans.length) res.push({ jour: "", elements: sans });
  return res;
}

async function afficherPhotos() {
  const [d, at] = await Promise.all([api("photos").catch((e) => { alert(e.message); return null; }),
    api("ateliers").catch(() => ({ activites: [] }))]);
  if (!d) return;
  donneesPhotos = d;
  activitesConnues = at.activites || [];
  const cles = new Set([...d.a_trier, ...d.hors_horaires, ...d.ignorees].map((e) => e.cle));
  [selTri, selHors, selIgnorees].forEach((sel) => [...sel].forEach((c) => cles.has(c) || sel.delete(c)));
  const numeros = new Set(d.rangees.map((r) => r.numero));
  [...selRangees].forEach((n) => numeros.has(n) || selRangees.delete(n));
  $("#photos-sans-dossier").classList.toggle("cache", d.configure);
  $("#tri-photos").classList.toggle("cache", !d.configure);
  $("#photos-module").classList.toggle("cache", !d.module_absent);
  $("#photos-module").textContent = d.module_absent ? `Le module ${d.module_absent} est en cours d'installation : les dates et les
    aperçus des photos seront disponibles au prochain démarrage de l'application.` : "";
  badgePhotos();
  afficherATrier();
  afficherRangees();
  afficherMisDeCote();
}

function afficherATrier() {
  const liste = donneesPhotos.a_trier;
  ["#nb-a-trier", "#nb-a-trier-panneau"].forEach((b) => {
    $(b).textContent = liste.length;
    $(b).classList.toggle("cache", !liste.length);
  });
  groupesCourants = grouper(liste);
  let html = "", jour = null;
  groupesCourants.forEach((g, i) => {
    if (g.jour !== jour) {
      jour = g.jour;
      html += `<h3 class="jour-photos">${g.jour ? jourLong(g.jour) : "Sans date de prise de vue"}</h3>`;
    }
    const debut = heureFr(g.elements[0].date), fin = heureFr(g.elements.at(-1).date);
    const heure = g.jour ? (fin !== debut ? `${debut} – ${fin}` : debut) : "";
    html += `<div class="groupe-photos"><button type="button" class="titre-groupe" data-groupe="${i}" title="Choisir tout ce moment">${
      heure ? `<strong>${heure}</strong> · ` : ""}${pluriel(g.elements.length, g.elements.every((e) => e.genre === "video") ? "vidéo" : "élément")}</button>
      <div class="grille-photos">${g.elements.map((e) => vignette(e, `data-cle="${e.cle}"`, selTri.has(e.cle),
        e.doublon ? `<span class="etiquette" title="Déjà rangée sous le numéro ${e.doublon}">Déjà rangée</span>` : "")).join("")}</div></div>`;
  });
  const sources = donneesPhotos.sources.map((s) => `« ${echapper(nomDossier(s))} »`).join(", ");
  $("#groupes-a-trier").innerHTML = html || `<p class="vide-photos">${picto("coche")}Aucune photo à trier.
    <span class="petit" title="Dossiers lus : ${echapper(sources || "aucun")}">Dossiers de photos :
    <button class="lien" data-aller-photos="fonctionnalites">Paramètres</button></span></p>`;
  $$("[data-aller-photos]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerPhotos)));
  afficherBarreTri();
}

const pastilleEnfant = (e, choisi, cible = false) => `<button type="button" class="pastille-enfant" data-enfant="${e.id}"${
  cible ? ` data-case-enfant="${e.id}"` : ""} aria-pressed="${choisi}">
  ${initialeEnfant(e)}<span>${echapper(e.prenom)}<small>${echapper(e.famille)}</small></span>${choisi ? picto("coche") : ""}</button>`;

function afficherBarreTri() {
  const choisies = donneesPhotos.a_trier.filter((e) => selTri.has(e.cle));
  const proposes = new Set([...choisies.flatMap((e) => e.proposes), ...enfantsTri]);
  const tous = donneesPhotos.enfants;        // déjà dans l'ordre : derniers gardés, gardés dans le mois, autres
  const visibles = tousLesEnfants ? tous : tous.filter((e) => proposes.has(e.id));
  $("#pastilles-tri").innerHTML = choisies.length ? visibles.map((e) => pastilleEnfant(e, enfantsTri.has(e.id), true)).join("")
    + (visibles.length < tous.length ? `<button type="button" class="lien autres-enfants" data-autres-enfants>Autre enfant…</button>` : "") : "";
  $("#consigne-tri").textContent = `${pluriel(choisies.length, "élément")} sélectionné${choisies.length > 1 ? "s" : ""}`;
  $("#ignorer").disabled = !choisies.length;
  remplirActivites($("#activite-tri"), choisies.map((e) => (e.date || "").slice(0, 10)).filter(Boolean));
  majBoutonRanger();
  $("#barre-tri").classList.toggle("cache", !choisies.length);
  majBarrePhotos();
}

// La barre fixe n'apparaît que s'il y a une sélection ; elle se pose sur la page sans déplacer les photos.
function majBarrePhotos() {
  $("#barre-photos").classList.toggle("cache", $("#barre-tri").classList.contains("cache") && $("#barre-rangees").classList.contains("cache"));
}
function viderTri() {
  if (!selTri.size && !enfantsTri.size) return;
  selTri.clear();
  enfantsTri.clear();
  tousLesEnfants = false;
  majVignettes("#groupes-a-trier", selTri, "data-cle");
  afficherBarreTri();
}
function viderRangees() {
  if (!selRangees.size) return;
  selRangees.clear();
  majVignettes("#grille-rangees", selRangees, "data-numero");
  afficherBarreRangees();
}

// Panneau « À trier » (Échap ou la croix le referment).
function ouvrirATrier(oui) {
  $("#colonne-a-trier").classList.toggle("cache", !oui);
  $("#tri-photos").classList.toggle("tri-ouvert", oui);
  $("#bouton-a-trier").setAttribute("aria-expanded", String(oui));
  if (!oui) viderTri();
}
$("#bouton-a-trier").addEventListener("click", () => ouvrirATrier(true));
$("#fermer-a-trier").addEventListener("click", () => ouvrirATrier(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#photos").classList.contains("actif") && !$("#colonne-a-trier").classList.contains("cache")
    && !document.querySelector(".menu-contextuel")) ouvrirATrier(false);
});
$("#deselectionner-tri").addEventListener("click", viderTri);

// Liste des réalisations des jours concernés (« Peinture d'automne du 14 octobre 2026 »), puis toutes les activités :
// choisir une activité crée sa réalisation à la date de la photo.
function remplirActivites(select, jours, toutesSeances = false, valeur = select.value) {
  const utiles = realisations().filter((s) => toutesSeances || jours.includes(s.date)).sort((x, y) => y.date.localeCompare(x.date));
  select.innerHTML = `<option value="">Aucune réalisation</option>`
    + (utiles.length ? `<optgroup label="${toutesSeances ? "Réalisations" : "Réalisations de ce jour"}">${utiles.map((s) =>
      `<option value="s:${s.id}">${echapper(nomRealisation(s.activite.titre, s.date))}</option>`).join("")}</optgroup>` : "")
    + (activitesConnues.length ? `<optgroup label="Nouvelle réalisation de l'activité">${activitesConnues.map((a) =>
      `<option value="a:${a.id}">${echapper(a.titre)}</option>`).join("")}</optgroup>` : "")
    + `<option value="nouvelle">Nouvelle activité…</option>`;
  select.value = [...select.options].some((o) => o.value === valeur) ? valeur : "";
}

// Réalisation correspondant au choix (créée si besoin à la date de la photo) ; null si on renonce.
async function seanceChoisie(select, jour) {
  const v = select.value;
  if (!v) return "";
  if (v.startsWith("s:")) return v.slice(2);
  let activite = v.slice(2);
  if (v === "nouvelle") {
    const titre = prompt("Titre de la nouvelle activité (vous pourrez la compléter dans la rubrique Activités) :");
    if (!titre?.trim()) { select.value = ""; return null; }
    activite = (await api("ateliers", { titre: titre.trim() })).id;
  }
  const s = await api("ateliers/seance", { activite, date: jour || isoJour(new Date()) });
  activitesConnues = (await api("ateliers")).activites;
  // La nouvelle activité reste choisie pour les photos suivantes.
  remplirActivites(select, [], select.id === "activite-editeur", `a:${activite}`);
  return s.id;
}

function majVignettes(zone, sel, attr) {
  $$(`${zone} [${attr}]`).forEach((v) => {
    const oui = sel.has(v.getAttribute(attr));
    v.classList.toggle("choisie", oui);
    v.setAttribute("aria-pressed", String(oui));
  });
}

// Clic : choisir / retirer ; Maj + clic : toute la suite depuis le dernier clic.
function basculer(sel, cle, etendre, ordre) {
  if (etendre && derniereCle && ordre.includes(derniereCle)) {
    const [a, b] = [ordre.indexOf(derniereCle), ordre.indexOf(cle)].sort((x, y) => x - y);
    ordre.slice(a, b + 1).forEach((c) => sel.add(c));
  } else if (sel.has(cle)) sel.delete(cle);
  else sel.add(cle);
  derniereCle = cle;
}

// Bouton maintenu sur le cercle d'une photo puis glissé : sélectionne les photos entre celle de départ et la dernière
// survolée (ou les retire si la photo de départ était choisie). Les photos ne sont pas déplacées pendant ce geste.
let selectionGlissee = null;
function demarrerSelectionGlissee(e, zone, attr, sel, apres) {
  const rond = e.target.closest(".coche-vignette");
  const v = rond?.closest(`[${attr}]`);
  if (!v || e.button !== 0 || e.shiftKey) return;
  e.preventDefault();
  const depart = v.getAttribute(attr);
  selectionGlissee = { zone, attr, sel, apres, depart, derniere: depart, retirer: sel.has(depart), avant: new Set(sel), bouge: false };
}
function suivreSelectionGlissee(e) {
  const g = selectionGlissee;
  if (!g) return;
  const v = document.elementFromPoint(e.clientX, e.clientY)?.closest(`${g.zone} [${g.attr}]`);
  if (!v || v.getAttribute(g.attr) === g.derniere) return;
  g.derniere = v.getAttribute(g.attr);
  g.bouge = true;
  const ordre = $$(`${g.zone} [${g.attr}]`).map((x) => x.getAttribute(g.attr));
  const [a, b] = [ordre.indexOf(g.depart), ordre.indexOf(g.derniere)].sort((x, y) => x - y);
  g.sel.clear();
  g.avant.forEach((c) => g.sel.add(c));
  ordre.slice(a, b + 1).forEach((c) => (g.retirer ? g.sel.delete(c) : g.sel.add(c)));
  derniereCle = g.derniere;
  g.apres();
}
function finirSelectionGlissee() {
  const g = selectionGlissee;
  selectionGlissee = null;
  // Le clic qui suit le relâchement ne doit pas défaire la sélection glissée.
  if (!g?.bouge) return;
  const bloquer = (e) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener("click", bloquer, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", bloquer, { capture: true }), 0);
}
document.addEventListener("pointermove", suivreSelectionGlissee);
document.addEventListener("pointerup", finirSelectionGlissee);
document.addEventListener("pointercancel", finirSelectionGlissee);
$("#groupes-a-trier").addEventListener("pointerdown", (e) => demarrerSelectionGlissee(e, "#groupes-a-trier", "data-cle", selTri, () => {
  if (!selTri.size) enfantsTri.clear();
  viderRangees();
  majVignettes("#groupes-a-trier", selTri, "data-cle");
  afficherBarreTri();
}));
$("#grille-rangees").addEventListener("pointerdown", (e) => demarrerSelectionGlissee(e, "#grille-rangees", "data-numero", selRangees, () => {
  viderTri();
  majVignettes("#grille-rangees", selRangees, "data-numero");
  afficherBarreRangees();
}));

$("#groupes-a-trier").addEventListener("click", (e) => {
  const g = e.target.closest("[data-groupe]");
  if (g) {
    const els = groupesCourants[+g.dataset.groupe].elements;
    const tous = els.every((x) => selTri.has(x.cle));
    els.forEach((x) => (tous ? selTri.delete(x.cle) : selTri.add(x.cle)));
  } else {
    const v = e.target.closest("[data-cle]");
    if (!v) return;
    basculer(selTri, v.dataset.cle, e.shiftKey, donneesPhotos.a_trier.map((x) => x.cle));
  }
  if (!selTri.size) enfantsTri.clear();
  viderRangees();
  majVignettes("#groupes-a-trier", selTri, "data-cle");
  afficherBarreTri();
});
$("#tout-a-trier").addEventListener("click", () => {
  const tous = donneesPhotos.a_trier.every((x) => selTri.has(x.cle));
  donneesPhotos.a_trier.forEach((x) => (tous ? selTri.delete(x.cle) : selTri.add(x.cle)));
  viderRangees();
  majVignettes("#groupes-a-trier", selTri, "data-cle");
  afficherBarreTri();
});
$("#pastilles-tri").addEventListener("click", (e) => {
  if (e.target.closest("[data-autres-enfants]")) { tousLesEnfants = true; afficherBarreTri(); return; }
  const b = e.target.closest("[data-enfant]");
  if (!b) return;
  enfantsTri.has(b.dataset.enfant) ? enfantsTri.delete(b.dataset.enfant) : enfantsTri.add(b.dataset.enfant);
  afficherBarreTri();
});

// Sans enfant, une réalisation suffit : la photo va dans « Réalisations » jusqu'à ce qu'un enfant soit choisi.
function majBoutonRanger() {
  const n = selTri.size, avecRealisation = !!$("#activite-tri").value;
  $("#ranger").disabled = !n || (!enfantsTri.size && !avecRealisation);
  $("#ranger").lastChild.textContent = enfantsTri.size > 1 ? `Ranger pour ${enfantsTri.size} enfants`
    : !enfantsTri.size && avecRealisation ? "Ranger sans enfant" : "Ranger";
}
$("#activite-tri").addEventListener("change", majBoutonRanger);

// seanceImposee : réalisation imposée par l'endroit où les photos ont été glissées ("" = aucune) ; sinon (undefined),
// celle choisie dans la barre.
async function rangerSelection(enfants, seanceImposee) {
  const choisies = donneesPhotos.a_trier.filter((e) => selTri.has(e.cle));
  const avecRealisation = seanceImposee === undefined ? !!$("#activite-tri").value : !!seanceImposee;
  if (!choisies.length || (!enfants.length && !avecRealisation)) return;
  const jour = choisies.map((e) => e.date).filter(Boolean).sort()[0]?.slice(0, 10);
  let seance = seanceImposee;
  if (seance === undefined) {
    try { seance = await seanceChoisie($("#activite-tri"), jour); } catch (err) { alert(err.message); return; }
    if (seance === null) return;
  }
  $("#ranger").disabled = true;
  document.body.classList.add("occupe");
  try {
    const r = await api("photos/ranger", { cles: choisies.map((e) => e.cle), enfants, seance });
    if (r.erreurs.length) alert(r.erreurs.join("\n"));
  } catch (err) { alert(err.message); }
  document.body.classList.remove("occupe");
  selTri.clear();
  enfantsTri.clear();
  tousLesEnfants = false;
  await afficherPhotos();
}
$("#ranger").addEventListener("click", () => rangerSelection([...enfantsTri]));
$("#ignorer").addEventListener("click", async () => {
  await api("photos/ignorer", { cles: [...selTri], ignorer: true }).catch((e) => alert(e.message));
  selTri.clear();
  afficherPhotos();
});
$("#groupes-a-trier").addEventListener("dblclick", (e) => {
  const v = e.target.closest("[data-cle]");
  if (v) api("photos/ouvrir", { cle: v.dataset.cle }).catch((err) => alert(err.message));
});

// Glisser des photos à trier sur un enfant : case de la liste des enfants ou pastille de la barre en bas.
const PHOTOS_GLISSEES = "application/x-assmat-photos";
$("#groupes-a-trier").addEventListener("dragstart", (e) => {
  const v = e.target.closest("[data-cle]");
  if (selectionGlissee) { e.preventDefault(); return; }
  if (!v) return;
  if (!selTri.has(v.dataset.cle)) {
    selTri.clear();
    selTri.add(v.dataset.cle);
    viderRangees();
    majVignettes("#groupes-a-trier", selTri, "data-cle");
    afficherBarreTri();
  }
  $("#tri-photos").classList.add("glisse");
  afficherDepotFiltres(true);
  e.dataTransfer.setData(PHOTOS_GLISSEES, [...selTri].join(","));
  e.dataTransfer.effectAllowed = "copyMove";
});
const caseCible = (e) => e.dataTransfer?.types.includes(PHOTOS_GLISSEES) && e.target.closest?.("#photos [data-case-enfant]");
document.addEventListener("dragover", (e) => {
  const c = caseCible(e);
  $$("#photos .survol").forEach((x) => x !== c && x.classList.remove("survol"));
  if (!c) return;
  e.preventDefault();
  c.classList.add("survol");
});
document.addEventListener("drop", (e) => {
  const c = caseCible(e);
  if (!c) return;
  e.preventDefault();
  c.classList.remove("survol");
  if (e.ctrlKey) {               // répartir : l'enfant rejoint le choix, on range ensuite avec « Ranger »
    enfantsTri.add(c.dataset.caseEnfant);
    afficherBarreTri();
  } else rangerSelection([c.dataset.caseEnfant]);
});
document.addEventListener("dragend", () => {
  $$("#photos .survol, #photos .depot-actif").forEach((x) => x.classList.remove("survol", "depot-actif"));
  $("#tri-photos").classList.remove("glisse", "glisse-rangees");
  afficherDepotFiltres(false);
});

// Photos à trier glissées sur la zone des photos rangées : rangées avec les filtres choisis (enfant, réalisation).
// Sans filtre, la zone n'accepte rien.
function filtresDepot() {
  const seance = filtreActivite.startsWith("s:") ? filtreActivite.slice(2) : "";
  const realisation = seance && realisations().find((s) => s.id === seance);
  const enfant = filtreEnfant && enfantPar(filtreEnfant);
  if (!enfant && !realisation) return null;
  return { enfants: enfant ? [enfant.id] : [], seance,
    texte: [enfant?.prenom, realisation && nomRealisation(realisation.activite.titre, realisation.date)].filter(Boolean).join(" · ") };
}
function afficherDepotFiltres(oui) {
  const f = oui && filtresDepot();
  $("#depot-filtres").classList.toggle("cache", !f);
  $("#contenu-photos").classList.remove("survol-depot");
  if (!f) return;
  $("#depot-filtres").innerHTML = `${picto("telecharger")}<span>Déposez ici pour ranger avec <strong>${echapper(f.texte)}</strong></span>`;
  // Le panneau « À trier » couvre la droite de la page : le bandeau reste dans la partie visible.
  const panneau = $("#colonne-a-trier").getBoundingClientRect(), zone = $("#contenu-photos").getBoundingClientRect();
  $("#depot-filtres").style.maxWidth = $("#tri-photos").classList.contains("tri-ouvert") && panneau.left > zone.left
    ? `${panneau.left - zone.left - 16}px` : "";
}
$("#contenu-photos").addEventListener("dragover", (e) => {
  if (!e.dataTransfer?.types.includes(PHOTOS_GLISSEES) || !filtresDepot()) return;
  e.preventDefault();
  $("#contenu-photos").classList.add("survol-depot");
});
$("#contenu-photos").addEventListener("dragleave", (e) => {
  if (!$("#contenu-photos").contains(e.relatedTarget)) $("#contenu-photos").classList.remove("survol-depot");
});
$("#contenu-photos").addEventListener("drop", (e) => {
  const f = filtresDepot();
  if (!e.dataTransfer?.types.includes(PHOTOS_GLISSEES) || !f) return;
  e.preventDefault();
  afficherDepotFiltres(false);
  rangerSelection(f.enfants, f.seance);
});

// Sur le bouton ou le panneau « À trier » : photos rangées glissées (remises à trier), fichiers de l'Explorateur (copiés).
const RANGEES_GLISSEES = "application/x-assmat-rangees";
["#bouton-a-trier", "#colonne-a-trier"].forEach((sel) => {
  const zone = $(sel);
  zone.addEventListener("dragover", (e) => {
    const types = e.dataTransfer?.types || [];
    if (!types.includes("Files") && !types.includes(RANGEES_GLISSEES)) return;
    e.preventDefault();
    zone.classList.add("depot-actif");
  });
  zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("depot-actif"); });
  zone.addEventListener("drop", (e) => {
    zone.classList.remove("depot-actif");
    const rangees = e.dataTransfer?.getData(RANGEES_GLISSEES);
    if (rangees) {
      e.preventDefault();
      remettreRangees(rangees.split(","));
    } else if (e.dataTransfer?.files.length) {
      e.preventDefault();
      deposerFichiers(e.dataTransfer.files);
    }
  });
});
async function deposerFichiers(fichiers) {
  ouvrirATrier(true);
  const donnees = new FormData();
  [...fichiers].forEach((f) => { donnees.append("fichiers", f, f.name); donnees.append("modifie", f.lastModified); });
  document.body.classList.add("occupe");
  try {
    const r = await fetch("/api/photos/deposer", { method: "POST", body: donnees }).then((x) => x.json());
    if (r.erreurs?.length) alert(r.erreurs.join("\n"));
  } catch (err) { alert(err.message); }
  document.body.classList.remove("occupe");
  afficherPhotos();
}

// --- photos rangées
function afficherRangees() {
  const d = donneesPhotos;
  afficherCasesEnfants();
  // Filtre « Réalisations » : celles qui ont des photos et toutes celles déjà passées (on peut y glisser des photos),
  // de la plus récente à la plus ancienne.
  const aujourdhui = isoJour(new Date());
  const listees = realisations().filter((s) => s.photos?.length || s.date <= aujourdhui).sort((x, y) => y.date.localeCompare(x.date));
  if (filtreActivite.startsWith("s:") && !listees.some((s) => `s:${s.id}` === filtreActivite)) filtreActivite = "";
  $("#filtre-activite").innerHTML = [["", "Toutes"], ["aucune", "Sans réalisation"],
    ...listees.map((s) => [`s:${s.id}`, s.activite.titre, s])]
    .map(([v, t, r]) => `<button type="button" class="ligne-filtre${r ? " avec-icone" : ""}" data-filtre-activite="${v}"${
      r ? ` data-case-realisation="${r.id}" title="${echapper(nomRealisation(t, r.date))}"` : v === "aucune" ? ` data-case-realisation=""` : ""
      } aria-pressed="${filtreActivite === v}">${r ? picto(iconeActivite(r.activite)) : ""}<span>${echapper(t)}${
      r ? `<small class="date-realisation">du ${dateFr(r.date)}</small>` : ""}</span></button>`).join("");
  const liste = rangeesVisibles();
  $("#nb-rangees").textContent = pluriel(liste.length, "élément");
  let html = "", mois = null;
  liste.forEach((r) => {
    const m = (r.date || "").slice(0, 7);
    if (m !== mois) {
      if (mois !== null) html += "</div>";
      mois = m;
      html += `<h3 class="jour-photos">${m ? new Date(m + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        .replace(/^./, (c) => c.toUpperCase()) : "Sans date"}</h3><div class="grille-photos">`;
    }
    const realisation = !r.enfants.length && realisations().find((x) => x.id === r.seance);
    const noms = r.enfants.map((i) => enfantPar(i)?.prenom).filter(Boolean).join(", ") || (realisation ? realisation.activite.titre : "");
    html += vignette(r, `data-numero="${r.numero}"`, selRangees.has(r.numero),
      `<span class="numero-photo" title="${echapper(noms)}">${echapper(noms || r.numero)}</span>`);
  });
  $("#grille-rangees").innerHTML = liste.length ? html + "</div>" : `<p class="vide-photos">${d.rangees.length
    ? "Aucune photo pour ce choix." : `Aucune photo rangée. ${d.a_trier.length ? "Ouvrez « À trier », en bas à droite." : ""}`}</p>`;
  afficherBarreRangees();
}

// Barre de filtres à gauche : enfants (derniers gardés, gardés ce mois-ci, autres ; recherche par prénom ou famille),
// puis activités. Pendant le tri (panneau ouvert), les lignes des enfants s'agrandissent : on y dépose les photos.
const GROUPES_ENFANTS = [["derniers", "Derniers gardés", true], ["mois", "Ce mois-ci", true], ["autres", "Autres", false]];
const groupesOuverts = {};
function afficherCasesEnfants() {
  const d = donneesPhotos;
  const compte = (id) => d.rangees.filter((r) => r.enfants.includes(id)).length;
  const cherche = sansAccents(rechercheEnfant.trim());
  const trouves = d.enfants.filter((e) => !cherche || sansAccents(`${e.prenom} ${e.famille}`).includes(cherche));
  const ligne = (e) => `<button type="button" class="case-enfant" data-case-enfant="${e.id}" data-filtre-enfant="${e.id}"
    aria-pressed="${filtreEnfant === e.id}" title="${echapper(e.prenom)} (${echapper(e.famille)})">${initialeEnfant(e)}<span class="nom-enfant">${
    echapper(e.prenom)}<small>${echapper(e.famille)}</small></span><span class="compte">${compte(e.id)}</span></button>`;
  const tous = `<button type="button" class="case-enfant toutes" data-filtre-enfant="" aria-pressed="${!filtreEnfant}">
    <span class="nom-enfant">Tous</span><span class="compte">${d.rangees.length}</span></button>`;
  // Sans groupes (serveur d'une version précédente encore lancé) : simple liste.
  const groupes = !d.enfants.some((e) => e.groupe) ? trouves.map(ligne).join("") : GROUPES_ENFANTS.map(([cle, titre, ouvert]) => {
    const liste = trouves.filter((e) => (e.groupe || "autres") === cle);
    if (!liste.length) return "";
    const ouvre = cherche || (groupesOuverts[cle] ?? ouvert) || liste.some((e) => e.id === filtreEnfant);
    return `<details class="groupe-enfants" data-groupe-enfants="${cle}"${ouvre ? " open" : ""}><summary>${titre}</summary>${
      liste.map(ligne).join("")}</details>`;
  }).join("");
  $("#cases-enfants").innerHTML = !d.enfants.length
    ? `<p class="petit">Aucune fiche enfant. <button class="lien" data-aller-photos="contrats">Ajouter</button></p>`
    : (cherche ? "" : tous) + (groupes || `<p class="petit">Aucun résultat.</p>`);
  $$("#cases-enfants [data-aller-photos]").forEach((b) => b.addEventListener("click", () => ouvrirOnglet(b.dataset.allerPhotos)));
  $$("#cases-enfants [data-groupe-enfants]").forEach((g) => g.addEventListener("toggle", () => {
    if (!cherche) groupesOuverts[g.dataset.groupeEnfants] = g.open;
  }));
}
$("#recherche-enfants").addEventListener("input", (e) => { rechercheEnfant = e.target.value; afficherCasesEnfants(); });

function rangeesVisibles() {
  return donneesPhotos.rangees.filter((r) => (!filtreEnfant || r.enfants.includes(filtreEnfant))
    && (!filtreActivite || (filtreActivite === "aucune" ? !r.seance : `s:${r.seance}` === filtreActivite)));
}

function afficherBarreRangees() {
  const n = selRangees.size;
  $("#barre-rangees").classList.toggle("cache", !n);
  majBarrePhotos();
  $("#texte-rangees").textContent = `${pluriel(n, "élément")} sélectionné${n > 1 ? "s" : ""}`;
  const photosSeules = [...selRangees].filter((x) => donneesPhotos.rangees.find((r) => r.numero === x)?.genre === "photo").length;
  $("#imprimer-photos").disabled = !photosSeules;
  if (!n) $("#editeur-rangees").classList.add("cache");
}

$("#cases-enfants").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filtre-enfant]");
  if (!b) return;
  filtreEnfant = filtreEnfant === b.dataset.filtreEnfant ? "" : b.dataset.filtreEnfant;
  afficherRangees();
});
$("#filtre-activite").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filtre-activite]");
  if (!b) return;
  filtreActivite = b.dataset.filtreActivite;
  afficherRangees();
});
$("#grille-rangees").addEventListener("click", (e) => {
  const v = e.target.closest("[data-numero]");
  if (!v) return;
  basculer(selRangees, v.dataset.numero, e.shiftKey, rangeesVisibles().map((r) => r.numero));
  viderTri();
  majVignettes("#grille-rangees", selRangees, "data-numero");
  afficherBarreRangees();
});
$("#grille-rangees").addEventListener("dblclick", (e) => {
  const v = e.target.closest("[data-numero]");
  if (v) api("photos/ouvrir", { numero: v.dataset.numero }).catch((err) => alert(err.message));
});
$("#tout-rangees").addEventListener("click", () => {
  const liste = rangeesVisibles();
  const tous = liste.length && liste.every((r) => selRangees.has(r.numero));
  liste.forEach((r) => (tous ? selRangees.delete(r.numero) : selRangees.add(r.numero)));
  viderTri();
  majVignettes("#grille-rangees", selRangees, "data-numero");
  afficherBarreRangees();
});
$("#deselectionner-rangees").addEventListener("click", () => { selRangees.clear(); afficherRangees(); });
$("#imprimer-photos").addEventListener("click", () => {
  const ordre = donneesPhotos.rangees.filter((r) => selRangees.has(r.numero) && r.genre === "photo")
    .sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((r) => r.numero);
  window.open(`/api/photos/imprimer?numeros=${ordre.join(",")}&par_page=${$("#par-page").value}`, "_blank");
});
// Remettre à trier : les copies rangées pour chaque enfant sont retirées, le fichier retourne dans « À trier ».
async function remettreRangees(numeros) {
  document.body.classList.add("occupe");
  for (const numero of numeros) await api("photos/remettre", { numero }).catch((e) => alert(e.message));
  document.body.classList.remove("occupe");
  numeros.forEach((n) => selRangees.delete(n));
  afficherPhotos();
}
$("#remettre-rangees").addEventListener("click", () => {
  const n = selRangees.size;
  if (confirm(`Remettre ${n > 1 ? `ces ${n} éléments` : "cet élément"} à trier ? Les copies rangées pour chaque enfant sont retirées ;
le fichier retourne dans le dossier « À trier ».`)) remettreRangees([...selRangees]);
});
// Glisser des photos rangées sur le bouton ou le panneau « À trier » : elles y retournent.
$("#grille-rangees").addEventListener("dragstart", (e) => {
  const v = e.target.closest("[data-numero]");
  if (selectionGlissee) { e.preventDefault(); return; }
  if (!v) return;
  if (!selRangees.has(v.dataset.numero)) {
    selRangees.clear();
    selRangees.add(v.dataset.numero);
    viderTri();
    majVignettes("#grille-rangees", selRangees, "data-numero");
    afficherBarreRangees();
  }
  $("#tri-photos").classList.add("glisse-rangees");
  e.dataTransfer.setData(RANGEES_GLISSEES, [...selRangees].join(","));
  e.dataTransfer.effectAllowed = "move";
});

// Glisser des photos rangées sur une réalisation du filtre : elles y sont rattachées (« Sans réalisation » les en
// détache). Leurs enfants ne changent pas. Des photos à trier glissées sur une réalisation y sont rangées.
// Photos à trier : seulement sur une réalisation (pas « Sans réalisation »).
const caseRealisation = (e) => {
  const c = e.target.closest?.("#filtre-activite [data-case-realisation]"), types = e.dataTransfer?.types || [];
  return c && (types.includes(RANGEES_GLISSEES) || (types.includes(PHOTOS_GLISSEES) && c.dataset.caseRealisation)) ? c : null;
};
document.addEventListener("dragover", (e) => {
  const c = caseRealisation(e);
  $$("#filtre-activite .survol").forEach((x) => x !== c && x.classList.remove("survol"));
  if (!c) return;
  e.preventDefault();
  c.classList.add("survol");
});
document.addEventListener("drop", async (e) => {
  const c = caseRealisation(e);
  if (!c) return;
  e.preventDefault();
  c.classList.remove("survol");
  // Photos à trier : rangées dans cette réalisation, pour les enfants déjà choisis dans la barre (ou sans enfant).
  if (e.dataTransfer.types.includes(PHOTOS_GLISSEES)) {
    if (c.dataset.caseRealisation) rangerSelection([...enfantsTri], c.dataset.caseRealisation);
    return;
  }
  await rattacherPhotos(e.dataTransfer.getData(RANGEES_GLISSEES).split(",").filter(Boolean), c.dataset.caseRealisation);
  afficherPhotos();
});
async function rattacherPhotos(numeros, seance) {
  if (!numeros.length) return null;
  document.body.classList.add("occupe");
  const r = await api("photos/rattacher", { numeros, seance }).catch((err) => ({ erreurs: [err.message] }));
  document.body.classList.remove("occupe");
  if (r.erreurs?.length) alert(r.erreurs.join("\n"));
  return r;
}

// Changer les enfants (et l'activité) des photos rangées choisies.
const enfantsEditeur = new Set();
$("#modifier-rangees").addEventListener("click", () => {
  const choisies = donneesPhotos.rangees.filter((r) => selRangees.has(r.numero));
  enfantsEditeur.clear();
  choisies.forEach((r) => r.enfants.forEach((i) => enfantsEditeur.add(i)));
  const seances = new Set(choisies.map((r) => r.seance));
  remplirActivites($("#activite-editeur"), [], true, seances.size === 1 && choisies[0].seance ? `s:${choisies[0].seance}` : "");
  $("#titre-editeur").textContent = choisies.length > 1 ? `ces ${choisies.length} éléments` : "cette photo";
  afficherEditeur();
  $("#editeur-rangees").classList.remove("cache");
});
function afficherEditeur() {
  $("#pastilles-editeur").innerHTML = donneesPhotos.enfants.map((e) => pastilleEnfant(e, enfantsEditeur.has(e.id))).join("");
}
$("#pastilles-editeur").addEventListener("click", (e) => {
  const b = e.target.closest("[data-enfant]");
  if (!b) return;
  enfantsEditeur.has(b.dataset.enfant) ? enfantsEditeur.delete(b.dataset.enfant) : enfantsEditeur.add(b.dataset.enfant);
  afficherEditeur();
});
$("#annuler-editeur").addEventListener("click", () => $("#editeur-rangees").classList.add("cache"));
$("#enregistrer-editeur").addEventListener("click", async () => {
  if (!enfantsEditeur.size && !$("#activite-editeur").value) {
    alert("Choisissez au moins un enfant ou une réalisation (ou utilisez « Remettre à trier »)."); return;
  }
  const choisies = donneesPhotos.rangees.filter((r) => selRangees.has(r.numero));
  let seance;
  try { seance = await seanceChoisie($("#activite-editeur"), choisies.map((r) => r.date).filter(Boolean).sort()[0]?.slice(0, 10)); }
  catch (err) { alert(err.message); return; }
  if (seance === null) return;
  document.body.classList.add("occupe");
  for (const r of choisies) await api("photos/modifier", { numero: r.numero, enfants: [...enfantsEditeur], seance }).catch((e) => alert(e.message));
  document.body.classList.remove("occupe");
  $("#editeur-rangees").classList.add("cache");
  afficherPhotos();
});

// --- hors horaires et ignorées
function afficherMisDeCote() {
  [["hors_horaires", "#grille-hors", "#nb-hors", "#remettre-hors", selHors, "#bloc-hors"],
    ["ignorees", "#grille-ignorees", "#nb-ignorees", "#remettre-ignorees", selIgnorees, "#bloc-ignorees"]]
    .forEach(([cle, grille, nb, bouton, sel, bloc]) => {
      const liste = donneesPhotos[cle];
      $(nb).textContent = `(${liste.length})`;
      $(bloc).classList.toggle("cache", !liste.length);
      // Les aperçus ne sont chargés qu'à l'ouverture du bloc (il peut y avoir beaucoup de photos personnelles).
      $(grille).innerHTML = $(bloc).open ? liste.slice(0, 300).map((e) => vignette(e, `data-cle="${e.cle}"`, sel.has(e.cle))).join("")
        + (liste.length > 300 ? `<p class="petit">… et ${liste.length - 300} autres.</p>` : "") : "";
      $(bouton).disabled = !sel.size;
    });
}
[["#bloc-hors", "#grille-hors", selHors, "#remettre-hors"], ["#bloc-ignorees", "#grille-ignorees", selIgnorees, "#remettre-ignorees"]]
  .forEach(([bloc, grille, sel, bouton]) => {
    $(bloc).addEventListener("toggle", () => donneesPhotos && afficherMisDeCote());
    $(grille).addEventListener("click", (e) => {
      const v = e.target.closest("[data-cle]");
      if (!v) return;
      sel.has(v.dataset.cle) ? sel.delete(v.dataset.cle) : sel.add(v.dataset.cle);
      majVignettes(grille, sel, "data-cle");
      $(bouton).disabled = !sel.size;
    });
    $(grille).addEventListener("dblclick", (e) => {
      const v = e.target.closest("[data-cle]");
      if (v) api("photos/ouvrir", { cle: v.dataset.cle }).catch((err) => alert(err.message));
    });
    $(bouton).addEventListener("click", async () => {
      await api("photos/ignorer", { cles: [...sel], ignorer: false }).catch((e) => alert(e.message));
      sel.clear();
      afficherPhotos();
    });
  });
$("#actualiser-photos").addEventListener("click", () => afficherPhotos());

// ------------------------------------------------------------- activités et réalisations
// Deux onglets. « Activités » : les fiches réutilisables (description, à préparer, documents, ajoutés dès la création).
// « Réalisations » : une activité faite ou prévue à une date (une « séance » dans les données), sur un calendrier ;
// un clic sur un jour montre ses réalisations en détail (à préparer, documents, photos rangées avec elles).
let activiteOuverte = "";          // identifiant, « nouvelle » ou vide
let vueAteliers = "activites";
let documentsEnAttente = [];       // documents choisis pour une activité pas encore enregistrée
let moisRealisations = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let jourRealisations = isoJour(new Date());
let sansRealisation = {};          // photos rangées sans réalisation, par jour de prise de vue
const choixRattacher = { jour: "", numeros: new Set() };

// « Peinture d'automne du 14 octobre 2026 » : nom d'une réalisation partout où elle est proposée.
const nomRealisation = (titre, jour) => `${titre} du ${dateFr(jour)}`;
const realisations = () => activitesConnues.flatMap((a) => a.seances.map((s) => ({ ...s, activite: a })));

async function afficherAteliers() {
  const r = await api("ateliers").catch((e) => { alert(e.message); return null; });
  if (!r) return;
  activitesConnues = r.activites;
  sansRealisation = r.sans_realisation || {};
  $("#ateliers-sans-dossier").classList.toggle("cache", r.configure);
  $$("[data-vue-ateliers]").forEach((b) => {
    const oui = b.dataset.vueAteliers === vueAteliers;
    b.classList.toggle("actif", oui);
    b.setAttribute("aria-selected", String(oui));
  });
  $("#vue-activites").classList.toggle("cache", vueAteliers !== "activites");
  $("#vue-realisations").classList.toggle("cache", vueAteliers !== "realisations");
  if (vueAteliers === "realisations") { afficherRealisations(); return; }
  const aujourdhui = isoJour(new Date());
  $("#liste-activites").innerHTML = r.activites.length ? r.activites.map((a) => {
    const passees = a.seances.filter((s) => s.date <= aujourdhui), venir = a.seances.filter((s) => s.date > aujourdhui);
    const detail = [venir.length ? `prévue le ${dateCourte(venir.at(-1).date)}` : "",
      passees.length ? `${pluriel(passees.length, "réalisation")}, la dernière le ${dateCourte(passees[0].date)}` : "jamais réalisée"]
      .filter(Boolean).join(" · ");
    return `<li><button type="button" class="carte-activite" data-activite="${a.id}" aria-pressed="${activiteOuverte === a.id}">
      ${pastille(iconeActivite(a), "familles")}<span><span class="nom">${echapper(a.titre)}</span><span class="petit">${detail}</span></span></button></li>`;
  }).join("") : `<li class="petit">Aucune activité pour l'instant : créez la première avec « Nouvelle activité ».</li>`;
  appliquerFiltres();
  afficherFicheActivite();
}

function choisirVueAteliers(vue) {
  vueAteliers = vue;
  afficherAteliers();
}
$$("[data-vue-ateliers]").forEach((b) => b.addEventListener("click", () => choisirVueAteliers(b.dataset.vueAteliers)));

function listeDocuments(a) {
  return (a.documents || []).map((d) => `<li>${picto("pdf")}<button type="button" class="lien" data-ouvrir-document="${
    echapper(d.nom)}" data-activite-document="${a.id}">${echapper(d.nom)}</button></li>`).join("");
}

function afficherFicheActivite() {
  const fiche = $("#fiche-activite");
  const a = activitesConnues.find((x) => x.id === activiteOuverte);
  if (!a && activiteOuverte !== "nouvelle") { fiche.classList.add("cache"); return; }
  fiche.classList.remove("cache");
  const aujourdhui = isoJour(new Date());
  const dates = a ? a.seances.map((s) => `<li><button type="button" class="lien" data-voir-jour="${s.date}">${dateFr(s.date)}</button>
      <span class="petit">${s.date > aujourdhui ? "prévue" : s.date === aujourdhui ? "aujourd'hui" : "réalisée"}${
      s.photos?.length ? ` · ${pluriel(s.photos.length, "photo")}` : ""}</span></li>`).join("") : "";
  fiche.innerHTML = `<form id="form-activite" class="formulaire-activite">
      <h2>${a ? echapper(a.titre) : "Nouvelle activité"}</h2>
      <div class="titre-et-icone">
        <button type="button" class="apercu-icone" id="apercu-icone" aria-expanded="false" title="Choisir une icône">${picto(iconeActivite(a))}</button>
        <input type="hidden" name="icone" value="${echapper(a?.icone || "")}">
        <label>Titre <input name="titre" required maxlength="120" value="${echapper(a?.titre || "")}" placeholder="Peinture d'automne"></label>
      </div>
      <div class="grille-icones cache" id="grille-icones" role="listbox" aria-label="Icônes">${ICONES_ACTIVITES.map(([cle, nom]) =>
        `<button type="button" role="option" data-icone="${cle}" title="${echapper(nom)}" aria-label="${echapper(nom)}">${picto(`a-${cle}`)}</button>`).join("")}</div>
      <label>Description <textarea name="description" rows="3" placeholder="Déroulement, âges, durée…">${echapper(a?.description || "")}</textarea></label>
      <label>À préparer, acheter ou rassembler <textarea name="a_preparer" rows="4"
        placeholder="Une ligne par élément : gouache, pinceaux, feuilles ramassées…">${echapper((a?.a_preparer || []).join("\n"))}</textarea></label>
      <h3 class="sous-titre">Documents</h3>
      <ul class="documents-activite" id="documents-activite">${a ? listeDocuments(a) || `<li class="petit">Aucun document.</li>` : ""}</ul>
      <div class="zone-depot" id="depot-activite">Glissez ici des documents (modèles, coloriages, images…) ou
        <button type="button" class="lien" id="choisir-documents">choisissez des fichiers</button>.
        ${a ? `Ils sont copiés dans le dossier « Activités\\${echapper(a.dossier || a.titre)} ».`
          : "Ils seront copiés dans le dossier de l'activité à l'enregistrement."}
        <input type="file" id="fichiers-activite" class="cache" multiple></div>
      ${a ? `<div class="boutons"><button type="button" class="secondaire" data-ouvrir-dossier-activite>${picto("dossier")}Ouvrir le dossier de l'activité</button></div>` : ""}
      <div class="boutons">
        <button class="principal" data-picto-js="coche">Enregistrer</button>
        <button type="button" class="secondaire" data-fermer-activite>Fermer</button>
        ${a ? `<button type="button" class="action danger" data-supprimer-activite>${picto("supprimer")}Supprimer l'activité</button>` : ""}
      </div>
    </form>
    ${a ? `<h3 class="sous-titre">Réalisations</h3>
      <ul class="dates-realisations">${dates || `<li class="petit">Pas encore réalisée.</li>`}</ul>
      <div class="ligne nouvelle-seance"><label>Date <input type="date" id="date-seance" value="${aujourdhui}"></label>
        <button type="button" class="secondaire" id="ajouter-seance">${picto("plus")}Ajouter une réalisation</button></div>` : ""}`;
  fiche.querySelector("[data-picto-js]")?.insertAdjacentHTML("afterbegin", picto("coche"));
  marquerChamps($("#form-activite"));
  majApercuIcone();
  if (!a) afficherDocumentsEnAttente();
}

// Icône : choisie dans la grille, sinon proposée d'après le titre tant qu'aucune n'a été choisie.
function majApercuIcone() {
  const f = $("#form-activite");
  const cle = f.elements.icone.value || iconeProposee(f.elements.titre.value);
  $("#apercu-icone").innerHTML = picto(`a-${cle}`);
  $("#apercu-icone").title = `${ICONES_ACTIVITES.find((i) => i[0] === cle)?.[1] || ""} : choisir une autre icône`;
  $$("#grille-icones [data-icone]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.icone === cle)));
}
$("#fiche-activite").addEventListener("input", (e) => { if (e.target.name === "titre") majApercuIcone(); });

// Activité pas encore enregistrée : les documents choisis attendent l'enregistrement (la fiche n'est pas redessinée,
// pour garder ce qui est déjà saisi).
function afficherDocumentsEnAttente() {
  $("#documents-activite").innerHTML = documentsEnAttente.map((f, i) => `<li>${picto("pdf")}<span>${echapper(f.name)}</span>
    <button type="button" class="icone" data-retirer-attente="${i}" aria-label="Retirer">${picto("fermer")}</button></li>`).join("");
}

async function envoyerDocuments(fichiers, activite = activiteOuverte) {
  if (!fichiers.length) return;
  if (activite === "nouvelle") {
    documentsEnAttente.push(...fichiers);
    afficherDocumentsEnAttente();
    return;
  }
  const donnees = new FormData();
  donnees.append("activite", activite);
  [...fichiers].forEach((f) => donnees.append("fichiers", f, f.name));
  const r = await fetch("/api/ateliers/document", { method: "POST", body: donnees }).then((x) => x.json()).catch((e) => ({ erreurs: [e.message] }));
  if (r.erreurs?.length) alert(r.erreurs.join("\n"));
  afficherAteliers();
}

$("#nouvelle-activite").addEventListener("click", () => {
  activiteOuverte = "nouvelle";
  documentsEnAttente = [];
  vueAteliers = "activites";
  afficherAteliers().then(() => {
    $("#fiche-activite").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#form-activite")?.elements.titre.focus();
  });
});
$("#liste-activites").addEventListener("click", (e) => {
  const b = e.target.closest("[data-activite]");
  if (!b) return;
  activiteOuverte = activiteOuverte === b.dataset.activite ? "" : b.dataset.activite;
  afficherAteliers();
});
$("#fiche-activite").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const a = await api("ateliers", { id: activiteOuverte === "nouvelle" ? "" : activiteOuverte, titre: f.elements.titre.value,
      icone: f.elements.icone.value || iconeProposee(f.elements.titre.value),
      description: f.elements.description.value, a_preparer: f.elements.a_preparer.value });
    activiteOuverte = a.id;
  } catch (err) { alert(err.message); return; }
  const attente = documentsEnAttente;
  documentsEnAttente = [];
  if (attente.length) await envoyerDocuments(attente);
  else afficherAteliers();
});

// Actions communes aux deux onglets (documents, photos, retrait d'une réalisation, cases « prêt »).
async function actionAteliers(cible) {
  if (cible.dataset.ouvrirDocument) {
    api("ateliers/ouvrir", { activite: cible.dataset.activiteDocument, nom: cible.dataset.ouvrirDocument }).catch((err) => alert(err.message));
  } else if (cible.dataset.supprimerSeance) {
    if (!confirm("Retirer cette réalisation ? Les photos rangées restent en place.")) return;
    await api("ateliers/seance/supprimer", { id: cible.dataset.supprimerSeance }).catch((err) => alert(err.message));
    afficherAteliers();
  } else if (cible.dataset.voirPhotos) {
    filtreActivite = `s:${cible.dataset.voirPhotos}`;
    filtreEnfant = "";
    ouvrirOnglet("photos");
  } else if (cible.dataset.ouvrirPhoto) {
    api("photos/ouvrir", { numero: cible.dataset.ouvrirPhoto }).catch((err) => alert(err.message));
  } else if (cible.dataset.voirJour) {
    jourRealisations = cible.dataset.voirJour;
    const d = new Date(jourRealisations + "T12:00:00");
    moisRealisations = new Date(d.getFullYear(), d.getMonth(), 1);
    choisirVueAteliers("realisations");
  } else if (cible.dataset.ouvrirFiche) {
    activiteOuverte = cible.dataset.ouvrirFiche;
    choisirVueAteliers("activites");
  }
}
async function cochePrepare(e) {
  const seance = e.target.dataset.prepare;
  if (!seance) return;
  const prepare = $$(`[data-prepare="${seance}"]`).filter((c) => c.checked).map((c) => c.value);
  await api("ateliers/seance/modifier", { id: seance, prepare }).catch((err) => alert(err.message));
  const s = realisations().find((x) => x.id === seance);
  if (s) s.prepare = prepare;
}

$("#fiche-activite").addEventListener("click", async (e) => {
  const cible = e.target.closest("button");
  if (!cible) return;
  if (cible.matches("[data-fermer-activite]")) { activiteOuverte = ""; documentsEnAttente = []; afficherAteliers(); }
  else if (cible.id === "apercu-icone") {
    const ouvre = $("#grille-icones").classList.toggle("cache") === false;
    cible.setAttribute("aria-expanded", String(ouvre));
  } else if (cible.dataset.icone) {
    $("#form-activite").elements.icone.value = cible.dataset.icone;
    $("#grille-icones").classList.add("cache");
    $("#apercu-icone").setAttribute("aria-expanded", "false");
    majApercuIcone();
  } else if (cible.matches("[data-supprimer-activite]")) {
    if (!confirm("Supprimer cette activité et ses réalisations ? Son dossier de documents et les photos rangées restent en place.")) return;
    await api("ateliers/supprimer", { id: activiteOuverte }).catch((err) => alert(err.message));
    activiteOuverte = "";
    afficherAteliers();
  } else if (cible.id === "ajouter-seance") {
    try { await api("ateliers/seance", { activite: activiteOuverte, date: $("#date-seance").value }); }
    catch (err) { alert(err.message); return; }
    afficherAteliers();
  } else if (cible.dataset.retirerAttente) {
    documentsEnAttente.splice(Number(cible.dataset.retirerAttente), 1);
    afficherDocumentsEnAttente();
  } else if (cible.matches("[data-ouvrir-dossier-activite]")) {
    api("ateliers/ouvrir", { activite: activiteOuverte }).catch((err) => alert(err.message));
  } else if (cible.id === "choisir-documents") $("#fichiers-activite").click();
  else actionAteliers(cible);
});
$("#fiche-activite").addEventListener("change", (e) => {
  if (e.target.id === "fichiers-activite") { envoyerDocuments([...e.target.files]); e.target.value = ""; }
});
$("#fiche-activite").addEventListener("dragover", (e) => {
  const zone = e.target.closest?.("#depot-activite");
  if (zone && e.dataTransfer?.types.includes("Files")) { e.preventDefault(); zone.classList.add("survol"); }
});
$("#fiche-activite").addEventListener("dragleave", (e) => e.target.closest?.("#depot-activite")?.classList.remove("survol"));
$("#fiche-activite").addEventListener("drop", (e) => {
  const zone = e.target.closest?.("#depot-activite");
  if (!zone || !e.dataTransfer?.files.length) return;
  e.preventDefault();
  zone.classList.remove("survol");
  envoyerDocuments([...e.dataTransfer.files]);
});

// --- réalisations : calendrier du mois, puis le détail du jour choisi
function afficherRealisations() {
  const premier = moisRealisations;
  const cle = isoJour(premier).slice(0, 7);
  $("#titre-mois-realisations").textContent = premier.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
  const parJour = {};
  realisations().forEach((r) => (parJour[r.date] ??= []).push(r));
  const debut = new Date(premier);
  debut.setDate(1 - ((premier.getDay() + 6) % 7));        // lundi de la première semaine
  const aujourdhui = isoJour(new Date());
  const cases = [];
  for (let d = new Date(debut); cases.length < 42; d.setDate(d.getDate() + 1)) {
    const iso = isoJour(d);
    if (cases.length % 7 === 0 && cases.length >= 35 && iso.slice(0, 7) !== cle) break;
    const liste = parJour[iso] || [];
    const puces = liste.slice(0, 3).map((r) => `<span class="puce-realisation${r.date > aujourdhui ? " a-venir" : ""}">${
      picto(iconeActivite(r.activite))}${echapper(r.activite.titre)}</span>`).join("")
      + (liste.length > 3 ? `<span class="puce-plus">+${liste.length - 3}</span>` : "");
    cases.push(`<button type="button" class="jour${iso.slice(0, 7) !== cle ? " hors-mois" : ""}${iso === aujourdhui ? " aujourdhui" : ""}${
      iso === jourRealisations ? " choisi" : ""}" data-jour="${iso}" aria-pressed="${iso === jourRealisations}"
      title="${echapper(liste.map((r) => r.activite.titre).join(", ") || jourLong(iso))}"><span class="numero-jour">${d.getDate()}</span>${puces}</button>`);
  }
  $("#calendrier-realisations").innerHTML = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]
    .map((j) => `<span class="nom-jour">${j}</span>`).join("") + cases.join("");
  afficherJourRealisations();
}

const miniPhoto = (n) => `<img loading="lazy" alt="" src="/api/photos/miniature?numero=${n}"
  onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sans-apercu',textContent:'${n}'}))">`;

function carteRealisation(r) {
  const a = r.activite, aujourdhui = isoJour(new Date());
  const prepare = new Set(r.prepare || []);
  const etat = r.date > aujourdhui ? "prévue" : r.date === aujourdhui ? "aujourd'hui" : "réalisée";
  const aPreparer = (a.a_preparer || []).length ? `<h4>À préparer</h4><ul class="a-preparer">${a.a_preparer.map((x) => `<li>
    <label class="case-a-cocher"><input type="checkbox" data-prepare="${r.id}" value="${echapper(x)}" ${prepare.has(x) ? "checked" : ""}>${
    echapper(x)}</label></li>`).join("")}</ul>` : "";
  const docs = listeDocuments(a);
  const photos = r.photos || [];
  return `<article class="carte-realisation${r.date > aujourdhui ? " a-venir-seance" : ""}">
    <div class="entete-seance">${pastille(iconeActivite(a), "familles")}<h3>${echapper(a.titre)}</h3><span class="etat-realisation">${etat}</span></div>
    ${a.description ? `<p class="description-activite">${echapper(a.description)}</p>` : ""}
    ${aPreparer}
    ${docs ? `<h4>Documents</h4><ul class="documents-activite">${docs}</ul>` : ""}
    ${photos.length ? `<h4>${pluriel(photos.length, "photo")}</h4><div class="photos-realisation">${photos.map((n) =>
      `<button type="button" class="mini-photo" data-ouvrir-photo="${n}" title="Photo ${n} : ouvrir">${miniPhoto(n)}</button>`).join("")}</div>` : ""}
    <div class="boutons">
      ${photos.length ? `<button type="button" class="action" data-voir-photos="${r.id}">${picto("appareil")}Voir dans Photos</button>` : ""}
      <button type="button" class="action" data-ouvrir-fiche="${a.id}">${picto("activite")}Fiche de l'activité</button>
      <button type="button" class="action danger" data-supprimer-seance="${r.id}">${picto("supprimer")}Retirer</button>
    </div>
  </article>`;
}

function afficherJourRealisations() {
  const liste = realisations().filter((r) => r.date === jourRealisations);
  const deja = new Set(liste.map((r) => r.activite.id));
  const autres = activitesConnues.filter((a) => !deja.has(a.id));
  // Photos de ce jour rangées sans réalisation : toutes choisies d'abord, un clic en retire une.
  const sans = sansRealisation[jourRealisations] || [];
  if (choixRattacher.jour !== jourRealisations) {
    choixRattacher.jour = jourRealisations;
    choixRattacher.numeros = new Set(sans);
  }
  const aRattacher = !sans.length ? "" : liste.length ? `<div class="photos-a-rattacher">
      <h3>${pluriel(sans.length, "photo")} de ce jour sans réalisation</h3>
      <div class="photos-realisation">${sans.map((n) => `<button type="button" class="mini-photo${choixRattacher.numeros.has(n) ? " choisie" : ""}"
        data-choix-photo="${n}" aria-pressed="${choixRattacher.numeros.has(n)}" title="Photo ${n} : cliquer pour la choisir ou non">${miniPhoto(n)}
        <span class="coche-vignette" aria-hidden="true">${picto("coche")}</span></button>`).join("")}</div>
      <div class="boutons">${liste.map((r) => `<button type="button" class="secondaire" data-rattacher="${r.id}"${choixRattacher.numeros.size ? "" : " disabled"}>${
        picto("plus")}Ajouter à « ${echapper(r.activite.titre)} »</button>`).join("")}</div></div>`
    : `<p class="petit">${pluriel(sans.length, "photo")} de ce jour ${sans.length > 1 ? "sont rangées" : "est rangée"} sans réalisation :
      ajoutez la réalisation ci-dessous pour les y rattacher.</p>`;
  $("#jour-realisations").innerHTML = `<h2>${jourLong(jourRealisations)}</h2>
    ${liste.map(carteRealisation).join("") || `<p class="petit">Aucune réalisation ce jour-là.</p>`}
    ${aRattacher}
    ${autres.length ? `<div class="ligne nouvelle-seance"><label>Ajouter une réalisation <select id="activite-realisation">${
      autres.map((a) => `<option value="${a.id}">${echapper(a.titre)}</option>`).join("")}</select></label>
      <button type="button" class="secondaire" id="ajouter-realisation">${picto("plus")}Ajouter</button></div>`
      : activitesConnues.length ? "" : `<p class="petit">Créez d'abord une activité dans l'onglet « Activités ».</p>`}`;
}

$("#calendrier-realisations").addEventListener("click", (e) => {
  const b = e.target.closest("[data-jour]");
  if (!b) return;
  jourRealisations = b.dataset.jour;
  if (jourRealisations.slice(0, 7) !== isoJour(moisRealisations).slice(0, 7)) {
    const d = new Date(jourRealisations + "T12:00:00");
    moisRealisations = new Date(d.getFullYear(), d.getMonth(), 1);
  }
  afficherRealisations();
  if (matchMedia("(max-width: 900px)").matches) $("#jour-realisations").scrollIntoView({ behavior: "smooth", block: "start" });
});
const changerMoisRealisations = (n) => {
  moisRealisations = new Date(moisRealisations.getFullYear(), moisRealisations.getMonth() + n, 1);
  afficherRealisations();
};
$("#mois-realisations-precedent").addEventListener("click", () => changerMoisRealisations(-1));
$("#mois-realisations-suivant").addEventListener("click", () => changerMoisRealisations(1));
$("#mois-realisations-precedent").innerHTML = picto("monter").replace("m6 15 6-6 6 6", "m15 6-6 6 6 6");
$("#mois-realisations-suivant").innerHTML = picto("monter").replace("m6 15 6-6 6 6", "m9 6 6 6-6 6");
$("#mois-realisations-aujourdhui").addEventListener("click", () => {
  jourRealisations = isoJour(new Date());
  moisRealisations = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  afficherRealisations();
});
$("#jour-realisations").addEventListener("click", async (e) => {
  const cible = e.target.closest("button");
  if (!cible) return;
  if (cible.dataset.choixPhoto) {
    const n = cible.dataset.choixPhoto;
    choixRattacher.numeros.has(n) ? choixRattacher.numeros.delete(n) : choixRattacher.numeros.add(n);
    afficherJourRealisations();
  } else if (cible.dataset.rattacher) {
    await rattacherPhotos([...choixRattacher.numeros], cible.dataset.rattacher);
    choixRattacher.jour = "";
    afficherAteliers();
  } else if (cible.id === "ajouter-realisation") {
    try { await api("ateliers/seance", { activite: $("#activite-realisation").value, date: jourRealisations }); }
    catch (err) { alert(err.message); return; }
    afficherAteliers();
  } else actionAteliers(cible);
});
$("#jour-realisations").addEventListener("change", cochePrepare);

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
    $("#texte-maj").textContent = `Version ${v.distante} disponible`;
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

// Icône du raccourci à la place du logo dessiné (gardé si Windows ne la donne pas).
function afficherIconeApplication() {
  const image = new Image();
  image.className = "logo";
  image.alt = "";
  image.onload = () => $$(".marque svg.logo").forEach((svg) => svg.replaceWith(image.cloneNode()));
  image.src = "/api/icone-application";
}

chargerParametres().then(afficherTableauDeBord);
afficherIconeApplication();
afficherPrincipal();
afficherNotes();
afficherBaremes();
verifierVersion();
rafraichir();
const minuterieEtat = setInterval(rafraichir, 1500);
