import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
// 'define' por su subpath ligero (no arrastra el barrel de ok-*). 'ok-data-table' se auto-registra.
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';
// Catálogo i18n del módulo (ADR-0055/0199): esbuild inlinea estos JSON en el `dist` del WC. El
// inglés es el idioma FUENTE y el español su traducción — ninguna cadena visible se hardcodea.
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

// Web Component del módulo 'modifiers' (Lit). Mini-app: NO toca la BD; llama al SDK
// (erplora.query/queryPage/command/on). El cliente se obtiene de globalThis.erplora
// (lo inyecta el shell del Hub; en 'erplora dev' lo inyecta un cliente mock con fixtures).

interface ErploraClientLike extends ListClient {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  queryPage<R = unknown>(name: string, params: ListParams): Promise<ListPage<R>>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  on(event: string, cb: (payload: unknown) => void): () => void;
}

interface Item {
  id: string;
  name: string;
  code: string;
  amount: number;
}

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

export class ErpModifiersGroups extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    .form { display:flex; gap:.5rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .err { color:#d9480f; font-weight:600; }
  `;

  @state() private newName = '';
  @state() private newKitchenName = '';
  /** `>= 1` ES la obligatoriedad del grupo (ADR-0376). No hay casilla «obligatorio»: un solo
   *  control con dos efectos es el footgun documentado de Square. */
  @state() private newMin = 0;
  /** `0` = sin techo. */
  @state() private newMax = 0;
  @state() private saving = false;
  @state() private formError = '';

  private ctrl!: ListController<Item>;

  private get columns(): DataTableColumn[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
      { key: 'name', header: t('ui.colName'), sortable: true, filterable: true, filterType: 'text' },
      {
        key: 'kitchen_name',
        header: t('ui.colKitchen'),
        sortable: false,
        // Vacío = la comanda usa el nombre comercial (regla de Toast).
        format: (r) => String(r.kitchen_name || r.name),
      },
      {
        key: 'min_choices',
        header: t('ui.colChoice'),
        sortable: true,
        // La obligatoriedad NO es un campo: se lee de min_choices. Se pinta así para que el usuario
        // vea la misma regla que aplica el TPV, en vez de una casilla que pueda contradecirla.
        format: (r) => {
          const min = Number(r.min_choices ?? 0);
          const max = Number(r.max_choices ?? 0);
          const base = min >= 1
            ? t('ui.choiceRequired').replace('{min}', String(min))
            : t('ui.choiceOptional');
          return max > 0 ? `${base} · ${t('ui.choiceMax').replace('{max}', String(max))}` : base;
        },
      },
      { key: 'sort_order', header: t('ui.colOrder'), align: 'right', sortable: true },
    ];
  }


  async firstUpdated(): Promise<void> {
    this.ctrl = createListController<Item>(
      erplora(),
      'modifiers.groups.list',
      () => this.requestUpdate(),
      { pageSize: 50, sort: 'sort_order', dir: 'asc' },
    );
    await this.ctrl.load();
  }

  private async create(ev: Event): Promise<void> {
    ev.preventDefault();
    if (!this.newName.trim()) return;
    this.saving = true;
    this.formError = '';
    try {
      await erplora().command('modifiers.groups.create', {
        name: this.newName.trim(),
        kitchen_name: this.newKitchenName.trim(),
        min_choices: this.newMin,
        max_choices: this.newMax,
      });
      this.newName = '';
      this.newKitchenName = '';
      this.newMin = 0;
      this.newMax = 0;
      await this.ctrl.load();
    } catch (e) {
      this.formError = e instanceof Error
        ? e.message
        : erplora().t(CATALOG, 'ui.errCreateGroup');
    } finally {
      this.saving = false;
    }
  }

  render() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`
      <div>
        <header><h2>${t('ui.title')}</h2></header>
        <form class="form" @submit=${(e: Event) => this.create(e)}>
          <ion-input mode="md" fill="outline" label-placement="floating" label=${t('ui.fieldName')}
            .value=${this.newName}
            @ionInput=${(e: Event) => (this.newName = (e.target as HTMLInputElement).value)}></ion-input>
          <ion-input mode="md" fill="outline" label-placement="floating" label=${t('ui.fieldKitchenName')}
            .value=${this.newKitchenName}
            @ionInput=${(e: Event) => (this.newKitchenName = (e.target as HTMLInputElement).value)}></ion-input>
          <ion-input mode="md" fill="outline" type="number" min="0" label-placement="floating"
            label=${t('ui.fieldMin')} .value=${String(this.newMin)}
            @ionInput=${(e: Event) => (this.newMin = Number((e.target as HTMLInputElement).value) || 0)}></ion-input>
          <ion-input mode="md" fill="outline" type="number" min="0" label-placement="floating"
            label=${t('ui.fieldMax')} .value=${String(this.newMax)}
            @ionInput=${(e: Event) => (this.newMax = Number((e.target as HTMLInputElement).value) || 0)}></ion-input>
          <ion-button type="submit" size="small" ?disabled=${this.saving || !this.newName}>
            ${this.saving ? t('ui.actionSaving') : t('ui.actionAdd')}
          </ion-button>
        </form>
        ${this.formError ? html`<p class="err">${this.formError}</p>` : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table
          .serverSide=${true}
          .columns=${this.columns}
          .rows=${this.ctrl?.rows ?? []}
          .total=${this.ctrl?.total ?? 0}
          .page=${this.ctrl?.state.page ?? 0}
          .pageSize=${this.ctrl?.state.pageSize ?? 50}
          .sort=${this.ctrl?.state.sort}
          .sortDir=${this.ctrl?.state.dir ?? 'asc'}
          .searchable=${true}
          .searchPlaceholder=${t('ui.search')}
          .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.empty')}
          @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)}
          @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) =>
            this.ctrl.setSort(e.detail.sort, e.detail.dir)}
          @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)}
          @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) =>
            this.ctrl.setFilter(e.detail.col, e.detail.value)}
        ></ok-data-table>
      </div>
    `;
  }
}

define('erp-modifiers-groups', ErpModifiersGroups);
