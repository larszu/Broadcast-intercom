#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# Baut aus den Markdown-Dateien dieses Repos eine statische Web-Seite.
#
# WARUM AUS DEM README UND NICHT AUS EINER EIGENEN SEITE. Eine handgeschriebene
# Projektseite waere eine zweite Beschreibung desselben Programms — und die
# zweite ist die, die nach dem naechsten Feature nicht nachgezogen wird. Hier
# gibt es nur EINE Quelle: die Markdown-Dateien, die ohnehin gepflegt werden.
# Was auf der Seite steht, steht damit auch im Repo, und umgekehrt.
#
# WAS ER TUT
#   * jede .md im Repo -> .html am selben relativen Ort
#     (`README.md` -> `index.html`, in JEDEM Verzeichnis)
#   * relative Links von `.md` auf `.html` umgeschrieben, Anker bleiben
#   * alle Nicht-Markdown-Dateien aus den Doku-Verzeichnissen mitkopiert,
#     damit Screenshots nicht ins Leere zeigen
#   * am Ende gemeldet, welche relativen Links NICHT aufloesen
#
# DIE TOTEN LINKS WERDEN GEMELDET UND BRECHEN DEN LAUF NICHT. Ein README zeigt
# legitim auf Quelldateien (`src/index.ts`), die auf der Seite nichts zu
# suchen haben. Ein Abbruch dafuer haette den Lauf dauerhaft rot gemacht — und
# ein Lauf, der immer rot ist, gewoehnt einem das Hinsehen ab. Die Liste steht
# stattdessen in der Lauf-Zusammenfassung, wo sie jemand liest, der sie
# braucht.
#
# DIESE DATEI LIEGT IN MEHREREN REPOS UND IST DORT ZEICHENGLEICH. Wer sie
# aendert, aendert sie ueberall — sonst sehen zwei Projektseiten verschieden
# aus, ohne dass jemand das entschieden haette.
# ---------------------------------------------------------------------------
import html
import pathlib
import re
import shutil
import sys

try:
    import markdown
except ImportError:
    sys.exit("Fehlt: `pip install markdown`. Der Workflow installiert es; lokal bitte auch.")

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ZIEL = WURZEL / "_site"
TITEL = sys.argv[1] if len(sys.argv) > 1 else WURZEL.name

# Verzeichnisse, die keine Doku sind. `_site` steht mit drin, damit ein
# zweiter Lauf nicht seine eigene Ausgabe einliest.
AUS = {"node_modules", ".git", "dist", "build", "release", "_site", "__pycache__", ".venv", "venv"}

VORLAGE = """<!doctype html>
<html lang="{sprache}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titel}</title>
<style>
  :root {{
    color-scheme: dark;
    --grund: #0f1419; --flaeche: #171d24; --linie: #2a323c;
    --text: #e6edf3; --leise: #9aa7b4; --akzent: #4ea1ff;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--grund); color: var(--text);
    font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }}
  .kopf {{ border-bottom: 1px solid var(--linie); background: var(--flaeche); }}
  .kopf .innen {{ max-width: 52rem; margin: 0 auto; padding: 0.9rem 1.5rem;
    display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }}
  .kopf a {{ color: var(--text); text-decoration: none; font-weight: 600; }}
  .kopf .leise {{ color: var(--leise); font-size: 0.85rem; }}
  main {{ max-width: 52rem; margin: 0 auto; padding: 2rem 1.5rem 5rem; }}
  a {{ color: var(--akzent); }}
  h1, h2, h3, h4 {{ line-height: 1.25; margin: 2rem 0 0.75rem; }}
  h1 {{ font-size: 2rem; margin-top: 0; }}
  h2 {{ border-bottom: 1px solid var(--linie); padding-bottom: 0.35rem; }}
  img {{ max-width: 100%; height: auto; border: 1px solid var(--linie); border-radius: 6px; }}
  code {{ background: var(--flaeche); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }}
  pre {{ background: var(--flaeche); border: 1px solid var(--linie); border-radius: 8px;
    padding: 1rem; overflow-x: auto; }}
  pre code {{ background: none; padding: 0; }}
  blockquote {{ margin: 1rem 0; padding: 0.4rem 1rem; border-left: 3px solid var(--akzent);
    background: var(--flaeche); color: var(--leise); }}
  /* Breite Tabellen scrollen in sich, statt die Seite breit zu machen. */
  .tabelle {{ overflow-x: auto; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid var(--linie); padding: 0.45rem 0.7rem; text-align: left; }}
  th {{ background: var(--flaeche); }}
  hr {{ border: none; border-top: 1px solid var(--linie); margin: 2.5rem 0; }}
  footer {{ max-width: 52rem; margin: 0 auto; padding: 0 1.5rem 3rem;
    color: var(--leise); font-size: 0.85rem; }}
</style>
</head>
<body>
<header class="kopf"><div class="innen">
  <a href="{wurzel}">{titel}</a>
  <span class="leise">{unterzeile}</span>
</div></header>
<main>
{inhalt}
</main>
<footer>Diese Seite ist aus den Markdown-Dateien des Repos gebaut. Was hier
steht, steht dort.</footer>
</body>
</html>
"""


