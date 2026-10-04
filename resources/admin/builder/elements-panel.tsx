namespace WooptionsFic.Builder {
  const { SearchControl } = wp.components;
  const { __ } = wp.i18n;
  const { useMemo, useState } = wp.element;

  const groupLabels: Record<string, string> = {
    choice: __('Choices', 'wooptionsfic'),
    boolean: __('Yes / no', 'wooptionsfic'),
    scalar: __('Inputs', 'wooptionsfic'),
    upload: __('Assets', 'wooptionsfic'),
    calculated: __('Pricing & outputs', 'wooptionsfic'),
    repeater: __('Structure', 'wooptionsfic'),
    content: __('Content', 'wooptionsfic'),
  };

  function ElementItem(props: { type: string; label: string; onAdd: (field: WooptionsFic.FieldDefinition) => void }): any {
    const dragStart = (event: DragEvent) => {
      event.dataTransfer?.setData('application/x-wooptionsfic-field-type', props.type);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    };
    return <button type="button" draggable className="wof-palette-item" onDragStart={dragStart} onClick={() => props.onAdd(WooptionsFic.FieldFactory.create(props.type))}>
      <span className="wof-palette-item__grip"><WooptionsFic.Components.GripIcon /></span>
      <span className="wof-palette-item__icon"><WooptionsFic.Components.FieldIcon type={props.type} /></span>
      <strong>{props.label}</strong>
    </button>;
  }

  export function ElementsPanel(props: { onAdd: (field: WooptionsFic.FieldDefinition) => void; onOpenStyle: () => void }): any {
    const [search, setSearch] = useState('');
    const groups = useMemo(() => {
      const term = search.trim().toLowerCase();
      const map = new Map<string, Array<{ type: string; label: string }>>();
      Object.entries(window.WooptionsFicAdmin.fieldTypes).forEach(([type, manifest]) => {
        const groupLabel = groupLabels[manifest.group] ?? manifest.group;
        if (term && !`${type} ${manifest.label} ${manifest.group} ${groupLabel}`.toLowerCase().includes(term)) return;
        const items = map.get(manifest.group) ?? [];
        items.push({ type, label: manifest.label });
        map.set(manifest.group, items);
      });
      return map;
    }, [search]);
    return <aside className="wof-builder-palette">
      <div className="wof-builder-pane__heading wof-palette-heading"><div><h2>{__('Elements', 'wooptionsfic')}</h2><p>{__('Drag or click to add to the live product form', 'wooptionsfic')}</p></div><button type="button" className="wof-pane-action" onClick={props.onOpenStyle} aria-label={__('Open Style Studio', 'wooptionsfic')}><WooptionsFic.Components.Dashicon name="ellipsis" /></button></div>
      <SearchControl label={__('Search field types', 'wooptionsfic')} value={search} onChange={setSearch} placeholder={__('Find a field…', 'wooptionsfic')} />
      <div className="wof-palette-groups">{Array.from(groups.entries()).map(([group, items]) => <section key={group}><h3>{groupLabels[group] ?? group}</h3><div>{items.map((item) => <ElementItem key={item.type} type={item.type} label={item.label} onAdd={props.onAdd} />)}</div></section>)}{!groups.size ? <p className="wof-palette-empty">{__('No fields match that search.', 'wooptionsfic')}</p> : null}</div>
      <p className="wof-palette-tip"><WooptionsFic.Components.GripIcon />{__('Click to add, or drag a field onto the canvas.', 'wooptionsfic')}</p>
    </aside>;
  }
}
