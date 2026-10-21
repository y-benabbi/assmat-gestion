"""Contrat de travail d'un enfant accueilli, sur le modèle officiel de l'Urssaf.

Le modèle « Contrat de travail à durée indéterminée (CDI) - Assistant maternel agréé » publié par
l'Urssaf (service Pajemploi) est un PDF remplissable : app/modeles/Contrat-CDI-Pajemploi-Ama.pdf.
L'application en remplit les champs avec pypdf, sans changer le texte du modèle :

- « version à remplir » : seules les rubriques de l'assistante maternelle (profil) sont remplies ;
  le reste se complète à la main ou à l'ordinateur, les champs restant modifiables ;
- « version complète » : tout est rempli d'après la fiche famille et la fiche enfant (conditions
  en vigueur au début du contrat). Les champs restent modifiables avant impression.

Les montants calculés (salaire net, mensualisation) suivent les formules du modèle ; le net est
indicatif (part du brut qui reste en net sur les derniers bulletins lus).

Quand le modèle de l'Urssaf change, remplacer le PDF et vérifier les noms des champs ci-dessous
(tests/test_contrat_travail.py les contrôle tous).
"""
import logging
from datetime import date
from pathlib import Path

import donnees
import impots

MODELE = Path(__file__).resolve().parent / "modeles" / "Contrat-CDI-Pajemploi-Ama.pdf"

# Jours fériés ordinaires : clé enregistrée dans la fiche → (libellé, nom de la case du modèle).
FERIES = {
    "1er janvier": ("1er janvier", "1er janvier"),
    "vendredi saint": ("Vendredi Saint (Alsace-Moselle)", "Vendredi Saint"),
    "lundi de paques": ("Lundi de Pâques", "Paques"),
    "8 mai": ("8 mai", "8 mai"),
    "ascension": ("Jeudi de l'Ascension", "Ascension"),
    "lundi de pentecote": ("Lundi de Pentecôte", "Pentecote"),
    "abolition": ("Abolition de l'esclavage (DROM)", "Abolition"),
    "14 juillet": ("14 juillet", "14 juillet"),
    "15 aout": ("15 août", "15 août"),
    "1er novembre": ("1er novembre", "1er novembre"),
    "11 novembre": ("11 novembre", "11 novembre"),
    "25 decembre": ("25 décembre", "25 décembre"),
    "26 decembre": ("26 décembre (Alsace-Moselle)", "26 décembre"),
}

# Cases à choix unique du modèle : nom du groupe → valeur enregistrée → valeur de la case.
QUALITES = {"pere": "/Choix 1", "mere": "/Choix 2", "tuteur": "/Choix 3", "autre": "/Choix 4"}
LIEUX = {"domicile": "/Choix1", "mam": "/Choix2"}
REPAS = {"employeur": "/1", "assmat": "/2"}
REPOS = {"majore": "/Choix1", "recupere": "/2"}
PREMIER_MAI = {"chome": "/1", "travaille": "/2"}
CONGES = {"juin": "/1", "principale": "/2", "prorata": "/3"}

# Rubriques nécessaires, par origine (libellés affichés quand elles manquent).
REQUIS_PROFIL = {"nom": "Nom", "prenom": "Prénom", "adresse": "Adresse", "code_postal": "Code postal",
                 "ville": "Ville", "numero_secu": "N° de Sécurité sociale",
                 "agrement_numero": "Référence de l'agrément", "agrement_debut": "Date de l'agrément",
                 "assurance_rc_compagnie": "Assurance responsabilité civile professionnelle"}
REQUIS_FAMILLE = {"parent1_nom": "Nom du parent employeur", "parent1_prenom": "Prénom du parent employeur",
                  "parent1_qualite": "Le parent employeur est (père, mère…)", "adresse": "Adresse de la famille",
                  "code_postal": "Code postal de la famille", "ville": "Ville de la famille"}
REQUIS_CONTRAT = {"enfant_nom": "Nom de l'enfant", "enfant_naissance": "Date de naissance de l'enfant",
                  "debut": "Date d'embauche", "tarif_horaire": "Salaire horaire brut",
                  "entretien_jour": "Indemnité d'entretien", "jour_paiement": "Date de paiement du salaire"}

