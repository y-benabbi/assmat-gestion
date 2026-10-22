"""Photos, activités et dossier principal, avec des fiches et des images fictives (dossier temporaire) :
passage au dossier principal (fichiers déplacés), sauvegarde, pré-classement selon les horaires, rangement
(copies par enfant, numéro unique, HEIC converti + original gardé, XMP), modification, doublons, numérotation des
fichiers ajoutés à la main, remise à trier, impression, activités et séances."""
import json
import os
import struct
import sys
import tempfile
import time
from datetime import date, datetime
from pathlib import Path

os.environ["TZ"] = "UTC"
if hasattr(time, "tzset"):
    time.tzset()
ICI = Path(__file__).resolve().parent
TEMP = Path(tempfile.mkdtemp(prefix="assmat-photos-"))
os.environ["ASSMAT_BASE"] = str(TEMP / "base")
sys.path.insert(0, str(ICI.parent / "app"))

from PIL import Image  # noqa: E402
import pillow_heif  # noqa: E402

import ateliers  # noqa: E402
import donnees  # noqa: E402
import parametres  # noqa: E402
import photos  # noqa: E402
import principal  # noqa: E402

pillow_heif.register_heif_opener()


def image(chemin: Path, quand: str = "", couleur=(200, 120, 160), format_=None):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGB", (64, 48), couleur)
    exif = Image.Exif()
    if quand:
        exif.get_ifd(0x8769)[0x9003] = quand
    im.save(chemin, format_ or None, exif=exif.tobytes()) if quand else im.save(chemin, format_ or None)


def video(chemin: Path, quand: datetime):
    """MP4 minimal : ftyp + moov/mvhd (date de création en secondes depuis 1904, UTC)."""
    secondes = int(quand.timestamp()) + 2082844800
    mvhd = b"\x00\x00\x00\x00" + struct.pack(">II", secondes, secondes) + b"\x00" * 88
    mvhd = struct.pack(">I", 8 + len(mvhd)) + b"mvhd" + mvhd
    moov = struct.pack(">I", 8 + len(mvhd)) + b"moov" + mvhd
    ftyp = struct.pack(">I", 16) + b"ftypisom" + b"\x00\x00\x02\x00"
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_bytes(ftyp + moov + struct.pack(">I", 16) + b"mdat" + b"\x00" * 8)


def attendre_deplacement():
    for _ in range(100):
        if not principal.etat()["en_cours"]:
            return principal.etat()
        time.sleep(0.05)
    raise AssertionError("déplacement trop long")


# ------------------------------------------------------------------ passage au dossier principal
ancien = TEMP / "Documents"
(ancien / "Bulletins" / "Dupont").mkdir(parents=True)
(ancien / "Bulletins" / "Dupont" / "Bulletin de salaire - Dupont - 2026-09.pdf").write_bytes(b"%PDF-1.4 fictif")
(ancien / "Courriers").mkdir()
(ancien / "Courriers" / "Contrat de travail - Léa Dupont.pdf").write_bytes(b"%PDF-1.4 contrat")
parametres.enregistrer({"dossier_bulletins": str(ancien / "Bulletins")})
lea = donnees.enregistrer_contrat({"famille": "Dupont", "enfant_prenom": "Léa", "debut": "2026-01-05",
                                   "horaires_scolaire": {"lundi": "8h00-17h00", "mardi": "8h00-17h00"}})
hugo = donnees.enregistrer_contrat({"famille": "Martin", "enfant_prenom": "Hugo", "debut": "2026-01-05",
                                    "horaires_scolaire": {"lundi": "8h00-12h00"},
                                    "horaires_vacances": {"mercredi": "9h00-17h00"}})
donnees.ajouter_document(lea["id"], "contrat", "Contrat de travail",
                         str(ancien / "Courriers" / "Contrat de travail - Léa Dupont.pdf"))

