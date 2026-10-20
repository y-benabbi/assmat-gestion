"""Aide à la déclaration de revenus d'une assistante maternelle agréée.

Deux façons de déclarer (article 80 sexies du Code général des impôts, notice impots.gouv.fr) :

1. Régime spécifique : revenu imposable = net imposable + indemnités d'entretien et de repas
   - abattement. L'abattement se compte par enfant et par jour de garde :
     - journée de 8 heures ou plus : 3 × SMIC horaire ;
     - journée de moins de 8 heures : 3 × SMIC horaire ÷ 8 × nombre d'heures de garde ;
     - enfant handicapé, malade ou inadapté (abattement majoré) : 4 × SMIC au lieu de 3 ;
     - garde de 24 heures consécutives : 1 × SMIC de plus pour la journée.
   Le SMIC retenu est celui en vigueur le mois de la garde (deux montants si le SMIC change dans
   l'année). Le résultat ne peut pas être négatif : il est ramené à zéro, famille par famille.
2. Régime classique : le net imposable, diminué de la déduction forfaitaire de 10 % pour frais
   (avec un minimum et un maximum fixés chaque année). Les indemnités d'entretien et de repas ne
   sont alors pas imposées.

Les jours de garde ne figurent pas tous sur les bulletins : l'application les propose à partir
du bulletin (jours d'activité) et de l'emploi du temps de la fiche enfant, puis l'assistante
maternelle les confirme ou les corrige mois par mois. Les confirmations sont gardées dans
donnees\\impots.json (données personnelles : jamais dans le dépôt).
"""
import calendar
import json
import re
import threading
from datetime import date

import donnees
from chemins import DOSSIER_DONNEES

FICHIER_JOURS = DOSSIER_DONNEES / "impots.json"

# SMIC horaire brut : (date d'effet, montant en euros). Source : arrêtés et décrets de
# revalorisation publiés au Journal officiel (service-public.fr). Ajouter chaque revalorisation.
SMIC_HORAIRE = [
    ("2019-01-01", 10.03), ("2020-01-01", 10.15), ("2021-01-01", 10.25), ("2021-10-01", 10.48),
    ("2022-01-01", 10.57), ("2022-05-01", 10.85), ("2022-08-01", 11.07), ("2023-01-01", 11.27),
    ("2023-05-01", 11.52), ("2024-01-01", 11.65), ("2024-11-01", 11.88), ("2026-01-01", 12.02),
    ("2026-06-01", 12.31),
]

# Déduction forfaitaire de 10 % (régime classique) : minimum et maximum par année de revenus.
# Source : impots.gouv.fr (barème de l'impôt sur le revenu). À compléter chaque année.
DEDUCTION_10 = {
    2022: (448, 13522), 2023: (472, 14171), 2024: (495, 14171), 2025: (504, 14426),
}

_verrou = threading.Lock()


def smic(annee: int, mois: int) -> float:
    """SMIC horaire en vigueur le 1er du mois (les revalorisations prennent effet un 1er)."""
    jour = f"{annee:04d}-{mois:02d}-01"
    valeur = SMIC_HORAIRE[0][1]
    for debut, montant in SMIC_HORAIRE:
        if debut <= jour:
            valeur = montant
    return valeur


def deduction_10(annee: int, net_imposable: float) -> float:
    mini, maxi = DEDUCTION_10.get(annee) or DEDUCTION_10[max(DEDUCTION_10)]
    if net_imposable <= 0:
        return 0.0
    return round(min(max(net_imposable * 0.10, mini), maxi, net_imposable), 2)


# ------------------------------------------------------------------ emplois du temps
RE_PLAGE = re.compile(r"(\d{1,2})\s*[h:]\s*(\d{0,2})\s*[-–à]+\s*(\d{1,2})\s*[h:]\s*(\d{0,2})")


def duree(texte: str) -> float:
    """Durée en heures d'un horaire « 8h00-17h30 », « 8h-12h / 13h30-17h » (plusieurs plages)."""
    total = 0.0
    for h1, m1, h2, m2 in RE_PLAGE.findall(texte or ""):
        debut, fin = int(h1) + int(m1 or 0) / 60, int(h2) + int(m2 or 0) / 60
        if fin > debut:
            total += fin - debut
    return round(total, 2)