SEMAINES_ECOLE = 36    # même valeur que dans app.js : semaines d'école quand les vacances diffèrent


def _date(iso: str) -> str:
    try:
        return date.fromisoformat(iso).strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return ""


def _nombre(texte) -> float:
    try:
        return float(str(texte or "").replace(" ", "").replace(",", "."))
    except ValueError:
        return 0.0


def _euros(v: float) -> str:
    return f"{v:.2f}".replace(".", ",") if v else ""


def _heures(h: float) -> str:
    """7,5 → « 07h30 » (format du modèle)."""
    m = round(h * 60)
    return f"{m // 60:02d}h{m % 60:02d}"


def _heures_texte(h: float) -> str:
    """Nombre d'heures écrit simplement : « 40 », « 37,5 »."""
    return f"{round(h, 2):g}".replace(".", ",")


def _nom_naissance(nom: str, naissance: str):
    """(nom de naissance, nom d'usage) : le nom d'usage n'est écrit que s'il diffère."""
    naissance = (naissance or "").strip()
    if naissance and naissance.lower() != (nom or "").strip().lower():
        return naissance, nom
    return nom, ""


def semaine_type(horaires: dict) -> list:
    """[(jour, horaires, durée en heures)] des jours d'accueil, dans l'ordre de la semaine."""
    return [(j, horaires[j], impots.duree(horaires[j])) for j in donnees.JOURS if (horaires or {}).get(j)]


def mensualisation(c: dict) -> float:
    """Heures mensualisées : heures par semaine × semaines ÷ 12 (semaines d'école d'abord quand les
    horaires des vacances diffèrent, comme dans la fiche enfant)."""
    semaines = donnees._semaines(c)
    ecole = sum(d for _, _, d in semaine_type(c.get("horaires_scolaire")))
    vacances = c.get("horaires_vacances") or {}
    if not any(vacances.values()):
        return ecole * semaines / 12
    s_ecole = min(SEMAINES_ECOLE, semaines)
    return (ecole * s_ecole + sum(d for _, _, d in semaine_type(vacances)) * (semaines - s_ecole)) / 12


def manquants(profil: dict, famille: dict = None, contrat: dict = None) -> list:
    """Rubriques utiles au contrat qui ne sont pas encore renseignées."""
    def vides(source, requis):
        return [lib for k, lib in requis.items() if not str(source.get(k) or "").strip()]
    liste = vides(profil, REQUIS_PROFIL)
    if famille is not None:
        liste += vides(famille, REQUIS_FAMILLE)
    if contrat is not None:
        liste += vides(contrat, REQUIS_CONTRAT)
        if not semaine_type(contrat.get("horaires_scolaire")):
            liste.append("Emploi du temps")
    return liste


def valeurs_assmat(p: dict) -> dict:
    naissance, usage = _nom_naissance(p.get("nom"), p.get("nom_naissance"))
    v = {
        "Salarie_NOM1": naissance, "Salarie_NOM2": usage, "Salarie_PRENOM": p.get("prenom", ""),
        "Salarie_ADRESSE": p.get("adresse", ""), "Salarie_VILLE": p.get("ville", ""),
        "Salarie_CP": p.get("code_postal", ""), "Salarie_TEL": p.get("telephone", ""),
        "Salarie_EMAIL": p.get("email", ""), "Salarie_NumSECU": p.get("numero_secu", ""),
        "Salarie_RefAGREMENT": p.get("agrement_numero", ""),
        "Salarie_DelivranceAGREMENT": _date(p.get("agrement_debut")),
        "Salarie_RenouvellementAGREMENT": _date(p.get("agrement_renouvellement")),
        "Salarie_RESP-CIVILE": p.get("assurance_rc_compagnie", ""),
        "Salarie_NumRESP-CIVILE": p.get("assurance_rc_police", ""),
        "Salarie_ASSUR-AUTO": p.get("assurance_auto_compagnie", ""),
        "Salarie_NumASSUR-AUTO": p.get("assurance_auto_police", ""),
    }
    # Lieu de travail : il dépend de l'assistante maternelle, pas de l'enfant.
    if p.get("lieu_accueil") == "mam":
        v["Lieu travail"] = LIEUX["mam"]
        v["Salarie-MAm_ADRESSE"] = p.get("mam_adresse", "")
    else:
        v["Lieu travail"] = LIEUX["domicile"]
        v["Salarie-LieuTravail_ADRESSE"] = ", ".join(
            x for x in (p.get("adresse"), " ".join(x for x in (p.get("code_postal"), p.get("ville")) if x)) if x)
    return v


