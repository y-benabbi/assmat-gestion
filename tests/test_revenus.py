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

# Même disposition que les bulletins Pajemploi actuels : deux rubriques sur la même ligne dans
# « Éléments pris en compte », cotisations salarié puis employeur, « Net payé en euros » en bas.
MODELE = """<html><body style="font-family:Arial;font-size:11px"><style>td{{white-space:nowrap}}</style>
<h1>BULLETIN DE SALAIRE</h1><p>Période du {periode}</p><p>Pour nous contacter</p><p>MADAME SOPHIE PETIT</p>
<p>Référence employeur</p><p>MADAME CLAIRE {nom}</p><p>12 RUE DES LILAS</p>
<table border="1">
<tr><td>Nombre de jours d'activité</td><td>{jours}</td><td>Nombre de jours de congés payés (a)</td><td>2,5</td></tr>
<tr><td>Nombre d'heures normales</td><td>{heures}</td><td>Salaire horaire net</td><td>4,10</td></tr>
<tr><td>Nombre d'heures complémentaires ou majorées</td><td>{hcomp}</td><td>Date de paiement du salaire</td>
<td>05/02/2026</td></tr>
</table>
<table border="1">
<tr><td>Salaire brut total (dont indemnités Fin de contrat soumises à cotisations*)</td><td colspan="4">{brut}</td></tr>
<tr><td>VIEILLESSE</td><td>{brut}</td><td>6,900</td><td>12,34</td><td>8,550</td><td>15,29</td></tr>
<tr><td>Montant total des cotisations</td><td></td><td></td><td>{cot}</td><td></td><td>{cot_emp}</td></tr>
<tr><td>Salaire net déclaré</td><td>{net}</td></tr>
<tr><td>Acompte</td><td>0,00</td></tr>
<tr><td>Indemnités d'entretien</td><td>{ent}</td></tr>
<tr><td>Frais de repas</td><td>{rep}</td></tr>
<tr><td>Indemnités kilométriques</td><td>0,00</td><td>CONGÉS PAYÉS PRIS</td></tr>
<tr><td>Indemnités de rupture</td><td>{rup}</td></tr>
<tr><td>Salaire net déclaré (y compris indemnités)</td><td>{net_ind}</td></tr>
<tr><td>Montant de l'exonération au titre des heures complémentaires et majorées</td><td>{exo}</td></tr>
<tr><td>Salaire net imposable (tenant compte de l'exonération fiscale)</td><td>{imp}</td></tr>
<tr><td>Net à payer avant l'impôt sur le revenu</td><td>{paye} €</td></tr>
<tr><td>Impôt sur le revenu prélevé à la source</td><td>0,00</td></tr>
<tr><td>Montant net social</td><td>{net} €</td><td>Net payé en euros</td><td>{paye} €</td></tr>
</table>
<p>* Éléments pris en compte pour le calcul du Salaire Brut Total</p>
<table border="1"><tr><td>Salaire net déclaré</td><td>{net}</td></tr></table></body></html>"""


def fr(v):
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")


def bulletin(page, chemin, nom, periode, brut, ent, rep, heures, jours, hcomp=0, exo=0.0, rup=0.0):
    """Fabrique un bulletin fictif ; renvoie (net, somme versée)."""
    cot = round(brut * 0.22, 2)
    net = round(brut - cot, 2)
    paye = round(net + ent + rep + rup + exo, 2)
    page.set_content(MODELE.format(nom=nom, periode=periode, heures=heures, hcomp=hcomp, jours=jours, brut=fr(brut),
                                   cot=fr(cot), cot_emp=fr(brut * 0.45), net=fr(net), ent=fr(ent), rep=fr(rep),
                                   rup=fr(rup), exo=fr(exo), net_ind=fr(net + ent + rep + rup), imp=fr(net + 20),
                                   paye=fr(paye)))
    chemin.parent.mkdir(parents=True, exist_ok=True)
    page.pdf(path=str(chemin))
    return net, paye


