# Dependencies Tracker

Single page app that allows you to search for dependencies across yarn.lock files.

## Initial Setup

Create a directory containing your lock files, e.g.

```
lockfiles/some_org/some_owner/yarn.lock
lockfiles/some_org/another_owner/yarn.lock
```

then gzip it and put the generated file into `src/assets`

```bash
cd lockfiles
tar -zcf ../lockfiles.tar.gzip *
cd ..
cp lockfiles.tar.gzip src/assets/
```

## How to run

```bash
yarn install # yarn >= 3.0
yarn dev
```

## LICENSE

MIT