def valeurs_contrat(p: dict, f: dict, fiche: dict, taux_net: float) -> dict:
    """Toutes les rubriques du modèle, d'après le profil, la famille et la fiche enfant."""
    debut = fiche.get("debut")
    try:
        c = donnees.en_vigueur(fiche, date.fromisoformat(debut))
    except (TypeError, ValueError):
        c = fiche
    v = valeurs_assmat(p)

    # Particulier employeur
    naissance, usage = _nom_naissance(f.get("parent1_nom"), f.get("parent1_nom_naissance"))
    v.update({
        "Employeur_NOM1": naissance, "Employeur_NOM2": usage, "Employeur_PRENOM": f.get("parent1_prenom", ""),
        "Employeur_ADRESSE": f.get("adresse", ""), "Employeur_VILLE": f.get("ville", ""),
        "Employeur_CP": f.get("code_postal", ""), "Employeur_TEL": f.get("telephone", ""),
        "Employeur_EMAIL": f.get("email", ""),
        # Le « Y » du numéro est déjà imprimé sur le modèle.
        "Employeur_NumPAJEMPLOI": (f.get("numero_pajemploi") or "").strip().removeprefix("Y").removeprefix("y").strip(),
    })
    if f.get("parent1_qualite") in QUALITES:
        v["CAS3"] = QUALITES[f["parent1_qualite"]]
        if f["parent1_qualite"] == "autre":
            v["Text1"] = f.get("parent1_qualite_autre", "")

    # Enfant, date d'effet, période d'essai et d'adaptation
    v.update({
        "Enfant_NOM": c.get("enfant_nom", ""), "Enfant_PRENOM": c.get("enfant_prenom", ""),
        "Enfant_NAISSANCE": _date(c.get("enfant_naissance")), "Contrat_DATE-Debut": _date(debut),
        "Contrat_ESSAI": "Pas de période d'essai" if c.get("essai") == "aucune" else c.get("essai", ""), "Contrat_ADAPTATION": c.get("adaptation_jours", ""),
        "Contrat_DebutADAPTATION": _date(c.get("adaptation_debut")),
        "Contrat_FinADAPTATION": _date(c.get("adaptation_fin")),
    })

    # Durée et horaires d'accueil : cas n° 1 (52 semaines) ou n° 2 (année incomplète)
    semaines = donnees._semaines(c)
    jours = semaine_type(c.get("horaires_scolaire"))
    total = sum(d for _, _, d in jours)
    cas = 1 if semaines >= 52 else 2
    v["DUREE"] = f"/Choix{cas}"
    if cas == 1:
        v["Accueil_CAS1_NbreHeures"] = _heures_texte(total) if total else ""
        v["Cas1_NbreSemaine"] = c.get("delai_prevenance", "")
    else:
        v["Cas2_NbreSemaine"] = str(semaines)
        if c.get("planning") == "oui":
            v["CHOIX CAS 2"] = "/B"
            v["Cas2B_Calendaires"] = c.get("delai_planning", "")
        else:
            v["CHOIX CAS 2"] = "/A"
            v["CAS2_NbreHeures"] = _heures_texte(total) if total else ""
            v["CAS2_NbreJOURS"] = str(len(jours)) if jours else ""
            v["Cas2A_Calendaires"] = c.get("delai_prevenance", "")
    if not (cas == 2 and c.get("planning") == "oui"):
        for n, (jour, horaires, duree) in enumerate(jours, 1):
            v[f"Cas{cas}-JOUR{n}"] = jour.capitalize()
            v[f"Cas{cas}-JOUR-7-Horaires" if n == 7 else f"Cas{cas}-JOUR{n}-Horaires"] = horaires
            v[f"Cas{cas}-Jour{n}-NbreHEURE"] = _heures(duree)

    # Rémunération
    tarif = _nombre(c.get("tarif_horaire"))
    v["Salaire_Horaire_BRUT"] = _euros(tarif)
    v["Salaire_Horaire_NET"] = _euros(tarif * taux_net)
    comp = _nombre(c.get("tarif_complementaire"))
    if comp:
        v["Salaire_Horaire_COMP_BRUT"] = _euros(comp)
        v["Salaire_Horaire_COMP_NET"] = _euros(comp * taux_net)
    taux = _nombre(c.get("taux_majoration")) or 10
    v["Salaire_TAUX-MAJ"] = _heures_texte(taux)
    v["Salaire_Horaire_MAJ_BRUT"] = _euros(tarif * (1 + taux / 100))
    v["Salaire_Horaire_MAJ_NET"] = _euros(tarif * (1 + taux / 100) * taux_net)
    brut_mois = round(tarif * mensualisation(c), 2)
    v[f"CAS{cas}-Salaire_BRUT"] = _euros(brut_mois)
    v[f"CAS{cas}-Salaire_NET"] = _euros(brut_mois * taux_net)

    # Indemnités : entretien ramené à l'heure pour la journée type la plus longue
    entretien = _nombre(c.get("entretien_jour"))
    journee = max((d for _, _, d in jours), default=0)
    if entretien and journee:
        v["ENTRETIEN_heures"] = _heures_texte(journee)
        v["ENTRETIEN_montant"] = f"{entretien / journee:.3f}".rstrip("0").replace(".", ",")
    if c.get("repas_fournis") in REPAS:
        v["CHOIX REPAS"] = REPAS[c["repas_fournis"]]
        v["FRAIS_repas_PE" if c["repas_fournis"] == "employeur" else "FRAIS_repas_AM"] = _euros(_nombre(c.get("repas_jour")))
    v["FRAIS_KM"] = _euros(_nombre(c.get("frais_km")))
    v["PAIEMENT_Date"] = c.get("jour_paiement", "")

    # Repos, jours fériés, congés
    v["JOUR-ReposHebdo"] = c.get("repos_jour", "")
    if c.get("repos_travaille") in REPOS:
        v["REPOS"] = REPOS[c["repos_travaille"]]
    if c.get("premier_mai") in PREMIER_MAI:
        v["1MAI"] = PREMIER_MAI[c["premier_mai"]]
    for cle in (x.strip() for x in (c.get("feries_travailles") or "").split(",")):
        if cle in FERIES:
            v[FERIES[cle][1]] = "/Oui"
    v["FERIE_Majoration"] = _heures_texte(_nombre(c.get("ferie_majoration")) or 10)
    if cas == 2 and c.get("conges_paiement") in CONGES:
        v["PAIEMENT CAS 2"] = CONGES[c["conges_paiement"]]

    # Conditions particulières : horaires des vacances s'ils diffèrent (le modèle n'a qu'un tableau).
    conditions = []
    vacances = semaine_type(c.get("horaires_vacances"))
    if vacances and jours:
        conditions.append("Horaires de travail ci-dessus : en période scolaire. Pendant les vacances scolaires : "
                          + " ; ".join(f"{j} {h}" for j, h, _ in vacances) + ".")
    if c.get("conditions_particulieres"):
        conditions.append(c["conditions_particulieres"])
    v["CONDITIONS_01"] = "\n".join(conditions)
    v["SIGNATURE_Lieu"] = c.get("signature_lieu", "")
    v["SIGNATURE_Date"] = _date(c.get("signature_date"))
    return {k: x for k, x in v.items() if x}


