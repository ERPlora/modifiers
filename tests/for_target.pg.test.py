#!/usr/bin/env python3
"""`modifiers.for_target` against a REAL Postgres — the query the POS depends on (ADR-0376).

Why this file exists and why it is separate from `contract.test.py`: that one reads files, this one
RUNS them. `erplora validate --pg` only proves every statement PREPAREs; a statement can prepare
perfectly and still return the wrong rows, in the wrong order, or none at all. Nothing here had ever
been executed before this test.

Four things it pins, all of which were real risks:

  1. The migration APPLIES. Not "parses" — applies, with its indexes.
  2. `for_target` returns the group flattened with its options, ordered by group then option, in a
     SINGLE round trip. The POS builds the tree from this; an N+1 per group would be a different
     query and a different cost.
  3. 🔴 `:category_ref = NULL` works THROUGH A REAL PREPARE. Postgres fixes a bind's type at its
     FIRST appearance and `IS NULL` supplies none, so without the `CAST(:category_ref AS TEXT)`
     the PREPARE dies with 42P08 the moment it arrives NULL — the most common call from the POS,
     since most items have no category groups.

     ⚠️ This one needs its own path and it is worth knowing why. The rest of this file substitutes
     the named binds with literals before sending the SQL, which is convenient and reads well —
     and is exactly why it CANNOT see this bug: a literal `NULL` in the text is not a parameter,
     so nothing is ever inferred. Verified by removing the CAST: the literal-substitution checks
     stayed green and only `validate --pg` complained. So `prepare_with_binds` below converts the
     named binds to positional and runs a genuine PREPARE, which is what the runtime does.
  4. Category inheritance adds the category's groups WITHOUT duplicating the item's own
     (Lightspeed's model).

Usage: tests/for_target.pg.test.py   (exit 0 = green)
  Uses the `erplora-test-pg-5433` container by default (override: ERPLORA_TEST_PG_CONTAINER).
  Creates a scratch database and DROPS it at the end, pass or fail. If Docker or the container is
  missing this is SKIPPED, never passed.
"""

import os
import pathlib
import subprocess
import sys
import uuid

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
CONTAINER = os.environ.get("ERPLORA_TEST_PG_CONTAINER", "erplora-test-pg-5433")
DB = f"modifiers_for_target_{uuid.uuid4().hex[:8]}"
HUB = "hub-a"
OTHER_HUB = "hub-b"
USER = "admin-a"
NOW = "2026-08-20T10:00:00+00:00"


def psql(args: list[str], db: str | None = None, stdin: str | None = None) -> str:
    cmd = ["docker", "exec", "-i", CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-X"]
    if db:
        cmd += ["-d", db]
    cmd += args
    res = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip() or res.stdout.strip())
    return res.stdout


def available() -> bool:
    try:
        psql(["-c", "SELECT 1"])
        return True
    except Exception:
        return False


def lit(value) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def bind(sql: str, params: dict) -> str:
    """Substitute the runtime's named binds. Longest name first so `:group_id` never eats `:group`."""
    for name in sorted(params, key=len, reverse=True):
        sql = sql.replace(f":{name}", lit(params[name]))
    return sql


def prepare_with_binds(sql: str, order: list[str], db: str) -> str | None:
    """PREPARE the statement with REAL parameters, the way the runtime does.

    Returns None if it prepared, or the Postgres error if it did not. Named binds become `$n` in
    first-appearance order, which is precisely the order Postgres uses to infer their types.
    """
    positional = sql
    for i, name in enumerate(order, start=1):
        positional = positional.replace(f":{name}", f"${i}")
    stmt = f"prep_{uuid.uuid4().hex[:8]}"
    try:
        psql(["-c", f"PREPARE {stmt} AS {positional}"], db=db)
        return None
    except Exception as exc:  # noqa: BLE001 - the message IS the assertion here
        return str(exc)

if not available():
    print(f"SKIPPED: no Postgres in container `{CONTAINER}` — this is a SKIP, not a pass")
    sys.exit(0)

failures: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


