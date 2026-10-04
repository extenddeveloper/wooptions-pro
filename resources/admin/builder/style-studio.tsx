namespace WooOptionsPro.Builder {
  const { ColorPicker, SelectControl, ToggleControl } = wp.components;
  const { __ } = wp.i18n;
  const { useState, useEffect, useRef } = wp.element;

  interface ColorFieldConfig {
    key: string;
    label: string;
    defaultColor: string;
  }

  const COLOR_FIELDS: ColorFieldConfig[] = [
    { key: 'text', label: __('Text Color', 'wooptions-pro'), defaultColor: '#1A1A1A' },
    { key: 'primary', label: __('Primary', 'wooptions-pro'), defaultColor: '#1A1A1A' },
    { key: 'border', label: __('Field Border', 'wooptions-pro'), defaultColor: '#8A8A8A' },
    { key: 'surface', label: __('Field Fill', 'wooptions-pro'), defaultColor: '#FFFFFF' },
    { key: 'onPrimary', label: __('Over Primary Color', 'wooptions-pro'), defaultColor: '#FFFFFF' },
    { key: 'danger', label: __('Required / Error Color', 'wooptions-pro'), defaultColor: '#DF1C41' },
  ];

  function ColorFieldItem(props: {
    label: string;
    tokenKey: string;
    value: string;
    columnIndex: number;
    openUpward?: boolean;
    onChange: (hex: string) => void;
  }) {
    const [localHex, setLocalHex] = useState(props.value);
    const [isFocused, setIsFocused] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      setLocalHex(props.value);
    }, [props.value]);

    useEffect(() => {
      if (!pickerOpen) return;
      const handleDown = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setPickerOpen(false);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setPickerOpen(false);
        }
      };
      document.addEventListener('mousedown', handleDown);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleDown);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [pickerOpen]);

    const handleInputChange = (e: any) => {
      const raw = e.target.value;
      setLocalHex(raw);
      let val = raw.trim();
      if (!val.startsWith('#') && val.length > 0) {
        val = '#' + val;
      }
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        props.onChange(val.toUpperCase());
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      let val = localHex.trim();
      if (!val.startsWith('#') && val.length > 0) {
        val = '#' + val;
      }
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        const formatted = val.toUpperCase();
        setLocalHex(formatted);
        props.onChange(formatted);
      } else {
        setLocalHex(props.value);
      }
    };

    const handleColorPickerChange = (next: any) => {
      const hex = typeof next === 'string' ? next : (next?.hex || safeHex);
      const cleanHex = String(hex || '').trim().toUpperCase();
      if (/^#[0-9A-F]{6}$/.test(cleanHex)) {
        setLocalHex(cleanHex);
        props.onChange(cleanHex);
      }
    };

    const isLightColor = (hex: string) => {
      const clean = hex.replace('#', '');
      if (clean.length !== 6) return false;
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 215;
    };

    const safeHex = /^#[0-9A-Fa-f]{6}$/.test(props.value) ? props.value : '#000000';

    return (
      <div className="wof-color-field-item" ref={containerRef}>
        <label className="wof-color-field-label" title={props.label}>{props.label}</label>
        <div className={`wof-color-field-control ${isFocused ? 'is-focused' : ''} ${pickerOpen ? 'is-picker-open' : ''}`}>
          <button
            type="button"
            className="wof-color-swatch-box"
            onClick={() => setPickerOpen(!pickerOpen)}
            title={__('Pick color', 'wooptions-pro')}
            aria-expanded={pickerOpen}
          >
            <span
              className={`wof-color-circle ${isLightColor(safeHex) ? 'has-border' : ''}`}
              style={{ backgroundColor: safeHex }}
            />
          </button>
          <input
            type="text"
            className="wof-color-text-input"
            value={localHex}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            maxLength={7}
            spellCheck={false}
            aria-label={`${props.label} Hex Code`}
          />

          {pickerOpen && (
            <div className={`wof-color-popover ${props.columnIndex === 1 ? 'is-right' : 'is-left'} ${props.openUpward ? 'is-upward' : ''}`}>
              <div className="wof-color-popover__header">
                <strong>{props.label}</strong>
                <button
                  type="button"
                  className="wof-color-popover__close"
                  onClick={() => setPickerOpen(false)}
                  aria-label={__('Close color picker', 'wooptions-pro')}
                >
                  ×
                </button>
              </div>
              <div className="wof-color-popover__body">
                <ColorPicker
                  color={safeHex}
                  enableAlpha={false}
                  onChange={handleColorPickerChange}
                  onChangeComplete={handleColorPickerChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  export function StyleStudio(props: { document: WooOptionsPro.OptionSetDefinition; onChange: (patch: Partial<WooOptionsPro.OptionSetDefinition>) => void }): any {
    const document = props.document;
    const [isCustomizeOpen, setIsCustomizeOpen] = useState(true);

    const updateStyle = (patch: Partial<WooOptionsPro.OptionSetDefinition['style']>) => props.onChange({ style: { ...document.style, ...patch } });
    const updateTypography = (patch: Partial<WooOptionsPro.TypographyDefinition>) => updateStyle({ typography: { ...document.style.typography, ...patch } });
    const updateSettings = (patch: Partial<WooOptionsPro.OptionSetDefinition['settings']>) => props.onChange({ settings: { ...document.settings, ...patch } });
    const fonts = ['inherit', 'system-ui', 'Inter', 'Manrope', 'Poppins', 'Outfit', 'Plus Jakarta Sans', 'Roboto'];

    const handleSelectPalette = (key: string) => {
      const preset = window.WooOptionsProAdmin.palettes[key];
      const newOverrides = preset?.tokens ? { ...preset.tokens } : {};
      updateStyle({
        palette: key,
        overrides: newOverrides,
      });
    };

    const handleColorChange = (tokenKey: string, hex: string) => {
      const presetTokens = window.WooOptionsProAdmin.palettes[document.style.palette]?.tokens ?? {};
      const currentOverrides = document.style.overrides ?? {};
      const updated = {
        ...presetTokens,
        ...currentOverrides,
        [tokenKey]: hex.toUpperCase(),
      };
      updateStyle({
        overrides: updated,
      });
    };

    const getFieldColor = (tokenKey: string, fallback: string): string => {
      let color = '';
      if (document.style?.overrides && document.style.overrides[tokenKey]) {
        color = document.style.overrides[tokenKey];
      } else {
        const preset = window.WooOptionsProAdmin.palettes?.[document.style?.palette];
        if (preset?.tokens && preset.tokens[tokenKey]) {
          color = preset.tokens[tokenKey];
        }
      }
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return color.toUpperCase();
      }
      return fallback;
    };

    return <div className="wof-style-studio">
      <h3>{__('Color palette', 'wooptions-pro')}</h3>
      <div className="wof-palette-picker">
        {Object.entries(window.WooOptionsProAdmin.palettes).map(([key, palette]) => (
          <button
            type="button"
            key={key}
            className={document.style.palette === key ? 'is-selected' : ''}
            onClick={() => handleSelectPalette(key)}
          >
            <span className="wof-palette-dots">
              {['primary', 'accent', 'background', 'surface'].map((token) => (
                <i key={token} style={{ background: palette.tokens[token] }} />
              ))}
            </span>
            <span>
              <strong>{palette.name}</strong>
              <small>{key}</small>
            </span>
            <span className="wof-palette-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2.5,8.5 6.5,12.5 13.5,3.5" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <div className="wof-customize-colors-section">
        <button
          type="button"
          className="wof-customize-colors-header"
          onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
          aria-expanded={isCustomizeOpen}
        >
          <h4>{__('Customize Colors', 'wooptions-pro')}</h4>
          <span className={`wof-customize-colors-chevron ${isCustomizeOpen ? 'is-open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </span>
        </button>

        {isCustomizeOpen && (
          <div className="wof-customize-colors-grid">
            {COLOR_FIELDS.map((field, idx) => (
              <ColorFieldItem
                key={field.key}
                label={field.label}
                tokenKey={field.key}
                columnIndex={idx % 2}
                openUpward={idx >= 4}
                value={getFieldColor(field.key, field.defaultColor)}
                onChange={(hex) => handleColorChange(field.key, hex)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="wof-style-divider" />
      <h3>{__('Typography', 'wooptions-pro')}</h3>
      <SelectControl label={__('Font family', 'wooptions-pro')} value={document.style.typography.family ?? 'inherit'} options={fonts.map((font) => ({ label: font === 'inherit' ? __('Inherit from theme', 'wooptions-pro') : font === 'system-ui' ? __('System UI', 'wooptions-pro') : font, value: font }))} onChange={(family: string) => updateTypography({ family })} />
      <SelectControl label={__('Label weight', 'wooptions-pro')} value={String(document.style.typography.labelWeight ?? 650)} options={[400, 500, 600, 650, 700, 800].map((value) => ({ label: String(value), value: String(value) }))} onChange={(value: string) => updateTypography({ labelWeight: Number(value) })} />
      <SelectControl label={__('Body weight', 'wooptions-pro')} value={String(document.style.typography.bodyWeight ?? 450)} options={[300, 400, 450, 500, 600, 700].map((value) => ({ label: String(value), value: String(value) }))} onChange={(value: string) => updateTypography({ bodyWeight: Number(value) })} />
      <div className="wof-style-divider" />
      <h3>{__('Layout & summary', 'wooptions-pro')}</h3>
      <ToggleControl label={__('Show itemized price breakdown', 'wooptions-pro')} checked={document.settings.showPriceBreakdown} onChange={(value: boolean) => updateSettings({ showPriceBreakdown: value })} />
      <ToggleControl label={__('Keep configuration summary visible', 'wooptions-pro')} checked={document.settings.stickySummary} onChange={(value: boolean) => updateSettings({ stickySummary: value })} />
      <ToggleControl label={__('Allow saved configurations', 'wooptions-pro')} checked={document.settings.saveEnabled} onChange={(value: boolean) => updateSettings({ saveEnabled: value })} />
      <ToggleControl label={__('Allow shareable links', 'wooptions-pro')} checked={document.settings.shareEnabled} onChange={(value: boolean) => updateSettings({ shareEnabled: value })} />
    </div>;
  }
}