racine = TEMP / "Assistante maternelle"
assert principal.proposition() == str(ancien)
principal.lancer(str(racine))
fin = attendre_deplacement()
assert fin["termine"] and not fin["erreurs"], fin
p = parametres.charger()
assert p["dossier_principal"] == str(racine)
assert p["dossier_bulletins"] == str(racine / "Bulletins de salaire")
assert (racine / "Bulletins de salaire" / "Dupont" / "Bulletin de salaire - Dupont - 2026-09.pdf").is_file()
assert (racine / "Courriers" / "Contrat de travail - Léa Dupont.pdf").is_file()
assert not (ancien / "Bulletins").exists() and not (ancien / "Courriers").exists(), "anciens dossiers vides retirés"
for nom in parametres.SOUS_DOSSIERS.values():
    assert (racine / nom).is_dir(), nom
assert donnees.documents(lea["id"])[0]["chemin"] == str(racine / "Courriers" / "Contrat de travail - Léa Dupont.pdf")
assert (racine / "Sauvegarde" / date.today().isoformat() / "contrats.json").is_file()
print("dossier principal : fichiers déplacés, chemins des documents mis à jour, sauvegarde créée")

# ------------------------------------------------------------------ activités
peinture = ateliers.enregistrer({"titre": "Peinture d'automne", "description": "Feuilles et gouache",
                                 "a_preparer": "Gouache\nFeuilles ramassées\n\nTabliers"})
assert peinture["id"] == "A0001" and peinture["a_preparer"] == ["Gouache", "Feuilles ramassées", "Tabliers"]
seance = ateliers.ajouter_seance(peinture["id"], "2026-10-19")
assert ateliers.ajouter_seance(peinture["id"], "2026-10-19")["id"] == seance["id"], "une séance par jour"
ateliers.modifier_seance(seance["id"], {"prepare": ["Gouache", "Inconnu"]})
assert ateliers.seance(seance["id"])[1]["prepare"] == ["Gouache"]
ateliers.ajouter_document(peinture["id"], "modele.pdf", b"%PDF")
assert [d["nom"] for d in ateliers.documents(peinture)] == ["modele.pdf"]
assert (racine / "Activités" / "Peinture d'automne" / "modele.pdf").is_file()
peinture = ateliers.enregistrer(peinture | {"titre": "Peinture des feuilles"})
assert (racine / "Activités" / "Peinture des feuilles" / "modele.pdf").is_file(), "dossier renommé avec le titre"
venir = ateliers.ajouter_seance(peinture["id"], date.fromordinal(date.today().toordinal() + 5).isoformat())
ech = [e for e in donnees.echeances(date.today()) if e["type"] == "activite"]
assert ech and ech[0]["titre"] == "Réalisation : Peinture des feuilles" and "0 sur 3" in ech[0]["detail"], ech
ateliers.supprimer_seance(venir["id"])
print("activités : modèle, séances, liste à préparer, documents, échéance")

# ------------------------------------------------------------------ pré-classement
icloud = TEMP / "iCloud Photos"
parametres.enregistrer({"dossiers_photos": [str(icloud)], "marge_photos": 30})
image(icloud / "IMG_0001.JPG", "2026:10:19 10:00:00")                  # lundi : Léa et Hugo
image(icloud / "IMG_0002.JPG", "2026:10:19 14:00:00", (90, 140, 200))  # lundi après-midi : Léa
image(icloud / "IMG_0003.JPG", "2026:10:24 15:00:00", (10, 10, 10))    # samedi : hors horaires
image(icloud / "IMG_0004.JPG", "2026:10:19 17:20:00", (40, 200, 40))   # 17 h 20 : Léa dans la marge
image(icloud / "Capture.png")                                          # sans EXIF : date du fichier
os.utime(icloud / "Capture.png", (datetime(2026, 10, 19, 9, 30).timestamp(),) * 2)
image(icloud / "IMG_0005.HEIC", "2026:10:20 09:00:00", (250, 200, 60), "HEIF")
video(icloud / "IMG_0006.MP4", datetime(2026, 10, 19, 11, 0))
image(icloud / "IMG_0007.JPG", "2026:10:21 10:00:00", (1, 2, 3))       # mercredi : horaires de vacances de Hugo

liste = photos.lister()
par_nom = {e["nom"]: e for e in liste["a_trier"]}
assert set(par_nom) == {"IMG_0001.JPG", "IMG_0002.JPG", "IMG_0004.JPG", "Capture.png", "IMG_0005.HEIC", "IMG_0006.MP4",
                        "IMG_0007.JPG"}, set(par_nom)