psql(["-c", f'CREATE DATABASE "{DB}"'])
try:
    # --- 1 · the migration APPLIES -------------------------------------------------------------
    migration = (MODULE_DIR / "migrations" / "postgres" / "001_init.sql").read_text()
    psql(["-f", "-"], db=DB, stdin=migration)
    tables = psql(
        ["-tAc", "SELECT table_name FROM information_schema.tables "
                 "WHERE table_schema='public' ORDER BY table_name"], db=DB).split()
    for t in ("modifiers_group", "modifiers_option", "modifiers_group_link"):
        check(t in tables, f"{t} was not created by the migration")

    # --- seed: a required group with two options, one of them carrying its own tax category ----
    def cmd(path: str, params: dict) -> None:
        sql = (MODULE_DIR / "commands" / path).read_text()
        psql(["-c", bind(sql, params)], db=DB)

    base = {"hub_id": HUB, "current_user_id": USER, "now": NOW}
    cmd("group_create.sql", {**base, "new_id": "g-point", "name": "Punto de la carne",
                             "kitchen_name": "PUNTO", "min_choices": 1, "max_choices": 1,
                             "allow_repeat": 0, "sort_order": 10})
    cmd("group_create.sql", {**base, "new_id": "g-drink", "name": "Bebida",
                             "kitchen_name": "", "min_choices": 0, "max_choices": 1,
                             "allow_repeat": 0, "sort_order": 20})
    cmd("option_create.sql", {**base, "new_id": "o-rare", "group_id": "g-point", "name": "Poco hecho",
                              "kitchen_name": "POCO", "price_delta": 0,
                              "tax_category_key": "", "sort_order": 10})
    cmd("option_create.sql", {**base, "new_id": "o-well", "group_id": "g-point", "name": "Muy hecho",
                              "kitchen_name": "MUY", "price_delta": 0,
                              "tax_category_key": "", "sort_order": 20})
    # A bottled soft drink added to a 10% dish: its OWN category, applied to its delta only.
    cmd("option_create.sql", {**base, "new_id": "o-soda", "group_id": "g-drink", "name": "Refresco",
                              "kitchen_name": "", "price_delta": 250,
                              "tax_category_key": "product.generic", "sort_order": 10})
    cmd("link_attach.sql", {**base, "new_id": "l-1", "group_id": "g-point",
                            "target_kind": "product", "target_ref": "prod-steak", "sort_order": 0})
    cmd("link_attach.sql", {**base, "new_id": "l-2", "group_id": "g-drink",
                            "target_kind": "category", "target_ref": "cat-mains", "sort_order": 0})

    query = (MODULE_DIR / "queries" / "for_target.sql").read_text()

    # Column order of `queries/for_target.sql`, so nobody counts them by eye again:
    #   0 group_id · 1 group_name · 2 group_kitchen_name · 3 min_choices · 4 max_choices
    #   5 allow_repeat · 6 group_sort_order · 7 option_id · 8 option_name
    #   9 option_kitchen_name · 10 price_delta · 11 tax_category_key · 12 option_sort_order
    def for_target(target_ref: str, category_ref, hub: str = HUB) -> list[list[str]]:
        sql = bind(query, {"hub_id": hub, "target_kind": "product",
                           "target_ref": target_ref, "category_ref": category_ref})
        out = psql(["-tAF", "|", "-c", sql], db=DB).strip()
        return [r.split("|") for r in out.splitlines() if r]

    # --- 3 · the NULL category case (the 42P08 bug), through a REAL prepare --------------------
    # First appearance order in for_target.sql: hub_id, target_kind, target_ref, category_ref.
    err = prepare_with_binds(query, ["hub_id", "target_kind", "target_ref", "category_ref"], DB)
    check(
        err is None,
        f"for_target does not PREPARE with real binds — this is what the runtime does, and it is "
        f"how a missing CAST on `:category_ref` kills the query in every hub: {err}",
    )

    rows = for_target("prod-steak", None)
    check(len(rows) == 2,
          f"with no category the steak must return its 2 point options, got {len(rows)}")
    check([r[7] for r in rows] == ["o-rare", "o-well"],
          f"options must come back in sort_order, got {[r[7] for r in rows] if rows else rows}")
    if rows:
        check(rows[0][3] == "1", "min_choices must travel: this group is required (min 1)")
        check(rows[0][2] == "PUNTO", "the kitchen name must travel, not the commercial one")

    # --- 4 · category inheritance adds, does not duplicate -------------------------------------
    inherited = for_target("prod-steak", "cat-mains")
    check(len(inherited) == 3,
          f"with its category the steak must add the drink group: expected 3 rows, got {len(inherited)}")
    check(sorted({r[0] for r in inherited}) == ["g-drink", "g-point"],
          f"both groups exactly once, got {sorted({r[0] for r in inherited}) if inherited else []}")
    soda = [r for r in inherited if r[7] == "o-soda"]
    check(bool(soda), "the drink option must be reachable through the category link")
    if soda:
        check(soda[0][10] == "250", f"price_delta must travel intact, got {soda[0][10]}")
        check(soda[0][11] == "product.generic",
              f"the option's own tax category must travel, got {soda[0][11]!r}")

    # --- tenancy: another hub sees nothing ------------------------------------------------------
    check(for_target("prod-steak", "cat-mains", hub=OTHER_HUB) == [],
          "a different hub must not see this hub's modifiers")

    # --- and the check detects the positive: an unlinked product returns nothing ----------------
    check(for_target("prod-unlinked", None) == [],
          "a product with no groups must return no rows (control: the query is not returning "
          "everything regardless of the target)")
finally:
    psql(["-c", f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)'])

if failures:
    print(f"✗ {len(failures)} failure(s) running for_target against Postgres:", file=sys.stderr)
    for f in failures:
        print(f"  - {f}", file=sys.stderr)
    sys.exit(1)

print("✓ modifiers.for_target on real Postgres: migration applies, groups come back flattened and "
      "ordered, it PREPAREs with real binds, inheritance adds without duplicating, tenancy holds")
