"""Teste la demande de dérogation : texte proposé à partir du profil et des contrats (fictifs),
champs manquants signalés, page imprimable et PDF."""
import os
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ["ASSMAT_BASE"] = tempfile.mkdtemp()
sys.path.insert(0, str(ICI.parent / "app"))

import courriers  # noqa: E402
import donnees  # noqa: E402

JOURNEE = {j: "8h30-17h30" for j in donnees.JOURS[:5]}


def main():
    # Profil incomplet : les champs manquants sont listés.
    donnees.enregistrer_profil({"nom": "Dupont", "prenom": "Marie"})
    r = courriers.proposer_derogation({"contrat_id": "inconnu"})
    assert "erreur" in r and "Adresse" in r["manquants"], r

    donnees.enregistrer_profil({
        "civilite": "Madame", "nom": "Dupont", "prenom": "Marie", "adresse": "1 rue des Lilas",
        "code_postal": "75000", "ville": "Paris", "telephone": "01 02 03 04 05", "agrement_numero": "12345",
        "agrement_debut": "2014-03-01", "agrement_capacite": "4", "zone_vacances": "C"})
    enfant = donnees.enregistrer_contrat({
        "famille": "Martin", "enfant_prenom": "Paul", "enfant_nom": "Martin", "enfant_genre": "garcon",
        "enfant_naissance": "2022-05-10", "debut": "2022-10-03", "accueil": "periscolaire",
        "horaires_scolaire": {"mercredi": "8h00-17h30"}, "horaires_vacances": {j: "8h00-17h30" for j in donnees.JOURS[:5]}})
    donnees.enregistrer_contrat({"famille": "Durand", "enfant_prenom": "Léa", "enfant_nom": "Durand",
                                 "enfant_naissance": "2023-04-01", "debut": "2024-09-01",
                                 "horaires_scolaire": {"mercredi": "8h30-17h30"},
                                 "horaires_vacances": {j: "8h30-17h30" for j in donnees.JOURS[:5]}})
    for prenom, nom in (("Hugo", "Bernard"), ("Jade", "Petit"), ("Noé", "Durand")):
        donnees.enregistrer_contrat({"famille": nom, "enfant_prenom": prenom, "enfant_nom": nom,
                                     "enfant_naissance": "2025-01-15", "debut": "2025-09-01",
                                     "horaires_scolaire": {j: v for j, v in JOURNEE.items() if j != "mercredi"}})
    # Un contrat terminé n'apparaît pas dans les emplois du temps.
    donnees.enregistrer_contrat({"famille": "Ancien", "enfant_prenom": "Zoé", "debut": "2020-01-01", "fin": "2021-01-01",
                                 "horaires_scolaire": JOURNEE})

    periodes = [{"debut": "2026-10-17", "fin": "2026-11-01"}, {"debut": "2026-12-19", "fin": "2027-01-03"}]
    r = courriers.proposer_derogation({"contrat_id": enfant["id"], "type_accueil": "periscolaire",
                                       "date_fin": "2028-05-10", "date_courrier": "2026-08-07",
                                       "motif": "sa maman souhaiterait que je continue à l'accueillir",
                                       "periodes": periodes})
    assert r["manquants"] == [], r["manquants"]
    t = r["proposition"]
    assert t["entete"].startswith("Madame DUPONT Marie\n1 rue des Lilas\n75000 PARIS"), t["entete"]
    assert "N° agrément : 12345" in t["entete"]
    assert t["lieu_date"] == "Paris, le 7 août 2026", t["lieu_date"]
    assert "agréée pour l'accueil de 4 enfants de 0 à 18 ans en journée depuis mars 2014" in t["corps"], t["corps"]
    assert "un cinquième enfant en périscolaire jusqu'en mai 2028" in t["corps"], t["corps"]
    assert "Paul Martin vient à mon domicile depuis octobre 2022, sa maman souhaiterait" in t["corps"], t["corps"]
    assert t["periodes"] == ["du 17 octobre au 1er novembre 2026", "du 19 décembre 2026 au 3 janvier 2027"], t["periodes"]
    assert "Paul viendrait 5 jours, d'où la présence de 5 enfants le lundi, mardi, jeudi et vendredi." in t["suite"], t["suite"]
    assert "il viendrait seulement le mercredi, où seuls 2 enfants sont accueillis" in t["suite"], t["suite"]
    assert t["signature"] == "Mme Dupont Marie"
    noms = [l["prenom"] for l in t["tableau_sans"]]
    assert "Zoé" not in noms and len(noms) == 5, noms
    paul_sans = next(l for l in t["tableau_sans"] if l["prenom"] == "Paul")
    paul_avec = next(l for l in t["tableau_avec"] if l["prenom"] == "Paul")
    assert paul_sans["horaires"]["lundi"] == "" and paul_avec["horaires"]["lundi"] == "8h00-17h30"
    assert paul_sans["age"] == "4 ans", paul_sans["age"]
    assert next(l for l in t["tableau_sans"] if l["prenom"] == "Léa")["age"] == "3 ans", t["tableau_sans"]
    hugo = next(l for l in t["tableau_avec"] if l["prenom"] == "Hugo")
    assert hugo["horaires"]["lundi"] == "8h30-17h30"     # vacances = période scolaire si non précisé

    page = courriers.html_derogation(t)
    assert "Objet : Demande de dérogation" in page and "ANNEXE" in page and "<li>du 17 octobre" in page
    assert "<script" not in courriers.html_derogation(t | {"corps": "<script>alert(1)</script>"})

    cible = Path(tempfile.mkdtemp()) / "Courriers" / "Demande de dérogation.pdf"
    courriers.generer_pdf(page, cible)
    assert cible.read_bytes()[:5] == b"%PDF-" and cible.stat().st_size > 5000
    print("OK : demande de dérogation (texte, annexe, PDF)")

    # Âges et échéances
    from datetime import date
    assert donnees.age_texte("2023-04-01", date(2026, 8, 7)) == "3 ans"
    assert donnees.age_texte("2024-01-01", date(2026, 8, 7)) == "2 ans et demi"
    assert donnees.age_texte("2026-01-01", date(2026, 8, 7)) == "7 mois"
    donnees.enregistrer_profil({"agrement_fin": "2027-03-14", "assurance_rc_echeance": "2026-11-30"})
    titres = [e["titre"] for e in donnees.echeances(date(2026, 10, 20))]
    assert "Dernier délai pour demander le renouvellement de l'agrément" in titres, titres
    assert "Échéance de l'assurance responsabilité civile professionnelle" in titres, titres
    print("OK : âges et échéances")


if __name__ == "__main__":
    main()
