"""Rédaction de courriers administratifs à partir des données connues de l'application.

Premier modèle : la demande de dérogation à la PMI pour accueillir un enfant de plus que
l'agrément. L'assistante maternelle ne saisit que l'essentiel (enfant concerné, date de fin,
périodes) ; le reste vient du profil (identité, agrément) et des fiches contrats (enfants
accueillis, emplois du temps).

Le texte est d'abord proposé dans un formulaire modifiable ; le PDF est ensuite produit à
partir de ce texte par le Chromium déjà installé pour Pajemploi (sans fenêtre : aucun site
n'est ouvert, seule la page du courrier est imprimée).
"""
import html
import json
import re
import threading
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import donnees

MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]
ORDINAUX = ["premier", "deuxième", "troisième", "quatrième", "cinquième", "sixième",
            "septième", "huitième"]

# Champs du profil nécessaires au modèle (libellé affiché si absent).
REQUIS_DEROGATION = {
    "nom": "Nom", "prenom": "Prénom", "adresse": "Adresse", "code_postal": "Code postal",
    "ville": "Ville", "telephone": "Téléphone", "agrement_numero": "Numéro d'agrément",
    "agrement_debut": "Date du premier agrément", "agrement_capacite": "Nombre d'enfants de l'agrément",
}

_verrou_pdf = threading.Lock()


def date_longue(d: date) -> str:
    return f"{'1er' if d.day == 1 else d.day} {MOIS[d.month - 1]} {d.year}"


def mois_annee(iso: str) -> str:
    try:
        d = date.fromisoformat(iso)
    except (TypeError, ValueError):
        return ""
    return f"{MOIS[d.month - 1]} {d.year}"


def liste_fr(mots: list) -> str:
    return mots[0] if len(mots) == 1 else ", ".join(mots[:-1]) + " et " + mots[-1] if mots else ""


def champs_manquants(profil: dict, requis: dict) -> list:
    return [libelle for cle, libelle in requis.items() if not str(profil.get(cle) or "").strip()]


# ------------------------------------------------------------------ vacances scolaires
URL_CALENDRIER = ("https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/"
                  "fr-en-calendrier-scolaire/records")


def vacances_scolaires(zone: str, debut: date, fin: date) -> list:
    """Périodes de vacances de la zone entre deux dates : [{"nom", "debut", "fin"}].

    Source : calendrier scolaire publié par l'Éducation nationale (données ouvertes).
    Liste vide si la zone n'est pas renseignée ou si le site ne répond pas : les périodes se
    saisissent alors à la main dans le formulaire.
    """
    if not zone:
        return []
    filtre = (f'zones="Zone {zone}" AND end_date>"{debut.isoformat()}" AND start_date<"{fin.isoformat()}"'
              if zone in "ABC" else f'zones="{zone}" AND end_date>"{debut.isoformat()}" AND start_date<"{fin.isoformat()}"')
    url = URL_CALENDRIER + "?" + urllib.parse.urlencode({"where": filtre, "limit": 100, "order_by": "start_date"})
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            enregistrements = json.loads(r.read().decode("utf-8")).get("results", [])
    except Exception:
        return []
    vues, resultat = set(), []
    for e in enregistrements:
        nom = (e.get("description") or "").strip()
        if not nom.lower().startswith("vacances"):
            continue          # « Pont de l'Ascension », « Début des vacances d'été des enseignants »…
        try:
            d = date.fromisoformat(e["start_date"][:10]) + timedelta(days=1)   # après la classe
            f = date.fromisoformat(e["end_date"][:10]) - timedelta(days=1)     # veille de la reprise
        except (KeyError, ValueError):
            continue
        if (nom, d) in vues:
            continue            # une ligne par académie
        vues.add((nom, d))
        resultat.append({"nom": nom, "debut": max(d, debut).isoformat(), "fin": min(f, fin).isoformat()})
    return sorted(resultat, key=lambda p: p["debut"])


