import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
// 'define' por su subpath ligero (no arrastra el barrel de ok-*). 'ok-data-table' se auto-registra.
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';

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

export class ErpModifiersItems extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    .form { display:flex; gap:.5rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .err { color:#d9480f; font-weight:600; }
  `;

  @state() private newName = '';
  @state() private newCode = '';
  @state() private saving = false;
  @state() private formError = '';

  private ctrl!: ListController<Item>;

  private columns: DataTableColumn[] = [
    { key: 'name', header: 'Nombre', sortable: true, filterable: true, filterType: 'text' },
    { key: 'code', header: 'Código', sortable: true, filterable: true, filterType: 'text' },
    {
      key: 'amount',
      header: 'Importe',
      align: 'right',
      sortable: true,
      filterable: true,
      filterType: 'range',
      format: (r) => Number(r.amount).toFixed(2),
    },
  ];

  async firstUpdated(): Promise<void> {
    this.ctrl = createListController<Item>(
      erplora(),
      'modifiers.items.list',
      () => this.requestUpdate(),
      { pageSize: 50, sort: 'name', dir: 'asc' },
    );
    await this.ctrl.load();
  }

  private async create(ev: Event): Promise<void> {
    ev.preventDefault();
    if (!this.newName.trim()) return;
    this.saving = true;
    this.formError = '';
    try {
      await erplora().command('modifiers.items.create', {
        name: this.newName.trim(),
        code: this.newCode.trim(),
        amount: 0,
      });
      this.newName = '';
      this.newCode = '';
      await this.ctrl.load();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'No se pudo crear';
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      <div>
        <header><h2>Items</h2></header>
        <form class="form" @submit=${(e: Event) => this.create(e)}>
          <ion-input placeholder="Nombre" .value=${this.newName}
            @ionInput=${(e: Event) => (this.newName = (e.target as HTMLInputElement).value)}></ion-input>
          <ion-input placeholder="Código" .value=${this.newCode}
            @ionInput=${(e: Event) => (this.newCode = (e.target as HTMLInputElement).value)}></ion-input>
          <ion-button type="submit" size="small" ?disabled=${this.saving || !this.newName}>
            ${this.saving ? 'Guardando…' : 'Añadir'}
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
          .searchPlaceholder=${'Buscar…'}
          .emptyMessage=${this.ctrl?.loading ? 'Cargando…' : 'Sin datos.'}
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

define('erp-modifiers-items', ErpModifiersItems);
