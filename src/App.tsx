import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { YarnWhyJSONOutput, YarnWhyJSONOutputLeaf, yarnWhy } from './yarn-why';
import { RepoFilter } from './repo-filter';

/* @ts-expect-error typescript cannot understand how we load this file */
import yarnWhyData from './assets/yarn-why.wasm?raw-hex';
import './App.css';
import { deleteCachedFilters, setCachedFilters } from './filters-cache.ts';
import { DefiniteThemeType, Theme, ThemeType, applyTheme, setThemePreference } from './theme.tsx';
import { Stats } from './stats.tsx';
import { sha256 } from './utils.ts';

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
    <span className="search-results-dependency target">
      <span className="material-symbols-outlined">check</span>
      <span className="target-name">{name}</span>@
      <span className="target-version" style={{ color: `var(--${color})` }}>
        {version}
      </span>
      <span className="via-descriptor">
        <span className="parens">(</span>
        {descriptor}
        <span className="parens">)</span>
      </span>
    </span>
  );
}

function VersionText({ name, version, descriptor }: { name: string; version: string; descriptor: string }) {
  return (
    <span className="version-text">
      <span className="version-label">{`${name}@${version}`}</span>
      <span className="via-descriptor">
        <span className="parens">(</span>
        via {descriptor}
        <span className="parens">)</span>
      </span>
    </span>
  );
}

const DependencyInfo = memo(
  ({
    node,
    isTargetPackage,
    repo,
    isLeaf,
    isOpen,
    onClick,
  }: {
    node: YarnWhyJSONOutputLeaf;
    isTargetPackage: IsTargetPackage;
    repo: string;
    isLeaf: boolean;
    isOpen: boolean;
    onClick: () => void;
  }) => {
    const [name, descriptor] = node.descriptor;
    const version = node.version;
    const id = `${repo}:${name}@${version}`;

    return (
      <span className={`descriptor ${isLeaf ? 'leaf' : ''}`} id={id}>
        {isTargetPackage(name) ? (
          renderTarget(node)
        ) : isLeaf ? (
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span className="material-symbols-outlined">switch_access_shortcut</span>
            <a
              className="search-results-dependency already-rendered"
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
              <VersionText name={name} version={version} descriptor={descriptor} />
            </a>
          </span>
        ) : (
          <span className="search-results-dependency has-subtree" onClick={onClick}>
            <span className={`material-symbols-outlined ${isOpen ? '' : 'closed'}`}>
              {isOpen ? 'indeterminate_check_box' : 'add_box'}
            </span>
            <VersionText name={name} version={version} descriptor={descriptor} />
          </span>
        )}
      </span>
    );
  }
);

const DependencyRow = memo(
  forwardRef<
    HTMLLIElement,
    {
      isLeaf: boolean;
      isLastRow: boolean;
      isLastSubtree: boolean;
      repo: string;
      node: YarnWhyJSONOutputLeaf;
      isTargetPackage: IsTargetPackage;
      updateClientRect: null | ((v: DOMRect) => void);
    }
  >(({ node, updateClientRect, isTargetPackage, repo, isLeaf, isLastRow, isLastSubtree }, outerRef) => {
    const [innerBlockIsCollapsed, setInnerBlockIsCollapsed] = useState(false);
    const innerRef = useRef<HTMLLIElement>(null);
    useImperativeHandle(outerRef, () => innerRef.current!, []);

    useEffect(() => {
      if (innerRef && innerRef.current && updateClientRect) {
        const rect = innerRef.current.getBoundingClientRect();
        updateClientRect(rect);
      }
    }, [innerRef, updateClientRect]);

    return (
      <li
        ref={innerRef}
        className={`dependency-row ${isLeaf ? '' : 'has-subtree'} ${isLastSubtree ? 'is-last-subtree' : ''} ${isLastRow ? 'is-last' : ''} `}
      >
        <DependencyInfo
          node={node}
          isTargetPackage={isTargetPackage}
          repo={repo}
          isLeaf={isLeaf}
          isOpen={!innerBlockIsCollapsed}
          onClick={() => setInnerBlockIsCollapsed(!innerBlockIsCollapsed)}
        />
        {node.children && node.children.length > 0 && (
          <DependencyBlock
            nodes={node.children}
            isTargetPackage={isTargetPackage}
            repo={repo}
            onTreeBarClick={() => setInnerBlockIsCollapsed(!innerBlockIsCollapsed)}
            isOpen={!innerBlockIsCollapsed}
          />
        )}
      </li>
    );
  })
);

