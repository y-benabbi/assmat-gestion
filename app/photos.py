"""Photos et vidéos des enfants : tri, rangement, numéro unique, impression.

Sources : les dossiers choisis dans les Paramètres (ex. iCloud Photos) et « À trier » du dossier principal. Une
photo rangée en est DÉPLACÉE (elle disparaît aussi du téléphone : c'est voulu).

Rangement : « Photos et vidéos\\Famille\\Enfant\\AAAA\\Prénom - Activité - Photo 0042.jpg », une copie par enfant
présent sur la photo. Le numéro (« Photo 0042 », « Vidéo 0043 ») est l'identifiant unique : un seul compteur,
jamais réutilisé, le même pour toutes les copies d'une photo, qui n'est donc affichée qu'une fois. Les photos
iPhone (HEIC) sont converties en JPEG ; l'original va dans « Format source », même arborescence, même nom.
Le numéro, la séance et l'activité sont aussi écrits dans les métadonnées XMP des JPEG.

Pré-classement : la date de prise de vue (EXIF, ou en-tête des vidéos) est comparée aux horaires d'accueil des
contrats en vigueur ce jour-là (avec une marge réglable) : en dehors, la photo est mise de côté (« Hors
horaires »). Les enfants proposés sont ceux accueillis à ce moment-là.

donnees\\photos.json : {"compteur", "photos": {numéro: {"date", "seance", "empreinte"}}, "ignorees": [chemins],
"remises": [chemins remis à trier malgré les horaires]}. donnees\\photos-analyse.json : cache (date de prise de
vue, empreinte) par fichier. Les miniatures sont dans %LOCALAPPDATA%\\assmat-gestion\\miniatures.
"""
import hashlib
import json
import os
import re
import shutil
import struct
import tempfile
import threading
from datetime import date, datetime, timedelta
from pathlib import Path

import ateliers
import donnees
import parametres
from chemins import DOSSIER_DONNEES, MINIATURES
from impots import RE_PLAGE

FICHIER_INDEX = DOSSIER_DONNEES / "photos.json"
FICHIER_ANALYSE = DOSSIER_DONNEES / "photos-analyse.json"

IMAGES = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".gif"}
VIDEOS = {".mov", ".mp4", ".m4v", ".3gp", ".avi"}
HEIC = {".heic", ".heif"}
JPEG = {".jpg", ".jpeg"}
FORMAT_SOURCE = "Format source"
SANS_DATE = "Sans date"
RE_NUMERO = re.compile(r"\b(?:Photo|Vidéo|Video) (\d{4,})\b", re.I)
# Fichiers en ligne seulement (iCloud, OneDrive) : les ouvrir les téléchargerait. Attributs Windows.
EN_LIGNE = 0x400000 | 0x40000 | 0x1000
NS_XMP = "https://github.com/y-benabbi/assmat-gestion/ns/1.0/"
ENTETE_XMP = b"http://ns.adobe.com/xap/1.0/\x00"

_verrou = threading.RLock()
_connus = {}            # clé -> chemin des fichiers à trier de la dernière liste
_heif = None


class ModuleAbsent(Exception):
    pass


