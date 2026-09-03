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

# --- 5 · todo evento emitido está DECLARADO -------------------------------------------------
# Un handler que emite un evento que su módulo no declara hace FALLAR el command en runtime, y se
# descubre en producción. Barato de comprobar aquí.
declared = set((manifest.get("events") or {}).get("emits") or [])
for cmd, spec in (manifest.get("commands") or {}).items():
    for event in spec.get("emit") or []:
        check(
            event in declared,
            f"{cmd} emits `{event}` but events.emits does not declare it — the runtime fails the "
            f"whole command when that happens",
        )

# --- 6 · cada fichero SQL declarado existe --------------------------------------------------
for block in ("queries", "commands"):
    for name, spec in (manifest.get(block) or {}).items():
        paths = spec.get("sql")
        for rel in [paths] if isinstance(paths, str) else (paths or []):
            check((MODULE_DIR / rel).exists(),
                  f"{name} points at {rel}, which is not in the package")
        schema = spec.get("schema")
        if schema:
            check((MODULE_DIR / schema).exists(),
                  f"{name} points at schema {schema}, which is not in the package")

# --- 7 · hay una lectura de catálogo COMPLETA, para que el precio no lo ponga el cliente ------
# `sales` resuelve el precio del producto contra `inventory.products.for_sale`, no contra el
# payload: «El precio SALE DEL CATÁLOGO si la línea dice ser de catálogo. El del payload es una
# propuesta, no un hecho.» Un suplemento es dinero igual, así que necesita la misma autoridad —
# sin ella, un cliente que envíe `price_delta: -500` se hace un descuento.
#
# `options.list` no sirve para eso: pide `group_id`, y el handler tiene ids de OPCIÓN sueltos.
# Hace falta una lectura sin parámetros que el runtime pueda pre-cargar como contexto.
catalog = (manifest.get("queries") or {}).get("modifiers.options.all")
check(bool(catalog), "modifiers.options.all is missing: without a parameterless catalogue read, "
                     "`sales` has no way to verify a modifier's price and would have to trust "
                     "the payload")
if catalog:
    check(
        "list" not in catalog,
        "modifiers.options.all must NOT declare a `list` block: a paginated read hands the "
        "handler the first 50 rows and stays silent about the rest (hub#650), which is a "
        "price-authority hole, not a display bug",
    )
    sql_path = catalog.get("sql")
    body = (MODULE_DIR / sql_path).read_text() if sql_path and (MODULE_DIR / sql_path).exists() else ""
    for column in ("price_delta", "tax_category_key", "group_id"):
        check(column in body, f"modifiers.options.all must return {column}")

# --- 6 · the marketplace card speaks the hub's language -------------------------------------
# The SaaS catalogue takes `name` and `description` from `locales/<lang>.json` (saas#1457), NOT
# from module.json: English is the source and every served language must carry BOTH fields, or a
# Spanish hub lists this app with a translated title over an English description (seen in
# production on 2026-08-25). Every user-visible string ships in English + its Spanish (ADR-0055).
LOCALES = MODULE_DIR / "locales"
for language in ("en", "es"):
    path = LOCALES / f"{language}.json"
    check(path.exists(), f"locales/{language}.json is missing")
    if path.exists():
        catalogue = json.loads(path.read_text())
        for field in ("name", "description"):
            value = catalogue.get(field)
            check(
                isinstance(value, str) and value.strip() != "",
                f"locales/{language}.json must carry a non-empty top-level `{field}`: the "
                f"marketplace card reads it from here, not from module.json",
            )
        if language == "en":
            check(
                catalogue.get("description") == manifest.get("description"),
                "locales/en.json `description` must equal module.json `description`: English is "
                "the single source and the two must not drift",
            )
        else:
            english = json.loads((LOCALES / "en.json").read_text())
            for field in ("name", "description"):
                check(
                    catalogue.get(field) != english.get(field),
                    f"locales/{language}.json `{field}` is a copy of the English text, not a translation",
                )

# --- 8 · the manifest root declares NOTHING the hub does not read (modifiers#6) --------------
# `schemas/module.schema.json` is `additionalProperties: false` and has no place for authorship,
# licence or long description: those four keys belong to the SaaS catalogue, not to the manifest.
# Who authored a module is the PUBLISHER (ADR-0161, pm#130) — `create_module_from_git` already
# falls back to the publisher's name — and `Module.long_description` comes from the README.
#
# Declaring one anyway is not a no-op: ADR-0286 puts it in the middle tier, so the hub INSTALLS
# and reports `manifest_warnings[] = { path: "<key>" }` in `GET /api/modules`, and nothing in the
# module's own gate goes red — `erplora validate` prints `⚠ clave desconocida` and still exits 0,
# which is exactly how `"author": "ERPlora"` shipped in every published version up to v0.1.7.
# The only red is in ANOTHER repo (hub#1243's catalogue sweep), hours later, for someone else.
#
# The trap is that `parse_module_metadata` in the SaaS reads all four from `module.json`, so the
# key looks supported from the catalogue side while the contract forbids it.
CATALOGUE_ONLY_ROOT_KEYS = ("author", "author_email", "license", "long_description")
for key in CATALOGUE_ONLY_ROOT_KEYS:
    check(
        key not in manifest,
        f"module.json must not declare a root `{key}`: the manifest contract "
        f"(`additionalProperties: false`) has no such field, so the hub installs the module with "
        f"a manifest warning nobody reads. Authorship is the publisher's (ADR-0161) and the "
        f"catalogue fills it in — see modifiers#6",
    )

if failures:
    print(f"✗ {len(failures)} contract failure(s):", file=sys.stderr)
    for f in failures:
        print(f"  - {f}", file=sys.stderr)
    sys.exit(1)

print("✓ modifiers contract (ADR-0376): obligation is a number, the link is opaque, "
      "a modifier is not a variant, tax inherits and never overrides, "
      "every emitted event is declared, every declared file exists, "
      "the marketplace card speaks the hub's language, "
      "and the manifest root declares nothing the hub does not read")
