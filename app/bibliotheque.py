"""Analyse du dossier « Bulletins de salaire » sur le disque.

Un dossier rempli à la main contient souvent des noms très variés, par exemple :
    paje_bulletinsalaire Dupont 08 2025.pdf
    paje_bulletinsalaire. MARTIN 09 24.pdf
    paje_bulletinsalaire Martin emma 2026 01.pdf
    Bulletin de salaire - DURAND - 2025-07.pdf   (format de l'application)
On en déduit, pour chaque PDF, une période (AAAA-MM) et des mots-clés de nom,
afin de savoir quels bulletins sont déjà présents.
"""
import re
import unicodedata
from pathlib import Path

MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet",
        "aout", "septembre", "octobre", "novembre", "decembre"]
MOIS_AFFICHAGE = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet",
                  "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

# Mots qui ne désignent pas un client.
MOTS_GENERIQUES = {
    "paje", "bulletinsalaire", "bulletinsalair", "bulletins", "bulletin", "salaire",
    "de", "du", "le", "la", "pdf", "rectifie", "rectificatif", "copie", "mme", "mr",
    "m", "monsieur", "madame", "et",
}


def normaliser(texte: str) -> str:
    texte = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", texte).strip().lower()


def mots(texte: str) -> set:
    return {m for m in re.findall(r"[a-z]+", normaliser(texte))
            if len(m) >= 3 and m not in MOTS_GENERIQUES and m not in MOIS}


