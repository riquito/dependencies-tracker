import { TarReader } from './tarball.ts';

const decompress = (lockfilesAsBlob: Blob): Promise<Blob> => {
  const ds = new DecompressionStream('gzip');
  const stream_in = lockfilesAsBlob.stream().pipeThrough(ds);
  return new Response(stream_in).blob();
};

export const fetchLockfiles = async (url: string): Promise<LockfilesMap> => {
  const response = await fetch(url);
  const compressedBlob = await response.blob();
  const decompressedBlob = await decompress(compressedBlob);
  const tar = new TarReader();
  const data = await tar.readFile(decompressedBlob);

  return Object.fromEntries<string>(
    data
      .filter((x) => x.type === 'file')
      .map((x) => {
        return [x.name.replace('/yarn.lock', ''), tar.getTextFile(x.name) || ''];
      })
  );
};
