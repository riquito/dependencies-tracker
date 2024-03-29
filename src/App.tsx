import { useEffect, useState } from 'react'
import { WASI, File, Fd, OpenFile, ConsoleStdout, PreopenDirectory, wasi } from "@bjorn3/browser_wasi_shim";

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

type YarnWhyJSONOutputLeaf = {
  descriptor: string,
  children: YarnWhyJSONOutputLeaf[]
}

type YarnWhyJSONOutput = YarnWhyJSONOutputLeaf[]

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

function escapeRegExp(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

async function yarnWhy_example() {
  let args = ["bin", "-h"];
  let env = ["FOO=bar"];
  let fds = [
    new OpenFile(new File([])), // stdin
    ConsoleStdout.lineBuffered(msg => console.log(`[WASI stdout] ${msg}`)),
    ConsoleStdout.lineBuffered(msg => console.warn(`[WASI stderr] ${msg}`)),
    new PreopenDirectory(".", {
      "example.c": new File(new TextEncoder().encode(`#include "a"`)),
      "hello.rs": new File(new TextEncoder().encode(`fn main() { println!("Hello World!"); }`)),
    }),
  ];
  let wasi = new WASI(args, env, fds);

  //let wasm = await WebAssembly.compileStreaming(fetch('/yarnWhy.wasm'));
  //console.log('mmm', yarnWhyData.slice(0, 10))
  let wasm = await WebAssembly.compile(fromHexString(yarnWhyData));
  let inst = await WebAssembly.instantiate(wasm, {
    "wasi_snapshot_preview1": wasi.wasiImport,
  });
  wasi.start(inst as any);

}

// Keep storing data until the file descriptor is closed,
// then write it all at once.
class ConsoleExhaust extends Fd {
  write: (buffer: Uint8Array) => void;
  buffer: Uint8Array[];

  constructor(write: (buffer: Uint8Array) => void) {
    super();
    this.write = write;
    this.buffer = [];
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    const filestat = new wasi.Filestat(
      wasi.FILETYPE_CHARACTER_DEVICE,
      BigInt(0),
    );
    return { ret: 0, filestat };
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    const fdstat = new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0);
    fdstat.fs_rights_base = BigInt(wasi.RIGHTS_FD_WRITE);
    return { ret: 0, fdstat };
  }

  fd_write(
    view8: Uint8Array,
    iovs: Array<wasi.Ciovec>,
  ): { ret: number; nwritten: number } {
    let nwritten = 0;
    for (const iovec of iovs) {
      const buffer = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);
      //this.write(buffer);
      this.buffer.push(buffer);
      nwritten += iovec.buf_len;
    }
    return { ret: 0, nwritten };
  }
  fd_close(): number {
    // Get the total length of all arrays.
    const length = this.buffer.reduce((a, b) => a + b.length, 0);

    // Create a new array with total length and merge all source arrays.
    let mergedArray = new Uint8Array(length);
    let offset = 0;
    this.buffer.forEach(item => {
      mergedArray.set(item, offset);
      offset += item.length;
    });

    //this.write(new TextEncoder().encode(this.buffer.map(b => new TextDecoder().decode(b, { stream: true })).join('')));
    this.write(mergedArray);

    return 0;
  }
}


async function yarnWhy({ lockFile, query, wasm }: { lockFile: string, query: string, wasm: WebAssembly.Module }): Promise<string> {

  let output = ''
  let err_output = ''

  let args = ["yarn-why", '--json', query];
  let env = ["FOO=bar"];
  let fds = [
    new OpenFile(new File(new TextEncoder().encode(lockFile))), // stdin
    new ConsoleExhaust(buffer => {
      const stdout = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      output = stdout;
    }),
    new ConsoleExhaust(buffer => {
      const stderr = new TextDecoder("utf-8", { fatal: false }).decode(buffer)
      err_output = stderr;
    }),
    new PreopenDirectory(".", {
      "yarn.lock": new File(new TextEncoder().encode(lockFile)),
      "hello.rs": new File(new TextEncoder().encode(`fn main() { println!("Hello World!"); }`)),
    }),
  ];
  let wasi = new WASI(args, env, fds, { debug: true });

  let inst = await WebAssembly.instantiate(wasm, {
    "wasi_snapshot_preview1": wasi.wasiImport,
  });
  const exit_code = wasi.start(inst as any);
  // File descriptors are not closed automatically when the program exits,
  // so we need to close them manually (see FIXME v0.3 in @bjorn3/browser_wasi_shim)
  fds.forEach(fd => fd.fd_close());

  // output now is not empty because the file descriptor is closed
  // and it's handler was called synchronously

  if (exit_code !== 0) {
    if (output === 'Package not found\n') {
      return ''
    }

    throw new Error(err_output);
  }

  return output
}


function App() {
  const [packageQuery, setPackageQuery] = useState('');
  const [reposWithMaybePackage, setReposWithMaybePackage] = useState<string[]>([]);
  const [wasm, setWasm] = useState<WebAssembly.Module>();
  const [foundPackages, setFoundPackages] = useState<[string, YarnWhyJSONOutput][]>([]);

  const lockFiles = window.lockFiles;

  useEffect(() => {
    WebAssembly.compile(fromHexString(yarnWhyData)).then(setWasm).catch(console.error);
  }, [])

  useEffect(() => {
    if (packageQuery && wasm && reposWithMaybePackage.length > 0) {
      Promise.all(reposWithMaybePackage.map<Promise<[string, string]>>((repo =>
        yarnWhy({ lockFile: lockFiles[repo], query: packageQuery, wasm }).then((output) => {
          return [repo, output]
        })
      ))).then((pairs: [string, string][]) => {
        const pairsRepoMatches = pairs.filter(([_, output]) => output !== '').map<[string, YarnWhyJSONOutput]>(([repo, output]) => {
          return [repo, JSON.parse(output) as YarnWhyJSONOutput]
        })

        setFoundPackages(pairsRepoMatches);
      })
    }
  }, [wasm, packageQuery, reposWithMaybePackage, lockFiles])


  return (
    <>
      <h1 className="main-title"><img src={searchIcon} className="logo" alt="Dependencies Tracker logo" /> Dependencies Tracker</h1>
      <SearchInput onChange={(ev) => {
        const query = ev.target.value.trim();
        setPackageQuery(query);
        setFoundPackages([]);
        setReposWithMaybePackage(getLockfilesWithMaybePackage(lockFiles, query));
      }} />
      <ul>
        {foundPackages.map(([repo, result]) => (
          <SearchLockFile key={repo} repo={repo} result={result} packageName={packageQuery} />
        ))}
      </ul>
    </>
  )
}



export default App
