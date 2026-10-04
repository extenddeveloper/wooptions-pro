namespace WooptionsFic.Pages {
  const { __, sprintf } = wp.i18n;
  const { useCallback, useEffect, useMemo, useRef, useState } = wp.element;

  interface ChartPoint {
    date: string;
    label: string;
    clicks: number;
    addToCart: number;
    orders: number;
    sales: number;
    views: number;
  }

  interface OptionSetBreakdown {
    id: number;
    uuid: string;
    name: string;
    appliedText: string;
    productCount: number;
    thumbnailUrl?: string;
    clickRate: number;
    addToCartRate: number;
    sales: number;
    orders: number;
    clicks: number;
    addToCart: number;
    views: number;
  }

  interface AnalyticsResponse {
    range: string;
    from: string;
    to: string;
    currency: string;
    currencySymbol: string;
    currencyPosition: string;
    totals: {
      totalSales: number;
      totalOrders: number;
      clicksCount: number;
      addToCartCount: number;
      viewsCount: number;
    };
    chart: ChartPoint[];
    optionSets: OptionSetBreakdown[];
  }

  type MetricType = 'clicks' | 'addToCart' | 'orders' | 'sales';

  interface SplinePoint {
    x: number;
    y: number;
  }

  function formatMoney(amount: number, symbol: string = '$', position: string = 'right'): string {
    const formatted = Number.isInteger(amount) ? amount.toString() : Number(amount.toFixed(2)).toString();
    switch (position) {
      case 'left':
        return `${symbol}${formatted}`;
      case 'left_space':
        return `${symbol} ${formatted}`;
      case 'right_space':
        return `${formatted} ${symbol}`;
      case 'right':
      default:
        return `${formatted}${symbol}`;
    }
  }

  function buildMonotoneSpline(points: SplinePoint[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    const n = points.length;
    const d: number[] = [];
    const m: number[] = [];

    for (let i = 0; i < n - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      d[i] = dx !== 0 ? dy / dx : 0;
    }

    m[0] = d[0];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) {
        m[i] = 0;
      } else {
        m[i] = (d[i - 1] + d[i]) / 2;
      }
    }
    m[n - 1] = d[n - 2];

    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const alpha = m[i] / d[i];
        const beta = m[i + 1] / d[i];
        const dist = alpha * alpha + beta * beta;
        if (dist > 9) {
          const tau = 3 / Math.sqrt(dist);
          m[i] = tau * alpha * d[i];
          m[i + 1] = tau * beta * d[i];
        }
      }
    }

    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < n - 1; i++) {
      const dx = (points[i + 1].x - points[i].x) / 3;
      const cp1x = points[i].x + dx;
      const cp1y = points[i].y + m[i] * dx;
      const cp2x = points[i + 1].x - dx;
      const cp2y = points[i + 1].y - m[i + 1] * dx;
      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`;
    }
    return path;
  }

  export function Analytics(props?: { navigate?: (route: string) => void }): any {
    const [range, setRange] = useState<'7d' | '30d' | '12m'>('30d');
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeMetric, setActiveMetric] = useState<MetricType>('clicks');
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [tableSearch, setTableSearch] = useState('');
    const [tablePage, setTablePage] = useState(1);
    const perPage = 5;

    const chartSvgRef = useRef<SVGSVGElement | null>(null);

    const loadData = useCallback((selectedRange: string) => {
      setLoading(true);
      setError('');
      WooptionsFic.Api.analytics({ range: selectedRange })
        .then((response: any) => setData(response))
        .catch((reason: any) => setError(WooptionsFic.Utils.errorMessage(reason)))
        .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
      loadData(range);
    }, [range, loadData]);

    const rangeOptions: Array<{ key: '7d' | '30d' | '12m'; label: string }> = [
      { key: '7d', label: __('Last 7 Days', 'wooptionsfic') },
      { key: '30d', label: __('Last 30 Days', 'wooptionsfic') },
      { key: '12m', label: __('Last 12 Months', 'wooptionsfic') },
    ];

    const currencySymbol = data?.currencySymbol || (window as any).WooptionsFicAdmin?.currencySymbol || '$';
    const currencyPosition = data?.currencyPosition || (window as any).WooptionsFicAdmin?.currencyPosition || 'right';

    // Chart parameters
    const chartWidth = 960;
    const chartHeight = 310;
    const padLeft = 55;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 45;

    const plotWidth = chartWidth - padLeft - padRight;
    const plotHeight = chartHeight - padTop - padBottom;
    const baselineY = chartHeight - padBottom;

    const chartPoints = data?.chart || [];

    const maxVal = useMemo(() => {
      if (!chartPoints.length) return 3;
      const values = chartPoints.map((p) => {
        if (activeMetric === 'sales') return p.sales;
        if (activeMetric === 'orders') return p.orders;
        if (activeMetric === 'addToCart') return p.addToCart;
        return p.clicks;
      });
      const highest = Math.max(...values);
      if (highest <= 0) return 3;
      if (highest <= 3) return 3;
      if (highest <= 10) return Math.ceil(highest);
      const mag = Math.pow(10, Math.floor(Math.log10(highest)));
      return Math.ceil(highest / mag) * mag;
    }, [chartPoints, activeMetric]);

    const yTicks = useMemo(() => {
      const ticks = [];
      for (let i = 0; i <= 4; i++) {
        const val = (maxVal * i) / 4;
        const y = baselineY - (val / maxVal) * plotHeight;
        const label = activeMetric === 'sales'
          ? (Number.isInteger(val) ? val.toString() : val.toFixed(1))
          : (Number.isInteger(val) ? val.toString() : val.toFixed(2));
        ticks.push({ val, y, label });
      }
      return ticks;
    }, [maxVal, baselineY, plotHeight, activeMetric]);

    const coords: SplinePoint[] = useMemo(() => {
      if (!chartPoints.length) return [];
      const count = chartPoints.length;
      return chartPoints.map((p, idx) => {
        const x = count === 1 ? padLeft + plotWidth / 2 : padLeft + (idx / (count - 1)) * plotWidth;
        const val = activeMetric === 'sales' ? p.sales : activeMetric === 'orders' ? p.orders : activeMetric === 'addToCart' ? p.addToCart : p.clicks;
        const y = baselineY - Math.min(1, Math.max(0, val / maxVal)) * plotHeight;
        return { x, y };
      });
    }, [chartPoints, activeMetric, maxVal, padLeft, plotWidth, baselineY, plotHeight]);

    const { strokeD, areaD } = useMemo(() => {
      if (coords.length === 0) return { strokeD: '', areaD: '' };
      const stroke = buildMonotoneSpline(coords);
      const first = coords[0];
      const last = coords[coords.length - 1];
      const area = `${stroke} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;
      return { strokeD: stroke, areaD: area };
    }, [coords, baselineY]);

    const xLabels = useMemo(() => {
      if (!chartPoints.length) return [];
      const total = chartPoints.length;
      const step = total > 20 ? 2 : total > 10 ? 1 : 1;
      const labels = [];
      for (let i = 0; i < total; i += step) {
        const x = total === 1 ? padLeft + plotWidth / 2 : padLeft + (i / (total - 1)) * plotWidth;
        labels.push({ idx: i, x, label: chartPoints[i].label });
      }
      if (total > 1 && (total - 1) % step !== 0) {
        labels.push({
          idx: total - 1,
          x: padLeft + plotWidth,
          label: chartPoints[total - 1].label,
        });
      }
      return labels;
    }, [chartPoints, padLeft, plotWidth]);

    const handleMouseMove = (e: any) => {
      if (!chartSvgRef.current || !chartPoints.length) return;
      const rect = chartSvgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const svgX = (clientX / rect.width) * chartWidth;

      if (svgX < padLeft || svgX > padLeft + plotWidth) {
        setHoveredIdx(null);
        return;
      }

      const fraction = (svgX - padLeft) / plotWidth;
      const index = Math.round(fraction * (chartPoints.length - 1));
      setHoveredIdx(Math.max(0, Math.min(chartPoints.length - 1, index)));
    };

    const handleMouseLeave = () => {
      setHoveredIdx(null);
    };

    const hoveredPoint = hoveredIdx !== null ? chartPoints[hoveredIdx] : null;
    const hoveredCoord = hoveredIdx !== null ? coords[hoveredIdx] : null;

    // Filter & Paginate Option Sets
    const filteredOptionSets = useMemo(() => {
      const list = data?.optionSets || [];
      if (!tableSearch.trim()) return list;
      const q = tableSearch.toLowerCase();
      return list.filter(
        (item) => item.name.toLowerCase().includes(q) || String(item.id).includes(q) || item.uuid.toLowerCase().includes(q)
      );
    }, [data?.optionSets, tableSearch]);

    // Reset to page 1 when search query changes
    useEffect(() => {
      setTablePage(1);
    }, [tableSearch]);

    const totalTableItems = filteredOptionSets.length;
    const totalTablePages = Math.max(1, Math.ceil(totalTableItems / perPage));
    const paginatedOptionSets = useMemo(() => {
      const start = (tablePage - 1) * perPage;
      return filteredOptionSets.slice(start, start + perPage);
    }, [filteredOptionSets, tablePage, perPage]);

    const startItem = totalTableItems > 0 ? (tablePage - 1) * perPage + 1 : 0;
    const endItem = Math.min(totalTableItems, tablePage * perPage);

    // Color theme configuration based on active metric
    const metricThemes: Record<MetricType, { color: string; fillStop: string; label: string; unit: string }> = {
      clicks: { color: '#5b4ff5', fillStop: 'rgba(91, 79, 245, 0.24)', label: __('Clicks', 'wooptionsfic'), unit: __('interactions', 'wooptionsfic') },
      addToCart: { color: '#0284c7', fillStop: 'rgba(2, 132, 199, 0.22)', label: __('Add-to-Cart', 'wooptionsfic'), unit: __('items', 'wooptionsfic') },
      orders: { color: '#10b981', fillStop: 'rgba(16, 185, 129, 0.22)', label: __('Orders', 'wooptionsfic'), unit: __('orders', 'wooptionsfic') },
      sales: { color: '#8b5cf6', fillStop: 'rgba(139, 92, 246, 0.24)', label: __('Addon Revenue', 'wooptionsfic'), unit: currencySymbol },
    };

    const currentTheme = metricThemes[activeMetric];

    return (
      <div className="wof-page wof-analytics-page wof-analytics-bespoke">
        {/* Modern Command Center Header */}
        <div className="wof-analytics-hero">
          <div className="wof-analytics-hero__info">
            <h1 className="wof-analytics-hero__title">{__('Performance & Conversions', 'wooptionsfic')}</h1>
            <p className="wof-analytics-hero__desc">
              {__('Track user choices, validation impact, and addon revenue contribution in real-time.', 'wooptionsfic')}
            </p>
          </div>

          <div className="wof-analytics-hero__actions">
            {/* Segmented Range Controls */}
            <div className="wof-segmented-range" role="group" aria-label={__('Reporting Period', 'wooptionsfic')}>
              {rangeOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.key}
                  className={`wof-segmented-range__btn ${range === opt.key ? 'is-active' : ''}`}
                  onClick={() => setRange(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="wof-refresh-btn"
              onClick={() => loadData(range)}
              title={__('Refresh data', 'wooptionsfic')}
              disabled={loading}
            >
              <WooptionsFic.Components.Dashicon name="update" />
            </button>
          </div>
        </div>

        {error ? (
          <WooptionsFic.Components.InlineNotice type="error" onClose={() => setError('')}>
            {error}
          </WooptionsFic.Components.InlineNotice>
        ) : null}

        {/* 4 Bespoke Executive KPI Cards */}
        <div className="wof-bespoke-kpi-grid">
          {/* Revenue Card */}
          <div
            className={`wof-bespoke-kpi-card wof-kpi--sales ${activeMetric === 'sales' ? 'is-active' : ''}`}
            onClick={() => setActiveMetric('sales')}
            role="button"
            tabIndex={0}
          >
            <div className="wof-bespoke-kpi-header">
              <span className="wof-bespoke-kpi-icon wof-icon--sales">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                  <path d="M12 18V6" />
                </svg>
              </span>
              <span className="wof-bespoke-kpi-title">{__('Total Sales (Addons)', 'wooptionsfic')}</span>
              {activeMetric === 'sales' ? (
                <span className="wof-kpi-active-pill">
                  <span className="wof-kpi-active-dot" />
                  {__('Active', 'wooptionsfic')}
                </span>
              ) : null}
            </div>
            <div className="wof-bespoke-kpi-body">
              <strong className="wof-bespoke-kpi-num">
                {formatMoney(data?.totals?.totalSales ?? 0, currencySymbol, currencyPosition)}
              </strong>
            </div>
            <div className="wof-bespoke-kpi-footer">
              <span className="wof-kpi-hint">{__('Net addon contribution to orders', 'wooptionsfic')}</span>
            </div>
          </div>

          {/* Orders Card */}
          <div
            className={`wof-bespoke-kpi-card wof-kpi--orders ${activeMetric === 'orders' ? 'is-active' : ''}`}
            onClick={() => setActiveMetric('orders')}
            role="button"
            tabIndex={0}
          >
            <div className="wof-bespoke-kpi-header">
              <span className="wof-bespoke-kpi-icon wof-icon--orders">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </span>
              <span className="wof-bespoke-kpi-title">{__('Total Orders (Addons)', 'wooptionsfic')}</span>
              {activeMetric === 'orders' ? (
                <span className="wof-kpi-active-pill">
                  <span className="wof-kpi-active-dot" />
                  {__('Active', 'wooptionsfic')}
                </span>
              ) : null}
            </div>
            <div className="wof-bespoke-kpi-body">
              <strong className="wof-bespoke-kpi-num">
                {data?.totals?.totalOrders ?? 0}
              </strong>
            </div>
            <div className="wof-bespoke-kpi-footer">
              <span className="wof-kpi-hint">{__('Completed checkouts with options', 'wooptionsfic')}</span>
            </div>
          </div>

          {/* Clicks Card */}
          <div
            className={`wof-bespoke-kpi-card wof-kpi--clicks ${activeMetric === 'clicks' ? 'is-active' : ''}`}
            onClick={() => setActiveMetric('clicks')}
            role="button"
            tabIndex={0}
          >
            <div className="wof-bespoke-kpi-header">
              <span className="wof-bespoke-kpi-icon wof-icon--clicks">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 15l5 5m-5-5l-2.5 7.5L11 14 3.5 11.5 11 9l4 6z" />
                </svg>
              </span>
              <span className="wof-bespoke-kpi-title">{__('Clicks Count', 'wooptionsfic')}</span>
              {activeMetric === 'clicks' ? (
                <span className="wof-kpi-active-pill">
                  <span className="wof-kpi-active-dot" />
                  {__('Active', 'wooptionsfic')}
                </span>
              ) : null}
            </div>
            <div className="wof-bespoke-kpi-body">
              <strong className="wof-bespoke-kpi-num">
                {data?.totals?.clicksCount ?? 0}
              </strong>
            </div>
            <div className="wof-bespoke-kpi-footer">
              <span className="wof-kpi-hint">{__('Customer field clicks & inputs', 'wooptionsfic')}</span>
            </div>
          </div>

          {/* Add-to-Cart Card */}
          <div
            className={`wof-bespoke-kpi-card wof-kpi--cart ${activeMetric === 'addToCart' ? 'is-active' : ''}`}
            onClick={() => setActiveMetric('addToCart')}
            role="button"
            tabIndex={0}
          >
            <div className="wof-bespoke-kpi-header">
              <span className="wof-bespoke-kpi-icon wof-icon--cart">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </span>
              <span className="wof-bespoke-kpi-title">{__('Add-to-Cart Count', 'wooptionsfic')}</span>
              {activeMetric === 'addToCart' ? (
                <span className="wof-kpi-active-pill">
                  <span className="wof-kpi-active-dot" />
                  {__('Active', 'wooptionsfic')}
                </span>
              ) : null}
            </div>
            <div className="wof-bespoke-kpi-body">
              <strong className="wof-bespoke-kpi-num">
                {data?.totals?.addToCartCount ?? 0}
              </strong>
            </div>
            <div className="wof-bespoke-kpi-footer">
              <span className="wof-kpi-hint">{__('Customized configurations carted', 'wooptionsfic')}</span>
            </div>
          </div>
        </div>

        {/* Visual Analytics Studio Card */}
        <section className="wof-panel wof-bespoke-chart-card">
          <div className="wof-bespoke-chart-header">
            <div>
              <h2 className="wof-bespoke-chart-title">
                {__('Telemetry Signal Timeline', 'wooptionsfic')}
              </h2>
              <p className="wof-bespoke-chart-subtitle">
                {sprintf(__('Daily progression of %s across active storefront option sets.', 'wooptionsfic'), currentTheme.label)}
              </p>
            </div>

            {/* Metric Switcher Tabs */}
            <div className="wof-metric-switcher" role="tablist">
              {(['clicks', 'addToCart', 'orders', 'sales'] as MetricType[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  role="tab"
                  aria-selected={activeMetric === m}
                  className={`wof-metric-tab ${activeMetric === m ? 'is-active' : ''}`}
                  onClick={() => setActiveMetric(m)}
                >
                  {metricThemes[m].label}
                </button>
              ))}
            </div>
          </div>

          <div className="wof-bespoke-chart-viewport">
            {loading ? (
              <div className="wof-bespoke-chart-loading">
                <span className="wof-loader" />
                <p>{__('Calculating telemetry metrics…', 'wooptionsfic')}</p>
              </div>
            ) : null}

            <div className="wof-bespoke-svg-wrap">
              <svg
                ref={chartSvgRef}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="wof-bespoke-chart-svg"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  <linearGradient id="wofBespokeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={currentTheme.color} stopOpacity="0.16" />
                    <stop offset="80%" stopColor={currentTheme.color} stopOpacity="0.02" />
                    <stop offset="100%" stopColor={currentTheme.color} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Dashed Lines */}
                {yTicks.map((tick, idx) => (
                  <g key={`ytick-${idx}`} className="wof-chart-tick-group">
                    <line
                      x1={padLeft}
                      y1={tick.y}
                      x2={chartWidth - padRight}
                      y2={tick.y}
                      stroke="#f1f5f9"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 12}
                      y={tick.y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#94a3b8"
                      fontWeight="400"
                      fontFamily="system-ui, sans-serif"
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}

                {/* Solid Baseline */}
                <line
                  x1={padLeft}
                  y1={baselineY}
                  x2={chartWidth - padRight}
                  y2={baselineY}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                {/* X-Axis Date Labels */}
                {xLabels.map((xl) => (
                  <text
                    key={`xlabel-${xl.idx}`}
                    x={xl.x}
                    y={baselineY + 22}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#64748b"
                    fontWeight="450"
                    fontFamily="system-ui, sans-serif"
                  >
                    {xl.label}
                  </text>
                ))}

                {/* Spline Area Gradient */}
                {areaD ? <path d={areaD} fill="url(#wofBespokeGrad)" /> : null}

                {/* Spline Path Stroke - Clean & Thin, No Blurry Shadow */}
                {strokeD ? (
                  <path
                    d={strokeD}
                    fill="none"
                    stroke={currentTheme.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* Interactive Crosshair & Cursor Anchor */}
                {hoveredCoord && hoveredPoint ? (
                  <g className="wof-chart-hover-indicator">
                    <line
                      x1={hoveredCoord.x}
                      y1={padTop}
                      x2={hoveredCoord.x}
                      y2={baselineY}
                      stroke={currentTheme.color}
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                      opacity="0.7"
                    />
                    <circle
                      cx={hoveredCoord.x}
                      cy={hoveredCoord.y}
                      r="5.5"
                      fill={currentTheme.color}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                  </g>
                ) : null}
              </svg>

              {/* Glassmorphic Interactive Floating Tooltip */}
              {hoveredCoord && hoveredPoint ? (
                <div
                  className="wof-bespoke-tooltip"
                  style={{
                    left: `${(hoveredCoord.x / chartWidth) * 100}%`,
                    top: `${(hoveredCoord.y / chartHeight) * 100}%`,
                  }}
                >
                  <div className="wof-bespoke-tooltip__head">
                    <span className="wof-bespoke-tooltip__calendar">📅</span>
                    <span>{hoveredPoint.label} ({hoveredPoint.date})</span>
                  </div>
                  <div className="wof-bespoke-tooltip__highlight">
                    <span>{currentTheme.label}:</span>
                    <strong>
                      {activeMetric === 'sales'
                        ? formatMoney(hoveredPoint.sales, currencySymbol, currencyPosition)
                        : activeMetric === 'orders'
                        ? hoveredPoint.orders
                        : activeMetric === 'addToCart'
                        ? hoveredPoint.addToCart
                        : hoveredPoint.clicks}
                    </strong>
                  </div>
                  <div className="wof-bespoke-tooltip__grid">
                    <div className="wof-tt-row">
                      <span className="wof-tt-dot wof-tt-dot--clicks" />
                      <span>{__('Clicks', 'wooptionsfic')}:</span>
                      <b>{hoveredPoint.clicks}</b>
                    </div>
                    <div className="wof-tt-row">
                      <span className="wof-tt-dot wof-tt-dot--cart" />
                      <span>{__('Add to Cart', 'wooptionsfic')}:</span>
                      <b>{hoveredPoint.addToCart}</b>
                    </div>
                    <div className="wof-tt-row">
                      <span className="wof-tt-dot wof-tt-dot--orders" />
                      <span>{__('Orders', 'wooptionsfic')}:</span>
                      <b>{hoveredPoint.orders}</b>
                    </div>
                    <div className="wof-tt-row">
                      <span className="wof-tt-dot wof-tt-dot--sales" />
                      <span>{__('Revenue', 'wooptionsfic')}:</span>
                      <b>{formatMoney(hoveredPoint.sales, currencySymbol, currencyPosition)}</b>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Option Sets Breakdown Table with 5-Item Pagination */}
        <section className="wof-panel wof-bespoke-table-card">
          <div className="wof-bespoke-table-header">
            <div>
              <h2 className="wof-bespoke-table-title">{__('Option Sets Performance', 'wooptionsfic')}</h2>
              <p className="wof-bespoke-table-desc">
                {__('Granular conversion rates and order contributions per option set.', 'wooptionsfic')}
              </p>
            </div>

            <div className="wof-bespoke-table-tools">
              <div className="wof-table-search-box">
                <span className="wof-search-icon" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={tableSearch}
                  onChange={(e: any) => setTableSearch(e.target.value)}
                  placeholder={__('Search option sets…', 'wooptionsfic')}
                  className="wof-table-search-input"
                />
              </div>
              <span className="wof-count-pill">
                {totalTableItems} {totalTableItems === 1 ? __('Set', 'wooptionsfic') : __('Sets', 'wooptionsfic')}
              </span>
            </div>
          </div>

          <div className="wof-bespoke-table-wrap">
            <table className="wof-analytics-table wof-analytics-table--bespoke">
              <thead>
                <tr>
                  <th className="wof-col-set">{__('OPTION SET', 'wooptionsfic')}</th>
                  <th className="wof-col-applied">{__('SCOPE', 'wooptionsfic')}</th>
                  <th className="wof-col-clickrate">{__('CLICK RATE', 'wooptionsfic')}</th>
                  <th className="wof-col-cartrate">{__('CART CONVERSION', 'wooptionsfic')}</th>
                  <th className="wof-col-sales">{__('ADDON REVENUE', 'wooptionsfic')}</th>
                  <th className="wof-col-actions">{__('ACTION', 'wooptionsfic')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOptionSets.length > 0 ? (
                  paginatedOptionSets.map((set) => (
                    <tr key={set.uuid} className="wof-table-row">
                      {/* Option Set Title & ID */}
                      <td className="wof-cell-set">
                        <div className="wof-set-identity">
                          <span className="wof-set-icon">
                            <WooptionsFic.Components.Dashicon name="screenoptions" />
                          </span>
                          <div className="wof-set-meta">
                            <button
                              type="button"
                              className="wof-set-name-link"
                              onClick={() => props?.navigate?.(`builder/${set.uuid}`)}
                              title={__('Edit in Option Set Builder', 'wooptionsfic')}
                            >
                              {set.name}
                            </button>
                            <span className="wof-set-sub">
                              ID: {set.id} &bull; {set.uuid.slice(0, 8)}…
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Products Scope with Real Thumbnail */}
                      <td className="wof-cell-applied">
                        <span className="wof-scope-pill">
                          {set.thumbnailUrl ? (
                            <img src={set.thumbnailUrl} alt="" className="wof-scope-thumb" />
                          ) : (
                            <span className="wof-scope-glyph-fallback" aria-hidden="true">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                              </svg>
                            </span>
                          )}
                          <span>{set.appliedText}</span>
                        </span>
                      </td>

                      {/* Click Rate with Visual Progress Bar */}
                      <td className="wof-cell-clickrate">
                        <div className="wof-rate-meter">
                          <div className="wof-rate-bar-track">
                            <div
                              className="wof-rate-bar-fill wof-fill--clicks"
                              style={{ width: `${Math.min(100, Math.max(0, set.clickRate))}%` }}
                            />
                          </div>
                          <span className="wof-rate-text">{set.clickRate}%</span>
                        </div>
                      </td>

                      {/* Cart Conversion Rate with Visual Progress Bar */}
                      <td className="wof-cell-cartrate">
                        <div className="wof-rate-meter">
                          <div className="wof-rate-bar-track">
                            <div
                              className="wof-rate-bar-fill wof-fill--cart"
                              style={{ width: `${Math.min(100, Math.max(0, set.addToCartRate))}%` }}
                            />
                          </div>
                          <span className="wof-rate-text">{set.addToCartRate}%</span>
                        </div>
                      </td>

                      {/* Sales Revenue */}
                      <td className="wof-cell-sales">
                        <div className="wof-sales-badge">
                          <strong className="wof-sales-amount">
                            {formatMoney(set.sales, currencySymbol, currencyPosition)}
                          </strong>
                          <span className="wof-sales-orders">
                            {set.orders} {set.orders === 1 ? __('order', 'wooptionsfic') : __('orders', 'wooptionsfic')}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="wof-cell-actions">
                        <button
                          type="button"
                          className="wof-table-action-btn"
                          onClick={() => props?.navigate?.(`builder/${set.uuid}`)}
                        >
                          <span>{__('Edit', 'wooptionsfic')}</span>
                          <span aria-hidden="true">&rarr;</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="wof-table-empty-row">
                      {loading
                        ? __('Calculating performance metrics…', 'wooptionsfic')
                        : tableSearch
                        ? __('No option sets match your search filter.', 'wooptionsfic')
                        : __('No option set activity recorded for this period.', 'wooptionsfic')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls - Shown if total items > 5 */}
          {totalTableItems > 5 ? (
            <div className="wof-table-pagination">
              <div className="wof-table-pagination__info">
                {sprintf(
                  __('Showing %1$d–%2$d of %3$d option sets', 'wooptionsfic'),
                  startItem,
                  endItem,
                  totalTableItems
                )}
              </div>

              <div className="wof-table-pagination__controls">
                <button
                  type="button"
                  className="wof-page-nav-btn"
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage(Math.max(1, tablePage - 1))}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>{__('Previous', 'wooptionsfic')}</span>
                </button>

                <div className="wof-page-number-list">
                  {Array.from({ length: totalTablePages }, (_, i) => i + 1).map((p) => (
                    <button
                      type="button"
                      key={p}
                      className={`wof-page-num-btn ${tablePage === p ? 'is-active' : ''}`}
                      onClick={() => setTablePage(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="wof-page-nav-btn"
                  disabled={tablePage >= totalTablePages}
                  onClick={() => setTablePage(Math.min(totalTablePages, tablePage + 1))}
                >
                  <span>{__('Next', 'wooptionsfic')}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          ) : totalTableItems > 0 ? (
            <div className="wof-table-pagination wof-table-pagination--compact">
              <span className="wof-table-pagination__info">
                {sprintf(__('Displaying all %d option sets', 'wooptionsfic'), totalTableItems)}
              </span>
            </div>
          ) : null}
        </section>
      </div>
    );
  }
}
