namespace WooOptionsPro.Pages {
  const { Button, SelectControl, TextControl, ToggleControl } = wp.components;
  const { __ } = wp.i18n;
  const { useEffect, useState } = wp.element;

  function CustomFontsManager(props: {
    fonts: any[];
    onChange: (fonts: any[]) => void;
  }): any {
    const [name, setName] = useState('');
    const [weight, setWeight] = useState('400');
    const [style, setStyle] = useState<'normal' | 'italic'>('normal');
    const [files, setFiles] = useState<Record<string, string>>({});

    // Inject @font-face rules into DOM for instant live preview
    useEffect(() => {
      let styleTag = document.getElementById('wof-custom-fonts-live') as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'wof-custom-fonts-live';
        document.head.appendChild(styleTag);
      }
      const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
      const fixUrl = (u: string) => {
        if (!u || typeof u !== 'string') return '';
        return isHttps ? u.replace(/^http:\/\//i, 'https://') : u;
      };
      let css = '';
      props.fonts.forEach((f) => {
        if (!f.files) return;
        const srcs: string[] = [];
        if (f.files.woff2) srcs.push(`url('${fixUrl(f.files.woff2)}') format('woff2')`);
        if (f.files.woff) srcs.push(`url('${fixUrl(f.files.woff)}') format('woff')`);
        if (f.files.ttf) srcs.push(`url('${fixUrl(f.files.ttf)}') format('truetype')`);
        if (f.files.otf) srcs.push(`url('${fixUrl(f.files.otf)}') format('opentype')`);
        if (srcs.length > 0) {
          const clean = (f.name || '').replace(/['"]/g, '');
          css += `@font-face { font-family: '${clean}'; src: ${srcs.join(', ')}; font-weight: ${f.weight || '400'}; font-style: ${f.style || 'normal'}; font-display: swap; }\n`;
        }
      });
      if (name && Object.keys(files).length > 0) {
        const srcs: string[] = [];
        if (files.woff2) srcs.push(`url('${fixUrl(files.woff2)}') format('woff2')`);
        if (files.woff) srcs.push(`url('${fixUrl(files.woff)}') format('woff')`);
        if (files.ttf) srcs.push(`url('${fixUrl(files.ttf)}') format('truetype')`);
        if (files.otf) srcs.push(`url('${fixUrl(files.otf)}') format('opentype')`);
        if (srcs.length > 0) {
          const clean = name.replace(/['"]/g, '');
          css += `@font-face { font-family: '${clean}'; src: ${srcs.join(', ')}; font-weight: ${weight}; font-style: ${style}; font-display: swap; }\n`;
        }
      }
      styleTag.textContent = css;
    }, [props.fonts, name, files, weight, style]);

    const canConfigure = !!(window as any).WooOptionsProAdmin?.license?.canConfigure;

    const openMediaUploader = () => {
      if (!canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to manage custom fonts.', 'wooptions-pro'));
        return;
      }
      if (!wp.media) {
        WooOptionsPro.Toast.error(__('WordPress Media Library is unavailable.', 'wooptions-pro'));
        return;
      }
      const frame = wp.media({
        title: __('Select or Upload Font File (.woff2, .woff, .ttf, .otf)', 'wooptions-pro'),
        button: { text: __('Use this font file', 'wooptions-pro') },
        multiple: true,
      });

      frame.on('select', () => {
        const selection = frame.state().get('selection');
        const nextFiles = { ...files };
        let detectedName = name;
        const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';

        selection.each((attachmentModel: any) => {
          const att = attachmentModel.toJSON();
          const rawUrl = String(att.url || '');
          const url = isHttps ? rawUrl.replace(/^http:\/\//i, 'https://') : rawUrl;
          const filename = String(att.filename || att.title || '');
          const ext = filename.split('.').pop()?.toLowerCase() || '';

          if (['woff2', 'woff', 'ttf', 'otf'].includes(ext)) {
            nextFiles[ext] = url;
            if (!detectedName) {
              const base = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
              detectedName = base.charAt(0).toUpperCase() + base.slice(1);
            }
          } else {
            WooOptionsPro.Toast.error(__('Please select a valid font file: .woff2, .woff, .ttf, or .otf.', 'wooptions-pro'));
          }
        });

        setFiles(nextFiles);
        if (detectedName && !name) {
          setName(detectedName);
        }
      });

      frame.open();
    };

    const addFont = () => {
      if (!canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to add custom fonts.', 'wooptions-pro'));
        return;
      }
      const trimmedName = name.trim();
      if (!trimmedName) {
        WooOptionsPro.Toast.error(__('Please enter a font name.', 'wooptions-pro'));
        return;
      }
      if (Object.keys(files).length === 0) {
        WooOptionsPro.Toast.error(__('Please upload at least one font file (.woff2, .woff, .ttf, .otf).', 'wooptions-pro'));
        return;
      }

      const id = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const newFont = {
        id,
        name: trimmedName,
        family: `'${trimmedName}', sans-serif`,
        category: 'Custom',
        source: 'custom',
        weight,
        style,
        files,
      };

      const nextFonts = [...props.fonts, newFont];
      props.onChange(nextFonts);
      WooOptionsPro.injectCustomFontsCss(nextFonts);
      setName('');
      setWeight('400');
      setStyle('normal');
      setFiles({});
      WooOptionsPro.Toast.success(__('Custom font added! Remember to click "Save settings" at top right to finalize.', 'wooptions-pro'));
    };

    const removeFont = (index: number) => {
      if (!canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to remove custom fonts.', 'wooptions-pro'));
        return;
      }
      if (window.confirm(__('Are you sure you want to remove this custom font?', 'wooptions-pro'))) {
        const next = props.fonts.filter((_, i) => i !== index);
        props.onChange(next);
        WooOptionsPro.injectCustomFontsCss(next);
        WooOptionsPro.Toast.success(__('Custom font removed. Click "Save settings" to finalize.', 'wooptions-pro'));
      }
    };

    return (
      <section aria-labelledby="wof-custom-fonts-heading">
        <div className="wof-settings-panel__header">
          <h2 id="wof-custom-fonts-heading" className="wof-settings-panel__title">
            {__('Custom Web Fonts', 'wooptions-pro')}
          </h2>
          <p className="wof-settings-panel__desc">
            {__('Upload brand and custom font files (.woff2, .woff, .ttf, .otf). Uploaded fonts are automatically available in all Font Choice fields across your products.', 'wooptions-pro')}
          </p>
        </div>

        {/* Existing Custom Fonts */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
              {__('Installed Custom Fonts', 'wooptions-pro')} ({props.fonts.length})
            </h3>
          </div>

          {props.fonts.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px', color: '#94a3b8' }}>
                <WooOptionsPro.Components.Dashicon name="editor-textcolor" />
              </div>
              <strong style={{ display: 'block', fontSize: '14px', color: '#334155', marginBottom: '4px' }}>
                {__('No custom fonts uploaded yet', 'wooptions-pro')}
              </strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {__('Use the form below to upload your .woff2, .woff, .ttf, or .otf font files.', 'wooptions-pro')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {props.fonts.map((font, index) => (
                <div
                  key={font.id || index}
                  style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '18px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>{font.name}</strong>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569' }}>
                        {font.category || 'Custom'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Weight: {font.weight || '400'} · Style: {font.style || 'normal'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {Object.keys(font.files || {}).map((ext) => (
                        <span
                          key={ext}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #dbeafe',
                          }}
                        >
                          {ext}
                        </span>
                      ))}
                      <Button
                        variant="tertiary"
                        isDestructive
                        onClick={() => removeFont(index)}
                        style={{ marginLeft: '12px' }}
                      >
                        {__('Delete', 'wooptions-pro')}
                      </Button>
                    </div>
                  </div>

                  {/* Live Specimen Preview */}
                  <div
                    style={{
                      fontFamily: font.family,
                      fontSize: '22px',
                      color: '#1e293b',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    The quick brown fox jumps over the lazy dog. 1234567890
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Custom Font Form */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
            {__('Upload New Custom Font', 'wooptions-pro')}
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
            {__('Upload font files in .woff2 (recommended), .woff, .ttf, or .otf formats.', 'wooptions-pro')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            <TextControl
              label={__('Font Name', 'wooptions-pro')}
              placeholder={__('e.g. Brandon Grotesque', 'wooptions-pro')}
              value={name}
              onChange={setName}
            />

            <SelectControl
              label={__('Font Weight', 'wooptions-pro')}
              value={weight}
              options={[
                { label: '100 - Thin', value: '100' },
                { label: '200 - Extra Light', value: '200' },
                { label: '300 - Light', value: '300' },
                { label: '400 - Regular (Normal)', value: '400' },
                { label: '500 - Medium', value: '500' },
                { label: '600 - Semi Bold', value: '600' },
                { label: '700 - Bold', value: '700' },
                { label: '800 - Extra Bold', value: '800' },
                { label: '900 - Black', value: '900' },
              ]}
              onChange={setWeight}
            />

            <SelectControl
              label={__('Font Style', 'wooptions-pro')}
              value={style}
              options={[
                { label: 'Normal', value: 'normal' },
                { label: 'Italic', value: 'italic' },
              ]}
              onChange={(val: any) => setStyle(val)}
            />
          </div>

          {/* Font Files Section */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#1e293b', marginBottom: '8px' }}>
              {__('Font Files (.woff2, .woff, .ttf, .otf)', 'wooptions-pro')}
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                variant="secondary"
                onClick={openMediaUploader}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <WooOptionsPro.Components.Dashicon name="upload" />
                {__('Select / Upload Font Files…', 'wooptions-pro')}
              </Button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {__('You can select multiple formats or upload .woff2 for highest web efficiency.', 'wooptions-pro')}
              </span>
            </div>

            {Object.keys(files).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                {Object.entries(files).map(([ext, url]) => (
                  <div
                    key={ext}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, textTransform: 'uppercase', color: '#2563eb', padding: '2px 6px', background: '#eff6ff', borderRadius: '4px' }}>
                        {ext}
                      </span>
                      <span style={{ color: '#475569', wordBreak: 'break-all' }}>{url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = { ...files };
                        delete copy[ext];
                        setFiles(copy);
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
                      title={__('Remove this file', 'wooptions-pro')}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <Button
            variant="primary"
            onClick={addFont}
            disabled={!name.trim() || Object.keys(files).length === 0}
          >
            {__('+ Add Custom Font to List', 'wooptions-pro')}
          </Button>
        </div>
      </section>
    );
  }

  export function Settings(): any {
    const [settings, setSettings] = useState<Record<string, any> | null>(null);
    const [activeTab, setActiveTab] = useState<'cleanup' | 'custom_fonts' | 'other' | 'general'>('cleanup');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      WooOptionsPro.Api.getSettings().then(setSettings);
    }, []);

    if (!settings) {
      return (
        <div className="wof-page">
          <WooOptionsPro.Components.Loading />
        </div>
      );
    }

    const canConfigure = !!(window as any).WooOptionsProAdmin?.license?.canConfigure;

    const set = (key: string, value: unknown) => {
      if (!canConfigure) return;
      setSettings({ ...settings, [key]: value });
    };

    const save = async () => {
      if (!canConfigure) {
        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to save settings.', 'wooptions-pro'));
        return;
      }
      setSaving(true);
      try {
        const saved = await WooOptionsPro.Api.saveSettings(settings);
        setSettings(saved);
        if (Array.isArray(saved.custom_fonts)) {
          WooOptionsPro.injectCustomFontsCss(saved.custom_fonts);
          const otherFonts = (window.WooOptionsProAdmin.fontCatalog || []).filter((f: any) => f.source !== 'custom');
          window.WooOptionsProAdmin.fontCatalog = [...saved.custom_fonts, ...otherFonts];
        }
        WooOptionsPro.Toast.success(__('Settings saved successfully.', 'wooptions-pro'));
      } catch (err: any) {
        WooOptionsPro.Toast.error(WooOptionsPro.Utils.errorMessage(err));
      } finally {
        setSaving(false);
      }
    };

    const tabs = [
      {
        id: 'cleanup' as const,
        label: __('Upload Cleanup', 'wooptions-pro'),
        subtitle: __('Storage & file purging', 'wooptions-pro'),
        icon: 'upload',
      },
      {
        id: 'custom_fonts' as const,
        label: __('Custom Fonts', 'wooptions-pro'),
        subtitle: __('Upload & manage webfonts', 'wooptions-pro'),
        icon: 'editor-textcolor',
      },
      {
        id: 'other' as const,
        label: __('Other Settings', 'wooptions-pro'),
        subtitle: __('Labels & cart visibility', 'wooptions-pro'),
        icon: 'admin-appearance',
      },
      {
        id: 'general' as const,
        label: __('General & Limits', 'wooptions-pro'),
        subtitle: __('API limits & features', 'wooptions-pro'),
        icon: 'admin-settings',
      },
    ];

    return (
      <div className="wof-page">
        <WooOptionsPro.Components.PageHeader
          eyebrow={__('Operational defaults', 'wooptions-pro')}
          title={__('Settings', 'wooptions-pro')}
          description={__('Control limits, file retention, summary labels, and storefront visibility without editing code.', 'wooptions-pro')}
          actions={
            <Button
              variant="primary"
              isBusy={saving}
              disabled={!canConfigure || saving}
              onClick={save}
              title={!canConfigure ? __('Activate your license to save settings', 'wooptions-pro') : undefined}
            >
              {saving ? __('Saving…', 'wooptions-pro') : __('Save settings', 'wooptions-pro')}
            </Button>
          }
        />

        <div className="wof-settings-layout">
          {/* Sidebar Navigation */}
          <nav className="wof-settings-nav" aria-label={__('Settings navigation', 'wooptions-pro')}>
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={WooOptionsPro.Utils.classNames('wof-settings-nav-item', activeTab === tab.id && 'is-active')}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="wof-settings-nav-item__icon">
                  <WooOptionsPro.Components.Dashicon name={tab.icon} />
                </span>
                <span className="wof-settings-nav-item__text">
                  <span className="wof-settings-nav-item__title">{tab.label}</span>
                  <span className="wof-settings-nav-item__subtitle">{tab.subtitle}</span>
                </span>
              </button>
            ))}
          </nav>

          {/* Settings Content Panel */}
          <main className="wof-settings-panel">
            {!canConfigure && (
              <div
                className="wof-settings-readonly-banner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 18px',
                  marginBottom: '20px',
                  borderRadius: '8px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>{__('WooOptions Pro license is not active. Settings are in read-only preview mode.', 'wooptions-pro')}</span>
                </div>
                <button
                  type="button"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => { window.location.hash = '#license'; }}
                >
                  {__('Activate License', 'wooptions-pro')}
                </button>
              </div>
            )}
            <fieldset disabled={!canConfigure} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            {activeTab === 'cleanup' && (
              <section aria-labelledby="wof-cleanup-heading">
                <div className="wof-settings-panel__header">
                  <h2 id="wof-cleanup-heading" className="wof-settings-panel__title">
                    {__('Cleanup Upload Field Files', 'wooptions-pro')}
                  </h2>
                  <p className="wof-settings-panel__desc">
                    {__('Clean up all files uploaded through this field to free storage and remove unused data.', 'wooptions-pro')}
                  </p>
                </div>

                <div className="wof-settings-rows">
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Files uploaded but not in order', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Removes unplaced temporary uploads after a specified number of days (0 to disable).', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Days to retain unplaced uploads', 'wooptions-pro')}
                          type="number"
                          min="0"
                          value={String(settings.cleanup_unplaced_upload_days ?? 0)}
                          onChange={(val: string) => set('cleanup_unplaced_upload_days', Math.max(0, parseInt(val, 10) || 0))}
                        />
                        <span className="wof-setting-input-unit">{__('days', 'wooptions-pro')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Files uploaded and placed in order', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Removes uploads attached to placed orders after a specified number of days (0 to disable).', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Days to retain placed uploads', 'wooptions-pro')}
                          type="number"
                          min="0"
                          value={String(settings.cleanup_placed_upload_days ?? 0)}
                          onChange={(val: string) => set('cleanup_placed_upload_days', Math.max(0, parseInt(val, 10) || 0))}
                        />
                        <span className="wof-setting-input-unit">{__('days', 'wooptions-pro')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Files uploaded in completed orders', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Removes uploads once their corresponding order is marked Completed (0 to disable).', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Days to retain completed uploads', 'wooptions-pro')}
                          type="number"
                          min="0"
                          value={String(settings.cleanup_completed_upload_days ?? 0)}
                          onChange={(val: string) => set('cleanup_completed_upload_days', Math.max(0, parseInt(val, 10) || 0))}
                        />
                        <span className="wof-setting-input-unit">{__('days', 'wooptions-pro')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'custom_fonts' && (
              <CustomFontsManager
                fonts={settings.custom_fonts || []}
                onChange={(custom_fonts: any[]) => set('custom_fonts', custom_fonts)}
              />
            )}

            {activeTab === 'other' && (
              <section aria-labelledby="wof-other-heading">
                <div className="wof-settings-panel__header">
                  <h2 id="wof-other-heading" className="wof-settings-panel__title">
                    {__('Other Settings', 'wooptions-pro')}
                  </h2>
                  <p className="wof-settings-panel__desc">
                    {__('Configure summary labels, storefront display text, and cart/checkout visibility.', 'wooptions-pro')}
                  </p>
                </div>

                <div className="wof-settings-rows">
                  {/* Total Price Text */}
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Addons Total Price Label', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Customize the total price label shown in the storefront configurator summary.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Enable Addons Price Total Text In Product Page', 'wooptions-pro')}
                        checked={Boolean(settings.enable_addons_total_text)}
                        onChange={(checked: boolean) => set('enable_addons_total_text', checked)}
                      />
                      {settings.enable_addons_total_text ? (
                        <div className="wof-setting-row__subfield">
                          <TextControl
                            label={__('TOTAL PRICE TEXT', 'wooptions-pro')}
                            value={settings.addons_total_text ?? 'Total Price'}
                            placeholder="Total Price"
                            help={__('Change your Total Price / Configured price text here.', 'wooptions-pro')}
                            onChange={(val: string) => set('addons_total_text', val)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Summary Status Text */}
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Summary Status Prompt', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Customize the ready state prompt shown in the summary before selection changes.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Enable Summary Status Text In Product Page', 'wooptions-pro')}
                        checked={Boolean(settings.enable_summary_status_text)}
                        onChange={(checked: boolean) => set('enable_summary_status_text', checked)}
                      />
                      {settings.enable_summary_status_text ? (
                        <div className="wof-setting-row__subfield">
                          <TextControl
                            label={__('SUMMARY STATUS TEXT', 'wooptions-pro')}
                            value={settings.summary_status_text ?? 'Ready for your choices'}
                            placeholder="Ready for your choices"
                            help={__('Change your summary status prompt text here.', 'wooptions-pro')}
                            onChange={(val: string) => set('summary_status_text', val)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Summary Notice Text */}
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Summary Notice Message', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Customize the server-confirmed disclaimer text beneath the summary price.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Enable Summary Notice Text In Product Page', 'wooptions-pro')}
                        checked={Boolean(settings.enable_summary_notice_text)}
                        onChange={(checked: boolean) => set('enable_summary_notice_text', checked)}
                      />
                      {settings.enable_summary_notice_text ? (
                        <div className="wof-setting-row__subfield">
                          <TextControl
                            label={__('SUMMARY NOTICE TEXT', 'wooptions-pro')}
                            value={settings.summary_notice_text ?? 'Server-confirmed total, before shipping.'}
                            placeholder="Server-confirmed total, before shipping."
                            help={__('Change your summary disclaimer text here.', 'wooptions-pro')}
                            onChange={(val: string) => set('summary_notice_text', val)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Cart Visibility */}
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Cart Page Display', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Control whether addon option details are shown under cart line items.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Hide addon fields in Cart Page', 'wooptions-pro')}
                        checked={Boolean(settings.hide_addon_in_cart)}
                        onChange={(checked: boolean) => set('hide_addon_in_cart', checked)}
                      />
                    </div>
                  </div>

                  {/* Checkout Visibility */}
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Checkout Page Display', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Control whether addon option details are shown on checkout and order review tables.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Hide addon fields in Checkout Page', 'wooptions-pro')}
                        checked={Boolean(settings.hide_addon_in_checkout)}
                        onChange={(checked: boolean) => set('hide_addon_in_checkout', checked)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'general' && (
              <section aria-labelledby="wof-general-heading">
                <div className="wof-settings-panel__header">
                  <h2 id="wof-general-heading" className="wof-settings-panel__title">
                    {__('Operational Defaults & Limits', 'wooptions-pro')}
                  </h2>
                  <p className="wof-settings-panel__desc">
                    {__('Configure security limits and optional capabilities across your catalog.', 'wooptions-pro')}
                  </p>
                </div>

                <div className="wof-settings-rows">
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Quote requests per minute', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Maximum pricing quote calculations allowed per visitor per minute.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Quote requests per minute', 'wooptions-pro')}
                          type="number"
                          value={String(settings.quote_rate_limit_per_minute ?? 60)}
                          onChange={(value: string) => set('quote_rate_limit_per_minute', Number(value))}
                        />
                        <span className="wof-setting-input-unit">{__('requests / min', 'wooptions-pro')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Upload size limit', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Maximum allowed file size in megabytes for customer upload fields.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Upload size limit (MB)', 'wooptions-pro')}
                          type="number"
                          value={String(settings.upload_max_mb ?? 10)}
                          onChange={(value: string) => set('upload_max_mb', Number(value))}
                        />
                        <span className="wof-setting-input-unit">{__('MB', 'wooptions-pro')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Features & Telemetry', 'wooptions-pro')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Enable or disable global behavior toggles and analytics.', 'wooptions-pro')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      {Object.entries(settings)
                        .filter(([key, value]) => typeof value === 'boolean' && !['enable_addons_total_text', 'enable_summary_status_text', 'enable_summary_notice_text', 'hide_addon_in_cart', 'hide_addon_in_checkout'].includes(key))
                        .map(([key, value]) => (
                          <div key={key} style={{ marginBottom: '8px' }}>
                            <ToggleControl
                              label={key.replace(/_/g, ' ')}
                              checked={Boolean(value)}
                              onChange={(checked: boolean) => set(key, checked)}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
            </fieldset>
          </main>
        </div>
      </div>
    );
  }
}
