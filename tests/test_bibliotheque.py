"""Tests de la détection des bulletins déjà présents (noms fictifs)."""
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent / "app"))
import bibliotheque as b  # noqa: E402

cas = {
    "paje_bulletinsalaire Dupont 08 2025": "2025-08",
    "paje_bulletinsalaire. MARTIN 09 24": "2024-09",
    "paje_bulletinsalaire. PETIT 0924": "2024-09",
    "paje_bulletinsalaire Martin emma 2026 01": "2026-01",
    "paje_bulletinsalaire Martin 08  2025": "2025-08",
    "Bulletins 11_2025": "2025-11",
    "Bulletin de salaire - DURAND - 2025-07": "2025-07",
    "Janvier 2025 M. DUPONT 412,50 €": "2025-01",
    "Période : 03/2026": "2026-03",
    "IndemnitesJournalieres01062026 (1)": None,
    "paje_bulletinsalaire martin Lucas": None,
}
for texte, attendu in cas.items():
    obtenu = b.periode_depuis_texte(texte)
    assert obtenu == attendu, (texte, obtenu, attendu)
print("periodes OK")

# Dossier de test reproduisant des noms de fichiers variés
racine = Path(tempfile.mkdtemp()) / "Bulletins de salaire"
fichiers = [
    "paje_bulletinsalaire Dupont 02 2026 rectifié.pdf",
    "DUPONT Marie/paje_bulletinsalaire Dupont 01 2026.pdf",
    "DUPONT Marie/Bulletins 11_2025.pdf",
    "DUPONT Marie/paje_bulletinsalaire Durand 07 2025.pdf",
    "Durand/paje_bulletinsalaire DURAND 09 2024.pdf",
    "Martin/martin Lucas/paje_bulletinsalaire Martin Lucas 2026 01.pdf",
    "Martin/martin emma/paje_bulletinsalaire Martin emma 2026 01.pdf",
    "Martin/martin emma/paje_bulletinsalaire Martin Emma 04 2026.pdf",
    "Bernard/paje_bulletinsalaire Bernard 07 2026.pdf",
]
for f in fichiers:
    p = racine / f
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"%PDF-1.4 test")

params = {"dossier_bulletins": str(racine), "format_fichier": "Bulletin de salaire - NOM CLIENT - YYYY-MM",
          "format_dossier": "NOM CLIENT"}
liste = [
    {"employeur": "Mme DUPONT MARIE", "periode": "2026-01"},     # présent
    {"employeur": "Mme DUPONT MARIE", "periode": "2025-11"},     # présent (nom via dossier)
    {"employeur": "Mme DUPONT MARIE", "periode": "2026-02"},     # présent (racine)
    {"employeur": "Mme DUPONT MARIE", "periode": "2026-08"},     # manquant
    {"employeur": "M. DURAND Pierre", "periode": "2025-07"},     # présent (mal rangé)
    {"employeur": "M. MARTIN PAUL", "periode": "2026-01", "enfant": "Lucas"},  # 2 enfants -> 2 présents
    {"employeur": "M. MARTIN PAUL", "periode": "2026-01", "enfant": "Emma"},
    {"employeur": "M. MARTIN PAUL", "periode": "2026-04", "enfant": "Lucas"},  # manquant (le fichier est celui d'Emma)
    {"employeur": "M. MARTIN PAUL", "periode": "2026-04", "enfant": "Emma"},   # présent
    {"employeur": "Mme BERNARD", "periode": "2026-08"},          # manquant
    {"employeur": "M. NOUVEAU Client", "periode": "2026-09"},    # nouveau client
]
b.comparer(liste, params, {})
for x in liste:
    etat = "PRESENT " if x["present"] else "MANQUANT"
    print(f"{x['employeur']:<22} {x['periode']}  rang {x['rang']}  {etat}  -> {Path(x['cible']).relative_to(racine)}")
attendus = [True, True, True, False, True, True, True, False, True, False, False]
assert [x["present"] for x in liste] == attendus, [x["present"] for x in liste]
assert liste[3]["client"] == "DUPONT Marie" and liste[5]["client"] == "Martin"
assert "Emma" in liste[8]["fichier_existant"]
assert Path(liste[7]["cible"]).name == "Bulletin de salaire - Martin - 2026-04 - Lucas.pdf"
assert Path(liste[0]["cible"]).name == "Bulletin de salaire - DUPONT Marie - 2026-01.pdf"
assert b.appliquer_format("NOM CLIENT - ENFANT - YYYY-MM", "Dupont", "2025-08", "") == "Dupont - 2025-08"
assert b.appliquer_format("NOM CLIENT - ENFANT - YYYY-MM", "Dupont", "2025-08", "Léa") == "Dupont - Léa - 2025-08"
assert liste[10]["client"] == "NOUVEAU Client"
assert b.nom_client("M. MARTIN PAUL", str(racine), {"m. martin paul": "Famille Martin"}) == "Famille Martin"
assert b.appliquer_format("MOIS YYYY - NOM CLIENT (MM/YY)", "Dupont", "2025-08") == "Août 2025 - Dupont (08-25)"
print(b.resume_dossier(str(racine)))
print("comparaison OK")
