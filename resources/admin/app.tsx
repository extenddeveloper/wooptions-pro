namespace WooOptionsPro {
  const { useEffect, useState } = wp.element;
  const { __ } = wp.i18n;

  function routeFromLocation(): string {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash) {
      return hash;
    }
    try {
      const url = new URL(window.location.href);
      const pageParam = url.searchParams.get('page');
      if (pageParam === 'wooptions-pro-license') return 'license';
      if (pageParam === 'wooptions-pro-option-sets') return 'option-sets';
      if (pageParam === 'wooptions-pro-templates') return 'templates';
      if (pageParam === 'wooptions-pro-analytics') return 'analytics';
      if (pageParam === 'wooptions-pro-settings') return 'settings';
      if (pageParam === 'wooptions-pro') return 'dashboard';
    } catch (e) {}
    return window.WooOptionsProAdmin?.initialRoute || 'dashboard';
  }

  function getPageSlugForRoute(r: string): string {
    if (r === 'license') return 'wooptions-pro-license';
    if (r === 'option-sets') return 'wooptions-pro-option-sets';
    if (r === 'templates') return 'wooptions-pro-templates';
    if (r === 'analytics') return 'wooptions-pro-analytics';
    if (r === 'settings') return 'wooptions-pro-settings';
    return 'wooptions-pro';
  }

  export function injectCustomFontsCss(customFonts: any[]): void {
    if (!Array.isArray(customFonts) || customFonts.length === 0) return;
    const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
    const fixUrl = (url: string) => {
      if (!url || typeof url !== 'string') return '';
      return isHttps ? url.replace(/^http:\/\//i, 'https://') : url;
    };
    let css = '';
    for (const font of customFonts) {
      const files = font.files || {};
      const sources: string[] = [];
      if (files.woff2) {
        const u = fixUrl(files.woff2);
        sources.push(`url('${u}') format('woff2')`, `url('${u}')`);
      }
      if (files.woff) {
        const u = fixUrl(files.woff);
        sources.push(`url('${u}') format('woff')`, `url('${u}')`);
      }
      if (files.ttf) {
        const u = fixUrl(files.ttf);
        sources.push(`url('${u}') format('truetype')`, `url('${u}') format('opentype')`, `url('${u}')`);
      }
      if (files.otf) {
        const u = fixUrl(files.otf);
        sources.push(`url('${u}') format('opentype')`, `url('${u}') format('truetype')`, `url('${u}')`);
      }
      if (sources.length === 0) continue;
      const cleanName = (font.family || font.name || '').split(',')[0].replace(/['"]/g, '').trim();
      css += `@font-face {\n  font-family: '${cleanName}';\n  src: ${sources.join(', ')};\n  font-weight: 100 900;\n  font-style: ${font.style || 'normal'};\n  font-display: swap;\n}\n`;
      if (cleanName.includes(' ')) {
        css += `@font-face {\n  font-family: ${cleanName};\n  src: ${sources.join(', ')};\n  font-weight: 100 900;\n  font-style: ${font.style || 'normal'};\n  font-display: swap;\n}\n`;
      }
    }
    let el = document.getElementById('wof-dynamic-custom-fonts');
    if (!el) {
      el = document.createElement('style');
      el.id = 'wof-dynamic-custom-fonts';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  export function App(): any {
    const [route, setRoute] = useState(routeFromLocation());
    useEffect(() => {
      const update = () => setRoute(routeFromLocation());
      window.addEventListener('hashchange', update);
      window.addEventListener('popstate', update);
      injectCustomFontsCss(((window.WooOptionsProAdmin?.settings as any)?.custom_fonts) || []);

      // Normalize URL if opened on a subpage like wooptions-pro-license#/builder/...
      const initial = routeFromLocation();
      if (initial.startsWith('builder/')) {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get('page') !== 'wooptions-pro') {
            url.searchParams.set('page', 'wooptions-pro');
            window.history.replaceState({ route: initial }, '', url.toString());
          }
        } catch (e) {}
      }

      return () => {
        window.removeEventListener('hashchange', update);
        window.removeEventListener('popstate', update);
      };
    }, []);

    const navigate = (nextRoute: string) => {
      const nextHash = `#/${nextRoute}`;
      const targetPage = getPageSlugForRoute(nextRoute);

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', targetPage);
        url.hash = nextHash;
        if (window.location.href !== url.toString()) {
          window.history.pushState({ route: nextRoute }, '', url.toString());
        }
      } catch (e) {
        window.location.hash = nextHash;
      }
      setRoute(nextRoute);
    };

    let page: any;
    if (route.startsWith('builder/')) {
      page = <WooOptionsPro.Builder.BuilderPage uuid={route.slice('builder/'.length)} navigate={navigate} />;
    } else {
      switch (route) {
        case 'dashboard': page = <WooOptionsPro.Pages.Dashboard navigate={navigate} />; break;
        case 'option-sets': page = <WooOptionsPro.Pages.OptionSets navigate={navigate} />; break;
        case 'templates': page = <WooOptionsPro.Pages.Templates navigate={navigate} />; break;
        case 'analytics': page = <WooOptionsPro.Pages.Analytics navigate={navigate} />; break;
        case 'settings': page = <WooOptionsPro.Pages.Settings />; break;
        case 'license': page = <WooOptionsPro.Pages.LicensePage navigate={navigate} />; break;
        default: page = <div className="wof-fatal"><h1>{__('Page not found', 'wooptions-pro')}</h1><p>{__('This WooOptions Pro route does not exist.', 'wooptions-pro')}</p><button type="button" onClick={() => navigate('dashboard')}>{__('Open dashboard', 'wooptions-pro')}</button></div>;
      }
    }
    return <WooOptionsPro.Components.AdminShell route={route} navigate={navigate}>{page}</WooOptionsPro.Components.AdminShell>;
  }
}
