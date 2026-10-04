(() => {
  const rootElement = document.getElementById('wooptionsfic-admin-root');
  if (!rootElement) return;
  try {
    wp.element.createRoot(rootElement).render(<WooptionsFic.App />);
  } catch (error) {
    window.console.error('WooptionsFic admin failed to initialize.', error);
    rootElement.innerHTML = '<div class="wof-fatal"><h1>The workshop hit a snag</h1><p>Your saved configuration is safe. Reload the page to restart the builder.</p><button type="button" onclick="window.location.reload()">Reload WooptionsFic</button></div>';
  }
})();
