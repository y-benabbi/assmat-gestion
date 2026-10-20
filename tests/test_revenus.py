"""Teste la lecture des montants dans des bulletins PDF fictifs et les totaux du tableau de bord.

Les PDF sont fabriqués par Chromium à partir d'une page qui imite la présentation d'un bulletin
Pajemploi (noms fictifs)."""
import os
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ.setdefault("ASSMAT_BASE", tempfile.mkdtemp())
sys.path.insert(0, str(ICI.parent / "app"))

from playwright.sync_api import sync_playwright  # noqa: E402

import revenus  # noqa: E402

MODELE = """<html><body style="font-family:Arial">
<h1>Bulletin de salaire</h1><p>Employeur : M. {nom} JEAN</p><p>Période d'emploi : {mois}</p>
<table>
<tr><td>Nombre d'heures normales</td><td>{heures}</td></tr>
<tr><td>Nombre de jours d'activité</td><td>{jours}</td></tr>
<tr><td>Salaire brut</td><td>{brut}</td></tr>
<tr><td>Total des cotisations et contributions salariales</td><td>{cot}</td></tr>
<tr><td>Salaire net</td><td>{net}</td></tr>
<tr><td>Indemnités d'entretien</td><td>{ent}</td></tr>
<tr><td>Indemnités de repas</td><td>{rep}</td></tr>
<tr><td>Net à payer avant impôt sur le revenu</td><td>{payer}</td></tr>
<tr><td>Montant net imposable</td><td>{imp}</td></tr>
</table></body></html>"""


def fr(v):
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")


def bulletin(page, chemin, nom, mois, brut, ent, rep, heures, jours):
    cot = round(brut * 0.22, 2)
    net = round(brut - cot, 2)
    page.set_content(MODELE.format(nom=nom, mois=mois, heures=fr(heures), jours=jours, brut=fr(brut), cot=fr(cot),
                                   net=fr(net), ent=fr(ent), rep=fr(rep), payer=fr(net + ent + rep), imp=fr(net + 20)))
    chemin.parent.mkdir(parents=True, exist_ok=True)
    page.pdf(path=str(chemin))
    return net


def main():
    dossier = Path(tempfile.mkdtemp()) / "Bulletins de salaire"
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        page = nav.new_page()
        net_dupont = bulletin(page, dossier / "Dupont" / "Bulletin de salaire - Dupont - 2026-01.pdf",
                              "DUPONT", "janvier 2026", 1234.56, 63.0, 40.0, 120, 18)
        bulletin(page, dossier / "Dupont" / "Bulletin de salaire - Dupont - 2026-02.pdf",
                 "DUPONT", "février 2026", 1000.0, 60.0, 0.0, 100, 15)
        bulletin(page, dossier / "2026" / "Martin" / "paje_bulletinsalaire Martin 01 2026.pdf",
                 "MARTIN", "janvier 2026", 500.0, 30.0, 10.0, 50, 8)
        bulletin(page, dossier / "Martin" / "Bulletin de salaire - Martin - 2025-12.pdf",
                 "MARTIN", "décembre 2025", 480.0, 30.0, 10.0, 48, 8)
        nav.close()
    (dossier / "Dupont" / "illisible 2026-03.pdf").write_bytes(b"pas un pdf")

    # Lecture d'un texte de bulletin (montant renvoyé à la ligne suivante, espaces insécables)
    m = revenus.analyser_texte("Salaire brut\n1 234,56\nTotal des cotisations salariales 271,60\n"
                               "Indemnités d'entretien 63,00\nMontant net imposable 982,96")
    assert m["brut"] == 1234.56 and m["cotisations"] == 271.6 and m["net"] == 962.96, m
    assert m["entretien"] == 63.0 and m["net_imposable"] == 982.96, m

    lignes = revenus.releve(str(dossier))
    assert len(lignes) == 5, lignes
    lu = {(l["famille"], l["periode"]): l for l in lignes}
    d = lu[("Dupont", "2026-01")]["montants"]
    assert d["brut"] == 1234.56 and d["net"] == net_dupont and d["entretien"] == 63.0 and d["repas"] == 40.0, d
    assert d["heures"] == 120 and d["jours"] == 18, d
    assert lu[("Martin", "2026-01")]["montants"]["brut"] == 500.0
    assert not lu[("Dupont", "2026-03")]["lu"]

    t = revenus.totaux(lignes, "2026")
    assert t["annees"] == ["2026", "2025"], t["annees"]
    g = t["general"]
    assert g["bulletins"] == 4 and g["illisibles"] == 1, g
    assert round(g["brut"], 2) == 2734.56, g
    assert round(g["indemnites"], 2) == 203.0, g
    assert round(g["encaisse"], 2) == round(g["net"] + 203.0, 2), g
    assert list(t["familles"]) == ["Dupont", "Martin"], t["familles"]
    assert t["mois"]["01"]["bulletins"] == 2 and t["mois"]["02"]["brut"] == 1000.0
    assert len(t["illisibles"]) == 1

    # Deuxième lecture : tout vient du fichier de cache.
    revenus.lire_texte_pdf = lambda chemin: (_ for _ in ()).throw(AssertionError("relu"))
    assert len(revenus.releve(str(dossier))) == 5
    print("OK : lecture des bulletins et totaux du tableau de bord")


if __name__ == "__main__":
    main()
