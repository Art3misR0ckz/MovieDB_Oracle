"""Run every project script in Oracle (one SQL*Plus session per file) and capture
each statement's outcome as structured JSON for the PDF report.

Each statement is preceded by a PROMPT marker so the output can be split back
into per-statement results. Query output uses SQL*Plus CSV markup.
"""
import csv, io, json, os, re, subprocess, datetime, pathlib

PROJECT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(__file__).resolve().parent / "results.json"
ORACLE_HOME = r"D:\app\oracle\product\21c\dbhomeXE"
SQLPLUS = os.path.join(ORACLE_HOME, "bin", "sqlplus.exe")
HOST = "172.16.122.58:1521/XEPDB1"
FILES = ["02_create_tables.sql", "03_sample_data.sql", "04_queries.sql",
         "05_views.sql", "06_booking_integrity.sql", "07_plsql.sql",
         "08_upcoming_shows.sql", "09_plsql_demo.sql"]
MARK = "@@STMT@@"


def creds():
    d = {}
    for line in (PROJECT / "oracle_credentials.txt").read_text(encoding="utf-8-sig").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip()
    return d


def split_statements(text):
    """Split a script into (preceding_comments, statement_text) pairs."""
    stmts, comments, buf, plsql = [], [], [], False
    for line in text.splitlines():
        s = line.strip()
        if not buf:
            if not s:
                continue
            if s.startswith("--"):
                comments.append(s[2:].strip())
                continue
            plsql = bool(re.match(r"(BEGIN|DECLARE|CREATE\s+OR\s+REPLACE\s+(TRIGGER|FUNCTION|PROCEDURE))\b", s, re.I))
        buf.append(line)
        if (plsql and s == "/") or (not plsql and s.endswith(";")):
            stmts.append((comments, "\n".join(buf)))
            comments, buf = [], []
    return stmts


def run_file(name, cred):
    stmts = split_statements((PROJECT / name).read_text(encoding="utf-8"))
    script = [
        "SET DEFINE OFF", "SET SQLBLANKLINES ON", "SET ECHO OFF", "SET FEEDBACK ON",
        "SET PAGESIZE 50000", "SET LINESIZE 32767", "SET TRIMOUT ON", "SET TAB OFF",
        "SET MARKUP CSV ON QUOTE ON",
        "ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI';",
    ]
    for i, (_, sql) in enumerate(stmts):
        script.append(f"PROMPT {MARK}{i}")
        script.append(sql)
    script.append(f"PROMPT {MARK}END")
    script.append("EXIT")
    tmp = pathlib.Path(__file__).parent / f"_run_{name}"
    tmp.write_text("\n".join(script) + "\n", encoding="utf-8")
    env = dict(os.environ, ORACLE_HOME=ORACLE_HOME, NLS_LANG="AMERICAN_AMERICA.AL32UTF8")
    conn = f'CONNECT {cred["APP_USER"]}/"{cred["APP_PASSWORD"]}"@{HOST}\n@"{tmp}"\n'
    p = subprocess.run([SQLPLUS, "-S", "-L", "/nolog"], input=conn, capture_output=True,
                       text=True, encoding="utf-8", errors="replace", cwd=PROJECT, env=env)
    tmp.unlink()
    out = p.stdout
    chunks = re.split(rf"^{MARK}(\d+|END)\s*$", out, flags=re.M)
    by_idx = {chunks[k]: chunks[k + 1] for k in range(1, len(chunks) - 1, 2)}
    results = []
    for i, (comments, sql) in enumerate(stmts):
        raw = by_idx.get(str(i), "")
        results.append(dict(comments=comments, sql=sql, **parse_output(raw)))
    return results


FEEDBACK = re.compile(r"^(\d+ rows? (selected|created|updated|deleted)\.|no rows selected|"
                      r"(Table|View|Sequence|Trigger|Index|Function|Procedure) (created|dropped)\.|PL/SQL procedure successfully completed\.|"
                      r"Commit complete\.|Rollback complete\.|Savepoint created\.|Session altered\.)$")


def parse_output(raw):
    lines = [l.rstrip() for l in raw.splitlines()]
    errors = [l.strip() for l in lines if re.match(r"\s*(ORA|SP2|PLS)-\d+", l)]
    feedback = [l.strip() for l in lines if FEEDBACK.match(l.strip())]
    data = [l for l in lines if l.strip() and not FEEDBACK.match(l.strip())
            and "ERROR at line" not in l and not re.match(r"\s*(ORA|SP2|PLS)-\d+", l)
            and not re.match(r"^\s*\*\s*$", l)]
    rows = None
    if not errors and data and data[0].startswith('"'):
        rows = list(csv.reader(io.StringIO("\n".join(data))))
    return dict(errors=errors, feedback=feedback, rows=rows)


def main():
    cred = creds()
    started = datetime.datetime.now()
    report = dict(started=started.strftime("%Y-%m-%d %H:%M:%S"), files={})
    for f in FILES:
        report["files"][f] = run_file(f, cred)
        n = len(report["files"][f])
        e = sum(1 for r in report["files"][f] if r["errors"])
        print(f"{f}: {n} statements, {e} with errors")
    # Oracle version banner
    env = dict(os.environ, ORACLE_HOME=ORACLE_HOME)
    p = subprocess.run([SQLPLUS, "-S", "-L", "/nolog"], capture_output=True, text=True, env=env,
                       input=f'CONNECT {cred["APP_USER"]}/"{cred["APP_PASSWORD"]}"@{HOST}\n'
                             "SET HEADING OFF FEEDBACK OFF\nSELECT banner_full FROM v$version;\nEXIT\n")
    report["version"] = " ".join(p.stdout.split())
    report["finished"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    OUT.write_text(json.dumps(report, indent=1), encoding="utf-8")
    print("version:", report["version"])


if __name__ == "__main__":
    main()
