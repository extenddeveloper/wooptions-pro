namespace WooOptionsPro.Pages {
  const { Button, Modal, SearchControl, SelectControl, TextControl } = wp.components;
  const { __ } = wp.i18n;
  const { useCallback, useEffect, useMemo, useState } = wp.element;

  type BulkAction = 'activate' | 'deactivate' | 'archive' | 'restore' | 'export' | 'delete';

  function ActionMenu(props: { item: WooOptionsPro.OptionSetRecord; onAction: (action: string) => void }): any {
    const [open, setOpen] = useState(false);
    useEffect(() => {
      if (!open) return;
      const close = () => setOpen(false);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }, [open]);
    return <div className="wof-row-menu" onClick={(event: Event) => event.stopPropagation()}>
      <button type="button" className="wof-row-menu__toggle" aria-expanded={open} onClick={() => setOpen(!open)}><WooOptionsPro.Components.Dashicon name="ellipsis" /></button>
      {open ? <div className="wof-row-menu__popover">
        <button type="button" onClick={() => props.onAction('edit')}><WooOptionsPro.Components.Dashicon name="edit" />{__('Edit', 'wooptions-pro')}</button>
        <button type="button" onClick={() => props.onAction('export')}><WooOptionsPro.Components.Dashicon name="download" />{__('Export', 'wooptions-pro')}</button>
        <button type="button" onClick={() => props.onAction('duplicate')}><WooOptionsPro.Components.Dashicon name="admin-page" />{__('Duplicate', 'wooptions-pro')}</button>
        <button type="button" onClick={() => props.onAction(props.item.status === 'inactive' ? 'activate' : 'deactivate')}><WooOptionsPro.Components.Dashicon name={props.item.status === 'inactive' ? 'yes' : 'hidden'} />{props.item.status === 'inactive' ? __('Activate', 'wooptions-pro') : __('Deactivate', 'wooptions-pro')}</button>
        <button type="button" onClick={() => props.onAction(props.item.status === 'archived' ? 'restore' : 'archive')}><WooOptionsPro.Components.Dashicon name={props.item.status === 'archived' ? 'undo' : 'archive'} />{props.item.status === 'archived' ? __('Restore', 'wooptions-pro') : __('Archive', 'wooptions-pro')}</button>
        <button type="button" className="is-destructive" onClick={() => props.onAction('delete')}><WooOptionsPro.Components.Dashicon name="trash" />{__('Delete permanently', 'wooptions-pro')}</button>
      </div> : null}
    </div>;
  }

  export function OptionSets(props: { navigate: (route: string) => void }): any {
    const [collection, setCollection] = useState<WooOptionsPro.OptionSetCollection>({ items: [], total: 0, page: 1, perPage: 10 });
    const [status, setStatus] = useState<WooOptionsPro.OptionSetStatus>('active');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('updated_at_gmt');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [createTitle, setCreateTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<WooOptionsPro.OptionSetRecord | null>(null);
    const canConfigure = !!(window as any).WooOptionsProAdmin?.license?.canConfigure;

    const load = useCallback(() => {
      setLoading(true);
      setError('');
      WooOptionsPro.Api.listOptionSets({ page, perPage, status, search, orderBy: sort, order: sort === 'title' ? 'ASC' : 'DESC' })
        .then((response) => setCollection(response))
        .catch((reason) => setError(WooOptionsPro.Utils.errorMessage(reason)))
        .finally(() => setLoading(false));
    }, [page, perPage, status, search, sort]);

    useEffect(() => {
      const timeout = window.setTimeout(load, 180);
      return () => window.clearTimeout(timeout);
    }, [load]);

    useEffect(() => { setSelected([]); setPage(1); }, [status, search, perPage, sort]);

    const totalPages = Math.max(1, Math.ceil(collection.total / perPage));
    const start = collection.total ? (collection.page - 1) * collection.perPage + 1 : 0;
    const end = collection.total ? Math.min(collection.total, start + collection.items.length - 1) : 0;
    const allSelected = collection.items.length > 0 && collection.items.every((item) => selected.includes(item.uuid));

    const create = async () => {
      if (!createTitle.trim()) return;
      if (!canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to create option sets.', 'wooptions-pro'));
        return;
      }
      setBusy(true);
      try {
        const result = await WooOptionsPro.Api.createOptionSet(createTitle);
        setCreateOpen(false); setCreateTitle(''); props.navigate(`builder/${result.uuid}`);
      } catch (reason) { setError(WooOptionsPro.Utils.errorMessage(reason)); }
      finally { setBusy(false); }
    };

    const exportItems = async (uuids: string[]) => {
      const exports = await Promise.all(uuids.map((uuid) => WooOptionsPro.Api.exportOptionSet(uuid)));
      WooOptionsPro.Utils.downloadJson(uuids.length === 1 ? `wooptions-pro-${uuids[0]}.json` : `wooptions-pro-option-sets-${Date.now()}.json`, uuids.length === 1 ? exports[0] : { exportSchemaVersion: 1, exportedAtGmt: new Date().toISOString(), optionSets: exports });
    };

    const updateStatus = async (uuid: string, nextStatus: WooOptionsPro.OptionSetStatus) => {
      if (!canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to modify option sets.', 'wooptions-pro'));
        return;
      }
      await WooOptionsPro.Api.updateOptionSet(uuid, { status: nextStatus });
    };

    const rowAction = async (item: WooOptionsPro.OptionSetRecord, action: string) => {
      if (action !== 'export' && action !== 'edit' && !canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to modify option sets.', 'wooptions-pro'));
        return;
      }
      setBusy(true);
      try {
        if (action === 'edit') props.navigate(`builder/${item.uuid}`);
        if (action === 'export') await exportItems([item.uuid]);
        if (action === 'duplicate') await WooOptionsPro.Api.duplicateOptionSet(item.uuid);
        if (action === 'activate' || action === 'restore') await updateStatus(item.uuid, 'active');
        if (action === 'deactivate') await updateStatus(item.uuid, 'inactive');
        if (action === 'archive') await updateStatus(item.uuid, 'archived');
        if (action === 'delete') { setDeleteTarget(item); return; }
        load();
      } catch (reason) { setError(WooOptionsPro.Utils.errorMessage(reason)); }
      finally { setBusy(false); }
    };

    const bulk = async (action: BulkAction) => {
      if (!selected.length) return;
      if (action !== 'export' && !canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to modify option sets.', 'wooptions-pro'));
        return;
      }
      if (action === 'delete') {
        const target = collection.items.find((item) => item.uuid === selected[0]);
        if (target) setDeleteTarget({ ...target, title: selected.length > 1 ? `${selected.length} selected option sets` : target.title });
        return;
      }
      setBusy(true);
      try {
        if (action === 'export') await exportItems(selected);
        else await Promise.all(selected.map((uuid) => updateStatus(uuid, action === 'activate' || action === 'restore' ? 'active' : action === 'deactivate' ? 'inactive' : 'archived')));
        setSelected([]); load();
      } catch (reason) { setError(WooOptionsPro.Utils.errorMessage(reason)); }
      finally { setBusy(false); }
    };

    const confirmDelete = async () => {
      if (!deleteTarget) return;
      if (!canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to delete option sets.', 'wooptions-pro'));
        return;
      }
      setBusy(true);
      try {
        const targets = deleteTarget.title.includes('selected option sets') ? selected : [deleteTarget.uuid];
        await Promise.all(targets.map((uuid) => WooOptionsPro.Api.deleteOptionSet(uuid)));
        setDeleteTarget(null); setSelected([]); load();
      } catch (reason) { setError(WooOptionsPro.Utils.errorMessage(reason)); }
      finally { setBusy(false); }
    };

    const pages = useMemo(() => {
      const values: number[] = [];
      const min = Math.max(1, Math.min(page - 2, totalPages - 4));
      const max = Math.min(totalPages, min + 4);
      for (let value = min; value <= max; value += 1) values.push(value);
      return values;
    }, [page, totalPages]);

    return <div className="wof-page">
      <WooOptionsPro.Components.PageHeader eyebrow={__('Configuration library', 'wooptions-pro')} title={__('Option Sets', 'wooptions-pro')} description={__('Design once, assign precisely, and preserve every published revision.', 'wooptions-pro')} actions={<><Button variant="secondary" onClick={() => props.navigate('templates')}>{__('Browse templates', 'wooptions-pro')}</Button><Button variant="primary" onClick={() => { if (!canConfigure) { WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to create option sets.', 'wooptions-pro')); return; } setCreateOpen(true); }}><WooOptionsPro.Components.Dashicon name="plus-alt2" />{__('New option set', 'wooptions-pro')}</Button></>} />
      {error ? <WooOptionsPro.Components.InlineNotice type="error" onClose={() => setError('')}>{error}</WooOptionsPro.Components.InlineNotice> : null}
      <section className="wof-panel wof-library-panel">
        <div className="wof-library-toolbar">
          <div className="wof-segmented-tabs" role="tablist">
            {(['active', 'inactive', 'archived'] as WooOptionsPro.OptionSetStatus[]).map((value) => <button type="button" role="tab" aria-selected={status === value} className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)} key={value}>{value === 'active' ? __('Active', 'wooptions-pro') : value === 'inactive' ? __('Deactivated', 'wooptions-pro') : __('Archived', 'wooptions-pro')}</button>)}
          </div>
          <div className="wof-toolbar-controls"><SearchControl label={__('Search option sets', 'wooptions-pro')} value={search} onChange={setSearch} placeholder={__('Search name or UUID…', 'wooptions-pro')} /><SelectControl label={__('Sort option sets', 'wooptions-pro')} hideLabelFromVision value={sort} onChange={setSort} options={[{ label: __('Recently updated', 'wooptions-pro'), value: 'updated_at_gmt' }, { label: __('Recently created', 'wooptions-pro'), value: 'created_at_gmt' }, { label: __('Title A–Z', 'wooptions-pro'), value: 'title' }]} /></div>
        </div>
        {selected.length ? <div className="wof-bulk-bar wof-bulk-bar--modern">
          <strong>{selected.length} {selected.length === 1 ? __('item selected', 'wooptions-pro') : __('items selected', 'wooptions-pro')}</strong>
          {status === 'active' ? <Button variant="tertiary" disabled={busy} onClick={() => bulk('deactivate')}><WooOptionsPro.Components.Dashicon name="hidden" />{__('Deactivate', 'wooptions-pro')}</Button> : null}
          {status === 'inactive' ? <Button variant="tertiary" disabled={busy} onClick={() => bulk('activate')}><WooOptionsPro.Components.Dashicon name="yes-alt" />{__('Activate', 'wooptions-pro')}</Button> : null}
          {status !== 'archived' ? <Button variant="tertiary" disabled={busy} onClick={() => bulk('archive')}><WooOptionsPro.Components.Dashicon name="archive" />{__('Archive', 'wooptions-pro')}</Button> : <Button variant="tertiary" disabled={busy} onClick={() => bulk('restore')}><WooOptionsPro.Components.Dashicon name="image-rotate" />{__('Restore', 'wooptions-pro')}</Button>}
          <Button variant="tertiary" disabled={busy} onClick={() => bulk('export')}><WooOptionsPro.Components.Dashicon name="download" />{__('Export', 'wooptions-pro')}</Button>
          <Button variant="tertiary" isDestructive disabled={busy} onClick={() => bulk('delete')}><WooOptionsPro.Components.Dashicon name="trash" />{__('Delete', 'wooptions-pro')}</Button>
          <Button variant="tertiary" disabled={busy} onClick={() => setSelected([])}>{__('Clear', 'wooptions-pro')}</Button>
        </div> : null}
        <div className="wof-option-set-results">
          {loading && collection.items.length ? <div className="wof-table-loading-overlay" role="status"><span className="wof-loader" aria-hidden="true" /><small>{__('Refreshing option sets…', 'wooptions-pro')}</small></div> : null}
          <div className={WooOptionsPro.Utils.classNames('wof-set-table-wrap', loading && 'is-loading')}>
            <table className="wof-set-table wof-set-table--managed"><thead><tr><th className="wof-check-cell"><input className="wof-table-checkbox" type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? selected.filter((uuid) => !collection.items.some((item) => item.uuid === uuid)) : Array.from(new Set([...selected, ...collection.items.map((item) => item.uuid)])))} aria-label={__('Select all on this page', 'wooptions-pro')} /></th><th>{__('Title', 'wooptions-pro')}</th><th>{__('Status', 'wooptions-pro')}</th><th>{__('Options applied', 'wooptions-pro')}</th><th>{__('Updated', 'wooptions-pro')}</th><th className="wof-actions-heading">{__('Actions', 'wooptions-pro')}</th></tr></thead><tbody>{collection.items.map((item) => <tr key={item.uuid} className={selected.includes(item.uuid) ? 'is-selected' : ''}><td className="wof-check-cell"><input className="wof-table-checkbox" type="checkbox" checked={selected.includes(item.uuid)} onChange={() => setSelected(selected.includes(item.uuid) ? selected.filter((uuid) => uuid !== item.uuid) : [...selected, item.uuid])} aria-label={__('Select option set', 'wooptions-pro')} /></td><td><button type="button" className="wof-set-title" onClick={() => props.navigate(`builder/${item.uuid}`)}><span className="wof-set-glyph"><WooOptionsPro.Components.Dashicon name="screenoptions" /></span><span><strong>{item.title}</strong><small>{item.uuid}</small></span></button></td><td><WooOptionsPro.Components.StatusPill status={item.status} /></td><td><strong className={WooOptionsPro.Utils.classNames('wof-field-count', (item.fieldCount ?? 0) > 0 && 'has-count')}>{item.fieldCount ?? 0}</strong></td><td><time>{WooOptionsPro.Utils.formatDate(item.updatedAtGmt)}</time></td><td className="wof-actions-cell"><ActionMenu item={item} onAction={(action) => rowAction(item, action)} /></td></tr>)}</tbody></table>
            {!loading && !collection.items.length ? <WooOptionsPro.Components.EmptyState icon="screenoptions" title={__('No option sets found', 'wooptions-pro')} description={__('Try another status or search, or create a new option set.', 'wooptions-pro')} action={<Button variant="primary" onClick={() => setCreateOpen(true)}>{__('Create option set', 'wooptions-pro')}</Button>} /> : null}
            {loading && !collection.items.length ? <WooOptionsPro.Components.Loading label={__('Organizing option sets…', 'wooptions-pro')} /> : null}
          </div>
        </div>
        <nav className="wof-pagination" aria-label={__('Option set pagination', 'wooptions-pro')}>
          <label className="wof-pagination__length"><span>{__('Show', 'wooptions-pro')}</span><select value={perPage} disabled={loading} onChange={(event: Event) => setPerPage(Number((event.target as HTMLSelectElement).value))}>{[10, 25, 50, 100].map((value) => <option value={value} key={value}>{value}</option>)}</select><span>{__('entries', 'wooptions-pro')}</span></label>
          <span className="wof-pagination__summary">{__('Showing', 'wooptions-pro')} {start}–{end} {__('of', 'wooptions-pro')} {collection.total}</span>
          <div className="wof-pagination__controls"><button type="button" className="wof-pagination__direction" disabled={page <= 1 || loading} onClick={() => setPage(Math.max(1, page - 1))}>{__('Previous', 'wooptions-pro')}</button>{pages.map((value) => <button type="button" key={value} className={page === value ? 'is-current' : ''} aria-current={page === value ? 'page' : undefined} disabled={loading} onClick={() => setPage(value)}>{value}</button>)}<button type="button" className="wof-pagination__direction" disabled={page >= totalPages || loading} onClick={() => setPage(Math.min(totalPages, page + 1))}>{__('Next', 'wooptions-pro')}</button></div>
        </nav>
      </section>
      {createOpen ? <Modal title={__('Create an option set', 'wooptions-pro')} onRequestClose={() => !busy && setCreateOpen(false)} className="wof-modal"><TextControl label={__('Option set title', 'wooptions-pro')} value={createTitle} onChange={setCreateTitle} autoFocus /><div className="wof-modal__actions"><Button variant="tertiary" onClick={() => setCreateOpen(false)}>{__('Cancel', 'wooptions-pro')}</Button><Button variant="primary" isBusy={busy} disabled={!createTitle.trim()} onClick={create}>{__('Create and open', 'wooptions-pro')}</Button></div></Modal> : null}
      {deleteTarget ? <WooOptionsPro.Components.ConfirmModal title={__('Delete permanently?', 'wooptions-pro')} message={__('This removes the option set and its complete revision history. This action cannot be undone.', 'wooptions-pro')} confirmLabel={__('Delete permanently', 'wooptions-pro')} busy={busy} destructive onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} /> : null}
    </div>;
  }
}