assert [e["nom"] for e in liste["hors_horaires"]] == ["IMG_0003.JPG"]
assert sorted(par_nom["IMG_0001.JPG"]["proposes"]) == sorted([lea["id"], hugo["id"]])
assert par_nom["IMG_0002.JPG"]["proposes"] == [lea["id"]]
assert par_nom["IMG_0004.JPG"]["proposes"] == [lea["id"]]
assert par_nom["IMG_0006.MP4"]["date"] == "2026-10-19T11:00:00" and par_nom["IMG_0006.MP4"]["genre"] == "video"
assert par_nom["IMG_0007.JPG"]["proposes"] == [hugo["id"]]
assert par_nom["Capture.png"]["date"] == "2026-10-19T09:30:00", par_nom["Capture.png"]
assert set(par_nom["Capture.png"]["proposes"]) == {lea["id"], hugo["id"]}
# À trier : jours du plus récent au plus ancien, heures croissantes dans un même jour.
dates = [e["date"] for e in liste["a_trier"]]
assert [d[:10] for d in dates] == sorted((d[:10] for d in dates), reverse=True), dates
for jour in {d[:10] for d in dates}:
    heures = [d for d in dates if d[:10] == jour]
    assert heures == sorted(heures), heures
assert dates[0][:10] == "2026-10-21", dates
# Sans EXIF mais avec une date XMP (photo exportée) : la date XMP passe avant celle du fichier.
assert photos.date_image(icloud / "IMG_0001.JPG") == "2026-10-19T10:00:00"
xmp = TEMP / "exportee.jpg"
Image.new("RGB", (8, 8)).save(xmp, xmp=b'<x:xmpmeta><rdf:Description xmp:CreateDate="2026-10-14T09:52:10+02:00"/></x:xmpmeta>')
assert photos.date_image(xmp) == "2026-10-14T09:52:10", photos.date_image(xmp)
parametres.enregistrer({"marge_photos": 0})
assert "IMG_0004.JPG" not in {e["nom"] for e in photos.lister()["a_trier"]}, "sans marge, 17 h 20 est hors horaires"
parametres.enregistrer({"marge_photos": 30})
liste = photos.lister()
par_nom = {e["nom"]: e for e in liste["a_trier"]}
assert photos.miniature(icloud / "IMG_0005.HEIC") and photos.miniature(icloud / "IMG_0001.JPG")
print("pré-classement : horaires et marge, sans date, vidéo datée, miniatures (HEIC compris)")

# ------------------------------------------------------------------ rangement
r = photos.ranger([par_nom["IMG_0001.JPG"]["cle"]], [lea["id"], hugo["id"]], seance["id"])
assert r == {"ranges": ["0001"], "erreurs": []}, r
copie_lea = racine / "Photos et vidéos" / "Dupont" / "Léa" / "2026" / "Léa - Peinture des feuilles - Photo 0001.jpg"
copie_hugo = racine / "Photos et vidéos" / "Martin" / "Hugo" / "2026" / "Hugo - Peinture des feuilles - Photo 0001.jpg"
assert copie_lea.is_file() and copie_hugo.is_file() and not (icloud / "IMG_0001.JPG").exists()
assert photos.lire_xmp(copie_lea) == {"Photo": "0001", "Seance": seance["id"], "Activite": peinture["id"],
                                      "Titre": "Peinture des feuilles"}, photos.lire_xmp(copie_lea)
with Image.open(copie_lea) as im:
    assert im.size == (64, 48) and im.getexif().get_ifd(0x8769).get(0x9003) == "2026:10:19 10:00:00"

r = photos.ranger([par_nom["IMG_0005.HEIC"]["cle"], par_nom["IMG_0006.MP4"]["cle"]], [lea["id"]])
assert r["ranges"] == ["0002", "0003"] and not r["erreurs"], r
jpeg = racine / "Photos et vidéos" / "Dupont" / "Léa" / "2026" / "Léa - Photo 0002.jpg"
heic = racine / "Photos et vidéos" / "Format source" / "Dupont" / "Léa" / "2026" / "Léa - Photo 0002.heic"
assert jpeg.is_file() and heic.is_file() and Image.open(jpeg).format == "JPEG"
assert (racine / "Photos et vidéos" / "Dupont" / "Léa" / "2026" / "Léa - Vidéo 0003.mp4").is_file()

