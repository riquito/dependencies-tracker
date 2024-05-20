import { memo, useEffect, useRef, useState } from 'react';
import { YarnWhyJSONOutput, YarnWhyJSONOutputLeaf, yarnWhy } from './yarn-why';
import { RepoFilter } from './repo-filter';

/* @ts-expect-error typescript cannot understand how we load this file */
import yarnWhyData from './assets/yarn-why.wasm?raw-hex';
import './App.css';
import { cleanFilters, deleteCachedFilters, setCachedFilters } from './filters-cache.ts';
import { DefiniteThemeType, Theme, ThemeType, applyTheme, setThemePreference } from './theme.tsx';
import { Stats } from './stats.tsx';

const fromHexString = (hexString: string): ArrayBuffer =>
  Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

type SearchInputProps = {
  defaultValue: string;
  onSubmit: (query: string) => void;
};

function SearchInput({ onSubmit, defaultValue }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="search-input">
      <input
        ref={ref}
        type="text"
        placeholder="Search for dependencies, e.g. react"
        className="input"
        defaultValue={defaultValue}
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
  baseRepoUrl: string;
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

function renderTarget(node: YarnWhyJSONOutputLeaf): JSX.Element {
  const [name, descriptor] = node.descriptor;
  const version = node.version;
  const color = getColorForVersion(version);
  return (
    <span className="target">
      <span className="target-name">{name}</span>@
      <span className="target-version" style={{ color: `var(--${color})` }}>
        {version}
      </span>
      <span> (via {descriptor})</span>
    </span>
  );
}

function renderDependencyInfo(
  node: YarnWhyJSONOutputLeaf,
  isTargetPackage: IsTargetPackage,
  repo: string,
  isLeaf: boolean
) {
  const [name, descriptor] = node.descriptor;
  const version = node.version;
  const id = `${repo}:${name}@${version}`;
  const text = `${name}@${version} (via ${descriptor})`;

  return (
    <span className={`descriptor`} id={id}>
      {isTargetPackage(name) ? (
        renderTarget(node)
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

function renderDependencyRow(node: YarnWhyJSONOutputLeaf, isTargetPackage: IsTargetPackage, repo: string) {
  return (
    <li key={node.descriptor.join('@')}>
      {renderDependencyInfo(node, isTargetPackage, repo, !(node.children && node.children.length > 0))}
      {node.children && <ul>{node.children.map((n) => renderDependencyRow(n, isTargetPackage, repo))}</ul>}
    </li>
  );
}

const SearchLockFile = memo(({ repo, result, packageName, baseRepoUrl }: LockFileProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isTargetPackage = (name: string) => name === packageName;

  return (
    <details className="search-results-item">
      <summary
        className="search-results-repo-name"
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onClick={(_) => {
          ref.current!.querySelectorAll('.blink_me').forEach((elem) => {
            elem.classList.remove('blink_me');
          });
        }}
      >
        {repo}
        <a className="search-results-repo-link" href={`${baseRepoUrl}/${repo}`} target="_blank">
          <span className="material-symbols-outlined">open_in_new</span>
        </a>
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
});

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
  repositories: string[];
  lockfiles: LockfilesMap;
  baseRepoUrl: string;
  defaultSelectedRepos: Set<string>;
  defaultQuery: string;
  systemTheme: DefiniteThemeType;
  defaultTheme: ThemeType;
};

function App({
  repositories,
  lockfiles,
  baseRepoUrl,
  defaultSelectedRepos,
  defaultQuery,
  systemTheme,
  defaultTheme,
}: AppProps) {
  const [packageQuery, setPackageQuery] = useState(defaultQuery);
  const [isSearching, setIsSearching] = useState(defaultQuery !== '');
  const [reposWithMaybePackage, setReposWithMaybePackage] = useState<string[]>([]);
  const [wasm, setWasm] = useState<WebAssembly.Module>();
  const [searchResult, setSearchResult] = useState<[string, YarnWhyJSONOutput][]>([]);
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState(new Set<string>(defaultSelectedRepos));
  const [theme, setTheme] = useState<ThemeType>(defaultTheme);

  useEffect(() => {
    // Remove any previously selected repository that is no longer available
    const cleanedSelectedRepos = cleanFilters(selectedRepos, repositories);
    const newSetSelectedRepos = cleanedSelectedRepos.size > 0 ? cleanedSelectedRepos : new Set(repositories);

    const newSetSelectedReposAsArray = Array.from(newSetSelectedRepos.values());
    newSetSelectedReposAsArray.sort();

    const selectedReposAsArray = Array.from(selectedRepos.values());
    selectedReposAsArray.sort();

    // Update "selectedRepositories" only if the new set actually differ
    if (JSON.stringify(newSetSelectedReposAsArray) !== JSON.stringify(selectedReposAsArray)) {
      setSelectedRepos(newSetSelectedRepos);
    }
  }, [repositories, selectedRepos]);

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const pairsRepoMatches = pairs.filter(([_, output]) => output !== null) as [string, YarnWhyJSONOutput][];
        setSearchResult(pairsRepoMatches);
        setIsSearching(false);
      });
    } else if (reposWithMaybePackage.length === 0) {
      setIsSearching(false);
    }
  }, [wasm, packageQuery, reposWithMaybePackage, lockfiles, selectedRepos]);

  useEffect(() => {
    const effectiveTheme: DefiniteThemeType = theme === 'auto' ? systemTheme : theme;
    applyTheme(effectiveTheme);
  }, [theme, systemTheme]);

  useEffect(() => {
    if (packageQuery && Object.keys(lockfiles).length > 0) {
      // If query is in the form foo@1.2.3 (perhaps copy-pasted from results)
      // then replace @ with space (need extra care to handle namespaces or versions
      // with @ in them)
      let normalizedQuery = packageQuery.replace(/^(@?[A-Za-z0-9_/-]+)@/, '$1 ');

      // Since the underlying semver library use cargo semantics ("simple" versions
      // defaults to caret ^), we normalize to specic version here
      // e.g. we transform `foo 1.2` into `foo =1.2`
      const match = /(^[^ ]+) +([0-9][0-9a-zA-Z-_.]?.*)$/.exec(normalizedQuery);
      if (match) {
        normalizedQuery = `${match[1]} =${match[2]}`;
      }

      if (normalizedQuery !== packageQuery) {
        // recursive, it wil trigger this useEffect again
        setPackageQuery(normalizedQuery);
      } else {
        const packageName = packageQuery ? packageQuery.split(' ')[0] : '';

        setSearchResult([]);
        setIsSearching(true);
        setReposWithMaybePackage(getLockfilesWithMaybePackage(lockfiles, packageName));

        // update URL to allow users to share the link'
        const currentQueryInUrl = new URLSearchParams(window.location.search).get('q') || '';
        if (currentQueryInUrl !== packageQuery) {
          history.pushState({}, '', '?' + new URLSearchParams({ q: packageQuery }).toString());

          document.title = `Dependencies Tracker - ${packageQuery}`;
        }
      }
    }
  }, [packageQuery, lockfiles]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onPopstate = (_: PopStateEvent) => {
      const currentQueryInUrl = new URLSearchParams(window.location.search).get('q') || '';
      setPackageQuery(currentQueryInUrl);

      // XXX should use ref or controlled state
      const inputElem: HTMLInputElement = document.querySelector('.search-input input')!;
      inputElem.value = currentQueryInUrl;
    };
    window.addEventListener('popstate', onPopstate);

    return () => {
      window.removeEventListener('popstate', onPopstate);
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
        {/* Icon from https://lucide.dev/icons/microscope */}
        <img src="./search.svg" className="logo" aria-label="Dependencies Tracker logo" /> Dependencies Tracker
      </h1>

      <div className="repo-filter-desc" style={{ display: filterPanelVisible ? 'none' : 'block' }}>
        {selectedRepos.size === repositories.length ? (
          'Search in all repositories'
        ) : (
          <>
            Search in <b className="repo-filter-customized">{selectedRepos.size}</b> out of <b>{repositories.length}</b>{' '}
            repositories
          </>
        )}
        <button
          id="openFilterPanelButton"
          className={selectedRepos.size !== repositories.length ? 'repo-filter-customized' : ''}
          onClick={() => setFilterPanelVisible(true)}
        >
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
        <SearchInput onSubmit={(query) => setPackageQuery(query)} defaultValue={packageQuery} />
        <div className="search-examples">
          <div className="example">{'e.g. react'}</div>
          <div className="example">{'e.g. react ^19.0.0'}</div>
          <div className="example">{'e.g. react >=15.0.0, <20.0.0'}</div>
        </div>
      </div>

      {isSearching && (
        <div className="search-results-skeleton">
          <div className="search-results-skeleton-bar1" />
          <div className="search-results-skeleton-bar2" />
          <div className="search-results-skeleton-list">
            <div className="search-results-skeleton-item" />
            <div className="search-results-skeleton-item" />
            <div className="search-results-skeleton-item" />
            <div className="search-results-skeleton-item" />
            <div className="search-results-skeleton-item" />
          </div>
        </div>
      )}

      {!isSearching && packageQuery.length > 0 && (
        <div className="search-results">
          <div className="search-results-header">
            <div className="search-results-header-title">
              <div className="search-results-header-title-label">Searched for:</div>
              {packageQuery}
            </div>
            <div className="search-results-header-links">
              <button
                className="btn-link copy-search-url"
                onClick={(ev: React.MouseEvent<HTMLButtonElement>) => {
                  ev.currentTarget.classList.add('hidden');
                  document.querySelector('.search-url-copied')!.classList.remove('hidden');
                  navigator.clipboard.writeText(document.location.href);
                  setTimeout(() => {
                    document.querySelector('.search-url-copied')!.classList.add('hidden');
                    document.querySelector('.copy-search-url')!.classList.remove('hidden');
                  }, 3000);
                }}
              >
                <span className="material-symbols-outlined">content_copy</span>
                copy url
              </button>
              <span className="search-url-copied hidden">
                <span className="material-symbols-outlined">check</span>
                url copied!
              </span>
            </div>
          </div>
          {searchResult.length > 0 && (
            <Stats
              searchResult={searchResult}
              packageQuery={packageQuery}
              onVersionClick={(version: string): void => {
                const packageName = packageQuery.split(' ')[0];
                const query = `${packageName} =${version}`;
                setPackageQuery(`${packageName} =${version}`);

                // XXX should use ref or controlled state
                const inputElem: HTMLInputElement = document.querySelector('.search-input input')!;
                inputElem.value = query;
              }}
            />
          )}
          {searchResult.length > 0 && <div className="search-results-label">Results:</div>}
          {searchResult.map(([repo, result]) => (
            <SearchLockFile
              key={repo}
              repo={repo}
              result={result}
              packageName={packageQuery.split(' ')[0]}
              baseRepoUrl={baseRepoUrl}
            />
          ))}
          {!isSearching && searchResult.length === 0 && (
            <div className="search-results-no-results">No results found</div>
          )}
        </div>
      )}
    </>
  );
}

export default App;
