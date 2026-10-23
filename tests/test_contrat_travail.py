"""Teste le contrat de travail rempli sur le modèle de l'Urssaf (profil, famille et fiche enfant fictifs) :
noms des champs du modèle, version à remplir, version complète, cas n° 1 et n° 2, rubriques manquantes."""
import os
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ["ASSMAT_BASE"] = tempfile.mkdtemp()
sys.path.insert(0, str(ICI.parent / "app"))

from pypdf import PdfReader  # noqa: E402

import contrat_travail as ct  # noqa: E402
import donnees  # noqa: E402

PROFIL = {"nom": "Martin", "nom_naissance": "Bernard", "prenom": "Sophie", "adresse": "3 rue des Lilas",
          "code_postal": "35000", "ville": "Rennes", "telephone": "06 00 00 00 00", "email": "sophie@example.org",
          "numero_secu": "2 80 01 35 000 000 00", "agrement_numero": "AG-0000", "agrement_debut": "2015-03-01",
          "assurance_rc_compagnie": "Assurance Exemple", "assurance_rc_police": "RC-1", "lieu_accueil": "domicile"}
FAMILLE = {"nom": "Dupont", "parent1_nom": "Dupont", "parent1_prenom": "Claire", "parent1_qualite": "mere",
           "adresse": "8 avenue des Tilleuls", "code_postal": "35000", "ville": "Rennes", "numero_pajemploi": "Y1234567890123"}
FICHE = {"famille": "Dupont", "enfant_prenom": "Léa", "enfant_nom": "Dupont", "enfant_naissance": "2025-05-12",
         "debut": "2026-09-01", "semaines": "45", "essai": "2 mois", "tarif_horaire": "4,50", "entretien_jour": "4,05",
         "repas_fournis": "assmat", "repas_jour": "3,50", "jour_paiement": "5", "repos_jour": "dimanche",
         "repos_travaille": "recupere", "premier_mai": "chome", "feries_travailles": "8 mai,ascension",
         "conges_paiement": "juin", "taux_majoration": "10", "ferie_majoration": "15",
         "horaires_scolaire": {"lundi": "8h00-17h00", "mardi": "8h00-17h00", "jeudi": "8h00-12h00 / 13h30-17h00"},
         "horaires_vacances": {"lundi": "9h00-17h00"}}


def lire(chemin):
    return {k: v.get("/V") for k, v in PdfReader(str(chemin)).get_fields().items()}


