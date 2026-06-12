// Translate strings injected from JS, using the same dict (#dp-i18n) and
// language flag (dp-lang) that ui.js uses for the static data-i18n pass.
export function t(key, fallback) {
  try {
    if (localStorage.getItem('dp-lang') !== 'ar') return fallback;
    const dict = JSON.parse(document.getElementById('dp-i18n')?.textContent || '{}');
    return dict[key] || fallback;
  } catch {
    return fallback;
  }
}