# ------------------------------------------------------------------ fichiers JSON
def _lire_json(fichier, defaut):
    try:
        return json.loads(fichier.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return defaut


def _ecrire_json(fichier, donnees_):
    fichier.write_text(json.dumps(donnees_, ensure_ascii=False, indent=1), encoding="utf-8")


def _index() -> dict:
    d = _lire_json(FICHIER_INDEX, {})
    d.setdefault("compteur", 0)
    d.setdefault("photos", {})
    d.setdefault("ignorees", [])
    d.setdefault("remises", [])
    return d


def _numero(n: int) -> str:
    return f"{n:04d}"


# ------------------------------------------------------------------ lecture des fichiers
def _activer_heif() -> bool:
    global _heif
    if _heif is None:
        try:
            import pillow_heif
            pillow_heif.register_heif_opener()
            _heif = True
        except ImportError:
            _heif = False
    return _heif


def genre(chemin) -> str:
    ext = Path(chemin).suffix.lower()
    return "photo" if ext in IMAGES else "video" if ext in VIDEOS else ""


def _en_ligne(st) -> bool:
    return bool(getattr(st, "st_file_attributes", 0) & EN_LIGNE)


def _lire_date_exif(texte) -> str:
    try:
        return datetime.strptime(str(texte).strip()[:19], "%Y:%m:%d %H:%M:%S").isoformat()
    except ValueError:
        return ""


def date_image(chemin: Path) -> str:
    """Date de prise de vue (EXIF) au format ISO, ou ""."""
    try:
        from PIL import Image
    except ImportError:
        raise ModuleAbsent("Pillow")
    if chemin.suffix.lower() in HEIC:
        _activer_heif()
    try:
        with Image.open(chemin) as im:
            exif = im.getexif()
            valeur = exif.get_ifd(0x8769).get(0x9003) or exif.get_ifd(0x8769).get(0x9004) or exif.get(0x0132)
    except Exception:
        return ""
    return _lire_date_exif(valeur) if valeur else ""


def date_video(chemin: Path) -> str:
    """Date de création écrite dans l'en-tête d'une vidéo MP4 / MOV (boîte « mvhd »), en heure locale."""
    try:
        with open(chemin, "rb") as f:
            fin = os.fstat(f.fileno()).st_size
            debut = 0
            while debut + 8 <= fin:
                f.seek(debut)
                taille, nom = struct.unpack(">I4s", f.read(8))
                entete = 8
                if taille == 1:
                    taille = struct.unpack(">Q", f.read(8))[0]
                    entete = 16
                elif taille == 0:
                    taille = fin - debut
                if nom == b"moov":
                    contenu = f.read(min(taille - entete, 4 << 20))
                    i = contenu.find(b"mvhd")
                    if i < 4:
                        return ""
                    version = contenu[i + 4]
                    secondes = (struct.unpack(">Q", contenu[i + 8:i + 16])[0] if version == 1
                                else struct.unpack(">I", contenu[i + 8:i + 12])[0])
                    if secondes < 2082844800 + 86400:
                        return ""
                    return datetime.fromtimestamp(secondes - 2082844800).replace(microsecond=0).isoformat()
                if taille < entete:
                    return ""
                debut += taille
    except (OSError, struct.error, ValueError, OverflowError):
        pass
    return ""


def empreinte(chemin: Path) -> str:
    h = hashlib.sha1()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def _analyser(chemin: Path, cache: dict, avec_empreinte: bool = False) -> dict:
    """Date de prise de vue (et empreinte) d'un fichier, gardées en cache tant qu'il ne change pas."""
    st = chemin.stat()
    cle = str(chemin)
    info = cache.get(cle)
    if not info or info.get("taille") != st.st_size or info.get("modif") != int(st.st_mtime):
        en_ligne = _en_ligne(st)
        info = {"taille": st.st_size, "modif": int(st.st_mtime), "en_ligne": en_ligne,
                "date": "" if en_ligne else (date_image(chemin) if genre(chemin) == "photo" else date_video(chemin))}
        cache[cle] = info
    if avec_empreinte and not info.get("empreinte") and not info.get("en_ligne"):
        info["empreinte"] = empreinte(chemin)
    return info


# ------------------------------------------------------------------ enfants et horaires
def _nom(texte) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", str(texte or "")).strip(" .") or "Sans nom"


def enfants() -> list:
    """Fiches enfants, la plus récente d'abord : [{id, prenom, famille, debut, fin}]."""
    return [{"id": c.get("id"), "prenom": (c.get("enfant_prenom") or "").strip() or "Enfant",
             "famille": (c.get("famille") or "").strip() or "Famille", "debut": c.get("debut", ""), "fin": c.get("fin", "")}
            for c in donnees.contrats() if c.get("id")]


def _plages(texte: str) -> list:
    return [(int(h1) * 60 + int(m1 or 0), int(h2) * 60 + int(m2 or 0)) for h1, m1, h2, m2 in RE_PLAGE.findall(texte or "")]


def presents(moment: datetime, contrats: list, marge: int) -> list:
    """Identifiants des enfants accueillis à ce moment (horaires scolaires ou de vacances, ± marge en minutes)."""
    jour = moment.date()
    nom_jour = donnees.JOURS[jour.weekday()]
    minute = moment.hour * 60 + moment.minute
    liste = []
    for c in contrats:
        if not donnees.actif(c, jour):
            continue
        v = donnees.en_vigueur(c, jour)
        plages = _plages((v.get("horaires_scolaire") or {}).get(nom_jour, ""))
        plages += _plages((v.get("horaires_vacances") or {}).get(nom_jour, ""))
        if any(d - marge <= minute <= f + marge for d, f in plages):
            liste.append(c["id"])
    return liste


def actifs(jour: date, contrats: list) -> list:
    return [c["id"] for c in contrats if c.get("id") and donnees.actif(c, jour)]


# ------------------------------------------------------------------ inventaires
def dossiers_sources(p: dict) -> list:
    liste = [Path(d) for d in p.get("dossiers_photos") or []]
    a_trier = parametres.dossier("a_trier", p)
    if a_trier:
        a_trier.mkdir(parents=True, exist_ok=True)
        liste.append(a_trier)
    return liste


def _parcourir(dossier: Path):
    for racine, sous, fichiers in os.walk(dossier):
        sous[:] = [s for s in sous if not s.startswith(".")]
        for nom in fichiers:
            if not nom.startswith(".") and genre(nom):
                yield Path(racine) / nom


def _dedans(chemin: Path, dossier) -> bool:
    if not dossier:
        return False
    try:
        chemin.relative_to(dossier)
        return True
    except ValueError:
        return False


def rangees(p: dict = None) -> dict:
    """Photos rangées, par numéro : {numéro: {"copies": [...], "sources": [...], "genre"}}."""
    p = p or parametres.brut()
    racine = parametres.dossier("photos", p)
    resultat = {}
    if not racine or not racine.is_dir():
        return resultat
    for chemin in _parcourir(racine):
        m = RE_NUMERO.search(chemin.stem)
        if not m:
            continue
        r = resultat.setdefault(m.group(1), {"copies": [], "sources": [], "genre": genre(chemin)})
        partie = chemin.relative_to(racine).parts[0]
        r["sources" if partie == FORMAT_SOURCE else "copies"].append(chemin)
    return resultat


def _enfant_du_chemin(chemin: Path, racine: Path, liste: list) -> str:
    parties = chemin.relative_to(racine).parts
    if parties[0] == FORMAT_SOURCE:
        parties = parties[1:]
    if len(parties) < 3:
        return ""
    famille, prenom = parties[0].lower(), parties[1].lower()
    return next((e["id"] for e in liste if _nom(e["famille"]).lower() == famille and _nom(e["prenom"]).lower() == prenom), "")


def numeroter(p: dict = None) -> int:
    """Donne un numéro à toute photo du rangement qui n'en a pas (ajoutée à la main) et la renomme.
    Deux fichiers au contenu identique reçoivent le même numéro. Renvoie le nombre de fichiers renommés."""
    p = p or parametres.brut()
    racine = parametres.dossier("photos", p)
    if not racine or not racine.is_dir():
        return 0
    n = 0
    with _verrou:
        index = _index()
        par_empreinte = {v.get("empreinte"): k for k, v in index["photos"].items() if v.get("empreinte")}
        for chemin in list(_parcourir(racine)):
            if RE_NUMERO.search(chemin.stem):
                continue
            try:
                e = empreinte(chemin)
            except OSError:
                continue
            numero = par_empreinte.get(e)
            if not numero:
                index["compteur"] += 1
                numero = _numero(index["compteur"])
                index["photos"][numero] = {"date": "", "seance": "", "empreinte": e}
                par_empreinte[e] = numero
            parties = chemin.relative_to(racine).parts
            if parties[0] == FORMAT_SOURCE:
                parties = parties[1:]
            debut = parties[1] if len(parties) >= 3 else chemin.stem
            mot = "Vidéo" if genre(chemin) == "video" else "Photo"
            cible = chemin.with_name(f"{debut} - {mot} {numero}{chemin.suffix}")
            if cible.exists():
                cible = chemin.with_name(f"{chemin.stem} - {mot} {numero}{chemin.suffix}")
            try:
                chemin.rename(cible)
                n += 1
            except OSError:
                pass
        _ecrire_json(FICHIER_INDEX, index)
    return n


def lister() -> dict:
    """Tout ce qu'affiche la rubrique Photos."""
    p = parametres.brut()
    liste_enfants = enfants()
    contrats = donnees.contrats()
    marge = parametres.marge_minutes(p)
    module_absent = ""
    with _verrou:
        numeroter(p)
        index = _index()
        cache = _lire_json(FICHIER_ANALYSE, {})
        par_empreinte = {v.get("empreinte"): k for k, v in index["photos"].items() if v.get("empreinte")}
        racine_photos = parametres.dossier("photos", p)
        ignorees, remises = set(index["ignorees"]), set(index["remises"])
        a_trier, hors, ignor = [], [], []
        _connus.clear()
        vus = set()
        aujourd_hui = date.today()
        for dossier in dossiers_sources(p):
            if not dossier.is_dir():
                continue
            for chemin in _parcourir(dossier):
                if _dedans(chemin, racine_photos) or str(chemin) in vus:
                    continue
                vus.add(str(chemin))
                try:
                    info = _analyser(chemin, cache)
                except ModuleAbsent as e:
                    module_absent = str(e)
                    info = {"date": "", "en_ligne": False}
                except OSError:
                    continue
                cle = hashlib.sha1(str(chemin).encode()).hexdigest()[:16]
                _connus[cle] = chemin
                prise = info.get("date") or ""
                try:
                    fichier_date = datetime.fromtimestamp(chemin.stat().st_mtime).replace(microsecond=0).isoformat()
                except OSError:
                    fichier_date = ""
                element = {"cle": cle, "nom": chemin.name, "genre": genre(chemin), "date": prise,
                           "date_fichier": fichier_date, "en_ligne": bool(info.get("en_ligne")),
                           "dossier": str(chemin.parent), "proposes": [], "doublon": ""}
                if str(chemin) in ignorees:
                    ignor.append(element)
                    continue
                moment = datetime.fromisoformat(prise) if prise else None
                ici = presents(moment, contrats, marge) if moment else []
                if moment and not ici and str(chemin) not in remises:
                    hors.append(element)
                    continue
                element["proposes"] = ici or actifs(moment.date() if moment else aujourd_hui, contrats)
                try:
                    _analyser(chemin, cache, avec_empreinte=True)
                except (OSError, ModuleAbsent):
                    pass
                element["doublon"] = par_empreinte.get(cache.get(str(chemin), {}).get("empreinte"), "")
                a_trier.append(element)
        # Le cache ne garde que les fichiers encore présents.
        _ecrire_json(FICHIER_ANALYSE, {k: v for k, v in cache.items() if k in vus})
        ranges = []
        for numero, r in sorted(rangees(p).items()):
            meta = index["photos"].get(numero, {})
            ids = sorted({_enfant_du_chemin(c, racine_photos, liste_enfants) for c in r["copies"]} - {""})
            ranges.append({"numero": numero, "genre": r["genre"], "date": meta.get("date", ""),
                           "seance": meta.get("seance", ""), "enfants": ids, "copies": len(r["copies"]),
                           "dossiers": sorted({_nom_famille_enfant(c, racine_photos) for c in r["copies"]})})
    tri = lambda e: e["date"] or e["date_fichier"]  # noqa: E731
    return {
        "configure": bool(p.get("dossier_principal")),
        "sources": [str(d) for d in dossiers_sources(p)] if p.get("dossier_principal") else list(p.get("dossiers_photos") or []),
        "a_trier": sorted(a_trier, key=tri), "hors_horaires": sorted(hors, key=tri, reverse=True),
        "ignorees": sorted(ignor, key=tri, reverse=True), "rangees": sorted(ranges, key=lambda r: r["date"] or "", reverse=True),
        "enfants": liste_enfants, "marge": marge, "module_absent": module_absent,
    }


def _nom_famille_enfant(chemin: Path, racine: Path) -> str:
    parties = chemin.relative_to(racine).parts
    return " / ".join(parties[:2]) if len(parties) >= 3 else ""


def nombre_a_trier() -> int:
    try:
        return len(lister()["a_trier"])
    except OSError:
        return 0


# ------------------------------------------------------------------ métadonnées XMP (JPEG)
def _description_xmp(valeurs: dict) -> bytes:
    attributs = " ".join(f'assmat:{k}="{str(v).replace("&", "&amp;").replace(chr(34), "&quot;").replace("<", "&lt;")}"'
                         for k, v in valeurs.items() if v)
    return f'<rdf:Description rdf:about="" xmlns:assmat="{NS_XMP}" {attributs}/>'.encode("utf-8")


def ecrire_xmp(chemin: Path, valeurs: dict) -> bool:
    """Ajoute (ou remplace) nos informations dans les métadonnées XMP d'un JPEG, sans réencoder l'image."""
    data = chemin.read_bytes()
    if data[:2] != b"\xff\xd8":
        return False
    i, insertion, xmp = 2, 2, None
    while i + 4 <= len(data) and data[i] == 0xFF:
        marqueur = data[i + 1]
        if marqueur == 0xDA:
            break
        longueur = struct.unpack(">H", data[i + 2:i + 4])[0]
        contenu = data[i + 4:i + 2 + longueur]
        if marqueur == 0xE1 and contenu.startswith(ENTETE_XMP):
            xmp = (i, i + 2 + longueur, contenu[len(ENTETE_XMP):])
        elif marqueur in (0xE0, 0xE1) and xmp is None:
            insertion = i + 2 + longueur
        i += 2 + longueur
    description = _description_xmp(valeurs)
    if xmp:
        paquet = re.sub(rb'<rdf:Description[^>]*xmlns:assmat="[^"]*"[^>]*/>', b"", xmp[2])
        if b"</rdf:RDF>" not in paquet:
            return False
        paquet = paquet.replace(b"</rdf:RDF>", description + b"</rdf:RDF>", 1)
        debut, fin = xmp[0], xmp[1]
    else:
        paquet = (b'<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/">'
                  b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' + description
                  + b'</rdf:RDF></x:xmpmeta><?xpacket end="w"?>')
        debut = fin = insertion
    segment_contenu = ENTETE_XMP + paquet
    if len(segment_contenu) + 2 > 0xFFFF:
        return False
    segment = b"\xff\xe1" + struct.pack(">H", len(segment_contenu) + 2) + segment_contenu
    chemin.write_bytes(data[:debut] + segment + data[fin:])
    return True


def lire_xmp(chemin: Path) -> dict:
    try:
        with open(chemin, "rb") as f:
            debut = f.read(256 * 1024)
    except OSError:
        return {}
    m = re.search(rb'<rdf:Description[^>]*xmlns:assmat="[^"]*"([^>]*)/>', debut)
    return {k.decode(): v.decode("utf-8", "replace") for k, v in re.findall(rb'assmat:(\w+)="([^"]*)"', m.group(1))} if m else {}


# ------------------------------------------------------------------ rangement
def _seance_infos(seance_id: str) -> tuple:
    a, s = ateliers.seance(seance_id) if seance_id else (None, None)
    return (a or {}).get("titre", ""), (a or {}).get("id", "")


def _cibles(p: dict, numero: str, genre_: str, ext: str, date_iso: str, ids: list, titre: str) -> list:
    """[(copie, original HEIC ou None)] pour chaque enfant."""
    racine = parametres.dossier("photos", p)
    par_id = {e["id"]: e for e in enfants()}
    annee = date_iso[:4] if date_iso else SANS_DATE
    mot = "Vidéo" if genre_ == "video" else "Photo"
    liste = []
    for i in ids:
        e = par_id.get(i)
        if not e:
            raise ValueError("Fiche enfant introuvable.")
        nom = " - ".join(x for x in (_nom(e["prenom"]), _nom(titre) if titre else "", f"{mot} {numero}") if x)
        relatif = Path(_nom(e["famille"])) / _nom(e["prenom"]) / annee
        if ext in HEIC:
            liste.append((racine / relatif / f"{nom}.jpg", racine / FORMAT_SOURCE / relatif / f"{nom}{ext}"))
        else:
            liste.append((racine / relatif / f"{nom}{ext}", None))
    return liste


def _convertir_jpeg(source: Path, cible: Path):
    try:
        from PIL import Image, ImageOps
    except ImportError:
        raise ModuleAbsent("Pillow")
    if not _activer_heif():
        raise ModuleAbsent("pillow-heif")
    with Image.open(source) as im:
        exif = im.getexif()
        exif[0x0112] = 1                        # l'image est remise droite : plus de rotation à appliquer
        ImageOps.exif_transpose(im).convert("RGB").save(cible, "JPEG", quality=92, exif=exif.tobytes())


def _copier(source: Path, cible: Path):
    cible.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, cible)
    if cible.stat().st_size != source.stat().st_size:
        raise OSError(f"copie incomplète de {source.name}")


