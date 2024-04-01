/// <reference types="vite/client" />

declare interface Window {
    lockfiles: LockfilesMap;
}

declare type LockfilesMap = Record<string, string>;