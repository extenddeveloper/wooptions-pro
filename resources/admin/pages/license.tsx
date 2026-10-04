namespace WooOptionsPro.Pages {
  const { __ } = wp.i18n;
  const { useState } = wp.element;

  function maskKey(key: string, start = 4, end = 4): string {
    if (!key) return '••••••••••••••••';
    if (key.startsWith('v1:')) return '••••••••••••••••';
    if (key.includes('•')) return key;
    if (key.length <= start + end) return key;
    const prefix = key.slice(0, start);
    const suffix = key.slice(-end);
    const bullets = Math.min(14, Math.max(8, key.length - start - end));
    return `${prefix}${'•'.repeat(bullets)}${suffix}`;
  }

  export function LicensePage(props?: { navigate?: (route: string) => void }): any {
    const adminData = (window as any).WooOptionsProAdmin || {};
    const initialLicense = adminData.license || {};

    const [licenseState, setLicenseState] = useState({
      active: !!initialLicense.active || initialLicense.state === 'active' || !!initialLicense.canConfigure,
      key: initialLicense.key || '',
      expires: initialLicense.expires || 'Lifetime',
      licenseTitle: initialLicense.licenseTitle || 'Unlimited Site (Lifetime)',
      supportExpires: initialLicense.supportExpires || 'Unlimited',
      state: initialLicense.state || 'unlicensed',
      message: initialLicense.message || '',
    });

    const [inputKey, setInputKey] = useState('');
    const [inputEmail, setInputEmail] = useState('');
    const [keyError, setKeyError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    const ajaxUrl = initialLicense.ajaxUrl || adminData.ajaxUrl || 'admin-ajax.php';
    const nonce = initialLicense.nonce || adminData.nonce || '';
    const accountUrl = initialLicense.accountUrl || 'https://portal.themefic.com/my-account/';
    const purchaseUrl = initialLicense.purchaseUrl || 'https://themefic.com/plugins/woooptions-pro/';

    const handleActivate = async (e: any) => {
      e.preventDefault();
      if (!inputKey.trim()) {
        setKeyError(true);
        setNotice({ type: 'error', text: __('Please enter your license key.', 'wooptions-pro') });
        const inputEl = document.getElementById('wooptions_license_key');
        if (inputEl) inputEl.focus();
        return;
      }

      setBusy(true);
      setNotice(null);
      setKeyError(false);

      try {
        const formData = new URLSearchParams();
        formData.append('action', 'wooptions-pro_license_activate');
        formData.append('license_key', inputKey.trim());
        formData.append('license_email', inputEmail.trim());
        formData.append('_nonce', nonce);

        const res = await fetch(ajaxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: formData.toString(),
        });

        const data = await res.json().catch(() => ({}));
        if (!data || !data.success) {
          throw new Error(data?.data?.message || __('License activation failed. Please check the key.', 'wooptions-pro'));
        }

        setNotice({ type: 'success', text: __('License activated successfully! Reloading…', 'wooptions-pro') });
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch (err: any) {
        setKeyError(true);
        setNotice({
          type: 'error',
          text: err?.message || __('License activation failed. Please check your credentials.', 'wooptions-pro'),
        });
      } finally {
        setBusy(false);
      }
    };

    const handleDeactivate = async () => {
      if (!window.confirm(__('Deactivate this license on the current site?', 'wooptions-pro'))) {
        return;
      }

      setBusy(true);
      setNotice(null);

      try {
        const formData = new URLSearchParams();
        formData.append('action', 'wooptions-pro_license_deactivate');
        formData.append('_nonce', nonce);

        const res = await fetch(ajaxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: formData.toString(),
        });

        const data = await res.json().catch(() => ({}));
        if (!data || !data.success) {
          throw new Error(data?.data?.message || __('Deactivation failed.', 'wooptions-pro'));
        }

        setNotice({ type: 'success', text: __('License deactivated successfully! Reloading…', 'wooptions-pro') });
        setLicenseState({
          active: false,
          key: '',
          expires: '',
          licenseTitle: '',
          supportExpires: '',
          state: 'deactivated',
          message: __('The WooOptions Pro license is deactivated.', 'wooptions-pro'),
        });
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch (err: any) {
        setNotice({
          type: 'error',
          text: err?.message || __('Deactivation failed.', 'wooptions-pro'),
        });
      } finally {
        setBusy(false);
      }
    };

    const isActivated = licenseState.active;

    return (
      <div className="wholesalefic_licensing_wrap wof-license-wrap">
        <div id="wholesalefic_license_body" className={`wholesalefic_licensing_body ${busy ? 'wholesalefic_loading' : ''}`}>
          <div className="wholesalefic-license-layout">
            {/* Left Card */}
            <section className="wholesalefic-license-main" aria-labelledby="wooptions-license-title">
              {isActivated ? (
                <>
                  <div className="wholesalefic-license-main__header">
                    <div className="wholesalefic-license-title-row">
                      <h2 id="wooptions-license-title">{__('Your license is active', 'wooptions-pro')}</h2>
                      <span className="wholesalefic-license-badge">
                        <span className="wholesalefic-license-badge__dot" aria-hidden="true" />
                        {__('Activated', 'wooptions-pro')}
                      </span>
                    </div>
                    <p>
                      {__('This site is licensed and can receive plugin updates and access all premium WooOptions Pro features.', 'wooptions-pro')}
                    </p>
                  </div>

                  <div className="wholesalefic-license-main__body wholesalefic-license-main__body--active">
                    <h3 className="wholesalefic-license-section-title">{__('License details', 'wooptions-pro')}</h3>
                    <p className="wholesalefic-license-section-description">
                      {__('Details about the license currently activated on this site', 'wooptions-pro')}
                    </p>

                    <div className="wholesalefic-license-info-list">
                      <div className="wholesalefic-license-info-row">
                        <span className="label">{__('License key', 'wooptions-pro')}</span>
                        <span className="value license-key">{maskKey(licenseState.key)}</span>
                      </div>
                      <div className="wholesalefic-license-info-row">
                        <span className="label">{__('License Type', 'wooptions-pro')}</span>
                        <span className="value">{licenseState.licenseTitle}</span>
                      </div>
                      <div className="wholesalefic-license-info-row">
                        <span className="label">{__('License Expires', 'wooptions-pro')}</span>
                        <span className="value">{licenseState.expires}</span>
                      </div>
                      <div className="wholesalefic-license-info-row">
                        <span className="label">{__('Support Expires', 'wooptions-pro')}</span>
                        <span className="value">{licenseState.supportExpires}</span>
                      </div>
                    </div>

                    <div className="wholesalefic-license-quick-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        className="button wholesalefic-license-button wholesalefic-license-button--primary"
                        onClick={() => props?.navigate ? props.navigate('templates') : (window.location.hash = '#/templates')}
                      >
                        {__('Browse Templates', 'wooptions-pro')}
                      </button>
                      <button
                        type="button"
                        className="button wholesalefic-license-button wholesalefic-license-button--ghost"
                        onClick={() => props?.navigate ? props.navigate('option-sets') : (window.location.hash = '#/option-sets')}
                      >
                        {__('Option Sets', 'wooptions-pro')}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="wholesalefic-license-main__header">
                    <h2 id="wooptions-license-title">{__('Activate License', 'wooptions-pro')}</h2>
                    <p>
                      {__('Enter your license key from your purchase email to unlock premium features and receive plugin updates.', 'wooptions-pro')}
                    </p>
                  </div>

                  <div className="wholesalefic-license-main__body">
                    <form className="wholesalefic_licensing_form" onSubmit={handleActivate}>
                      <div className="wholesalefic-license-field">
                        <div className="wholesalefic-license-field__label-row">
                          <label htmlFor="wooptions_license_key">{__('License key', 'wooptions-pro')}</label>
                          <a
                            className="wholesalefic-license-field__link"
                            rel="noopener noreferrer"
                            target="_blank"
                            href={accountUrl}
                          >
                            {__("Can't find your license key?", 'wooptions-pro')}
                          </a>
                        </div>
                        <div className={`license-input ${keyError ? 'license-input--error' : ''}`}>
                          <span className="license-input__icon" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="5.25" cy="9.25" r="2.75" stroke="currentColor" strokeWidth="1.4" />
                              <path d="M7.2 7.3L12.4 2.1M10.6 3.9L12.1 5.4M9.2 5.3L10.7 6.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <input
                            id="wooptions_license_key"
                            type="password"
                            autoComplete="off"
                            spellCheck={false}
                            name="wooptions_license_key"
                            value={inputKey}
                            onChange={(e: any) => {
                              setInputKey(e.target.value);
                              if (keyError) setKeyError(false);
                              if (notice) setNotice(null);
                            }}
                            placeholder={__('Enter your license key', 'wooptions-pro')}
                            disabled={busy}
                          />
                        </div>
                        <p className="wholesalefic-license-field__help">
                          {__('You can find your license key in your purchase confirmation email.', 'wooptions-pro')}
                        </p>
                      </div>

                      <div className="wholesalefic-license-field">
                        <div className="wholesalefic-license-field__label-row">
                          <label htmlFor="wooptions_license_email">
                            {__('Purchase email', 'wooptions-pro')} <span>{__('(Optional)', 'wooptions-pro')}</span>
                          </label>
                        </div>
                        <div className="license-input">
                          <span className="license-input__icon" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="2.25" y="3.5" width="11.5" height="9" rx="1.25" stroke="currentColor" strokeWidth="1.4" />
                              <path d="M2.8 4.25L8 8.15L13.2 4.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <input
                            id="wooptions_license_email"
                            type="email"
                            autoComplete="email"
                            name="wooptions_license_email"
                            value={inputEmail}
                            onChange={(e: any) => setInputEmail(e.target.value)}
                            placeholder={__('you@example.com', 'wooptions-pro')}
                            disabled={busy}
                          />
                        </div>
                        <p className="wholesalefic-license-field__help">
                          {__("Only required if your license can't be verified using the key alone.", 'wooptions-pro')}
                        </p>
                      </div>

                      <button
                        type="submit"
                        id="license_key_submit"
                        className="button wholesalefic-license-button wholesalefic-license-button--primary"
                        disabled={busy}
                      >
                        {busy ? __('Activating…', 'wooptions-pro') : __('Activate License', 'wooptions-pro')}
                      </button>
                    </form>

                    <div id="wholesalefic_error_wrapper" role="alert" aria-live="polite">
                      {notice && (
                        <div className={notice.type === 'success' ? 'wholesalefic_success_notice' : 'wholesalefic_error_notice'}>
                          {notice.text}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Right Aside */}
            <aside className="wholesalefic-license-aside">
              <div className="wholesalefic-license-aside__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2.5L16.05 5.02L20 4.76L20.98 8.6L24.5 10.5L23 14.17L24.5 17.84L20.98 19.74L20 23.58L16.05 23.32L13 25.84L9.95 23.32L6 23.58L5.02 19.74L1.5 17.84L3 14.17L1.5 10.5L5.02 8.6L6 4.76L9.95 5.02L13 2.5Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M13 8.4L14.55 11.55L18 12.05L15.5 14.48L16.09 17.91L13 16.29L9.91 17.91L10.5 14.48L8 12.05L11.45 11.55L13 8.4Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>

              {isActivated ? (
                <>
                  <h3>{__('License Benefits', 'wooptions-pro')}</h3>
                  <p>{__('Manage your license or access your WooOptions Pro account', 'wooptions-pro')}</p>

                  <ul className="wholesalefic-license-feature-list">
                    <li>{__('Automatic plugin updates are enabled', 'wooptions-pro')}</li>
                    <li>{__('All premium features are available on this site', 'wooptions-pro')}</li>
                    <li>{__('You can deactivate or transfer this license later if needed', 'wooptions-pro')}</li>
                  </ul>

                  <div className="wholesalefic-license-action-box">
                    <button
                      type="button"
                      id="wholesalefic_deactivate_license"
                      className="button wholesalefic-license-button wholesalefic-license-button--danger"
                      onClick={handleDeactivate}
                      disabled={busy}
                    >
                      {busy ? __('Processing…', 'wooptions-pro') : __('Deactivate License', 'wooptions-pro')}
                    </button>
                    <a
                      className="button wholesalefic-license-button wholesalefic-license-button--ghost"
                      rel="noopener noreferrer"
                      target="_blank"
                      href={accountUrl}
                    >
                      {__('Open My Account', 'wooptions-pro')}
                    </a>
                  </div>

                  <div id="wholesalefic_error_wrapper_active" role="alert" aria-live="polite">
                    {notice && (
                      <div className={notice.type === 'success' ? 'wholesalefic_success_notice' : 'wholesalefic_error_notice'}>
                        {notice.text}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h3>{__("After activation, you'll get", 'wooptions-pro')}</h3>
                  <p>{__('Activate your license to keep your store updated and unlock premium features.', 'wooptions-pro')}</p>

                  <ul className="wholesalefic-license-feature-list">
                    <li>{__('Automatic plugin updates', 'wooptions-pro')}</li>
                    <li>{__('Access to all premium features', 'wooptions-pro')}</li>
                    <li>{__('License management for this website', 'wooptions-pro')}</li>
                  </ul>

                  <div className="wholesalefic-license-purchase-card">
                    <div className="wholesalefic-license-purchase-card__content">
                      <span>{__("DON'T HAVE A LICENSE YET?", 'wooptions-pro')}</span>
                      <strong>{__('Get WooOptions Pro Premium', 'wooptions-pro')}</strong>
                    </div>
                    <a
                      className="wholesalefic-license-purchase-card__button"
                      rel="noopener noreferrer"
                      target="_blank"
                      href={purchaseUrl}
                    >
                      {__('Purchase License', 'wooptions-pro')}
                    </a>
                  </div>
                </>
              )}
            </aside>
          </div>
        </div>
      </div>
    );
  }
}