def _creer(numero: str, ref_copie: Path, ref_source, cibles: list, meta: dict):
    """Crée les copies manquantes à partir d'un fichier de référence (copie déjà rangée, ou fichier à trier)."""
    for copie, original in cibles:
        if original and ref_source and not original.exists():
            _copier(ref_source, original)
        if not copie.exists():
            if ref_copie.suffix.lower() in HEIC:
                copie.parent.mkdir(parents=True, exist_ok=True)
                _convertir_jpeg(ref_copie, copie)
            else:
                _copier(ref_copie, copie)
        if copie.suffix.lower() in JPEG:
            try:
                ecrire_xmp(copie, meta)
            except OSError:
                pass


def ranger(cles: list, ids: list, seance_id: str = "") -> dict:
    """Range des fichiers à trier pour ces enfants : copies créées, puis fichier d'origine supprimé."""
    p = parametres.brut()
    if not p.get("dossier_principal"):
        raise ValueError("Choisissez d'abord le dossier principal dans les Paramètres.")
    if not ids:
        raise ValueError("Choisissez au moins un enfant.")
    titre, activite_id = _seance_infos(seance_id)
    faits, erreurs = [], []
    with _verrou:
        index = _index()
        cache = _lire_json(FICHIER_ANALYSE, {})
        par_empreinte = {v.get("empreinte"): k for k, v in index["photos"].items() if v.get("empreinte")}
        existantes = rangees(p)
        for cle in cles:
            source = _connus.get(cle)
            if not source or not source.is_file():
                erreurs.append("Une photo n'a pas été trouvée (déplacée ou supprimée entre-temps).")
                continue
            try:
                info = _analyser(source, cache, avec_empreinte=True)
                e = info.get("empreinte") or empreinte(source)
                numero = par_empreinte.get(e)
                date_iso = info.get("date") or ""
                if numero and numero in existantes:
                    # Déjà rangée : on complète ses enfants, le fichier en double est retiré.
                    seance_n = seance_id or index["photos"].get(numero, {}).get("seance", "")
                    deja = {_enfant_du_chemin(c, parametres.dossier("photos", p), enfants()) for c in existantes[numero]["copies"]}
                    tous = sorted((deja - {""}) | set(ids))
                    modifier(numero, tous, seance_n)
                    index = _index()
                    source.unlink()
                    faits.append(numero)
                    continue
                if not numero:
                    index["compteur"] += 1
                    numero = _numero(index["compteur"])
                ext = source.suffix.lower()
                cibles = _cibles(p, numero, genre(source), ext, date_iso, ids, titre)
                meta = {"Photo": numero, "Seance": seance_id, "Activite": activite_id, "Titre": titre}
                _creer(numero, source, source if ext in HEIC else None, cibles, meta)
                index["photos"][numero] = {"date": date_iso, "seance": seance_id, "empreinte": e}
                par_empreinte[e] = numero
                _ecrire_json(FICHIER_INDEX, index)
                source.unlink()
                cache.pop(str(source), None)
                faits.append(numero)
            except ModuleAbsent as m:
                erreurs.append(f"{source.name} : module {m} manquant (il s'installe au prochain démarrage).")
            except OSError as err:
                erreurs.append(f"{source.name} : {'fichier ouvert dans un autre programme' if isinstance(err, PermissionError) else err}")
            except ValueError as err:
                erreurs.append(str(err))
        index["remises"] = [c for c in index["remises"] if Path(c).exists()]
        _ecrire_json(FICHIER_INDEX, index)
        _ecrire_json(FICHIER_ANALYSE, cache)
    return {"ranges": faits, "erreurs": erreurs}


