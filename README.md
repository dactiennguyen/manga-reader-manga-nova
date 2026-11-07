# Manganova

Android app for making a manga chapter on a phone: script, characters, panels, drawing, lettering, preview, export.

React Native 0.88.1 (bare CLI), TypeScript, Tailwind through Uniwind, SQLite through op-sqlite, Skia for drawing.

## Run

Needs Node 22.13+, JDK 17, Android SDK 37 and NDK 27.1.12297006.

```sh
npm install
npm start              # Metro
npm run android        # debug build on a device or emulator
```

Release build:

```sh
cd android && ./gradlew assembleRelease
```

Release builds block screenshots (`SECURE_SCREEN` in `MainActivity.kt`), so `adb screencap` returns a black image. Use a debug build to capture screens. The release build is signed with the debug key until an upload key exists.

## Check

```sh
npm test
npm run typecheck
npm run lint
```

## Docs

Plan and architecture are in [docs/](docs/README.md), written in Vietnamese. Layers are enforced by ESLint: see `.eslintrc.js`.

Launcher icons come from `assets/icon/foreground.svg`. Run `scripts/gen-icons.sh` after changing it.
