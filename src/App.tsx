import { useState } from 'react'
import viteLogo from '/vite.svg'
import './App.css'

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
  lockFile: string,
  packageName: string;
}

function SearchLockFile({ repo }: LockFileProps) {
  return (
    <details>
      <summary>{repo}</summary>
      <div>
        <ul>
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

function escapeRegExp(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}


function App() {
  const [count, setCount] = useState(0)
  const [packageQuery, setPackageQuery] = useState('');
  const [lockFilesWithPackage, setLockFilesWithPackage] = useState<string[]>([]);

  const lockFiles = window.lockFiles;

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
      </div>
      <h1>Dependencies Tracker</h1>
      <SearchInput onChange={(ev) => {
        const value = ev.target.value.trim();

        setPackageQuery(value);
        setLockFilesWithPackage(getLockfilesWithMaybePackage(lockFiles, value));
      }} />
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <ul>
        {lockFilesWithPackage.map(repo => (
          <SearchLockFile key={repo} repo={repo} lockFile={lockFiles[repo]} packageName={packageQuery} />
        ))}
      </ul>
    </>
  )
}

export default App
