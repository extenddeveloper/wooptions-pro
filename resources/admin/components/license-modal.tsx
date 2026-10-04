namespace WooOptionsPro.Components {
  const { __ } = wp.i18n;

  export function LicenseOverlayModal(props: {
    featureTitle?: string;
    onActivate: () => void;
    onDismiss: () => void;
  }): any {
    const adminData = (window as any).WooOptionsProAdmin || {};
    const licenseInfo = adminData.license;
    const state = (licenseInfo?.state || 'unlicensed').toLowerCase();

    const stateLabels: Record<string, string> = {
      unlicensed: __('LICENSE INACTIVE', 'wooptions-pro'),
      expired: __('LICENSE EXPIRED', 'wooptions-pro'),
      connection_error: __('LICENSE CHECK FAILED', 'wooptions-pro'),
      invalid: __('LICENSE INVALID', 'wooptions-pro'),
      deactivated: __('LICENSE DEACTIVATED', 'wooptions-pro'),
    };

    const stateLabel = stateLabels[state] || state.toUpperCase().replace(/_/g, ' ');
    const title = props.featureTitle || __('WooOptions Pro', 'wooptions-pro');
    const message =
      licenseInfo?.message ||
      __('The WooOptions Pro license is deactivated. Activate a license to continue.', 'wooptions-pro');

    const assetsUrl = adminData.assetsUrl || (adminData.pluginUrl ? adminData.pluginUrl + 'assets/' : '');
    const shieldUrl = assetsUrl ? `${assetsUrl}images/pro-badge-sheild.svg` : '';
    const supportUrl = 'https://themefic.com/support';

    const features = [
      {
        icon: (
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 20v-1.5A6.5 6.5 0 0 1 11.5 12h1A6.5 6.5 0 0 1 19 18.5V20" />
          </svg>
        ),
        title: __('Option Fields', 'wooptions-pro'),
      },
      {
        icon: (
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.5 12h17M12 3c2.4 2.5 3.5 5.5 3.5 9S14.4 18.5 12 21c-2.4-2.5-3.5-5.5-3.5-9S9.6 5.5 12 3Z" />
          </svg>
        ),
        title: __('Pricing Formulas', 'wooptions-pro'),
      },
      {
        icon: (
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 5.5V12l7.5 7.5a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8L12 4H5.5A1.5 1.5 0 0 0 4 5.5Z" />
            <circle cx="8.2" cy="8.2" r="1.2" />
          </svg>
        ),
        title: __('Conditional Rules', 'wooptions-pro'),
      },
      {
        icon: (
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="m8 4 3 5H5l3-5Zm8 0 3 5h-6l3-5ZM5 14h6v6H5v-6Zm11 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
          </svg>
        ),
        title: __('Product Assignment', 'wooptions-pro'),
      },
    ];

    return (
      <div
        className="ws-license-overlay wof-license-overlay"
        role="region"
        aria-label={__('WooOptions Pro license required', 'wooptions-pro')}
      >
        <div className="ws-license-overlay__card">
          <div className="ws-license-overlay__body">
            <div className="ws-license-overlay__icon" aria-hidden="true">
              {shieldUrl ? (
                <img src={shieldUrl} alt="badge" width="132" height="100" />
              ) : (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="48" rx="24" fill="#EEF2FF" />
                  <path d="M24 12L34 16.5V23C34 29.5 29.7 35.5 24 37C18.3 35.5 14 29.5 14 23V16.5L24 12Z" fill="#5271FF" />
                  <path d="M20 24L23 27L28 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <div className="ws-license-overlay__topline">
              <span className="ws-license-overlay__badge" aria-hidden="true">
                <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="m10 1.8 2 2.1 2.9-.1.7 2.8 2.5 1.6-1.3 2.7.9 2.8-2.6 1.4-.6 2.9-2.9-.3L10 20l-2-2.1-2.9.1-.7-2.8-2.5-1.6 1.3-2.7-.9-2.8 2.6-1.4.6-2.9 2.9.3L10 1.8Z" fill="currentColor" />
                  <path d="m8 10 1.3 1.3 2.8-3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>{__('PRO', 'wooptions-pro')}</span>
              <span className="ws-license-overlay__dot" aria-hidden="true">·</span>
              <span className="ws-license-overlay__state">{stateLabel}</span>
            </div>

            <h2>
              {__('Activate your license to unlock', 'wooptions-pro')} {title}
            </h2>
            <p className="ws-license-overlay__message">{message}</p>

            <div className="ws-license-overlay__features" aria-label={__('Premium feature highlights', 'wooptions-pro')}>
              {features.map((item, idx) => (
                <div key={idx} className="ws-license-overlay__feature">
                  <span className="ws-license-overlay__feature-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>

            <div className="ws-license-overlay__actions">
              <button
                type="button"
                className="wholesalefic-btn wholesalefic-btn--primary"
                onClick={props.onActivate}
              >
                {__('Activate License', 'wooptions-pro')}
              </button>
              <button
                type="button"
                className="wholesalefic-btn wholesalefic-btn--secondary"
                onClick={props.onDismiss}
              >
                {__('Dismiss & View Preview', 'wooptions-pro')}
              </button>
            </div>
          </div>

          <div className="ws-license-overlay__footer">
            <a
              className="ws-license-overlay__help"
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10v6M12 7h.01" />
              </svg>
              <span>{__('Need help? Contact support', 'wooptions-pro')}</span>
            </a>
            <button
              type="button"
              className="ws-license-overlay__dismiss"
              onClick={props.onDismiss}
            >
              {__('Dismiss', 'wooptions-pro')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
