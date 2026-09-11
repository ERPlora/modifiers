// The module's `data-testid` guard — modifiers#9, mirror of `hub/apps/web/src/form-testids.test.ts`.
//
// WHY THIS EXISTS. A QA spec addresses a screen by hook, never by visible text (everything is
// translated, ADR-0055/0199) nor by position (a new button shifts it). `data-testid` is the only
// hook Playwright's `getByTestId` resolves, and it is a CONTRACT with specs that live in ANOTHER
// repo: renaming one here turns a spec red days later, in a repository whose CI never saw this
// change. The hub's guard covers the shell and cannot see this repo, so the contract is held here.
//
// Convention (single source: `architecture/hub/apps/testids.md`): `<surface>-<field|action|state>`,
// kebab-case, the surface prefix mandatory, row identity at the end and never the index.
//
// 🔴 ONE DELIBERATE DEVIATION FROM THE SHELL'S GUARD, and it is the whole point of rule 4 here.
// The shell is Vue, so its two legal spellings are `data-testid="…"` (fixed) and `:data-testid="…"`
// (computed). This module is LIT: `:data-testid` is not a binding syntax, Lit paints an attribute
// literally named `:data-testid`, which `getByTestId` does not resolve — the exact class of hook
// the shell's rule 4 was written to deny. So the two legal spellings here are `data-testid="…"`
// (fixed) and `data-testid=${…}` (Lit binding), and `:data-testid` / `v-bind:data-testid` are
// denied with the rest of the variants.
//
// The five rules are the shell's five, in the same order:
//   1. COVERAGE — a form control or action without a hook fails.
//   2. CONTRACT — `COVERED` declares the EXACT set of names per screen; any drift, in either
//      direction, fails. This is what makes a silent rename impossible.
//   3. ATTRIBUTE — `data-test` and every other variant denied, in `ui/` and in `tests/`.
//   4. SPELLING — only the two spellings above, always double quotes.
//   5. RATCHET — every screen with a form is in `COVERED` or in `NOT_YET_COVERED` with a REAL
//      issue (`repo#N`), and `PENDING_TODAY` counts the pending ones and only ever goes down.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * The module root, found by walking up from the working directory until `module.json` appears —
 * NOT from `import.meta.url`, which under vitest + happy-dom is not a `file:` URL and dies before
 * collecting a single test.
 */
function moduleRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'module.json'))) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error('module.json not found above ' + process.cwd());
    dir = up;
  }
}

const MODULE_DIR = moduleRoot();
const UI = join(MODULE_DIR, 'ui');
const TESTS = join(MODULE_DIR, 'tests');

/**
 * This file is the only thing excluded from the sweeps, because it is the only file that has to
 * SPELL the denied variants in order to deny them. Everything else under `ui/` is swept, test files
 * included: a spec that keeps reading `[data-test="…"]` after the screen stopped painting it
 * asserts about nothing, which is half of what rule 3 exists to stop.
 */
const GUARD = 'testids.test.ts';

/**
 * What each screen declares. `contract` is the EXACT set of literal `data-testid` values the file
 * writes today; `computed` is the same contract for the FIXED HEAD of each `data-testid=${…}`
 * (the part before the variable — the only bit a spec can predict); `tables` is the namespace each
 * `<ok-data-table>` receives, from which the table derives all of its own chrome
 * (`-add`, `-search`, `-row-<id>`, `-row-<id>-<actionId>`, `-page-prev`… — outfitkit#143).
 *
 * `prefix` is the screen's namespace and every name above must start with it. The module has ONE
 * screen today, so its prefix is `modifiers-`; a second screen takes its own (`modifiers-options-`)
 * rather than widening this one, which is what stops two screens from sharing a hook.
 */
const COVERED: Record<
  string,
  { prefix: string; contract: string[]; computed?: string[]; tables?: string[] }
> = {
  'components/erp-modifiers-groups/erp-modifiers-groups.ts': {
    prefix: 'modifiers-',
    contract: [
      'modifiers-error',
      'modifiers-form',
      'modifiers-kitchen-name',
      'modifiers-list-error',
      'modifiers-max-choices',
      'modifiers-min-choices',
      'modifiers-name',
      'modifiers-submit',
    ],
    tables: ['modifiers-table'],
  },
};

/** Screens with a form still without hooks. The value is the REAL issue that asks for them. */
const NOT_YET_COVERED: Record<string, string> = {};

/**
 * How many screens are pending TODAY. This number ONLY GOES DOWN: a screen that moves to `COVERED`
 * subtracts one, and nothing ever adds. Without it the pending list is a list of exceptions — a new
 * screen enters with a decorative issue number and the guard stays green (measured as a mutant when
 * reviewing hub#1813).
 */
const PENDING_TODAY = 0;

/** A real issue reference: `repo#N`. A placeholder (`repo#PENDING-1`) is not one. */
const ISSUE_REF = /^[a-z0-9_.-]+#\d+$/;