def remplir(valeurs: dict, cible: Path) -> Path:
    """Remplit le modèle et l'enregistre ; les champs restent modifiables."""
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject

    # Le modèle de l'Urssaf contient quelques références orphelines, sans conséquence.
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    lecteur = PdfReader(str(MODELE))
    ecrivain = PdfWriter(clone_from=lecteur)
    textes = {k: x for k, x in valeurs.items() if not str(x).startswith("/")}
    cases = {k: x for k, x in valeurs.items() if str(x).startswith("/")}
    for page in ecrivain.pages:
        noms = set()
        for annot in page.get("/Annots") or []:
            a = annot.get_object()
            parent = a.get("/Parent")
            nom = a.get("/T") or (parent.get_object().get("/T") if parent else None)
            noms.add(nom)
            if nom in cases:
                # Case à cocher / bouton radio : on coche le widget dont l'apparence porte cette valeur.
                etats = list((a.get("/AP") or {}).get("/N", {}).keys())
                choix = cases[nom] if cases[nom] in etats else "/Off"
                a[NameObject("/AS")] = NameObject(choix)
                champ = parent.get_object() if parent and parent.get_object().get("/T") else a
                if choix != "/Off":
                    champ[NameObject("/V")] = NameObject(choix)
        a_remplir = {k: x for k, x in textes.items() if k in noms}
        if a_remplir:
            ecrivain.update_page_form_field_values(page, a_remplir, auto_regenerate=False)
    ecrivain.set_need_appearances_writer(True)
    cible.parent.mkdir(parents=True, exist_ok=True)
    with open(cible, "wb") as sortie:
        ecrivain.write(sortie)
    return cible


