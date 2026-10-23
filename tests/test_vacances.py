"""Vacances scolaires : lecture du calendrier officiel (réponse imitée, aucune connexion), jours de vacances, dates
gardées sur l'ordinateur quand Internet manque, horaires de vacances pour les photos."""
import os
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ["ASSMAT_BASE"] = tempfile.mkdtemp(prefix="assmat-vacances-")
sys.path.insert(0, str(ICI.parent / "app"))

import parametres  # noqa: E402
import courriers  # noqa: E402
import photos  # noqa: E402
import vacances  # noqa: E402

# Extrait du calendrier officiel (mêmes champs et mêmes heures : minuit à Paris écrit en UTC).
LIGNES = [
    {"description": "Vacances de la Toussaint", "population": "-", "start_date": "2026-10-16T22:00:00+00:00",
     "end_date": "2026-11-01T23:00:00+00:00", "annee_scolaire": "2026-2027"},
    {"description": "Vacances de la Toussaint", "population": "Élèves", "start_date": "2026-10-16T22:00:00+00:00",
     "end_date": "2026-11-01T23:00:00+00:00", "annee_scolaire": "2026-2027"},
    {"description": "Vacances de Noël", "population": "-", "start_date": "2026-12-18T23:00:00+00:00",
     "end_date": "2027-01-03T23:00:00+00:00", "annee_scolaire": "2026-2027"},
    {"description": "Pré-rentrée", "population": "Enseignants", "start_date": "2026-08-30T22:00:00+00:00",
     "end_date": "2026-08-31T22:00:00+00:00", "annee_scolaire": "2026-2027"},
    {"description": "Vacances d'Été", "population": "-", "start_date": "2027-07-02T22:00:00+00:00",
     "end_date": None, "annee_scolaire": "2026-2027"},
]


def main():
    periodes = vacances.periodes_depuis(LIGNES)
    assert [p["nom"] for p in periodes] == ["Vacances de la Toussaint", "Vacances de Noël", "Vacances d'Été"], periodes
    assert periodes[0] == {"nom": "Vacances de la Toussaint", "debut": "2026-10-17", "fin": "2026-11-02"}, periodes[0]
    assert periodes[2]["fin"] == "2027-09-03", "été sans date de reprise : 2 mois au plus"
    ev = lambda j: vacances.en_vacances(date.fromisoformat(j), periodes)  # noqa: E731
    assert ev("2026-10-16") is False and ev("2026-10-17") and ev("2026-11-01") and ev("2026-11-02") is False
    assert ev("2026-12-25") and ev("2025-12-25") is None and ev("2028-01-10") is None
    print("calendrier : périodes, jours de vacances, jour de la reprise")

    # Sans académie : rien, et aucune requête.
    vacances._telecharger = lambda a: (_ for _ in ()).throw(AssertionError("requête sans académie"))
    assert vacances.etat()["periodes"] == [] and vacances.en_vacances(date(2026, 10, 20)) is None

    appels = []
    vacances._telecharger = lambda a: appels.append(a) or vacances.periodes_depuis(LIGNES)
    parametres.enregistrer({"academie": "Rennes"})
    e = vacances.etat()
    assert e["zone"] == "Zone B" and len(e["periodes"]) == 3 and not e["erreur"] and appels == ["Rennes"], e
    vacances.etat()
    assert appels == ["Rennes"], "dates gardées une semaine"
    assert vacances.en_vacances(date(2026, 10, 20)) is True

    # Internet coupé : on garde les dates déjà connues, avec un message.
    vacances._telecharger = lambda a: (_ for _ in ()).throw(OSError("pas de réseau"))
    e = vacances.etat(forcer=True)
    assert len(e["periodes"]) == 3 and "injoignable" in e["erreur"], e
    # Autre académie injoignable : pas les dates de la précédente.
    parametres.enregistrer({"academie": "Paris"})
    assert vacances.etat()["periodes"] == []
    parametres.enregistrer({"academie": "Rennes"})
    print("dates gardées sur l'ordinateur, Internet coupé, changement d'académie")

    # Photos : un enfant aux horaires différents pendant les vacances n'est proposé qu'aux horaires de la période.
    contrat = {"id": "e1", "debut": "2026-09-01", "horaires_scolaire": {"mardi": "16h30-18h30"},
               "horaires_vacances": {"mardi": "8h00-17h00"}}
    vacances._telecharger = lambda a: vacances.periodes_depuis(LIGNES)
    vacances.etat(forcer=True)
    assert photos.presents(datetime(2026, 10, 20, 10, 0), [contrat], 0) == ["e1"], "mardi des vacances, le matin"
    assert photos.presents(datetime(2026, 10, 13, 10, 0), [contrat], 0) == [], "mardi d'école, le matin"
    assert photos.presents(datetime(2026, 10, 13, 17, 0), [contrat], 0) == ["e1"]
    print("photos : horaires de la période (école ou vacances)")
    # Courriers : périodes de l'académie, fin = veille de la reprise, coupées aux dates demandées.
    assert courriers.vacances_academie(date(2026, 10, 20), date(2026, 12, 31)) == [
        {"nom": "Vacances de la Toussaint", "debut": "2026-10-20", "fin": "2026-11-01"},
        {"nom": "Vacances de Noël", "debut": "2026-12-19", "fin": "2026-12-31"}]
    print("courriers : vacances de l'académie")
    print("vacances OK")


if __name__ == "__main__":
    main()