def periode_texte(debut: str, fin: str) -> str:
    d, f = date.fromisoformat(debut), date.fromisoformat(fin)
    if d.year == f.year:
        return f"du {'1er' if d.day == 1 else d.day} {MOIS[d.month - 1]} au {date_longue(f)}"
    return f"du {date_longue(d)} au {date_longue(f)}"


# ------------------------------------------------------------------ dérogation
def _nom_enfant(c: dict) -> str:
    return " ".join(x for x in (c.get("enfant_prenom"), c.get("enfant_nom") or c.get("famille")) if x).strip()


def _accord(c: dict):
    fille = (c.get("enfant_genre") or "").lower().startswith("f")
    return ("elle" if fille else "il"), ("la" if fille else "le")


def _jours_avec(horaires: dict) -> list:
    return [j for j in donnees.JOURS if horaires.get(j)]


def emplois_du_temps(contrats: list, jour: date, enfant_id: str):
    """Deux tableaux : période scolaire (sans l'accueil supplémentaire) et vacances (avec)."""
    actifs = [c for c in contrats if donnees.actif(c, jour) or c.get("id") == enfant_id]

    def lignes(cle, inclure_enfant):
        resultat = []
        for c in actifs:
            if c.get("id") == enfant_id and not inclure_enfant:
                h = c.get("horaires_scolaire") or {}
            else:
                h = c.get(cle) or c.get("horaires_scolaire") or {}
            resultat.append({"nom": (c.get("enfant_nom") or c.get("famille") or "").upper(),
                             "prenom": c.get("enfant_prenom") or "",
                             "age": donnees.age_texte(c.get("enfant_naissance"), jour),
                             "horaires": {j: h.get(j, "") for j in donnees.JOURS[:5]} | (
                                 {j: h[j] for j in donnees.JOURS[5:] if h.get(j)})})
        return resultat

    return lignes("horaires_scolaire", False), lignes("horaires_vacances", True)


