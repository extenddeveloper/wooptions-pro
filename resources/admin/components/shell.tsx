namespace WooOptionsPro.Components {
  const { __ } = wp.i18n;
  const { useState } = wp.element;

  export function AdminShell(props: { route: string; navigate: (route: string) => void; children?: any }): any {
    const isBuilder = props.route.startsWith('builder/');
    const [mobileOpen, setMobileOpen] = useState(false);

    if (isBuilder) {
      return (
        <div className="wof-admin is-builder">
          <main className="wof-admin__content">{props.children}</main>
          <ToastContainer />
        </div>
      );
    }

    const licenseInfo = (window as any).WooOptionsProAdmin?.license;
    const isLicenseActive = licenseInfo?.active === true && !!licenseInfo?.key;
    const canConfigure = licenseInfo?.canConfigure !== false && isLicenseActive;
    const [overlayDismissed, setOverlayDismissed] = useState(false);

    const navItems = [
      { id: 'dashboard', label: __('Dashboard', 'wooptions-pro') },
      { id: 'option-sets', label: __('Option Sets', 'wooptions-pro') },
      { id: 'templates', label: __('Templates', 'wooptions-pro') },
      { id: 'analytics', label: __('Analytics', 'wooptions-pro') },
      { id: 'settings', label: __('Settings', 'wooptions-pro') },
      { id: 'license', label: __('License', 'wooptions-pro') },
    ];

    const featureTitles: Record<string, string> = {
      dashboard: __('Dashboard', 'wooptions-pro'),
      'option-sets': __('Option Sets', 'wooptions-pro'),
      templates: __('Templates', 'wooptions-pro'),
      analytics: __('Analytics', 'wooptions-pro'),
      settings: __('Settings', 'wooptions-pro'),
    };

    const isLicensePage = props.route === 'license';
    const showOverlay = !canConfigure && !isLicensePage && !overlayDismissed;

    return (
      <div className="wof-admin">
        <header className="wof-admin__masthead">
          {/* Left: Brand */}
          <button type="button" className="wof-brand" onClick={() => props.navigate('dashboard')} title={__('Go to Dashboard', 'wooptions-pro')}>
            <span className="wof-brand-mark">
              <Dashicon name="screenoptions" />
            </span>
            <span className="wof-brand-name">WooOptions Pro</span>
          </button>

          {/* Middle: Navigation Links */}
          <nav className="wof-masthead__nav" aria-label={__('Primary navigation', 'wooptions-pro')}>
            {navItems.map((item) => {
              const isActive = props.route === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`wof-masthead__nav-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => props.navigate(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Support & Mobile Hamburger */}
          <div className="wof-masthead__right">
            <div className="wof-masthead__support">
              <span className="wof-masthead__support-text">{__('Having troubles?', 'wooptions-pro')}</span>{' '}
              <a
                href="https://themefic.com/support"
                target="_blank"
                rel="noopener noreferrer"
                className="wof-masthead__tutorial-link"
              >
                {__('Support', 'wooptions-pro')}
              </a>
            </div>

            <button
              type="button"
              className="wof-masthead__hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={__('Toggle mobile navigation', 'wooptions-pro')}
              aria-expanded={mobileOpen}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer & Backdrop */}
        {mobileOpen && (
          <>
            <div
              className="wof-mobile-nav-backdrop"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="wof-mobile-nav-drawer" role="dialog" aria-label={__('Mobile navigation', 'wooptions-pro')}>
              <div className="wof-mobile-nav__header">
                <div className="wof-brand">
                  <span className="wof-brand-mark">
                    <Dashicon name="screenoptions" />
                  </span>
                  <span className="wof-brand-name">WooOptions Pro</span>
                </div>
                <button
                  type="button"
                  className="wof-mobile-nav__close"
                  onClick={() => setMobileOpen(false)}
                  aria-label={__('Close menu', 'wooptions-pro')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="wof-mobile-nav__body">
                {navItems.map((item) => {
                  const isActive = props.route === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`wof-mobile-nav__item ${isActive ? 'is-active' : ''}`}
                      onClick={() => {
                        props.navigate(item.id);
                        setMobileOpen(false);
                      }}
                    >
                      <span>{item.label}</span>
                      {isActive && <span className="wof-mobile-nav__active-dot" aria-hidden="true">●</span>}
                    </button>
                  );
                })}
              </div>

              <div className="wof-mobile-nav__footer">
                <div className="wof-masthead__support">
                  <span>{__('Having troubles?', 'wooptions-pro')}</span>{' '}
                  <a
                    href="https://themefic.com/support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wof-masthead__tutorial-link"
                  >
                    {__('Support', 'wooptions-pro')}
                  </a>
                </div>
              </div>
            </aside>
          </>
        )}

        {!canConfigure && !isLicensePage && overlayDismissed && (
          <div className="wof-license-banner">
            <div className="wof-license-banner__content">
              <span className="wof-license-banner__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <span>
                {licenseInfo?.message ||
                  __('Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro')}
              </span>
            </div>
            <button
              type="button"
              className="wof-license-banner__button"
              onClick={() => props.navigate('license')}
            >
              {licenseInfo?.state === 'expired' ? __('Renew License', 'wooptions-pro') : __('Activate License', 'wooptions-pro')}
            </button>
          </div>
        )}

        <div className={`wof-admin__body ${showOverlay ? 'wof-admin__body--locked' : ''}`}>
          <main className="wof-admin__content" inert={showOverlay ? true : undefined} aria-hidden={showOverlay ? true : undefined}>
            {props.children}
          </main>
          {showOverlay && (
            <LicenseOverlayModal
              featureTitle={featureTitles[props.route] || __('Option Sets', 'wooptions-pro')}
              onActivate={() => props.navigate('license')}
              onDismiss={() => setOverlayDismissed(true)}
            />
          )}
        </div>
        <ToastContainer />
      </div>
    );
  }
}
