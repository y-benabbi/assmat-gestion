"""Activités (rubrique « Activités ») : des modèles réutilisables, et leurs réalisations datées.

Une activité : identifiant (« A0007 », jamais modifié), titre, icône (clé de ICONES_ACTIVITES dans app.js), description,
liste « à préparer » (matériel à préparer, acheter, rassembler) et documents utiles, rangés dans « Activités\\<Titre> »
du dossier principal.
Chaque fois qu'elle est faite, une réalisation (« S0012 », appelée séance dans les données) porte sa date et ce qui
est déjà prêt pour elle. Les photos rangées avec une réalisation y sont rattachées (photos.py).

Fichier donnees\\activites.json : {"compteur_activites", "compteur_seances", "activites": [...]}.
"""
import json
import re
import threading
from datetime import date
from pathlib import Path

import parametres
from chemins import DOSSIER_DONNEES

FICHIER = DOSSIER_DONNEES / "activites.json"

_verrou = threading.RLock()


def _lire() -> dict:
    try:
        d = json.loads(FICHIER.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        d = {}
    d.setdefault("compteur_activites", 0)
    d.setdefault("compteur_seances", 0)
    d["activites"] = [a for a in d.get("activites") or [] if isinstance(a, dict)]
    return d


def _ecrire(d: dict):
    FICHIER.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


def nom_dossier(texte: str) -> str:
    """Nom utilisable comme dossier Windows."""
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", str(texte or "")).strip(" .")[:80] or "Sans titre"


def activites() -> list:
    with _verrou:
        liste = _lire()["activites"]
    for a in liste:
        a["seances"] = sorted(a.get("seances") or [], key=lambda s: s.get("date", ""), reverse=True)
    return sorted(liste, key=lambda a: a.get("titre", "").lower())


def activite(ident: str) -> dict | None:
    return next((a for a in activites() if a.get("id") == ident), None)


def dossier(a: dict) -> Path | None:
    racine = parametres.dossier("activites")
    return racine / (a.get("dossier") or nom_dossier(a.get("titre"))) if racine else None


def _liste_texte(valeur) -> list:
    lignes = valeur if isinstance(valeur, list) else str(valeur or "").splitlines()
    return [str(x).strip()[:200] for x in lignes if str(x).strip()]


def enregistrer(nouvelle: dict) -> dict:
    """Crée ou modifie une activité (sans toucher à ses séances). Renomme son dossier si le titre change."""
    titre = str(nouvelle.get("titre") or "").strip()[:120]
    if not titre:
        raise ValueError("Donnez un titre à l'activité.")
    with _verrou:
        d = _lire()
        a = next((x for x in d["activites"] if x.get("id") == nouvelle.get("id")), None)
        if a is None:
            d["compteur_activites"] += 1
            a = {"id": f"A{d['compteur_activites']:04d}", "seances": []}
            d["activites"].append(a)
        ancien = dossier(a) if a.get("dossier") else None
        a.update(titre=titre, description=str(nouvelle.get("description") or "").strip()[:4000],
                 a_preparer=_liste_texte(nouvelle.get("a_preparer")),
                 icone=re.sub(r"[^a-z0-9-]", "", str(nouvelle.get("icone") or ""))[:40])
        a["dossier"] = nom_dossier(titre)
        nouveau = dossier(a)
        if ancien and nouveau and ancien != nouveau and ancien.is_dir() and not nouveau.exists():
            try:
                ancien.rename(nouveau)
            except OSError:
                a["dossier"] = ancien.name        # dossier ouvert ailleurs : on garde l'ancien nom
        _ecrire(d)
        return a


def supprimer(ident: str) -> None:
    """Retire l'activité de la liste ; son dossier de documents et les photos rangées restent."""
    with _verrou:
        d = _lire()
        d["activites"] = [a for a in d["activites"] if a.get("id") != ident]
        _ecrire(d)


def _date_valide(texte: str) -> str:
    try:
        return date.fromisoformat(str(texte or "").strip()).isoformat()
    except ValueError:
        raise ValueError("Date de la réalisation invalide.")


def ajouter_seance(activite_id: str, jour: str, nouvelle: bool = False) -> dict:
    """Réalisation d'une activité à une date. Sans `nouvelle`, celle qui existe déjà ce jour-là est reprise (photos
    rangées avec une activité) ; avec, une autre réalisation est créée (une même activité deux fois dans la journée)."""
    jour = _date_valide(jour)
    with _verrou:
        d = _lire()
        a = next((x for x in d["activites"] if x.get("id") == activite_id), None)
        if a is None:
            raise ValueError("Activité introuvable.")
        existante = next((s for s in a.setdefault("seances", []) if s.get("date") == jour), None)
        if existante and not nouvelle:
            return existante
        d["compteur_seances"] += 1
        s = {"id": f"S{d['compteur_seances']:04d}", "date": jour, "prepare": []}
        a["seances"].append(s)
        _ecrire(d)
        return s


def modifier_seance(seance_id: str, valeurs: dict) -> dict:
    with _verrou:
        d = _lire()
        for a in d["activites"]:
            for s in a.get("seances") or []:
                if s.get("id") == seance_id:
                    if "date" in valeurs:
                        s["date"] = _date_valide(valeurs["date"])
                    if "prepare" in valeurs:
                        s["prepare"] = [x for x in _liste_texte(valeurs["prepare"]) if x in a.get("a_preparer", [])]
                    _ecrire(d)
                    return s
    raise ValueError("Réalisation introuvable.")


def supprimer_seance(seance_id: str) -> None:
    with _verrou:
        d = _lire()
        for a in d["activites"]:
            a["seances"] = [s for s in a.get("seances") or [] if s.get("id") != seance_id]
        _ecrire(d)


def seance(seance_id: str) -> tuple:
    """(activité, séance) ou (None, None)."""
    for a in activites():
        for s in a["seances"]:
            if s.get("id") == seance_id:
                return a, s
    return None, None


def documents(a: dict) -> list:
    d = dossier(a)
    if not d or not d.is_dir():
        return []
    return [{"nom": f.name, "chemin": str(f), "taille": f.stat().st_size}
            for f in sorted(d.iterdir(), key=lambda f: f.name.lower()) if f.is_file() and not f.name.startswith(".")]


def ajouter_document(activite_id: str, nom: str, contenu: bytes) -> dict:
    a = activite(activite_id)
    if not a:
        raise ValueError("Activité introuvable.")
    d = dossier(a)
    if not d:
        raise ValueError("Choisissez d'abord le dossier principal dans les Paramètres.")
    d.mkdir(parents=True, exist_ok=True)
    nom = nom_dossier(Path(nom).name) or "Document"
    cible = d / nom
    n = 2
    while cible.exists():
        cible = d / f"{Path(nom).stem} ({n}){Path(nom).suffix}"
        n += 1
    cible.write_bytes(contenu)
    return {"nom": cible.name, "chemin": str(cible)}


def echeances(jour: date, horizon_jours: int) -> list:
    """Réalisations à venir : (date, titre, détail)."""
    fin = date.fromordinal(jour.toordinal() + horizon_jours).isoformat()
    liste = []
    for a in activites():
        for s in a["seances"]:
            if jour.isoformat() <= s.get("date", "") <= fin:
                a_preparer = a.get("a_preparer") or []
                prets = len([x for x in s.get("prepare") or [] if x in a_preparer])
                detail = (f"À préparer : {prets} sur {len(a_preparer)} prêt{'s' if prets > 1 else ''}."
                          if a_preparer else "")
                liste.append((date.fromisoformat(s["date"]), f"Réalisation : {a['titre']}", detail))
    return liste