def proposer_derogation(demande: dict) -> dict:
    """Texte proposé pour la demande de dérogation, à partir de la saisie minimale.

    demande : {contrat_id, type_accueil ("periscolaire"|"journee"), date_fin (AAAA-MM-JJ),
               motif, date_courrier (AAAA-MM-JJ, défaut : aujourd'hui), periodes (facultatif)}
    """
    profil = donnees.profil()
    jour = date.fromisoformat(demande.get("date_courrier") or date.today().isoformat())
    contrats = donnees.contrats(jour)        # horaires en vigueur à la date du courrier (avenants)
    enfant = next((c for c in contrats if c.get("id") == demande.get("contrat_id")), None)
    manquants = champs_manquants(profil, REQUIS_DEROGATION)
    if not enfant:
        return {"manquants": manquants, "erreur": "Choisissez l'enfant concerné (fiche contrat)."}
    if not enfant.get("debut"):
        manquants.append(f"Date de début d'accueil de {enfant.get('enfant_prenom') or 'l’enfant'} (fiche contrat)")
    if not enfant.get("enfant_naissance"):
        manquants.append(f"Date de naissance de {enfant.get('enfant_prenom') or 'l’enfant'} (fiche contrat)")

    fin = demande.get("date_fin") or ""
    try:
        date_fin = date.fromisoformat(fin)
    except ValueError:
        date_fin = jour + timedelta(days=365)
    periodes = demande.get("periodes")
    source_periodes = "saisie"
    if periodes is None:
        periodes = vacances_scolaires(profil.get("zone_vacances"), jour, date_fin)
        source_periodes = "calendrier" if periodes else "aucune"

    capacite = int(re.sub(r"\D", "", profil.get("agrement_capacite") or "4") or 4)
    prenom = enfant.get("enfant_prenom") or "l'enfant"
    pronom, article = _accord(enfant)
    periscolaire = demande.get("type_accueil", "periscolaire") == "periscolaire"

    sans, avec = emplois_du_temps(contrats, jour, enfant["id"])
    autres = [c for c in contrats if c["id"] != enfant["id"] and donnees.actif(c, jour)]
    jours_vacances = _jours_avec(enfant.get("horaires_vacances") or {})
    jours_scolaire = _jours_avec(enfant.get("horaires_scolaire") or {})

    def compte(jour_semaine, cle):
        return sum(1 for c in autres if (c.get(cle) or c.get("horaires_scolaire") or {}).get(jour_semaine))

    depassements = [j for j in jours_vacances if compte(j, "horaires_vacances") + 1 > capacite]
    total = capacite + 1

    paragraphes = [
        f"Je suis assistante maternelle agréée pour l'accueil de {capacite} enfants de "
        f"{profil.get('agrement_ages') or '0 à 18 ans'} {profil.get('agrement_type') or 'en journée'} "
        f"depuis {mois_annee(profil.get('agrement_debut')) or '[date du premier agrément]'}.",
        f"Je voudrais par la présente vous demander une dérogation afin d'accueillir un "
        f"{ORDINAUX[min(total, len(ORDINAUX)) - 1]} enfant {'en périscolaire' if periscolaire else 'en journée'} "
        f"jusqu'en {mois_annee(fin) or '[date de fin]'}. {_nom_enfant(enfant)} vient à mon domicile depuis "
        f"{mois_annee(enfant.get('debut')) or '[date de début]'}"
        + (f", {demande['motif'].strip().rstrip('.')}." if (demande.get("motif") or "").strip() else "."),
    ]
    vacances_txt = ""
    if jours_vacances:
        n = len(jours_vacances)
        vacances_txt = (f"{prenom} viendrait {n} jour{'s' if n > 1 else ''}"
                        + (f", d'où la présence de {total} enfants le {liste_fr(depassements)}." if depassements else "."))
    scolaire_txt = ""
    if jours_scolaire:
        nb = max(compte(j, "horaires_scolaire") + 1 for j in jours_scolaire)
        scolaire_txt = (f"Pendant les périodes scolaires, {pronom} viendrait seulement le {liste_fr(jours_scolaire)}, "
                        f"où {'seuls' if nb > 1 else 'seul'} {nb} enfant{'s sont accueillis' if nb > 1 else ' est accueilli'}.")

    return {
        "manquants": manquants,
        "source_periodes": source_periodes,
        "proposition": {
            "entete": "\n".join(x for x in [
                f"{profil.get('civilite')} {profil.get('nom', '').upper()} {profil.get('prenom')}".strip(),
                profil.get("adresse"), f"{profil.get('code_postal')} {profil.get('ville', '').upper()}".strip(),
                profil.get("telephone"),
                f"N° agrément : {profil.get('agrement_numero')}" if profil.get("agrement_numero") else ""] if x),
            "lieu_date": f"{profil.get('ville') or '[ville]'}, le {date_longue(jour)}",
            "objet": "Demande de dérogation",
            "destinataire": f"À l'attention {profil.get('pmi_destinataire') or 'du médecin de la PMI'},",
            "corps": "\n\n".join(paragraphes),
            "intro_periodes": "Pendant les vacances scolaires :",
            "periodes": [periode_texte(p["debut"], p["fin"]) for p in periodes] if periodes and isinstance(periodes[0], dict) else list(periodes or []),
            "suite": "\n".join(x for x in (vacances_txt, scolaire_txt) if x),
            "annexe_intro": f"Vous trouverez en annexe deux tableaux simulant mon emploi du temps avec l'accueil de {total} enfants.",
            "conclusion": "Je reste à votre disposition pour tout renseignement complémentaire.\n\n"
                          "Dans l'attente de votre réponse, je vous prie de croire en l'expression de ma considération distinguée.",
            "signature": f"{'Mme' if profil.get('civilite') == 'Madame' else 'M.'} {profil.get('nom', '').title()} {profil.get('prenom')}".strip(),
            "titre_sans": "Emploi du temps SANS cet accueil supplémentaire, HORS vacances scolaires",
            "titre_avec": "Emploi du temps AVEC cet accueil supplémentaire, PENDANT les vacances scolaires",
            "tableau_sans": sans,
            "tableau_avec": avec,
        },
    }


