"""Vacances scolaires : dates officielles de l'Éducation nationale (calendrier scolaire publié en données ouvertes sur
data.education.gouv.fr, jeu « fr-en-calendrier-scolaire »), pour l'académie choisie dans Paramètres.

Les dates sont gardées dans donnees\\vacances.json : l'application continue de les montrer sans Internet, et ne les
redemande qu'une fois par semaine (ou quand l'académie change).

Dans le jeu de données, une période va du dernier jour de classe au soir (start_date, minuit en heure de Paris) au
jour de la reprise (end_date, minuit) : les jours de vacances sont donc debut <= jour < fin."""
import json
import threading
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

import parametres
from chemins import DOSSIER_DONNEES

FICHIER = DOSSIER_DONNEES / "vacances.json"
ADRESSE = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/exports/json"
VALIDITE = timedelta(days=7)

# Académies telles qu'écrites dans le calendrier officiel (champ « location »), avec leur zone.
ACADEMIES = {
    "Aix-Marseille": "Zone B", "Amiens": "Zone B", "Besançon": "Zone A", "Bordeaux": "Zone A",
    "Clermont-Ferrand": "Zone A", "Corse": "Corse", "Créteil": "Zone C", "Dijon": "Zone A", "Grenoble": "Zone A",
    "Lille": "Zone B", "Limoges": "Zone A", "Lyon": "Zone A", "Montpellier": "Zone C", "Nancy-Metz": "Zone B",
    "Nantes": "Zone B", "Nice": "Zone B", "Normandie": "Zone B", "Orléans-Tours": "Zone B", "Paris": "Zone C",
    "Poitiers": "Zone A", "Reims": "Zone B", "Rennes": "Zone B", "Strasbourg": "Zone B", "Toulouse": "Zone C",
    "Versailles": "Zone C", "Guadeloupe": "Guadeloupe", "Guyane": "Guyane", "Martinique": "Martinique",
    "Mayotte": "Mayotte", "La Réunion": "La Réunion",
}

_verrou = threading.Lock()


def _jour(texte: str) -> str:
    """« 2026-10-16T22:00:00+00:00 » (minuit à Paris) → « 2026-10-17 ». Paris = UTC + 1 ou 2 h : 3 h d'avance
    suffisent à tomber sur le bon jour sans dépendre d'un fichier de fuseaux horaires (absent de Windows)."""
    t = datetime.fromisoformat(str(texte).replace("Z", "+00:00"))
    if t.tzinfo:
        t = t.astimezone(timezone.utc) + timedelta(hours=3)
    return t.date().isoformat()


def periodes_depuis(lignes: list) -> list:
    """Lignes du calendrier officiel → [{nom, debut, fin}] (fin = jour de la reprise), sans doublon, par date.
    Les lignes réservées aux enseignants (pré-rentrée…) sont ignorées."""
    vues, liste = set(), []
    for l in lignes:
        if str(l.get("population") or "").strip().lower().startswith("enseignant"):
            continue
        try:
            debut, fin = _jour(l["start_date"]), _jour(l["end_date"]) if l.get("end_date") else ""
        except (KeyError, TypeError, ValueError):
            continue
        if not fin:                                   # été sans date de rentrée connue : 2 mois au plus
            fin = (date.fromisoformat(debut) + timedelta(days=62)).isoformat()
        nom = str(l.get("description") or "Vacances").strip()
        if (nom, debut, fin) in vues or (fin and fin <= debut):
            continue
        vues.add((nom, debut, fin))
        liste.append({"nom": nom, "debut": debut, "fin": fin})
    return sorted(liste, key=lambda p: p["debut"])


def _telecharger(academie: str) -> list:
    requete = {"where": f'location="{academie}"', "select": "description,population,start_date,end_date,annee_scolaire"}
    with urllib.request.urlopen(urllib.request.Request(f"{ADRESSE}?{urllib.parse.urlencode(requete)}",
                                                       headers={"User-Agent": "assmat-gestion"}), timeout=15) as r:
        return periodes_depuis(json.loads(r.read().decode("utf-8")))


def _lire() -> dict:
    try:
        return json.loads(FICHIER.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def etat(forcer: bool = False) -> dict:
    """{academie, zone, periodes, maj, erreur} pour l'académie des paramètres. Les dates gardées servent tant
    qu'elles ont moins d'une semaine ; sinon on les redemande, et en cas d'échec on garde les anciennes."""
    academie = parametres.brut().get("academie") or ""
    if not academie:
        return {"academie": "", "zone": "", "periodes": [], "maj": "", "erreur": ""}
    with _verrou:
        cache = _lire()
        a_jour = cache.get("academie") == academie and cache.get("maj", "") >= (datetime.now() - VALIDITE).isoformat()
        erreur = ""
        if forcer or not a_jour:
            try:
                periodes = _telecharger(academie)
                if not periodes:
                    raise ValueError("aucune date trouvée pour cette académie")
                cache = {"academie": academie, "maj": datetime.now().isoformat(timespec="seconds"), "periodes": periodes}
                FICHIER.parent.mkdir(parents=True, exist_ok=True)
                FICHIER.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception as e:
                erreur = f"Calendrier scolaire injoignable ({e})."
                if cache.get("academie") != academie:
                    cache = {}
    return {"academie": academie, "zone": ACADEMIES.get(academie, ""), "periodes": cache.get("periodes", []),
            "maj": cache.get("maj", ""), "erreur": erreur}


def en_vacances(jour: date, periodes: list = None):
    """True / False si le calendrier est connu pour ce jour, None sinon (académie non choisie, dates absentes)."""
    if periodes is None:
        if not FICHIER.exists() or not parametres.brut().get("academie"):
            return None
        periodes = _lire().get("periodes", [])
    if not periodes:
        return None
    iso = jour.isoformat()
    # Calendrier connu : de la rentrée qui précède les premières vacances (4 mois avant) à la dernière reprise.
    premier = (date.fromisoformat(min(p["debut"] for p in periodes)) - timedelta(days=120)).isoformat()
    if not premier <= iso <= max(p["fin"] for p in periodes):
        return None
    return any(p["debut"] <= iso < p["fin"] for p in periodes)
