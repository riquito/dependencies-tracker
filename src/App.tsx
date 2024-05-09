import { useEffect, useRef, useState } from 'react';
import { YarnWhyJSONOutput, YarnWhyJSONOutputLeaf, yarnWhy } from './yarn-why';
import { RepoFilter } from './repo-filter';

// Icon from https://lucide.dev/icons/microscope
import searchIcon from '/search.svg';
/* @ts-ignore */
import yarnWhyData from './assets/yarn-why.wasm?raw-hex';
import { fetchLockfiles } from './fetch-lockfiles.ts';
import './App.css';
import { cleanFilters, deleteCachedFilters, setCachedFilters } from './filters-cache.ts';
import { Theme, ThemeType, getThemePreference, setThemePreference } from './theme.tsx';

const fromHexString = (hexString: string): ArrayBuffer =>
  Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

type SearchInputProps = {
  onSubmit: (query: string) => void;
};

function SearchInput({ onSubmit }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="search-input">
      <input
        ref={ref}
        type="text"
        placeholder="Search for dependencies, e.g. react"
        className="input"
        onKeyUp={(ev) => {
          const value = ev.currentTarget.value.trim();
          if (ev.key === 'Enter') {
            onSubmit(value);
          }
        }}
      />
      <button
        onClick={() => {
          const value = ref.current!.value.trim();
          onSubmit(value);
        }}
      >
        Search
      </button>
    </div>
  );
}

type LockFileProps = {
  repo: string;
  result: YarnWhyJSONOutput;
  packageName: string;
};

const COLORS = [
  'palette-1',
  'palette-2',
  'palette-3',
  'palette-4',
  'palette-5',
  'palette-6',
  'palette-7',
  'palette-8',
  'palette-9',
];
let COLORS_IDX = 2;

const VERSION_TO_COLOR: Record<string, string> = {};

function getColorForVersion(version: string): string {
  if (version in VERSION_TO_COLOR) {
    return VERSION_TO_COLOR[version];
  } else {
    const color = COLORS[COLORS_IDX];
    COLORS_IDX = (COLORS_IDX + 1) % COLORS.length;
    VERSION_TO_COLOR[version] = color;
    return color;
  }
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const elemTop = rect.top;
  const elemBottom = rect.bottom;

  // Only completely visible elements return true:
  const isVisible = elemTop >= 0 && elemBottom <= window.innerHeight;
  // Partially visible elements return true:
  //isVisible = elemTop < window.innerHeight && elemBottom >= 0;
  return isVisible;
}

function renderTarget({ name, version }: { name: string; version: string }) {
  const color = getColorForVersion(version);
  return (
    <span className="target">
      <span className="target-name">{name}</span>@
      <span className="target-version" style={{ color: `var(--${color})` }}>
        {version}
      </span>
    </span>
  );
}

function renderDescriptor(
  [name, version]: [string, string],
  isTargetPackage: IsTargetPackage,
  repo: string,
  isLeaf: boolean
) {
  const id = `${repo}:${name}@${version}`;
  const text = `${name}@${version}`;

  return (
    <span className={`descriptor`} id={id}>
      {isTargetPackage(name) ? (
        renderTarget({ name, version })
      ) : isLeaf ? (
        <a
          href={`#${id}`}
          onClick={(ev) => {
            const targetId = ev.currentTarget.getAttribute('href')!.slice(1);
            const anchor = document.getElementById(targetId)!;
            anchor.classList.remove('blink_me');
            anchor.offsetHeight; // force repaint to trigger repaint and set `animation-name: none;`
            anchor.classList.add('blink_me');

            if (isVisible(anchor)) {
              ev.preventDefault();
            }
          }}
        >
          {text}
        </a>
      ) : (
        text
      )}
    </span>
  );
}

type IsTargetPackage = (s: string) => boolean;

