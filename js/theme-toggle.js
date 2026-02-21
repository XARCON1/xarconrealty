(() => {
  const STORAGE_KEY = 'theme';
  const root = document.documentElement;

  const getSystemTheme = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const getSavedTheme = () => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : null;
  };

  const getPreferredTheme = () => getSavedTheme() || getSystemTheme();

  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
  };

  const syncToggleState = (theme) => {
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      const isDark = theme === 'dark';
      button.setAttribute('aria-pressed', String(isDark));
      button.setAttribute('data-mode', theme);
      button.setAttribute('aria-label', `Switch theme (currently ${isDark ? 'dark' : 'light'})`);
    });
  };

  const initializeTheme = () => {
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);
    syncToggleState(initialTheme);
  };

  const bindToggleEvents = () => {
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        const currentTheme = root.getAttribute('data-theme') || getPreferredTheme();
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        syncToggleState(nextTheme);
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      });
    });
  };

  const watchSystemTheme = () => {
    if (!window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (getSavedTheme()) {
        return;
      }

      const preferredTheme = mediaQuery.matches ? 'dark' : 'light';
      applyTheme(preferredTheme);
      syncToggleState(preferredTheme);
    });
  };

  initializeTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeTheme();
      bindToggleEvents();
      watchSystemTheme();
    });
  } else {
    bindToggleEvents();
    watchSystemTheme();
  }
})();
