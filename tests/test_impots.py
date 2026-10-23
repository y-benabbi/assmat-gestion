"""Teste l'aide à la déclaration de revenus : barème du SMIC, jours de garde proposés,
confirmations mois par mois, abattement et comparaison avec le régime classique (données fictives)."""
import os
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ["ASSMAT_BASE"] = tempfile.mkdtemp()
sys.path.insert(0, str(ICI.parent / "app"))

import donnees  # noqa: E402
import impots  # noqa: E402

SEMAINE = {j: "8h00-17h00" for j in donnees.JOURS[:5]}        # 9 h par jour


def bulletin(famille, periode, net_imposable, entretien, repas, jours=None, heures=None):
    m = {"net_imposable": net_imposable, "entretien": entretien, "repas": repas}
    if jours is not None:
        m["jours"] = jours
    if heures is not None:
        m["heures"] = heures
    return {"famille": famille, "periode": periode, "fichier": f"{famille}-{periode}.pdf", "lu": True, "montants": m}


def main():
    # Barèmes
    assert impots.smic(2025, 12) == 11.88 and impots.smic(2026, 5) == 12.02 and impots.smic(2026, 6) == 12.31
    assert impots.duree("8h00-17h30") == 9.5 and impots.duree("8h-12h / 13h30-17h") == 7.5 and impots.duree("") == 0
    assert impots.deduction_10(2025, 1000) == 504 and impots.deduction_10(2025, 300000) == 14426
    assert impots.deduction_10(2025, 20000) == 2000

    # Proposition : mai 2026 compte 21 jours ouvrés (lundi à vendredi).
    c = {"horaires_scolaire": SEMAINE, "semaines": "52"}
    p = impots.proposition_mois(c, 2026, 5, None, 1)
    assert p == {"jours_8h": 21, "jours_courts": 0, "heures_courtes": 0.0, "jours_24h": 0, "source": "emploi du temps"}, p
    # Accueil prévu sur 6 mois, toutes les semaines : tous les jours prévus du mois (pas 26 ÷ 52).
    court = {"horaires_scolaire": SEMAINE, "semaines": "26", "duree_courte": "oui", "debut": "2026-03-01", "fin": "2026-08-31"}
    assert impots.proposition_mois(court, 2026, 5, None, 2)["jours_8h"] == 21
    assert impots.proposition_mois({**court, "semaines": "13"}, 2026, 5, None, 2)["jours_8h"] == 10
    p = impots.proposition_mois(c, 2026, 5, 18, 1)
    assert p["jours_8h"] == 18 and p["source"] == "bulletin", p
    p = impots.proposition_mois(c, 2026, 5, 35, 1)       # jours d'activité avec congés payés : limité
    assert p["jours_8h"] == 21 and "limité" in p["source"], p
    mixte = {"horaires_scolaire": {"lundi": "8h00-17h00", "mercredi": "8h00-12h00"}, "semaines": "46"}
    p = impots.proposition_mois(mixte, 2026, 5, None, 2)  # 4 lundis + 4 mercredis, × 46/52
    assert p["jours_8h"] + p["jours_courts"] == 7 and p["heures_courtes"] == p["jours_courts"] * 4, p

    # Fiches et bulletins fictifs
    lea = donnees.enregistrer_contrat({"famille": "Dupont", "enfant_prenom": "Léa", "debut": "2025-01-01",
                                       "horaires_scolaire": SEMAINE})
    hugo = donnees.enregistrer_contrat({"famille": "Martin", "enfant_prenom": "Hugo", "debut": "2025-01-01",
                                        "horaires_scolaire": SEMAINE, "abattement_majore": "oui"})
    jade = donnees.enregistrer_contrat({"famille": "Martin", "enfant_prenom": "Jade", "debut": "2025-01-01",
                                        "horaires_scolaire": {"mercredi": "8h00-12h00"}})
    lignes = [bulletin("Dupont", "2026-05", 800.0, 70.0, 30.0, jours=20),
              bulletin("Dupont", "2026-06", 800.0, 70.0, 30.0, jours=20),
              bulletin("Martin", "2026-06", 900.0, 80.0, 40.0, jours=26),
              bulletin("Durand", "2026-06", 300.0, 20.0, 0.0),           # famille sans fiche
              bulletin("Dupont", "2025-12", 700.0, 60.0, 20.0, jours=18)]  # autre année : ignorée
    r = impots.calculer("2026", lignes)
    dupont = next(f for f in r["familles"] if f["famille"] == "Dupont")
    assert dupont["revenus"] == 1800.0, dupont
    mai, juin = dupont["enfants"][0]["mois"]
    assert mai["smic"] == 12.02 and juin["smic"] == 12.31, (mai, juin)
    assert mai["jours"]["jours_8h"] == 20 and mai["abattement"] == round(20 * 3 * 12.02, 2), mai
    assert dupont["abattement"] == round(20 * 3 * 12.02 + 20 * 3 * 12.31, 2), dupont
    assert dupont["imposable"] == round(1800 - dupont["abattement"], 2) if dupont["abattement"] < 1800 else 0

    martin = next(f for f in r["familles"] if f["famille"] == "Martin")
    h = next(e for e in martin["enfants"] if e["prenom"] == "Hugo")
    j = next(e for e in martin["enfants"] if e["prenom"] == "Jade")
    assert h["majore"] and not j["majore"]
    # Deux enfants : jours du bulletin non utilisés, emploi du temps (juin 2026 : 22 jours ouvrés, 4 mercredis)
    assert h["mois"][0]["jours"]["jours_8h"] == 22 and h["mois"][0]["abattement"] == round(22 * 4 * 12.31, 2), h
    assert j["mois"][0]["jours"]["heures_courtes"] == 16.0, j
    assert j["mois"][0]["abattement"] == round(16 * 3 * 12.31 / 8, 2), j
    assert martin["imposable"] == 0.0                       # jamais négatif
    assert r["sans_fiche"] == ["Durand"], r["sans_fiche"]
    assert r["a_confirmer"] == 4, r["a_confirmer"]

    # Confirmation d'un mois : elle remplace la proposition.
    impots.confirmer("2026", lea["id"], "05", {"jours_8h": "15", "jours_courts": "2", "heures_courtes": "9",
                                               "jours_24h": "1"})
    r = impots.calculer("2026", lignes)
    mai = next(f for f in r["familles"] if f["famille"] == "Dupont")["enfants"][0]["mois"][0]
    assert mai["confirme"] and mai["jours"]["jours_8h"] == 15, mai
    assert mai["abattement"] == round(15 * 3 * 12.02 + 9 * 3 * 12.02 / 8 + 1 * 12.02, 2), mai
    assert r["a_confirmer"] == 3
    impots.confirmer("2026", lea["id"], "05", None)
    assert impots.calculer("2026", lignes)["a_confirmer"] == 4

    # Comparaison des régimes
    t = r["total"]
    assert t["classique"] == round(t["net_imposable"] - impots.deduction_10(2026, t["net_imposable"]), 2)
    assert t["meilleur"] in ("specifique", "classique") and t["ecart"] == round(abs(t["classique"] - t["specifique"]), 2)
    assert t["specifique"] == round(sum(f["imposable"] for f in r["familles"]), 2)
    print("OK : impôts (SMIC, jours proposés et confirmés, abattement, comparaison des régimes)")


if __name__ == "__main__":
    main()
