namespace WooptionsFic.Pages {
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

    const openMediaUploader = () => {
      if (!wp.media) {
        WooptionsFic.Toast.error(__('WordPress Media Library is unavailable.', 'wooptionsfic'));
        return;
      }
      const frame = wp.media({
        title: __('Select or Upload Font File (.woff2, .woff, .ttf, .otf)', 'wooptionsfic'),
        button: { text: __('Use this font file', 'wooptionsfic') },
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
            WooptionsFic.Toast.error(__('Please select a valid font file: .woff2, .woff, .ttf, or .otf.', 'wooptionsfic'));
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
      const trimmedName = name.trim();
      if (!trimmedName) {
        WooptionsFic.Toast.error(__('Please enter a font name.', 'wooptionsfic'));
        return;
      }
      if (Object.keys(files).length === 0) {
        WooptionsFic.Toast.error(__('Please upload at least one font file (.woff2, .woff, .ttf, .otf).', 'wooptionsfic'));
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
      WooptionsFic.injectCustomFontsCss(nextFonts);
      setName('');
      setWeight('400');
      setStyle('normal');
      setFiles({});
      WooptionsFic.Toast.success(__('Custom font added! Remember to click "Save settings" at top right to finalize.', 'wooptionsfic'));
    };

    const removeFont = (index: number) => {
      if (window.confirm(__('Are you sure you want to remove this custom font?', 'wooptionsfic'))) {
        const next = props.fonts.filter((_, i) => i !== index);
        props.onChange(next);
        WooptionsFic.injectCustomFontsCss(next);
        WooptionsFic.Toast.success(__('Custom font removed. Click "Save settings" to finalize.', 'wooptionsfic'));
      }
    };

    return (
      <section aria-labelledby="wof-custom-fonts-heading">
        <div className="wof-settings-panel__header">
          <h2 id="wof-custom-fonts-heading" className="wof-settings-panel__title">
            {__('Custom Web Fonts', 'wooptionsfic')}
          </h2>
          <p className="wof-settings-panel__desc">
            {__('Upload brand and custom font files (.woff2, .woff, .ttf, .otf). Uploaded fonts are automatically available in all Font Choice fields across your products.', 'wooptionsfic')}
          </p>
        </div>

        {/* Existing Custom Fonts */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
              {__('Installed Custom Fonts', 'wooptionsfic')} ({props.fonts.length})
            </h3>
          </div>

          {props.fonts.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px', color: '#94a3b8' }}>
                <WooptionsFic.Components.Dashicon name="editor-textcolor" />
              </div>
              <strong style={{ display: 'block', fontSize: '14px', color: '#334155', marginBottom: '4px' }}>
                {__('No custom fonts uploaded yet', 'wooptionsfic')}
              </strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {__('Use the form below to upload your .woff2, .woff, .ttf, or .otf font files.', 'wooptionsfic')}
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
                        {__('Delete', 'wooptionsfic')}
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
            {__('Upload New Custom Font', 'wooptionsfic')}
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
            {__('Upload font files in .woff2 (recommended), .woff, .ttf, or .otf formats.', 'wooptionsfic')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            <TextControl
              label={__('Font Name', 'wooptionsfic')}
              placeholder={__('e.g. Brandon Grotesque', 'wooptionsfic')}
              value={name}
              onChange={setName}
            />

            <SelectControl
              label={__('Font Weight', 'wooptionsfic')}
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
              label={__('Font Style', 'wooptionsfic')}
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
              {__('Font Files (.woff2, .woff, .ttf, .otf)', 'wooptionsfic')}
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                variant="secondary"
                onClick={openMediaUploader}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <WooptionsFic.Components.Dashicon name="upload" />
                {__('Select / Upload Font Files…', 'wooptionsfic')}
              </Button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {__('You can select multiple formats or upload .woff2 for highest web efficiency.', 'wooptionsfic')}
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
                      title={__('Remove this file', 'wooptionsfic')}
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
            {__('+ Add Custom Font to List', 'wooptionsfic')}
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
      WooptionsFic.Api.getSettings().then(setSettings);
    }, []);

    if (!settings) {
      return (
        <div className="wof-page">
          <WooptionsFic.Components.Loading />
        </div>
      );
    }

    const set = (key: string, value: unknown) => setSettings({ ...settings, [key]: value });

    const save = async () => {
      setSaving(true);
      try {
        const saved = await WooptionsFic.Api.saveSettings(settings);
        setSettings(saved);
        if (Array.isArray(saved.custom_fonts)) {
          WooptionsFic.injectCustomFontsCss(saved.custom_fonts);
          const otherFonts = (window.WooptionsFicAdmin.fontCatalog || []).filter((f: any) => f.source !== 'custom');
          window.WooptionsFicAdmin.fontCatalog = [...saved.custom_fonts, ...otherFonts];
        }
        WooptionsFic.Toast.success(__('Settings saved successfully.', 'wooptionsfic'));
      } catch (err: any) {
        WooptionsFic.Toast.error(WooptionsFic.Utils.errorMessage(err));
      } finally {
        setSaving(false);
      }
    };

    const tabs = [
      {
        id: 'cleanup' as const,
        label: __('Upload Cleanup', 'wooptionsfic'),
        subtitle: __('Storage & file purging', 'wooptionsfic'),
        icon: 'upload',
      },
      {
        id: 'custom_fonts' as const,
        label: __('Custom Fonts', 'wooptionsfic'),
        subtitle: __('Upload & manage webfonts', 'wooptionsfic'),
        icon: 'editor-textcolor',
      },
      {
        id: 'other' as const,
        label: __('Other Settings', 'wooptionsfic'),
        subtitle: __('Labels & cart visibility', 'wooptionsfic'),
        icon: 'admin-appearance',
      },
      {
        id: 'general' as const,
        label: __('General & Limits', 'wooptionsfic'),
        subtitle: __('API limits & features', 'wooptionsfic'),
        icon: 'admin-settings',
      },
    ];

    return (
      <div className="wof-page">
        <WooptionsFic.Components.PageHeader
          eyebrow={__('Operational defaults', 'wooptionsfic')}
          title={__('Settings', 'wooptionsfic')}
          description={__('Control limits, file retention, summary labels, and storefront visibility without editing code.', 'wooptionsfic')}
          actions={
            <Button
              variant="primary"
              isBusy={saving}
              disabled={saving}
              onClick={save}
            >
              {saving ? __('Saving…', 'wooptionsfic') : __('Save settings', 'wooptionsfic')}
            </Button>
          }
        />

        <div className="wof-settings-layout">
          {/* Sidebar Navigation */}
          <nav className="wof-settings-nav" aria-label={__('Settings navigation', 'wooptionsfic')}>
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={WooptionsFic.Utils.classNames('wof-settings-nav-item', activeTab === tab.id && 'is-active')}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="wof-settings-nav-item__icon">
                  <WooptionsFic.Components.Dashicon name={tab.icon} />
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
            {activeTab === 'cleanup' && (
              <section aria-labelledby="wof-cleanup-heading">
                <div className="wof-settings-panel__header">
                  <h2 id="wof-cleanup-heading" className="wof-settings-panel__title">
                    {__('Cleanup Upload Field Files', 'wooptionsfic')}
                  </h2>
                  <p className="wof-settings-panel__desc">
                    {__('Clean up all files uploaded through this field to free storage and remove unused data.', 'wooptionsfic')}
                  </p>
                </div>

                <div className="wof-settings-rows">
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Files uploaded but not in order', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Removes unplaced temporary uploads after a specified number of days (0 to disable).', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Days to retain unplaced uploads', 'wooptionsfic')}
                          type="number"
                          min="0"
                          value={String(settings.cleanup_unplaced_upload_days ?? 0)}
                          onChange={(val: string) => set('cleanup_unplaced_upload_days', Math.max(0, parseInt(val, 10) || 0))}
                        />
                        <span className="wof-setting-input-unit">{__('days', 'wooptionsfic')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Files uploaded and placed in order', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Removes uploads attached to placed orders after a specified number of days (0 to disable).', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Days to retain placed uploads', 'wooptionsfic')}
                          type="number"
                          min="0"
                          value={String(settings.cleanup_placed_upload_days ?? 0)}
                          onChange={(val: string) => set('cleanup_placed_upload_days', Math.max(0, parseInt(val, 10) || 0))}
                        />
                        <span className="wof-setting-input-unit">{__('days', 'wooptionsfic')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Files uploaded in completed orders', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Removes uploads once their corresponding order is marked Completed (0 to disable).', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Days to retain completed uploads', 'wooptionsfic')}
                          type="number"
                          min="0"
                          value={String(settings.cleanup_completed_upload_days ?? 0)}
                          onChange={(val: string) => set('cleanup_completed_upload_days', Math.max(0, parseInt(val, 10) || 0))}
                        />
                        <span className="wof-setting-input-unit">{__('days', 'wooptionsfic')}</span>
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
                    {__('Other Settings', 'wooptionsfic')}
                  </h2>
                  <p className="wof-settings-panel__desc">
                    {__('Configure summary labels, storefront display text, and cart/checkout visibility.', 'wooptionsfic')}
                  </p>
                </div>

                <div className="wof-settings-rows">
                  {/* Total Price Text */}
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Addons Total Price Label', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Customize the total price label shown in the storefront configurator summary.', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Enable Addons Price Total Text In Product Page', 'wooptionsfic')}
                        checked={Boolean(settings.enable_addons_total_text)}
                        onChange={(checked: boolean) => set('enable_addons_total_text', checked)}
                      />
                      {settings.enable_addons_total_text ? (
                        <div className="wof-setting-row__subfield">
                          <TextControl
                            label={__('TOTAL PRICE TEXT', 'wooptionsfic')}
                            value={settings.addons_total_text ?? 'Total Price'}
                            placeholder="Total Price"
                            help={__('Change your Total Price / Configured price text here.', 'wooptionsfic')}
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
                        {__('Summary Status Prompt', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Customize the ready state prompt shown in the summary before selection changes.', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Enable Summary Status Text In Product Page', 'wooptionsfic')}
                        checked={Boolean(settings.enable_summary_status_text)}
                        onChange={(checked: boolean) => set('enable_summary_status_text', checked)}
                      />
                      {settings.enable_summary_status_text ? (
                        <div className="wof-setting-row__subfield">
                          <TextControl
                            label={__('SUMMARY STATUS TEXT', 'wooptionsfic')}
                            value={settings.summary_status_text ?? 'Ready for your choices'}
                            placeholder="Ready for your choices"
                            help={__('Change your summary status prompt text here.', 'wooptionsfic')}
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
                        {__('Summary Notice Message', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Customize the server-confirmed disclaimer text beneath the summary price.', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Enable Summary Notice Text In Product Page', 'wooptionsfic')}
                        checked={Boolean(settings.enable_summary_notice_text)}
                        onChange={(checked: boolean) => set('enable_summary_notice_text', checked)}
                      />
                      {settings.enable_summary_notice_text ? (
                        <div className="wof-setting-row__subfield">
                          <TextControl
                            label={__('SUMMARY NOTICE TEXT', 'wooptionsfic')}
                            value={settings.summary_notice_text ?? 'Server-confirmed total, before shipping.'}
                            placeholder="Server-confirmed total, before shipping."
                            help={__('Change your summary disclaimer text here.', 'wooptionsfic')}
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
                        {__('Cart Page Display', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Control whether addon option details are shown under cart line items.', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Hide addon fields in Cart Page', 'wooptionsfic')}
                        checked={Boolean(settings.hide_addon_in_cart)}
                        onChange={(checked: boolean) => set('hide_addon_in_cart', checked)}
                      />
                    </div>
                  </div>

                  {/* Checkout Visibility */}
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Checkout Page Display', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Control whether addon option details are shown on checkout and order review tables.', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <ToggleControl
                        label={__('Hide addon fields in Checkout Page', 'wooptionsfic')}
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
                    {__('Operational Defaults & Limits', 'wooptionsfic')}
                  </h2>
                  <p className="wof-settings-panel__desc">
                    {__('Configure security limits and optional capabilities across your catalog.', 'wooptionsfic')}
                  </p>
                </div>

                <div className="wof-settings-rows">
                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Quote requests per minute', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Maximum pricing quote calculations allowed per visitor per minute.', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Quote requests per minute', 'wooptionsfic')}
                          type="number"
                          value={String(settings.quote_rate_limit_per_minute ?? 60)}
                          onChange={(value: string) => set('quote_rate_limit_per_minute', Number(value))}
                        />
                        <span className="wof-setting-input-unit">{__('requests / min', 'wooptionsfic')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Upload size limit', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Maximum allowed file size in megabytes for customer upload fields.', 'wooptionsfic')}
                      </p>
                    </div>
                    <div className="wof-setting-row__control">
                      <div className="wof-setting-input-wrap">
                        <TextControl
                          hideLabelFromVision
                          label={__('Upload size limit (MB)', 'wooptionsfic')}
                          type="number"
                          value={String(settings.upload_max_mb ?? 10)}
                          onChange={(value: string) => set('upload_max_mb', Number(value))}
                        />
                        <span className="wof-setting-input-unit">{__('MB', 'wooptionsfic')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="wof-setting-row">
                    <div className="wof-setting-row__info">
                      <strong className="wof-setting-row__title">
                        {__('Features & Telemetry', 'wooptionsfic')}
                      </strong>
                      <p className="wof-setting-row__desc">
                        {__('Enable or disable global behavior toggles and analytics.', 'wooptionsfic')}
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
          </main>
        </div>
      </div>
    );
  }
}