def modifier(numero: str, ids: list, seance_id: str) -> dict:
    """Change les enfants ou l'activité d'une photo rangée : copies ajoutées, retirées ou renommées."""
    p = parametres.brut()
    if not ids:
        raise ValueError("Choisissez au moins un enfant (ou remettez la photo à trier).")
    with _verrou:
        r = rangees(p).get(numero)
        if not r or not r["copies"]:
            raise ValueError("Photo introuvable dans le rangement.")
        index = _index()
        meta = index["photos"].setdefault(numero, {"date": "", "seance": "", "empreinte": ""})
        titre, activite_id = _seance_infos(seance_id)
        source = r["sources"][0] if r["sources"] else None
        ext = source.suffix.lower() if source else r["copies"][0].suffix.lower()
        cibles = _cibles(p, numero, r["genre"], ext, meta.get("date", ""), ids, titre)
        ref = next((c for c in r["copies"] if c.exists()), None)
        _creer(numero, ref, source, cibles, {"Photo": numero, "Seance": seance_id, "Activite": activite_id, "Titre": titre})
        gardes = {str(c) for c, _ in cibles} | {str(o) for _, o in cibles if o}
        for ancien in r["copies"] + r["sources"]:
            if str(ancien) not in gardes:
                ancien.unlink(missing_ok=True)
        meta["seance"] = seance_id
        _ecrire_json(FICHIER_INDEX, index)
    _vider_dossiers(parametres.dossier("photos", p))
    return {"numero": numero}