function renderDependencyRow(node: YarnWhyJSONOutputLeaf, isTargetPackage: IsTargetPackage, repo: string) {
  return (
    <li key={node.descriptor.join('@')}>
      {renderDescriptor(node.descriptor, isTargetPackage, repo, !(node.children && node.children.length > 0))}
      {node.children && <ul>{node.children.map((n) => renderDependencyRow(n, isTargetPackage, repo))}</ul>}
    </li>
  );
}

function SearchLockFile({ repo, result, packageName }: LockFileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isTargetPackage = (name: string) => name === packageName;

  return (
    <details className="search-results-item">
      <summary
        className="search-results-repo-name"
        onClick={(_) => {
          ref.current!.querySelectorAll('.blink_me').forEach((elem) => {
            elem.classList.remove('blink_me');
          });
        }}
      >
        {repo}
      </summary>
      <div ref={ref}>
        <ul>
          {result.map((node: YarnWhyJSONOutputLeaf) => {
            return renderDependencyRow(node, isTargetPackage, repo);
          })}
        </ul>
      </div>
    </details>
  );
}

/**
 * Check if a package is in the yarn lock file, on best effort basis.
 * It can return false positives, but never false negatives.
 */
function isPackageMaybeInLockFile(lockFile: string, packageName: string): boolean {
  // If the package is in the yarn lock file, it should at least be present
  // in the form <packageName>@ (maybe followed by version, maybe not, depend on yarn version)
  return lockFile.includes(packageName + '@');
}

function getLockfilesWithMaybePackage(lockFiles: LockfilesMap, packageName: string): string[] {
  if (packageName === '') {
    return [];
  }

  return Object.keys(lockFiles).filter((repo) => {
    return isPackageMaybeInLockFile(lockFiles[repo], packageName);
  });
}

export type AppProps = {
  lockfilesUrl: string;
  defaultSelectedRepos: Set<string>;
};

