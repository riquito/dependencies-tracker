/// <reference types="vite/client" />

declare interface Window {
  lockfilesUrl: string;
  baseRepoUrl: string;
}

declare type LockfilesMap = Record<string, string>;