def remettre_a_trier(numero: str) -> dict:
    """Sort une photo du rangement : l'original (ou une copie) retourne dans « À trier », le reste est supprimé."""
    p = parametres.brut()
    with _verrou:
        r = rangees(p).get(numero)
        if not r:
            raise ValueError("Photo introuvable dans le rangement.")
        ref = (r["sources"] or r["copies"])[0]
        a_trier = parametres.dossier("a_trier", p)
        a_trier.mkdir(parents=True, exist_ok=True)
        cible = a_trier / f"{'Vidéo' if r['genre'] == 'video' else 'Photo'} {numero}{ref.suffix}"
        n = 2
        while cible.exists():
            cible = a_trier / f"{'Vidéo' if r['genre'] == 'video' else 'Photo'} {numero} ({n}){ref.suffix}"
            n += 1
        shutil.move(str(ref), str(cible))
        for autre in r["copies"] + r["sources"]:
            if autre != ref:
                autre.unlink(missing_ok=True)
        index = _index()
        index["photos"].pop(numero, None)
        index["remises"] = sorted(set(index["remises"]) | {str(cible)})
        _ecrire_json(FICHIER_INDEX, index)
    _vider_dossiers(parametres.dossier("photos", p))
    return {"chemin": str(cible)}


def _vider_dossiers(racine):
    if not racine or not racine.is_dir():
        return
    for dossier, _, _ in os.walk(racine, topdown=False):
        d = Path(dossier)
        if d != racine and not any(d.iterdir()):
            try:
                d.rmdir()
            except OSError:
                pass


