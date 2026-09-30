// modifiers#14 — the module's tabs speak the hub's language.
//
// The runtime resolves each tab name from `locales/<lang>.json#navigation.<id>.label` (ADR-0055)
// and falls back to the manifest `navigation[].label`, which is therefore the ENGLISH source. The
// groups tab shipped as «Modificadores» in the manifest: invisible while en/es carry their own
// label, but any locale without one (or a missing key) would show Spanish to everyone.
import { describe, expect, it } from 'vitest';
import manifest from '../../module.json' with { type: 'json' };
import en from '../../locales/en.json' with { type: 'json' };
import es from '../../locales/es.json' with { type: 'json' };

type Nav = Array<{ id: string; label: string }>;
type Catalog = { navigation?: Record<string, { label?: string }> };

const nav = (manifest as unknown as { navigation: Nav }).navigation;
const label = (catalog: unknown, id: string) => (catalog as Catalog).navigation?.[id]?.label ?? '';

describe('navigation labels (modifiers#14)', () => {
  it('the groups tab is «Modifiers» in the manifest and English, «Modificadores» in Spanish', () => {
    expect(nav.find((n) => n.id === 'groups')?.label).toBe('Modifiers');
    expect(label(en, 'groups')).toBe('Modifiers');
    expect(label(es, 'groups')).toBe('Modificadores');
  });

  it.each(nav.map((n) => [n.id, n.label] as const))(
    '%s: the manifest label is the English source and Spanish translates it',
    (id, source) => {
      expect(label(en, id)).toBe(source);
      expect(label(es, id)).not.toBe('');
      expect(label(es, id)).not.toBe(label(en, id));
    },
  );
});