def proposition_mois(contrat: dict, annee: int, mois: int, jours_bulletin, enfants_famille: int) -> dict:
    """Jours de garde proposés pour un enfant et un mois.

    - Nombre de jours : celui du bulletin (« jours d'activité ») si la famille n'a qu'un enfant
      accueilli ; sinon les jours prévus par l'emploi du temps, ramenés au nombre de semaines
      d'accueil par an (46 semaines sur 52, par exemple).
    - Répartition entre journées de 8 heures ou plus et journées plus courtes : d'après
      l'emploi du temps de la fiche.
    """
    horaires = contrat.get("horaires_scolaire") or {}
    durees = {j: duree(horaires.get(j, "")) for j in donnees.JOURS}
    premier, dernier = date(annee, mois, 1), date(annee, mois, calendar.monthrange(annee, mois)[1])
    debut = date.fromisoformat(contrat["debut"]) if contrat.get("debut") else premier
    fin = date.fromisoformat(contrat["fin"]) if contrat.get("fin") else dernier
    longs = courts = 0
    heures_courtes = 0.0
    for n in range(1, dernier.day + 1):
        d = date(annee, mois, n)
        h = durees[donnees.JOURS[d.weekday()]]
        if not h or not (debut <= d <= fin):
            continue
        if h >= 8:
            longs += 1
        else:
            courts += 1
            heures_courtes += h
    prevus = longs + courts
    try:
        semaines = min(int(contrat.get("semaines") or 52), 52)
    except ValueError:
        semaines = 52
    if jours_bulletin and enfants_famille == 1:
        # En année complète, les jours d'activité du bulletin comptent aussi les congés payés :
        # on ne propose jamais plus de jours que l'emploi du temps n'en prévoit dans le mois.
        total, source = int(round(jours_bulletin)), "bulletin"
        if prevus and total > prevus:
            total, source = prevus, "bulletin, limité à l'emploi du temps"
    else:
        total, source = int(round(prevus * semaines / 52)), "emploi du temps"
    if not prevus:
        return {"jours_8h": total, "jours_courts": 0, "heures_courtes": 0.0, "jours_24h": 0,
                "source": source if total else "aucun accueil prévu"}
    part_longs = longs / prevus
    jours_8h = int(round(total * part_longs))
    jours_courts = total - jours_8h
    moyenne = heures_courtes / courts if courts else 0.0
    return {"jours_8h": jours_8h, "jours_courts": jours_courts,
            "heures_courtes": round(jours_courts * moyenne, 2), "jours_24h": 0, "source": source}


