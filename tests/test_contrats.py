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
            {"date": "2026-09-01", "motif": "Passage en accueil périscolaire", "semaines": "46",
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

    # Échéances : congés payés de juin 2027 annoncés pour ce contrat passé à 46 semaines.
    ech = donnees.echeances(date(2026, 10, 1))
    assert any("Congés payés" in e["titre"] and "Petit" in e["detail"] for e in ech), ech
    assert not any("Congés payés" in e["titre"] for e in donnees.echeances(date(2026, 4, 1)) if e["date"] < "2027-01-01")

    # Impôts : en juin, journées de 9 h ; en octobre (périscolaire, 3 h par jour), journées courtes.
    juin = impots.proposition_mois(c, 2026, 6, None, 2)
    octobre = impots.proposition_mois(c, 2026, 10, None, 2)
    assert juin["jours_8h"] == 22 and juin["jours_courts"] == 0, juin
    assert octobre["jours_8h"] == 0 and octobre["jours_courts"] == round(22 * 46 / 52), octobre
    assert octobre["heures_courtes"] == octobre["jours_courts"] * 3, octobre
    print("OK : avenants (conditions en vigueur, échéances, jours de garde)")


if __name__ == "__main__":
    main()
