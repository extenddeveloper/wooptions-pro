namespace WooOptionsPro.Pages {
  const { __, sprintf } = wp.i18n;
  const { useEffect, useMemo, useRef, useState } = wp.element;
  const { Button } = wp.components;
  const { Dashicon } = WooOptionsPro.Components;

  type TemplateSort = 'popular' | 'newest' | 'name';
  type ViewMode = 'grid' | 'list';

  function renderFooterIcon(type: string, itemSlug?: string) {
    switch (type) {
      case 'image':
        return (
          <span key={type} className="wof-footer-icon" title={__('Image options', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </span>
        );
      case 'list':
        return (
          <span key={type} className="wof-footer-icon" title={__('List choices', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </span>
        );
      case 'price':
      case 'price3':
        return (
          <span key={type} className="wof-footer-icon is-glyph-price" title={__('Dynamic pricing', 'wooptions-pro')}>
            {itemSlug === 'donation' ? '$' : '$$$'}
          </span>
        );
      case 'text':
        return (
          <span key={type} className="wof-footer-icon" title={__('Text personalization', 'wooptions-pro')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </span>
        );
      case 'swatch':
        return (
          <span key={type} className="wof-footer-icon" title={__('Color choices', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
              <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
              <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
              <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
            </svg>
          </span>
        );
      case 'package':
        return (
          <span key={type} className="wof-footer-icon" title={__('Product bundles', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </span>
        );
      case 'ruler':
        return (
          <span key={type} className="wof-footer-icon" title={__('Measurement', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.3 8.7 8.7 21.3c-.4.4-1 .4-1.4 0l-6-6c-.4-.4-.4-1 0-1.4L13.9 1.3c.4-.4 1-.4 1.4 0l6 6c.4.4.4 1 0 1.4z" />
              <path d="m14.5 4.5 1.5 1.5" />
              <path d="m11.5 7.5 1.5 1.5" />
              <path d="m8.5 10.5 1.5 1.5" />
              <path d="m5.5 13.5 1.5 1.5" />
            </svg>
          </span>
        );
      case 'chip':
        return (
          <span key={type} className="wof-footer-icon" title={__('Components builder', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <line x1="9" y1="1" x2="9" y2="4" />
              <line x1="15" y1="1" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="23" />
              <line x1="15" y1="20" x2="15" y2="23" />
              <line x1="20" y1="9" x2="23" y2="9" />
              <line x1="20" y1="15" x2="23" y2="15" />
              <line x1="1" y1="9" x2="4" y2="9" />
              <line x1="1" y1="15" x2="4" y2="15" />
            </svg>
          </span>
        );
      case 'users':
        return (
          <span key={type} className="wof-footer-icon" title={__('Team members', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
        );
      case 'calendar':
        return (
          <span key={type} className="wof-footer-icon" title={__('Rental dates', 'wooptions-pro')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
        );
      default:
        return <span key={type} className="wof-footer-icon"><Dashicon name="screenoptions" /></span>;
    }
  }

  function TemplateCard(props: {
    item: WooOptionsPro.TemplateRecord;
    selected: boolean;
    busy: boolean;
    onSelect: () => void;
    onPreview: () => void;
    onUse: () => void;
  }) {
    const { item, selected, busy, onSelect, onPreview, onUse } = props;
    const isAdvanced = (item.level ?? '').toLowerCase() === 'advanced';
    const footerIcons = item.footerIcons?.length ? item.footerIcons : ['image', 'list', 'price'];

    return (
      <article
        className={WooOptionsPro.Utils.classNames(
          'wof-new-template-card',
          selected && 'is-selected'
        )}
        onClick={onSelect}
      >
        {selected ? (
          <span className="wof-template-card__selected-check" aria-label={__('Selected', 'wooptions-pro')}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}

        <div className="wof-template-card__body">
          <div className="wof-template-card__media">
            <img src={item.previewImage} alt={item.name} loading="lazy" />
          </div>

          <div className="wof-template-card__content">
            <div className="wof-template-card__header">
              <h3 className="wof-template-card__title">{item.name}</h3>
              <span className={`wof-template-level-badge ${isAdvanced ? 'is-advanced' : 'is-beginner'}`}>
                {item.level ?? 'Beginner'}
              </span>
            </div>

            <div className="wof-template-card__specs">
              <div className="wof-template-card__spec">
                {(item.fieldsCount ?? item.fieldCount ?? 0)} {__('fields', 'wooptions-pro')} · {(item.rulesCount ?? 0)} {__('rules', 'wooptions-pro')}
              </div>
              <div className="wof-template-card__spec">
                {item.pricingModel ?? __('Cumulative pricing', 'wooptions-pro')}
              </div>
              <div className="wof-template-card__spec">
                {item.layoutModel ?? __('Grid layout', 'wooptions-pro')}
              </div>
              <div className="wof-template-card__tested">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.41 5.41a1 1 0 0 0-1.41 0L7 8.41 5.71 7.12a1 1 0 1 0-1.42 1.42l2 2a1 1 0 0 0 1.42 0l4-4a1 1 0 0 0 0-1.42z" />
                </svg>
                <span>{__('Tested', 'wooptions-pro')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="wof-template-card__footer" onClick={(e: any) => e.stopPropagation()}>
          <div className="wof-template-card__icons">
            {footerIcons.map((t) => renderFooterIcon(t, item.slug))}
          </div>

          <div className="wof-template-card__actions">
            <button
              type="button"
              className="wof-btn-card-preview"
              onClick={onPreview}
            >
              {__('Preview', 'wooptions-pro')}
            </button>
            <Button
              variant="primary"
              className="wof-btn-card-use"
              isBusy={busy}
              onClick={onUse}
            >
              {__('Use template', 'wooptions-pro')}
            </Button>
          </div>
        </div>
      </article>
    );
  }

  export function Templates(props: { navigate: (route: string) => void }): any {
    const [items, setItems] = useState<WooOptionsPro.TemplateRecord[]>([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [fieldTypeFilter, setFieldTypeFilter] = useState('all');
    const [layoutFilter, setLayoutFilter] = useState('all');
    const [sort, setSort] = useState<TemplateSort>('popular');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(9);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [selectedSlug, setSelectedSlug] = useState<string | null>('design-your-own-pizza');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef<any>(null);
    const searchInputRef = useRef<any>(null);

    useEffect(() => {
      WooOptionsPro.Api.listTemplates()
        .then((response) => {
          setItems(response.items);
          if (response.items.length && !selectedSlug) {
            setSelectedSlug(response.items[0].slug);
          }
        })
        .catch((reason) => setError(WooOptionsPro.Utils.errorMessage(reason)))
        .finally(() => setLoading(false));
    }, []);

    // ⌘K or Ctrl+K shortcut listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
      setPage(1);
    }, [search, category, fieldTypeFilter, layoutFilter, sort]);

    const categories = [
      { id: 'all', label: __('All', 'wooptions-pro') },
      { id: 'food', label: __('Food', 'wooptions-pro') },
      { id: 'apparel', label: __('Apparel', 'wooptions-pro') },
      { id: 'personalization', label: __('Personalization', 'wooptions-pro') },
      { id: 'measurement', label: __('Measurement', 'wooptions-pro') },
      { id: 'bundles', label: __('Bundles', 'wooptions-pro') },
      { id: 'advanced', label: __('Advanced', 'wooptions-pro') },
    ];

    const filtered = useMemo(() => {
      const term = search.trim().toLowerCase();
      const result = items.filter((item) => {
        if (category !== 'all') {
          if (category === 'advanced') {
            if ((item.level ?? '').toLowerCase() !== 'advanced' && item.category !== 'advanced') {
              return false;
            }
          } else if (item.category !== category) {
            return false;
          }
        }
        if (fieldTypeFilter !== 'all') {
          if (!(item.fieldTypes ?? []).includes(fieldTypeFilter)) return false;
        }
        if (layoutFilter !== 'all') {
          const layoutName = (item.layoutModel ?? '').toLowerCase();
          if (!layoutName.includes(layoutFilter.toLowerCase())) return false;
        }
        if (!term) return true;
        return `${item.name} ${item.description} ${item.categoryLabel ?? item.category} ${item.pricingModel ?? ''} ${item.layoutModel ?? ''} ${(item.features ?? []).join(' ')}`.toLowerCase().includes(term);
      });

      return result.sort((left, right) => {
        if (sort === 'name') return left.name.localeCompare(right.name);
        if (sort === 'newest') return (right.order ?? 0) - (left.order ?? 0);
        return (right.order ?? 0) - (left.order ?? 0);
      });
    }, [items, search, category, fieldTypeFilter, layoutFilter, sort]);

    const pages = Math.max(1, Math.ceil(filtered.length / perPage));
    const currentPage = Math.min(page, pages);
    const visible = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

    const selectedItem = useMemo(() => {
      if (!selectedSlug) return null;
      return items.find((i) => i.slug === selectedSlug) ?? (filtered.length ? filtered[0] : null);
    }, [selectedSlug, items, filtered]);

    const importTemplate = async (slug: string) => {
      setBusy(slug);
      setError('');
      try {
        const result = await WooOptionsPro.Api.importTemplate(slug);
        props.navigate(`builder/${result.uuid}`);
      } catch (reason) {
        setError(WooOptionsPro.Utils.errorMessage(reason));
      } finally {
        setBusy(null);
      }
    };

    const createFromScratch = async () => {
      setCreating(true);
      setError('');
      try {
        const created = await WooOptionsPro.Api.createOptionSet(__('Untitled option set', 'wooptions-pro'));
        props.navigate(`builder/${created.uuid}`);
      } catch (reason) {
        setError(WooOptionsPro.Utils.errorMessage(reason));
      } finally {
        setCreating(false);
      }
    };

    const importFile = async (event: any) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setImporting(true);
      setError('');
      try {
        const raw = await file.text();
        const payload = JSON.parse(raw);
        const previewResult = await WooOptionsPro.Api.previewImport(payload);
        if (!previewResult.valid) {
          throw new Error(__('The selected file is not a valid option set template.', 'wooptions-pro'));
        }
        const result = await WooOptionsPro.Api.commitImport(payload, previewResult.title || __('Imported template', 'wooptions-pro'));
        props.navigate(`builder/${result.uuid}`);
      } catch (reason) {
        setError(WooOptionsPro.Utils.errorMessage(reason));
      } finally {
        setImporting(false);
      }
    };

    return (
      <div className="wof-new-templates-page">
        {/* Top Header */}
        <header className="wof-new-templates-header">
          <div className="wof-new-templates-header__left">
            <h1 className="wof-new-templates-title">{__('Templates', 'wooptions-pro')}</h1>
            <p className="wof-new-templates-subtitle">
              {__('Start with a tested option set, then make it your own.', 'wooptions-pro')}
            </p>
            <div className="wof-new-templates-cta-row">
              <Button
                variant="primary"
                className="wof-btn-create-template"
                isBusy={creating}
                onClick={createFromScratch}
              >
                {__('Create template', 'wooptions-pro')}
              </Button>
              <input ref={fileRef} type="file" hidden accept="application/json,.json" onChange={importFile} />
              <Button
                variant="secondary"
                className="wof-btn-import-template"
                isBusy={importing}
                onClick={() => fileRef.current?.click()}
              >
                {__('Import template', 'wooptions-pro')}
              </Button>
            </div>
          </div>

          <div className="wof-new-templates-header__right">
            <div className="wof-quick-search-box" onClick={() => searchInputRef.current?.focus()}>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                placeholder={__('Search (⌘K)', 'wooptions-pro')}
                className="wof-quick-search-input"
              />
              <span className="wof-quick-search-icon">
                <Dashicon name="search" />
              </span>
            </div>
          </div>
        </header>

        {/* Filters and Categories Toolbar */}
        <div className="wof-new-templates-toolbar">
          <div className="wof-toolbar-row-top">
            <div className="wof-search-templates-field">
              <input
                type="text"
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                placeholder={__('Search templates', 'wooptions-pro')}
                className="wof-search-templates-input"
              />
              <span className="wof-search-templates-icon">
                <Dashicon name="search" />
              </span>
            </div>

            <div className="wof-category-pills">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  className={`wof-category-pill ${category === cat.id ? 'is-active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="wof-toolbar-row-bottom">
            <div className="wof-toolbar-dropdowns-left">
              <div className="wof-select-wrapper">
                <select
                  value={fieldTypeFilter}
                  onChange={(e: any) => setFieldTypeFilter(e.target.value)}
                  className="wof-filter-select"
                  aria-label={__('Filter by field type', 'wooptions-pro')}
                >
                  <option value="all">{__('Field types', 'wooptions-pro')}</option>
                  <option value="image_swatch">{__('Image choices', 'wooptions-pro')}</option>
                  <option value="color_swatch">{__('Color swatches', 'wooptions-pro')}</option>
                  <option value="radio">{__('Radio group', 'wooptions-pro')}</option>
                  <option value="segmented">{__('Button choices', 'wooptions-pro')}</option>
                  <option value="checkbox_group">{__('Checkbox group', 'wooptions-pro')}</option>
                  <option value="product">{__('Product choices', 'wooptions-pro')}</option>
                  <option value="file">{__('File upload', 'wooptions-pro')}</option>
                  <option value="repeater">{__('Repeatable section', 'wooptions-pro')}</option>
                  <option value="date_range">{__('Date range', 'wooptions-pro')}</option>
                  <option value="formula">{__('Formula output', 'wooptions-pro')}</option>
                  <option value="customer_defined_price">{__('Customer price', 'wooptions-pro')}</option>
                </select>
                <span className="wof-select-chevron">▾</span>
              </div>

              <div className="wof-select-wrapper">
                <select
                  value={layoutFilter}
                  onChange={(e: any) => setLayoutFilter(e.target.value)}
                  className="wof-filter-select"
                  aria-label={__('Filter by layout', 'wooptions-pro')}
                >
                  <option value="all">{__('Layout', 'wooptions-pro')}</option>
                  <option value="grid">{__('Grid layout', 'wooptions-pro')}</option>
                  <option value="sectioned">{__('Sectioned layout', 'wooptions-pro')}</option>
                  <option value="accordion">{__('Accordion layout', 'wooptions-pro')}</option>
                  <option value="step">{__('Step layout', 'wooptions-pro')}</option>
                  <option value="single column">{__('Single column', 'wooptions-pro')}</option>
                  <option value="table">{__('Table layout', 'wooptions-pro')}</option>
                </select>
                <span className="wof-select-chevron">▾</span>
              </div>
            </div>

            <div className="wof-toolbar-dropdowns-right">
              <div className="wof-view-mode-toggle">
                <button
                  type="button"
                  className={`wof-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-label={__('Grid view', 'wooptions-pro')}
                  title={__('Grid view', 'wooptions-pro')}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="1" width="6" height="6" rx="1.5" />
                    <rect x="9" y="1" width="6" height="6" rx="1.5" />
                    <rect x="1" y="9" width="6" height="6" rx="1.5" />
                    <rect x="9" y="9" width="6" height="6" rx="1.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`wof-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-label={__('List view', 'wooptions-pro')}
                  title={__('List view', 'wooptions-pro')}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="2" width="14" height="2" rx="1" />
                    <rect x="1" y="7" width="14" height="2" rx="1" />
                    <rect x="1" y="12" width="14" height="2" rx="1" />
                  </svg>
                </button>
              </div>

              <div className="wof-select-wrapper">
                <select
                  value={sort}
                  onChange={(e: any) => setSort(e.target.value as TemplateSort)}
                  className="wof-filter-select"
                  aria-label={__('Sort templates', 'wooptions-pro')}
                >
                  <option value="popular">{__('Most useful', 'wooptions-pro')}</option>
                  <option value="newest">{__('Newest first', 'wooptions-pro')}</option>
                  <option value="name">{__('Name A–Z', 'wooptions-pro')}</option>
                </select>
                <span className="wof-select-chevron">▾</span>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="wof-notice-wrap">
            <WooOptionsPro.Components.InlineNotice type="error" onClose={() => setError('')}>
              {error}
            </WooOptionsPro.Components.InlineNotice>
          </div>
        ) : null}

        {/* Master-Detail Layout */}
        <div className={`wof-templates-main-layout ${selectedItem ? 'has-drawer' : 'no-drawer'}`}>
          {/* Left / Center Catalog Cards */}
          <div className="wof-templates-catalog-column">
            {loading ? (
              <WooOptionsPro.Components.Loading label={__('Loading templates…', 'wooptions-pro')} />
            ) : visible.length ? (
              <div className={`wof-templates-cards-grid is-${viewMode}`}>
                {visible.map((item) => (
                  <TemplateCard
                    key={item.slug}
                    item={item}
                    selected={selectedItem?.slug === item.slug}
                    busy={busy === item.slug}
                    onSelect={() => setSelectedSlug(item.slug)}
                    onPreview={() => setSelectedSlug(item.slug)}
                    onUse={() => importTemplate(item.slug)}
                  />
                ))}
              </div>
            ) : (
              <WooOptionsPro.Components.EmptyState
                icon="search"
                title={__('No templates found', 'wooptions-pro')}
                description={__('Try adjusting your search terms or category filters.', 'wooptions-pro')}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setCategory('all');
                      setFieldTypeFilter('all');
                      setLayoutFilter('all');
                    }}
                  >
                    {__('Clear all filters', 'wooptions-pro')}
                  </Button>
                }
              />
            )}

            {/* Bottom Pagination & Count Bar */}
            {!loading && filtered.length ? (
              <div className="wof-templates-bottom-bar">
                <div className="wof-templates-bottom-count">
                  {sprintf(__('%d original templates', 'wooptions-pro'), filtered.length)}
                </div>

                <div className="wof-templates-bottom-controls">
                  <div className="wof-per-page-select-wrapper">
                    <select
                      value={perPage}
                      onChange={(e: any) => setPerPage(Number(e.target.value))}
                      className="wof-per-page-select"
                      aria-label={__('Items per page', 'wooptions-pro')}
                    >
                      <option value={9}>{__('9 per page', 'wooptions-pro')}</option>
                      <option value={18}>{__('18 per page', 'wooptions-pro')}</option>
                      <option value={36}>{__('36 per page', 'wooptions-pro')}</option>
                    </select>
                    <span className="wof-select-chevron">▾</span>
                  </div>

                  <div className="wof-templates-pagination">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(currentPage - 1)}
                      className="wof-page-nav-btn"
                      aria-label={__('Previous page', 'wooptions-pro')}
                    >
                      ‹
                    </button>
                    <span className="wof-page-number-active">{currentPage}</span>
                    <button
                      type="button"
                      disabled={currentPage >= pages}
                      onClick={() => setPage(currentPage + 1)}
                      className="wof-page-nav-btn"
                      aria-label={__('Next page', 'wooptions-pro')}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Detail / Preview Drawer */}
          {selectedItem ? (
            <aside className="wof-template-drawer">
              <div className="wof-template-drawer__header">
                <h2 className="wof-template-drawer__title">{selectedItem.name}</h2>
                <button
                  type="button"
                  className="wof-template-drawer__close"
                  onClick={() => setSelectedSlug(null)}
                  aria-label={__('Close details', 'wooptions-pro')}
                >
                  ✕
                </button>
              </div>

              <div className="wof-template-drawer__hero">
                <img
                  src={selectedItem.heroImage || selectedItem.previewImage}
                  alt={selectedItem.name}
                  className="wof-template-drawer__hero-img"
                />
              </div>

              <p className="wof-template-drawer__desc">
                {selectedItem.description}
              </p>

              <div className="wof-template-drawer__section">
                <h4 className="wof-drawer-section-title">{__('Features', 'wooptions-pro')}</h4>
                <ul className="wof-drawer-features-list">
                  {(selectedItem.features?.length ? selectedItem.features : [
                    __('Image choices', 'wooptions-pro'),
                    __('Per-choice quantity', 'wooptions-pro'),
                    __('Conditional toppings', 'wooptions-pro'),
                    __('Cumulative pricing', 'wooptions-pro')
                  ]).map((feat, idx) => (
                    <li key={idx} className="wof-drawer-feature-item">
                      <span className="wof-feature-check">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="evenodd" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.41 5.41a1 1 0 0 0-1.41 0L7 8.41 5.71 7.12a1 1 0 1 0-1.42 1.42l2 2a1 1 0 0 0 1.42 0l4-4a1 1 0 0 0 0-1.42z" />
                        </svg>
                      </span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="wof-template-drawer__section">
                <h4 className="wof-drawer-section-title">{__('Details', 'wooptions-pro')}</h4>
                <div className="wof-drawer-details-list">
                  <div className="wof-drawer-detail-item">
                    <span className="wof-detail-icon">☰</span>
                    <span>{selectedItem.details?.fields || `${selectedItem.fieldsCount ?? selectedItem.fieldCount ?? 0} ${__('fields', 'wooptions-pro')}`}</span>
                  </div>
                  <div className="wof-drawer-detail-item">
                    <span className="wof-detail-icon">⚡</span>
                    <span>{selectedItem.details?.rules || `${selectedItem.rulesCount ?? 0} ${__('rules', 'wooptions-pro')}`}</span>
                  </div>
                  <div className="wof-drawer-detail-item">
                    <span className="wof-detail-icon">⊞</span>
                    <span>{selectedItem.details?.layout || selectedItem.layoutModel || __('Grid layout', 'wooptions-pro')}</span>
                  </div>
                  <div className="wof-drawer-detail-item">
                    <span className="wof-detail-icon is-check">✔</span>
                    <span>{selectedItem.details?.tested || __('Tested for accessibility', 'wooptions-pro')}</span>
                  </div>
                </div>
              </div>

              <div className="wof-template-drawer__actions">
                <Button
                  variant="primary"
                  className="wof-drawer-btn-use"
                  isBusy={busy === selectedItem.slug}
                  onClick={() => importTemplate(selectedItem.slug)}
                >
                  {__('Use this template', 'wooptions-pro')}
                </Button>

                <button
                  type="button"
                  className="wof-drawer-btn-preview"
                  onClick={() => {
                    if (selectedItem.previewUrl) {
                      window.open(selectedItem.previewUrl, '_blank');
                    } else {
                      window.alert(__('Storefront preview URL will be configured manually.', 'wooptions-pro'));
                    }
                  }}
                >
                  <span>{__('Preview storefront', 'wooptions-pro')}</span>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0v-6z"/>
                  </svg>
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    );
  }
}
