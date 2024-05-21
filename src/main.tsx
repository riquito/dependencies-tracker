import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { keepOnlyValidRepositories, getCachedFilters } from './filters-cache.ts';
import { fetchLockfiles } from './fetch-lockfiles.ts';
import './index.css';
import { ThemeType, DefiniteThemeType, getThemePreference, applyTheme } from './theme.tsx';
import { sha256 } from './utils.ts';

function getDefaultSelectedRepos(repoHashes: Record<string, string>): Set<string> {
  const filteredRepos = new URLSearchParams(window.location.search).get('repos');
  if (filteredRepos) {
    const desiredRepos = filteredRepos
      .split(',')
      .map((hash) => repoHashes[hash])
      .filter((x) => x !== undefined);
    return new Set(desiredRepos);
  } else {
    return getCachedFilters();
  }
}

// eslint-disable-next-line react-refresh/only-export-components
function Root({ lockfilesUrl }: { lockfilesUrl: string }) {
  const [repositories, setRepositories] = useState<null | string[]>(null);
  const [repoHashes, setRepoHashes] = useState<null | Record<string, string>>(null);
  const [lockfiles, setLockfiles] = useState<null | LockfilesMap>(null);
  const [systemTheme, setSystemTheme] = useState<null | DefiniteThemeType>(null);
  const [theme, setTheme] = useState<null | ThemeType>(null);
  const [defaultSelectedRepos, setDefaultSelectedRepos] = useState<null | Set<string>>(null);

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
    applyTheme(effectiveTheme);

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

  useEffect(() => {
    if (repositories !== null && repoHashes !== null) {
      const repositoriesSubset = getDefaultSelectedRepos(repoHashes);
      const repositoriesAsSet = new Set(repositories);
      // Remove any previously selected repository that is no longer available
      const cleanedSelectedRepos = keepOnlyValidRepositories(repositoriesSubset, repositoriesAsSet);
      const newSelectedRepos = cleanedSelectedRepos.size > 0 ? cleanedSelectedRepos : repositoriesAsSet;
      setDefaultSelectedRepos(newSelectedRepos);
    }
  }, [repositories, repoHashes]);

  useEffect(() => {
    (async () => {
      if (repositories !== null) {
        const fullHashes = await Promise.all(repositories.map((repo) => sha256(repo)));
        const shortHashes = fullHashes.map((hash) => hash.slice(0, 7));
        setRepoHashes(
          shortHashes.reduce(
            (acc, hash, i) => {
              acc[hash] = repositories[i];
              return acc;
            },
            {} as Record<string, string>
          )
        );
      }
    })();
  }, [repositories]);

  return lockfiles !== null &&
    repositories !== null &&
    repoHashes !== null &&
    systemTheme !== null &&
    theme !== null &&
    defaultSelectedRepos !== null ? (
    <App
      repositories={repositories}
      repoHashes={repoHashes}
      lockfiles={lockfiles}
      baseRepoUrl={window.baseRepoUrl}
      defaultSelectedRepos={defaultSelectedRepos}
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