def main():
    dossier = Path(tempfile.mkdtemp()) / "Bulletins de salaire"
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        page = nav.new_page()
        net_dupont, paye_dupont = bulletin(page, dossier / "Dupont" / "Bulletin de salaire - Dupont - 2026-01.pdf",
                                           "DUPONT", "01/01/2026 au 31/01/2026", 1234.56, 63.0, 40.0, 120, 18,
                                           hcomp=6, exo=8.5)
        _, paye2 = bulletin(page, dossier / "Dupont" / "Bulletin de salaire - Dupont - 2026-02.pdf",
                            "DUPONT", "01/02/2026 au 28/02/2026", 1000.0, 60.0, 0.0, 100, 15)
        _, paye3 = bulletin(page, dossier / "2026" / "Martin" / "paje_bulletinsalaire Martin 01 2026.pdf",
                            "MARTIN", "01/01/2026 au 10/01/2026", 500.0, 30.0, 10.0, 50, 8, rup=120.0)
        bulletin(page, dossier / "Martin" / "Bulletin de salaire - Martin - 2025-12.pdf",
                 "MARTIN", "01/12/2025 au 31/12/2025", 480.0, 30.0, 10.0, 48, 8)
        nav.close()
    (dossier / "Dupont" / "illisible 2026-03.pdf").write_bytes(b"pas un pdf")

    # Lecture d'un texte de bulletin (montant renvoyé à la ligne suivante, espaces insécables)
    m = revenus.analyser_texte("Salaire brut\n1 234,56\nTotal des cotisations salariales 271,60\n"
                               "Indemnités d'entretien 63,00\nMontant net imposable 982,96")
    assert m["brut"] == 1234.56 and m["cotisations"] == 271.6 and m["net"] == 962.96, m
    assert m["entretien"] == 63.0 and m["net_imposable"] == 982.96, m

    # Texte tel que le donne un bulletin Pajemploi actuel (montants fictifs) : plusieurs nombres par ligne.
    m = revenus.analyser_texte(
        "Nombre de jours d'activité 12 Nombre de jours de congés payés (a) 15,0\n"
        "Nombre d'heures normales 201 Salaire horaire net 4,00\n"
        "Nombre d'heures complémentaires ou majorées 11 Date de paiement du salaire 16/07/2024\n"
        "Salaire brut total (dont indemnités Fin de contrat soumises à cotisations*) 1600,00\n"
        "Montant total des cotisations 350,00 700,00\nSalaire net déclaré 1250,00\nAcompte 0,00\n"
        "Indemnités d'entretien 80,00\nFrais de repas 0,00\nIndemnités kilométriques 0,00 CONGÉS PAYÉS PRIS\n"
        "Indemnités de rupture 25,00\nSalaire net déclaré (y compris indemnités) 1355,00 Du au\n"
        "Montant de l'exonération au titre des heures complémentaires et majorées 13,00\n"
        "Salaire net imposable (tenant compte de l'exonération fiscale) 1290,00\n"
        "Net à payer avant l'impôt sur le revenu 1368,00 €\n Impôt sur le revenu \nBase 1 290,00\n"
        "Impôt sur le revenu prélevé à la source 0,00\nMontant net social 1260,00 € Net payé en euros 1368,00 €\n"
        "Eléments de votre déclaration Fin de Contrat Montants nets déclarés\nSalaire net déclaré 900,00")
    attendu = {"jours": 12, "heures": 201, "heures_comp": 11, "brut": 1600, "cotisations": 350, "net": 1250,
               "entretien": 80, "rupture": 25, "exoneration": 13, "net_imposable": 1290, "net_paye": 1368,
               "encaisse": 1368, "impot": 0}
    assert all(m.get(k) == v for k, v in attendu.items()), m
    # Sans « Net payé en euros » : somme reconstituée (net + indemnités + exonération).
    m = revenus.analyser_texte("Salaire net déclaré 1250,00\nIndemnités d'entretien 80,00\n"
                               "Indemnités de rupture 25,00\nMontant de l'exonération au titre des heures 13,00")
    assert m["encaisse"] == 1368, m
    # Libellé coupé sur deux lignes : la suite commence par une minuscule ; « Base » n'en est pas une.
    m = revenus.analyser_texte("Salaire net imposable (tenant compte de l'exonération\nfiscale) 1290,00\n"
                               " Impôt sur le revenu \nBase 1 290,00\nImpôt sur le revenu prélevé à la source 0,00")
    assert m["net_imposable"] == 1290 and m["impot"] == 0, m

    lignes = revenus.releve(str(dossier))
    assert len(lignes) == 5, lignes
    lu = {(l["famille"], l["periode"]): l for l in lignes}
    d = lu[("Dupont", "2026-01")]["montants"]
    assert d["brut"] == 1234.56 and d["net"] == net_dupont and d["entretien"] == 63.0 and d["repas"] == 40.0, d
    assert d["heures"] == 120 and d["heures_comp"] == 6 and d["jours"] == 18, d
    assert d["cotisations"] == round(1234.56 * 0.22, 2) and d["exoneration"] == 8.5 and d["encaisse"] == paye_dupont, d
    # Nom du parent : bloc « Référence employeur », pas celui de l'assistante maternelle juste avant.
    assert lu[("Dupont", "2026-01")]["employeur"] == "Mme Claire Dupont", lu[("Dupont", "2026-01")]
    assert lu[("Martin", "2026-01")]["montants"]["rupture"] == 120.0
    assert lu[("Martin", "2026-01")]["montants"]["brut"] == 500.0
    assert not lu[("Dupont", "2026-03")]["lu"]

    t = revenus.totaux(lignes, "2026")
    assert t["annees"] == ["2026", "2025"], t["annees"]
    g = t["general"]
    assert g["bulletins"] == 4 and g["illisibles"] == 1, g
    assert round(g["brut"], 2) == 2734.56, g
    assert round(g["indemnites"], 2) == 203.0, g
    assert g["encaisse"] == round(paye_dupont + paye2 + paye3, 2), g
    assert g["encaisse"] == round(g["net"] + 203.0 + 120.0 + 8.5, 2), g
    assert g["heures"] == 120 + 6 + 100 + 50, g
    assert list(t["familles"]) == ["Dupont", "Martin"], t["familles"]
    assert t["mois"]["01"]["bulletins"] == 2 and t["mois"]["02"]["brut"] == 1000.0
    assert len(t["illisibles"]) == 1

    # Module pypdf absent (mise à jour incomplète) : signalé, et rien n'est gardé en cache.
    vrai_lire = revenus.lire_texte_pdf

    def sans_pypdf(chemin):
        raise ModuleNotFoundError("No module named 'pypdf'")
    revenus.lire_texte_pdf = sans_pypdf
    autre = dossier / "Durand" / "Bulletin de salaire - Durand - 2026-01.pdf"
    autre.parent.mkdir()
    autre.write_bytes((dossier / "Dupont" / "Bulletin de salaire - Dupont - 2026-02.pdf").read_bytes())
    t = revenus.totaux(revenus.releve(str(dossier)), "2026")
    assert t["module_absent"] and len(t["illisibles"]) == 2, t["illisibles"]
    revenus.lire_texte_pdf = vrai_lire
    t = revenus.totaux(revenus.releve(str(dossier)), "2026")
    assert not t["module_absent"] and len(t["illisibles"]) == 1, t["illisibles"]

    # Cache laissé par une version précédente sans pypdf : l'erreur est oubliée, le bulletin relu.
    import json
    cache = json.loads(revenus.FICHIER_CACHE.read_text(encoding="utf-8"))
    cle = next(c for c in cache if "Durand" in c)
    cache[cle] = {"montants": {}, "lu": False, "erreur": "No module named 'pypdf'"}
    revenus.FICHIER_CACHE.write_text(json.dumps(cache), encoding="utf-8")
    t = revenus.totaux(revenus.releve(str(dossier)), "2026")
    assert len(t["illisibles"]) == 1, t["illisibles"]

    # Deuxième lecture : tout vient du fichier de cache.
    revenus.lire_texte_pdf = lambda chemin: (_ for _ in ()).throw(AssertionError("relu"))
    assert len(revenus.releve(str(dossier))) == 6
    print("OK : lecture des bulletins et totaux du tableau de bord")


if __name__ == "__main__":
    main()
