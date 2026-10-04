namespace WooptionsFic {
  const { useEffect, useState } = wp.element;
  const { __ } = wp.i18n;

  function routeFromLocation(): string {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    return hash || window.WooptionsFicAdmin.initialRoute || 'dashboard';
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
      injectCustomFontsCss(((window.WooptionsFicAdmin?.settings as any)?.custom_fonts) || []);
      return () => window.removeEventListener('hashchange', update);
    }, []);

    const navigate = (nextRoute: string) => {
      const nextHash = `#/${nextRoute}`;
      if (window.location.hash === nextHash) setRoute(nextRoute);
      else window.location.hash = nextHash;
    };

    let page: any;
    if (route.startsWith('builder/')) {
      page = <WooptionsFic.Builder.BuilderPage uuid={route.slice('builder/'.length)} navigate={navigate} />;
    } else {
      switch (route) {
        case 'dashboard': page = <WooptionsFic.Pages.Dashboard navigate={navigate} />; break;
        case 'option-sets': page = <WooptionsFic.Pages.OptionSets navigate={navigate} />; break;
        case 'templates': page = <WooptionsFic.Pages.Templates navigate={navigate} />; break;
        case 'analytics': page = <WooptionsFic.Pages.Analytics navigate={navigate} />; break;
        case 'settings': page = <WooptionsFic.Pages.Settings />; break;
        default: page = <div className="wof-fatal"><h1>{__('Page not found', 'wooptionsfic')}</h1><p>{__('This WooptionsFic route does not exist.', 'wooptionsfic')}</p><button type="button" onClick={() => navigate('dashboard')}>{__('Open dashboard', 'wooptionsfic')}</button></div>;
      }
    }
    return <WooptionsFic.Components.AdminShell route={route} navigate={navigate}>{page}</WooptionsFic.Components.AdminShell>;
  }
}
