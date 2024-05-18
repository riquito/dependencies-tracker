import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { getCachedFilters } from './filters-cache.ts';
import { fetchLockfiles } from './fetch-lockfiles.ts';
import './index.css';
import { ThemeType, DefiniteThemeType, getThemePreference } from './theme.tsx';

// eslint-disable-next-line react-refresh/only-export-components
function Root({ lockfilesUrl }: { lockfilesUrl: string }) {
  const [repositories, setRepositories] = useState<null | string[]>(null);
  const [lockfiles, setLockfiles] = useState<null | LockfilesMap>(null);
  const [systemTheme, setSystemTheme] = useState<null | DefiniteThemeType>(null);
  const [theme, setTheme] = useState<null | ThemeType>(null);

  useEffect(() => {
    let mounted = true;

    fetchLockfiles(lockfilesUrl).then((lockfiles) => {
      if (mounted) {
        setLockfiles(lockfiles);
        setRepositories(Object.keys(lockfiles).sort());
      }
    });

    return () => {
      mounted = false;
    };
  }, [lockfilesUrl]);

  useEffect(() => {
    const appTheme = getThemePreference();
    let systemTheme: DefiniteThemeType = 'light';

    if (window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        systemTheme = 'light';
      } else {
        systemTheme = 'dark';
      }
    }

    const effectiveTheme: DefiniteThemeType = appTheme === 'auto' ? systemTheme : appTheme;
    document.body.classList.add(effectiveTheme === 'dark' ? 'dark-theme' : 'light-theme');

    const onSystemColorSchemePreferenceChanged = (event: MediaQueryListEvent) => {
      const newColorScheme = event.matches ? 'light' : 'dark';
      setSystemTheme(newColorScheme);
    };

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', onSystemColorSchemePreferenceChanged);

    setTheme(appTheme);
    setSystemTheme(systemTheme);

    return () => {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', onSystemColorSchemePreferenceChanged);
    };
  }, []);

  return lockfiles !== null && repositories !== null && systemTheme !== null && theme !== null ? (
    <App
      repositories={repositories}
      lockfiles={lockfiles}
      baseRepoUrl={window.baseRepoUrl}
      defaultSelectedRepos={getCachedFilters()}
      defaultQuery={new URLSearchParams(window.location.search).get('q') || ''}
      systemTheme={systemTheme}
      defaultTheme={theme === 'auto' ? systemTheme : theme}
    />
  ) : null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root lockfilesUrl={window.lockfilesUrl} />
  </React.StrictMode>
);
