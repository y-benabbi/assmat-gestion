"""Teste les fiches enfants avec avenants : conditions en vigueur à une date, et leur prise en compte
dans les échéances et l'aide aux impôts (données fictives)."""
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ["ASSMAT_BASE"] = tempfile.mkdtemp()
sys.path.insert(0, str(ICI.parent / "app"))

import donnees  # noqa: E402
import impots  # noqa: E402

JOURNEE = {j: "8h00-17h00" for j in donnees.JOURS[:5]}
PERISCOLAIRE = {j: "7h30-8h30 / 16h30-18h30" for j in donnees.JOURS[:5]}


def main():
    c = donnees.enregistrer_contrat({
        "famille": "Petit", "enfant_prenom": "Louise", "debut": "2026-01-05", "semaines": "52",
        "tarif_horaire": "4,00", "horaires_scolaire": JOURNEE,
        "avenants": [
            # Désordre volontaire : les avenants sont rangés par date ; un avenant sans date est ignoré.
            {"date": "2026-09-01", "motif": "Passage en accueil périscolaire", "semaines": "43",
             "accueil": "periscolaire", "tarif_horaire": "4,20", "horaires_scolaire": PERISCOLAIRE,
             "horaires_vacances": JOURNEE},
            {"date": "2026-03-01", "motif": "Augmentation du tarif horaire", "semaines": "52",
             "tarif_horaire": "4,10", "horaires_scolaire": JOURNEE},
            {"date": "", "motif": "brouillon"},
        ]})
    assert [a["date"] for a in c["avenants"]] == ["2026-03-01", "2026-09-01"], c["avenants"]
    assert all(a["id"] for a in c["avenants"]) and c["avenants"][0]["accueil"] == "journee"

    def tarif(jour):
        return donnees.en_vigueur(c, date.fromisoformat(jour))["tarif_horaire"]

    assert tarif("2026-02-15") == "4,00" and tarif("2026-03-01") == "4,10" and tarif("2026-10-01") == "4,20"
    sept = donnees.contrats(date(2026, 9, 15))[0]
    assert sept["accueil"] == "periscolaire" and sept["horaires_vacances"] == JOURNEE, sept
    assert donnees.contrats()[0]["tarif_horaire"] == "4,00"      # sans date : le contrat initial

    # Échéances : congés payés de juin 2027 annoncés pour ce contrat passé à 43 semaines.
    ech = donnees.echeances(date(2026, 10, 1))
    assert any("Congés payés" in e["titre"] and "Petit" in e["detail"] for e in ech), ech
    assert not any("Congés payés" in e["titre"] for e in donnees.echeances(date(2026, 4, 1)) if e["date"] < "2027-01-01")

    # Impôts : en juin, journées de 9 h ; en octobre (périscolaire, 3 h par jour), journées courtes.
    juin = impots.proposition_mois(c, 2026, 6, None, 2)
    octobre = impots.proposition_mois(c, 2026, 10, None, 2)
    assert juin["jours_8h"] == 22 and juin["jours_courts"] == 0, juin
    assert octobre["jours_8h"] == 0 and octobre["jours_courts"] == round(22 * 43 / 52), octobre
    assert octobre["heures_courtes"] == octobre["jours_courts"] * 3, octobre
    # Familles employeurs : une fiche enfant sans fiche famille fait apparaître la famille (id vide).
    assert [(f["nom"], f["id"]) for f in donnees.familles()] == [("Petit", "")]
    fam = donnees.enregistrer_famille({"nom": "Petit", "parent1_civilite": "Mme", "parent1_prenom": "Claire",
                                       "parent1_nom": "Petit", "ville": "Nîmes"})
    assert [f["id"] for f in donnees.familles()] == [fam["id"]]
    assert donnees.nom_parents(fam) == "Mme Claire Petit"
    try:
        donnees.enregistrer_famille({"nom": "petit"})
        raise AssertionError("doublon accepté")
    except ValueError:
        pass
    # Changement de nom : les fiches enfants suivent.
    donnees.enregistrer_famille(fam | {"nom": "Petit-Durand"})
    assert donnees.contrats()[0]["famille"] == "Petit-Durand"
    try:
        donnees.supprimer_famille(fam["id"])
        raise AssertionError("famille supprimée malgré ses enfants")
    except ValueError:
        pass
    donnees.supprimer_contrat(c["id"])
    donnees.supprimer_famille(fam["id"])
    assert donnees.familles() == []
    # Lecture des bulletins : fiche créée pour une famille inconnue, champs vides complétés sans rien remplacer.
    lu = {"civilite": "Mme", "prenom": "Claire", "nom": "Martin", "adresse": "3 impasse des Tilleuls",
          "code_postal": "30000", "ville": "Nîmes", "numero_pajemploi": "Y0000000000001"}
    lignes = [{"famille": "Martin", "periode": "2026-05", "fiche_employeur": lu | {"ville": "Ancienne"}},
              {"famille": "Martin", "periode": "2026-06", "fiche_employeur": lu},
              {"famille": "Bernard", "periode": "2026-06", "fiche_employeur": lu | {"nom": "Bernard", "numero_pajemploi": "Y2"}}]
    donnees.enregistrer_famille({"nom": "Bernard", "parent1_prenom": "Julien", "parent1_nom": "Bernard", "ville": "Arles"})
    assert donnees.completer_familles(lignes) == ["Martin"]
    martin, bernard = (next(f for f in donnees.familles() if f["nom"] == n) for n in ("Martin", "Bernard"))
    assert martin["parent1_prenom"] == "Claire" and martin["ville"] == "Nîmes" and martin["numero_pajemploi"] == "Y0000000000001"
    assert bernard["parent1_prenom"] == "Julien" and bernard["ville"] == "Arles" and bernard["numero_pajemploi"] == "Y2", bernard
    assert not bernard["adresse"] and not bernard["code_postal"], bernard     # adresse déjà commencée : pas de mélange
    assert donnees.completer_familles(lignes) == []
    # Famille saisie à la main : elle porte le nom du parent qui gère le contrat (prénom ajouté si déjà pris).
    assert donnees.enregistrer_famille({"parent1_prenom": "Anne", "parent1_nom": "Durand"})["nom"] == "Durand"
    assert donnees.enregistrer_famille({"parent1_prenom": "Marc", "parent1_nom": "Durand"})["nom"] == "Durand Marc"
    try:
        donnees.enregistrer_famille({"parent1_prenom": "Sans nom"})
        raise AssertionError("famille sans nom acceptée")
    except ValueError:
        pass
    print("OK : familles employeurs")

    # Sites d'activités : proposés par défaut, liste enregistrée telle quelle (ordre), « https:// » ajouté.
    assert [x["nom"] for x in donnees.sites()][:2] == ["Pinterest", "Marmiton"]
    liste = donnees.enregistrer_sites([{"nom": "Momes", "url": "www.momes.net"}, {"nom": "Pinterest", "url": "https://www.pinterest.fr/"}])
    assert liste[0]["url"] == "https://www.momes.net" and [x["nom"] for x in donnees.sites()] == ["Momes", "Pinterest"]
    assert donnees.enregistrer_sites([]) == [] and donnees.sites() == []
    try:
        donnees.enregistrer_sites([{"nom": "", "url": "x"}])
        raise AssertionError("site sans nom accepté")
    except ValueError:
        pass
    assert len(donnees.enregistrer_sites(None)) == len(donnees.SITES_DEFAUT)
    print("OK : sites d'activités")
    print("OK : avenants (conditions en vigueur, échéances, jours de garde)")


if __name__ == "__main__":
    main()