def nom_fichier(fiche: dict = None) -> str:
    if not fiche:
        return "Contrat de travail CDI - à remplir"
    enfant = " ".join(x for x in (fiche.get("enfant_prenom"), fiche.get("enfant_nom")) if x)
    return f"Contrat de travail CDI - {enfant}" if enfant else "Contrat de travail CDI"



# ------------------------------------------------------------------ avenants
# L'Urssaf ne fournit pas (à notre connaissance) de modèle d'avenant remplissable : l'avenant est une page
# imprimée en PDF par Chromium (comme les courriers). Il ne cite que ce qui change.
LIBELLES = {
    "semaines": "Semaines d'accueil par an", "accueil": "Type d'accueil", "horaires_scolaire": "Jours et horaires de travail",
    "horaires_vacances": "Horaires pendant les vacances scolaires", "planning": "Fixation des jours et horaires",
    "delai_prevenance": "Délai de prévenance pour modifier les horaires", "delai_planning": "Délai de remise du planning",
    "tarif_horaire": "Salaire horaire de base", "tarif_complementaire": "Heures complémentaires",
    "taux_majoration": "Heures au-delà de 45 h par semaine", "entretien_jour": "Indemnité d'entretien",
    "repas_fournis": "Repas fournis par", "repas_jour": "Frais de repas", "frais_km": "Frais de déplacement",
    "jour_paiement": "Date de paiement du salaire", "repos_jour": "Repos hebdomadaire",
    "repos_travaille": "Travail exceptionnel le jour de repos", "premier_mai": "1er mai",
    "feries_travailles": "Jours fériés travaillés", "ferie_majoration": "Majoration d'un jour férié travaillé",
    "conges_paiement": "Paiement de l'indemnité de congés payés", "conditions_particulieres": "Conditions particulières",
}
TEXTES = {
    "accueil": {"journee": "en journée", "periscolaire": "périscolaire"},
    "planning": {"": "par l'emploi du temps du contrat", "oui": "par un planning remis par écrit"},
    "repas_fournis": {"employeur": "le particulier employeur", "assmat": "l'assistant maternel"},
    "repos_travaille": {"majore": "rémunéré, majoré de 25 %", "recupere": "récupéré, majoré de 25 %"},
    "premier_mai": {"chome": "chômé", "travaille": "travaillé (rémunération doublée)"},
    "conges_paiement": {"juin": "en une seule fois en juin", "principale": "en une seule fois lors des congés principaux",
                        "prorata": "au fur et à mesure des congés pris"},
}


def versions(fiche: dict) -> list:
    """[conditions initiales, puis celles de chaque avenant] : un avenant enregistré avant l'ajout d'une rubrique
    garde la valeur précédente de cette rubrique."""
    liste = [{k: fiche.get(k, donnees.CHAMPS_CONTRAT[k]) for k in donnees.MODIFIABLES} | {"id": "", "date": fiche.get("debut", "")}]
    for a in sorted(fiche.get("avenants") or [], key=lambda a: a.get("date", "")):
        liste.append(liste[-1] | {k: a[k] for k in donnees.MODIFIABLES if k in a}
                     | {k: a.get(k, "") for k in ("id", "date", "motif", *donnees.CHAMPS_AVENANT)})
    return liste