/**
 * What a person fills in, plus what a person presses. The shell leaves buttons to the contract
 * because it has hundreds of decorative ones; this module has actions only, and the recipe of the
 * family is explicit that every ACTION (submit, cancel, retry, clear, download) carries a hook — so
 * `ion-button`/`button` are swept here, and that is what makes «a new control without a hook» fail
 * instead of passing silently.
 */
const CONTROL_TAGS = [
  'ion-input',
  'ion-select',
  'ion-textarea',
  'ion-toggle',
  'ion-checkbox',
  'ion-searchbar',
  'ion-radio-group',
  'ion-datetime',
  'ion-range',
  'ion-button',
  'form',
  'input',
  'select',
  'textarea',
  'button',
] as const;

const CONTROL_OPEN = new RegExp(`<(${CONTROL_TAGS.join('|')})(?=[\\s/>])`, 'g');
const TABLE_OPEN = /<ok-data-table(?=[\s/>])/g;

/** `data-testid="…"` written by hand. The Lit binding `data-testid=${…}` does NOT count here. */
const LITERAL_TESTID = /(?<![\w-])data-testid="([^"]*)"/g;
/** The head of a Lit binding; the expression itself is read with balanced braces. */
const COMPUTED_TESTID = /(?<![\w-])data-testid=\$\{/g;
/** `testid="…"` — the namespace `<ok-data-table>` receives from its host. */
const TABLE_TESTID = /(?<![\w-])testid="([^"]*)"/g;
/**
 * Any `data-test…` attribute that is NOT `data-testid`. Playwright resolves `getByTestId` against
 * `data-testid` and nothing else, so `data-test` is a hook the robot cannot reach.
 */
const DENIED_ATTR = /(?<![\w-])data-test(?!id\s*=)[\w-]*\s*=/g;
/** Every way the attribute is written, so rule 4 can reject the ones the rules above cannot read. */
const SPELLING = /(?<![\w-])(v-bind:data-testid|:data-testid|data-testid)\s*=\s*(\$\{|"|'|[^\s>])/g;
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** The `>` that closes an opening tag, skipping the `>` that live inside quotes or a binding. */
function openTag(source: string, start: number): string {
  let quote: string | null = null;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/** The expression of a `${…}`, read with balanced braces so a nested template does not truncate it. */
function binding(source: string, openBrace: number): string {
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBrace + 1, i);
    }
  }
  return source.slice(openBrace + 1);
}

