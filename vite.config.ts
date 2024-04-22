import { defineConfig } from 'vite'
import { ViteEjsPlugin } from "vite-plugin-ejs";
import react from '@vitejs/plugin-react-swc'
import { glob } from 'glob';
import { readFileSync } from 'node:fs';

/** @type {import('vite').Plugin} */
const hexLoader = {
  name: 'hex-loader',
  transform(code: string, id: string) {
    const [path, query] = id.split('?');
    if (query != 'raw-hex')
      return null;

    const data = readFileSync(path);
    const hex = data.toString('hex');

    return `export default '${hex}';`;
  }
};

// Find all the lock files inside `lockfiles` using glob
// and create an object path => content of the lock files

const lockfilesPaths = glob.sync('lockfiles/**/*.lock', {
  absolute: false,
  ignore: []
});
lockfilesPaths.sort();

const lockFiles: Record<string, string> = {}
lockfilesPaths.map(path => {
  // Given path "lockfiles/foo/bar/yarn.lock"
  // the key is "foo/bar"
  lockFiles[path.slice('lockfiles'.length + 1, path.lastIndexOf('/'))] = readFileSync(path, 'utf-8');
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    hexLoader,
    ViteEjsPlugin({
      lockfilesUrl: process.env['DEP_URL'] || '/src/assets/lockfiles.tar.gzip',
    }),],
})