def main():
    sortie = Path(tempfile.mkdtemp())
    champs_modele = set(PdfReader(str(ct.MODELE)).get_fields())

    # Version à remplir : seulement l'assistante maternelle (nom d'usage écrit car différent du nom de naissance).
    v = ct.valeurs_assmat(PROFIL)
    assert set(v) <= champs_modele, set(v) - champs_modele
    lu = lire(ct.remplir(v, sortie / "vierge.pdf"))
    assert lu["Salarie_NOM1"] == "Bernard" and lu["Salarie_NOM2"] == "Martin", lu
    assert lu["Salarie_DelivranceAGREMENT"] == "01/03/2015" and lu["Lieu travail"] == "/Choix1", lu
    assert lu["Salarie-LieuTravail_ADRESSE"] == "3 rue des Lilas, 35000 Rennes", lu
    assert not lu.get("Employeur_NOM1") and not lu.get("Enfant_PRENOM"), lu
    assert ct.manquants(PROFIL) == [], ct.manquants(PROFIL)
    assert "N° de Sécurité sociale" in ct.manquants({**PROFIL, "numero_secu": ""})

    # Version complète, année incomplète (cas n° 2) ; l'avenant postérieur au début n'est pas repris.
    fiche = donnees.enregistrer_contrat({**FICHE, "avenants": [{"date": "2027-01-01", "tarif_horaire": "5,00",
                                                                  "semaines": "45", "horaires_scolaire": FICHE["horaires_scolaire"]}]})
    v = ct.valeurs_contrat(PROFIL, FAMILLE, fiche, 0.78)
    assert set(v) <= champs_modele, set(v) - champs_modele
    lu = lire(ct.remplir(v, sortie / "complet.pdf"))
    attendu = {
        "Employeur_NOM1": "Dupont", "Employeur_PRENOM": "Claire", "CAS3": "/Choix 2",
        "Employeur_NumPAJEMPLOI": "1234567890123", "Enfant_NAISSANCE": "12/05/2025", "Contrat_DATE-Debut": "01/09/2026",
        "DUREE": "/Choix2", "Cas2_NbreSemaine": "45", "CHOIX CAS 2": "/A", "CAS2_NbreHeures": "25,5",
        "CAS2_NbreJOURS": "3", "Cas2-JOUR3": "Jeudi", "Cas2-JOUR3-Horaires": "8h00-12h00 / 13h30-17h00",
        "Cas2-Jour3-NbreHEURE": "07h30", "Salaire_Horaire_BRUT": "4,50", "Salaire_Horaire_NET": "3,51",
        "Salaire_Horaire_MAJ_BRUT": "4,95",
        # 4,50 × (25,5 h × 36 semaines d'école + 8 h × 9 semaines de vacances) ÷ 12
        "CAS2-Salaire_BRUT": "371,25", "ENTRETIEN_heures": "9", "ENTRETIEN_montant": "0,45",
        "CHOIX REPAS": "/2", "FRAIS_repas_AM": "3,50", "PAIEMENT_Date": "5", "REPOS": "/2", "1MAI": "/1",
        "8 mai": "/Oui", "Ascension": "/Oui", "FERIE_Majoration": "15", "PAIEMENT CAS 2": "/1",
    }
    for cle, valeur in attendu.items():
        assert lu.get(cle) == valeur, (cle, lu.get(cle), valeur)
    assert lu.get("Paques") in (None, "/Off") and not lu.get("CAS1-Salaire_BRUT"), lu
    assert "vacances scolaires : lundi 9h00-17h00" in lu["CONDITIONS_01"], lu["CONDITIONS_01"]
    assert ct.manquants(PROFIL, FAMILLE, fiche) == [], ct.manquants(PROFIL, FAMILLE, fiche)

    # Année complète (cas n° 1), autre lieu (MAM), planning et qualité « autre ».
    fiche1 = {**fiche, "semaines": "52", "horaires_vacances": {}, "delai_prevenance": "15 jours", "avenants": []}
    v = ct.valeurs_contrat({**PROFIL, "lieu_accueil": "mam", "mam_adresse": "MAM Les Petits Pas, Rennes"},
                           {**FAMILLE, "parent1_qualite": "autre", "parent1_qualite_autre": "grand-mère"}, fiche1, 0.78)
    assert v["DUREE"] == "/Choix1" and v["Cas1-JOUR1"] == "Lundi" and v["Cas1_NbreSemaine"] == "15 jours", v
    assert v["CAS1-Salaire_BRUT"] == "497,25" and "PAIEMENT CAS 2" not in v, v      # 4,50 × 25,5 × 52 ÷ 12
    assert v["Lieu travail"] == "/Choix2" and v["Text1"] == "grand-mère" and "CONDITIONS_01" not in v, v
    v = ct.valeurs_contrat(PROFIL, FAMILLE, {**fiche, "planning": "oui", "delai_planning": "2 mois", "avenants": []}, 0.78)
    assert v["CHOIX CAS 2"] == "/B" and v["Cas2B_Calendaires"] == "2 mois" and "Cas2-JOUR1" not in v, v

    # Pas de période d'essai ; travail le jour de repos non précisé : aucune case cochée.
    v = ct.valeurs_contrat(PROFIL, FAMILLE, {**fiche, "essai": "aucune", "repos_travaille": "", "avenants": []}, 0.78)
    assert v["Contrat_ESSAI"] == "Pas de période d'essai" and "REPOS" not in v, v

    # Entretien saisi à l'heure : repris tel quel (jusqu'au millième) ; un avenant ne cite que le montant horaire.
    v = ct.valeurs_contrat(PROFIL, FAMILLE, {**fiche, "entretien_horaire": "0,375", "avenants": []}, 0.78)
    assert v["ENTRETIEN_montant"] == "0,375" and v["ENTRETIEN_heures"] == "9", v
    lignes = ct.changements({**FICHE, "entretien_jour": "4,05"}, {**FICHE, "entretien_horaire": "0,50", "entretien_jour": "4,50"}, 0.78)
    assert lignes == [("Indemnité d'entretien", "4,05 € par jour", "0,50 € par heure d'accueil"),
                      ("Indemnité d'entretien par jour", "4,05 €", "3,75 € à 4,50 €")], lignes

    # Brouillons de l'assistant : enregistrés à part, sans compter comme fiche enfant.
    b = donnees.enregistrer_brouillon({"etape": 3, "contrat": {"famille": "Dupont", "enfant_prenom": "Noé"}, "famille": "invalide"})
    assert donnees.brouillons()[0]["id"] == b["id"] and b["famille"] == {} and len(donnees.contrats()) == 1
    donnees.supprimer_brouillon(b["id"])
    assert donnees.brouillons() == []

    # Avenant : une rubrique absente d'un ancien avenant reprend la valeur précédente ; le PDF ne cite que les changements.
    av = {**FICHE, "id": "x", "avenants": [{"id": "a1", "date": "2027-01-04", "motif": "Nouveau tarif", "tarif_horaire": "5,00",
                                              "horaires_scolaire": FICHE["horaires_scolaire"]}]}
    liste = ct.versions(av)
    assert len(liste) == 2 and liste[1]["semaines"] == "45" and liste[1]["repas_jour"] == "3,50", liste[1]
    rubriques = [r[0] for r in ct.changements(liste[0], liste[1], 0.78)]
    assert rubriques[0] == "Salaire horaire de base" and not any("repas" in r.lower() for r in rubriques), rubriques
    assert any("mensuel" in r.lower() for r in rubriques), rubriques
    assert ct.numero_avenant(av, "a1") == 1 and ct.numero_avenant(av, "inconnu") == 0
    page = ct.html_avenant(PROFIL, FAMILLE, av, "a1", 0.78)
    assert "Avenant n° 1" in page and "04/01/2027" in page and "5,00" in page and "Léa" in page, page[:400]
    assert "Téléphone : 01 00 00 00 00" in ct.html_avenant(PROFIL, {**FAMILLE, "telephone": "01 00 00 00 00"}, av, "a1", 0.78)
    assert "(mère)" in page and "N° de Sécurité sociale : 2 80 01 35 000 000 00" in page, page[:1200]
    try:
        ct.html_avenant(PROFIL, FAMILLE, av, "inconnu", 0.78)
        raise AssertionError("avenant inconnu accepté")
    except ValueError:
        pass

    # Documents créés pour un enfant : un même fichier recréé remplace l'entrée ; un fichier disparu est signalé.
    pdf = sortie / "complet.pdf"
    donnees.ajouter_document("x", "contrat", "Contrat de travail", str(pdf))
    donnees.ajouter_document("x", "contrat", "Contrat de travail", str(pdf))
    donnees.ajouter_document("x", "avenant", "Avenant n° 1", str(sortie / "absent.pdf"))
    docs = donnees.documents("x")
    assert len(docs) == 2 and {d["existe"] for d in docs} == {True, False} and donnees.documents("autre") == [], docs

    # Fiche incomplète : rubriques signalées.
    manque = ct.manquants(PROFIL, {}, {"enfant_prenom": "Léa"})
    assert "Nom du parent employeur" in manque and "Emploi du temps" in manque and "Date d'embauche" in manque, manque
    assert ct.nom_fichier(fiche) == "Contrat de travail CDI - Léa Dupont"
    print("OK")


if __name__ == "__main__":
    main()
