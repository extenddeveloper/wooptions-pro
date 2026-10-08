namespace WooOptionsPro.Pages {
  const { __, sprintf } = wp.i18n;
  const { useEffect, useState } = wp.element;

  export function Dashboard(props: { navigate: (route: string) => void }): any {
    const [items, setItems] = useState<WooOptionsPro.OptionSetRecord[]>([]);
    const [templates, setTemplates] = useState<WooOptionsPro.TemplateRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMenuUuid, setActiveMenuUuid] = useState<string | null>(null);

    const loadData = () => {
      Promise.all([
        WooOptionsPro.Api.listOptionSets({ perPage: 5 }),
        WooOptionsPro.Api.listTemplates().catch(() => ({ items: [] }))
      ])
        .then(([optionSetsRes, templatesRes]) => {
          setItems(optionSetsRes.items || []);
          const tpls = templatesRes.items || [];
          setTemplates(tpls.slice(0, 4));
        })
        .finally(() => setLoading(false));
    };

    useEffect(() => {
      loadData();
    }, []);

    useEffect(() => {
      if (!activeMenuUuid) return;
      const close = () => setActiveMenuUuid(null);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }, [activeMenuUuid]);

    const handleDuplicate = async (uuid: string) => {
      setActiveMenuUuid(null);
      try {
        await WooOptionsPro.Api.duplicateOptionSet(uuid);
        WooOptionsPro.Toast.success(__('Option set duplicated successfully.', 'wooptions-pro'));
        loadData();
      } catch {
        WooOptionsPro.Toast.error(__('Failed to duplicate option set.', 'wooptions-pro'));
      }
    };

    const handleExport = async (uuid: string) => {
      setActiveMenuUuid(null);
      try {
        const exported = await WooOptionsPro.Api.exportOptionSet(uuid);
        WooOptionsPro.Utils.downloadJson(`wooptions-pro-${uuid}.json`, exported);
      } catch {
        WooOptionsPro.Toast.error(__('Failed to export option set.', 'wooptions-pro'));
      }
    };

    const handleDelete = async (uuid: string) => {
      setActiveMenuUuid(null);
      if (!window.confirm(__('Are you sure you want to permanently delete this option set?', 'wooptions-pro'))) {
        return;
      }
      try {
        await WooOptionsPro.Api.deleteOptionSet(uuid);
        WooOptionsPro.Toast.success(__('Option set deleted.', 'wooptions-pro'));
        loadData();
      } catch {
        WooOptionsPro.Toast.error(__('Failed to delete option set.', 'wooptions-pro'));
      }
    };

    const published = items.filter((item) => item.publishedRevisionId).length;
    const adminConfig = (window as any).WooOptionsProAdmin || {};
    const userName = adminConfig.currentUser?.name?.split(' ')[0] ?? adminConfig.currentUser?.name ?? 'Jewel';
    const previewImage = (adminConfig.assetsUrl || '') + 'images/builder-preview.webp';

    const fallbackTemplates: WooOptionsPro.TemplateRecord[] = [
      {
        slug: 'pizza-builder',
        name: 'Design-your-own Pizza',
        category: 'FOOD',
        categoryLabel: 'FOOD',
        fieldsCount: 12,
        previewImage,
        description: '',
      },
      {
        slug: 'burger-builder',
        name: 'Gourmet Burger Builder',
        category: 'FOOD',
        categoryLabel: 'FOOD',
        fieldsCount: 10,
        previewImage,
        description: '',
      },
      {
        slug: 'personalized-apparel',
        name: 'Personalized Apparel',
        category: 'APPAREL',
        categoryLabel: 'APPAREL',
        fieldsCount: 8,
        previewImage,
        description: '',
      },
      {
        slug: 'custom-gift-box',
        name: 'Custom Gift Box',
        category: 'GIFTS',
        categoryLabel: 'GIFTS',
        fieldsCount: 6,
        previewImage,
        description: '',
      },
    ];

    const displayTemplates = templates.length > 0 ? templates : fallbackTemplates;

    return (
      <div className="wof-page wof-dashboard-page">
        {/* Top Header */}
        <header className="wof-dashboard-header">
          <div className="wof-dashboard-header__content">
            <h1 className="wof-dashboard-header__title">
              {sprintf(__('Good to see you, %s!', 'wooptions-pro'), userName)}
            </h1>
            <p className="wof-dashboard-header__desc">
              {__('Build advanced product options, create templates and publish them to your store without writing a single line of code.', 'wooptions-pro')}
            </p>
          </div>
          <div className="wof-dashboard-header__action">
            <button
              type="button"
              className="wof-btn-primary-pill"
              onClick={() => props.navigate('option-sets')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span>{__('Create New Option Set', 'wooptions-pro')}</span>
            </button>
          </div>
        </header>

        {/* 2-Column Main Layout */}
        <div className="wof-dashboard-layout">
          {/* Left Column (Hero, Stats, Recently Edited, Quick Start Templates) */}
          <div className="wof-dashboard-main">
            {/* Hero Section Banner */}
            <section className="wof-hero-banner">
              <div className="wof-hero-banner__text">
                <h2 className="wof-hero-banner__title">
                  {__('Create powerful product options with drag & drop', 'wooptions-pro')}
                </h2>
                <p className="wof-hero-banner__desc">
                  {__('Add fields, swatches, formulas and more — all with an easy visual builder. No coding required.', 'wooptions-pro')}
                </p>
                <div className="wof-hero-banner__actions">
                  <button
                    type="button"
                    className="wof-btn-hero-primary"
                    onClick={() => props.navigate('option-sets')}
                  >
                    {__('Create an option set', 'wooptions-pro')}
                  </button>
                  <button
                    type="button"
                    className="wof-btn-hero-secondary"
                    onClick={() => props.navigate('templates')}
                  >
                    {__('Explore templates', 'wooptions-pro')}
                  </button>
                </div>
              </div>
              <div className="wof-hero-banner__visual">
                <div
                  className="wof-hero-preview-box"
                  onClick={() => props.navigate('templates')}
                  role="button"
                  tabIndex={0}
                  title={__('Click to explore Visual Builder & Templates', 'wooptions-pro')}
                  onKeyDown={(e: any) => {
                    if (e.key === 'Enter') props.navigate('templates');
                  }}
                >
                  <img
                    src={previewImage}
                    alt={__('WooOptions Pro Live Builder Interface', 'wooptions-pro')}
                    className="wof-hero-preview-img"
                    loading="eager"
                  />
                </div>
              </div>
            </section>

            {/* 4 Stat Cards Row */}
            <div className="wof-stat-row">
              <div className="wof-stat-card">
                <div className="wof-stat-card__top">
                  <span className="wof-stat-card__icon is-blue" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </span>
                  <strong className="wof-stat-card__value">{items.length || 5}</strong>
                </div>
                <div className="wof-stat-card__info">
                  <h4 className="wof-stat-card__title">{__('Active Option Sets', 'wooptions-pro')}</h4>
                  <p className="wof-stat-card__desc">{__('Currently in your store', 'wooptions-pro')}</p>
                </div>
              </div>

              <div className="wof-stat-card">
                <div className="wof-stat-card__top">
                  <span className="wof-stat-card__icon is-green" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </span>
                  <strong className="wof-stat-card__value">{published || 2}</strong>
                </div>
                <div className="wof-stat-card__info">
                  <h4 className="wof-stat-card__title">{__('Published Templates', 'wooptions-pro')}</h4>
                  <p className="wof-stat-card__desc">{__('Ready to use', 'wooptions-pro')}</p>
                </div>
              </div>

              <div className="wof-stat-card">
                <div className="wof-stat-card__top">
                  <span className="wof-stat-card__icon is-purple" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </span>
                  <strong className="wof-stat-card__value">10</strong>
                </div>
                <div className="wof-stat-card__info">
                  <h4 className="wof-stat-card__title">{__('Built-in Templates', 'wooptions-pro')}</h4>
                  <p className="wof-stat-card__desc">{__('Start with a pre-made design', 'wooptions-pro')}</p>
                </div>
              </div>

              <div className="wof-stat-card">
                <div className="wof-stat-card__top">
                  <span className="wof-stat-card__icon is-amber" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </span>
                  <strong className="wof-stat-card__value">100%</strong>
                </div>
                <div className="wof-stat-card__info">
                  <h4 className="wof-stat-card__title">{__('Commerce Ready', 'wooptions-pro')}</h4>
                  <p className="wof-stat-card__desc">{__('Works with your WooCommerce store', 'wooptions-pro')}</p>
                </div>
              </div>
            </div>

            {/* Recently Edited Card */}
            <section className="wof-dashboard-card">
              <div className="wof-card-header">
                <div>
                  <h2 className="wof-card-header__title">{__('Recently Edited', 'wooptions-pro')}</h2>
                  <p className="wof-card-header__desc">{__('Continue working on your latest option sets.', 'wooptions-pro')}</p>
                </div>
                <button
                  type="button"
                  className="wof-card-header__link"
                  onClick={() => props.navigate('option-sets')}
                >
                  {__('View all →', 'wooptions-pro')}
                </button>
              </div>

              {loading ? (
                <WooOptionsPro.Components.Loading label={__('Loading your option sets…', 'wooptions-pro')} />
              ) : items.length ? (
                <div className="wof-recent-table-wrap">
                  <table className="wof-recent-table">
                    <thead>
                      <tr>
                        <th className="wof-col-name">{__('Name', 'wooptions-pro')}</th>
                        <th className="wof-col-type">{__('Type', 'wooptions-pro')}</th>
                        <th className="wof-col-status">{__('Status', 'wooptions-pro')}</th>
                        <th className="wof-col-updated">{__('Updated', 'wooptions-pro')}</th>
                        <th className="wof-col-actions">{__('Actions', 'wooptions-pro')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.uuid}>
                          <td className="wof-col-name">
                            <div className="wof-recent-name-wrap">
                              <span className="wof-recent-gear" aria-hidden="true">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="3" />
                                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                              </span>
                              <div className="wof-recent-meta-stack">
                                <button
                                  type="button"
                                  className="wof-recent-title-btn"
                                  onClick={() => props.navigate(`builder/${item.uuid}`)}
                                >
                                  {item.title}
                                </button>
                                <span className="wof-recent-subtext">
                                  {sprintf(__('ID: #%d • %d fields', 'wooptions-pro'), item.id || 1200, item.fieldCount ?? 0)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="wof-col-type">
                            <span className="wof-recent-type-pill">{__('Product Options', 'wooptions-pro')}</span>
                          </td>
                          <td className="wof-col-status">
                            {item.publishedRevisionId ? (
                              <span className="wof-status-indicator is-published">
                                <span className="wof-status-dot is-published" aria-hidden="true" />
                                <span>{__('Published', 'wooptions-pro')}</span>
                              </span>
                            ) : (
                              <span className="wof-status-indicator is-draft">
                                <span className="wof-status-dot is-draft" aria-hidden="true" />
                                <span>{__('Draft', 'wooptions-pro')}</span>
                              </span>
                            )}
                          </td>
                          <td className="wof-col-updated">
                            <time className="wof-recent-time">{WooOptionsPro.Utils.formatDate(item.updatedAtGmt)}</time>
                          </td>
                          <td className="wof-col-actions">
                            <div className="wof-row-menu" onClick={(e: any) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="wof-row-menu__toggle"
                                aria-expanded={activeMenuUuid === item.uuid}
                                onClick={() => setActiveMenuUuid(activeMenuUuid === item.uuid ? null : item.uuid)}
                                title={__('Actions', 'wooptions-pro')}
                              >
                                <WooOptionsPro.Components.Dashicon name="ellipsis" />
                              </button>
                              {activeMenuUuid === item.uuid ? (
                                <div className="wof-row-menu__popover">
                                  <button type="button" onClick={() => { setActiveMenuUuid(null); props.navigate(`builder/${item.uuid}`); }}>
                                    <WooOptionsPro.Components.Dashicon name="edit" />
                                    {__('Edit in Builder', 'wooptions-pro')}
                                  </button>
                                  <button type="button" onClick={() => handleDuplicate(item.uuid)}>
                                    <WooOptionsPro.Components.Dashicon name="admin-page" />
                                    {__('Duplicate', 'wooptions-pro')}
                                  </button>
                                  <button type="button" onClick={() => handleExport(item.uuid)}>
                                    <WooOptionsPro.Components.Dashicon name="download" />
                                    {__('Export JSON', 'wooptions-pro')}
                                  </button>
                                  <button type="button" className="is-destructive" onClick={() => handleDelete(item.uuid)}>
                                    <WooOptionsPro.Components.Dashicon name="trash" />
                                    {__('Delete permanently', 'wooptions-pro')}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="wof-recent-empty">
                  <p>{__('Your workshop is clear. Create your first option set to get started.', 'wooptions-pro')}</p>
                  <button
                    type="button"
                    className="wof-btn-hero-primary"
                    onClick={() => props.navigate('option-sets')}
                  >
                    {__('Create your first option set', 'wooptions-pro')}
                  </button>
                </div>
              )}
            </section>

            {/* Quick Start Templates Card */}
            <section className="wof-dashboard-card">
              <div className="wof-card-header">
                <div>
                  <h2 className="wof-card-header__title">{__('Quick Start Templates', 'wooptions-pro')}</h2>
                  <p className="wof-card-header__desc">{__('Production-tested option sets ready to import in one click.', 'wooptions-pro')}</p>
                </div>
                <button
                  type="button"
                  className="wof-card-header__link"
                  onClick={() => props.navigate('templates')}
                >
                  {__('Explore all templates →', 'wooptions-pro')}
                </button>
              </div>

              <div className="wof-template-grid-4">
                {displayTemplates.map((tpl) => (
                  <div
                    key={tpl.slug}
                    className="wof-template-card-4"
                    onClick={() => props.navigate('templates')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e: any) => {
                      if (e.key === 'Enter') props.navigate('templates');
                    }}
                  >
                    <div className="wof-template-card-4__thumb">
                      <img src={tpl.previewImage || previewImage} alt={tpl.name} loading="lazy" />
                      <span className="wof-template-card-4__tag">
                        {tpl.categoryLabel || tpl.category || __('PRE-MADE', 'wooptions-pro')}
                      </span>
                    </div>
                    <div className="wof-template-card-4__body">
                      <h4 className="wof-template-card-4__title" title={tpl.name}>{tpl.name}</h4>
                      <div className="wof-template-card-4__footer">
                        <span className="wof-template-card-4__fields">
                          {tpl.fieldsCount ? sprintf(__('%d fields', 'wooptions-pro'), tpl.fieldsCount) : __('Configured', 'wooptions-pro')}
                        </span>
                        <span className="wof-template-card-4__cta">{__('Use Template →', 'wooptions-pro')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column (Sidebar) */}
          <aside className="wof-dashboard-sidebar">
            {/* Quick Actions Card */}
            <div className="wof-sidebar-block">
              <h3 className="wof-sidebar-block__title">{__('Quick Actions', 'wooptions-pro')}</h3>
              <div className="wof-action-list">
                <button
                  type="button"
                  className="wof-action-item"
                  onClick={() => props.navigate('option-sets')}
                >
                  <span className="wof-action-item__icon is-blue" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                  <span className="wof-action-item__text">
                    <strong>{__('Create New Option Set', 'wooptions-pro')}</strong>
                    <small>{__('Build a custom product option set', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-action-item__chevron" aria-hidden="true">›</span>
                </button>

                <button
                  type="button"
                  className="wof-action-item"
                  onClick={() => props.navigate('templates')}
                >
                  <span className="wof-action-item__icon is-indigo" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                  </span>
                  <span className="wof-action-item__text">
                    <strong>{__('Browse Templates', 'wooptions-pro')}</strong>
                    <small>{__('Explore pre-built templates', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-action-item__chevron" aria-hidden="true">›</span>
                </button>

                <button
                  type="button"
                  className="wof-action-item"
                  onClick={() => props.navigate('option-sets')}
                >
                  <span className="wof-action-item__icon is-teal" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </span>
                  <span className="wof-action-item__text">
                    <strong>{__('Import / Export', 'wooptions-pro')}</strong>
                    <small>{__('Backup or migrate your data', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-action-item__chevron" aria-hidden="true">›</span>
                </button>

                <button
                  type="button"
                  className="wof-action-item"
                  onClick={() => props.navigate('settings')}
                >
                  <span className="wof-action-item__icon is-slate" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </span>
                  <span className="wof-action-item__text">
                    <strong>{__('Settings', 'wooptions-pro')}</strong>
                    <small>{__('Configure plugin options', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-action-item__chevron" aria-hidden="true">›</span>
                </button>
              </div>
            </div>

            {/* Resources & Support Card */}
            <div className="wof-sidebar-block">
              <h3 className="wof-sidebar-block__title">{__('Resources & Support', 'wooptions-pro')}</h3>
              <div className="wof-resource-list">
                <a
                  href="https://themefic.com/docs/wooptions-pro/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-item"
                >
                  <span className="wof-resource-item__icon is-purple" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </span>
                  <span className="wof-resource-item__text">
                    <strong>{__('Documentation', 'wooptions-pro')}</strong>
                    <small>{__('Step-by-step guides and tutorials', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-resource-item__chevron" aria-hidden="true">›</span>
                </a>

                <a
                  href="https://themefic.com/docs/wooptions-pro/tutorials/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-item"
                >
                  <span className="wof-resource-item__icon is-blue" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                  <span className="wof-resource-item__text">
                    <strong>{__('Video Tutorials', 'wooptions-pro')}</strong>
                    <small>{__('Learn with video walkthroughs', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-resource-item__chevron" aria-hidden="true">›</span>
                </a>

                <a
                  href="https://themefic.com/support/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-item"
                >
                  <span className="wof-resource-item__icon is-indigo" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                    </svg>
                  </span>
                  <span className="wof-resource-item__text">
                    <strong>{__('Get Help', 'wooptions-pro')}</strong>
                    <small>{__('Contact our support team', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-resource-item__chevron" aria-hidden="true">›</span>
                </a>

                <a
                  href="https://themefic.com/contact/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-item"
                >
                  <span className="wof-resource-item__icon is-teal" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <span className="wof-resource-item__text">
                    <strong>{__('Customer Support', 'wooptions-pro')}</strong>
                    <small>{__('Direct priority assistance', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-resource-item__chevron" aria-hidden="true">›</span>
                </a>

                <a
                  href="https://themefic.com/wooptions-pro/demo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-item"
                >
                  <span className="wof-resource-item__icon is-violet" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </span>
                  <span className="wof-resource-item__text">
                    <strong>{__('Live Demo', 'wooptions-pro')}</strong>
                    <small>{__('Experience interactive configurators', 'wooptions-pro')}</small>
                  </span>
                  <span className="wof-resource-item__chevron" aria-hidden="true">›</span>
                </a>
              </div>
            </div>

            {/* Need Custom Work or New Features? Card */}
            <div className="wof-upgrade-card">
              <div className="wof-upgrade-card__crown" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h4 className="wof-upgrade-card__title">{__('Need custom work or new features?', 'wooptions-pro')}</h4>
              <p className="wof-upgrade-card__desc">
                {__('We are actively adding new field types and integrations. Share your ideas with our engineering team.', 'wooptions-pro')}
              </p>
              <a
                href="https://themefic.com/contact/"
                target="_blank"
                rel="noopener noreferrer"
                className="wof-btn-upgrade-pro"
              >
                <span>{__('Contact Engineering', 'wooptions-pro')}</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </aside>
        </div>
      </div>
    );
  }
}