def ignorer(cles: list, oui: bool = True) -> None:
    """Met de côté (ou remet à trier) des fichiers à trier, sans les déplacer."""
    with _verrou:
        index = _index()
        chemins = {str(_connus[c]) for c in cles if c in _connus}
        ignorees = set(index["ignorees"])
        index["ignorees"] = sorted(ignorees | chemins if oui else ignorees - chemins)
        if not oui:
            index["remises"] = sorted(set(index["remises"]) | chemins)
        _ecrire_json(FICHIER_INDEX, index)


def deposer(nom: str, contenu: bytes, modifie_ms=None) -> str:
    """Fichier glissé depuis l'Explorateur dans la page : copié dans « À trier » (l'original reste en place)."""
    a_trier = parametres.dossier("a_trier")
    if not a_trier:
        raise ValueError("Choisissez d'abord le dossier principal dans les Paramètres.")
    nom = _nom(Path(nom).name)
    if not genre(nom):
        raise ValueError(f"« {nom} » n'est ni une photo ni une vidéo.")
    a_trier.mkdir(parents=True, exist_ok=True)
    cible = a_trier / nom
    n = 2
    while cible.exists():
        cible = a_trier / f"{Path(nom).stem} ({n}){Path(nom).suffix}"
        n += 1
    cible.write_bytes(contenu)
    if modifie_ms:
        try:
            t = float(modifie_ms) / 1000
            os.utime(cible, (t, t))
        except (ValueError, OSError):
            pass
    return str(cible)