def periode_depuis_texte(texte: str):
    """Trouve une période AAAA-MM dans un texte libre (nom de fichier, ligne de tableau)."""
    t = normaliser(texte)
    # « janvier 2025 », « aout 2024 »
    m = re.search(r"\b(" + "|".join(MOIS) + r")\.?\s+(20\d\d)\b", t)
    if m:
        return f"{m.group(2)}-{MOIS.index(m.group(1)) + 1:02d}"
    # 2025-01, 2025 01, 2025_01, 2025/01
    m = re.search(r"\b(20\d\d)[\s_\-/.]+(0[1-9]|1[0-2])\b", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    # 01/2025, 01 2025, 01_2025, 01-2025, 08  2025
    m = re.search(r"\b(0?[1-9]|1[0-2])[\s_\-/.]+(20\d\d)\b", t)
    if m:
        return f"{m.group(2)}-{int(m.group(1)):02d}"
    # 09 24, 0924 (année sur deux chiffres)
    m = re.search(r"\b(0[1-9]|1[0-2])\s?(2\d)\b", t)
    if m:
        return f"20{m.group(2)}-{m.group(1)}"
    return None


def inventaire(dossier: str) -> list:
    """Liste des PDF présents : [{chemin, periode, mots}]."""
    racine = Path(dossier)
    if not racine.is_dir():
        return []
    resultat = []
    for pdf in racine.rglob("*.pdf"):
        periode = periode_depuis_texte(pdf.stem)
        if not periode:
            continue
        mots_fichier = mots(pdf.stem)
        if not mots_fichier:
            # Ex. « Bulletins 11_2025.pdf » : le nom du client est celui du dossier.
            rel = pdf.relative_to(racine)
            mots_fichier = mots(" ".join(rel.parts[:-1]))
        resultat.append({"chemin": str(pdf), "periode": periode, "mots": mots_fichier})
    return resultat


RE_ANNEE = re.compile(r"^(19|20)\d\d$")


def sous_dossiers_clients(dossier: str) -> list:
    """Noms des dossiers de clients existants, à la racine ou sous un dossier d'année
    (organisations « client », « client puis année » et « année puis client »)."""
    racine = Path(dossier)
    if not racine.is_dir():
        return []
    noms = []
    for d in racine.iterdir():
        if not d.is_dir():
            continue
        if RE_ANNEE.match(d.name):
            noms += [s.name for s in d.iterdir() if s.is_dir() and not RE_ANNEE.match(s.name)]
        else:
            noms.append(d.name)
    return list(dict.fromkeys(noms))


# Organisation des dossiers : liste des niveaux sous le dossier des bulletins.
ORGANISATIONS = {
    "client": ["client"],
    "client_annee": ["client", "annee"],
    "annee": ["annee"],
    "annee_client": ["annee", "client"],
}


CIVILITES = re.compile(r"^(m\.|mme\.?|mr\.?|mlle\.?|monsieur|madame)\s+", re.I)


def nom_client(nom_pajemploi: str, dossier: str, correspondances: dict) -> str:
    """Nom de client à utiliser pour le classement.

    1. une correspondance saisie dans les paramètres ;
    2. sinon un sous-dossier existant qui partage un mot avec le nom Pajemploi
       (ex. « M. MARTIN Paul » -> dossier « Martin ») ;
    3. sinon le nom Pajemploi sans civilité.
    """
    cle = normaliser(nom_pajemploi)
    if cle in correspondances:
        return correspondances[cle]
    nom = CIVILITES.sub("", nom_pajemploi.strip()).strip()
    mots_nom = mots(nom)
    meilleurs = []
    for sd in sous_dossiers_clients(dossier):
        communs = mots_nom & mots(sd)
        if communs:
            meilleurs.append((len(communs), -len(sd), sd))
    if meilleurs:
        return max(meilleurs)[2]
    return nom


def appliquer_format(modele: str, client: str, periode: str, enfant: str = "") -> str:
    annee, mois = periode.split("-")
    remplacements = {
        "NOM CLIENT": client,
        "ENFANT": enfant,
        "YYYY": annee,
        "YY": annee[2:],
        "MM": mois,
        "MOIS": MOIS_AFFICHAGE[int(mois) - 1],
    }
    texte = re.sub(r"NOM CLIENT|ENFANT|YYYY|YY|MOIS|MM", lambda m: remplacements[m.group(0)], modele)
    texte = re.sub(r"\s*-\s*-\s*", " - ", texte)          # « ENFANT » vide
    return re.sub(r'[<>:"/\\|?*]', "-", texte).strip(" -").rstrip(".")


def chemin_cible(params: dict, client: str, periode: str, rang: int = 1, enfant: str = "",
                 plusieurs: bool = False) -> Path:
    """Chemin du fichier à créer. Si le client a plusieurs bulletins ce mois-là (plusieurs
    enfants) et que le format ne contient pas ENFANT, on ajoute le prénom de l'enfant."""
    dossier = Path(params["dossier_bulletins"])
    for niveau in ORGANISATIONS.get(params.get("organisation"), ORGANISATIONS["client"]):
        dossier /= re.sub(r'[<>:"/\\|?*]', "-", client).strip(" .") if niveau == "client" else periode[:4]
    nom =appliquer_format(params["format_fichier"], client, periode, enfant)
    if plusieurs and "ENFANT" not in params["format_fichier"]:
        nom += f" - {enfant}" if enfant else f" ({rang})"
    elif rang > 1 and not enfant:
        nom += f" ({rang})"
    nom = re.sub(r'[<>:"/\\|?*]', "-", nom)
    return dossier / (nom + ".pdf")


def comparer(bulletins: list, params: dict, correspondances: dict) -> list:
    """Ajoute à chaque bulletin Pajemploi son client, son chemin cible et s'il est déjà présent.

    Un client peut avoir plusieurs bulletins le même mois (un par enfant) : les fichiers
    existants qui citent le prénom de l'enfant lui sont attribués en priorité, les autres
    sont répartis dans l'ordre.
    """
    dossier = params["dossier_bulletins"]
    fichiers = inventaire(dossier)
    groupes = {}
    for b in bulletins:
        b["client"] = nom_client(b["employeur"], dossier, correspondances)
        b.setdefault("enfant", "")
        groupes.setdefault((b["client"], b["periode"]), []).append(b)

    for (client, periode), groupe in groupes.items():
        plusieurs = len(groupe) > 1
        mots_client = mots(client)
        for b in groupe:
            mots_client |= mots(CIVILITES.sub("", b["employeur"]))
        candidats = [f for f in fichiers if f["periode"] == periode and f["mots"] & mots_client]
        attribues = {}
        for rang, b in enumerate(groupe, 1):
            b["rang"] = rang
            cible = chemin_cible(params, client, periode, rang, b["enfant"], plusieurs)
            b["cible"] = str(cible)
            if cible.exists():
                attribues[rang] = str(cible)
                candidats = [f for f in candidats if f["chemin"] != str(cible)]
        # Fichiers qui citent le prénom de l'enfant
        for b in groupe:
            if b["rang"] in attribues or not b["enfant"]:
                continue
            for f in candidats:
                if mots(b["enfant"]) & f["mots"]:
                    attribues[b["rang"]] = f["chemin"]
                    candidats.remove(f)
                    break
        # Puis les fichiers restants, dans l'ordre (noms sans prénom d'enfant)
        for b in groupe:
            if b["rang"] not in attribues and candidats:
                attribues[b["rang"]] = candidats.pop(0)["chemin"]
        for b in groupe:
            b["present"] = b["rang"] in attribues
            if b["present"]:
                b["fichier_existant"] = attribues[b["rang"]]
    return bulletins


def resume_dossier(dossier: str) -> dict:
    """Vue hors connexion : pour chaque famille (dossier), les mois trouvés.
    Les dossiers d'année sont traversés : « 2026/Dupont/… » compte pour « Dupont »."""
    resultat = {}
    racine = Path(dossier)
    familles = sous_dossiers_clients(dossier)
    for f in inventaire(dossier):
        dossiers = [p for p in Path(f["chemin"]).relative_to(racine).parts[:-1] if not RE_ANNEE.match(p)]
        if dossiers:
            groupe = dossiers[0]
        else:
            # Fichier rangé seulement par année : famille retrouvée d'après le nom du fichier.
            groupe = next((fam for fam in familles if mots(fam) & f["mots"]), None) \
                or " ".join(sorted(f["mots"])).title() or "(sans nom de famille)"
        resultat.setdefault(groupe, set()).add(f["periode"])
    return {k: sorted(v) for k, v in sorted(resultat.items())}