rangees = {x["numero"]: x for x in photos.lister()["rangees"]}
assert set(rangees) == {"0001", "0002", "0003"}
assert sorted(rangees["0001"]["enfants"]) == sorted([lea["id"], hugo["id"]]) and rangees["0001"]["copies"] == 2
assert rangees["0001"]["seance"] == seance["id"] and rangees["0003"]["genre"] == "video"
print("rangement : une copie par enfant, numéro unique, HEIC en JPEG + original, vidéo, XMP")

# Modifier : Hugo retiré, activité retirée (copies renommées).
photos.modifier("0001", [lea["id"]], "")
assert not copie_hugo.exists() and not copie_lea.exists()
assert (racine / "Photos et vidéos" / "Dupont" / "Léa" / "2026" / "Léa - Photo 0001.jpg").is_file()
assert not (racine / "Photos et vidéos" / "Martin").exists(), "dossiers vides retirés"
# Ajouter Hugo à la photo HEIC : JPEG et original pour lui aussi.
photos.modifier("0002", [lea["id"], hugo["id"]], seance["id"])
assert (racine / "Photos et vidéos" / "Format source" / "Martin" / "Hugo" / "2026"
        / "Hugo - Peinture des feuilles - Photo 0002.heic").is_file()
assert not heic.exists() and (racine / "Photos et vidéos" / "Dupont" / "Léa" / "2026"
                              / "Léa - Peinture des feuilles - Photo 0002.jpg").is_file()
# Rattacher à une réalisation (glisser sur le filtre, ou depuis la réalisation) : les enfants ne changent pas.
r = photos.rattacher(["0001"], seance["id"])
assert r == {"rattachees": ["0001"], "erreurs": []}, r
assert (racine / "Photos et vidéos" / "Dupont" / "Léa" / "2026" / "Léa - Peinture des feuilles - Photo 0001.jpg").is_file()
assert photos._index()["photos"]["0001"]["seance"] == seance["id"]
assert photos.rattacher(["9999"], seance["id"])["erreurs"], "photo inconnue signalée"
print("modification : enfants et activité changés, copies ajoutées, retirées, renommées ; rattachement à une réalisation")

# Doublon : la même photo réapparaît dans les sources.
image(icloud / "IMG_0001 copie.JPG", "2026:10:19 10:00:00")
liste = photos.lister()
double = next(e for e in liste["a_trier"] if e["nom"] == "IMG_0001 copie.JPG")
assert double["doublon"] == "0001", double
r = photos.ranger([double["cle"]], [hugo["id"]])
assert r["ranges"] == ["0001"] and not (icloud / "IMG_0001 copie.JPG").exists()
assert sorted(next(x for x in photos.lister()["rangees"] if x["numero"] == "0001")["enfants"]) == sorted([lea["id"], hugo["id"]])
print("doublon : signalé, rangé sous le même numéro")

# Fichier ajouté à la main dans le rangement : numéroté et renommé.
image(racine / "Photos et vidéos" / "Martin" / "Hugo" / "2025" / "anniversaire.jpg", "2025:06:01 10:00:00", (5, 5, 5))
liste = photos.lister()
assert (racine / "Photos et vidéos" / "Martin" / "Hugo" / "2025" / "Hugo - Photo 0004.jpg").is_file()
assert any(x["numero"] == "0004" and x["enfants"] == [hugo["id"]] for x in liste["rangees"])
print("numérotation : photo ajoutée à la main renommée « Hugo - Photo 0004 »")

# Photo d'une réalisation sans enfant : dans « Réalisations\<identifiant> - <titre> du <date> », puis dans le dossier de
# l'enfant dès qu'il est choisi.
dossier_r = racine / "Photos et vidéos" / "Réalisations" / f"{seance['id']} - Peinture des feuilles du 19 octobre 2026"
assert photos.dossier_realisation(seance["id"]) == dossier_r.name
cle = next(e["cle"] for e in photos.lister()["a_trier"] if e["nom"] == "IMG_0004.JPG")
r = photos.ranger([cle], [], seance["id"])
assert r == {"ranges": ["0005"], "erreurs": []}, r
assert (dossier_r / "Peinture des feuilles - Photo 0005.jpg").is_file()
assert next(x for x in photos.lister()["rangees"] if x["numero"] == "0005")["enfants"] == []
try:
    photos.modifier("0005", [], "")
    raise AssertionError("ni enfant ni réalisation : refusé")