function walk(dir: string, found: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

const uiSources: Array<{ name: string; source: string }> = walk(UI)
  .filter((f) => f.endsWith('.ts') && !f.endsWith(GUARD))
  .map((f) => ({ name: relative(UI, f), source: readFileSync(f, 'utf8') }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** A screen is a file that paints controls: that is what the contract is about. */
const SCREENS = uiSources.filter((s) => new RegExp(CONTROL_OPEN.source).test(s.source));

/** Rule 3 reaches both halves: the screens AND the specs that address them. */
const SWEPT = [
  ...uiSources,
  ...walk(TESTS)
    .filter((f) => !f.endsWith(GUARD))
    .map((f) => ({ name: relative(MODULE_DIR, f), source: readFileSync(f, 'utf8') })),
];

const matches = (re: RegExp, source: string): RegExpExecArray[] => {
  const found: RegExpExecArray[] = [];
  const scan = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = scan.exec(source)) !== null) found.push(m);
  return found;
};

const lineOf = (source: string, index: number): number => source.slice(0, index).split('\n').length;

const literalTestids = (source: string): string[] =>
  matches(LITERAL_TESTID, source).map((m) => m[1]);

const tableTestids = (source: string): string[] => matches(TABLE_TESTID, source).map((m) => m[1]);

/**
 * The fixed head of a computed hook: the text before the first variable. `${id}-row` has none and
 * nobody can address it; a bare prop (`data-testid=${this.testid}`) has none either and is only
 * legal in a reusable control, whose HOST names it — neither belongs to a screen's contract.
 */
function computedHeads(source: string): Array<{ expression: string; head: string | null; line: number }> {
  return matches(COMPUTED_TESTID, source).map((m) => {
    const expression = binding(source, m.index + m[0].length - 1);
    const template = expression.trim().match(/^`([^`]*)`$/);
    const head = template ? template[1].split('${')[0] : null;
    return { expression: expression.trim(), head: head || null, line: lineOf(source, m.index) };
  });
}

const hasTestid = (tag: string): boolean => /(?:^|\s)data-testid\s*=/.test(tag);

const uncoveredControls = (source: string): string[] =>
  matches(CONTROL_OPEN, source)
    .filter((m) => !hasTestid(openTag(source, m.index)))
    .map((m) => `<${m[1]}> line ${lineOf(source, m.index)}`);

const tablesWithoutNamespace = (source: string): string[] =>
  matches(TABLE_OPEN, source)
    .filter((m) => !/(?:^|\s)testid\s*=/.test(openTag(source, m.index)))
    .map((m) => `<ok-data-table> line ${lineOf(source, m.index)}`);

describe('data-testid — the module UI contract (modifiers#9)', () => {
  it('1 · covered screens leave no control without a hook', () => {
    const offenders: string[] = [];
    for (const name of Object.keys(COVERED)) {
      const screen = uiSources.find((s) => s.name === name);
      expect(screen, `${name} is in COVERED but does not exist`).toBeDefined();
      for (const control of uncoveredControls(screen!.source)) offenders.push(`${name}: ${control}`);
      for (const table of tablesWithoutNamespace(screen!.source)) offenders.push(`${name}: ${table}`);
    }
    expect(
      offenders,
      'a control without data-testid is a control Playwright cannot fill; an <ok-data-table> ' +
        'without `testid` paints no hook at all (outfitkit#143)',
    ).toEqual([]);
  });

  it('2 · the declared contract is EXACTLY what the screen paints', () => {
    for (const [name, spec] of Object.entries(COVERED)) {
      const screen = uiSources.find((s) => s.name === name)!;
      expect([...new Set(literalTestids(screen.source))].sort(), `${name}: literal hooks`).toEqual(
        [...spec.contract].sort(),
      );
      const heads = computedHeads(screen.source);
      expect(
        [...new Set(heads.map((h) => h.head).filter((h): h is string => h !== null))].sort(),
        `${name}: fixed heads of the computed hooks`,
      ).toEqual([...(spec.computed ?? [])].sort());
      expect(
        heads.filter((h) => h.head === null).map((h) => `line ${h.line}: ${h.expression}`),
        `${name}: a computed hook with no fixed head cannot be addressed by any spec`,
      ).toEqual([]);
      expect([...new Set(tableTestids(screen.source))].sort(), `${name}: table namespaces`).toEqual(
        [...(spec.tables ?? [])].sort(),
      );
    }
  });

  it('2b · every declared name is kebab-case and lives under its screen prefix', () => {
    const offenders: string[] = [];
    for (const [name, spec] of Object.entries(COVERED)) {
      for (const value of [...spec.contract, ...(spec.computed ?? []), ...(spec.tables ?? [])]) {
        if (!KEBAB.test(value.replace(/-$/, ''))) offenders.push(`${name}: "${value}" is not kebab-case`);
        if (!value.startsWith(spec.prefix)) offenders.push(`${name}: "${value}" is outside ${spec.prefix}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('2c · no literal hook is repeated across two screens', () => {
    const owners = new Map<string, string[]>();
    for (const { name, source } of uiSources) {
      for (const value of new Set(literalTestids(source))) {
        owners.set(value, [...(owners.get(value) ?? []), name]);
      }
    }
    expect(
      [...owners].filter(([, screens]) => screens.length > 1).map(([v, s]) => `${v}: ${s.join(', ')}`),
      'getByTestId would pick one of them at random',
    ).toEqual([]);
  });

  it('3 · nothing writes data-test (or any other variant) instead of data-testid', () => {
    const offenders: string[] = [];
    for (const { name, source } of SWEPT) {
      for (const m of matches(DENIED_ATTR, source)) {
        offenders.push(`${name}:${lineOf(source, m.index)}: ${m[0].trim()}`);
      }
    }
    expect(
      offenders,
      'Playwright resolves getByTestId against data-testid and nothing else',
    ).toEqual([]);
  });

  it('4 · the hook is written in ONE way: data-testid="…" or data-testid=${…}', () => {
    const offenders: string[] = [];
    for (const { name, source } of SWEPT) {
      for (const m of matches(SPELLING, source)) {
        const legal = m[1] === 'data-testid' && (m[2] === '"' || m[2] === '${');
        if (!legal) offenders.push(`${name}:${lineOf(source, m.index)}: ${m[0].trim()}`);
      }
    }
    expect(
      offenders,
      'this module is Lit: `:data-testid`/`v-bind:data-testid` paint an attribute with that literal ' +
        'name, which getByTestId does not resolve, and single quotes are invisible to the rules above',
    ).toEqual([]);
  });

  it('5 · every screen with a form is classified, and the pending list only shrinks', () => {
    const unclassified = SCREENS.filter(
      (s) => !(s.name in COVERED) && !(s.name in NOT_YET_COVERED),
    ).map((s) => s.name);
    expect(unclassified, 'a screen with controls is either COVERED or a declared pending one').toEqual([]);

    for (const [name, issue] of Object.entries(NOT_YET_COVERED)) {
      expect(ISSUE_REF.test(issue), `${name}: "${issue}" is not a real issue (repo#N)`).toBe(true);
      const screen = uiSources.find((s) => s.name === name);
      expect(screen, `${name} is pending but does not exist`).toBeDefined();
      expect(
        uncoveredControls(screen!.source).length + tablesWithoutNamespace(screen!.source).length,
        `${name} is already complete: move it to COVERED and subtract one from PENDING_TODAY`,
      ).toBeGreaterThan(0);
    }

    expect(
      Object.keys(NOT_YET_COVERED).length,
      'PENDING_TODAY is today\'s photo and only goes down: a new screen cannot enter the pending ' +
        'list with a decorative issue number',
    ).toBe(PENDING_TODAY);
  });
});
