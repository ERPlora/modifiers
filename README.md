# modifiers

Módulo ERPlora (declarativo + Web Component Lit). Repo independiente; se desarrolla dentro de un
workspace creado con `erplora startproject`.

- `module.json` — manifest (queries/commands/navigation/permissions).
- `ui/components/erp-modifiers-items/erp-modifiers-items.ts` — el Web Component (Lit) que usa `ok-data-table`.
- `queries/`, `commands/`, `migrations/` — SQL declarativo (Postgres).
- `fixtures/` — datos mock que usa `erplora dev` para previsualizar sin backend.
- `dist/modifiers.esm.js` — artefacto que va en el `module.zip` (lo genera `erplora build`).

```sh
erplora dev modifiers      # previsualiza
erplora build modifiers    # compila el WC
```