except ValueError:
    pass
photos.modifier("0005", [lea["id"]], seance["id"])
assert (racine / "Photos et vidéos" / "Dupont" / "Léa" / "2026" / "Léa - Peinture des feuilles - Photo 0005.jpg").is_file()
assert not dossier_r.exists(), "retirée du dossier de la réalisation"
# Déposée à la main dans le dossier d'une réalisation : numérotée et rattachée à la réalisation.
image(dossier_r / "atelier.jpg", "2026:10:19 15:00:00", (7, 7, 7))
photos.lister()
assert (dossier_r / "Peinture des feuilles - Photo 0006.jpg").is_file()
assert photos._index()["photos"]["0006"]["seance"] == seance["id"]
print("réalisation sans enfant : dossier « Réalisations », puis dossier de l'enfant ; dépôt à la main rattaché")

# Ignorer puis remettre ; remettre à trier une photo rangée.
cle = next(e["cle"] for e in liste["a_trier"] if e["nom"] == "Capture.png")
photos.ignorer([cle])
liste = photos.lister()
assert [e["nom"] for e in liste["ignorees"]] == ["Capture.png"] and (icloud / "Capture.png").exists()
photos.ignorer([liste["ignorees"][0]["cle"]], False)
liste = photos.lister()
assert "Capture.png" in {e["nom"] for e in liste["a_trier"]}
cle = liste["hors_horaires"][0]["cle"]
photos.ignorer([cle], False)                       # hors horaires remise à trier malgré tout
assert "IMG_0003.JPG" in {e["nom"] for e in photos.lister()["a_trier"]}
retour = photos.remettre_a_trier("0002")
assert Path(retour["chemin"]).name == "Photo 0002.heic" and Path(retour["chemin"]).parent == racine / "À trier"
assert "0002" not in {x["numero"] for x in photos.lister()["rangees"]}
assert not (racine / "Photos et vidéos" / "Format source").exists()
assert "Photo 0002.heic" in {e["nom"] for e in photos.lister()["a_trier"]}
print("ignorées, hors horaires remises, photo rangée remise à trier (original HEIC)")

# Dépôt depuis l'Explorateur : copie dans « À trier ».
chemin = photos.deposer("glissee.jpg", (icloud / "IMG_0002.JPG").read_bytes(), 1760000000000)
assert Path(chemin).parent == racine / "À trier" and int(Path(chemin).stat().st_mtime) == 1760000000
try:
    photos.deposer("notes.txt", b"x")
    raise AssertionError("un fichier texte ne doit pas être accepté")
except ValueError:
    pass

page = photos.page_impression(["0001", "0003", "0004"], 16)
assert page.count("<img ") == 2 and "repeat(4, 1fr)" in page, "vidéo exclue, 4 × 4"
assert photos.page_impression(["0001"], 4).count("repeat(2, 1fr)") == 2
print("dépôt et impression OK")

# Supprimer : à la Corbeille (ici, dossier « corbeille » de l'installation), copies comprises pour une photo rangée.
corbeille = TEMP / "base" / "corbeille"
cle = next(e["cle"] for e in photos.lister()["a_trier"] if e["nom"] == "glissee.jpg")
assert photos.supprimer(cles=[cle]) == {"supprimees": 1, "erreurs": []}
assert not Path(chemin).exists() and (corbeille / "glissee.jpg").exists()
r = photos.rangees()["0001"]
nb = len(r["copies"]) + len(r["sources"])
assert photos.supprimer(numeros=["0001"])["supprimees"] == 1
assert "0001" not in photos.rangees() and "0001" not in json.loads((TEMP / "base/donnees/photos.json").read_text(encoding="utf-8"))["photos"]
assert len([f for f in corbeille.iterdir() if "0001" in f.name]) == nb
assert photos.supprimer(numeros=["9999"])["erreurs"]
print("suppression vers la Corbeille")
print("photos OK")
