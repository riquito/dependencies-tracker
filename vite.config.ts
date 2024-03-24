import { defineConfig } from 'vite'
import { ViteEjsPlugin } from "vite-plugin-ejs";
import react from '@vitejs/plugin-react-swc'
import { glob } from 'glob';
import { readFileSync } from 'node:fs';

// Find all the lock files inside `lockfiles` using glob
// and create an object path => content of the lock files

const lockfilesPaths = glob.sync('lockfiles/**/*.lock', {
  absolute: false,
  ignore: []
});

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
    ViteEjsPlugin({
      lockFiles: JSON.stringify(lockFiles),
      domain: "hello"
    }),],
})
