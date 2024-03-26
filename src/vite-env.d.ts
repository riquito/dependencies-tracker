/// <reference types="vite/client" />

declare interface Window {
    lockFiles: LockfilesMap;
}

declare type LockfilesMap = Record<string, string>;