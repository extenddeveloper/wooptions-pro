namespace WooptionsFic.Builder {
  const { Button, Modal, SelectControl, TextControl } = wp.components;
  const { __ } = wp.i18n;
  const { useEffect, useMemo, useState } = wp.element;

  type SearchableAssignmentType = 'product' | 'variation' | 'category' | 'tag';
  type PickerAssignmentType = SearchableAssignmentType | 'global';

  interface AssignmentTargetDetails {
    id: number | null;
    type: PickerAssignmentType;
    label: string;
    meta: string;
    image: string;
  }

  const assignmentTypes: Array<{ type: PickerAssignmentType; label: string; icon: string }> = [
    { type: 'product', label: __('Products', 'wooptionsfic'), icon: 'dashicons-products' },
    { type: 'category', label: __('Categories', 'wooptionsfic'), icon: 'dashicons-category' },
    { type: 'tag', label: __('Tags', 'wooptionsfic'), icon: 'dashicons-tag' },
    { type: 'variation', label: __('Variations', 'wooptionsfic'), icon: 'dashicons-image-rotate' },
    { type: 'global', label: __('All products', 'wooptionsfic'), icon: 'dashicons-admin-site-alt3' },
  ];

  function assignmentTypeLabel(type: WooptionsFic.AssignmentType): string {
    const labels: Record<WooptionsFic.AssignmentType, string> = {
      global: __('All products', 'wooptionsfic'),
      product: __('Product', 'wooptionsfic'),
      category: __('Category', 'wooptionsfic'),
      tag: __('Tag', 'wooptionsfic'),
      variation: __('Variation', 'wooptionsfic'),
      product_type: __('Product type', 'wooptionsfic'),
    };
    return labels[type] ?? type;
  }

  function assignmentTypeIcon(type: WooptionsFic.AssignmentType): string {
    const icons: Record<WooptionsFic.AssignmentType, string> = {
      global: 'dashicons-admin-site-alt3',
      product: 'dashicons-products',
      category: 'dashicons-category',
      tag: 'dashicons-tag',
      variation: 'dashicons-image-rotate',
      product_type: 'dashicons-filter',
    };
    return icons[type] ?? 'dashicons-marker';
  }

  function renderTypeIcon(type: PickerAssignmentType | WooptionsFic.AssignmentType): any {
    switch (type) {
      case 'global':
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
      case 'product':
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
      case 'category':
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
      case 'tag':
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
      case 'variation':
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>;
      default:
        return <span className={`dashicons ${assignmentTypeIcon(type as WooptionsFic.AssignmentType)}`} aria-hidden="true" />;
    }
  }

  function TargetSearch(props: {
    type: PickerAssignmentType;
    assignments: WooptionsFic.AssignmentRecord[];
    onAdd: (target: AssignmentTargetDetails) => void;
  }): any {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WooptionsFic.AssignmentTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const [error, setError] = useState('');

    const selectedIds = useMemo(
      () => new Set(
        props.assignments
          .filter((assignment) => assignment.targetType === props.type)
          .map((assignment) => String(assignment.targetId ?? 'global')),
      ),
      [props.assignments, props.type],
    );

    useEffect(() => {
      setQuery('');
      setResults([]);
      setError('');
    }, [props.type]);

    useEffect(() => {
      const targetType = props.type;
      if (!focused || targetType === 'global') return;
      let active = true;
      const timeout = window.setTimeout(() => {
        setLoading(true);
        setError('');
        WooptionsFic.Api.searchAssignmentTargets(targetType, query)
          .then((response) => {
            if (active) setResults(Array.isArray(response.items) ? response.items : []);
          })
          .catch((reason) => {
            if (active) setError(WooptionsFic.Utils.errorMessage(reason));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }, 220);
      return () => {
        active = false;
        window.clearTimeout(timeout);
      };
    }, [query, props.type, focused]);

    if (props.type === 'global') {
      const selected = selectedIds.has('global');
      return (
        <button
          type="button"
          className={`wof-assignment-global ${selected ? 'is-selected' : ''}`}
          disabled={selected}
          onClick={() => props.onAdd({
            id: null,
            type: 'global',
            label: __('All WooCommerce products', 'wooptionsfic'),
            meta: __('Every product in the store', 'wooptionsfic'),
            image: '',
          })}
        >
          <span className="wof-assignment-global__icon" aria-hidden="true">{renderTypeIcon('global')}</span>
          <span>
            <strong>{__('All products', 'wooptionsfic')}</strong>
            <small>{selected ? __('Already assigned', 'wooptionsfic') : __('Apply this option set store-wide', 'wooptionsfic')}</small>
          </span>
          <span className="wof-assignment-global__status" aria-hidden="true">
            {selected ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            )}
          </span>
        </button>
      );
    }

    const placeholder = props.type === 'product'
      ? __('Search products by name, ID, or SKU…', 'wooptionsfic')
      : props.type === 'category'
        ? __('Search product categories…', 'wooptionsfic')
        : props.type === 'tag'
          ? __('Search product tags…', 'wooptionsfic')
          : __('Search variations by name, ID, or SKU…', 'wooptionsfic');

    return (
      <div className="wof-target-search">
        <div className="wof-target-search__input">
          <span className="dashicons dashicons-search" aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(event: Event) => setQuery((event.target as HTMLInputElement).value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 160)}
            aria-label={__('Search assignment targets', 'wooptionsfic')}
          />
          {loading || query ? (
            <button
              type="button"
              className="wof-target-search__clear"
              onMouseDown={(event: Event) => event.preventDefault()}
              onClick={() => setQuery('')}
              aria-label={__('Clear search', 'wooptionsfic')}
            >
              {loading ? <span className="wof-mini-spinner" aria-hidden="true" /> : <span className="dashicons dashicons-no-alt" aria-hidden="true" />}
            </button>
          ) : null}
        </div>
        {focused ? (
          <div className="wof-target-results">
            {error ? <p className="wof-target-results__message is-error">{error}</p> : null}
            {!error && !loading && !results.length ? (
              <p className="wof-target-results__message">
                {query ? __('No matching items found.', 'wooptionsfic') : __('Start typing or choose from recent items.', 'wooptionsfic')}
              </p>
            ) : null}
            {results.map((target) => {
              const selected = selectedIds.has(String(target.id));
              return (
                <button
                  type="button"
                  key={`${props.type}-${target.id}`}
                  className={selected ? 'is-selected' : ''}
                  disabled={selected}
                  onMouseDown={(event: Event) => event.preventDefault()}
                  onClick={() => props.onAdd({ ...target, type: props.type })}
                >
                  {target.image ? <img src={target.image} alt="" /> : <span className={`wof-target-result__icon dashicons ${assignmentTypeIcon(props.type)}`} aria-hidden="true" />}
                  <span className="wof-target-result__copy">
                    <strong>{target.label}</strong>
                    <small>{target.meta || `${assignmentTypeLabel(props.type)} #${target.id}`}</small>
                  </span>
                  <span className={`dashicons ${selected ? 'dashicons-yes-alt' : 'dashicons-plus-alt2'}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  export function AssignmentsModal(props: {
    assignments: WooptionsFic.AssignmentRecord[];
    busy: boolean;
    onClose: () => void;
    onSave: (assignments: WooptionsFic.AssignmentRecord[]) => Promise<void>;
  }): any {
    const [type, setType] = useState<PickerAssignmentType>('product');
    const [draft, setDraft] = useState<WooptionsFic.AssignmentRecord[]>(() => WooptionsFic.Utils.clone(props.assignments));
    const [targetDetails, setTargetDetails] = useState<Record<string, WooptionsFic.AssignmentTarget>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      setDraft(WooptionsFic.Utils.clone(props.assignments));
    }, [props.assignments]);

    const assignmentKey = useMemo(
      () => draft.map((assignment) => `${assignment.targetType}:${assignment.targetId ?? 'global'}`).sort().join('|'),
      [draft],
    );

    useEffect(() => {
      let active = true;
      const grouped = new Map<SearchableAssignmentType, number[]>();
      draft.forEach((assignment) => {
        if (!['product', 'variation', 'category', 'tag'].includes(assignment.targetType) || assignment.targetId === null) return;
        const targetType = assignment.targetType as SearchableAssignmentType;
        grouped.set(targetType, [...(grouped.get(targetType) ?? []), Number(assignment.targetId)]);
      });

      Promise.all(Array.from(grouped.entries()).map(async ([targetType, ids]) => {
        try {
          const response = await WooptionsFic.Api.searchAssignmentTargets(targetType, '', [...new Set(ids)]);
          return response.items.map((item) => [`${targetType}:${item.id}`, item] as const);
        } catch {
          return [] as Array<readonly [string, WooptionsFic.AssignmentTarget]>;
        }
      })).then((groups) => {
        if (!active) return;
        const next: Record<string, WooptionsFic.AssignmentTarget> = {};
        groups.flat().forEach(([key, item]) => { next[key] = item; });
        setTargetDetails(next);
      });

      return () => { active = false; };
    }, [assignmentKey]);

    const updateAssignment = (index: number, patch: Partial<WooptionsFic.AssignmentRecord>) => {
      setDraft((current) => current.map((assignment, assignmentIndex) => assignmentIndex === index ? { ...assignment, ...patch } : assignment));
    };

    const addTarget = (target: AssignmentTargetDetails) => {
      const targetId = target.type === 'global' ? null : Number(target.id);
      if (draft.some((assignment) => assignment.targetType === target.type && assignment.targetId === targetId)) return;
      const assignment: WooptionsFic.AssignmentRecord = {
        uuid: WooptionsFic.Utils.uuid(),
        targetType: target.type,
        targetId,
        mode: 'include',
        priority: 10,
        context: {},
        targetLabel: target.label,
        targetMeta: target.meta,
        targetImage: target.image,
      };
      setDraft((current) => [...current, assignment]);
      if (target.type !== 'global' && target.id !== null) {
        setTargetDetails((current) => ({
          ...current,
          [`${target.type}:${target.id}`]: {
            id: Number(target.id),
            type: target.type as SearchableAssignmentType,
            label: target.label,
            meta: target.meta,
            image: target.image,
          },
        }));
      }
    };

    const save = async () => {
      setSaving(true);
      try {
        await props.onSave(draft);
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal
        title={__('Product assignments', 'wooptionsfic')}
        onRequestClose={props.onClose}
        className="wof-modal wof-assignment-modal"
      >
        <div className="wof-assignment-hero">
          <span className="wof-assignment-hero__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          </span>
          <div>
            <h3>{__('Choose exactly where this option set appears', 'wooptionsfic')}</h3>
            <p>{__('Search and select multiple products, categories, tags, or variations. Product-specific rules take priority over broader category rules.', 'wooptionsfic')}</p>
          </div>
        </div>

        <section className="wof-assignment-picker">
          <div className="wof-assignment-type-tabs" role="tablist">
            {assignmentTypes.map((assignmentType) => (
              <button
                type="button"
                role="tab"
                key={assignmentType.type}
                aria-selected={type === assignmentType.type}
                className={type === assignmentType.type ? 'is-active' : ''}
                onClick={() => setType(assignmentType.type)}
              >
                <span className="wof-type-tab-icon" aria-hidden="true">{renderTypeIcon(assignmentType.type)}</span>
                {assignmentType.label}
              </button>
            ))}
          </div>
          <TargetSearch type={type} assignments={draft} onAdd={addTarget} />
        </section>

        <div className="wof-assignment-section-head">
          <div>
            <h3>{__('Assigned targets', 'wooptionsfic')}</h3>
            <p>{__('Adjust inclusion mode or priority for each selected target.', 'wooptionsfic')}</p>
          </div>
          <span>{draft.length} {draft.length === 1 ? __('rule', 'wooptionsfic') : __('rules', 'wooptionsfic')}</span>
        </div>

        {props.busy && !draft.length ? (
          <WooptionsFic.Components.ModalLoading label={__('Loading assigned targets…', 'wooptionsfic')} />
        ) : draft.length ? (
          <div className="wof-assignment-cards">
            {draft.map((assignment, index) => {
              const key = `${assignment.targetType}:${assignment.targetId ?? 'global'}`;
              const target = targetDetails[key];
              const label = assignment.targetLabel
                || target?.label
                || (assignment.targetType === 'global'
                  ? __('All WooCommerce products', 'wooptionsfic')
                  : `${assignmentTypeLabel(assignment.targetType)} #${assignment.targetId}`);
              const meta = assignment.targetMeta
                || target?.meta
                || (assignment.targetType === 'global' ? __('Store-wide assignment', 'wooptionsfic') : `ID: ${assignment.targetId}`);
              const image = assignment.targetImage || target?.image || '';
              return (
                <article className="wof-assignment-card" key={assignment.uuid || key}>
                  <div className="wof-assignment-card__visual">
                    {image ? <img src={image} alt="" /> : <span className="wof-assignment-visual-icon" aria-hidden="true">{renderTypeIcon(assignment.targetType)}</span>}
                  </div>
                  <div className="wof-assignment-card__identity">
                    <div><strong>{label}</strong><span className="wof-target-type-badge">{assignmentTypeLabel(assignment.targetType)}</span></div>
                    <small>{meta}</small>
                  </div>
                  <div className="wof-assignment-card__controls">
                    <SelectControl
                      label={__('Mode', 'wooptionsfic')}
                      value={assignment.mode}
                      options={[
                        { label: __('Include', 'wooptionsfic'), value: 'include' },
                        { label: __('Exclude', 'wooptionsfic'), value: 'exclude' },
                      ]}
                      onChange={(mode: 'include' | 'exclude') => updateAssignment(index, { mode })}
                    />
                    <TextControl
                      type="number"
                      label={__('Priority', 'wooptionsfic')}
                      value={String(assignment.priority)}
                      min={-1000}
                      max={1000}
                      onChange={(priority: string) => updateAssignment(index, { priority: Number(priority) })}
                    />
                    <button
                      type="button"
                      className="wof-assignment-card__remove"
                      onClick={() => setDraft((current) => current.filter((candidate) => candidate !== assignment))}
                      aria-label={__('Remove assignment', 'wooptionsfic')}
                      title={__('Remove assignment', 'wooptionsfic')}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="wof-assignment-empty">
            <span className="wof-assignment-empty__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            </span>
            <h3>{__('No products assigned yet', 'wooptionsfic')}</h3>
            <p>{__('Use the search above to select one or more targets.', 'wooptionsfic')}</p>
          </div>
        )}

        <div className="wof-modal__actions wof-assignment-actions">
          <Button variant="secondary" className="wof-btn-cancel" disabled={saving || props.busy} onClick={props.onClose}>
            {__('Cancel', 'wooptionsfic')}
          </Button>
          <Button variant="primary" className="wof-btn-save" isBusy={saving || props.busy} disabled={saving || props.busy} onClick={save}>
            {saving || props.busy ? (
              <svg className="wof-btn-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.8" strokeDasharray="31.4 31.4" strokeDashoffset="10" fill="none" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }}>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" fill="none" stroke="currentColor" strokeWidth="2" />
                <polyline points="17 21 17 13 7 13 7 21" fill="none" stroke="currentColor" strokeWidth="2" />
                <polyline points="7 3 7 8 15 8" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
            <span>{saving || props.busy ? __('Saving…', 'wooptionsfic') : __('Save assignments', 'wooptionsfic')}</span>
          </Button>
        </div>
      </Modal>
    );
  }
}
