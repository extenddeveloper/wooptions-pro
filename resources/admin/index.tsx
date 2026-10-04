(() => {
  const rootElement = document.getElementById('wooptions-pro-admin-root');
  if (!rootElement) return;
  try {
    wp.element.createRoot(rootElement).render(<WooOptionsPro.App />);
  } catch (error) {
    window.console.error('WooOptions Pro admin failed to initialize.', error);
    rootElement.innerHTML = '<div class="wof-fatal"><h1>The workshop hit a snag</h1><p>Your saved configuration is safe. Reload the page to restart the builder.</p><button type="button" onclick="window.location.reload()">Reload WooOptions Pro</button></div>';
  }
})();
