#!/usr/bin/env python3
"""Contract test for `modifiers` (ADR-0376, pm#93) — the four rules that, if broken, make this
module the wrong module.

Why these four and not a smoke test: each one is a decision the market barrido settled and that a
future edit could undo without anything else complaining.

  1. OBLIGATION IS A NUMBER, NOT A FLAG. `min_choices >= 1` IS "required". Clover models it this
     way on purpose, and Square is the cautionary tale: its "customer can only select one modifier"
     ALSO forces a minimum of 1, so a group meant to be optional silently becomes mandatory. One
     control with two effects is how that bug is born. A `required` column would reintroduce it.

  2. THE LINK IS OPAQUE. `modifiers` must not learn what a product or a service is: the target is
     `target_kind` + `target_ref`, with NO foreign key into another module's tables and NO
     `depends_on` on `inventory`/`services`. This is the whole reason the module exists — verified
     on origin/main, `services` declares `depends_on: ["taxes"]` and cannot start depending on
     `inventory` just so a salon can charge "+ keratin treatment".

  3. A MODIFIER IS NOT A VARIANT. No stock, no cost of its own (Lightspeed draws this line
     explicitly). Deducting ingredients is pm#116 and lives elsewhere.

  4. TAX INHERITS, AND AN OVERRIDE OF THE PARENT IS FORBIDDEN. `tax_category_key` is nullable
     (empty = inherit the sale line's). When set it applies to the option's OWN delta only. Toast
     allows overriding the parent and documents the hole that opens: with two overriding modifiers
     the item falls back to the parent rate and discards both. A result that depends on HOW MANY
     modifiers the waiter picked is indefensible before the AEAT.

Usage: tests/contract.test.py   (exit 0 = green)
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = MODULE_DIR / "module.json"
MIGRATION = MODULE_DIR / "migrations" / "postgres" / "001_init.sql"

failures: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


manifest = json.loads(MANIFEST.read_text())
sql = MIGRATION.read_text() if MIGRATION.exists() else ""


def table_body(name: str) -> str:
    """The text between `CREATE TABLE ... name (` and the matching close, or '' if absent."""
    m = re.search(rf"CREATE TABLE IF NOT EXISTS {name}\s*\((.*?)\n\);", sql, re.S)
    return m.group(1) if m else ""


# --- 1 · obligation is a number ------------------------------------------------------------
group = table_body("modifiers_group")
check(bool(group), "modifiers_group does not exist in 001_init.sql")
check("min_choices" in group, "modifiers_group must declare min_choices (>= 1 IS 'required')")
check("max_choices" in group, "modifiers_group must declare max_choices (0 = no ceiling)")
check(
    not re.search(r"\brequired\b", group),
    "modifiers_group must NOT carry a `required` flag: obligation is min_choices >= 1 "
    "(Clover's rule; Square's dual-effect control is the bug this avoids)",
)
check("kitchen_name" in group, "modifiers_group must declare kitchen_name (Toast: the kitchen "
                               "ticket name is not the commercial one)")

# --- 2 · the link is opaque ----------------------------------------------------------------
link = table_body("modifiers_group_link")
check(bool(link), "modifiers_group_link does not exist in 001_init.sql")
check("target_kind" in link and "target_ref" in link,
      "the link must be opaque: target_kind + target_ref")
check(
    not re.search(r"REFERENCES\s+(inventory_|services_)", link),
    "the link must NOT have a foreign key into another module's tables — that is a hard "
    "dependency in disguise",
)
for forbidden in ("inventory", "services"):
    check(
        forbidden not in (manifest.get("depends_on") or []),
        f"depends_on must not contain `{forbidden}`: the whole point of this module is that "
        f"`services` never has to depend on `inventory`",
    )

# --- 3 · a modifier is not a variant -------------------------------------------------------
option = table_body("modifiers_option")
check(bool(option), "modifiers_option does not exist in 001_init.sql")
check("price_delta" in option, "modifiers_option must declare price_delta (may be negative)")
for forbidden in ("stock", "cost"):
    check(
        not re.search(rf"\b{forbidden}\b", option),
        f"modifiers_option must NOT declare `{forbidden}`: a modifier is not a variant "
        f"(Lightspeed draws this line); ingredient consumption is pm#116",
    )

# --- 4 · tax inherits, never overrides the parent ------------------------------------------
check("tax_category_key" in option,
      "modifiers_option must declare tax_category_key (nullable = inherit the line's)")
check(
    not re.search(r"tax_category_key[^,\n]*NOT NULL", option),
    "tax_category_key must be nullable: empty means inherit the sale line's category",
)
check(
    not re.search(r"override", sql, re.I),
    "nothing here may override the parent's tax rate — Toast documents the hole that opens "
    "(two overriding modifiers and the item silently falls back to the parent rate)",
)

# --- the migration guard trap (hub, 2026-08-18) --------------------------------------------
for n, line in enumerate(sql.splitlines(), 1):
    stripped = line.strip()
    if stripped.startswith("--") and ";" in stripped:
        failures.append(
            f"001_init.sql:{n}: a `;` inside a `--` comment makes the migration guard REJECT the "
            f"whole module at install time, and `erplora validate` does not catch it"
        )

if failures:
    print(f"✗ {len(failures)} contract failure(s):", file=sys.stderr)
    for f in failures:
        print(f"  - {f}", file=sys.stderr)
    sys.exit(1)

print("✓ modifiers contract (ADR-0376): obligation is a number, the link is opaque, "
      "a modifier is not a variant, tax inherits and never overrides")