# ------------------------------------------------------------------ mise en page et PDF
STYLE = """
@page { size: A4; margin: 22mm 20mm; }
body { font: 11.5pt/1.5 "Segoe UI", Arial, sans-serif; color: #111; }
.entete { white-space: pre-line; }
.lieu { text-align: right; margin: 18px 0 28px; }
.objet { font-weight: 700; margin: 0 0 18px; }
p { margin: 0 0 12px; white-space: pre-line; text-align: justify; }
ul { margin: 0 0 12px 24px; padding: 0; }
.signature { margin-top: 28px; }
.annexe { page-break-before: always; }
h2 { text-align: center; font-size: 13pt; margin: 0 0 18px; }
h3 { font-size: 11pt; margin: 22px 0 8px; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
th, td { border: 1px solid #888; padding: 5px 6px; text-align: center; vertical-align: middle; }
th { background: #eee; }
td.enfant { text-align: left; white-space: nowrap; }
td.enfant small { color: #444; }
"""


def _tableau(lignes: list) -> str:
    jours = donnees.JOURS[:5] + [j for j in donnees.JOURS[5:] if any(l["horaires"].get(j) for l in lignes)]
    tete = "".join(f"<th>{j.capitalize()}</th>" for j in jours)
    corps = "".join(
        f"<tr><td class='enfant'><strong>{html.escape(l['nom'])}</strong><br>{html.escape(l['prenom'])}"
        f"<br><small>{html.escape(l['age'])}</small></td>"
        + "".join(f"<td>{html.escape(l['horaires'].get(j, ''))}</td>" for j in jours) + "</tr>"
        for l in lignes)
    return f"<table><thead><tr><th></th>{tete}</tr></thead><tbody>{corps}</tbody></table>"


def html_derogation(t: dict) -> str:
    """Page imprimable à partir du texte (éventuellement retouché) de la proposition."""
    e = lambda s: html.escape(s or "")  # noqa: E731
    periodes = "".join(f"<li>{e(p)}</li>" for p in t.get("periodes") or [] if p.strip())
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{e(t.get('objet'))}</title>
<style>{STYLE}</style></head><body>
<div class="entete">{e(t.get('entete'))}</div>
<div class="lieu">{e(t.get('lieu_date'))}</div>
<p class="objet">Objet : {e(t.get('objet'))}</p>
<p>{e(t.get('destinataire'))}</p>
<p>{e(t.get('corps'))}</p>
{f"<p>{e(t.get('intro_periodes'))}</p><ul>{periodes}</ul>" if periodes else ""}
{f"<p>{e(t.get('suite'))}</p>" if (t.get('suite') or '').strip() else ""}
<p>{e(t.get('annexe_intro'))}</p>
<p>{e(t.get('conclusion'))}</p>
<p class="signature">{e(t.get('signature'))}</p>
<section class="annexe"><h2>ANNEXE</h2>
<h3>{e(t.get('titre_sans'))}</h3>{_tableau(t.get('tableau_sans') or [])}
<h3>{e(t.get('titre_avec'))}</h3>{_tableau(t.get('tableau_avec') or [])}
</section></body></html>"""


def generer_pdf(page_html: str, cible: Path) -> Path:
    """Imprime la page en PDF avec Chromium sans fenêtre (aucun site n'est ouvert)."""
    from playwright.sync_api import sync_playwright

    cible.parent.mkdir(parents=True, exist_ok=True)
    with _verrou_pdf, sync_playwright() as p:
        navigateur = p.chromium.launch(headless=True)
        try:
            page = navigateur.new_page()
            page.set_content(page_html, wait_until="load")
            page.pdf(path=str(cible), format="A4", print_background=True, prefer_css_page_size=True)
        finally:
            navigateur.close()
    return cible


def nom_fichier(texte: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "-", texte).strip(" .")
