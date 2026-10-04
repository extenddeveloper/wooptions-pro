namespace WooptionsFic.Builder {
  const { Button, ColorPicker, Modal, SelectControl, TextControl, TextareaControl, ToggleControl } = wp.components;
  const { __, sprintf } = wp.i18n;
  const { useEffect, useMemo, useRef, useState } = wp.element;

  const tabs: Array<[WooptionsFic.InspectorTab, string]> = [
    ['content', __('Content', 'wooptionsfic')],
    ['choices', __('Choices', 'wooptionsfic')],
    ['pricing', __('Pricing', 'wooptionsfic')],
    ['logic', __('Logic', 'wooptionsfic')],
    ['style', __('Style', 'wooptionsfic')],
    ['advanced', __('Advanced', 'wooptionsfic')],
  ];

  const COUNTRY_OPTIONS = [
    { label: 'United States (+1)', value: 'US' },
    { label: 'United Kingdom (+44)', value: 'GB' },
    { label: 'Canada (+1)', value: 'CA' },
    { label: 'Australia (+61)', value: 'AU' },
    { label: 'Germany (+49)', value: 'DE' },
    { label: 'France (+33)', value: 'FR' },
    { label: 'Italy (+39)', value: 'IT' },
    { label: 'Spain (+34)', value: 'ES' },
    { label: 'Netherlands (+31)', value: 'NL' },
    { label: 'Brazil (+55)', value: 'BR' },
    { label: 'India (+91)', value: 'IN' },
    { label: 'China (+86)', value: 'CN' },
    { label: 'Japan (+81)', value: 'JP' },
    { label: 'South Korea (+82)', value: 'KR' },
    { label: 'Mexico (+52)', value: 'MX' },
    { label: 'United Arab Emirates (+971)', value: 'AE' },
    { label: 'Saudi Arabia (+966)', value: 'SA' },
    { label: 'Singapore (+65)', value: 'SG' },
    { label: 'Bangladesh (+880)', value: 'BD' },
    { label: 'Pakistan (+92)', value: 'PK' },
    { label: 'South Africa (+27)', value: 'ZA' },
    { label: 'Turkey (+90)', value: 'TR' },
    { label: 'Sweden (+46)', value: 'SE' },
    { label: 'Switzerland (+41)', value: 'CH' },
    { label: 'Poland (+48)', value: 'PL' },
    { label: 'Argentina (+54)', value: 'AR' },
    { label: 'Belgium (+32)', value: 'BE' },
    { label: 'Austria (+43)', value: 'AT' },
    { label: 'Norway (+47)', value: 'NO' },
    { label: 'Denmark (+45)', value: 'DK' },
    { label: 'Finland (+358)', value: 'FI' },
    { label: 'Ireland (+353)', value: 'IE' },
    { label: 'New Zealand (+64)', value: 'NZ' },
    { label: 'Portugal (+351)', value: 'PT' },
    { label: 'Greece (+30)', value: 'GR' },
    { label: 'Israel (+972)', value: 'IL' },
    { label: 'Hong Kong (+852)', value: 'HK' },
    { label: 'Malaysia (+60)', value: 'MY' },
    { label: 'Philippines (+63)', value: 'PH' },
    { label: 'Indonesia (+62)', value: 'ID' },
    { label: 'Thailand (+66)', value: 'TH' },
    { label: 'Vietnam (+84)', value: 'VN' },
    { label: 'Egypt (+20)', value: 'EG' },
    { label: 'Nigeria (+234)', value: 'NG' },
    { label: 'Kenya (+254)', value: 'KE' },
  ];

  const DATE_FORMAT_OPTIONS = [
    { label: 'MMM DD, YYYY ( Jul 30, 2025 )', value: 'MMM DD, YYYY' },
    { label: 'WordPress Default Date Format', value: 'wp_default' },
    { label: 'DD/MM/YYYY ( 30/07/2025 )', value: 'DD/MM/YYYY' },
    { label: 'MM/DD/YYYY ( 07/30/2025 )', value: 'MM/DD/YYYY' },
    { label: 'YYYY-MM-DD ( 2025-07-30 )', value: 'YYYY-MM-DD' },
    { label: 'DD MMMM, YYYY ( 30 July, 2025 )', value: 'DD MMMM, YYYY' },
    { label: 'D.MM.YYYY ( 30.07.2026 )', value: 'D.MM.YYYY' },
  ];

  const WEEKDAY_OPTIONS = [
    { label: __('Sunday', 'wooptionsfic'), value: 0 },
    { label: __('Monday', 'wooptionsfic'), value: 1 },
    { label: __('Tuesday', 'wooptionsfic'), value: 2 },
    { label: __('Wednesday', 'wooptionsfic'), value: 3 },
    { label: __('Thursday', 'wooptionsfic'), value: 4 },
    { label: __('Friday', 'wooptionsfic'), value: 5 },
    { label: __('Saturday', 'wooptionsfic'), value: 6 },
  ];

  const MONTHLY_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
    label: `${__('Day', 'wooptionsfic')} ${i + 1}`,
    value: i + 1,
  }));

  function DatePickerPopup(props: {
    value?: string;
    onSelect: (dateStr: string) => void;
    onClose: () => void;
  }): any {
    const containerRef = useRef<HTMLDivElement | null>(null);

    const initialDate = useMemo(() => {
      if (props.value && /^\d{4}-\d{2}-\d{2}$/.test(props.value)) {
        const parts = props.value.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      return new Date();
    }, [props.value]);

    const [year, setYear] = useState(initialDate.getFullYear());
    const [month, setMonth] = useState(initialDate.getMonth());

    useEffect(() => {
      const handleDown = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          props.onClose();
        }
      };
      document.addEventListener('mousedown', handleDown);
      return () => document.removeEventListener('mousedown', handleDown);
    }, [props.onClose]);

    const prevMonth = (e: any) => {
      e.stopPropagation();
      if (month === 0) {
        setMonth(11);
        setYear((y) => y - 1);
      } else {
        setMonth((m) => m - 1);
      }
    };

    const nextMonth = (e: any) => {
      e.stopPropagation();
      if (month === 11) {
        setMonth(0);
        setYear((y) => y + 1);
      } else {
        setMonth((m) => m + 1);
      }
    };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ day: number; isCurrentMonth: boolean; dateStr: string }> = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const mStr = String(prevM + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ day: d, isCurrentMonth: false, dateStr: `${prevY}-${mStr}-${dStr}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ day: d, isCurrentMonth: true, dateStr: `${year}-${mStr}-${dStr}` });
    }

    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextM = month === 11 ? 0 : month + 1;
        const nextY = month === 11 ? year + 1 : year;
        const mStr = String(nextM + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        cells.push({ day: d, isCurrentMonth: false, dateStr: `${nextY}-${mStr}-${dStr}` });
      }
    }

    return (
      <div className="wof-datepicker-popover" ref={containerRef}>
        <div className="wof-cal-pop-header">
          <button type="button" className="wof-cal-nav-btn" onClick={prevMonth} aria-label={__('Previous month', 'wooptionsfic')}>
            ‹
          </button>
          <span className="wof-cal-pop-title">{monthNames[month]} {year}</span>
          <button type="button" className="wof-cal-nav-btn" onClick={nextMonth} aria-label={__('Next month', 'wooptionsfic')}>
            ›
          </button>
        </div>
        <div className="wof-cal-pop-weekdays">
          {weekDays.map((wd) => (
            <span key={wd}>{wd}</span>
          ))}
        </div>
        <div className="wof-cal-pop-days">
          {cells.map((cell, idx) => {
            const isSelected = props.value === cell.dateStr;
            return (
              <button
                type="button"
                key={idx}
                className={WooptionsFic.Utils.classNames(
                  'wof-cal-pop-day',
                  !cell.isCurrentMonth && 'is-other-month',
                  isSelected && 'is-selected'
                )}
                onClick={(e: any) => {
                  e.stopPropagation();
                  props.onSelect(cell.dateStr);
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function DatePickerField(props: {
    value?: string;
    placeholder?: string;
    onChange: (val: string) => void;
  }): any {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="wof-datepicker-field-wrap">
        <button
          type="button"
          className={WooptionsFic.Utils.classNames('wof-datepicker-field-trigger', isOpen && 'is-open')}
          onClick={() => setIsOpen(!isOpen)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className={WooptionsFic.Utils.classNames('wof-datepicker-field-val', !props.value && 'is-placeholder')}>
            {props.value || props.placeholder || __('Select date...', 'wooptionsfic')}
          </span>
          {props.value ? (
            <span
              role="button"
              tabIndex={0}
              className="wof-datepicker-field-clear"
              title={__('Clear date', 'wooptionsfic')}
              onClick={(e: any) => {
                e.stopPropagation();
                props.onChange('');
              }}
            >
              ×
            </span>
          ) : null}
        </button>
        {isOpen ? (
          <DatePickerPopup
            value={props.value}
            onSelect={(val) => {
              props.onChange(val);
              setIsOpen(false);
            }}
            onClose={() => setIsOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  interface MultiSelectOption {
    label: string;
    value: string | number;
  }

  function MultiSelectDropdown(props: {
    placeholder: string;
    options: MultiSelectOption[];
    selectedValues: Array<string | number>;
    onChange: (newValues: any[]) => void;
  }): any {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const handleDown = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleDown);
      return () => document.removeEventListener('mousedown', handleDown);
    }, []);

    const selectedLabels = useMemo(() => {
      return props.options
        .filter((opt) => props.selectedValues.includes(opt.value))
        .map((opt) => opt.label);
    }, [props.options, props.selectedValues]);

    const displayText = useMemo(() => {
      if (selectedLabels.length === 0) return '';
      if (selectedLabels.length <= 3) return selectedLabels.join(', ');
      return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;
    }, [selectedLabels]);

    const toggleOption = (optVal: string | number) => {
      if (props.selectedValues.includes(optVal)) {
        props.onChange(props.selectedValues.filter((v) => v !== optVal));
      } else {
        props.onChange([...props.selectedValues, optVal]);
      }
    };

    const selectAll = () => {
      props.onChange(props.options.map((o) => o.value));
    };

    const clearAll = () => {
      props.onChange([]);
    };

    return (
      <div className="wof-multiselect-container" ref={containerRef}>
        <button
          type="button"
          className={WooptionsFic.Utils.classNames('wof-multiselect-trigger', isOpen && 'is-open')}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={WooptionsFic.Utils.classNames('wof-multiselect-display', !displayText && 'is-placeholder')}>
            {displayText || props.placeholder}
          </span>
          <svg
            className={WooptionsFic.Utils.classNames('wof-multiselect-chevron', isOpen && 'is-open')}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {isOpen ? (
          <div className="wof-multiselect-dropdown">
            <div className="wof-multiselect-header">
              <button type="button" className="wof-multiselect-link-btn" onClick={selectAll}>
                {__('Select All', 'wooptionsfic')}
              </button>
              <button type="button" className="wof-multiselect-link-btn" onClick={clearAll}>
                {__('Clear', 'wooptionsfic')}
              </button>
            </div>
            <div className="wof-multiselect-options" role="listbox">
              {props.options.map((opt) => {
                const isChecked = props.selectedValues.includes(opt.value);
                return (
                  <label key={opt.value} className={WooptionsFic.Utils.classNames('wof-multiselect-item', isChecked && 'is-checked')}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function DateFieldInspector(props: {
    field: WooptionsFic.FieldDefinition;
    update: (patch: Partial<WooptionsFic.FieldDefinition>) => void;
  }): any {
    const { field, update } = props;
    const [showAddDatePicker, setShowAddDatePicker] = useState(false);

    return (
      <div className="wof-datetime-settings-wrap">
        {/* TYPE selector */}
        <div className="wof-field-width-setting wof-datetime-type-setting">
          <span className="wof-field-width-label">{__('Type', 'wooptionsfic')}</span>
          <div className="wof-field-width-group" role="radiogroup" aria-label={__('Type', 'wooptionsfic')}>
            {([
              { label: __('Date', 'wooptionsfic'), value: 'date' },
              { label: __('Date & Time', 'wooptionsfic'), value: 'datetime' },
              { label: __('Time', 'wooptionsfic'), value: 'time' },
            ] as const).map((t) => {
              const isSelected = (field.dateTimeType || (field.type === 'time' ? 'time' : 'date')) === t.value;
              return (
                <button
                  type="button"
                  key={t.value}
                  role="radio"
                  aria-checked={isSelected}
                  className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                  onClick={() => update({ dateTimeType: t.value })}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Settings Box (visible for 'date' and 'datetime') */}
        {(field.dateTimeType || (field.type === 'time' ? 'time' : 'date')) !== 'time' ? (
          <div className="wof-datetime-box">
            <SelectControl
              label={__('Date Format', 'wooptionsfic')}
              value={field.dateFormat ?? 'DD/MM/YYYY'}
              options={DATE_FORMAT_OPTIONS}
              onChange={(dateFormat: string) => update({ dateFormat })}
            />

            {/* Min Date (Stacked full width for comfortable spacing) */}
            <div style={{ marginBottom: '14px' }}>
              <span className="wof-datetime-label">{__('Min Date', 'wooptionsfic')}</span>
              <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
                <div className="wof-field-width-group" role="radiogroup" aria-label={__('Min Date', 'wooptionsfic')}>
                  {([
                    { label: __('None', 'wooptionsfic'), value: 'none' },
                    { label: __('Current Day', 'wooptionsfic'), value: 'current_day' },
                    { label: __('Custom', 'wooptionsfic'), value: 'custom' },
                  ] as const).map((m) => {
                    const isSelected = (field.minDateType || 'none') === m.value;
                    return (
                      <button
                        type="button"
                        key={m.value}
                        role="radio"
                        aria-checked={isSelected}
                        className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                        onClick={() => update({ minDateType: m.value })}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {field.minDateType === 'custom' ? (
                <div style={{ marginTop: '8px' }}>
                  <DatePickerField
                    value={field.minDateCustom ?? ''}
                    placeholder={__('Select min date...', 'wooptionsfic')}
                    onChange={(minDateCustom: string) => update({ minDateCustom })}
                  />
                </div>
              ) : null}
            </div>

            {/* Max Date (Stacked full width for comfortable spacing) */}
            <div style={{ marginBottom: '14px' }}>
              <span className="wof-datetime-label">{__('Max Date', 'wooptionsfic')}</span>
              <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
                <div className="wof-field-width-group" role="radiogroup" aria-label={__('Max Date', 'wooptionsfic')}>
                  {([
                    { label: __('None', 'wooptionsfic'), value: 'none' },
                    { label: __('Current Day', 'wooptionsfic'), value: 'current_day' },
                    { label: __('Custom', 'wooptionsfic'), value: 'custom' },
                  ] as const).map((m) => {
                    const isSelected = (field.maxDateType || 'none') === m.value;
                    return (
                      <button
                        type="button"
                        key={m.value}
                        role="radio"
                        aria-checked={isSelected}
                        className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                        onClick={() => update({ maxDateType: m.value })}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {field.maxDateType === 'custom' ? (
                <div style={{ marginTop: '8px' }}>
                  <DatePickerField
                    value={field.maxDateCustom ?? ''}
                    placeholder={__('Select max date...', 'wooptionsfic')}
                    onChange={(maxDateCustom: string) => update({ maxDateCustom })}
                  />
                </div>
              ) : null}
            </div>

            <ToggleControl
              label={__('Disable Today', 'wooptionsfic')}
              checked={Boolean(field.disableToday)}
              onChange={(disableToday: boolean) => update({ disableToday })}
            />

            <TextControl
              label={__('Disable Next N Days', 'wooptionsfic')}
              type="number"
              min={0}
              value={String(field.disableNextNDays ?? 0)}
              help={__('Disable N days after today (e.g. 3 disables tomorrow, day after tomorrow, and one more)', 'wooptionsfic')}
              onChange={(val: string) => update({ disableNextNDays: Math.max(0, parseInt(val, 10) || 0) })}
            />

            {/* Disable Specific Dates with Custom Datepicker Popover */}
            <div style={{ marginBottom: '14px' }}>
              <span className="wof-datetime-label" style={{ marginBottom: '8px' }}>{__('Disable Specific Dates', 'wooptionsfic')}</span>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  className="wof-btn-add-date"
                  onClick={() => setShowAddDatePicker(!showAddDatePicker)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  {__('Add Date', 'wooptionsfic')}
                </button>
                {showAddDatePicker ? (
                  <DatePickerPopup
                    onSelect={(dateStr) => {
                      const current = Array.isArray(field.disabledDates) ? [...field.disabledDates] : [];
                      if (!current.includes(dateStr)) {
                        update({ disabledDates: [...current, dateStr] });
                      }
                      setShowAddDatePicker(false);
                    }}
                    onClose={() => setShowAddDatePicker(false)}
                  />
                ) : null}
              </div>
              {Array.isArray(field.disabledDates) && field.disabledDates.length > 0 ? (
                <div className="wof-disabled-dates-list">
                  {field.disabledDates.map((dateVal, idx) => (
                    <div key={idx} className="wof-disabled-date-item">
                      <div className="wof-disabled-date-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>{dateVal}</span>
                      </div>
                      <button
                        type="button"
                        className="wof-disabled-date-delete-btn"
                        title={__('Remove date', 'wooptionsfic')}
                        onClick={() => {
                          const next = [...(field.disabledDates ?? [])];
                          next.splice(idx, 1);
                          update({ disabledDates: next });
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Disable Weekdays Multiselect */}
            <div style={{ marginBottom: '14px' }}>
              <span className="wof-datetime-label">{__('Disable Weekdays', 'wooptionsfic')}</span>
              <MultiSelectDropdown
                placeholder={__('Select weekdays to disable...', 'wooptionsfic')}
                options={WEEKDAY_OPTIONS}
                selectedValues={Array.isArray(field.disabledWeekdays) ? field.disabledWeekdays : []}
                onChange={(selected) => update({ disabledWeekdays: selected.map(Number) })}
              />
            </div>

            {/* Disable Monthly Days Multiselect */}
            <div style={{ marginBottom: '4px' }}>
              <span className="wof-datetime-label">{__('Disable Monthly Days', 'wooptionsfic')}</span>
              <MultiSelectDropdown
                placeholder={__('Select monthly days to disable...', 'wooptionsfic')}
                options={MONTHLY_DAY_OPTIONS}
                selectedValues={
                  String(field.disabledMonthlyDays || '')
                    .split(',')
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !isNaN(n))
                }
                onChange={(selected) => {
                  const sorted = [...selected].map(Number).sort((a, b) => a - b);
                  update({ disabledMonthlyDays: sorted.join(', ') });
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Time Settings Box (visible for 'time' and 'datetime') */}
        {(field.dateTimeType || (field.type === 'time' ? 'time' : 'date')) !== 'date' ? (
          <div className="wof-datetime-box">
            {/* Time Range Min & Max (Side by side) */}
            <div className="wof-time-range-row">
              <div className="wof-time-range-col">
                <span className="wof-datetime-label">{__('Time Range (Min)', 'wooptionsfic')}</span>
                {renderTimeInput(
                  field.minTime || '12:00 AM',
                  field.timeFormat || '12',
                  (val: string) => update({ minTime: val })
                )}
              </div>

              <div className="wof-time-range-col">
                <span className="wof-datetime-label">{__('Time Range (Max)', 'wooptionsfic')}</span>
                {renderTimeInput(
                  field.maxTime || '12:00 PM',
                  field.timeFormat || '12',
                  (val: string) => update({ maxTime: val })
                )}
              </div>
            </div>

            {/* Time Format */}
            <div>
              <span className="wof-datetime-label">{__('Time Format', 'wooptionsfic')}</span>
              <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
                <div className="wof-field-width-group" role="radiogroup" aria-label={__('Time Format', 'wooptionsfic')}>
                  {([
                    { label: __('12 Hours', 'wooptionsfic'), value: '12' },
                    { label: __('24 Hours', 'wooptionsfic'), value: '24' },
                  ] as const).map((fmt) => {
                    const isSelected = (field.timeFormat || '12') === fmt.value;
                    return (
                      <button
                        type="button"
                        key={fmt.value}
                        role="radio"
                        aria-checked={isSelected}
                        className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                        onClick={() => update({ timeFormat: fmt.value })}
                      >
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function DateRangeFieldInspector(props: {
    field: WooptionsFic.FieldDefinition;
    update: (patch: Partial<WooptionsFic.FieldDefinition>) => void;
  }): any {
    const { field, update } = props;
    const [showAddDatePicker, setShowAddDatePicker] = useState(false);

    return (
      <div className="wof-datetime-settings-wrap">
        <div className="wof-datetime-box">
          <SelectControl
            label={__('Date Format', 'wooptionsfic')}
            value={field.dateFormat ?? 'DD/MM/YYYY'}
            options={DATE_FORMAT_OPTIONS}
            onChange={(dateFormat: string) => update({ dateFormat })}
          />

          {/* Min Date */}
          <div style={{ marginBottom: '14px' }}>
            <span className="wof-datetime-label">{__('Min Date', 'wooptionsfic')}</span>
            <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
              <div className="wof-field-width-group" role="radiogroup" aria-label={__('Min Date', 'wooptionsfic')}>
                {([
                  { label: __('None', 'wooptionsfic'), value: 'none' },
                  { label: __('Current Day', 'wooptionsfic'), value: 'current_day' },
                  { label: __('Custom', 'wooptionsfic'), value: 'custom' },
                ] as const).map((m) => {
                  const isSelected = (field.minDateType || 'none') === m.value;
                  return (
                    <button
                      type="button"
                      key={m.value}
                      role="radio"
                      aria-checked={isSelected}
                      className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                      onClick={() => update({ minDateType: m.value })}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {field.minDateType === 'custom' ? (
              <div style={{ marginTop: '8px' }}>
                <DatePickerField
                  value={field.minDateCustom ?? ''}
                  placeholder={__('Select min date...', 'wooptionsfic')}
                  onChange={(minDateCustom: string) => update({ minDateCustom })}
                />
              </div>
            ) : null}
          </div>

          {/* Max Date */}
          <div style={{ marginBottom: '14px' }}>
            <span className="wof-datetime-label">{__('Max Date', 'wooptionsfic')}</span>
            <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
              <div className="wof-field-width-group" role="radiogroup" aria-label={__('Max Date', 'wooptionsfic')}>
                {([
                  { label: __('None', 'wooptionsfic'), value: 'none' },
                  { label: __('Current Day', 'wooptionsfic'), value: 'current_day' },
                  { label: __('Custom', 'wooptionsfic'), value: 'custom' },
                ] as const).map((m) => {
                  const isSelected = (field.maxDateType || 'none') === m.value;
                  return (
                    <button
                      type="button"
                      key={m.value}
                      role="radio"
                      aria-checked={isSelected}
                      className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                      onClick={() => update({ maxDateType: m.value })}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {field.maxDateType === 'custom' ? (
              <div style={{ marginTop: '8px' }}>
                <DatePickerField
                  value={field.maxDateCustom ?? ''}
                  placeholder={__('Select max date...', 'wooptionsfic')}
                  onChange={(maxDateCustom: string) => update({ maxDateCustom })}
                />
              </div>
            ) : null}
          </div>

          <ToggleControl
            label={__('Disable Today', 'wooptionsfic')}
            checked={Boolean(field.disableToday)}
            onChange={(disableToday: boolean) => update({ disableToday })}
          />

          <TextControl
            label={__('Disable Next N Days', 'wooptionsfic')}
            type="number"
            min={0}
            value={String(field.disableNextNDays ?? 0)}
            help={__('Disable N days after today (e.g. 3 disables tomorrow, day after tomorrow, and one more)', 'wooptionsfic')}
            onChange={(val: string) => update({ disableNextNDays: Math.max(0, parseInt(val, 10) || 0) })}
          />

          {/* Disable Specific Dates with Custom Datepicker Popover */}
          <div style={{ marginBottom: '14px' }}>
            <span className="wof-datetime-label" style={{ marginBottom: '8px' }}>{__('Disable Specific Dates', 'wooptionsfic')}</span>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className="wof-btn-add-date"
                onClick={() => setShowAddDatePicker(!showAddDatePicker)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                {__('Add Date', 'wooptionsfic')}
              </button>
              {showAddDatePicker ? (
                <DatePickerPopup
                  onSelect={(dateStr) => {
                    const current = Array.isArray(field.disabledDates) ? [...field.disabledDates] : [];
                    if (!current.includes(dateStr)) {
                      update({ disabledDates: [...current, dateStr] });
                    }
                    setShowAddDatePicker(false);
                  }}
                  onClose={() => setShowAddDatePicker(false)}
                />
              ) : null}
            </div>
            {Array.isArray(field.disabledDates) && field.disabledDates.length > 0 ? (
              <div className="wof-disabled-dates-list">
                {field.disabledDates.map((dateVal, idx) => (
                  <div key={idx} className="wof-disabled-date-item">
                    <div className="wof-disabled-date-badge">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      <span>{dateVal}</span>
                    </div>
                    <button
                      type="button"
                      className="wof-disabled-date-delete-btn"
                      title={__('Remove date', 'wooptionsfic')}
                      onClick={() => {
                        const next = [...(field.disabledDates ?? [])];
                        next.splice(idx, 1);
                        update({ disabledDates: next });
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Disable Weekdays Multiselect */}
          <div style={{ marginBottom: '14px' }}>
            <span className="wof-datetime-label">{__('Disable Weekdays', 'wooptionsfic')}</span>
            <MultiSelectDropdown
              placeholder={__('Select weekdays to disable...', 'wooptionsfic')}
              options={WEEKDAY_OPTIONS}
              selectedValues={Array.isArray(field.disabledWeekdays) ? field.disabledWeekdays : []}
              onChange={(selected) => update({ disabledWeekdays: selected.map(Number) })}
            />
          </div>

          {/* Disable Monthly Days Multiselect */}
          <div style={{ marginBottom: '14px' }}>
            <span className="wof-datetime-label">{__('Disable Monthly Days', 'wooptionsfic')}</span>
            <MultiSelectDropdown
              placeholder={__('Select monthly days to disable...', 'wooptionsfic')}
              options={MONTHLY_DAY_OPTIONS}
              selectedValues={
                String(field.disabledMonthlyDays || '')
                  .split(',')
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => !isNaN(n))
              }
              onChange={(selected) => {
                const sorted = [...selected].map(Number).sort((a, b) => a - b);
                update({ disabledMonthlyDays: sorted.join(', ') });
              }}
            />
          </div>

          {/* Min Days & Max Days Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <TextControl
              label={__('Min Days', 'wooptionsfic')}
              type="number"
              min={0}
              value={String(field.minDays ?? 0)}
              help={__('Min duration (0 for none)', 'wooptionsfic')}
              onChange={(val: string) => update({ minDays: Math.max(0, parseInt(val, 10) || 0) })}
            />
            <TextControl
              label={__('Max Days', 'wooptionsfic')}
              type="number"
              min={0}
              value={String(field.maxDays ?? 0)}
              help={__('Max duration (0 for none)', 'wooptionsfic')}
              onChange={(val: string) => update({ maxDays: Math.max(0, parseInt(val, 10) || 0) })}
            />
          </div>

          {/* Allow Same Day Selection */}
          <ToggleControl
            label={__('Allow Same Day Selection', 'wooptionsfic')}
            help={__('Allow start and end date to be on the same day', 'wooptionsfic')}
            checked={field.allowSameDay !== false}
            onChange={(allowSameDay: boolean) => update({ allowSameDay })}
          />
        </div>
      </div>
    );
  }

  function TimePickerInput(props: {
    value: string;
    format: '12' | '24';
    onChange: (val: string) => void;
  }): any {
    const is12 = props.format === '12';
    const minuteInputRef = useRef<HTMLInputElement | null>(null);

    const parseValue = (val: string) => {
      const match = (val || '').match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
      const h = match ? match[1] : (is12 ? '12' : '00');
      const m = match ? match[2] : '00';
      const mer = (match && match[3] ? match[3].toUpperCase() : 'AM') as 'AM' | 'PM';
      return { h, m, mer };
    };

    const initial = parseValue(props.value);
    const [localHours, setLocalHours] = useState(initial.h.padStart(2, '0'));
    const [localMinutes, setLocalMinutes] = useState(initial.m.padStart(2, '0'));
    const [localMeridiem, setLocalMeridiem] = useState<'AM' | 'PM'>(initial.mer);

    useEffect(() => {
      const p = parseValue(props.value);
      setLocalHours(p.h.padStart(2, '0'));
      setLocalMinutes(p.m.padStart(2, '0'));
      setLocalMeridiem(p.mer);
    }, [props.value, props.format]);

    const commit = (h: string, m: string, mer: 'AM' | 'PM') => {
      props.onChange(is12 ? `${h}:${m} ${mer}` : `${h}:${m}`);
    };

    const handleHoursChange = (e: any) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
      setLocalHours(raw);

      if (raw.length === 2) {
        let num = parseInt(raw, 10);
        if (is12) {
          if (num < 1) num = 12;
          if (num > 12) num = 12;
        } else {
          if (num > 23) num = 23;
        }
        const formattedH = String(num).padStart(2, '0');
        setLocalHours(formattedH);
        commit(formattedH, (localMinutes || '00').padStart(2, '0'), localMeridiem);
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }
    };

    const handleHoursBlur = () => {
      let num = parseInt(localHours, 10);
      if (isNaN(num)) {
        num = is12 ? 12 : 0;
      } else if (is12) {
        if (num < 1) num = 12;
        if (num > 12) num = 12;
      } else {
        if (num < 0) num = 0;
        if (num > 23) num = 23;
      }
      const formattedH = String(num).padStart(2, '0');
      setLocalHours(formattedH);
      commit(formattedH, (localMinutes || '00').padStart(2, '0'), localMeridiem);
    };

    const handleHoursKeyDown = (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        let num = parseInt(localHours, 10);
        if (isNaN(num)) num = is12 ? 12 : 0;
        num += e.key === 'ArrowUp' ? 1 : -1;
        if (is12) {
          if (num < 1) num = 12;
          else if (num > 12) num = 1;
        } else {
          if (num < 0) num = 23;
          else if (num > 23) num = 0;
        }
        const formattedH = String(num).padStart(2, '0');
        setLocalHours(formattedH);
        commit(formattedH, (localMinutes || '00').padStart(2, '0'), localMeridiem);
      } else if (e.key === ':' || e.key === 'Enter') {
        e.preventDefault();
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }
    };

    const handleMinutesChange = (e: any) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
      setLocalMinutes(raw);

      if (raw.length === 2) {
        let num = parseInt(raw, 10);
        if (num < 0) num = 0;
        if (num > 59) num = 59;
        const formattedM = String(num).padStart(2, '0');
        setLocalMinutes(formattedM);
        commit((localHours || (is12 ? '12' : '00')).padStart(2, '0'), formattedM, localMeridiem);
      }
    };

    const handleMinutesBlur = () => {
      let num = parseInt(localMinutes, 10);
      if (isNaN(num)) {
        num = 0;
      } else {
        if (num < 0) num = 0;
        if (num > 59) num = 59;
      }
      const formattedM = String(num).padStart(2, '0');
      setLocalMinutes(formattedM);
      commit((localHours || (is12 ? '12' : '00')).padStart(2, '0'), formattedM, localMeridiem);
    };

    const handleMinutesKeyDown = (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        let num = parseInt(localMinutes, 10);
        if (isNaN(num)) num = 0;
        num += e.key === 'ArrowUp' ? 1 : -1;
        if (num < 0) num = 59;
        else if (num > 59) num = 0;
        const formattedM = String(num).padStart(2, '0');
        setLocalMinutes(formattedM);
        commit((localHours || (is12 ? '12' : '00')).padStart(2, '0'), formattedM, localMeridiem);
      }
    };

    return (
      <div className="wof-time-input-group">
        <div className="wof-time-spinner-box">
          <input
            type="text"
            maxLength={2}
            value={localHours}
            aria-label={__('Hours', 'wooptionsfic')}
            onFocus={(e: any) => e.target.select()}
            onChange={handleHoursChange}
            onBlur={handleHoursBlur}
            onKeyDown={handleHoursKeyDown}
          />
          <span className="wof-time-colon">:</span>
          <input
            ref={minuteInputRef}
            type="text"
            maxLength={2}
            value={localMinutes}
            aria-label={__('Minutes', 'wooptionsfic')}
            onFocus={(e: any) => e.target.select()}
            onChange={handleMinutesChange}
            onBlur={handleMinutesBlur}
            onKeyDown={handleMinutesKeyDown}
          />
        </div>
        {is12 ? (
          <div className="wof-meridiem-group">
            <button
              type="button"
              className={WooptionsFic.Utils.classNames('wof-meridiem-btn', localMeridiem === 'AM' && 'is-active')}
              onClick={() => {
                setLocalMeridiem('AM');
                commit((localHours || '12').padStart(2, '0'), (localMinutes || '00').padStart(2, '0'), 'AM');
              }}
            >
              AM
            </button>
            <button
              type="button"
              className={WooptionsFic.Utils.classNames('wof-meridiem-btn', localMeridiem === 'PM' && 'is-active')}
              onClick={() => {
                setLocalMeridiem('PM');
                commit((localHours || '12').padStart(2, '0'), (localMinutes || '00').padStart(2, '0'), 'PM');
              }}
            >
              PM
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderTimeInput(value: string, format: '12' | '24', onChange: (val: string) => void) {
    return <TimePickerInput value={value} format={format} onChange={onChange} />;
  }

  function normalizeHexColor(value: string, fallback = '#5B4FF5'): string {
    const color = String(value || '').trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
  }

  function ChoiceColorControl(props: {
    color: string;
    label?: string;
    onChange: (color: string) => void;
  }): any {
    const [open, setOpen] = useState(false);
    const color = normalizeHexColor(props.color);
    return <div className={WooptionsFic.Utils.classNames('wof-choice-color-control', open && 'is-open')}>
      <span className="wof-choice-color-control__label">{props.label ?? __('Swatch color', 'wooptionsfic')}</span>
      <div className="wof-choice-color-control__row">
        <button type="button" className="wof-choice-color-control__trigger" onClick={() => setOpen((value: boolean) => !value)} aria-expanded={open}>
          <span style={{ background: color }} aria-hidden="true" />
          <code>{color}</code>
          <WooptionsFic.Components.Dashicon name="arrow-down-alt2" />
        </button>
        <TextControl
          label={__('Hex color', 'wooptionsfic')}
          hideLabelFromVision
          value={color}
          onChange={(next: string) => {
            if (/^#[0-9a-f]{6}$/i.test(next.trim())) props.onChange(next.trim().toUpperCase());
          }}
        />
      </div>
      {open ? <div className="wof-choice-color-control__picker">
        <ColorPicker
          color={color}
          enableAlpha={false}
          onChange={(next: string) => props.onChange(normalizeHexColor(next, color))}
        />
      </div> : null}
    </div>;
  }

  function ChoiceMediaControl(props: {
    choice: WooptionsFic.ChoiceDefinition;
    required: boolean;
    onChange: (patch: Partial<WooptionsFic.ChoiceDefinition>) => void;
  }): any {
    const [previewUrl, setPreviewUrl] = useState(props.choice.imageUrl ?? '');

    useEffect(() => {
      let active = true;
      setPreviewUrl(props.choice.imageUrl ?? '');
      const attachmentId = Number(props.choice.imageId ?? 0);
      if (!attachmentId || !wp.media?.attachment) return () => { active = false; };
      const attachment = wp.media.attachment(attachmentId);
      const update = () => {
        if (!active) return;
        const data = attachment.toJSON?.() ?? {};
        const source = data.sizes?.thumbnail?.url ?? data.sizes?.medium?.url ?? data.url ?? '';
        if (source) setPreviewUrl(String(source));
      };
      update();
      const request = attachment.fetch?.();
      if (request) Promise.resolve(request).then(update).catch(() => undefined);
      return () => { active = false; };
    }, [props.choice.imageId, props.choice.imageUrl]);

    const openPicker = () => {
      if (!wp.media) return;
      const frame = wp.media({
        title: __('Choose a choice image', 'wooptionsfic'),
        button: { text: __('Use this image', 'wooptionsfic') },
        library: { type: 'image' },
        multiple: false,
      });
      frame.on('select', () => {
        const attachment = frame.state().get('selection').first().toJSON();
        const imageId = Math.max(0, Number(attachment.id ?? 0));
        const imageUrl = String(attachment.sizes?.thumbnail?.url ?? attachment.sizes?.medium?.url ?? attachment.url ?? '');
        if (!imageId) return;
        setPreviewUrl(imageUrl);
        props.onChange({ imageId, imageUrl });
      });
      frame.open();
    };

    const hasImage = Number(props.choice.imageId ?? 0) > 0 || Boolean(previewUrl);
    return (
      <div className="wof-media-control">
        <button type="button" className={`wof-media-control__preview ${hasImage ? 'has-image' : ''}`} onClick={openPicker}>
          {previewUrl ? <img src={previewUrl} alt="" /> : <span className="dashicons dashicons-format-image" aria-hidden="true" />}
        </button>
        <div>
          <strong>{props.required ? __('Swatch image', 'wooptionsfic') : __('Choice image (optional)', 'wooptionsfic')}</strong>
          <small>{props.choice.imageId ? `Media #${props.choice.imageId}` : __('No image selected', 'wooptionsfic')}</small>
          <div className="wof-media-control__actions">
            <Button variant="secondary" onClick={openPicker}>{hasImage ? __('Replace', 'wooptionsfic') : __('Choose image', 'wooptionsfic')}</Button>
            {hasImage ? (
              <Button
                variant="tertiary"
                isDestructive
                onClick={() => {
                  setPreviewUrl('');
                  props.onChange({ imageId: 0, imageUrl: '' });
                }}
              >
                {__('Remove', 'wooptionsfic')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const CHOICE_INDEX_MIME = 'application/x-wooptionsfic-choice-index';

  function truncateWords(str: string, maxWords = 5): string {
    if (!str) return '';
    const trimmed = str.trim();
    const words = trimmed.split(/\s+/);
    if (words.length <= maxWords) return trimmed;
    return words.slice(0, maxWords).join(' ') + '...';
  }

  function ChoiceItemCard(props: {
    choice: WooptionsFic.ChoiceDefinition;
    index: number;
    count: number;
    fieldType: string;
    isOpen: boolean;
    onToggle: () => void;
    onUpdate: (patch: Partial<WooptionsFic.ChoiceDefinition>) => void;
    onRemove: () => void;
    onMove: (from: number, to: number) => void;
  }): any {
    const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef<HTMLElement | null>(null);

    const dragStart = (event: any) => {
      event.stopPropagation();
      event.dataTransfer?.setData(CHOICE_INDEX_MIME, String(props.index));
      event.dataTransfer?.setData('text/plain', String(props.index));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        if (cardRef.current && event.dataTransfer.setDragImage) {
          const bounds = cardRef.current.getBoundingClientRect();
          event.dataTransfer.setDragImage(cardRef.current, event.clientX - bounds.left, event.clientY - bounds.top);
        }
      }
      setIsDragging(true);
    };

    const dragEnd = () => {
      setIsDragging(false);
      setDropEdge(null);
    };

    const dragOver = (event: any) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain')) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const element = event.currentTarget as HTMLElement;
      const bounds = element.getBoundingClientRect();
      setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
    };

    const dragLeave = (event: any) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setDropEdge(null);
    };

    const drop = (event: any) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain')) return;
      event.preventDefault();
      event.stopPropagation();
      const sourceText = event.dataTransfer?.getData(CHOICE_INDEX_MIME) || event.dataTransfer?.getData('text/plain') || '';
      const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
      setDropEdge(null);
      setIsDragging(false);

      const source = Number(sourceText);
      if (!Number.isInteger(source)) return;
      let finalIndex = insertIndex;
      if (source < insertIndex) finalIndex -= 1;
      finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
      if (finalIndex !== source) props.onMove(source, finalIndex);
    };

    return (
      <article
        ref={cardRef}
        className={WooptionsFic.Utils.classNames(
          'wof-choice-card',
          !props.isOpen && 'is-collapsed',
          isDragging && 'is-dragging',
          dropEdge === 'before' && 'is-drop-before',
          dropEdge === 'after' && 'is-drop-after'
        )}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
      >
        <header className="wof-choice-card__header">
          <button
            type="button"
            draggable
            className="wof-choice-drag-handle"
            onDragStart={dragStart}
            onDragEnd={dragEnd}
            aria-label={__('Drag choice to reorder', 'wooptionsfic')}
            title={__('Drag to reorder', 'wooptionsfic')}
          >
            <WooptionsFic.Components.GripIcon />
            <span className="wof-choice-header-label-badge" title={props.choice.label}>
              {props.choice.label || `${__('Choice', 'wooptionsfic')} ${props.index + 1}`}
            </span>
          </button>
          <div className="wof-choice-header-actions">
            <button
              type="button"
              className="wof-choice-accordion-toggle"
              onClick={props.onToggle}
              aria-expanded={props.isOpen}
              aria-label={props.isOpen ? __('Collapse choice', 'wooptionsfic') : __('Expand choice', 'wooptionsfic')}
              title={props.isOpen ? __('Collapse choice', 'wooptionsfic') : __('Expand choice', 'wooptionsfic')}
            >
              <WooptionsFic.Components.Dashicon name={props.isOpen ? 'arrow-up-alt2' : 'arrow-down-alt2'} />
            </button>
            <button
              type="button"
              className="wof-choice-delete-btn"
              onClick={props.onRemove}
              aria-label={__('Delete choice', 'wooptionsfic')}
              title={__('Delete choice', 'wooptionsfic')}
            >
              <WooptionsFic.Components.Dashicon name="trash" />
            </button>
          </div>
        </header>

        {props.isOpen ? (
          <div className="wof-choice-card__body">
            <TextControl
              label={__('Label', 'wooptionsfic')}
              value={props.choice.label}
              onChange={(label: string) => props.onUpdate({ label })}
            />

            <TextControl
              label={__('Description', 'wooptionsfic')}
              value={props.choice.description}
              onChange={(description: string) => props.onUpdate({ description })}
            />

            {props.fieldType === 'color_swatch' ? (
              <ChoiceColorControl
                color={props.choice.color || '#5B4FF5'}
                onChange={(color: string) => props.onUpdate({ color })}
              />
            ) : null}

            {['image_swatch', 'product', 'radio', 'checkbox_group', 'segmented', 'select'].includes(props.fieldType) ? (
              <ChoiceMediaControl
                choice={props.choice}
                required={props.fieldType === 'image_swatch'}
                onChange={(patch) => props.onUpdate(patch)}
              />
            ) : null}

            <div className="wof-choice-pricing-row">
              <SelectControl
                label={__('Price type', 'wooptionsfic')}
                value={props.choice.pricing.strategy}
                options={[
                  { label: __('No adjustment', 'wooptionsfic'), value: 'none' },
                  { label: __('Fixed amount', 'wooptionsfic'), value: 'fixed' },
                  { label: __('Percentage', 'wooptionsfic'), value: 'percentage' },
                ]}
                onChange={(strategy: WooptionsFic.PricingDefinition['strategy']) =>
                  props.onUpdate({ pricing: { ...props.choice.pricing, strategy } })
                }
              />
              {props.choice.pricing.strategy === 'percentage' ? (
                <TextControl
                  label={__('Percent', 'wooptionsfic')}
                  type="number"
                  value={props.choice.pricing.percent}
                  onChange={(percent: string) =>
                    props.onUpdate({ pricing: { ...props.choice.pricing, percent } })
                  }
                />
              ) : props.choice.pricing.strategy !== 'none' ? (
                <TextControl
                  label={__('Amount', 'wooptionsfic')}
                  type="number"
                  value={props.choice.pricing.amount}
                  onChange={(amount: string) =>
                    props.onUpdate({ pricing: { ...props.choice.pricing, amount } })
                  }
                />
              ) : null}
            </div>

            <div className="wof-choice-toggles-row">
              <ToggleControl
                label={__('Default choice', 'wooptionsfic')}
                checked={props.choice.default}
                onChange={(val: boolean) => props.onUpdate({ default: val })}
              />
              <ToggleControl
                label={__('Disable choice', 'wooptionsfic')}
                checked={props.choice.disabled}
                onChange={(val: boolean) => props.onUpdate({ disabled: val })}
              />
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  // ─── Product Choice Editor ────────────────────────────────────────────────

  function ProductChoiceCard(props: {
    choice: WooptionsFic.ChoiceDefinition;
    index: number;
    count: number;
    mergeVariations: boolean;
    isOpen: boolean;
    onToggle: () => void;
    onUpdate: (patch: Partial<WooptionsFic.ChoiceDefinition>) => void;
    onRemove: () => void;
    onMove: (from: number, to: number) => void;
  }): any {
    const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef<HTMLElement | null>(null);

    // Product replacement search state
    const [showChangeSearch, setShowChangeSearch] = useState(false);
    const [changeQuery, setChangeQuery] = useState('');
    const [changeSuggestions, setChangeSuggestions] = useState<any[]>([]);
    const [isChangingSearch, setIsChangingSearch] = useState(false);
    const changeSearchTimeout = useRef<any>(null);

    // Variations filter state
    const [varFilter, setVarFilter] = useState('');

    const info = props.choice.productInfo;
    const isVariable = Boolean(props.choice.isVariable || info?.isVariable);
    const selectedVarIds = props.choice.selectedVariationIds ?? [];
    const allVariations: any[] = info?.variations ?? [];
    const productId = props.choice.productId || props.choice.linkedProductId;
    const productPrice = info?.salePrice ? `${info.salePrice} (regular: ${info.regularPrice})` : (info?.price || info?.regularPrice || '');

    // variation badge in header
    let varBadge: string;
    if (!isVariable) {
      varBadge = __('N/A', 'wooptionsfic');
    } else if (props.mergeVariations) {
      varBadge = __('All Variations', 'wooptionsfic');
    } else if (selectedVarIds.length === 0) {
      varBadge = __('N/A', 'wooptionsfic');
    } else {
      varBadge = `${selectedVarIds.length} ${__('Variations', 'wooptionsfic')}`;
    }

    // Auto-load variations if variable product info was saved without variations array
    useEffect(() => {
      const pid = props.choice.productId || props.choice.linkedProductId;
      if (isVariable && allVariations.length === 0 && pid) {
        WooptionsFic.Api.searchProductsForChoices('', [pid]).then((res: any) => {
          const found = (res.items || []).find((it: any) => it.id === pid);
          if (found && found.variations && found.variations.length > 0) {
            props.onUpdate({
              productInfo: {
                ...(props.choice.productInfo || {}),
                price: found.price || '',
                regularPrice: found.regularPrice || '',
                salePrice: found.salePrice || '',
                image: found.image || '',
                isVariable: true,
                variations: found.variations,
              },
            });
          }
        }).catch(() => { });
      }
    }, [props.choice.productId, props.choice.linkedProductId, isVariable, allVariations.length]);

    // Live search for product replacement
    useEffect(() => {
      if (!showChangeSearch) return;
      clearTimeout(changeSearchTimeout.current);
      setIsChangingSearch(true);
      changeSearchTimeout.current = setTimeout(async () => {
        try {
          const result = await WooptionsFic.Api.searchProductsForChoices(changeQuery);
          setChangeSuggestions(result.items ?? []);
        } catch {
          setChangeSuggestions([]);
        }
        setIsChangingSearch(false);
      }, 250);
      return () => clearTimeout(changeSearchTimeout.current);
    }, [changeQuery, showChangeSearch]);

    const selectNewProduct = (product: any) => {
      props.onUpdate({
        label: product.label || props.choice.label,
        imageUrl: product.image || '',
        linkedProductId: product.id,
        productId: product.id,
        isVariable: Boolean(product.isVariable),
        selectedVariationIds: [],
        pricing: {
          strategy: 'fixed',
          amount: product.price || '0',
          percent: '0',
          mode: 'adjustment',
        },
        productInfo: {
          price: product.price || '',
          regularPrice: product.regularPrice || '',
          salePrice: product.salePrice || '',
          image: product.image || '',
          isVariable: Boolean(product.isVariable),
          variations: product.variations || [],
        },
      });
      setShowChangeSearch(false);
      setChangeQuery('');
    };

    const toggleVarId = (id: number) => {
      const next = selectedVarIds.includes(id) ? selectedVarIds.filter((x) => x !== id) : [...selectedVarIds, id];
      props.onUpdate({ selectedVariationIds: next });
    };

    const filteredVariations = useMemo(() => {
      if (!varFilter.trim()) return allVariations;
      const q = varFilter.toLowerCase();
      return allVariations.filter((v: any) => String(v.label || '').toLowerCase().includes(q));
    }, [allVariations, varFilter]);

    // Drag & Drop
    const dragStart = (event: any) => {
      event.stopPropagation();
      event.dataTransfer?.setData(CHOICE_INDEX_MIME, String(props.index));
      event.dataTransfer?.setData('text/plain', String(props.index));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        if (cardRef.current && event.dataTransfer.setDragImage) {
          const bounds = cardRef.current.getBoundingClientRect();
          event.dataTransfer.setDragImage(cardRef.current, event.clientX - bounds.left, event.clientY - bounds.top);
        }
      }
      setIsDragging(true);
    };

    const dragEnd = () => {
      setIsDragging(false);
      setDropEdge(null);
    };

    const dragOver = (event: any) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain')) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const element = event.currentTarget as HTMLElement;
      const bounds = element.getBoundingClientRect();
      setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
    };

    const dragLeave = (event: any) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setDropEdge(null);
    };

    const drop = (event: any) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain')) return;
      event.preventDefault();
      event.stopPropagation();
      const sourceText = event.dataTransfer?.getData(CHOICE_INDEX_MIME) || event.dataTransfer?.getData('text/plain') || '';
      const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
      setDropEdge(null);
      setIsDragging(false);

      const source = Number(sourceText);
      if (!Number.isInteger(source)) return;
      let finalIndex = insertIndex;
      if (source < insertIndex) finalIndex -= 1;
      finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
      if (finalIndex !== source) props.onMove(source, finalIndex);
    };

    return (
      <article
        ref={cardRef}
        className={WooptionsFic.Utils.classNames(
          'wof-choice-card',
          !props.isOpen && 'is-collapsed',
          isDragging && 'is-dragging',
          dropEdge === 'before' && 'is-drop-before',
          dropEdge === 'after' && 'is-drop-after'
        )}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
      >
        <header className="wof-choice-card__header">
          <button
            type="button"
            draggable
            className="wof-choice-drag-handle"
            onDragStart={dragStart}
            onDragEnd={dragEnd}
            aria-label={__('Drag choice to reorder', 'wooptionsfic')}
            title={__('Drag to reorder', 'wooptionsfic')}
          >
            <WooptionsFic.Components.GripIcon />
            <span className="wof-choice-header-thumb">
              {(info?.image || props.choice.imageUrl) ? (
                <img src={info?.image || props.choice.imageUrl} alt="" />
              ) : (
                <WooptionsFic.Components.Dashicon name="format-image" />
              )}
            </span>
            <span className="wof-choice-header-label-badge" title={props.choice.label}>
              {truncateWords(props.choice.label || `${__('Choice', 'wooptionsfic')} ${props.index + 1}`, 5)}
            </span>
            <span className={WooptionsFic.Utils.classNames('wof-choice-header-var-badge', !isVariable && 'is-na')}>
              {varBadge}
            </span>
          </button>
          <div className="wof-choice-header-actions">
            <button
              type="button"
              className="wof-choice-accordion-toggle"
              onClick={props.onToggle}
              aria-expanded={props.isOpen}
              aria-label={props.isOpen ? __('Collapse choice', 'wooptionsfic') : __('Expand choice', 'wooptionsfic')}
              title={props.isOpen ? __('Collapse choice', 'wooptionsfic') : __('Expand choice', 'wooptionsfic')}
            >
              <WooptionsFic.Components.Dashicon name={props.isOpen ? 'arrow-up-alt2' : 'arrow-down-alt2'} />
            </button>
            <button
              type="button"
              className="wof-choice-delete-btn"
              onClick={props.onRemove}
              aria-label={__('Delete choice', 'wooptionsfic')}
              title={__('Delete choice', 'wooptionsfic')}
            >
              <WooptionsFic.Components.Dashicon name="trash" />
            </button>
          </div>
        </header>

        {props.isOpen ? (
          <div className="wof-choice-card__body">
            {/* Selected Product summary card */}
            <div className="wof-product-choice-selected-card">
              <div className="wof-product-choice-selected-card__thumb">
                {(info?.image || props.choice.imageUrl) ? (
                  <img src={info?.image || props.choice.imageUrl} alt="" />
                ) : (
                  <WooptionsFic.Components.Dashicon name="format-image" />
                )}
              </div>
              <div className="wof-product-choice-selected-card__meta">
                <div className="wof-product-choice-selected-card__title" title={props.choice.label}>
                  {truncateWords(props.choice.label || __('(No product selected)', 'wooptionsfic'), 5)}
                </div>
                <div className="wof-product-choice-selected-card__sub">
                  {productPrice ? <span className="wof-product-choice-selected-card__price">{productPrice}</span> : null}
                  {isVariable ? <span className="wof-choice-header-var-badge">{__('Variable', 'wooptionsfic')}</span> : null}
                  {productId ? <span className="wof-product-choice-selected-card__id">#{productId}</span> : null}
                </div>
              </div>
              <button
                type="button"
                className="wof-product-choice-change-btn"
                onClick={() => setShowChangeSearch((prev) => !prev)}
              >
                {showChangeSearch ? __('Cancel', 'wooptionsfic') : __('Change', 'wooptionsfic')}
              </button>
            </div>

            {/* Change product search dropdown */}
            {showChangeSearch ? (
              <div className="wof-product-change-search-wrap">
                <div className="wof-product-search-input-row">
                  <WooptionsFic.Components.Dashicon name="search" />
                  <input
                    type="text"
                    className="wof-product-search-input"
                    placeholder={__('Search product to replace…', 'wooptionsfic')}
                    value={changeQuery}
                    onChange={(e: any) => setChangeQuery(e.target.value)}
                    autoFocus
                  />
                  {isChangingSearch ? <span className="wof-product-search-spinner">…</span> : null}
                </div>
                {changeSuggestions.length > 0 ? (
                  <div className="wof-product-search-dropdown">
                    {changeSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="wof-product-search-option"
                        onMouseDown={(e: any) => {
                          e.preventDefault();
                          selectNewProduct(s);
                        }}
                      >
                        {s.image ? (
                          <img src={s.image} alt="" className="wof-product-search-option__thumb" />
                        ) : (
                          <WooptionsFic.Components.Dashicon name="format-image" />
                        )}
                        <span className="wof-product-search-option__label">{s.label}</span>
                        <span className="wof-product-search-option__meta">{s.meta}</span>
                        {s.isVariable ? <span className="wof-product-search-option__badge">{__('Variable', 'wooptionsfic')}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Variations */}
            {isVariable ? (
              props.mergeVariations ? (
                <div className="wof-product-variations-merged-notice">
                  <WooptionsFic.Components.Dashicon name="info" />
                  <span>{__('All variations are merged into this product choice because "Merge Variation Products" is enabled.', 'wooptionsfic')}</span>
                </div>
              ) : (
                <div className="wof-product-variations-section">
                  <div className="wof-product-variations-header">
                    <strong>{__('Variations', 'wooptionsfic')}</strong>
                    <span className="wof-product-variations-count">
                      {selectedVarIds.length} / {allVariations.length} {__('selected', 'wooptionsfic')}
                    </span>
                    <div className="wof-product-variations-actions">
                      <button
                        type="button"
                        className="wof-btn-link"
                        onClick={() => props.onUpdate({ selectedVariationIds: allVariations.map((v: any) => v.id) })}
                      >
                        {__('Select all', 'wooptionsfic')}
                      </button>
                      <button
                        type="button"
                        className="wof-btn-link"
                        onClick={() => props.onUpdate({ selectedVariationIds: [] })}
                      >
                        {__('Clear', 'wooptionsfic')}
                      </button>
                    </div>
                  </div>

                  {allVariations.length > 5 ? (
                    <input
                      type="text"
                      className="wof-var-filter-input"
                      placeholder={__('Filter variations…', 'wooptionsfic')}
                      value={varFilter}
                      onChange={(e: any) => setVarFilter(e.target.value)}
                    />
                  ) : null}

                  <div className="wof-product-variations-list">
                    {filteredVariations.length === 0 ? (
                      <p className="wof-muted-note" style={{ margin: 0, padding: '8px' }}>
                        {allVariations.length === 0
                          ? __('No variations loaded for this product.', 'wooptionsfic')
                          : __('No matching variations.', 'wooptionsfic')}
                      </p>
                    ) : (
                      filteredVariations.map((v: any) => {
                        const isChecked = selectedVarIds.includes(v.id);
                        return (
                          <label key={v.id} className="wof-product-variation-item">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleVarId(v.id)}
                            />
                            <span className="wof-product-variation-label" title={v.label}>
                              {truncateWords(v.label, 5)}
                            </span>
                            {v.price ? <span className="wof-product-variation-price">{v.price}</span> : null}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )
            ) : null}

            {/* Default & Disable choice */}
            <div className="wof-choice-toggles-row">
              <ToggleControl
                label={__('Default choice', 'wooptionsfic')}
                checked={props.choice.default}
                onChange={(val: boolean) => props.onUpdate({ default: val })}
              />
              <ToggleControl
                label={__('Disable choice', 'wooptionsfic')}
                checked={props.choice.disabled}
                onChange={(val: boolean) => props.onUpdate({ disabled: val })}
              />
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  function ProductChoiceEditor(props: {
    field: WooptionsFic.FieldDefinition;
    onChange: (field: WooptionsFic.FieldDefinition) => void;
  }): any {
    const choices = props.field.choices ?? [];
    const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const searchRef = useRef<HTMLInputElement | null>(null);
    const searchWrap = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<any>(null);
    const mergeVariations = Boolean(props.field.mergeVariationProducts);

    const toggleChoice = (uuid: string) => {
      setCollapsedMap((prev) => ({ ...prev, [uuid]: !prev[uuid] }));
    };

    const isAllCollapsed = choices.length > 0 && choices.every((c) => Boolean(collapsedMap[c.uuid]));

    const toggleAll = () => {
      const nextState = !isAllCollapsed;
      const nextMap: Record<string, boolean> = {};
      choices.forEach((c) => {
        nextMap[c.uuid] = nextState;
      });
      setCollapsedMap(nextMap);
    };

    useEffect(() => {
      const handleDown = (e: MouseEvent) => {
        if (searchWrap.current && !searchWrap.current.contains(e.target as Node)) {
          setSearchFocused(false);
        }
      };
      document.addEventListener('mousedown', handleDown);
      return () => document.removeEventListener('mousedown', handleDown);
    }, []);

    useEffect(() => {
      if (!searchFocused) return;
      clearTimeout(debounceRef.current);
      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await WooptionsFic.Api.searchProductsForChoices(searchQuery);
          setSuggestions(result.items ?? []);
        } catch { }
        setIsSearching(false);
      }, 280);
      return () => clearTimeout(debounceRef.current);
    }, [searchQuery, searchFocused]);

    const addProduct = (product: any) => {
      const uuid = WooptionsFic.Utils.uuid();
      const newChoice: WooptionsFic.ChoiceDefinition = {
        uuid,
        label: product.label || '',
        description: '',
        adminLabel: '',
        color: '',
        imageId: 0,
        imageUrl: product.image || '',
        disabled: false,
        default: choices.length === 0,
        pricing: { strategy: 'fixed', amount: product.price || '0', percent: '0', mode: 'adjustment' },
        quantityEnabled: false,
        linkedProductId: product.id,
        linkedVariationId: 0,
        linkedQuantity: 1,
        preview: {},
        productId: product.id,
        isVariable: Boolean(product.isVariable),
        selectedVariationIds: [],
        productInfo: {
          price: product.price || '',
          regularPrice: product.regularPrice || '',
          salePrice: product.salePrice || '',
          image: product.image || '',
          isVariable: Boolean(product.isVariable),
          variations: product.variations || [],
        },
      };
      props.onChange({ ...props.field, choices: [...choices, newChoice] });
      setCollapsedMap((prev) => ({ ...prev, [uuid]: false }));
      setSearchQuery('');
      setSearchFocused(false);
    };

    const removeChoice = (uuid: string) => props.onChange({ ...props.field, choices: choices.filter((c) => c.uuid !== uuid) });
    const updateChoice = (uuid: string, patch: Partial<WooptionsFic.ChoiceDefinition>) =>
      props.onChange({ ...props.field, choices: choices.map((c) => c.uuid === uuid ? { ...c, ...patch } : c) });
    const moveChoice = (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= choices.length || to >= choices.length) return;
      const reordered = [...choices];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      props.onChange({ ...props.field, choices: reordered });
    };

    const showDropdown = searchFocused && suggestions.length > 0;

    return (
      <div className="wof-product-choice-editor">
        {/* Image Style */}
        <div style={{ marginBottom: '16px' }}>
          <label className="components-base-control__label" style={{ display: 'block', marginBottom: '8px' }}>
            {__('Image Style', 'wooptionsfic')}
          </label>
          <div className="wof-image-style-cards">
            {([
              { value: 'default', label: __('Default', 'wooptionsfic') },
              { value: 'overlay', label: __('Image overlay', 'wooptionsfic') },
              { value: 'only_image', label: __('Only Image', 'wooptionsfic') },
            ] as const).map((st) => {
              const currentStyle = props.field.imageStyle || 'default';
              const isSelected = currentStyle === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  className={WooptionsFic.Utils.classNames('wof-image-style-card', isSelected && 'is-active')}
                  onClick={() => props.onChange({ ...props.field, imageStyle: st.value })}
                  title={st.label}
                >
                  <span className="wof-image-style-card__preview">
                    <svg viewBox="0 0 60 45" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <rect x="1" y="1" width="58" height="43" rx="5" fill="#e8ecf0" stroke="#c8d0da" strokeWidth="1" />
                      <rect x="8" y="7" width="44" height="24" rx="3" fill="#b4bfcb" />
                      <circle cx="18" cy="19" r="5" fill="#8e9db0" />
                      <polygon points="14,28 24,15 32,24 38,18 52,31 8,31" fill="#9eb0c2" />
                      {st.value === 'overlay' ? (
                        <>
                          <rect x="8" y="21" width="44" height="10" rx="0" fill="rgba(0,0,0,0.45)" />
                          <rect x="12" y="23" width="20" height="3" rx="1.5" fill="#fff" opacity="0.8" />
                          <rect x="12" y="27" width="14" height="2" rx="1" fill="#fff" opacity="0.5" />
                        </>
                      ) : null}
                      {st.value === 'default' ? (
                        <rect x="12" y="36" width="20" height="3" rx="1.5" fill="#b4bfcb" />
                      ) : null}
                    </svg>
                  </span>
                  <span className="wof-image-style-card__label">{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar: Count & Collapse/Expand all */}
        {choices.length > 1 ? (
          <div className="wof-choice-list-toolbar">
            <span className="wof-choice-list-count">{choices.length} {__('Products', 'wooptionsfic')}</span>
            <button
              type="button"
              className="wof-choice-collapse-all-btn"
              onClick={toggleAll}
            >
              {isAllCollapsed ? __('Expand all', 'wooptionsfic') : __('Collapse all', 'wooptionsfic')}
            </button>
          </div>
        ) : null}

        {/* Product choice cards list */}
        <div className="wof-choice-editor-list">
          {choices.map((choice, index) => (
            <ProductChoiceCard
              key={choice.uuid}
              choice={choice}
              index={index}
              count={choices.length}
              mergeVariations={mergeVariations}
              isOpen={!collapsedMap[choice.uuid]}
              onToggle={() => toggleChoice(choice.uuid)}
              onUpdate={(patch) => updateChoice(choice.uuid, patch)}
              onRemove={() => removeChoice(choice.uuid)}
              onMove={moveChoice}
            />
          ))}
        </div>

        {/* Search / Add Product */}
        <div className="wof-product-search-wrap" ref={searchWrap} style={{ marginTop: '10px', marginBottom: '16px' }}>
          <div className="wof-product-search-input-row">
            <WooptionsFic.Components.Dashicon name="plus-alt2" />
            <input
              ref={searchRef}
              type="text"
              className="wof-product-search-input"
              placeholder={__('Add Product…', 'wooptionsfic')}
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              autoComplete="off"
            />
            {isSearching ? <span className="wof-product-search-spinner">…</span> : null}
          </div>
          {showDropdown ? (
            <div className="wof-product-search-dropdown">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="wof-product-search-option"
                  onMouseDown={(e: any) => { e.preventDefault(); addProduct(s); }}
                >
                  {s.image ? <img src={s.image} alt="" className="wof-product-search-option__thumb" /> : <WooptionsFic.Components.Dashicon name="format-image" />}
                  <span className="wof-product-search-option__label">{s.label}</span>
                  <span className="wof-product-search-option__meta">{s.meta}</span>
                  {s.isVariable ? <span className="wof-product-search-option__badge">{__('Variable', 'wooptionsfic')}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Merge Variation Products */}
        <ToggleControl
          label={__('Merge Variation Products into one product', 'wooptionsfic')}
          checked={mergeVariations}
          onChange={(val: boolean) => props.onChange({ ...props.field, mergeVariationProducts: val })}
        />

        {/* Allow Multiple Choices */}
        <ToggleControl
          label={__('Allow Multiple Choices', 'wooptionsfic')}
          checked={Boolean(props.field.multiple)}
          onChange={(val: boolean) => props.onChange({ ...props.field, multiple: val })}
        />
        {props.field.multiple ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            <TextControl
              label={__('Min choices', 'wooptionsfic')}
              type="number"
              value={String(props.field.minChoices ?? 0)}
              onChange={(v: string) => props.onChange({ ...props.field, minChoices: Math.max(0, parseInt(v, 10) || 0) })}
            />
            <TextControl
              label={__('Max choices', 'wooptionsfic')}
              type="number"
              value={String(props.field.maxChoices ?? 0)}
              onChange={(v: string) => props.onChange({ ...props.field, maxChoices: Math.max(0, parseInt(v, 10) || 0) })}
            />
          </div>
        ) : null}

        {/* Enable Quantity */}
        <ToggleControl
          label={__('Enable Quantity', 'wooptionsfic')}
          checked={Boolean(props.field.enableQuantity)}
          onChange={(val: boolean) => props.onChange({ ...props.field, enableQuantity: val })}
        />
        {props.field.enableQuantity ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            <TextControl
              label={__('Min quantity', 'wooptionsfic')}
              type="number"
              min={1}
              value={String(props.field.minQuantity ?? 1)}
              onChange={(v: string) => props.onChange({ ...props.field, minQuantity: Math.max(1, parseInt(v, 10) || 1) })}
            />
            <TextControl
              label={__('Max quantity', 'wooptionsfic')}
              type="number"
              min={1}
              value={String(props.field.maxQuantity ?? 100)}
              onChange={(v: string) => props.onChange({ ...props.field, maxQuantity: Math.max(0, parseInt(v, 10) || 0) })}
            />
          </div>
        ) : null}
      </div>
    );
  }


  // ─── Font Choice Editor ───────────────────────────────────────────────────

  function FontChoiceCard(props: {
    choice: WooptionsFic.ChoiceDefinition;
    index: number;
    count: number;
    isOpen: boolean;
    onToggle: () => void;
    onUpdate: (patch: Partial<WooptionsFic.ChoiceDefinition>) => void;
    onRemove: () => void;
    onMove: (from: number, to: number) => void;
    onOpenCatalog: () => void;
  }): any {
    const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef<HTMLElement | null>(null);

    const dragStart = (event: any) => {
      event.stopPropagation();
      event.dataTransfer?.setData(CHOICE_INDEX_MIME, String(props.index));
      event.dataTransfer?.setData('text/plain', String(props.index));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        if (cardRef.current && event.dataTransfer.setDragImage) {
          const bounds = cardRef.current.getBoundingClientRect();
          event.dataTransfer.setDragImage(cardRef.current, event.clientX - bounds.left, event.clientY - bounds.top);
        }
      }
      setIsDragging(true);
    };

    const dragEnd = () => {
      setIsDragging(false);
      setDropEdge(null);
    };

    const dragOver = (event: any) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain')) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const element = event.currentTarget as HTMLElement;
      const bounds = element.getBoundingClientRect();
      setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
    };

    const dragLeave = (event: any) => {
      const element = event.currentTarget as HTMLElement;
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      setDropEdge(null);
    };

    const drop = (event: any) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain')) return;
      event.preventDefault();
      event.stopPropagation();
      const sourceText = event.dataTransfer?.getData(CHOICE_INDEX_MIME) || event.dataTransfer?.getData('text/plain') || '';
      const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
      setDropEdge(null);
      setIsDragging(false);

      const source = Number(sourceText);
      if (!Number.isInteger(source)) return;
      let finalIndex = insertIndex;
      if (source < insertIndex) finalIndex -= 1;
      finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
      if (finalIndex !== source) props.onMove(source, finalIndex);
    };

    const fontFamily = props.choice.fontFamily || props.choice.label;
    const primaryFontName = (props.choice.fontFamily || props.choice.label || '').split(',')[0].replace(/['"]/g, '').trim();

    return (
      <article
        ref={cardRef}
        className={WooptionsFic.Utils.classNames(
          'wof-choice-card wof-font-choice-card',
          !props.isOpen && 'is-collapsed',
          isDragging && 'is-dragging',
          dropEdge === 'before' && 'is-drop-before',
          dropEdge === 'after' && 'is-drop-after'
        )}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
      >
        <header className="wof-choice-card__header">
          <button
            type="button"
            draggable
            className="wof-choice-drag-handle"
            onDragStart={dragStart}
            onDragEnd={dragEnd}
            aria-label={__('Drag to reorder', 'wooptionsfic')}
            title={__('Drag to reorder', 'wooptionsfic')}
          >
            <WooptionsFic.Components.GripIcon />
            <div className="wof-font-card-header-info">
              <span className="wof-font-card-name" style={{ fontFamily: fontFamily || 'inherit' }}>
                {primaryFontName || props.choice.label || __('Untitled Font', 'wooptionsfic')}
              </span>
              {props.choice.fontCategory ? (
                <span className="wof-font-category-tag">{props.choice.fontCategory}</span>
              ) : null}
              {props.choice.default ? (
                <span className="wof-badge-default-font">{__('Default', 'wooptionsfic')}</span>
              ) : null}
            </div>
          </button>
          <div className="wof-choice-header-actions">
            <button
              type="button"
              className="wof-choice-accordion-toggle"
              onClick={props.onToggle}
              aria-expanded={props.isOpen}
              title={props.isOpen ? __('Collapse', 'wooptionsfic') : __('Expand', 'wooptionsfic')}
            >
              <WooptionsFic.Components.Dashicon name={props.isOpen ? 'arrow-up-alt2' : 'arrow-down-alt2'} />
            </button>
            <button
              type="button"
              className="wof-choice-delete-btn"
              onClick={props.onRemove}
              aria-label={__('Remove font', 'wooptionsfic')}
              title={__('Remove font', 'wooptionsfic')}
            >
              <WooptionsFic.Components.Dashicon name="trash" />
            </button>
          </div>
        </header>

        {!props.isOpen ? (
          <div className="wof-font-card-preview-strip" style={{ fontFamily: fontFamily || 'inherit' }}>
            Aa Bb Gg 123
          </div>
        ) : null}

        {props.isOpen ? (
          <div className="wof-choice-card__body">
            <div className="wof-font-preview-box" style={{ fontFamily: fontFamily || 'inherit' }}>
              <div className="wof-font-preview-headline">Aa Bb Gg 123</div>
              <div className="wof-font-preview-alphabet">Quick brown fox · 0123456789</div>
            </div>

            {/* Interactive Font Picker Selector (Replaces manual CSS font-family typing) */}
            <div className="wof-font-selector-field" style={{ marginBottom: '14px' }}>
              <label className="components-base-control__label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                {__('Font Family', 'wooptionsfic')}
              </label>
              <div
                className="wof-font-selector-trigger"
                onClick={props.onOpenCatalog}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onOpenCatalog(); } }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={__('Click to select or change font from catalog', 'wooptionsfic')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: fontFamily || 'inherit', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                    {primaryFontName || props.choice.label}
                  </span>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>
                    {props.choice.fontCategory || 'Font'}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--wof-admin-primary, #5b4ff5)', fontWeight: 600 }}>
                  {__('Change…', 'wooptionsfic')}
                </span>
              </div>
            </div>

            <TextControl
              label={__('Customer Display Label', 'wooptionsfic')}
              value={props.choice.label}
              help={__('Label displayed to customers in the dropdown (e.g. "Dancing Script" or "Modern Sans").', 'wooptionsfic')}
              onChange={(label: string) => props.onUpdate({ label })}
            />

            <div className="wof-choice-pricing-row">
              <SelectControl
                label={__('Price adjustment', 'wooptionsfic')}
                value={props.choice.pricing.strategy}
                options={[
                  { label: __('No extra charge', 'wooptionsfic'), value: 'none' },
                  { label: __('Fixed fee', 'wooptionsfic'), value: 'fixed' },
                  { label: __('Percentage', 'wooptionsfic'), value: 'percentage' },
                ]}
                onChange={(strategy: WooptionsFic.PricingDefinition['strategy']) =>
                  props.onUpdate({ pricing: { ...props.choice.pricing, strategy } })
                }
              />
              {props.choice.pricing.strategy === 'percentage' ? (
                <TextControl
                  label={__('Percent', 'wooptionsfic')}
                  type="number"
                  value={props.choice.pricing.percent}
                  onChange={(percent: string) =>
                    props.onUpdate({ pricing: { ...props.choice.pricing, percent } })
                  }
                />
              ) : props.choice.pricing.strategy !== 'none' ? (
                <TextControl
                  label={__('Amount', 'wooptionsfic')}
                  type="number"
                  value={props.choice.pricing.amount}
                  onChange={(amount: string) =>
                    props.onUpdate({ pricing: { ...props.choice.pricing, amount } })
                  }
                />
              ) : null}
            </div>

            <div className="wof-choice-toggles-row">
              <ToggleControl
                label={__('Default font', 'wooptionsfic')}
                checked={props.choice.default}
                onChange={(val: boolean) => props.onUpdate({ default: val })}
              />
              <ToggleControl
                label={__('Disable font', 'wooptionsfic')}
                checked={props.choice.disabled}
                onChange={(val: boolean) => props.onUpdate({ disabled: val })}
              />
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  function FontChoiceEditor(props: {
    field: WooptionsFic.FieldDefinition;
    onChange: (field: WooptionsFic.FieldDefinition) => void;
  }): any {
    const choices = props.field.choices ?? [];
    const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [replacingChoiceUuid, setReplacingChoiceUuid] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const catalog: WooptionsFic.FontCatalogItem[] = (window as any).WooptionsFicAdmin?.fontCatalog ?? [];

    const toggleChoice = (uuid: string) => {
      setCollapsedMap((prev) => ({ ...prev, [uuid]: !prev[uuid] }));
    };

    const isAllCollapsed = choices.length > 0 && choices.every((c) => Boolean(collapsedMap[c.uuid]));

    const toggleAll = () => {
      const nextState = !isAllCollapsed;
      const nextMap: Record<string, boolean> = {};
      choices.forEach((c) => {
        nextMap[c.uuid] = nextState;
      });
      setCollapsedMap(nextMap);
    };

    const updateChoice = (uuid: string, patch: Partial<WooptionsFic.ChoiceDefinition>) => {
      let nextChoices = choices.map((c) => {
        if (c.uuid === uuid) {
          return { ...c, ...patch };
        }
        if (patch.default) {
          return { ...c, default: false };
        }
        return c;
      });
      props.onChange({ ...props.field, choices: nextChoices });
    };

    const removeChoice = (uuid: string) => {
      props.onChange({
        ...props.field,
        choices: choices.filter((c) => c.uuid !== uuid),
      });
    };

    const moveChoice = (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= choices.length || to >= choices.length) return;
      const reordered = [...choices];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      props.onChange({ ...props.field, choices: reordered });
    };

    const addCatalogFont = (item: WooptionsFic.FontCatalogItem) => {
      if (choices.some((c) => c.label.toLowerCase() === item.name.toLowerCase())) {
        return;
      }
      const newChoice: WooptionsFic.ChoiceDefinition = {
        uuid: WooptionsFic.Utils.uuid(),
        label: item.name,
        description: '',
        adminLabel: '',
        color: '',
        imageId: 0,
        imageUrl: '',
        disabled: false,
        default: choices.length === 0,
        pricing: WooptionsFic.FieldFactory.emptyPricing(),
        quantityEnabled: false,
        linkedProductId: 0,
        linkedVariationId: 0,
        linkedQuantity: 1,
        preview: {},
        fontFamily: item.family,
        fontCategory: item.category,
        fontSource: item.source,
      };
      props.onChange({
        ...props.field,
        choices: [...choices, newChoice],
      });
      setCollapsedMap((prev) => ({ ...prev, [newChoice.uuid]: true }));
    };

    const selectFontFromModal = (item: WooptionsFic.FontCatalogItem) => {
      if (replacingChoiceUuid) {
        const choice = choices.find((c) => c.uuid === replacingChoiceUuid);
        if (choice) {
          const oldPrimary = (choice.fontFamily || choice.label).split(',')[0].replace(/['"]/g, '').trim();
          const patch: Partial<WooptionsFic.ChoiceDefinition> = {
            fontFamily: item.family,
            fontCategory: item.category,
            fontSource: item.source,
          };
          if (!choice.label || choice.label === oldPrimary || choice.label === 'Choice' || choice.label === 'Modern sans' || choice.label === 'Classic serif' || choice.label === 'Soft script') {
            patch.label = item.name;
          }
          updateChoice(replacingChoiceUuid, patch);
          setReplacingChoiceUuid(null);
          setShowCatalogModal(false);
          WooptionsFic.Toast.success(__('Font updated to ', 'wooptionsfic') + item.name);
          return;
        }
      }
      addCatalogFont(item);
    };

    const categories = useMemo(() => {
      const set = new Set<string>();
      catalog.forEach((f) => {
        if (f.category) set.add(f.category);
      });
      const list = Array.from(set);
      const hasCustom = list.includes('Custom');
      const rest = list.filter((c) => c !== 'Custom');
      return ['all', ...(hasCustom ? ['Custom'] : []), ...rest];
    }, [catalog]);

    const filteredCatalog = useMemo(() => {
      return catalog.filter((item) => {
        const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
        const matchesQuery = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesQuery;
      });
    }, [catalog, categoryFilter, searchQuery]);

    // Dynamically load Google WebFonts for configured choices in admin document head
    useEffect(() => {
      const gFonts = choices
        .filter((c) => c.fontSource !== 'system')
        .map((c) => {
          const primary = (c.fontFamily || c.label || '').split(',')[0].replace(/['"]/g, '').trim();
          const found = catalog.find((item) => item.name.toLowerCase() === primary.toLowerCase() || item.name.toLowerCase() === c.label.toLowerCase());
          if (found && found.source === 'system') return '';
          if (found && found.googleParam) return found.googleParam;
          const clean = (primary || c.label).replace(/[^a-zA-Z0-9 ]/g, '').replace(/ /g, '+');
          return clean ? `${clean}:wght@400;700` : '';
        })
        .filter(Boolean);
      if (gFonts.length > 0) {
        const id = 'wof-builder-google-fonts';
        let link = document.getElementById(id) as HTMLLinkElement;
        const href = 'https://fonts.googleapis.com/css2?' + Array.from(new Set(gFonts)).map(f => 'family=' + f).join('&') + '&display=swap';
        if (!link) {
          link = document.createElement('link');
          link.id = id;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        } else if (link.href !== href) {
          link.href = href;
        }
      }
    }, [choices, catalog]);

    // Also load catalog fonts into admin document head when modal opens
    useEffect(() => {
      if (showCatalogModal) {
        const catFonts = catalog
          .filter((f) => f.source !== 'system' && f.googleParam)
          .map((f) => f.googleParam);
        if (catFonts.length > 0) {
          const id = 'wof-builder-catalog-fonts';
          let link = document.getElementById(id) as HTMLLinkElement;
          const href = 'https://fonts.googleapis.com/css2?' + catFonts.map(f => 'family=' + f).join('&') + '&display=swap';
          if (!link) {
            link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
          }
        }
      }
    }, [showCatalogModal, catalog]);

    return (
      <div className="wof-choice-editor-list wof-font-choice-editor">
        <div style={{ marginBottom: '14px' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
            {__('Select which specific fonts are available for customers in this Font Choice field. Only the fonts you add below will be loaded.', 'wooptionsfic')}
          </p>
        </div>

        {/* Toolbar */}
        <div className="wof-choice-list-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span className="wof-choice-list-count" style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>
            {choices.length} {__('Available Fonts', 'wooptionsfic')}
          </span>
          {choices.length > 1 ? (
            <button
              type="button"
              className="wof-choice-collapse-all-btn"
              onClick={toggleAll}
            >
              {isAllCollapsed ? __('Expand all', 'wooptionsfic') : __('Collapse all', 'wooptionsfic')}
            </button>
          ) : null}
        </div>

        {/* Font choice cards */}
        {choices.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '14px' }}>
            <p style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '13px' }}>
              {__('No fonts added yet. Click "+ Add Fonts" to choose fonts from the Google Fonts catalog.', 'wooptionsfic')}
            </p>
            <Button variant="primary" onClick={() => setShowCatalogModal(true)}>
              {__('+ Add Fonts from Catalog', 'wooptionsfic')}
            </Button>
          </div>
        ) : (
          <div className="wof-font-choices-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {choices.map((choice, index) => (
              <FontChoiceCard
                key={choice.uuid}
                choice={choice}
                index={index}
                count={choices.length}
                isOpen={!collapsedMap[choice.uuid]}
                onToggle={() => toggleChoice(choice.uuid)}
                onUpdate={(patch) => updateChoice(choice.uuid, patch)}
                onRemove={() => removeChoice(choice.uuid)}
                onMove={moveChoice}
                onOpenCatalog={() => {
                  setReplacingChoiceUuid(choice.uuid);
                  setShowCatalogModal(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Action Buttons: Add Fonts from Catalog */}
        <div style={{ marginBottom: '16px' }}>
          <Button
            variant="primary"
            onClick={() => {
              setReplacingChoiceUuid(null);
              setShowCatalogModal(true);
            }}
            style={{ width: '100%', minHeight: '38px', justifyContent: 'center' }}
          >
            <WooptionsFic.Components.Dashicon name="plus-alt2" />
            {__('Select Fonts from Catalog…', 'wooptionsfic')}
          </Button>
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b', textAlign: 'center', lineHeight: 1.4 }}>
            {__('Need custom brand fonts? Upload .woff2, .woff, .ttf, or .otf files in WooptionsFic → Settings → Custom Fonts.', 'wooptionsfic')}
          </p>
        </div>

        {/* Modal: Font Catalog Picker (uses wp.components.Modal to fix stacking context / bleed-through) */}
        {showCatalogModal ? (
          <Modal
            title={replacingChoiceUuid ? __('Select Replacement Font', 'wooptionsfic') : __('Select Fonts to Make Available', 'wooptionsfic')}
            onRequestClose={() => {
              setShowCatalogModal(false);
              setReplacingChoiceUuid(null);
            }}
            className="wof-font-catalog-modal"
          >
            <div className="wof-font-catalog-modal-content">
              <div className="wof-font-catalog-modal-header-section">
                <p className="wof-font-catalog-modal-subtitle" style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>
                  {replacingChoiceUuid
                    ? __('Select a font from the catalog to replace this choice. Google, System, and Custom fonts are supported.', 'wooptionsfic')
                    : __('Click any font to make it available for customers. Only enabled fonts will be downloaded by customers.', 'wooptionsfic')}
                </p>

                <div className="wof-font-catalog-toolbar">
                  <input
                    type="text"
                    className="wof-font-search-input"
                    placeholder={__('Search fonts (e.g. Dancing Script, Roboto)…', 'wooptionsfic')}
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <div className="wof-font-category-chips">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={WooptionsFic.Utils.classNames('wof-font-category-chip', categoryFilter === cat && 'is-active')}
                        onClick={() => setCategoryFilter(cat)}
                      >
                        {cat === 'all' ? __('All Categories', 'wooptionsfic') : cat}
                        {cat === 'Custom' ? ` (${catalog.filter((f) => f.category === 'Custom').length})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wof-font-catalog-grid">
                {filteredCatalog.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>{__('No fonts found matching your search.', 'wooptionsfic')}</p>
                    {categoryFilter === 'Custom' ? (
                      <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                        {__('You can upload custom .woff2, .woff, .ttf, or .otf font files in WooptionsFic → Settings → Custom Fonts.', 'wooptionsfic')}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  filteredCatalog.map((item) => {
                    const isAdded = choices.some((c) => (c.fontFamily || c.label).toLowerCase().includes(item.name.toLowerCase()));
                    return (
                      <div
                        key={item.id}
                        className={WooptionsFic.Utils.classNames('wof-font-catalog-card', isAdded && !replacingChoiceUuid && 'is-added')}
                        onClick={() => selectFontFromModal(item)}
                      >
                        <div className="wof-font-catalog-card-header">
                          <span className="wof-font-catalog-card-name">{item.name}</span>
                          <span className="wof-font-category-tag">{item.category}</span>
                        </div>
                        <div className="wof-font-catalog-card-sample" style={{ fontFamily: item.family }}>
                          Aa Bb Gg 123
                        </div>
                        <div className="wof-font-catalog-card-footer">
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {item.source === 'system'
                              ? __('System Font', 'wooptionsfic')
                              : item.source === 'custom'
                                ? __('Custom Uploaded Font', 'wooptionsfic')
                                : __('Google WebFont', 'wooptionsfic')}
                          </span>
                          <button
                            type="button"
                            className="wof-font-catalog-card-btn"
                            disabled={isAdded && !replacingChoiceUuid}
                          >
                            {replacingChoiceUuid
                              ? __('Select Font →', 'wooptionsfic')
                              : isAdded
                                ? __('Added ✓', 'wooptionsfic')
                                : __('+ Select', 'wooptionsfic')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <footer className="wof-font-catalog-modal-footer">
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {choices.length} {__('font(s) selected for this field', 'wooptionsfic')}
                </span>
                <Button variant="primary" onClick={() => { setShowCatalogModal(false); setReplacingChoiceUuid(null); }}>
                  {__('Done Selecting', 'wooptionsfic')}
                </Button>
              </footer>
            </div>
          </Modal>
        ) : null}
      </div>
    );
  }


  function ChoiceEditor(props: { field: WooptionsFic.FieldDefinition; onChange: (field: WooptionsFic.FieldDefinition) => void }): any {
    // Product fields use their own dedicated editor.
    if (props.field.type === 'product') {
      return <ProductChoiceEditor field={props.field} onChange={props.onChange} />;
    }
    // Font fields use their own dedicated font manager editor.
    if (props.field.type === 'font') {
      return <FontChoiceEditor field={props.field} onChange={props.onChange} />;
    }

    const choices = props.field.choices ?? [];
    const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

    const toggleChoice = (uuid: string) => {
      setCollapsedMap((prev) => ({ ...prev, [uuid]: !prev[uuid] }));
    };

    const isAllCollapsed = choices.length > 0 && choices.every((c) => Boolean(collapsedMap[c.uuid]));

    const toggleAll = () => {
      const nextState = !isAllCollapsed;
      const nextMap: Record<string, boolean> = {};
      choices.forEach((c) => {
        nextMap[c.uuid] = nextState;
      });
      setCollapsedMap(nextMap);
    };

    const updateChoice = (uuid: string, patch: Partial<WooptionsFic.ChoiceDefinition>) => props.onChange({
      ...props.field,
      choices: choices.map((choice) => choice.uuid === uuid ? { ...choice, ...patch } : choice),
    });
    const removeChoice = (uuid: string) => props.onChange({
      ...props.field,
      choices: choices.filter((choice) => choice.uuid !== uuid),
    });
    const addChoice = () => {
      const newChoice = WooptionsFic.FieldFactory.choice(`Choice ${choices.length + 1}`, choices.length);
      props.onChange({
        ...props.field,
        choices: [...choices, newChoice],
      });
      setCollapsedMap((prev) => ({ ...prev, [newChoice.uuid]: false }));
    };
    const moveChoice = (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= choices.length || to >= choices.length) return;
      const reordered = [...choices];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      props.onChange({ ...props.field, choices: reordered });
    };

    if (!props.field.choices) return <p className="wof-muted-note">{__('This element has no choices.', 'wooptionsfic')}</p>;

    return (
      <div className="wof-choice-editor-list">
        {/* Display Direction option for Button Choices (segmented) */}
        {props.field.type === 'segmented' ? (
          <div className="wof-field-width-setting">
            <span className="wof-field-width-label">{__('Display Direction', 'wooptionsfic')}</span>
            <div className="wof-field-width-group" role="radiogroup" aria-label={__('Display Direction', 'wooptionsfic')}>
              {(['vertical', 'horizontal'] as const).map((dir) => {
                const isSelected = (props.field.displayDirection || 'horizontal') === dir;
                return (
                  <button
                    type="button"
                    key={dir}
                    role="radio"
                    aria-checked={isSelected}
                    className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                    onClick={() => props.onChange({ ...props.field, displayDirection: dir })}
                  >
                    {dir === 'horizontal' ? __('Horizontal', 'wooptionsfic') : __('Vertical', 'wooptionsfic')}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* IMAGE STYLES for image_swatch, color_swatch */}
        {['image_swatch', 'color_swatch'].includes(props.field.type) ? (
          <div style={{ marginBottom: '16px' }}>
            <label className="components-base-control__label" style={{ display: 'block', marginBottom: '8px' }}>
              {__('Image Style', 'wooptionsfic')}
            </label>
            <div className="wof-image-style-cards">
              {([
                { value: 'default', label: __('Default', 'wooptionsfic'), svgTop: true, svgBottom: true },
                { value: 'overlay', label: __('Image overlay', 'wooptionsfic'), svgTop: false, svgBottom: false },
                { value: 'only_image', label: __('Only Image', 'wooptionsfic'), svgTop: false, svgBottom: false },
              ] as const).map((st) => {
                const currentStyle = props.field.imageStyle || 'default';
                const isSelected = currentStyle === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    className={WooptionsFic.Utils.classNames('wof-image-style-card', isSelected && 'is-active')}
                    onClick={() => props.onChange({ ...props.field, imageStyle: st.value })}
                    title={st.label}
                  >
                    <span className="wof-image-style-card__preview">
                      <svg viewBox="0 0 60 45" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <rect x="1" y="1" width="58" height="43" rx="5" fill="#e8ecf0" stroke="#c8d0da" strokeWidth="1" />
                        <rect x="8" y="7" width="44" height="24" rx="3" fill="#b4bfcb" />
                        <circle cx="18" cy="19" r="5" fill="#8e9db0" />
                        <polygon points="14,28 24,15 32,24 38,18 52,31 8,31" fill="#9eb0c2" />
                        {st.value === 'overlay' ? (
                          <>
                            <rect x="8" y="21" width="44" height="10" rx="0" fill="rgba(0,0,0,0.45)" />
                            <rect x="12" y="23" width="20" height="3" rx="1.5" fill="#fff" opacity="0.8" />
                            <rect x="12" y="27" width="14" height="2" rx="1" fill="#fff" opacity="0.5" />
                          </>
                        ) : null}
                        {st.svgBottom ? (
                          <rect x="12" y="36" width="20" height="3" rx="1.5" fill="#b4bfcb" />
                        ) : null}
                      </svg>
                    </span>
                    <span className="wof-image-style-card__label">{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Columns and Image Style for Radio, Checkbox Group, and Dropdown */}
        {['radio', 'checkbox_group'].includes(props.field.type) ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
              <span className="wof-field-width-label">{__('Columns', 'wooptionsfic')}</span>
              <div className="wof-field-width-group" role="radiogroup" aria-label={__('Columns', 'wooptionsfic')}>
                {([
                  { label: __('One', 'wooptionsfic'), value: 'one' },
                  { label: __('Two', 'wooptionsfic'), value: 'two' },
                ] as const).map((col) => {
                  const isSelected = (props.field.columns || 'one') === col.value;
                  return (
                    <button
                      type="button"
                      key={col.value}
                      role="radio"
                      aria-checked={isSelected}
                      className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                      onClick={() => props.onChange({ ...props.field, columns: col.value })}
                    >
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
              <span className="wof-field-width-label">{__('Image Style', 'wooptionsfic')}</span>
              <div className="wof-field-width-group" role="radiogroup" aria-label={__('Image Style', 'wooptionsfic')}>
                {([
                  { label: __('Normal', 'wooptionsfic'), value: 'normal' },
                  { label: __('Circle', 'wooptionsfic'), value: 'circle' },
                ] as const).map((st) => {
                  const isSelected = (props.field.imageStyle || 'normal') === st.value;
                  return (
                    <button
                      type="button"
                      key={st.value}
                      role="radio"
                      aria-checked={isSelected}
                      className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                      onClick={() => props.onChange({ ...props.field, imageStyle: st.value })}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : props.field.type === 'select' ? (
          <div style={{ marginBottom: '18px' }}>
            <div className="wof-field-width-setting" style={{ marginBottom: 0 }}>
              <span className="wof-field-width-label">{__('Image Style', 'wooptionsfic')}</span>
              <div className="wof-field-width-group" role="radiogroup" aria-label={__('Image Style', 'wooptionsfic')}>
                {([
                  { label: __('Normal', 'wooptionsfic'), value: 'normal' },
                  { label: __('Circle', 'wooptionsfic'), value: 'circle' },
                ] as const).map((st) => {
                  const isSelected = (props.field.imageStyle || 'normal') === st.value;
                  return (
                    <button
                      type="button"
                      key={st.value}
                      role="radio"
                      aria-checked={isSelected}
                      className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                      onClick={() => props.onChange({ ...props.field, imageStyle: st.value })}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {props.field.type === 'image_swatch' ? <div className="wof-image-swatch-behavior">
          <ToggleControl
            label={__('Update product image on selection', 'wooptionsfic')}
            help={__('Replace the main WooCommerce product image with the selected swatch image.', 'wooptionsfic')}
            checked={Boolean(props.field.updateProductImage)}
            onChange={(updateProductImage: boolean) => props.onChange({ ...props.field, updateProductImage })}
          />
        </div> : null}

        {choices.length > 1 ? (
          <div className="wof-choice-list-toolbar">
            <span className="wof-choice-list-count">{choices.length} {__('Choices', 'wooptionsfic')}</span>
            <button
              type="button"
              className="wof-choice-collapse-all-btn"
              onClick={toggleAll}
            >
              {isAllCollapsed ? __('Expand all', 'wooptionsfic') : __('Collapse all', 'wooptionsfic')}
            </button>
          </div>
        ) : null}

        {choices.map((choice, index) => (
          <ChoiceItemCard
            key={choice.uuid}
            choice={choice}
            index={index}
            count={choices.length}
            fieldType={props.field.type}
            isOpen={!collapsedMap[choice.uuid]}
            onToggle={() => toggleChoice(choice.uuid)}
            onUpdate={(patch) => updateChoice(choice.uuid, patch)}
            onRemove={() => removeChoice(choice.uuid)}
            onMove={moveChoice}
          />
        ))}
        <Button variant="secondary" onClick={addChoice}><WooptionsFic.Components.Dashicon name="plus-alt2" />{__('Add choice', 'wooptionsfic')}</Button>
      </div>
    );
  }

  function FormulaPanel(props: {
    field: WooptionsFic.FieldDefinition;
    allFields: WooptionsFic.FieldDefinition[];
    onChange: (field: WooptionsFic.FieldDefinition) => void;
  }): any {
    const { field, allFields, onChange } = props;
    const update = (patch: Partial<WooptionsFic.FieldDefinition>) => onChange({ ...field, ...patch });
    const exprRef = useRef<HTMLTextAreaElement | null>(null);

    const [testResult, setTestResult] = useState<{ value?: string; error?: string } | null>(null);
    const [testing, setTesting] = useState(false);
    const [refOpen, setRefOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const activeDropdownRef = useRef<HTMLDivElement | null>(null);

    // Event delegation: close open dropdown on click outside
    useEffect(() => {
      if (!openDropdown) return;
      const onDocClick = (e: any) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('.wof-dv-wrap') && !target?.closest('.wof-dv-portal')) {
          setOpenDropdown(null);
          setDropdownPos(null);
        }
      };
      document.addEventListener('mousedown', onDocClick);
      return () => {
        document.removeEventListener('mousedown', onDocClick);
      };
    }, [openDropdown]);

    // Close dropdown on window/sidebar scroll to avoid detached floating menus
    useEffect(() => {
      if (!openDropdown) return;
      const onScroll = () => {
        setOpenDropdown(null);
        setDropdownPos(null);
      };
      window.addEventListener('scroll', onScroll, true);
      return () => {
        window.removeEventListener('scroll', onScroll, true);
      };
    }, [openDropdown]);

    // Keep dropdown inside screen boundaries
    useEffect(() => {
      if (!openDropdown || !activeDropdownRef.current) return;
      const el = activeDropdownRef.current;
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        el.classList.add('is-align-right');
      } else {
        el.classList.remove('is-align-right');
      }
    }, [openDropdown]);

    // Sub-panel boundary check: dynamically adjust orientation to stay within viewport
    const handleSubMouseEnter = (e: any) => {
      const item = e.currentTarget as HTMLElement;
      const sub = item.querySelector(':scope > .wof-dv-sub-panel') as HTMLElement | null;
      if (!sub) return;
      const itemRect = item.getBoundingClientRect();
      const subWidth = 180;
      if (itemRect.left - subWidth < 10) {
        sub.style.left = '100%';
        sub.style.right = 'auto';
        sub.style.marginLeft = '3px';
        sub.style.marginRight = '0';
      } else {
        sub.style.left = 'auto';
        sub.style.right = '100%';
        sub.style.marginLeft = '0';
        sub.style.marginRight = '3px';
      }
      const subHeight = sub.offsetHeight || 150;
      if (itemRect.top + subHeight > window.innerHeight - 10) {
        sub.style.top = 'auto';
        sub.style.bottom = '-4px';
      } else {
        sub.style.top = '-4px';
        sub.style.bottom = 'auto';
      }
    };

    // Insert text at the current cursor position in the expression textarea.
    const insertAtCursor = (text: string) => {
      const el = exprRef.current;
      const current = field.expression ?? '0';
      if (!el) {
        const next = current === '0' || current === '' ? text : current + text;
        update({ expression: next });
        return;
      }
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      let next = '';
      let newCursorPos = 0;
      if ((current === '0' || current === '') && (start === 0 && end <= 1)) {
        next = text;
        newCursorPos = text.length;
      } else {
        next = current.slice(0, start) + text + current.slice(end);
        newCursorPos = start + text.length;
      }
      update({ expression: next });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    };

    const testExpression = async () => {
      setTesting(true);
      setTestResult(null);
      try {
        const result = await WooptionsFic.Api.request<{ result: string }>('/test-formula', {
          method: 'POST',
          data: {
            expression: field.expression ?? '0',
            fields: allFields.map((f) => ({
              uuid: f.uuid,
              type: f.type,
              label: f.label || f.type,
              name: (f as any).name || '',
              default: f.default ?? '10',
              choices: (f as any).choices ?? (f as any).options ?? [],
              pricing: f.pricing ?? {},
              enableQuantity: Boolean((f as any).enableQuantity),
            })),
            context: {
              basePrice: '100',
              quantity: 1,
            },
          },
        });
        setTestResult({ value: result.result });
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        setTestResult({ error: msg.replace(/^wooptionsfic_formula_?/, '').replace(/_/g, ' ') });
      } finally {
        setTesting(false);
      }
    };

    // Sibling fields that can be referenced with [Field Label] or FIELD("uuid").
    const siblingFields = allFields.filter(
      (f) => f.uuid !== field.uuid && !['formula', 'heading', 'paragraph', 'help', 'separator', 'spacer', 'content', 'modal'].includes(f.type)
    );

    const FUNCTION_REF = [
      { name: 'IF(cond, true, false)', stub: 'IF(, , )' },
      { name: 'FIELD("uuid")', stub: 'FIELD("")' },
      { name: 'ROUND(n, places)', stub: 'ROUND(, 2)' },
      { name: 'ABS(n)', stub: 'ABS()' },
      { name: 'CEIL(n)', stub: 'CEIL()' },
      { name: 'FLOOR(n)', stub: 'FLOOR()' },
      { name: 'MIN(a, b, …)', stub: 'MIN(, )' },
      { name: 'MAX(a, b, …)', stub: 'MAX(, )' },
      { name: 'POW(base, exp)', stub: 'POW(, 2)' },
      { name: 'SUM(rows, "field")', stub: 'SUM(rows, "")' },
      { name: 'AVG(rows, "field")', stub: 'AVG(rows, "")' },
      { name: 'COUNT(rows)', stub: 'COUNT(rows)' },
    ];

    // Readable slug: spaces → underscores
    const toSlug = (s: string) => (s || '').trim().replace(/\s+/g, '_');

    // Build readable token: [FieldLabel.property]
    const fieldToken = (f: WooptionsFic.FieldDefinition, prop: string) =>
      `[${toSlug(f.label || f.type)}.${prop}]`;

    // Build readable option token: [FieldLabel.options.ChoiceLabel.prop]
    const optionToken = (f: WooptionsFic.FieldDefinition, choiceLabel: string, prop: string) =>
      `[${toSlug(f.label || f.type)}.options.${toSlug(choiceLabel)}.${prop}]`;

    // Dynamic values per field type — token is the readable shortcode key (prop only, field prefix applied at render)
    type DynValue = { label: string; prop: string; isOptions?: boolean };
    const DYNAMIC_VALUES: Record<string, DynValue[]> = {
      checkbox: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If none selected', prop: 'selected-none' },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'If all selected', prop: 'selected-all' },
        { label: 'Count selected', prop: 'count-selected' },
        { label: 'Min selected formula value', prop: 'min-formula' },
        { label: 'Max selected formula value', prop: 'max-formula' },
        { label: 'Sum of selected value', prop: 'sum-formula' },
        { label: 'Total quantity', prop: 'total-qty' },
      ],
      checkbox_group: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If none selected', prop: 'selected-none' },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'If all selected', prop: 'selected-all' },
        { label: 'Count selected', prop: 'count-selected' },
        { label: 'Min selected formula value', prop: 'min-formula' },
        { label: 'Max selected formula value', prop: 'max-formula' },
        { label: 'Sum of selected value', prop: 'sum-formula' },
        { label: 'Total quantity', prop: 'total-qty' },
      ],
      image_swatch: [
        { label: 'Images', prop: '', isOptions: true },
        { label: 'If none selected', prop: 'selected-none' },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'If all selected', prop: 'selected-all' },
        { label: 'Count selected', prop: 'count-selected' },
        { label: 'Min selected formula value', prop: 'min-formula' },
        { label: 'Max selected formula value', prop: 'max-formula' },
        { label: 'Sum of selected value', prop: 'sum-formula' },
        { label: 'Total quantity', prop: 'total-qty' },
      ],
      color_swatch: [
        { label: 'Colors', prop: '', isOptions: true },
        { label: 'If none selected', prop: 'selected-none' },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'If all selected', prop: 'selected-all' },
        { label: 'Count selected', prop: 'count-selected' },
        { label: 'Min selected formula value', prop: 'min-formula' },
        { label: 'Max selected formula value', prop: 'max-formula' },
        { label: 'Sum of selected value', prop: 'sum-formula' },
        { label: 'Total quantity', prop: 'total-qty' },
      ],
      radio: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'Selected formula value', prop: 'selected-formula' },
        { label: 'Quantity', prop: 'qty' },
      ],
      select: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'Selected formula value', prop: 'selected-formula' },
      ],
      segmented: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If none selected', prop: 'selected-none' },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'If all selected', prop: 'selected-all' },
        { label: 'Count selected', prop: 'count-selected' },
        { label: 'Min selected formula value', prop: 'min-formula' },
        { label: 'Max selected formula value', prop: 'max-formula' },
        { label: 'Sum of selected value', prop: 'sum-formula' },
      ],
      button: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If none selected', prop: 'selected-none' },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'If all selected', prop: 'selected-all' },
        { label: 'Count selected', prop: 'count-selected' },
        { label: 'Min selected formula value', prop: 'min-formula' },
        { label: 'Max selected formula value', prop: 'max-formula' },
        { label: 'Sum of selected value', prop: 'sum-formula' },
      ],
      product: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If none selected', prop: 'selected-none' },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'If all selected', prop: 'selected-all' },
        { label: 'Count selected', prop: 'count-selected' },
        { label: 'Min selected formula value', prop: 'min-formula' },
        { label: 'Max selected formula value', prop: 'max-formula' },
        { label: 'Sum of selected value', prop: 'sum-formula' },
        { label: 'Total quantity', prop: 'total-qty' },
      ],
      font: [
        { label: 'Options', prop: '', isOptions: true },
        { label: 'If any selected', prop: 'selected-any' },
        { label: 'Selected formula value', prop: 'selected-formula' },
      ],
      date: [
        { label: 'Days from today', prop: 'days-from-today' },
        { label: 'Year', prop: 'year' },
        { label: 'Month (1–12)', prop: 'month' },
        { label: 'Day (1–31)', prop: 'day' },
        { label: 'Weekday (Mon:1, Sun:7)', prop: 'weekday' },
      ],
      datetime: [
        { label: 'Days from today', prop: 'days-from-today' },
        { label: 'Year', prop: 'year' },
        { label: 'Month (1–12)', prop: 'month' },
        { label: 'Day (1–31)', prop: 'day' },
        { label: 'Weekday (Mon:1, Sun:7)', prop: 'weekday' },
      ],
      date_range: [
        { label: 'Days from today', prop: 'days-from-today' },
        { label: 'Year', prop: 'year' },
        { label: 'Month (1–12)', prop: 'month' },
        { label: 'Day (1–31)', prop: 'day' },
      ],
      switch: [
        { label: 'Selected', prop: 'selected' },
        { label: 'Formula Value', prop: 'formula-value' },
        { label: 'Quantity', prop: 'qty' },
      ],
      toggle: [
        { label: 'Selected', prop: 'selected' },
        { label: 'Formula Value', prop: 'formula-value' },
        { label: 'Quantity', prop: 'qty' },
      ],
      email: [
        { label: 'Character count', prop: 'char-count' },
        { label: 'Word count', prop: 'word-count' },
      ],
      textarea: [
        { label: 'Character count', prop: 'char-count' },
        { label: 'Word count', prop: 'word-count' },
      ],
      text: [
        { label: 'Character count', prop: 'char-count' },
        { label: 'Word count', prop: 'word-count' },
      ],
      url: [
        { label: 'Character count', prop: 'char-count' },
        { label: 'Word count', prop: 'word-count' },
      ],
      tel: [
        { label: 'Character count', prop: 'char-count' },
        { label: 'Word count', prop: 'word-count' },
      ],
      range: [
        { label: 'Range value', prop: 'value' },
      ],
      number: [
        { label: 'Number value', prop: 'value' },
      ],
      customer_defined_price: [
        { label: 'Price value', prop: 'value' },
      ],
      upload: [
        { label: 'File count', prop: 'value' },
      ],
      file: [
        { label: 'File count', prop: 'value' },
      ],
    };

    const getDynamicValues = (f: WooptionsFic.FieldDefinition): DynValue[] => {
      const t = f.type;
      let values =
        DYNAMIC_VALUES[t] ??
        DYNAMIC_VALUES[t.replace('-', '_')] ??
        [{ label: f.label || f.type, prop: 'value' }];

      // Safety: If this field is a choice type or has choices configured, ensure an 'Options' entry is present
      const isChoiceField = ['select', 'radio', 'checkbox_group', 'checkbox', 'segmented', 'button', 'color_swatch', 'image_swatch', 'product', 'font'].includes(t);
      const choices = (f as any).choices ?? (f as any).options ?? [];
      if ((isChoiceField || choices.length > 0) && !values.some((v) => v.isOptions)) {
        values = [{ label: 'Options', prop: '', isOptions: true }, ...values];
      }
      return values;
    };

    // Per-choice option sub-items: Option Price, Checked, Quantity (type-aware)
    const getChoiceOptionProps = (fieldType: string): { label: string; prop: string }[] => {
      if (['radio', 'select', 'font'].includes(fieldType)) {
        return [
          { label: 'Option Price', prop: 'formula' },
          { label: 'Checked', prop: 'checked' },
        ];
      }
      return [
        { label: 'Option Price', prop: 'formula' },
        { label: 'Checked', prop: 'checked' },
        { label: 'Quantity', prop: 'qty' },
      ];
    };

    const getFieldChoices = (f: WooptionsFic.FieldDefinition): any[] =>
      (f as any).choices ?? (f as any).options ?? [];

    return (
      <div className="wof-formula-panel">
        {/* ── Field Settings: Label, Help text, Position & Width ───── */}
        <div className="wof-formula-section">
          <TextControl
            label={__('Label', 'wooptionsfic')}
            value={field.label}
            onChange={(label: string) => update({ label })}
          />
          <TextareaControl
            label={__('Help text', 'wooptionsfic')}
            value={field.help ?? field.description ?? ''}
            onChange={(help: string) => update({ help, description: help })}
            placeholder={__('Add helpful explanation for customers…', 'wooptionsfic')}
          />
          <div className="wof-help-position-control">
            <label className="wof-segmented-label">
              {__('HELP TEXT POSITION', 'wooptionsfic')}
            </label>
            <div className="wof-segmented-group">
              {[
                { label: __('Below Title', 'wooptionsfic'), value: 'below_title' },
                { label: __('Tooltip', 'wooptionsfic'), value: 'tooltip' },
                { label: __('Below Field', 'wooptionsfic'), value: 'below_field' },
              ].map((opt) => {
                const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={WooptionsFic.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected')}
                    onClick={() => update({ helpTextPosition: opt.value as 'below_title' | 'tooltip' | 'below_field' })}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="wof-field-width-setting">
            <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
            <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
              {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                const isSelected = (field.width || '100%') === w;
                return (
                  <button
                    type="button"
                    key={w}
                    role="radio"
                    aria-checked={isSelected}
                    className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                    onClick={() => update({ width: w })}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Formula Expression ───────────────────── */}
        <div className="wof-formula-section">
          {/* Title row with Run Test button */}
          <div className="wof-formula-expr-header">
            <strong className="wof-formula-section__title">{__('Formula Expression', 'wooptionsfic')}</strong>
            <button
              type="button"
              className="wof-formula-run-test-btn"
              onClick={testExpression}
              disabled={testing}
            >
              {testing ? __('Testing…', 'wooptionsfic') : __('▶ Run Test', 'wooptionsfic')}
            </button>
          </div>
          <p className="wof-formula-hint">
            {__('Use arithmetic operators (+, -, *, /), [Field Name], IF(), and built-in functions.', 'wooptionsfic')}
          </p>
          <textarea
            ref={exprRef}
            id="wof-formula-expression"
            className="wof-formula-textarea"
            value={field.expression ?? '0'}
            rows={5}
            spellCheck={false}
            autoComplete="off"
            onChange={(e: any) => update({ expression: e.target.value })}
            aria-label={__('Formula expression', 'wooptionsfic')}
          />
          {/* Test result inline */}
          {testResult ? (
            testResult.error ? (
              <span className="wof-formula-test-result is-error">{testResult.error}</span>
            ) : (
              <span className="wof-formula-test-result is-success">{__('Result:', 'wooptionsfic')} {testResult.value}</span>
            )
          ) : null}

          {/* Dynamic Values — field token helper */}
          <div className="wof-formula-tokens">
            <span className="wof-formula-tokens__label">{__('Insert field:', 'wooptionsfic')}</span>
            <div className="wof-formula-tokens__list">
              <button
                type="button"
                className="wof-formula-token-btn"
                title={__('Base product price [product_price]', 'wooptionsfic')}
                onClick={() => insertAtCursor('[product_price]')}
              >
                <span className="wof-formula-token-text">{__('Product Price', 'wooptionsfic')}</span>
              </button>
              {siblingFields.map((f) => {
                const tokenName = f.label || f.type;
                const dynValues = getDynamicValues(f);
                const isOpen = openDropdown === f.uuid;
                const hasDynOptions = dynValues.length > 0;
                const choices = getFieldChoices(f);
                const choiceOptionProps = getChoiceOptionProps(f.type);
                return (
                  <div
                    key={f.uuid}
                    className="wof-dv-wrap"
                    onClick={(e: any) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`wof-formula-token-btn${isOpen ? ' is-open' : ''}`}
                      title={sprintf(__('Dynamic values for %s', 'wooptionsfic'), tokenName)}
                      onClick={(e: any) => {
                        if (hasDynOptions) {
                          if (isOpen) {
                            setOpenDropdown(null);
                            setDropdownPos(null);
                          } else {
                            const btn = e.currentTarget as HTMLElement;
                            const rect = btn.getBoundingClientRect();
                            const alignRight = rect.left + 230 > window.innerWidth - 10;
                            const left = alignRight ? Math.max(10, rect.right - 210) : rect.left;
                            setDropdownPos({ top: rect.bottom + 4, left });
                            setOpenDropdown(f.uuid);
                          }
                        } else {
                          insertAtCursor(fieldToken(f, 'value'));
                        }
                      }}
                    >
                      <span className="wof-formula-token-text">{tokenName}</span>
                      {hasDynOptions && (
                        <span className="wof-formula-token-arrow" aria-hidden="true">▾</span>
                      )}
                    </button>
                    {isOpen && hasDynOptions && (() => {
                      const renderItems = () => dynValues.map((dv, dvIdx) => {
                        // "Options" row — flyout with choices
                        if (dv.isOptions) {
                          return (
                            <div
                              key={dvIdx}
                              className="wof-dv-item wof-dv-item--has-sub"
                              onMouseEnter={handleSubMouseEnter}
                            >
                              <span className="wof-dv-item-label">{dv.label}</span>
                              <span className="wof-dv-item-arrow">›</span>
                              <div className="wof-dv-sub-panel">
                                {choices.length === 0 ? (
                                  <span className="wof-dv-empty-msg">{__('No options configured', 'wooptionsfic')}</span>
                                ) : (
                                  choices.map((c: any, ci: number) => {
                                    const choiceLabel = (c.label || c.title || c.productTitle || c.adminLabel || c.value || `Option ${ci + 1}`).trim();
                                    return (
                                      <div
                                        key={ci}
                                        className="wof-dv-item wof-dv-item--has-sub"
                                        onMouseEnter={handleSubMouseEnter}
                                      >
                                        <span
                                          className="wof-dv-item-label"
                                          onClick={(e: any) => {
                                            e.stopPropagation();
                                            insertAtCursor(optionToken(f, choiceLabel, 'formula'));
                                            setOpenDropdown(null);
                                            setDropdownPos(null);
                                          }}
                                          title={__('Click to insert option price, or hover for more properties', 'wooptionsfic')}
                                        >{choiceLabel}</span>
                                        <span className="wof-dv-item-arrow">›</span>
                                        <div className="wof-dv-sub-panel">
                                          {choiceOptionProps.map((op) => (
                                            <button
                                              key={op.prop}
                                              type="button"
                                              className="wof-dv-item"
                                              onClick={() => {
                                                insertAtCursor(optionToken(f, choiceLabel, op.prop));
                                                setOpenDropdown(null);
                                                setDropdownPos(null);
                                              }}
                                            >{op.label}</button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        }
                        // Regular value row
                        return (
                          <button
                            key={dvIdx}
                            type="button"
                            className="wof-dv-item"
                            onClick={() => {
                              insertAtCursor(fieldToken(f, dv.prop));
                              setOpenDropdown(null);
                              setDropdownPos(null);
                            }}
                          >{dv.label}</button>
                        );
                      });

                      const createPortalFn = (wp.element as any).createPortal;
                      if (typeof createPortalFn === 'function' && dropdownPos) {
                        return createPortalFn(
                          <div
                            className="wof-formula-panel wof-dv-portal"
                            style={{
                              position: 'fixed',
                              top: dropdownPos.top,
                              left: dropdownPos.left,
                              zIndex: 999999,
                            }}
                            onClick={(e: any) => e.stopPropagation()}
                          >
                            <div className="wof-formula-section" style={{ padding: 0, margin: 0, border: 'none' }}>
                              <div className="wof-formula-tokens" style={{ padding: 0, margin: 0, border: 'none', background: 'transparent' }}>
                                <div className="wof-dv-wrap">
                                  <div
                                    ref={activeDropdownRef}
                                    className="wof-dv-dropdown is-portal"
                                    style={{ position: 'static' }}
                                  >
                                    {renderItems()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>,
                          document.body
                        );
                      }

                      return (
                        <div
                          ref={activeDropdownRef}
                          className="wof-dv-dropdown"
                        >
                          {renderItems()}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Function Reference — moved here, after Insert field */}
          <div className="wof-formula-ref-inline">
            <button
              type="button"
              className="wof-formula-ref-toggle"
              onClick={() => setRefOpen((o) => !o)}
              aria-expanded={refOpen}
            >
              <span>{__('Function Reference', 'wooptionsfic')}</span>
              <span className="wof-formula-ref-toggle__icon">{refOpen ? '▲' : '▼'}</span>
            </button>
            {refOpen ? (
              <div className="wof-formula-ref-list">
                {FUNCTION_REF.map((fn) => (
                  <button
                    key={fn.stub}
                    type="button"
                    className="wof-formula-ref-item"
                    onClick={() => insertAtCursor(fn.stub)}
                    title={__('Click to insert', 'wooptionsfic')}
                  >
                    <code>{fn.name}</code>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Display Settings ─────────────────────── */}
        <div className="wof-formula-section">
          <strong className="wof-formula-section__title">{__('Display Settings', 'wooptionsfic')}</strong>

          <div className="wof-field-width-setting" style={{ marginBottom: '12px' }}>
            <span className="wof-field-width-label">{__('Output Mode', 'wooptionsfic')}</span>
            <div className="wof-field-width-group" role="radiogroup" aria-label={__('Output mode', 'wooptionsfic')}>
              {([
                { label: __('Currency', 'wooptionsfic'), value: 'currency' },
                { label: __('Number', 'wooptionsfic'), value: 'number' },
                { label: __('Text', 'wooptionsfic'), value: 'text' },
              ] as const).map((opt) => {
                const isSelected = (field.displayMode ?? 'currency') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                    onClick={() => update({ displayMode: opt.value })}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {(field.displayMode ?? 'number') !== 'text' ? (
            <TextControl
              label={__('Decimal Places', 'wooptionsfic')}
              type="number"
              min={0}
              max={6}
              value={String(field.decimalPlaces ?? 2)}
              onChange={(val: string) => update({ decimalPlaces: Math.max(0, Math.min(6, parseInt(val, 10) || 0)) })}
            />
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <TextControl
              label={__('Prefix', 'wooptionsfic')}
              value={field.prefix ?? ''}
              placeholder={__('e.g. $', 'wooptionsfic')}
              onChange={(prefix: string) => update({ prefix })}
            />
            <TextControl
              label={__('Suffix', 'wooptionsfic')}
              value={field.suffix ?? ''}
              placeholder={__('e.g.  days', 'wooptionsfic')}
              onChange={(suffix: string) => update({ suffix })}
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <ToggleControl
              label={__('Hide when zero', 'wooptionsfic')}
              help={__('Do not display the field when the formula evaluates to 0.', 'wooptionsfic')}
              checked={Boolean(field.hideWhenZero)}
              onChange={(hideWhenZero: boolean) => update({ hideWhenZero })}
            />
          </div>
        </div>

        {/* Function Reference moved into Formula Expression section above */}
      </div>
    );
  }

  function PricingPanel(props: { field: WooptionsFic.FieldDefinition; onChange: (field: WooptionsFic.FieldDefinition) => void }): any {
    const pricing = props.field.pricing ?? WooptionsFic.FieldFactory.emptyPricing();
    const update = (patch: Partial<WooptionsFic.PricingDefinition>) => props.onChange({ ...props.field, pricing: { ...pricing, ...patch } });
    return <div><SelectControl label={__('Pricing strategy', 'wooptionsfic')} value={pricing.strategy} options={[{ label: __('No price change', 'wooptionsfic'), value: 'none' }, { label: __('Fixed amount', 'wooptionsfic'), value: 'fixed' }, { label: __('Percentage', 'wooptionsfic'), value: 'percentage' }, { label: __('Per character', 'wooptionsfic'), value: 'per_character' }, { label: __('Per unit', 'wooptionsfic'), value: 'per_unit' }, { label: __('Setup fee', 'wooptionsfic'), value: 'setup' }, { label: __('Formula', 'wooptionsfic'), value: 'formula' }]} onChange={(strategy: WooptionsFic.PricingDefinition['strategy']) => update({ strategy })} /><SelectControl label={__('Price mode', 'wooptionsfic')} value={pricing.mode} options={[{ label: __('Add to product price', 'wooptionsfic'), value: 'adjustment' }, { label: __('Replace unit price', 'wooptionsfic'), value: 'unit_price' }]} onChange={(mode: WooptionsFic.PricingDefinition['mode']) => update({ mode })} />{pricing.strategy === 'percentage' ? <TextControl label={__('Percentage', 'wooptionsfic')} type="number" value={pricing.percent} onChange={(percent: string) => update({ percent })} /> : pricing.strategy === 'formula' ? <TextareaControl label={__('Formula expression', 'wooptionsfic')} value={pricing.expression ?? '0'} onChange={(expression: string) => update({ expression })} help={__('Use server-supported FIELD("uuid") and arithmetic expressions.', 'wooptionsfic')} /> : pricing.strategy !== 'none' ? <TextControl label={__('Amount', 'wooptionsfic')} type="number" value={pricing.amount} onChange={(amount: string) => update({ amount })} /> : null}</div>;
  }

  function SpacerHeightControl(props: {
    value: number;
    defaultValue?: number;
    min?: number;
    max?: number;
    label?: string;
    onChange: (value: number) => void;
  }): any {
    const min = props.min ?? 0;
    const max = props.max ?? 300;
    const def = props.defaultValue ?? 24;
    const currentVal = Number.isFinite(props.value) ? Math.max(min, props.value) : def;
    const pct = Math.min(100, Math.max(0, ((currentVal - min) / (max - min)) * 100));

    return (
      <div className="wof-spacer-height-control">
        <label className="wof-spacer-height-label" htmlFor="wof-spacer-height-slider">
          {props.label ?? __('HEIGHT (PX)', 'wooptionsfic')}
        </label>
        <div className="wof-spacer-height-row">
          <input
            id="wof-spacer-height-slider"
            type="range"
            min={min}
            max={max}
            value={currentVal}
            style={{
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
            }}
            className="wof-spacer-slider"
            onChange={(e: any) => props.onChange(Number(e.target.value))}
            aria-label={props.label ?? __('Height in pixels', 'wooptionsfic')}
          />
          <input
            type="number"
            min={min}
            value={currentVal}
            className="wof-spacer-number-input"
            onChange={(e: any) => {
              const val = e.target.value === '' ? min : Math.max(min, parseInt(e.target.value, 10) || min);
              props.onChange(val);
            }}
            aria-label={props.label ?? __('Height in pixels input', 'wooptionsfic')}
          />
        </div>
      </div>
    );
  }

  function SectionRepeaterInspector(props: {
    field: WooptionsFic.FieldDefinition;
    update: (patch: Partial<WooptionsFic.FieldDefinition>) => void;
  }): any {
    const { field, update } = props;
    const isAccordion = field.sectionStyle === 'accordion';

    return (
      <div className="wof-section-repeater-settings">
        <TextControl
          label={__('Section Title', 'wooptionsfic')}
          value={field.label ?? ''}
          placeholder="Section Container"
          onChange={(label: string) => update({ label })}
        />

        <ToggleControl
          label={__('Hide Section Title', 'wooptionsfic')}
          checked={Boolean(field.hideSectionTitle)}
          onChange={(hideSectionTitle: boolean) => update({ hideSectionTitle })}
        />

        {/* Style */}
        <div className="wof-field-width-setting" style={{ marginBottom: '16px' }}>
          <span className="wof-field-width-label">{__('Style', 'wooptionsfic')}</span>
          <div className="wof-field-width-group" role="radiogroup" aria-label={__('Style', 'wooptionsfic')}>
            {[
              { label: __('Section', 'wooptionsfic'), value: 'section' },
              { label: __('Accordion', 'wooptionsfic'), value: 'accordion' },
              { label: __('Blank', 'wooptionsfic'), value: 'blank' },
            ].map((st) => {
              const isSelected = (field.sectionStyle || 'section') === st.value;
              return (
                <button
                  type="button"
                  key={st.value}
                  role="radio"
                  aria-checked={isSelected}
                  className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                  onClick={() => update({ sectionStyle: st.value as 'section' | 'accordion' | 'blank' })}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Initial State (under Style, only when Accordion is selected) */}
        {isAccordion ? (
          <div className="wof-field-width-setting" style={{ marginBottom: '16px' }}>
            <span className="wof-field-width-label">{__('Initial State', 'wooptionsfic')}</span>
            <div className="wof-field-width-group" role="radiogroup" aria-label={__('Initial State', 'wooptionsfic')}>
              {[
                { label: __('Open', 'wooptionsfic'), value: 'open' },
                { label: __('Close', 'wooptionsfic'), value: 'close' },
              ].map((st) => {
                const isSelected = (field.initialState || 'open') === st.value;
                return (
                  <button
                    type="button"
                    key={st.value}
                    role="radio"
                    aria-checked={isSelected}
                    className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                    onClick={() => update({ initialState: st.value as 'open' | 'close' })}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Width */}
        <div className="wof-field-width-setting" style={{ marginBottom: '16px' }}>
          <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
          <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
            {(['33%', '50%', '66%', '100%'] as const).map((w) => {
              const isSelected = (field.width || '100%') === w;
              return (
                <button
                  type="button"
                  key={w}
                  role="radio"
                  aria-checked={isSelected}
                  className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                  onClick={() => update({ width: w })}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </div>

        {/* Enable Repeatable Section Toggle (No Pro badge) */}
        <div className="wof-repeater-toggle-wrap" style={{ marginBottom: '16px' }}>
          <ToggleControl
            label={__('Enable Repeatable Section', 'wooptionsfic')}
            help={__('Let customers add the same fields multiple times on the product page.', 'wooptionsfic')}
            checked={Boolean(field.repeatable)}
            onChange={(repeatable: boolean) => update({ repeatable })}
          />
        </div>

        {field.repeatable ? (
          <div className="wof-repeater-config" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '16px' }}>
            {/* Repeat Method */}
            <div className="wof-field-width-setting" style={{ marginBottom: '16px' }}>
              <span className="wof-field-width-label">{__('Repeat Method', 'wooptionsfic')}</span>
              <div className="wof-field-width-group" role="radiogroup" aria-label={__('Repeat Method', 'wooptionsfic')}>
                {[
                  { label: __('Add Button', 'wooptionsfic'), value: 'button' },
                  { label: __('Quantity Selector', 'wooptionsfic'), value: 'quantity' },
                ].map((m) => {
                  const isSelected = (field.repeatMethod || 'button') === m.value;
                  return (
                    <button
                      type="button"
                      key={m.value}
                      role="radio"
                      aria-checked={isSelected}
                      className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                      onClick={() => update({ repeatMethod: m.value as 'button' | 'quantity' })}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Repeat Label */}
            <div style={{ marginBottom: '16px' }}>
              <TextControl
                label={__('Repeat Label', 'wooptionsfic')}
                value={field.repeatLabel ?? 'Item {n}'}
                placeholder="Item {n}"
                help={__('Use {n} for auto-numbering, like Person {n} → Person 1, Person 2.', 'wooptionsfic')}
                onChange={(repeatLabel: string) => update({ repeatLabel })}
              />
            </div>

            {/* Repeater Price Card (No Pro badge on Sales) */}
            <div
              className="wof-repeater-price-card"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{__('Price Type', 'wooptionsfic')}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{__('Regular', 'wooptionsfic')}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{__('Sales', 'wooptionsfic')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '8px' }}>
                <select
                  value={field.repeatPriceType ?? 'none'}
                  style={{
                    height: '36px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    padding: '0 8px',
                    fontSize: '13px',
                    background: '#fff',
                    width: '100%',
                  }}
                  onChange={(e: any) => {
                    const priceType = e.target.value as 'none' | 'fixed' | 'percentage';
                    update({
                      repeatPriceType: priceType,
                      pricing: {
                        strategy: priceType === 'percentage' ? 'percentage' : priceType === 'fixed' ? 'fixed' : 'none',
                        amount: field.repeatRegularPrice ?? '',
                        percent: priceType === 'percentage' ? (field.repeatRegularPrice ?? '') : '',
                        mode: 'adjustment',
                      },
                    });
                  }}
                >
                  <option value="none">{__('No cost', 'wooptionsfic')}</option>
                  <option value="fixed">{__('Fixed Price', 'wooptionsfic')}</option>
                  <option value="percentage">{__('Percentage', 'wooptionsfic')}</option>
                </select>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={field.repeatRegularPrice ?? ''}
                  placeholder="0"
                  disabled={field.repeatPriceType === 'none'}
                  style={{
                    height: '36px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    padding: '0 8px',
                    fontSize: '13px',
                    background: field.repeatPriceType === 'none' ? '#f1f5f9' : '#fff',
                    width: '100%',
                  }}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    update({
                      repeatRegularPrice: val,
                      pricing: {
                        ...(field.pricing ?? { mode: 'adjustment' }),
                        strategy: field.repeatPriceType === 'percentage' ? 'percentage' : field.repeatPriceType === 'fixed' ? 'fixed' : 'none',
                        amount: val,
                        percent: field.repeatPriceType === 'percentage' ? val : '',
                      },
                    });
                  }}
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={field.repeatSalePrice ?? ''}
                  placeholder=""
                  disabled={field.repeatPriceType === 'none'}
                  style={{
                    height: '36px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    padding: '0 8px',
                    fontSize: '13px',
                    background: field.repeatPriceType === 'none' ? '#f1f5f9' : '#fff',
                    width: '100%',
                  }}
                  onChange={(e: any) => update({ repeatSalePrice: e.target.value })}
                />
              </div>
            </div>

            {/* Button Label & Maximum Repeats (hidden for Quantity Selector) */}
            {field.repeatMethod !== 'quantity' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <TextControl
                  label={__('Button Label', 'wooptionsfic')}
                  value={field.buttonLabel ?? 'Add Another'}
                  placeholder="Add Another"
                  onChange={(buttonLabel: string) => update({ buttonLabel })}
                />
                <TextControl
                  label={__('Maximum Repeats', 'wooptionsfic')}
                  type="number"
                  min={0}
                  value={field.maxRepeats != null ? String(field.maxRepeats) : '0'}
                  placeholder="0"
                  help={__('Enter 0 to allow unlimited repeats.', 'wooptionsfic')}
                  onChange={(val: string) => update({ maxRepeats: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) })}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <TextareaControl
          label={__('Help text', 'wooptionsfic')}
          value={field.help ?? ''}
          onChange={(help: string) => update({ help })}
        />

        <div className="wof-help-position-control">
          <label className="wof-segmented-label">{__('HELP TEXT POSITION', 'wooptionsfic')}</label>
          <div className="wof-segmented-group">
            {[
              { label: __('Below Title', 'wooptionsfic'), value: 'below_title' },
              { label: __('Tooltip', 'wooptionsfic'), value: 'tooltip' },
              { label: __('Below Field', 'wooptionsfic'), value: 'below_field' },
            ].map((opt) => {
              const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={WooptionsFic.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected')}
                  onClick={() => update({ helpTextPosition: opt.value as 'below_title' | 'tooltip' | 'below_field' })}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <ToggleControl
          label={__('Required', 'wooptionsfic')}
          checked={Boolean(field.required)}
          onChange={(required: boolean) => update({ required })}
        />
      </div>
    );
  }

  export function Inspector(props: {
    field: WooptionsFic.FieldDefinition | null;
    document: WooptionsFic.OptionSetDefinition;
    tab: WooptionsFic.InspectorTab;
    onTabChange: (tab: WooptionsFic.InspectorTab) => void;
    onFieldChange: (field: WooptionsFic.FieldDefinition) => void;
    onDocumentChange: (patch: Partial<WooptionsFic.OptionSetDefinition>) => void;
    onDuplicate: () => void;
    onDelete: () => void;
  }): any {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);
    const updateScroll = () => {
      const element = scrollerRef.current;
      if (!element) return;
      setCanLeft(element.scrollLeft > 2);
      setCanRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    useEffect(() => {
      updateScroll();
      window.addEventListener('resize', updateScroll);
      const element = scrollerRef.current;
      element?.addEventListener('scroll', updateScroll, { passive: true });
      const onWheel = (e: WheelEvent) => {
        if (element && element.scrollWidth > element.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          element.scrollLeft += e.deltaY;
          updateScroll();
        }
      };
      element?.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        window.removeEventListener('resize', updateScroll);
        element?.removeEventListener('scroll', updateScroll);
        element?.removeEventListener('wheel', onWheel);
      };
    }, [props.field]);

    if (!props.field) return <aside className="wof-builder-inspector"><div className="wof-builder-pane__heading"><div><h2>{__('Option set styling', 'wooptionsfic')}</h2></div></div><div className="wof-inspector-body"><section className="wof-inspector-section"><StyleStudio document={props.document} onChange={props.onDocumentChange} /></section></div></aside>;
    const field = props.field;
    const update = (patch: Partial<WooptionsFic.FieldDefinition>) => props.onFieldChange({ ...field, ...patch });
    const contentFieldTypes = ['content', 'modal', 'spacer', 'separator', 'heading', 'paragraph', 'help', 'formula', 'repeater'];
    const visibleTabs = tabs.filter(([tab]) => {
      if (tab === 'choices' && !Boolean(field.choices)) return false;
      if (tab === 'pricing' && contentFieldTypes.includes(field.type)) return false;
      return true;
    });
    const activeTab = visibleTabs.some(([tab]) => tab === props.tab) ? props.tab : 'content';

    return <aside className="wof-builder-inspector">
      <div className="wof-builder-pane__heading">
        <div>
          <h2>{field.type === 'spacer' ? __('Spacer', 'wooptionsfic') : field.type === 'separator' ? __('Separator', 'wooptionsfic') : field.label}</h2>
        </div>
        <div className="wof-inspector-heading-actions">
          <button type="button" onClick={props.onDuplicate} aria-label={__('Duplicate field', 'wooptionsfic')} title={__('Duplicate', 'wooptionsfic')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </button>
          <button type="button" className="is-destructive" onClick={props.onDelete} aria-label={__('Delete field', 'wooptionsfic')} title={__('Delete', 'wooptionsfic')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
          </button>
        </div>
      </div>
      <div className="wof-inspector-tabs-shell">
        {canLeft ? <button type="button" className="wof-inspector-tabs-arrow is-left" aria-label={__('Scroll tabs left', 'wooptionsfic')} onClick={() => scrollerRef.current?.scrollBy({ left: -140, behavior: 'smooth' })}><WooptionsFic.Components.Dashicon name="arrow-left-alt2" /></button> : null}
        <div className="wof-inspector-tabs" ref={scrollerRef} role="tablist" aria-label={__('Field Inspector Tabs', 'wooptionsfic')}>
          {visibleTabs.map(([tab, label]) => (
            <button
              type="button"
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? 'is-active' : ''}
              onClick={(event: Event) => {
                props.onTabChange(tab);
                (event.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {canRight ? <button type="button" className="wof-inspector-tabs-arrow is-right" aria-label={__('Scroll tabs right', 'wooptionsfic')} onClick={() => scrollerRef.current?.scrollBy({ left: 140, behavior: 'smooth' })}><WooptionsFic.Components.Dashicon name="arrow-right-alt2" /></button> : null}
      </div>
      <div className="wof-inspector-body">
        <section className="wof-inspector-section">
          {activeTab === 'content' ? (
            field.type === 'repeater' ? (
              <SectionRepeaterInspector field={field} update={update} />
            ) : field.type === 'separator' ? (
              <div className="wof-spacer-settings">
                <SpacerHeightControl
                  value={Number(field.height ?? (field.style as any)?.height ?? 1)}
                  defaultValue={1}
                  onChange={(height: number) => update({ height, style: { ...(field.style ?? {}), height } })}
                />

                <ChoiceColorControl
                  label={__('Spacer color', 'wooptionsfic')}
                  color={String(field.color ?? (field.style as any)?.color ?? '#E2E8F0')}
                  onChange={(color: string) => update({ color, style: { ...(field.style ?? {}), color } })}
                />

                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : field.type === 'spacer' ? (
              <div className="wof-spacer-settings">
                <SpacerHeightControl
                  value={Number(field.height ?? (field.style as any)?.height ?? 24)}
                  defaultValue={24}
                  onChange={(height: number) => update({ height, style: { ...(field.style ?? {}), height } })}
                />

                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : field.type === 'content' ? (
              <div className="wof-content-field-settings">
                <TextControl
                  label={__('Label (Internal reference)', 'wooptionsfic')}
                  value={field.label}
                  onChange={(label: string) => update({ label })}
                />
                <WooptionsFic.Components.WpWysiwygEditor
                  id={field.uuid}
                  label={__('Content', 'wooptionsfic')}
                  value={field.content ?? ''}
                  onChange={(content: string) => update({ content })}
                />
                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : field.type === 'modal' ? (
              <div className="wof-modal-field-settings">
                <TextControl
                  label={__('Label (Internal reference)', 'wooptionsfic')}
                  value={field.label}
                  onChange={(label: string) => update({ label })}
                />
                <TextControl
                  label={__('Button Text', 'wooptionsfic')}
                  value={field.buttonText ?? 'View details'}
                  placeholder={__('e.g. Size Guide, View details', 'wooptionsfic')}
                  onChange={(buttonText: string) => update({ buttonText })}
                />
                <SelectControl
                  label={__('Button Style', 'wooptionsfic')}
                  value={field.buttonStyle ?? 'outline'}
                  options={[
                    { label: __('Outline', 'wooptionsfic'), value: 'outline' },
                    { label: __('Primary', 'wooptionsfic'), value: 'primary' },
                    { label: __('Secondary', 'wooptionsfic'), value: 'secondary' },
                    { label: __('Link / Text only', 'wooptionsfic'), value: 'link' },
                  ]}
                  onChange={(buttonStyle: 'outline' | 'primary' | 'secondary' | 'link') => update({ buttonStyle })}
                />
                <TextControl
                  label={__('Modal Header Title', 'wooptionsfic')}
                  value={field.modalTitle ?? 'Information'}
                  placeholder={__('e.g. Size Guide & Dimensions', 'wooptionsfic')}
                  onChange={(modalTitle: string) => update({ modalTitle })}
                />
                <WooptionsFic.Components.WpWysiwygEditor
                  id={field.uuid}
                  label={__('Modal Content', 'wooptionsfic')}
                  value={field.content ?? ''}
                  onChange={(content: string) => update({ content })}
                />
                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : field.type === 'formula' ? (
              <FormulaPanel
                field={field}
                allFields={props.document.fields}
                onChange={props.onFieldChange}
              />
            ) : field.type === 'heading' ? (
              <div className="wof-heading-field-settings">
                <TextControl
                  label={__('Heading Text', 'wooptionsfic')}
                  value={field.label}
                  onChange={(label: string) => update({ label })}
                />
                <TextareaControl
                  label={__('Help text', 'wooptionsfic')}
                  value={field.help ?? ''}
                  onChange={(help: string) => update({ help })}
                />
                <div className="wof-help-position-control">
                  <label className="wof-segmented-label">
                    {__('HELP TEXT POSITION', 'wooptionsfic')}
                  </label>
                  <div className="wof-segmented-group">
                    {[
                      { label: __('Below Title', 'wooptionsfic'), value: 'below_title' },
                      { label: __('Tooltip', 'wooptionsfic'), value: 'tooltip' },
                      { label: __('Below Field', 'wooptionsfic'), value: 'below_field' },
                    ].map(opt => {
                      const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={WooptionsFic.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected')}
                          onClick={() => update({ helpTextPosition: opt.value as 'below_title' | 'tooltip' | 'below_field' })}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : field.type === 'paragraph' ? (
              <div className="wof-paragraph-field-settings">
                <TextControl
                  label={__('Label (Internal reference)', 'wooptionsfic')}
                  value={field.label}
                  onChange={(label: string) => update({ label })}
                />
                <TextareaControl
                  label={__('Content', 'wooptionsfic')}
                  rows={4}
                  value={field.description || field.content || ''}
                  onChange={(content: string) => update({ description: content, content })}
                />
                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : field.type === 'help' ? (
              <div className="wof-help-field-settings">
                <TextControl
                  label={__('Label (Internal reference)', 'wooptionsfic')}
                  value={field.label}
                  onChange={(label: string) => update({ label })}
                />
                <TextareaControl
                  label={__('Help Content', 'wooptionsfic')}
                  rows={4}
                  value={field.description || field.content || field.help || ''}
                  onChange={(content: string) => update({ description: content, content })}
                />
                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <TextControl label={__('Label', 'wooptionsfic')} value={field.label} onChange={(label: string) => update({ label })} />

                {/* Applied Fields (Target Text Fields for Font Picker) */}
                {field.type === 'font' ? (
                  <div className="wof-applied-fields-box" style={{ marginBottom: '16px', padding: '14px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                        {__('Applied Text Fields', 'wooptionsfic')}
                      </strong>
                      <span style={{ fontSize: '11px', background: 'color-mix(in srgb, var(--wof-admin-primary, #5b4ff5) 12%, transparent)', color: 'var(--wof-admin-primary, #5b4ff5)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        {Array.isArray(field.appliedFields) ? field.appliedFields.length : 0} {__('linked', 'wooptionsfic')}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                      {__('Select which Text or Textarea field(s) will change their font in real-time as the customer chooses a font.', 'wooptionsfic')}
                    </p>

                    {(() => {
                      const textFields = (props.document.fields || []).filter(
                        (f) => (f.type === 'text' || f.type === 'textarea') && f.uuid !== field.uuid
                      );
                      if (textFields.length === 0) {
                        return (
                          <div style={{ padding: '10px', background: '#fff', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                            <p style={{ margin: 0 }}>{__('No Text or Textarea fields found in this option set.', 'wooptionsfic')}</p>
                            <small style={{ display: 'block', marginTop: '4px', color: '#94a3b8' }}>
                              {__('Add a Text or Textarea field to enable real-time font styling.', 'wooptionsfic')}
                            </small>
                          </div>
                        );
                      }
                      const applied = Array.isArray(field.appliedFields) ? field.appliedFields : [];
                      return (
                        <div className="wof-applied-fields-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {textFields.map((tf) => {
                            const isChecked = applied.includes(tf.uuid);
                            return (
                              <label
                                key={tf.uuid}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  background: isChecked ? 'color-mix(in srgb, var(--wof-admin-primary, #5b4ff5) 8%, #fff)' : '#fff',
                                  border: isChecked ? '1.5px solid var(--wof-admin-primary, #5b4ff5)' : '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e: any) => {
                                    let next: string[];
                                    if (e.target.checked) {
                                      next = [...applied, tf.uuid];
                                    } else {
                                      next = applied.filter((id) => id !== tf.uuid);
                                    }
                                    update({ appliedFields: next });
                                  }}
                                />
                                <span style={{ fontWeight: 500, fontSize: '13px', flex: 1, color: '#1e293b' }}>
                                  {tf.label || __('Untitled text field', 'wooptionsfic')}
                                </span>
                                <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '1px 6px', background: '#f1f5f9', borderRadius: '4px', color: '#64748b', fontWeight: 600 }}>
                                  {tf.type === 'textarea' ? __('Textarea', 'wooptionsfic') : __('Text', 'wooptionsfic')}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {/* Block Width options for every block */}
                <div className="wof-field-width-setting">
                  <span className="wof-field-width-label">{__('Width', 'wooptionsfic')}</span>
                  <div className="wof-field-width-group" role="radiogroup" aria-label={__('Width', 'wooptionsfic')}>
                    {(['33%', '50%', '66%', '100%'] as const).map((w) => {
                      const isSelected = (field.width || '100%') === w;
                      return (
                        <button
                          type="button"
                          key={w}
                          role="radio"
                          aria-checked={isSelected}
                          className={WooptionsFic.Utils.classNames('wof-width-btn', isSelected && 'is-active')}
                          onClick={() => update({ width: w })}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Choice Item Dimensions & Style */}
                {Boolean(field.choices) && !['radio', 'checkbox_group', 'select', 'font'].includes(field.type) ? (
                  <div className="wof-choice-dimensions-box" style={{ padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)', marginBottom: '16px' }}>
                    <strong style={{ display: 'block', fontSize: '13px', marginBottom: '8px' }}>{__('Choice Item Dimensions & Style', 'wooptionsfic')}</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <TextControl
                        label={__('Width (px)', 'wooptionsfic')}
                        type="number"
                        min={0}
                        value={String(field.choiceWidth ?? '')}
                        placeholder="Auto"
                        onChange={(choiceWidth: string) => update({ choiceWidth })}
                      />
                      <TextControl
                        label={__('Height (px)', 'wooptionsfic')}
                        type="number"
                        min={0}
                        value={String(field.choiceHeight ?? '')}
                        placeholder="Auto"
                        onChange={(choiceHeight: string) => update({ choiceHeight })}
                      />
                      <TextControl
                        label={__('Radius (px)', 'wooptionsfic')}
                        type="number"
                        min={0}
                        value={String(field.choiceBorderRadius ?? '')}
                        placeholder="Default"
                        onChange={(choiceBorderRadius: string) => update({ choiceBorderRadius })}
                      />
                    </div>
                  </div>
                ) : null}

                {'placeholder' in field && field.type !== 'range' ? <TextControl label={__('Placeholder', 'wooptionsfic')} value={field.placeholder ?? ''} onChange={(placeholder: string) => update({ placeholder })} /> : null}

                {/* Text and Textarea Settings */}
                {['text', 'textarea'].includes(field.type) ? (
                  <div className="wof-text-settings" style={{ marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <TextControl
                        label={__('Minimum Character', 'wooptionsfic')}
                        type="number"
                        min={0}
                        value={field.minLength ? String(field.minLength) : ''}
                        placeholder="0"
                        onChange={(val: string) => update({ minLength: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) })}
                      />
                      <TextControl
                        label={__('Maximum Character', 'wooptionsfic')}
                        type="number"
                        min={0}
                        value={field.maxLength ? String(field.maxLength) : ''}
                        placeholder="0"
                        onChange={(val: string) => update({ maxLength: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) })}
                      />
                    </div>

                    <SelectControl
                      label={__('Text Transform', 'wooptionsfic')}
                      value={field.textTransform ?? 'none'}
                      options={[
                        { label: __('None', 'wooptionsfic'), value: 'none' },
                        { label: __('Uppercase', 'wooptionsfic'), value: 'uppercase' },
                        { label: __('Lowercase', 'wooptionsfic'), value: 'lowercase' },
                        { label: __('Capitalize', 'wooptionsfic'), value: 'capitalize' },
                      ]}
                      onChange={(textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize') => update({ textTransform })}
                    />

                    {field.type === 'textarea' ? (
                      <div style={{ marginTop: '12px' }}>
                        <TextControl
                          label={__('Row', 'wooptionsfic')}
                          type="number"
                          min={1}
                          max={50}
                          value={field.rows ? String(field.rows) : '4'}
                          placeholder="4"
                          onChange={(val: string) => update({ rows: val === '' ? 4 : Math.max(1, parseInt(val, 10) || 4) })}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Number Settings */}
                {field.type === 'number' ? (
                  <div className="wof-number-settings" style={{ marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' }}>
                    <ToggleControl
                      label={__('Enable Min/Max Restriction', 'wooptionsfic')}
                      checked={field.enableMinMax !== false}
                      onChange={(enableMinMax: boolean) => update({
                        enableMinMax,
                        min: enableMinMax ? (field.min ?? '1') : null,
                        max: enableMinMax ? (field.max ?? '100') : null,
                      })}
                    />
                    {field.enableMinMax !== false ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                        <TextControl
                          label={__('MINIMUM VALUE', 'wooptionsfic')}
                          type="number"
                          value={field.min != null ? String(field.min) : '1'}
                          placeholder="1"
                          onChange={(min: string) => update({ min })}
                        />
                        <TextControl
                          label={__('MAXIMUM VALUE', 'wooptionsfic')}
                          type="number"
                          value={field.max != null ? String(field.max) : '100'}
                          placeholder="100"
                          onChange={(max: string) => update({ max })}
                        />
                      </div>
                    ) : null}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <TextControl
                        label={__('STEPS', 'wooptionsfic')}
                        type="number"
                        value={field.step != null ? String(field.step) : '1'}
                        placeholder="1"
                        onChange={(step: string) => update({ step })}
                      />
                      <TextControl
                        label={__('DEFAULT VALUE', 'wooptionsfic')}
                        type="number"
                        value={field.default != null && field.default !== '' ? String(field.default) : ''}
                        placeholder=""
                        onChange={(def: string) => update({ default: def })}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Range Settings */}
                {field.type === 'range' ? (
                  <div className="wof-range-settings" style={{ marginBottom: '16px' }}>
                    <ToggleControl
                      label={__('Enable PostFix', 'wooptionsfic')}
                      checked={Boolean(field.enablePostfix)}
                      onChange={(enablePostfix: boolean) => update({ enablePostfix })}
                    />
                    {field.enablePostfix ? (
                      <div style={{ marginTop: '10px' }}>
                        <TextControl
                          label={__('POSTFIX TEXT', 'wooptionsfic')}
                          value={field.postfix != null ? String(field.postfix) : 'PostFix'}
                          placeholder="PostFix"
                          onChange={(postfix: string) => update({ postfix })}
                        />
                      </div>
                    ) : null}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                      <TextControl
                        label={__('MINIMUM VALUE', 'wooptionsfic')}
                        type="number"
                        value={field.min != null ? String(field.min) : '1'}
                        placeholder="1"
                        onChange={(min: string) => update({ min })}
                      />
                      <TextControl
                        label={__('MAXIMUM VALUE', 'wooptionsfic')}
                        type="number"
                        value={field.max != null ? String(field.max) : '100'}
                        placeholder="100"
                        onChange={(max: string) => update({ max })}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <TextControl
                        label={__('STEPS', 'wooptionsfic')}
                        type="number"
                        value={field.step != null ? String(field.step) : '1'}
                        placeholder="1"
                        onChange={(step: string) => update({ step })}
                      />
                      <TextControl
                        label={__('DEFAULT VALUE', 'wooptionsfic')}
                        type="number"
                        value={field.default != null && field.default !== '' ? String(field.default) : '10'}
                        placeholder="10"
                        onChange={(def: string) => update({ default: def })}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Phone / Telephone Flag Style & Default Country */}
                {field.type === 'tel' ? (
                  <div className="wof-phone-settings" style={{ marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' }}>
                    <SelectControl
                      label={__('Flag Style', 'wooptionsfic')}
                      value={field.flagStyle ?? 'number_only'}
                      options={[
                        { label: __('Number Only', 'wooptionsfic'), value: 'number_only' },
                        { label: __('Number Only & Flag', 'wooptionsfic'), value: 'number_flag' },
                        { label: __('Number Only & Flag and Dial Code', 'wooptionsfic'), value: 'number_flag_dialcode' },
                      ]}
                      onChange={(flagStyle: 'number_only' | 'number_flag' | 'number_flag_dialcode') => update({ flagStyle })}
                    />
                    {(field.flagStyle === 'number_flag' || field.flagStyle === 'number_flag_dialcode') ? (
                      <SelectControl
                        label={__('Default Country', 'wooptionsfic')}
                        value={field.defaultCountry ?? 'US'}
                        options={COUNTRY_OPTIONS}
                        onChange={(defaultCountry: string) => update({ defaultCountry })}
                      />
                    ) : null}
                  </div>
                ) : null}

                {/* Date and Time Settings */}
                {['datetime', 'date', 'time'].includes(field.type) ? (
                  <DateFieldInspector field={field} update={update} />
                ) : null}

                {/* Date Range Settings */}
                {field.type === 'date_range' ? (
                  <DateRangeFieldInspector field={field} update={update} />
                ) : null}

                {/* Allow Multiple Choices for color, image, and button choices */}
                {['color_swatch', 'image_swatch', 'segmented'].includes(field.type) ? (
                  <div className="wof-multiple-choice-settings" style={{ marginBottom: '16px' }}>
                    <ToggleControl
                      label={__('Allow Multiple Choices', 'wooptionsfic')}
                      help={__('Allow customers to select more than one option.', 'wooptionsfic')}
                      checked={Boolean(field.multiple)}
                      onChange={(multiple: boolean) => update({ multiple })}
                    />
                    {field.multiple ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                        <TextControl
                          label={__('Min Restriction', 'wooptionsfic')}
                          type="number"
                          min={0}
                          value={String(field.minChoices ?? '')}
                          placeholder={__('Min', 'wooptionsfic')}
                          onChange={(val: string) => update({ minChoices: val === '' ? 0 : Math.max(0, Number(val)) })}
                        />
                        <TextControl
                          label={__('Max Restriction', 'wooptionsfic')}
                          type="number"
                          min={0}
                          value={String(field.maxChoices ?? '')}
                          placeholder={__('Max', 'wooptionsfic')}
                          onChange={(val: string) => update({ maxChoices: val === '' ? 0 : Math.max(0, Number(val)) })}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Min/Max restriction for checkboxes */}
                {field.type === 'checkbox_group' ? (
                  <div className="wof-checkbox-restrictions-box" style={{ padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)', marginBottom: '16px' }}>
                    <strong style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>{__('Choice Selection Restrictions', 'wooptionsfic')}</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <TextControl
                        label={__('Min Restriction', 'wooptionsfic')}
                        type="number"
                        min={0}
                        value={String(field.minChoices ?? '')}
                        placeholder={__('Min', 'wooptionsfic')}
                        onChange={(val: string) => update({ minChoices: val === '' ? 0 : Math.max(0, Number(val)) })}
                      />
                      <TextControl
                        label={__('Max Restriction', 'wooptionsfic')}
                        type="number"
                        min={0}
                        value={String(field.maxChoices ?? '')}
                        placeholder={__('Max', 'wooptionsfic')}
                        onChange={(val: string) => update({ maxChoices: val === '' ? 0 : Math.max(0, Number(val)) })}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Enable Quantity option for choice fields (excluding segmented, radio, checkbox_group, font, select, and product) */}
                {Boolean(field.choices) && !['segmented', 'radio', 'checkbox_group', 'font', 'select', 'product'].includes(field.type) ? (
                  <div className="wof-quantity-setting" style={{ marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' }}>
                    <ToggleControl
                      label={__('Enable Quantity', 'wooptionsfic')}
                      help={__('Allow customers to specify quantity for each choice option.', 'wooptionsfic')}
                      checked={Boolean(field.enableQuantity)}
                      onChange={(enableQuantity: boolean) => update({ enableQuantity })}
                    />
                    {field.enableQuantity ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                        <TextControl
                          label={__('Minimum Quantity', 'wooptionsfic')}
                          type="number"
                          min={1}
                          value={String(field.minQuantity ?? 1)}
                          placeholder="1"
                          onChange={(val: string) => update({ minQuantity: val === '' ? 1 : Math.max(1, Number(val)) })}
                        />
                        <TextControl
                          label={__('Maximum Quantity', 'wooptionsfic')}
                          type="number"
                          min={1}
                          value={String(field.maxQuantity ?? 100)}
                          placeholder="100"
                          onChange={(val: string) => update({ maxQuantity: val === '' ? 0 : Math.max(1, Number(val)) })}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {field.type === 'color_picker' ? (
                  <ChoiceColorControl label={__('Default color', 'wooptionsfic')} color={String(field.default ?? '#5B4FF5')} onChange={(color: string) => update({ default: color })} />
                ) : null}

                {['checkbox', 'toggle'].includes(field.type) ? (
                  <ToggleControl
                    label={__('Checked by default', 'wooptionsfic')}
                    checked={Boolean(field.default)}
                    onChange={(defaultVal: boolean) => update({ default: defaultVal })}
                  />
                ) : null}

                <TextareaControl label={__('Help text', 'wooptionsfic')} value={field.help} onChange={(help: string) => update({ help })} />

                <div className="wof-help-position-control">
                  <label className="wof-segmented-label">
                    {__('HELP TEXT POSITION', 'wooptionsfic')}
                  </label>
                  <div className="wof-segmented-group">
                    {[
                      { label: __('Below Title', 'wooptionsfic'), value: 'below_title' },
                      { label: __('Tooltip', 'wooptionsfic'), value: 'tooltip' },
                      { label: __('Below Field', 'wooptionsfic'), value: 'below_field' },
                    ].map(opt => {
                      const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={WooptionsFic.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected')}
                          onClick={() => update({ helpTextPosition: opt.value as 'below_title' | 'tooltip' | 'below_field' })}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ToggleControl label={__('Required', 'wooptionsfic')} checked={field.required} onChange={(required: boolean) => update({ required })} />
              </>
            )
          ) : activeTab === 'choices' ? (
            <ChoiceEditor field={field} onChange={props.onFieldChange} />
          ) : activeTab === 'pricing' ? (
            <PricingPanel field={field} onChange={props.onFieldChange} />
          ) : activeTab === 'logic' ? (
            <LogicEditor field={field} allFields={props.document.fields} onChange={props.onFieldChange} />
          ) : activeTab === 'style' ? (
            <StyleStudio document={props.document} onChange={props.onDocumentChange} />
          ) : (
            <>
              <ToggleControl label={__('Disable this field', 'wooptionsfic')} checked={field.disabled} onChange={(disabled: boolean) => update({ disabled })} />
              {field.type === 'file' ? (
                <>
                  <TextControl label={__('Allowed extensions', 'wooptionsfic')} value={(field.allowedExtensions ?? []).join(', ')} onChange={(value: string) => update({ allowedExtensions: value.split(',').map((item) => item.trim().replace(/^\./, '')).filter(Boolean) })} />
                  <TextControl label={__('Maximum files', 'wooptionsfic')} type="number" value={String(field.maxFiles ?? 1)} onChange={(value: string) => update({ maxFiles: Math.max(1, Number(value)) })} />
                  <TextControl label={__('Maximum file size (MB)', 'wooptionsfic')} type="number" value={String(field.maxFileMb ?? 5)} onChange={(value: string) => update({ maxFileMb: Math.max(1, Number(value)) })} />
                </>
              ) : null}
              {field.type === 'customer_defined_price' ? (
                <>
                  <TextControl label={__('Minimum', 'wooptionsfic')} value={field.min ?? ''} onChange={(value: string) => update({ min: value || null })} />
                  <TextControl label={__('Maximum', 'wooptionsfic')} value={field.max ?? ''} onChange={(value: string) => update({ max: value || null })} />
                  <TextControl label={__('Step', 'wooptionsfic')} value={field.step ?? ''} onChange={(value: string) => update({ step: value || null })} />
                </>
              ) : null}
              <TextControl label={__('Field UUID', 'wooptionsfic')} value={field.uuid} disabled />
            </>
          )}
        </section>
      </div>
    </aside>;
  }
}