def quellen():
    for p in sorted(WURZEL.rglob("*.md")):
        if any(teil in AUS for teil in p.relative_to(WURZEL).parts):
            continue
        yield p


def zielpfad(p: pathlib.Path) -> pathlib.Path:
    rel = p.relative_to(WURZEL)
    name = "index.html" if rel.name.lower() == "readme.md" else rel.stem + ".html"
    return ZIEL / rel.parent / name


def links_umschreiben(text: str) -> str:
    """`…/README.md` -> `…/index.html`, sonst `.md` -> `.html`. Absolute
    Adressen und reine Anker bleiben, wie sie sind."""

    def ersetze(m: re.Match) -> str:
        attr, ziel = m.group(1), m.group(2)
        if re.match(r"(?:[a-z][a-z0-9+.-]*:|//|#)", ziel, re.I):
            return m.group(0)
        pfad, _, anker = ziel.partition("#")
        if pfad.lower().endswith("readme.md"):
            pfad = pfad[: -len("README.md")] + "index.html"
        elif pfad.lower().endswith(".md"):
            pfad = pfad[:-3] + ".html"
        else:
            return m.group(0)
        return f'{attr}="{pfad}{"#" + anker if anker else ""}"'

    return re.sub(r'(href)="([^"]*)"', ersetze, text)


def main() -> int:
    if ZIEL.exists():
        shutil.rmtree(ZIEL)
    ZIEL.mkdir(parents=True)

    md = markdown.Markdown(extensions=["tables", "fenced_code", "sane_lists", "attr_list"])
    gebaut = []
    for q in quellen():
        rel = q.relative_to(WURZEL)
        inhalt = links_umschreiben(md.reset().convert(q.read_text(encoding="utf-8")))
        # Tabellen in einen Scrollbereich, damit eine breite Tabelle nicht die
        # ganze Seite waagerecht schiebt.
        inhalt = inhalt.replace("<table>", '<div class="tabelle"><table>').replace(
            "</table>", "</table></div>"
        )
        z = zielpfad(q)
        z.parent.mkdir(parents=True, exist_ok=True)
        tiefe = len(z.relative_to(ZIEL).parts) - 1
        z.write_text(
            VORLAGE.format(
                sprache="de" if rel.name == "CLAUDE.md" else "en",
                titel=html.escape(TITEL),
                unterzeile=html.escape(rel.as_posix()),
                wurzel="../" * tiefe + "index.html" if tiefe else "index.html",
                inhalt=inhalt,
            ),
            encoding="utf-8",
        )
        gebaut.append((rel, z.relative_to(ZIEL)))

    # Bilder, damit Screenshots nicht ins Leere zeigen — plus LICENSE, weil
    # fast jedes README darauf verlinkt und der Link sonst der einzige tote
    # auf der ganzen Seite waere.
    kopiert = 0
    BILDER = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
    for p in sorted(WURZEL.rglob("*")):
        rel = p.relative_to(WURZEL)
        if not p.is_file() or any(teil in AUS for teil in rel.parts):
            continue
        if p.suffix.lower() in BILDER or p.name.upper() in {"LICENSE", "LICENCE"}:
            z = ZIEL / rel
            z.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, z)
            kopiert += 1

    if not (ZIEL / "index.html").exists():
        print("FEHLER: kein README.md im Wurzelverzeichnis — die Seite haette keine Startseite.")
        return 1

    # Welche relativen Links loesen nicht auf? Gemeldet, nicht abgebrochen.
    tot = []
    for _, zrel in gebaut:
        datei = ZIEL / zrel
        for m in re.finditer(r'(?:href|src)="([^"]*)"', datei.read_text(encoding="utf-8")):
            ziel = m.group(1)
            if re.match(r"(?:[a-z][a-z0-9+.-]*:|//|#)", ziel, re.I) or not ziel:
                continue
            pfad = (datei.parent / ziel.partition("#")[0]).resolve()
            if pfad.exists() or (pfad / "index.html").exists():
                continue
            tot.append(f"{zrel.as_posix()} -> {ziel}")

    print(f"Seite gebaut: {len(gebaut)} Markdown-Datei(en), {kopiert} Bild(er)/Anhang.")
    for rel, zrel in gebaut:
        print(f"  {rel.as_posix()} -> {zrel.as_posix()}")
    if tot:
        print(f"\n{len(tot)} relative(r) Link(s) zeigen ins Leere (meist auf Quelldateien):")
        for z in sorted(set(tot)):
            print(f"  {z}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
