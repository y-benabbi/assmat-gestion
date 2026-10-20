"""Vérifie que le serveur local est propre à une session : jeton obligatoire, identité,
et qu'une seconde « session » (autre dossier de données) obtient son propre serveur."""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

MAIN = Path(__file__).resolve().parent.parent / "app" / "main.py"


def lancer(base):
    env = dict(os.environ, ASSMAT_BASE=str(base))
    env.pop("ASSMAT_PORT", None)
    p = subprocess.Popen([sys.executable, str(MAIN), "--sans-navigateur"], env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.5)
        try:
            info = json.loads((Path(base) / "serveur.json").read_text(encoding="utf-8"))
            urllib.request.urlopen(f"http://127.0.0.1:{info['port']}/api/ping", timeout=1)
        except urllib.error.HTTPError:
            return p, info          # le serveur répond (403 sans jeton) : il est prêt
        except Exception:
            continue
    p.kill()
    raise RuntimeError("serveur non démarré")


def statut(url, entetes=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=entetes or {}), timeout=3) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, ""


base_a, base_b = tempfile.mkdtemp(), tempfile.mkdtemp()
serveur_a, info_a = lancer(base_a)
serveur_b = None
try:
    url_a = f"http://127.0.0.1:{info_a['port']}/"
    # Sans jeton : refusé (page et API)
    assert statut(url_a)[0] == 403
    assert statut(url_a + "api/etat")[0] == 403
    assert statut(url_a + "api/parametres", {"X-Jeton": "mauvais"})[0] == 403
    # Avec jeton : identité de la session
    code, texte = statut(url_a + "api/ping", {"X-Jeton": info_a["jeton"]})
    assert code == 200 and texte.startswith("assistante-maternelle:"), (code, texte)
    # Ouverture par le raccourci : /?jeton=… pose un cookie puis la page s'affiche
    import http.cookiejar
    pot = http.cookiejar.CookieJar()
    ouvreur = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(pot))
    with ouvreur.open(url_a + "?jeton=" + info_a["jeton"]) as r:
        assert r.status == 200 and "Assistante Maternelle" in r.read().decode()
    with ouvreur.open(url_a + "api/etat") as r:
        assert r.status == 200
    print("jeton OK, port", info_a["port"])

    # Seconde « session » (autre dossier de données) pendant que la première tourne :
    # elle ne doit pas réutiliser le serveur de la première, mais en démarrer un autre.
    serveur_b, info_b = lancer(base_b)
    assert info_b["port"] != info_a["port"] and info_b["jeton"] != info_a["jeton"]
    assert statut(f"http://127.0.0.1:{info_b['port']}/api/etat", {"X-Jeton": info_a["jeton"]})[0] == 403
    print("seconde session : port", info_b["port"], "distinct, jeton de la première refusé")

    # Relancer dans la première session détecte son serveur existant (aucun second serveur).
    env = dict(os.environ, ASSMAT_BASE=base_a)
    env.pop("ASSMAT_PORT", None)
    code = subprocess.run([sys.executable, "-c",
                           f"import sys; sys.path.insert(0, r'{MAIN.parent}'); import main; "
                           f"print(main.deja_lance() or '')"], env=env, capture_output=True, text=True)
    assert f":{info_a['port']}/?jeton=" in code.stdout, code.stdout + code.stderr
    print("relance dans la même session : serveur existant retrouvé")
finally:
    serveur_a.kill()
    if serveur_b:
        serveur_b.kill()
print("serveur OK")
