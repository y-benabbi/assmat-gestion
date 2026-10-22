"""Dossier principal : un seul dossier choisi par l'utilisatrice, dans lequel l'application crée et range tout
(parametres.SOUS_DOSSIERS : bulletins, courriers, photos, activités, À trier, sauvegarde).

Passage au dossier principal (installations antérieures à la 1.11.0, ou changement de dossier) : les fichiers
des anciens dossiers des bulletins et des courriers y sont déplacés un par un, dans un fil à part ; la page suit
la progression (`etat()`). Un fichier n'est supprimé de l'ancien emplacement qu'une fois sa copie vérifiée
(même taille). Un fichier impossible à déplacer (ouvert dans un autre programme) est signalé, et le passage peut
être relancé : il reprend ce qui reste.

Sauvegarde : une copie des fiches (donnees\\*.json) dans « Sauvegarde\\AAAA-MM-JJ », au plus une par jour, les
30 dernières gardées. Ces fichiers contiennent des données personnelles : ils restent dans le dossier principal.
"""
import filecmp
import os
import shutil
import threading
from datetime import date, datetime
from pathlib import Path

import donnees
import parametres
from chemins import DOSSIER_DONNEES, JOURNAUX

SAUVEGARDES_GARDEES = 30

_verrou = threading.Lock()
_etat = {"en_cours": False, "fait": 0, "total": 0, "fichier": "", "erreurs": [], "termine": False, "message": ""}


def etat() -> dict:
    with _verrou:
        return dict(_etat, erreurs=list(_etat["erreurs"]))


def _noter(**valeurs):
    with _verrou:
        _etat.update(valeurs)


def _journal(texte):
    with open(JOURNAUX / f"{datetime.now():%Y-%m}.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {texte}\n")


def anciens_dossiers(params: dict = None) -> list:
    """[(ancien dossier, clé du sous-dossier)] : dossiers à reprendre dans le dossier principal."""
    p = params or parametres.brut()
    liste = []
    if p.get("dossier_principal"):
        # Changement de dossier principal : on reprend les sous-dossiers de l'ancien.
        for cle, nom in parametres.SOUS_DOSSIERS.items():
            liste.append((Path(p["dossier_principal"]) / nom, cle))
        return liste
    if p.get("dossier_bulletins"):
        liste.append((Path(p["dossier_bulletins"]), "bulletins"))
    if p.get("dossier_courriers"):
        liste.append((Path(p["dossier_courriers"]), "courriers"))
    elif p.get("dossier_bulletins"):
        liste.append((Path(p["dossier_bulletins"]).parent / "Courriers", "courriers"))
    return liste


def proposition() -> str:
    """Dossier proposé par défaut : celui qui contient l'ancien dossier des bulletins, sinon Documents."""
    p = parametres.brut()
    if p.get("dossier_principal"):
        return p["dossier_principal"]
    if p.get("dossier_bulletins"):
        return str(Path(p["dossier_bulletins"]).parent)
    return str(Path.home() / "Documents" / "Assistante maternelle")


def _dedans(chemin: Path, dossier: Path) -> bool:
    try:
        chemin.resolve().relative_to(dossier.resolve())
        return True
    except (ValueError, OSError):
        return False


def _libre(cible: Path) -> Path:
    """« Nom (2).pdf » si « Nom.pdf » existe déjà avec un autre contenu."""
    n = 2
    autre = cible
    while autre.exists():
        autre = cible.with_name(f"{cible.stem} ({n}){cible.suffix}")
        n += 1
    return autre


def deplacer_fichier(source: Path, cible: Path) -> Path:
    """Déplace un fichier ; d'un disque à l'autre, l'original n'est supprimé qu'après vérification de la copie.
    Renvoie l'emplacement final."""
    cible.parent.mkdir(parents=True, exist_ok=True)
    if cible.exists():
        if filecmp.cmp(source, cible, shallow=False):
            source.unlink()                     # déjà copié lors d'un passage interrompu
            return cible
        cible = _libre(cible)
    try:
        os.replace(source, cible)               # même disque : instantané
    except OSError:
        shutil.copy2(source, cible)
        if cible.stat().st_size != source.stat().st_size:
            cible.unlink(missing_ok=True)
            raise OSError("copie incomplète")
        source.unlink()
    return cible


