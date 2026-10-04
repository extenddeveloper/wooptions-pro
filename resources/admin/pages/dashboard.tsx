namespace WooptionsFic.Pages {
  const { Button } = wp.components;
  const { __, sprintf } = wp.i18n;
  const { useEffect, useState } = wp.element;

  export function Dashboard(props: { navigate: (route: string) => void }): any {
    const [items, setItems] = useState<WooptionsFic.OptionSetRecord[]>([]);
    const [templates, setTemplates] = useState<WooptionsFic.TemplateRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      Promise.all([
        WooptionsFic.Api.listOptionSets({ perPage: 5 }),
        WooptionsFic.Api.listTemplates().catch(() => ({ items: [] }))
      ])
        .then(([optionSetsRes, templatesRes]) => {
          setItems(optionSetsRes.items || []);
          setTemplates((templatesRes.items || []).slice(0, 3));
        })
        .finally(() => setLoading(false));
    }, []);

    const published = items.filter((item) => item.publishedRevisionId).length;
    const adminConfig = (window as any).WooptionsFicAdmin || {};
    const userName = adminConfig.currentUser?.name?.split(' ')[0] ?? adminConfig.currentUser?.name ?? 'Admin';
    const previewImage = (adminConfig.assetsUrl || '') + 'images/builder-preview.webp';

    return (
      <div className="wof-page">
        <WooptionsFic.Components.PageHeader
          title={sprintf(__('Good to see you, %s.', 'wooptionsfic'), userName)}
          description={__('Build thoughtful product choices, price them safely, and publish without touching theme code.', 'wooptionsfic')}
          actions={
            <Button variant="primary" onClick={() => props.navigate('option-sets')}>
              {__('Create an option set', 'wooptionsfic')}
            </Button>
          }
        />

        <section className="wof-hero-card">
          <div className="wof-hero-card__copy">
            <h2>{__('A polished configurator in three moves', 'wooptionsfic')}</h2>
            <div className="wof-steps">
              <div>
                <b>1</b>
                <span>
                  <strong>{__('Shape', 'wooptionsfic')}</strong>
                  <small>{__('Add fields, swatches, formulas & choices', 'wooptionsfic')}</small>
                </span>
              </div>
              <div>
                <b>2</b>
                <span>
                  <strong>{__('Assign', 'wooptionsfic')}</strong>
                  <small>{__('Target matching products or categories', 'wooptionsfic')}</small>
                </span>
              </div>
              <div>
                <b>3</b>
                <span>
                  <strong>{__('Publish', 'wooptionsfic')}</strong>
                  <small>{__('Run server checks and go live seamlessly', 'wooptionsfic')}</small>
                </span>
              </div>
            </div>
            <div className="wof-inline-actions">
              <Button variant="primary" onClick={() => props.navigate('option-sets')}>
                {__('Create an option set', 'wooptionsfic')}
              </Button>
              <Button variant="secondary" onClick={() => props.navigate('templates')}>
                {__('Explore templates', 'wooptionsfic')}
              </Button>
            </div>
          </div>

          <div className="wof-hero-preview">
            <div
              className="wof-preview-window"
              onClick={() => props.navigate('templates')}
              title={__('Click to explore Visual Builder & Templates', 'wooptionsfic')}
              role="button"
              tabIndex={0}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter') props.navigate('templates');
              }}
            >
              <div className="wof-preview-window__bar">
                <div className="wof-preview-window__controls" aria-hidden="true">
                  <i className="is-close" />
                  <i className="is-minimize" />
                  <i className="is-maximize" />
                </div>
                <div className="wof-preview-window__title">
                  <span>{__('WooptionsFic Live Builder', 'wooptionsfic')}</span>
                </div>
                <div className="wof-preview-window__badge">
                  <span className="wof-pulse-dot" />
                  <span>{__('Live Canvas', 'wooptionsfic')}</span>
                </div>
              </div>
              <div className="wof-preview-window__screen">
                <img
                  src={previewImage}
                  alt={__('WooptionsFic Live Builder Interface', 'wooptionsfic')}
                  className="wof-preview-window__img"
                  loading="eager"
                />
                <div className="wof-preview-window__overlay">
                  <span className="wof-preview-window__cta">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {__('Open Visual Builder', 'wooptionsfic')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="wof-stat-grid">
          <div className="wof-stat">
            <span>{__('Active sets', 'wooptionsfic')}</span>
            <strong>{items.length}</strong>
            <small>{__('Option sets available in your store', 'wooptionsfic')}</small>
          </div>
          <div className="wof-stat">
            <span>{__('Published', 'wooptionsfic')}</span>
            <strong>{published}</strong>
            <small>{__('Immutable live revisions in checkout', 'wooptionsfic')}</small>
          </div>
          <div className="wof-stat">
            <span>{__('Built-in templates', 'wooptionsfic')}</span>
            <strong>10</strong>
            <small>{__('Ready to customize and launch', 'wooptionsfic')}</small>
          </div>
          <div className="wof-stat is-accent">
            <span>{__('Commerce truth', 'wooptionsfic')}</span>
            <strong>100%</strong>
            <small>{__('Calculated on the server for safety', 'wooptionsfic')}</small>
          </div>
        </div>

        <div className="wof-dashboard-grid">
          <div className="wof-dashboard-main">
            <section className="wof-panel">
              <div className="wof-panel__header">
                <div>
                  <h2>{__('Recently edited', 'wooptionsfic')}</h2>
                  <p>{__('Pick up exactly where you left off in your option sets.', 'wooptionsfic')}</p>
                </div>
                <div className="wof-inline-actions">
                  <Button variant="secondary" onClick={() => props.navigate('option-sets')}>
                    {__('Create new', 'wooptionsfic')}
                  </Button>
                  <Button variant="tertiary" onClick={() => props.navigate('option-sets')}>
                    {__('View all', 'wooptionsfic')}
                  </Button>
                </div>
              </div>
              {loading ? (
                <WooptionsFic.Components.Loading label={__('Loading your workshop…', 'wooptionsfic')} />
              ) : items.length ? (
                <div className="wof-recent-list">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.uuid}
                      onClick={() => props.navigate(`builder/${item.uuid}`)}
                    >
                      <span className="wof-set-glyph">
                        <WooptionsFic.Components.Dashicon name="screenoptions" />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{WooptionsFic.Utils.formatDate(item.updatedAtGmt)}</small>
                      </span>
                      <WooptionsFic.Components.StatusPill
                        status={item.publishedRevisionId ? __('Published', 'wooptionsfic') : __('Draft', 'wooptionsfic')}
                      />
                      <b aria-hidden="true">→</b>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="wof-panel__empty">
                  <p>{__('Your workshop is clear. Import a template or create a blank option set.', 'wooptionsfic')}</p>
                  <Button variant="primary" onClick={() => props.navigate('option-sets')}>
                    {__('Create your first option set', 'wooptionsfic')}
                  </Button>
                </div>
              )}
            </section>

            {templates.length > 0 ? (
              <section className="wof-panel wof-dashboard-templates-panel">
                <div className="wof-panel__header">
                  <div>
                    <h2>{__('Quick Start Templates', 'wooptionsfic')}</h2>
                    <p>{__('Production-tested option sets ready to import in one click.', 'wooptionsfic')}</p>
                  </div>
                  <Button variant="tertiary" onClick={() => props.navigate('templates')}>
                    {__('Explore all 10 templates →', 'wooptionsfic')}
                  </Button>
                </div>
                <div className="wof-template-quick-grid">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.slug}
                      className="wof-template-quick-card"
                      onClick={() => props.navigate('templates')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === 'Enter') props.navigate('templates');
                      }}
                    >
                      {tpl.previewImage ? (
                        <div className="wof-template-quick-card__thumb">
                          <img src={tpl.previewImage} alt={tpl.name} loading="lazy" />
                          <span className="wof-template-quick-card__tag">{tpl.categoryLabel || tpl.category}</span>
                        </div>
                      ) : null}
                      <div className="wof-template-quick-card__body">
                        <h4>{tpl.name}</h4>
                        <div className="wof-template-quick-card__meta">
                          <span>{tpl.fieldsCount ? sprintf(__('%d fields', 'wooptionsfic'), tpl.fieldsCount) : __('Configured', 'wooptionsfic')}</span>
                          <span className="wof-template-quick-card__cta">{__('Use Template →', 'wooptionsfic')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="wof-dashboard-sidebar">
            <div className="wof-sidebar-card wof-sidebar-resources">
              <div className="wof-sidebar-card__header">
                <span className="wof-sidebar-card__eyebrow">{__('Support & Guides', 'wooptionsfic')}</span>
                <h3>{__('Resources', 'wooptionsfic')}</h3>
                <p>{__('Everything you need to master your storefront product options.', 'wooptionsfic')}</p>
              </div>

              <div className="wof-resource-links">
                <a
                  href="https://themefic.com/docs/wooptionsfic/tutorials/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-link is-tutorial"
                >
                  <span className="wof-resource-link__icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </span>
                  <span className="wof-resource-link__content">
                    <strong>{__('Tutorial For Beginner', 'wooptionsfic')}</strong>
                    <small>{__('Step-by-step walkthrough to build your first configurator', 'wooptionsfic')}</small>
                  </span>
                  <span className="wof-resource-link__arrow" aria-hidden="true">→</span>
                </a>

                <a
                  href="https://themefic.com/docs/wooptionsfic/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-link is-docs"
                >
                  <span className="wof-resource-link__icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </span>
                  <span className="wof-resource-link__content">
                    <strong>{__('Documentation link', 'wooptionsfic')}</strong>
                    <small>{__('Field types, formulas, logic rules & developer hooks', 'wooptionsfic')}</small>
                  </span>
                  <span className="wof-resource-link__arrow" aria-hidden="true">→</span>
                </a>

                <a
                  href="https://themefic.com/support/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-link is-help"
                >
                  <span className="wof-resource-link__icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <span className="wof-resource-link__content">
                    <strong>{__('Get help', 'wooptionsfic')}</strong>
                    <small>{__('Knowledge base, FAQs & community troubleshooting', 'wooptionsfic')}</small>
                  </span>
                  <span className="wof-resource-link__arrow" aria-hidden="true">→</span>
                </a>

                <a
                  href="https://themefic.com/contact/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-link is-support"
                >
                  <span className="wof-resource-link__icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                    </svg>
                  </span>
                  <span className="wof-resource-link__content">
                    <strong>{__('Customer support', 'wooptionsfic')}</strong>
                    <small>{__('Direct priority assistance from our core development team', 'wooptionsfic')}</small>
                  </span>
                  <span className="wof-resource-link__arrow" aria-hidden="true">→</span>
                </a>

                <a
                  href="https://themefic.com/wooptionsfic/demo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wof-resource-link is-demo"
                >
                  <span className="wof-resource-link__icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </span>
                  <span className="wof-resource-link__content">
                    <strong>{__('Live Demo link', 'wooptionsfic')}</strong>
                    <small>{__('Experience interactive storefront configurators live', 'wooptionsfic')}</small>
                  </span>
                  <span className="wof-resource-link__arrow" aria-hidden="true">→</span>
                </a>
              </div>
            </div>


            <div className="wof-sidebar-card is-callout">
              <div className="wof-callout-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h4>{__('Need custom work or new features?', 'wooptionsfic')}</h4>
              <p>{__('We are actively adding new field types and integrations. Share your ideas with our engineering team.', 'wooptionsfic')}</p>
              <a
                href="https://themefic.com/contact/"
                target="_blank"
                rel="noopener noreferrer"
                className="components-button is-secondary is-small"
              >
                {__('Contact Engineering →', 'wooptionsfic')}
              </a>
            </div>
          </aside>
        </div>
      </div>
    );
  }
}