# ------------------------------------------------------------------ affichage
def chemin_a_trier(cle: str):
    return _connus.get(cle)


def chemin_range(numero: str, affichable: bool = True):
    """Une copie de la photo (JPEG / PNG… lisible par le navigateur), ou None."""
    r = rangees().get(numero)
    if not r:
        return None
    for c in r["copies"]:
        if not affichable or c.suffix.lower() in (JPEG | {".png", ".gif", ".webp"}):
            return c
    return r["copies"][0] if r["copies"] else None


def miniature(chemin: Path) -> Path | None:
    """Miniature JPEG (400 px) gardée en cache ; None pour une vidéo ou sans Pillow."""
    if genre(chemin) != "photo":
        return None
    try:
        st = chemin.stat()
    except OSError:
        return None
    cle = hashlib.sha1(f"{chemin}|{st.st_size}|{int(st.st_mtime)}".encode()).hexdigest()
    cible = MINIATURES / f"{cle}.jpg"
    if cible.exists():
        return cible
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return None
    if chemin.suffix.lower() in HEIC and not _activer_heif():
        return None
    try:
        with Image.open(chemin) as im:
            im.draft("RGB", (800, 800))
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((400, 400))
            fd, temp = tempfile.mkstemp(dir=MINIATURES, suffix=".jpg")
            os.close(fd)
            im.save(temp, "JPEG", quality=80)
            os.replace(temp, cible)
    except Exception:
        return None
    return cible