const DependencyBlock = memo(
  ({
    nodes,
    isTargetPackage,
    repo,
    onTreeBarClick,
    isOpen,
  }: {
    nodes: YarnWhyJSONOutput;
    isTargetPackage: IsTargetPackage;
    repo: string;
    onTreeBarClick: () => void;
    isOpen: boolean;
  }) => {
    const ref = useRef<HTMLUListElement>(null);
    const vertBarRef = useRef<HTMLDivElement>(null);
    let lastSubtreeIdx = nodes ? findLastSubtreeIdx(nodes) : -1;
    lastSubtreeIdx = nodes.length - 1;
    const lastSubtreeRef = useRef<HTMLLIElement>(null);
    // It may seem useless, but it triggers the render of the parent
    const [, setLastSubtreeClientRect] = useState<DOMRect | null>(null);
    const [maxHeight, setMaxHeight] = useState('fit-content');

    useEffect(() => {
      if (lastSubtreeRef.current && vertBarRef.current) {
        //vertBarRef.current.style.height = `${lastSubtreeRef.current.offsetTop + 14}px`;

        if (ref.current?.clientHeight) {
          // set max height so that the linear transformation has something to work with
          setMaxHeight(`${ref.current?.clientHeight}px`);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastSubtreeRef.current, vertBarRef.current, ref.current]);

    return (
      <ul className={`dependency-block ${isOpen ? '' : 'closed'}`} ref={ref} style={{ maxHeight }}>
        <div
          className="search-results-vertical-bar"
          onClick={(ev) => {
            ev.stopPropagation();
            onTreeBarClick();
          }}
        >
          <div className="bar-child" ref={vertBarRef} />
        </div>
        {nodes.map((node, i, all) => {
          const isLastRow = i === all.length - 1;
          const isLastSubtree = i === lastSubtreeIdx;

          const isLeaf = !node.children || node.children.length === 0;
          return (
            <DependencyRow
              isLeaf={isLeaf}
              isLastRow={isLastRow}
              isLastSubtree={isLastSubtree}
              ref={isLastSubtree ? lastSubtreeRef : undefined}
              key={node.descriptor.join('@')}
              node={node}
              isTargetPackage={isTargetPackage}
              repo={repo}
              updateClientRect={isLastSubtree ? setLastSubtreeClientRect : null}
            />
          );
        })}
      </ul>
    );
  }
);

function findLastSubtreeIdx(node: YarnWhyJSONOutput): number {
  for (let i = node.length - 1; i >= 0; i--) {
    if (node[i].children && node[i].children!.length > 0) {
      return i;
    }
  }
  return -1;
}

const SearchLockFile = memo(({ repo, result, packageName, baseRepoUrl }: LockFileProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const linkRepo = useRef<HTMLAnchorElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isTargetPackage = (name: string) => name === packageName;

  return (
    <details className="search-results-item" open={isOpen}>
      <summary
        className="search-results-repo-name"
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onClick={(ev) => {
          if (linkRepo.current!.contains(ev.target as Node)) {
            // Opening a new tab to watch the repo
            return;
          }

          // Toggling the tree
          ev.preventDefault();
          setIsOpen(!isOpen);

          ref.current!.querySelectorAll('.blink_me').forEach((elem) => {
            elem.classList.remove('blink_me');
          });
        }}
      >
        <span className="search-results-repo-name-text">
          <span className="material-symbols-outlined">{isOpen ? 'arrow_drop_down' : 'arrow_right'}</span>
          {repo}
        </span>
        <a ref={linkRepo} className="search-results-repo-link" href={`${baseRepoUrl}/${repo}`} target="_blank">
          <span className="material-symbols-outlined">open_in_new</span>
        </a>
      </summary>
      <div ref={ref} className="first-level">
        {isOpen && (
          <DependencyBlock
            nodes={result}
            isTargetPackage={isTargetPackage}
            repo={repo}
            onTreeBarClick={() => null}
            isOpen={true}
          />
        )}
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

type QueryParams = {
  q: string;
  repos?: string;
};

export type AppProps = {
  repositories: string[];
  repoHashes: Record<string, string>;
  lockfiles: LockfilesMap;
  baseRepoUrl: string;
  defaultSelectedRepos: Set<string>;
  defaultQuery: string;
  systemTheme: DefiniteThemeType;
  defaultTheme: ThemeType;
};

function App({
  repositories,
  repoHashes,
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
  const [isWasmLoading, setIsWasmLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<[string, YarnWhyJSONOutput][]>([]);
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState(new Set<string>(defaultSelectedRepos));
  const [theme, setTheme] = useState<ThemeType>(defaultTheme);

  useEffect(() => {
    if (!wasm && !isWasmLoading) {
      setIsWasmLoading(true);
      WebAssembly.compile(fromHexString(yarnWhyData)).then(setWasm).catch(console.error);
    }
  }, [wasm, isWasmLoading]);

  useEffect(() => {
    (async () => {
      const params: QueryParams = {
        q: packageQuery,
      };

      if (selectedRepos.size > 0 && selectedRepos.size !== repositories.length) {
        const fullHashes = await Promise.all(Array.from(selectedRepos).map((repo) => sha256(repo)));
        const shortHashes = fullHashes.map((x) => x.slice(0, 7));
        shortHashes.sort();

        params.repos = shortHashes.join(',');
      }

      const currentParams = new URLSearchParams(window.location.search);
      currentParams.sort();
      const currentParamsAsString = currentParams.toString();

      const newParams = new URLSearchParams(params);
      newParams.sort();
      const newParamsAsString = newParams.toString();

      if (currentParamsAsString !== newParamsAsString) {
        // update URL to allow users to share the link
        history.pushState({}, '', '?' + newParamsAsString);
        // Note: it may be that title has to be set after pushState to be effective
        document.title = `Dependencies Tracker - ${packageQuery} - ${params.repos ? selectedRepos.size : 'all'} repos`;
      }
    })();
  }, [packageQuery, selectedRepos, repositories]);

  useEffect(() => {
    if (packageQuery && wasm && reposWithMaybePackage.length > 0) {
      setIsSearching(true);
      Promise.all(
        reposWithMaybePackage
          .filter((repo) => selectedRepos.has(repo))
          .map<Promise<[string, YarnWhyJSONOutput | null]>>((repo) =>
            yarnWhy({ lockFile: lockfiles[repo], query: packageQuery, wasm }).then((output) => {
              return [repo, output];
            })
          )
      )
        .then((pairs: [string, YarnWhyJSONOutput | null][]) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const pairsRepoMatches = pairs.filter(([_, output]) => output !== null) as [string, YarnWhyJSONOutput][];
          setSearchResult(pairsRepoMatches);
        })
        .finally(() => {
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

      // Always add a space before > or < (so we accept e.g. foo>1)
      normalizedQuery = normalizedQuery.replace(/([<>])/g, ' $1');

      // Since the underlying semver library use cargo semantics ("simple" versions
      // defaults to caret ^), we normalize to exact version here
      // e.g. we transform `foo 1.2` into `foo =1.2`
      const match = /(^[^ ]+) +([0-9][0-9a-zA-Z-_.]?.*)$/.exec(normalizedQuery);
      if (match) {
        normalizedQuery = `${match[1]} =${match[2]}`;
      }

      // Remove double spaces
      normalizedQuery = normalizedQuery.replace(/ +/g, ' ');

      if (normalizedQuery !== packageQuery) {
        // recursive, it wil trigger this useEffect again
        setPackageQuery(normalizedQuery);
      } else {
        const packageName = packageQuery ? packageQuery.split(' ')[0] : '';

        setSearchResult([]);
        setReposWithMaybePackage(getLockfilesWithMaybePackage(lockfiles, packageName));
      }
    }
  }, [packageQuery, lockfiles]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onPopstate = (_: PopStateEvent) => {
      const currentParams = new URLSearchParams(window.location.search);
      const currentQueryInUrl = currentParams.get('q') || '';

      const currentRepoHashesInUrl = currentParams.get('repos') || '';

      const newSelectedRepos = new Set<string>();
      currentRepoHashesInUrl.split(',').forEach((repoHash) => {
        if (repoHashes[repoHash]) {
          newSelectedRepos.add(repoHashes[repoHash]);
        }
      });

      setPackageQuery(currentQueryInUrl);
      setFilterPanelVisible(false);
      setIsSearching(false);

      if (newSelectedRepos.size > 0) {
        setSelectedRepos(newSelectedRepos);
      } else {
        setSelectedRepos(new Set(repositories));
      }

      // XXX should use ref or controlled state
      const inputElem: HTMLInputElement = document.querySelector('.search-input input')!;
      inputElem.value = currentQueryInUrl;
    };
    window.addEventListener('popstate', onPopstate);

    return () => {
      window.removeEventListener('popstate', onPopstate);
    };
  }, [repoHashes, repositories]);

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
