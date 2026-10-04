namespace WooOptionsPro.Builder {
  const { __ } = wp.i18n;
  const { useEffect, useMemo, useState } = wp.element;
  const FIELD_TYPE_MIME = 'application/x-wooptions-pro-field-type';
  const FIELD_INDEX_MIME = 'application/x-wooptions-pro-field-index';
  const FIELD_UUID_MIME = 'application/x-wooptions-pro-field-uuid';
  const FIELD_CHILD_INDEX_MIME = 'application/x-wooptions-pro-child-index';

  function hasBuilderDrag(event: DragEvent): boolean {
    const types = Array.from(event.dataTransfer?.types ?? []);
    return types.includes(FIELD_TYPE_MIME) || types.includes(FIELD_INDEX_MIME) || types.includes(FIELD_UUID_MIME) || types.includes(FIELD_CHILD_INDEX_MIME);
  }

  function getFormulaPreviewAmount(field: WooOptionsPro.FieldDefinition): string {
    const mode = field.displayMode || 'currency';
    const decimals = Math.max(0, Math.min(6, field.decimalPlaces ?? 2));
    const adminConfig = (window as any).WooOptionsProAdmin;
    const currencySymbol = adminConfig?.currencySymbol || adminConfig?.currency || '$';
    const currencyPos = adminConfig?.currencyPosition || 'left_space';
    let prefix = field.prefix ?? '';
    const suffix = field.suffix || '';
    if (mode === 'text') {
      return `${prefix}Sample output${suffix}`;
    }
    const sampleNum = (123).toFixed(decimals);
    if (!prefix) {
      if (currencyPos === 'right') return `${sampleNum}${currencySymbol}${suffix}`;
      if (currencyPos === 'right_space') return `${sampleNum} ${currencySymbol}${suffix}`;
      if (currencyPos === 'left') return `${currencySymbol}${sampleNum}${suffix}`;
      return `${currencySymbol} ${sampleNum}${suffix}`;
    }
    return `${prefix}${sampleNum}${suffix}`;
  }

  function NestedCanvasField(props: {
    parentUuid: string;
    child: WooOptionsPro.FieldDefinition;
    index: number;
    count: number;
    selected: boolean;
    onSelect: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onMove: (from: number, to: number) => void;
  }): any {
    const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);

    const dragStart = (event: DragEvent) => {
      event.stopPropagation();
      event.dataTransfer?.setData(FIELD_CHILD_INDEX_MIME, String(props.index));
      event.dataTransfer?.setData(FIELD_UUID_MIME, props.child.uuid);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };

    const dragOver = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const element = event.currentTarget as HTMLElement;
      const bounds = element.getBoundingClientRect();
      setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
    };

    const dragLeave = (event: DragEvent) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setDropEdge(null);
    };

    const drop = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const sourceChild = Number(event.dataTransfer?.getData(FIELD_CHILD_INDEX_MIME));
      const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
      setDropEdge(null);
      if (Number.isInteger(sourceChild) && sourceChild >= 0) {
        let finalIndex = insertIndex;
        if (sourceChild < insertIndex) finalIndex -= 1;
        finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
        if (finalIndex !== sourceChild) props.onMove(sourceChild, finalIndex);
      }
    };

    const width = props.child.width || '100%';
    const typeLabel = window.WooOptionsProAdmin?.fieldTypes?.[props.child.type]?.label ?? props.child.type;

    return (
      <article
        className={WooOptionsPro.Utils.classNames(
          'wof-canvas-field',
          'wof-nested-canvas-field',
          props.selected && 'is-selected',
          props.child.disabled && 'is-disabled',
          dropEdge === 'before' && 'is-drop-before',
          dropEdge === 'after' && 'is-drop-after',
          props.child.type === 'formula' && 'wof-canvas-field--formula',
          `wof-canvas-field--width-${width.replace('%', '')}`
        )}
        style={{
          width: width === '33%' ? 'calc(33.333% - 8px)' : width === '50%' ? 'calc(50% - 8px)' : width === '66%' ? 'calc(66.666% - 8px)' : '100%',
          flex: width === '33%' ? '0 0 calc(33.333% - 8px)' : width === '50%' ? '0 0 calc(50% - 8px)' : width === '66%' ? '0 0 calc(66.666% - 8px)' : '0 0 100%',
          boxSizing: 'border-box',
        }}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
        onClick={(e: any) => {
          e.stopPropagation();
          props.onSelect();
        }}
        data-field-uuid={props.child.uuid}
      >
        {props.selected ? (
          <span className="wof-canvas-field__type-badge">{typeLabel}</span>
        ) : null}

        <div className="wof-canvas-field__toolbar" onClick={(event: Event) => event.stopPropagation()}>
          <button type="button" draggable className="wof-canvas-field__drag-handle" onDragStart={dragStart} onDragEnd={() => setDropEdge(null)} aria-label={__('Drag field', 'wooptions-pro')} title={__('Drag to reorder', 'wooptions-pro')}><WooOptionsPro.Components.GripIcon /></button>
          <button type="button" onClick={props.onSelect} aria-label={__('Field settings', 'wooptions-pro')} title={__('Settings', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="admin-generic" /></button>
          <button type="button" onClick={props.onDuplicate} aria-label={__('Duplicate field', 'wooptions-pro')} title={__('Duplicate', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="admin-page" /></button>
          <button type="button" className="is-destructive" onClick={props.onDelete} aria-label={__('Delete field', 'wooptions-pro')} title={__('Delete', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="trash" /></button>
        </div>

        <div className="wof-canvas-field__copy">
          <strong className="wof-canvas-field__title">
            {props.child.label || __('Untitled field', 'wooptions-pro')}
            {props.child.help && props.child.helpTextPosition === 'tooltip' ? (
              <span
                className="wof-field__tooltip-preview"
                title={props.child.help}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /></svg>
              </span>
            ) : null}
          </strong>
          {props.child.type === 'formula' ? (
            <span className="wof-canvas-field__formula-val">
              {getFormulaPreviewAmount(props.child)}
            </span>
          ) : null}
          {props.child.required ? <span className="wof-canvas-field__required">{__('REQUIRED', 'wooptions-pro')}</span> : null}
        </div>

        {props.child.type !== 'formula' ? (
          <div className="wof-canvas-field__preview">
            <FieldPreview field={props.child} />
          </div>
        ) : null}
      </article>
    );
  }

  function CanvasSectionField(props: {
    field: WooOptionsPro.FieldDefinition;
    allFields?: WooOptionsPro.FieldDefinition[];
    index: number;
    count: number;
    selected: boolean;
    selectedUuid?: string | null;
    onSelect: () => void;
    onSelectUuid?: (uuid: string) => void;
    onAdd: (field: WooOptionsPro.FieldDefinition, index?: number) => void;
    onAddChild?: (parentUuid: string, field: WooOptionsPro.FieldDefinition, index?: number) => void;
    onMove: (from: number, to: number) => void;
    onMoveChild?: (parentUuid: string, from: number, to: number) => void;
    onMoveToParent?: (fieldUuid: string, parentUuid: string, index?: number) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onDeleteField?: (uuid: string) => void;
  }): any {
    const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);
    const [innerDropActive, setInnerDropActive] = useState(false);
    const [isExpanded, setIsExpanded] = useState(props.field.initialState !== 'close');

    useEffect(() => {
      setIsExpanded(props.field.initialState !== 'close');
    }, [props.field.initialState]);

    const dragStart = (event: DragEvent) => {
      event.stopPropagation();
      event.dataTransfer?.setData(FIELD_INDEX_MIME, String(props.index));
      event.dataTransfer?.setData(FIELD_UUID_MIME, props.field.uuid);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };

    const dragOver = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
      const element = event.currentTarget as HTMLElement;
      const bounds = element.getBoundingClientRect();
      setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
    };

    const dragLeave = (event: DragEvent) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setDropEdge(null);
    };

    const drop = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
      const sourceText = event.dataTransfer?.getData(FIELD_INDEX_MIME) ?? '';
      const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
      setDropEdge(null);

      if (type) {
        props.onAdd(WooOptionsPro.FieldFactory.create(type), insertIndex);
        return;
      }

      const source = Number(sourceText);
      if (!Number.isInteger(source)) return;
      let finalIndex = insertIndex;
      if (source < insertIndex) finalIndex -= 1;
      finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
      if (finalIndex !== source) props.onMove(source, finalIndex);
    };

    const innerDragOver = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setInnerDropActive(true);
      if (event.dataTransfer) event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
    };

    const innerDragLeave = (event: DragEvent) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setInnerDropActive(false);
    };

    const innerDrop = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setInnerDropActive(false);

      const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
      const fieldUuid = event.dataTransfer?.getData(FIELD_UUID_MIME) ?? '';

      if (type) {
        props.onAddChild?.(props.field.uuid, WooOptionsPro.FieldFactory.create(type));
        return;
      }

      if (fieldUuid && fieldUuid !== props.field.uuid) {
        props.onMoveToParent?.(fieldUuid, props.field.uuid);
      }
    };

    const width = props.field.width || '100%';
    const widthStyle: any = {
      width: width === '33%' ? 'calc(33.333% - 8px)' : width === '50%' ? 'calc(50% - 8px)' : width === '66%' ? 'calc(66.666% - 8px)' : '100%',
      flex: width === '33%' ? '0 0 calc(33.333% - 8px)' : width === '50%' ? '0 0 calc(50% - 8px)' : width === '66%' ? '0 0 calc(66.666% - 8px)' : '0 0 100%',
      boxSizing: 'border-box',
    };

    const styleVariant = props.field.sectionStyle || 'section';
    const isAccordion = styleVariant === 'accordion';
    const children = props.field.children ?? [];

    const adminConfig = (window as any).WooOptionsProAdmin;
    const currency = adminConfig?.currencySymbol || adminConfig?.currency || '$';

    let priceLabel = '';
    if (props.field.repeatPriceType === 'fixed') {
      if (props.field.repeatSalePrice && props.field.repeatRegularPrice) {
        priceLabel = `${currency} ${props.field.repeatSalePrice}`;
      } else if (props.field.repeatRegularPrice) {
        priceLabel = `${currency} ${props.field.repeatRegularPrice}`;
      }
    } else if (props.field.repeatPriceType === 'percentage' && props.field.repeatRegularPrice) {
      priceLabel = `${props.field.repeatRegularPrice}%`;
    }

    const itemTitle = (props.field.repeatLabel || 'Item {n}').replace('{n}', '1');

    return (
      <article
        className={WooOptionsPro.Utils.classNames(
          'wof-canvas-field',
          'wof-canvas-section',
          `wof-canvas-section--${styleVariant}`,
          props.selected && 'is-selected',
          props.field.disabled && 'is-disabled',
          dropEdge === 'before' && 'is-drop-before',
          dropEdge === 'after' && 'is-drop-after',
          `wof-canvas-field--width-${width.replace('%', '')}`
        )}
        style={widthStyle}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
        onClick={props.onSelect}
        data-field-uuid={props.field.uuid}
      >
        {props.selected ? (
          <span className="wof-canvas-field__type-badge">
            {__('Repeatable Section', 'wooptions-pro')}
          </span>
        ) : null}

        <div className="wof-canvas-field__toolbar" onClick={(event: Event) => event.stopPropagation()}>
          <button type="button" draggable className="wof-canvas-field__drag-handle" onDragStart={dragStart} onDragEnd={() => setDropEdge(null)} aria-label={__('Drag section', 'wooptions-pro')} title={__('Drag to reorder', 'wooptions-pro')}><WooOptionsPro.Components.GripIcon /></button>
          <button type="button" onClick={props.onSelect} aria-label={__('Section settings', 'wooptions-pro')} title={__('Settings', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="admin-generic" /></button>
          <button type="button" onClick={props.onDuplicate} aria-label={__('Duplicate section', 'wooptions-pro')} title={__('Duplicate', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="admin-page" /></button>
          <button type="button" className="is-destructive" onClick={props.onDelete} aria-label={__('Delete section', 'wooptions-pro')} title={__('Delete', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="trash" /></button>
        </div>

        {/* Section Header */}
        {!props.field.hideSectionTitle ? (
          <div
            className={WooOptionsPro.Utils.classNames(
              'wof-canvas-section__header',
              isAccordion && 'is-accordion-trigger'
            )}
            onClick={(e: any) => {
              if (isAccordion) {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }
            }}
          >
            <strong className="wof-canvas-section__title">
              {props.field.label || __('Section Container', 'wooptions-pro')}
              {props.field.help && props.field.helpTextPosition === 'tooltip' ? (
                <span
                  className="wof-field__tooltip-preview"
                  title={props.field.help}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </span>
              ) : null}
            </strong>
            {isAccordion ? (
              <span className={WooOptionsPro.Utils.classNames('wof-canvas-section__chevron', isExpanded && 'is-open')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </span>
            ) : null}
          </div>
        ) : null}

        {props.field.help && (props.field.helpTextPosition === 'below_title' || !props.field.helpTextPosition) && !props.field.hideSectionTitle ? (
          <p className="wof-canvas-field__help-text wof-canvas-field__help-text--below-title" style={{ margin: '-4px 0 12px 0' }}>
            {props.field.help}
          </p>
        ) : null}

        {/* Section Body (Collapsible for Accordion) */}
        {(!isAccordion || isExpanded) ? (
          <div className="wof-canvas-section__body">
            {/* Repeater Item Header */}
            {props.field.repeatable ? (
              <div className="wof-canvas-section__item-header">
                <span className="wof-canvas-section__item-title">{itemTitle}</span>
                {priceLabel ? <span className="wof-canvas-section__item-price">{priceLabel}</span> : null}
              </div>
            ) : null}

            {/* Nested Children Fields */}
            {children.length > 0 ? (
              <div className="wof-canvas-section__children-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                {children.map((child, cIdx) => (
                  <NestedCanvasField
                    key={child.uuid}
                    parentUuid={props.field.uuid}
                    child={child}
                    index={cIdx}
                    count={children.length}
                    selected={child.uuid === props.selectedUuid}
                    onSelect={() => props.onSelectUuid?.(child.uuid)}
                    onDuplicate={() => props.onAddChild?.(props.field.uuid, WooOptionsPro.FieldFactory.duplicate(child))}
                    onDelete={() => props.onDeleteField?.(child.uuid)}
                    onMove={(from, to) => props.onMoveChild?.(props.field.uuid, from, to)}
                  />
                ))}
              </div>
            ) : null}

            {/* Inner Drop Zone with center blue + button (Mockup 3) */}
            <div
              className={WooOptionsPro.Utils.classNames(
                'wof-canvas-section__dropzone',
                innerDropActive && 'is-drag-over'
              )}
              onDragOver={innerDragOver}
              onDragLeave={innerDragLeave}
              onDrop={innerDrop}
            >
              <div className="wof-canvas-section__dropzone-inner">
                <button
                  type="button"
                  className="wof-canvas-section__add-btn"
                  title={__('Add field to section', 'wooptions-pro')}
                  onClick={(e: any) => {
                    e.stopPropagation();
                    props.onAddChild?.(props.field.uuid, WooOptionsPro.FieldFactory.create('text'));
                  }}
                >
                  <WooOptionsPro.Components.Dashicon name="plus-alt2" />
                </button>
              </div>
            </div>

            {/* Bottom Add Another / Quantity Selector Footer */}
            {props.field.repeatable ? (
              props.field.repeatMethod === 'quantity' ? (
                <div className="wof-canvas-section__qty-preview">
                  <span className="wof-canvas-section__qty-label">{__('Quantity', 'wooptions-pro')}</span>
                  <div className="wof-qty-stepper">
                    <button type="button" disabled>−</button>
                    <span>1</span>
                    <button type="button" disabled>+</button>
                  </div>
                </div>
              ) : (
                <div className="wof-canvas-section__footer">
                  <button type="button" className="wof-canvas-section__add-another-btn">
                    {props.field.buttonLabel || __('Add Another', 'wooptions-pro')}
                  </button>
                </div>
              )
            ) : null}
          </div>
        ) : null}

        {props.field.help && props.field.helpTextPosition === 'below_field' ? (
          <p className="wof-canvas-field__help-text wof-canvas-field__help-text--below-field" style={{ margin: '12px 0 0 0' }}>
            {props.field.help}
          </p>
        ) : null}
      </article>
    );
  }

  function CanvasField(props: {
    field: WooOptionsPro.FieldDefinition;
    allFields?: WooOptionsPro.FieldDefinition[];
    index: number;
    count: number;
    selected: boolean;
    selectedUuid?: string | null;
    onSelect: () => void;
    onSelectUuid?: (uuid: string) => void;
    onAdd: (field: WooOptionsPro.FieldDefinition, index?: number) => void;
    onAddChild?: (parentUuid: string, field: WooOptionsPro.FieldDefinition, index?: number) => void;
    onMove: (from: number, to: number) => void;
    onMoveChild?: (parentUuid: string, from: number, to: number) => void;
    onMoveToParent?: (fieldUuid: string, parentUuid: string, index?: number) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onDeleteField?: (uuid: string) => void;
  }): any {
    const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);

    const dragStart = (event: DragEvent) => {
      event.stopPropagation();
      event.dataTransfer?.setData(FIELD_INDEX_MIME, String(props.index));
      event.dataTransfer?.setData(FIELD_UUID_MIME, props.field.uuid);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };

    if (props.field.type === 'repeater') {
      return (
        <CanvasSectionField
          field={props.field}
          allFields={props.allFields}
          index={props.index}
          count={props.count}
          selected={props.selected}
          selectedUuid={props.selectedUuid}
          onSelect={props.onSelect}
          onSelectUuid={props.onSelectUuid}
          onAdd={props.onAdd}
          onAddChild={props.onAddChild}
          onMove={props.onMove}
          onMoveChild={props.onMoveChild}
          onMoveToParent={props.onMoveToParent}
          onDuplicate={props.onDuplicate}
          onDelete={props.onDelete}
          onDeleteField={props.onDeleteField}
        />
      );
    }

    const dragOver = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
      const element = event.currentTarget as HTMLElement;
      const bounds = element.getBoundingClientRect();
      setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
    };

    const dragLeave = (event: DragEvent) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setDropEdge(null);
    };

    const drop = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
      const sourceText = event.dataTransfer?.getData(FIELD_INDEX_MIME) ?? '';
      const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
      setDropEdge(null);

      if (type) {
        props.onAdd(WooOptionsPro.FieldFactory.create(type), insertIndex);
        return;
      }

      const source = Number(sourceText);
      if (!Number.isInteger(source)) return;
      let finalIndex = insertIndex;
      if (source < insertIndex) finalIndex -= 1;
      finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
      if (finalIndex !== source) props.onMove(source, finalIndex);
    };

    const width = props.field.width || '100%';
    const widthStyle: any = {
      width: width === '33%' ? 'calc(33.333% - 8px)' : width === '50%' ? 'calc(50% - 8px)' : width === '66%' ? 'calc(66.666% - 8px)' : '100%',
      flex: width === '33%' ? '0 0 calc(33.333% - 8px)' : width === '50%' ? '0 0 calc(50% - 8px)' : width === '66%' ? '0 0 calc(66.666% - 8px)' : '0 0 100%',
      boxSizing: 'border-box',
    };

    const typeLabel = window.WooOptionsProAdmin?.fieldTypes?.[props.field.type]?.label ?? props.field.type;
    const priceText = formatChoicePrice(props.field.pricing);
    const isContentBlock = ['spacer', 'separator', 'content', 'modal', 'heading', 'paragraph', 'help'].includes(props.field.type);

    return <article
      className={WooOptionsPro.Utils.classNames(
        'wof-canvas-field',
        props.selected && 'is-selected',
        props.field.disabled && 'is-disabled',
        dropEdge === 'before' && 'is-drop-before',
        dropEdge === 'after' && 'is-drop-after',
        isContentBlock && `wof-canvas-field--${props.field.type}`,
        props.field.type === 'formula' && 'wof-canvas-field--formula',
        `wof-canvas-field--width-${width.replace('%', '')}`
      )}
      style={widthStyle}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
      onClick={props.onSelect}
      data-field-uuid={props.field.uuid}
    >
      {props.selected ? (
        <span className="wof-canvas-field__type-badge">
          {typeLabel}
        </span>
      ) : null}

      <div className="wof-canvas-field__toolbar" onClick={(event: Event) => event.stopPropagation()}>
        <button type="button" draggable className="wof-canvas-field__drag-handle" onDragStart={dragStart} onDragEnd={() => setDropEdge(null)} aria-label={__('Drag field', 'wooptions-pro')} title={__('Drag to reorder', 'wooptions-pro')}><WooOptionsPro.Components.GripIcon /></button>
        <button type="button" onClick={props.onSelect} aria-label={__('Field settings', 'wooptions-pro')} title={__('Settings', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="admin-generic" /></button>
        <button type="button" onClick={props.onDuplicate} aria-label={__('Duplicate field', 'wooptions-pro')} title={__('Duplicate', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="admin-page" /></button>
        <button type="button" className="is-destructive" onClick={props.onDelete} aria-label={__('Delete field', 'wooptions-pro')} title={__('Delete', 'wooptions-pro')}><WooOptionsPro.Components.Dashicon name="trash" /></button>
      </div>

      {!isContentBlock ? (
        <div className="wof-canvas-field__copy">
          <strong className="wof-canvas-field__title">
            {props.field.label || __('Untitled field', 'wooptions-pro')}
            {props.field.help && props.field.helpTextPosition === 'tooltip' ? (
              <span
                className="wof-field__tooltip-preview"
                title={props.field.help}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
            ) : null}
          </strong>
          {props.field.type === 'formula' ? (
            <span className="wof-canvas-field__formula-val">
              {getFormulaPreviewAmount(props.field)}
            </span>
          ) : null}
          {priceText ? <span className="wof-canvas-field__price">{priceText}</span> : null}
          {props.field.required ? <span className="wof-canvas-field__required">{__('REQUIRED', 'wooptions-pro')}</span> : null}
          {props.field.help && (props.field.helpTextPosition === 'below_title' || !props.field.helpTextPosition) ? (
            <p className="wof-canvas-field__help-text wof-canvas-field__help-text--below-title">
              {props.field.help}
            </p>
          ) : null}
          {props.field.choices?.length ? (
            <small className="wof-canvas-field__meta">{props.field.choices.length} {__('Choices', 'wooptions-pro')}</small>
          ) : null}
        </div>
      ) : null}

      {props.field.type !== 'formula' ? (
        <div className="wof-canvas-field__preview"><FieldPreview field={props.field} allFields={props.allFields} /></div>
      ) : null}
      {props.field.help && props.field.helpTextPosition === 'below_field' && !isContentBlock ? (
        <p className="wof-canvas-field__help-text wof-canvas-field__help-text--below-field">
          {props.field.help}
        </p>
      ) : null}
    </article>;
  }

  export function Canvas(props: {
    document: WooOptionsPro.OptionSetDefinition;
    selectedUuid: string | null;
    device: WooOptionsPro.PreviewDevice;
    onSelect: (uuid: string) => void;
    onAdd: (field: WooOptionsPro.FieldDefinition, index?: number) => void;
    onAddChild?: (parentUuid: string, field: WooOptionsPro.FieldDefinition, index?: number) => void;
    onMove: (from: number, to: number) => void;
    onMoveChild?: (parentUuid: string, from: number, to: number) => void;
    onMoveToParent?: (fieldUuid: string, parentUuid: string, index?: number) => void;
    onDuplicate: (field: WooOptionsPro.FieldDefinition) => void;
    onDelete: (uuid: string) => void;
  }): any {
    const [zoom, setZoom] = useState(100);
    const [dragActive, setDragActive] = useState(false);
    const palette = window.WooOptionsProAdmin.palettes[props.document.style.palette] ?? window.WooOptionsProAdmin.palettes['iris-studio'];
    const tokens = { ...(palette?.tokens ?? {}), ...(props.document.style.overrides ?? {}) };
    const typography = props.document.style.typography ?? { family: 'inherit' };
    const fontStack: Record<string, string> = {
      inherit: 'inherit',
      'system-ui': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      Inter: 'Inter, system-ui, sans-serif',
      Manrope: 'Manrope, system-ui, sans-serif',
      Poppins: 'Poppins, system-ui, sans-serif',
      Outfit: 'Outfit, system-ui, sans-serif',
      'Plus Jakarta Sans': '"Plus Jakarta Sans", system-ui, sans-serif',
      Roboto: 'Roboto, system-ui, sans-serif',
    };
    const style = useMemo(() => ({
      '--wof-preview-primary': tokens.primary ?? '#5B4FF5',
      '--wof-preview-background': tokens.background ?? '#F7F7FC',
      '--wof-preview-surface': tokens.surface ?? '#FFFFFF',
      '--wof-preview-text': tokens.text ?? '#172033',
      '--wof-preview-muted': tokens.muted ?? '#5E6A7D',
      '--wof-preview-border': tokens.border ?? '#D8DEEA',
      '--wof-preview-danger': tokens.danger ?? '#C7353A',
      '--wof-preview-on-primary': tokens.onPrimary ?? '#FFFFFF',
      '--wof-preview-font': fontStack[typography.family] ?? typography.family ?? 'inherit',
      '--wof-preview-label-weight': String(typography.labelWeight ?? 600),
      '--wof-preview-body-weight': String(typography.bodyWeight ?? 400),
      zoom: zoom / 100,
    } as any), [props.document.style, zoom]);

    useEffect(() => {
      const reset = () => setDragActive(false);
      document.addEventListener('dragend', reset);
      document.addEventListener('drop', reset);
      return () => {
        document.removeEventListener('dragend', reset);
        document.removeEventListener('drop', reset);
      };
    }, []);

    const dropAtEnd = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
      const source = Number(event.dataTransfer?.getData(FIELD_INDEX_MIME));
      if (type) props.onAdd(WooOptionsPro.FieldFactory.create(type));
      else if (Number.isInteger(source)) props.onMove(source, props.document.fields.length - 1);
    };

    const canvasDragOver = (event: DragEvent) => {
      if (!hasBuilderDrag(event)) return;
      event.preventDefault();
      setDragActive(true);
      if (event.dataTransfer) event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
    };

    const canvasDragLeave = (event: DragEvent) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setDragActive(false);
    };

    return <section className={WooOptionsPro.Utils.classNames('wof-builder-canvas', 'is-edit-mode', dragActive && 'is-drag-active')}>
      <div className="wof-canvas-toolbar"><div className="wof-canvas-toolbar__copy"><h2>{__('Live storefront canvas', 'wooptions-pro')}</h2><p>{__('The builder and product page use the same component stylesheet.', 'wooptions-pro')}</p></div><div className="wof-canvas-toolbar__controls"><div className="wof-zoom-control"><button type="button" disabled={zoom <= 75} onClick={() => setZoom(Math.max(75, zoom - 10))}><WooOptionsPro.Components.Dashicon name="minus" /></button><output>{zoom}%</output><button type="button" disabled={zoom >= 125} onClick={() => setZoom(Math.min(125, zoom + 10))}><WooOptionsPro.Components.Dashicon name="plus-alt2" /></button></div><span className="wof-interactive-status"><i />{__('Interactive', 'wooptions-pro')}</span></div></div>
      <div className={`wof-canvas-device is-${props.device}`} style={style}>
        <div className="wof-canvas-device__chrome"><span>{__('Live customer preview', 'wooptions-pro')}</span><small>{props.device} · {props.document.layout.type}</small></div>
        <div className="wof-canvas-frame"><div className={WooOptionsPro.Utils.classNames('wof-canvas-sheet', dragActive && 'is-drag-active')} onDragEnter={canvasDragOver} onDragOver={canvasDragOver} onDragLeave={canvasDragLeave} onDrop={dropAtEnd}><div className="wof-product-shell"><aside className="wof-product-shell__media"><div className="wof-product-gallery__hero"><WooOptionsPro.Components.Dashicon name="format-image" /></div><div className="wof-product-gallery__thumbs"><div className="wof-product-gallery__thumb"><WooOptionsPro.Components.Dashicon name="format-image" /></div><div className="wof-product-gallery__thumb"><WooOptionsPro.Components.Dashicon name="format-image" /></div><div className="wof-product-gallery__thumb"><WooOptionsPro.Components.Dashicon name="format-image" /></div></div></aside><div className="wof-product-shell__content"><div className="wof-product-preview-meta"><span className="wof-product-preview-meta__eyebrow">{__('Live product preview', 'wooptions-pro')}</span><h1>{__('WooOptionsPro Product (Preview)', 'wooptions-pro')}</h1><strong className="wof-product-preview-meta__price">{`20.00 ${(window as any).WooOptionsProAdmin?.currency || 'USD'}`}</strong></div>{props.document.fields.length ? <div className={`wof-canvas-fields is-${props.document.layout.type}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start' }}>{props.document.fields.map((field, index) => <CanvasField key={field.uuid} field={field} allFields={props.document.fields} index={index} count={props.document.fields.length} selected={field.uuid === props.selectedUuid} selectedUuid={props.selectedUuid} onSelect={() => props.onSelect(field.uuid)} onSelectUuid={props.onSelect} onAdd={props.onAdd} onAddChild={props.onAddChild} onMove={props.onMove} onMoveChild={props.onMoveChild} onMoveToParent={props.onMoveToParent} onDuplicate={() => props.onDuplicate(field)} onDelete={() => props.onDelete(field.uuid)} onDeleteField={props.onDelete} />)}<div className={WooOptionsPro.Utils.classNames('wof-canvas-drop-end', dragActive && 'is-active')} onDragOver={canvasDragOver} onDrop={dropAtEnd}><WooOptionsPro.Components.Dashicon name="plus-alt2" />{__('Drop a field here', 'wooptions-pro')}</div></div> : <div className={WooOptionsPro.Utils.classNames('wof-canvas-empty', dragActive && 'is-active')} onDragOver={canvasDragOver} onDrop={dropAtEnd}><div><WooOptionsPro.Components.Dashicon name="layout" /></div><h3>{__('Your canvas is ready', 'wooptions-pro')}</h3><p>{__('Choose a field from the palette or drag one into this product page preview.', 'wooptions-pro')}</p></div>}</div></div></div></div>
      </div>
    </section>;
  }
}
