# Dependencies Tracker

Single page app that allows you to search for dependencies across yarn.lock files.

## Initial Setup

You must copy your yarn.lock files into the `lockfiles` directory.

The structur of that directory should mimick your repositories, e.g.

```
lockfiles/some_org/some_owner/yarn.lock
lockfiles/some_org/another_owner/yarn.lock
```

## How to run

```bash
yarn install # yarn >= 3.0
yarn dev
```

## LICENSE

MIT
