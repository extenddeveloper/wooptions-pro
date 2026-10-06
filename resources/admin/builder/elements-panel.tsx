namespace WooOptionsPro.Builder {
  const { SearchControl } = wp.components;
  const { __ } = wp.i18n;
  const { useMemo, useState } = wp.element;

  const groupLabels: Record<string, string> = {
    choice: __('Choices', 'wooptions-pro'),
    boolean: __('Yes / no', 'wooptions-pro'),
    scalar: __('Inputs', 'wooptions-pro'),
    upload: __('Assets', 'wooptions-pro'),
    calculated: __('Pricing & outputs', 'wooptions-pro'),
    repeater: __('Structure', 'wooptions-pro'),
    content: __('Content', 'wooptions-pro'),
  };

  function ElementItem(props: { type: string; label: string; onAdd: (field: WooOptionsPro.FieldDefinition) => void }): any {
    const dragStart = (event: DragEvent) => {
      event.dataTransfer?.setData('application/x-wooptions-pro-field-type', props.type);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    };
    return <button type="button" draggable className="wof-palette-item" onDragStart={dragStart} onClick={() => props.onAdd(WooOptionsPro.FieldFactory.create(props.type))}>
      <span className="wof-palette-item__grip"><WooOptionsPro.Components.GripIcon /></span>
      <span className="wof-palette-item__icon"><WooOptionsPro.Components.FieldIcon type={props.type} /></span>
      <strong>{props.label}</strong>
    </button>;
  }

  export function ElementsPanel(props: { onAdd: (field: WooOptionsPro.FieldDefinition) => void; onOpenStyle: () => void }): any {
    const [search, setSearch] = useState('');
    const groups = useMemo(() => {
      const term = search.trim().toLowerCase();
      const map = new Map<string, Array<{ type: string; label: string }>>();
      Object.entries(window.WooOptionsProAdmin.fieldTypes).forEach(([type, manifest]) => {
        const groupLabel = groupLabels[manifest.group] ?? manifest.group;
        if (term && !`${type} ${manifest.label} ${manifest.group} ${groupLabel}`.toLowerCase().includes(term)) return;
        const items = map.get(manifest.group) ?? [];
        items.push({ type, label: manifest.label });
        map.set(manifest.group, items);
      });
      return map;
    }, [search]);
    return <aside className="wof-builder-palette">
      <div className="wof-builder-pane__heading wof-palette-heading"><div><h2>{__('Elements', 'wooptions-pro')}</h2><p>{__('Drag or click to add to the live product form', 'wooptions-pro')}</p></div><button type="button" className="wof-pane-action" onClick={props.onOpenStyle} aria-label={__('Open Style Studio', 'wooptions-pro')} title={__('Open Style Studio', 'wooptions-pro')}><WooOptionsPro.Components.PaletteIcon size={18} /></button></div>
      <SearchControl label={__('Search field types', 'wooptions-pro')} value={search} onChange={setSearch} placeholder={__('Find a field…', 'wooptions-pro')} />
      <div className="wof-palette-groups">{Array.from(groups.entries()).map(([group, items]) => <section key={group}><h3>{groupLabels[group] ?? group}</h3><div>{items.map((item) => <ElementItem key={item.type} type={item.type} label={item.label} onAdd={props.onAdd} />)}</div></section>)}{!groups.size ? <p className="wof-palette-empty">{__('No fields match that search.', 'wooptions-pro')}</p> : null}</div>
      <p className="wof-palette-tip"><WooOptionsPro.Components.GripIcon />{__('Click to add, or drag a field onto the canvas.', 'wooptions-pro')}</p>
    </aside>;
  }
}