# ------------------------------------------------------------------ confirmations
def _lire() -> dict:
    try:
        return json.loads(FICHIER_JOURS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def confirmer(annee: str, contrat_id: str, mois: str, valeurs) -> dict:
    """Enregistre (ou efface, si valeurs est None) les jours confirmés d'un enfant pour un mois."""
    with _verrou:
        tout = _lire()
        enfant = tout.setdefault(annee, {}).setdefault(contrat_id, {})
        if valeurs is None:
            enfant.pop(mois, None)
        else:
            propre = {}
            for cle in ("jours_8h", "jours_courts", "jours_24h"):
                propre[cle] = max(0, int(float(valeurs.get(cle) or 0)))
            propre["heures_courtes"] = max(0.0, round(float(valeurs.get("heures_courtes") or 0), 2))
            enfant[mois] = propre
        FICHIER_JOURS.write_text(json.dumps(tout, ensure_ascii=False, indent=2), encoding="utf-8")
    return tout


# ------------------------------------------------------------------ calcul de l'année
def calculer(annee: str, lignes_bulletins: list) -> dict:
    """Calcul complet de l'année : par famille, par enfant et par mois, et comparaison des régimes.

    lignes_bulletins : revenus.releve(...) (un élément par bulletin : famille, periode, montants).
    """
    a = int(annee)
    contrats = donnees.contrats()
    confirmes = _lire().get(annee, {})
    bulletins = [l for l in lignes_bulletins if l["periode"].startswith(annee)]

    # Revenus de l'année par famille, lus dans les bulletins.
    familles = {}
    for l in bulletins:
        m = l["montants"]
        f = familles.setdefault(l["famille"], {"net_imposable": 0.0, "entretien": 0.0, "repas": 0.0,
                                                "bulletins": 0, "jours_bulletin": {}, "heures_bulletin": {}})
        f["bulletins"] += 1
        f["net_imposable"] += m.get("net_imposable") or m.get("net") or 0.0
        f["entretien"] += m.get("entretien") or 0.0
        f["repas"] += m.get("repas") or 0.0
        mois = l["periode"][5:7]
        if m.get("jours"):
            f["jours_bulletin"][mois] = f["jours_bulletin"].get(mois, 0) + m["jours"]
        heures = (m.get("heures") or 0.0) + (m.get("heures_comp") or 0.0)
        if heures:
            f["heures_bulletin"][mois] = f["heures_bulletin"].get(mois, 0) + heures

    # Enfants rattachés à chaque famille (fiche contrat, même nom de famille que le dossier).
    def cle(nom):
        return re.sub(r"\s+", " ", (nom or "").strip().lower())

    enfants_par_famille = {}
    for c in contrats:
        enfants_par_famille.setdefault(cle(c.get("famille")), []).append(c)

    resultat_familles = []
    for nom, f in sorted(familles.items()):
        enfants = []
        abattement_famille = 0.0
        liste = enfants_par_famille.get(cle(nom), [])
        for c in liste:
            majore = (c.get("abattement_majore") or "") in ("1", "true", "oui")
            nb_smic = 4 if majore else 3
            mois_detail = []
            total_enfant = 0.0
            for m in range(1, 13):
                mm = f"{m:02d}"
                periode = f"{annee}-{mm}"
                actif = (not c.get("debut") or c["debut"][:7] <= periode) and (not c.get("fin") or c["fin"][:7] >= periode)
                bulletin = any(l["famille"] == nom and l["periode"] == periode for l in bulletins)
                if not (actif and bulletin):
                    continue
                actifs_mois = [x for x in liste if (not x.get("debut") or x["debut"][:7] <= periode)
                               and (not x.get("fin") or x["fin"][:7] >= periode)]
                proposition = proposition_mois(c, a, m, f["jours_bulletin"].get(mm), len(actifs_mois))
                valeurs = confirmes.get(c["id"], {}).get(mm)
                j = valeurs or proposition
                s = smic(a, m)
                montant = (j["jours_8h"] * nb_smic * s
                           + j["heures_courtes"] * nb_smic * s / 8
                           + j["jours_24h"] * s)
                montant = round(montant, 2)
                total_enfant += montant
                mois_detail.append({"mois": mm, "smic": s, "proposition": proposition, "confirme": bool(valeurs),
                                    "jours": j, "jours_bulletin": f["jours_bulletin"].get(mm),
                                    "heures_bulletin": f["heures_bulletin"].get(mm),
                                    "abattement": montant})
            abattement_famille += total_enfant
            enfants.append({"id": c["id"], "prenom": c.get("enfant_prenom") or "", "majore": majore,
                            "abattement": round(total_enfant, 2), "mois": mois_detail,
                            "a_confirmer": sum(1 for x in mois_detail if not x["confirme"])})
        revenus = f["net_imposable"] + f["entretien"] + f["repas"]
        imposable = max(0.0, revenus - abattement_famille)
        resultat_familles.append({
            "famille": nom, "bulletins": f["bulletins"], "net_imposable": round(f["net_imposable"], 2),
            "indemnites": round(f["entretien"] + f["repas"], 2), "revenus": round(revenus, 2),
            "abattement": round(abattement_famille, 2), "imposable": round(imposable, 2),
            "enfants": enfants, "sans_fiche": not liste,
        })

    net_total = sum(f["net_imposable"] for f in resultat_familles)
    specifique = round(sum(f["imposable"] for f in resultat_familles), 2)
    deduction = deduction_10(a, net_total)
    classique = round(net_total - deduction, 2)
    smics = sorted({x["smic"] for f in resultat_familles for e in f["enfants"] for x in e["mois"]})
    return {
        "annee": annee,
        "familles": resultat_familles,
        "total": {
            "net_imposable": round(net_total, 2),
            "indemnites": round(sum(f["indemnites"] for f in resultat_familles), 2),
            "revenus": round(sum(f["revenus"] for f in resultat_familles), 2),
            "abattement": round(sum(f["abattement"] for f in resultat_familles), 2),
            "specifique": specifique,
            "deduction_10": deduction,
            "classique": classique,
            "meilleur": "specifique" if specifique <= classique else "classique",
            "ecart": round(abs(classique - specifique), 2),
        },
        "smic_utilises": smics,
        "a_confirmer": sum(e["a_confirmer"] for f in resultat_familles for e in f["enfants"]),
        "sans_fiche": [f["famille"] for f in resultat_familles if f["sans_fiche"]],
        "bareme_deduction_connu": a in DEDUCTION_10,
    }


def bareme() -> dict:
    """Barèmes utilisés, pour la page « À propos »."""
    return {"smic": [{"depuis": d, "montant": m} for d, m in SMIC_HORAIRE],
            "deduction_10": [{"annee": a, "minimum": mi, "maximum": ma} for a, (mi, ma) in sorted(DEDUCTION_10.items())]}