def _texte(cle: str, v, taux_net: float) -> str:
    if cle.startswith("horaires"):
        jours = semaine_type(v or {})
        if not jours:
            return "mêmes horaires qu'en période scolaire" if cle == "horaires_vacances" else "—"
        return "\n".join(f"{j.capitalize()} : {h}" for j, h, _ in jours) + f"\nsoit {_heures_texte(sum(d for _, _, d in jours))} h par semaine"
    v = str(v or "").strip()
    if cle in TEXTES:
        return TEXTES[cle].get(v, v or "—")
    if not v:
        return "au tarif normal" if cle == "tarif_complementaire" else "—"
    if cle == "semaines":
        return f"{v} semaines" + (" (année complète)" if v == "52" else "")
    if cle in ("tarif_horaire", "tarif_complementaire"):
        return f"{_euros(_nombre(v))} € brut de l'heure (≈ {_euros(_nombre(v) * taux_net)} € net)"
    if cle in ("taux_majoration", "ferie_majoration"):
        return f"majoration de {v} %"
    if cle == "entretien_jour":
        return f"{_euros(_nombre(v))} € par jour"
    if cle == "repas_jour":
        return f"{_euros(_nombre(v))} € par repas"
    if cle == "frais_km":
        return f"{_euros(_nombre(v))} € par km"
    if cle == "jour_paiement":
        return f"le {v} de chaque mois"
    if cle == "feries_travailles":
        return ", ".join(FERIES[k][0] for k in v.split(",") if k in FERIES) or "aucun"
    return v


def changements(avant: dict, apres: dict, taux_net: float) -> list:
    """[(rubrique, avant, après)] : seulement ce qui change, plus le salaire mensuel qui en découle."""
    def egal(k):
        a, b = avant.get(k), apres.get(k)
        if k.startswith("horaires"):
            return {j: x for j, x in (a or {}).items() if x} == {j: x for j, x in (b or {}).items() if x}
        if k == "feries_travailles":
            return set(filter(None, str(a or "").split(","))) == set(filter(None, str(b or "").split(",")))
        return str(a or "").strip() == str(b or "").strip()
    liste = [(LIBELLES[k], _texte(k, avant.get(k), taux_net), _texte(k, apres.get(k), taux_net))
             for k in donnees.MODIFIABLES if not egal(k)]
    if any(not egal(k) for k in ("semaines", "tarif_horaire", "horaires_scolaire", "horaires_vacances")):
        mois = lambda c: round(_nombre(c.get("tarif_horaire")) * mensualisation(c), 2)  # noqa: E731
        texte = lambda m: f"{_euros(m)} € brut (≈ {_euros(m * taux_net)} € net)" if m else "—"  # noqa: E731
        liste.append(("Salaire mensuel de base", texte(mois(avant)), texte(mois(apres))))
    return liste


STYLE_AVENANT = """
@page { size: A4; margin: 18mm 18mm 20mm; }
body { font: 10.5pt/1.45 "Segoe UI", Arial, sans-serif; color: #222; }
h1 { font-size: 17pt; color: #c8102e; margin: 0; }
.sous-titre { font-size: 12pt; color: #c8102e; margin: 0 0 14px; }
h2 { font-size: 11.5pt; color: #1d3f8f; margin: 18px 0 6px; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.partie { border: 1px solid #1d3f8f; border-radius: 4px; padding: 8px 12px; }
.partie strong { color: #1d3f8f; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th { background: #c8102e; color: #fff; text-align: left; padding: 6px 8px; font-size: 10pt; }
td { border-bottom: 1px solid #ddd; padding: 6px 8px; vertical-align: top; white-space: pre-line; }
td.rubrique { font-weight: 600; width: 30%; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 26px; }
.signatures div { border-top: 1px solid #999; padding-top: 6px; min-height: 70px; font-size: 9.5pt; }
.petit { font-size: 9pt; color: #555; }
"""