def page_impression(numeros: list, par_page: int) -> str:
    """Page imprimable : 16 (4 × 4), 4 (2 × 2) ou 1 photo par page A4. Aucun PDF n'est enregistré."""
    par_page = par_page if par_page in (1, 4, 16) else 16
    colonnes = {1: 1, 4: 2, 16: 4}[par_page]
    images = [n for n in numeros if chemin_range(n) and genre(chemin_range(n)) == "photo"]
    pages = [images[i:i + par_page] for i in range(0, len(images), par_page)] or [[]]
    corps = "".join(
        '<section class="page">' + "".join(f'<figure><img src="/api/photos/image?numero={n}" alt=""></figure>' for n in page)
        + "</section>" for page in pages)
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Photos à imprimer</title>
<style>
@page {{ size: A4; margin: 8mm; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: sans-serif; }}
.consigne {{ padding: 12px 16px; background: #efeafb; color: #3a3552; }}
.page {{ width: 194mm; height: 281mm; display: grid; gap: 3mm; grid-template-columns: repeat({colonnes}, 1fr);
  grid-template-rows: repeat({colonnes}, 1fr); page-break-after: always; break-after: page; margin: 0 auto; }}
.page:last-child {{ page-break-after: auto; break-after: auto; }}
figure {{ margin: 0; display: grid; place-items: center; overflow: hidden; min-height: 0; }}
img {{ max-width: 100%; max-height: 100%; object-fit: contain; }}
@media print {{ .consigne {{ display: none; }} }}
</style></head><body>
<p class="consigne">{len(images)} photo{'s' if len(images) > 1 else ''}, {par_page} par page A4. La fenêtre d'impression
s'ouvre ; vous pouvez aussi utiliser Ctrl + P.</p>
{corps}
<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>
</body></html>"""