function App({ lockfilesUrl, defaultSelectedRepos }: AppProps) {
  const [repositories, setRepositories] = useState<string[]>([]);
  const [lockfiles, setLockfiles] = useState<LockfilesMap>({});
  const [packageQuery, setPackageQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [reposWithMaybePackage, setReposWithMaybePackage] = useState<string[]>([]);
  const [wasm, setWasm] = useState<WebAssembly.Module>();
  const [searchResult, setSearchResult] = useState<[string, YarnWhyJSONOutput][]>([]);
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState(new Set<string>(defaultSelectedRepos));
  const [theme, setTheme] = useState<ThemeType>('auto');
  const [systemTheme, setSystemTheme] = useState<ThemeType>('dark');

  useEffect(() => {
    fetchLockfiles(lockfilesUrl).then((lockfiles) => {
      const repositories = Object.keys(lockfiles);
      const cleanedSelectedRepos = cleanFilters(selectedRepos, repositories);
      setLockfiles(lockfiles);
      setRepositories(repositories);
      setSelectedRepos(cleanedSelectedRepos.size > 0 ? cleanedSelectedRepos : new Set(repositories));
    });
  }, [lockfilesUrl]);

  useEffect(() => {
    WebAssembly.compile(fromHexString(yarnWhyData)).then(setWasm).catch(console.error);
  }, []);

  useEffect(() => {
    if (packageQuery && wasm && reposWithMaybePackage.length > 0) {
      Promise.all(
        reposWithMaybePackage
          .filter((repo) => selectedRepos.has(repo))
          .map<Promise<[string, YarnWhyJSONOutput | null]>>((repo) =>
            yarnWhy({ lockFile: lockfiles[repo], query: packageQuery, wasm }).then((output) => {
              return [repo, output];
            })
          )
      ).then((pairs: [string, YarnWhyJSONOutput | null][]) => {
        const pairsRepoMatches = pairs.filter(([_, output]) => output !== null) as [string, YarnWhyJSONOutput][];
        setSearchResult(pairsRepoMatches);
        setIsSearching(false);
      });
    } else if (reposWithMaybePackage.length === 0) {
      setIsSearching(false);
    }
  }, [wasm, packageQuery, reposWithMaybePackage, lockfiles, selectedRepos]);

  useEffect(() => {
    const effectiveTheme = (theme === 'auto' && systemTheme) || theme;
    document.body.classList.toggle('dark-theme', effectiveTheme === 'dark');
    document.body.classList.toggle('light-theme', effectiveTheme === 'light');

    document.body.parentElement!.style.colorScheme = effectiveTheme;
  }, [theme, systemTheme]);

  useEffect(() => {
    if (window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setSystemTheme('light');
      } else {
        setSystemTheme('dark');
      }
    }
    const onSystemColorSchemePreferenceChanged = (event: any) => {
      const newColorScheme = event.matches ? 'light' : 'dark';
      setSystemTheme(newColorScheme);
    };

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', onSystemColorSchemePreferenceChanged);

    return () => {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', onSystemColorSchemePreferenceChanged);
    };
  }, []);

  return (
    <>
      <Theme
        value={theme}
        onChange={(theme) => {
          setThemePreference(theme);
          setTheme(theme);
        }}
      />
      <h1 className="main-title">
        <img src={searchIcon} className="logo" alt="Dependencies Tracker logo" /> Dependencies Tracker
      </h1>

      <div className="repo-filter-title" style={{ display: filterPanelVisible ? 'none' : 'block' }}>
        {selectedRepos.size === repositories.length ? (
          'Search in all repositories'
        ) : (
          <>
            Search in <b>{selectedRepos.size}</b> out of <b>{repositories.length}</b> repositories
          </>
        )}
        <button id="openFilterPanelButton" onClick={() => setFilterPanelVisible(true)}>
          Show filters panel
        </button>
      </div>
      {filterPanelVisible && (
        <RepoFilter
          repositories={repositories}
          selectedRepositories={selectedRepos}
          onChange={(selectedRepos) => {
            if (selectedRepos.size > 0) {
              setSelectedRepos(selectedRepos);
              if (selectedRepos.size === repositories.length) {
                // "all" means that if new repositories later appears we want to see them
                deleteCachedFilters();
              } else {
                setCachedFilters(selectedRepos);
              }
            }
            setFilterPanelVisible(false);
            setTimeout(() => {
              document.getElementById('openFilterPanelButton')!.focus();
            }, 30);
          }}
        />
      )}

      <div className="search-bar">
        <SearchInput
          onSubmit={(query) => {
            if (query !== packageQuery) {
              // If query is in the form foo@1.2.3 (perhaps copy-pasted from results)
              // then replace @ with space (need extra care to handle namespaces or versions
              // with @ in them)
              query = query.replace(/^(@?[A-Za-z0-9_/-]+)@/, '$1 ');
              const packageName = query ? query.split(' ')[0] : '';
              setPackageQuery(query);
              setSearchResult([]);
              setIsSearching(true);
              setReposWithMaybePackage(getLockfilesWithMaybePackage(lockfiles, packageName));
            }
          }}
        />
        <div className="search-examples">
          <div className="example">{'e.g. react'}</div>
          <div className="example">{'e.g. react ^19.0.0'}</div>
          <div className="example">{'e.g. react >=15.0.0, <20.0.0'}</div>
        </div>
      </div>

      {packageQuery.length > 0 && (
        <div className="search-results">
          <h3 className="search-results-header">Search Results</h3>
          <div>
            Query: <b>{packageQuery}</b>
          </div>
          {searchResult.length > 0 && (
            <div className="search-results-count">
              <b>{searchResult.reduce((acc, [_, result]) => acc + result.length, 0)}</b> top level dependencies found
              across <b>{searchResult.length}</b> repositories
            </div>
          )}
          {searchResult.map(([repo, result]) => (
            <SearchLockFile key={repo} repo={repo} result={result} packageName={packageQuery.split(' ')[0]} />
          ))}
          {isSearching && <div className="search-results-loading">Loading...</div>}
          {!isSearching && searchResult.length === 0 && (
            <div className="search-results-no-results">No results found</div>
          )}
        </div>
      )}
    </>
  );
}

export default App;
