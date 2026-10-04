namespace WooptionsFic.Components {
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

    const navItems = [
      { id: 'dashboard', label: __('Dashboard', 'wooptionsfic') },
      { id: 'option-sets', label: __('Option Sets', 'wooptionsfic') },
      { id: 'templates', label: __('Templates', 'wooptionsfic') },
      { id: 'analytics', label: __('Analytics', 'wooptionsfic') },
      { id: 'settings', label: __('Settings', 'wooptionsfic') },
    ];

    return (
      <div className="wof-admin">
        <header className="wof-admin__masthead">
          {/* Left: Brand */}
          <button type="button" className="wof-brand" onClick={() => props.navigate('dashboard')} title={__('Go to Dashboard', 'wooptionsfic')}>
            <span className="wof-brand-mark">
              <Dashicon name="screenoptions" />
            </span>
            <span className="wof-brand-name">WooptionsFic</span>
          </button>

          {/* Middle: Navigation Links */}
          <nav className="wof-masthead__nav" aria-label={__('Primary navigation', 'wooptionsfic')}>
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
              <span className="wof-masthead__support-text">{__('Having troubles?', 'wooptionsfic')}</span>{' '}
              <a
                href="https://wholesalefic.com/support"
                target="_blank"
                rel="noopener noreferrer"
                className="wof-masthead__tutorial-link"
              >
                {__('Tutorial', 'wooptionsfic')}
              </a>
            </div>

            <button
              type="button"
              className="wof-masthead__hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={__('Toggle mobile navigation', 'wooptionsfic')}
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
            <aside className="wof-mobile-nav-drawer" role="dialog" aria-label={__('Mobile navigation', 'wooptionsfic')}>
              <div className="wof-mobile-nav__header">
                <div className="wof-brand">
                  <span className="wof-brand-mark">
                    <Dashicon name="screenoptions" />
                  </span>
                  <span className="wof-brand-name">WooptionsFic</span>
                </div>
                <button
                  type="button"
                  className="wof-mobile-nav__close"
                  onClick={() => setMobileOpen(false)}
                  aria-label={__('Close menu', 'wooptionsfic')}
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
                  <span>{__('Having troubles?', 'wooptionsfic')}</span>{' '}
                  <a
                    href="https://wholesalefic.com/support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wof-masthead__tutorial-link"
                  >
                    {__('Tutorial', 'wooptionsfic')}
                  </a>
                </div>
              </div>
            </aside>
          </>
        )}

        <div className="wof-admin__body">
          <main className="wof-admin__content">{props.children}</main>
        </div>
        <ToastContainer />
      </div>
    );
  }
}
