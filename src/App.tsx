import { useEffect, useState } from 'react'
import { YarnWhyJSONOutput, YarnWhyJSONOutputLeaf, yarnWhy } from './yarn-why'
import { RepoFilter } from './repo-filter'

// Icon from https://lucide.dev/icons/microscope
import searchIcon from '/search.svg'
/* @ts-ignore */
import yarnWhyData from './assets/yarn-why.wasm?raw-hex'
import './App.css'

const fromHexString = (hexString: string): ArrayBuffer =>
  Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));


type SearchInputProps = {
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

function SearchInput({ onChange }: SearchInputProps) {
  return (
    <input
      type="text"
      placeholder="Search..."
      className="input"
      onChange={onChange}
    />
  )
}

type LockFileProps = {
  repo: string;
  result: YarnWhyJSONOutput,
  packageName: string;
}

function SearchLockFile({ repo, result }: LockFileProps) {
  return (
    <details open>
      <summary>{repo}</summary>
      <div>
        <ul>
          {result.map((node: YarnWhyJSONOutputLeaf) => {
            return (
              <li key={node.descriptor}>
                {node.descriptor}
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}

/**
 * Check if a package is in the yarn lock file, on best effort basis.
 * It can return false positives, but never false negatives.
 */
function isPackageMaybeInLockFile(lockFile: string, packageName: string): boolean {
  // If the package is in the yarn lock file, it should at least be present
  // in the form <packageName>@ (maybe followed by version, maybe not, depend on yarn version)
  return lockFile.includes(packageName + '@')
}

function getLockfilesWithMaybePackage(lockFiles: LockfilesMap, packageName: string): string[] {
  if (packageName === '') {
    return [];
  }

  return Object.keys(lockFiles).filter(repo => {
    return isPackageMaybeInLockFile(lockFiles[repo], packageName)
  })
}

function App() {
  const lockFiles = window.lockFiles;
  const repositories = Object.keys(lockFiles);

  const [packageQuery, setPackageQuery] = useState('');
  const [reposWithMaybePackage, setReposWithMaybePackage] = useState<string[]>([]);
  const [wasm, setWasm] = useState<WebAssembly.Module>();
  const [searchResult, setSearchResult] = useState<[string, YarnWhyJSONOutput][]>([]);
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState(new Set<string>(new Set(repositories)));


  useEffect(() => {
    WebAssembly.compile(fromHexString(yarnWhyData)).then(setWasm).catch(console.error);
  }, [])

  useEffect(() => {
    if (packageQuery && wasm && reposWithMaybePackage.length > 0) {

      Promise.all(reposWithMaybePackage
        .filter(repo => selectedRepos.has(repo))
        .map<Promise<[string, YarnWhyJSONOutput | null]>>((repo =>
          yarnWhy({ lockFile: lockFiles[repo], query: packageQuery, wasm }).then((output) => {
            return [repo, output]
          })
        )))
        .then((pairs: [string, YarnWhyJSONOutput | null][]) => {
          const pairsRepoMatches = pairs.filter(([_, output]) => output !== null) as [string, YarnWhyJSONOutput][];
          setSearchResult(pairsRepoMatches);
        })
    }
  }, [wasm, packageQuery, reposWithMaybePackage, lockFiles, selectedRepos])


  return (
    <>
      <h1 className="main-title"><img src={searchIcon} className="logo" alt="Dependencies Tracker logo" /> Dependencies Tracker</h1>
      <div className="search-bar">
        <SearchInput onChange={(ev) => {
          const query = ev.target.value.trim();
          setPackageQuery(query);
          setSearchResult([]);
          setReposWithMaybePackage(getLockfilesWithMaybePackage(lockFiles, query));
        }} />
      </div>

      {!filterPanelVisible && (
        <div className="repo-filter-title" >
          Showing <b>{selectedRepos.size}</b> of <b>{repositories.length}</b> Repositories
          <button onClick={() => setFilterPanelVisible(true)}>Show filters panel</button>
        </div>
      )}
      {filterPanelVisible && (
        <RepoFilter
          repositories={repositories}
          selectedRepositories={selectedRepos}
          onChange={(selectedRepos) => {
            setSelectedRepos(selectedRepos);
            setFilterPanelVisible(false);
          }}
        />
      )}
      {searchResult.length > 0 && (
        <div className="search-results">
          <h3 className="search-results-header">Search Results:</h3>
          {searchResult.map(([repo, result]) =>
            <SearchLockFile key={repo} repo={repo} result={result} packageName={packageQuery} />
          )}
        </div>
      )}
    </>
  )
}


export default App