def _vider(dossier: Path, garder: Path):
    """Supprime les dossiers devenus vides sous `dossier` (et lui-même), sauf `garder` et ce qu'il contient."""
    if not dossier.is_dir():
        return
    for racine, sous, fichiers in os.walk(dossier, topdown=False):
        r = Path(racine)
        if _dedans(r, garder):
            continue
        try:
            if not any(r.iterdir()):
                r.rmdir()
        except OSError:
            pass


def _migrer(nouveau: Path):
    p = parametres.brut()
    plan = []          # (source, cible)
    for ancien, cle in anciens_dossiers(p):
        destination = nouveau / parametres.SOUS_DOSSIERS[cle]
        if not ancien.is_dir() or ancien.resolve() == destination.resolve():
            continue
        for racine, _, fichiers in os.walk(ancien):
            for nom in fichiers:
                source = Path(racine) / nom
                if _dedans(source, destination):
                    continue                    # le nouveau dossier est à l'intérieur de l'ancien
                plan.append((source, destination / source.relative_to(ancien), ancien, destination))
    _noter(total=len(plan), fait=0, message="Déplacement des fichiers…")
    deplaces = {}
    erreurs = []
    for i, (source, cible, _, _) in enumerate(plan):
        _noter(fichier=source.name, fait=i)
        try:
            deplaces[str(source)] = str(deplacer_fichier(source, cible))
        except OSError as e:
            erreurs.append(f"{source} : {'fichier ouvert dans un autre programme' if isinstance(e, PermissionError) else e}")
    for ancien, destination in {(a, d) for _, _, a, d in plan}:
        _vider(ancien, destination)
    donnees.renommer_documents(deplaces)
    for nom in parametres.SOUS_DOSSIERS.values():
        (nouveau / nom).mkdir(parents=True, exist_ok=True)
    parametres.enregistrer({"dossier_principal": str(nouveau)})
    sauvegarder(force=True)
    _journal(f"Dossier principal : {nouveau} ({len(deplaces)} fichier(s) déplacé(s), {len(erreurs)} erreur(s))")
    _noter(fait=len(plan), fichier="", erreurs=erreurs, termine=True, en_cours=False,
           message=(f"{len(deplaces)} fichier{'s' if len(deplaces) > 1 else ''} rangé{'s' if len(deplaces) > 1 else ''} "
                    "dans le dossier principal." if deplaces else "Dossier principal prêt.")
           + (f" {len(erreurs)} fichier(s) n'ont pas pu être déplacés." if erreurs else ""))


def lancer(chemin: str) -> None:
    """Choisit le dossier principal et y déplace les anciens dossiers (dans un fil à part)."""
    if not chemin or not chemin.strip():
        raise ValueError("Choisissez un dossier.")
    nouveau = Path(os.path.normpath(chemin.strip()))
    if not nouveau.is_absolute():
        raise ValueError("Choisissez un dossier complet (par exemple C:\\Users\\…\\Documents\\Assistante maternelle).")
    with _verrou:
        if _etat["en_cours"]:
            raise ValueError("Le déplacement est déjà en cours.")
        _etat.update(en_cours=True, fait=0, total=0, fichier="", erreurs=[], termine=False, message="Préparation…")
    try:
        nouveau.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        _noter(en_cours=False)
        raise ValueError(f"Impossible de créer ce dossier : {e}")

    def fil():
        try:
            _migrer(nouveau)
        except Exception as e:      # jamais de fil bloqué « en cours »
            _journal(f"Dossier principal : échec ({e})")
            _noter(en_cours=False, termine=True, erreurs=[str(e)], message="Le déplacement s'est interrompu.")
    threading.Thread(target=fil, daemon=True).start()


def sauvegarder(force: bool = False) -> Path | None:
    """Copie des fiches dans « Sauvegarde\\AAAA-MM-JJ » (une fois par jour)."""
    dossier = parametres.dossier("sauvegarde")
    if not dossier:
        return None
    cible = dossier / date.today().isoformat()
    if cible.exists() and not force:
        return cible
    try:
        cible.mkdir(parents=True, exist_ok=True)
        for f in DOSSIER_DONNEES.glob("*.json"):
            shutil.copy2(f, cible / f.name)
        anciennes = sorted(d for d in dossier.iterdir() if d.is_dir() and len(d.name) == 10 and d.name[4] == "-")
        for d in anciennes[:-SAUVEGARDES_GARDEES]:
            shutil.rmtree(d, ignore_errors=True)
    except OSError as e:
        _journal(f"Sauvegarde impossible : {e}")
        return None
    return cible
