import { WASI, File, Fd, OpenFile, wasi } from "@bjorn3/browser_wasi_shim";

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

    fd_write(data: Uint8Array): { ret: number; nwritten: number } {
        this.buffer.push(data);
        return { ret: 0, nwritten: data.byteLength };
    }

    fd_close(): number {
        // Get the total length of all arrays.
        const length = this.buffer.reduce((a, b) => a + b.length, 0);

        // Create a new array with total length and merge all source arrays.
        const mergedArray = new Uint8Array(length);
        let offset = 0;
        this.buffer.forEach(item => {
            mergedArray.set(item, offset);
            offset += item.length;
        });

        this.write(mergedArray);

        return 0;
    }
}


export type YarnWhyJSONOutputLeaf = {
    descriptor: [string, string],
    children?: YarnWhyJSONOutputLeaf[]
}

export type YarnWhyJSONOutput = YarnWhyJSONOutputLeaf[]

export async function yarnWhy({ lockFile, query, wasm }: { lockFile: string, query: string, wasm: WebAssembly.Module }): Promise<YarnWhyJSONOutput | null> {
    let output = ''
    let err_output = ''

    const [packageName, ...rest] = query.split(' ')
    const version = rest.join(' ')

    const args = ["yarn-why", '--json', packageName, ...(version ? [version] : [])];

    const env: string[] = [];
    const fds = [
        new OpenFile(new File(new TextEncoder().encode(lockFile))), // stdin
        new ConsoleExhaust(buffer => {
            const stdout = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
            output = stdout;
        }),
        new ConsoleExhaust(buffer => {
            const stderr = new TextDecoder("utf-8", { fatal: false }).decode(buffer)
            err_output = stderr;
        }),
    ];
    const wasi = new WASI(args, env, fds, { debug: true });

    const inst = await WebAssembly.instantiate(wasm, {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });
    const exit_code = wasi.start(inst as any);
    // File descriptors are not closed automatically when the program exits,
    // so we need to close them manually (see FIXME v0.3 in @bjorn3/browser_wasi_shim)
    fds.forEach(fd => fd.fd_close());

    // "output" here is not empty because the file descriptors were closed
    // and their handler called synchronously.

    if (exit_code !== 0) {
        if (output === 'Package not found\n') {
            return null;
        }

        throw new Error(err_output);
    }

    return JSON.parse(output) as YarnWhyJSONOutput
}