def numero_avenant(fiche: dict, avenant_id: str) -> int:
    ids = [a.get("id") for a in sorted(fiche.get("avenants") or [], key=lambda a: a.get("date", ""))]
    return ids.index(avenant_id) + 1 if avenant_id in ids else 0


def html_avenant(p: dict, f: dict, fiche: dict, avenant_id: str, taux_net: float) -> str:
    import html as h
    e = lambda s: h.escape(str(s or ""))  # noqa: E731
    liste = versions(fiche)
    i = next((n for n, v in enumerate(liste) if n and v.get("id") == avenant_id), None)
    if i is None:
        raise ValueError("Avenant introuvable.")
    avant, apres = liste[i - 1], liste[i]
    enfant = " ".join(x for x in (fiche.get("enfant_prenom"), fiche.get("enfant_nom")) if x)
    ne = "née" if fiche.get("enfant_genre") == "fille" else "né" if fiche.get("enfant_genre") == "garcon" else "né(e)"
    employeur = " ".join(x for x in (f.get("parent1_civilite"), f.get("parent1_prenom"), f.get("parent1_nom")) if x)
    salarie = " ".join(x for x in (p.get("civilite"), p.get("prenom"), p.get("nom")) if x)
    adresse = lambda x: ", ".join(y for y in (x.get("adresse"), " ".join(z for z in (x.get("code_postal"), x.get("ville")) if z)) if y)  # noqa: E731
    lignes = changements(avant, apres, taux_net)
    corps = "".join(f"<tr><td class='rubrique'>{e(r)}</td><td>{e(a)}</td><td>{e(b)}</td></tr>" for r, a, b in lignes) \
        or "<tr><td colspan='3'>Aucune modification des conditions.</td></tr>"
    effet = _date(apres.get("date"))
    lieu, le = apres.get("signature_lieu") or "", _date(apres.get("signature_date"))
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avenant n° {i}</title>
<style>{STYLE_AVENANT}</style></head><body>
<h1>Avenant n° {i} au contrat de travail à durée indéterminée</h1>
<p class="sous-titre">Assistant maternel agréé · Convention collective IDCC 3239</p>
<div class="parties">
  <div class="partie"><strong>Le particulier employeur</strong><br>{e(employeur)}<br>{e(adresse(f))}
    {f"<br>N° Pajemploi : {e(f.get('numero_pajemploi'))}" if f.get('numero_pajemploi') else ""}</div>
  <div class="partie"><strong>L'assistant maternel</strong><br>{e(salarie)}<br>{e(adresse(p))}
    {f"<br>Agrément : {e(p.get('agrement_numero'))}" if p.get('agrement_numero') else ""}</div>
</div>
<h2>Objet de l'avenant</h2>
<p>Le contrat de travail à durée indéterminée conclu entre les parties pour l'accueil de l'enfant
<strong>{e(enfant)}</strong>{f", {ne} le {e(_date(fiche.get('enfant_naissance')))}" if fiche.get('enfant_naissance') else ""},
qui a pris effet le {e(_date(fiche.get('debut')))}, est modifié d'un commun accord
{f"({e(apres.get('motif'))[0].lower() + e(apres.get('motif'))[1:]}) " if apres.get('motif') else ""}à compter du <strong>{e(effet)}</strong>.</p>
<h2>Modifications</h2>
<table><thead><tr><th>Rubrique</th><th>Jusqu'à présent</th><th>À compter du {e(effet)}</th></tr></thead>
<tbody>{corps}</tbody></table>
<p class="petit">Montants nets indicatifs. Les montants bruts font foi.</p>
<p>Toutes les autres clauses du contrat de travail{f" et des avenants précédents" if i > 1 else ""} restent inchangées.</p>
<p>Fait en deux exemplaires, à {e(lieu) or "……………………"}, le {e(le) or "……………………"}. Un exemplaire est remis à chaque partie.</p>
<div class="signatures">
  <div>Signature du particulier employeur<br><span class="petit">(précédée de « Lu et approuvé »)</span></div>
  <div>Signature de l'assistant maternel<br><span class="petit">(précédée de « Lu et approuvé »)</span></div>
</div>
</body></html>"""
