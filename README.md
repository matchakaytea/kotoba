<p align="center">
  <img src="assets/icon.png" alt="Kotoba icon" width="128">
</p>

# Kotoba 言葉

Kotoba is a personal Japanese practice app. You generate short reading and
usage tests with Claude, practise them with spaced repetition, and keep track
of the words and grammar you get wrong.

It runs as a desktop app on Windows, and as a web version you can open in a
browser or add to your phone's Home Screen. Both use the same words, progress
and tests when you sign in to sync.

## Features

- **Today:** the reviews due today, and the tests ready to take.
- **Vocabulary:** a searchable list of JLPT words with readings, meanings in
  several languages, pitch and example sentences.
- **Mistakes:** questions you answered wrong, until you dismiss them.
- **Library:** the tests you have imported or generated.
- **Settings:** interface language, colour theme (including a custom skin from
  a picture), level, topics and sync.

## Install the desktop app (Windows)

1. Download the latest `Kotoba Setup` file from the
   [Releases page](https://github.com/matchakaytea/kotoba/releases).
2. Run it. You can choose to install for just you or for everyone on the PC,
   and pick the folder.
3. If Windows shows "Windows protected your PC", click **More info**, then
   **Run anyway**. The app isn't code-signed.

Your data is kept in `AppData\Roaming\kotoba`, separate from the install
folder. Uninstalling the app doesn't remove it.

Updates: once the in-app updater is in place, use **Check for updates** in
Settings. It asks before installing, and keeps your data.

## Use the web version

Open the Kotoba web app in a browser, or add it to the Home Screen on your
phone. Sign in to sync your data with the desktop app.

Generating new tests needs the Claude CLI, which only the desktop app can use.
Tests generated on the desktop sync to the web version.

## Run from source

You need Node.js and npm.

```sh
npm install
npm start          # desktop app in development mode
npm run web        # web version at http://localhost:5180
```

Other useful commands:

```sh
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript checks
npm run lint       # oxlint and oxfmt
npm run make       # build the Windows installer
npm run web:build  # build the web version into dist-web
npm run build:vocab  # rebuild the vocabulary data
```

## Sync

Sync uses a Supabase project with email and password sign-in. Your data is
only visible to your account, enforced by row-level security. The table setup
is in `supabase/schema.sql`.

The app syncs when you sign in, when it opens, shortly after you change
something, when the window comes back into focus, and every two minutes while
it's open.

## Data and licences

- The JLPT word list comes from [anki-jlpt-decks](https://github.com/5mdld/anki-jlpt-decks),
  under CC BY-NC 4.0. That licence allows non-commercial use only.
- The word list is also drawn from the tanos JLPT lists.

## Project layout

- `src/main`: Electron main process, database, sync and test generation.
- `src/renderer`: the React interface, shared by the desktop and web versions.
- `src/web`: the browser version's database and entry point.
- `src/shared`: types, validation and settings shared across the app.
- `supabase`: the database schema for sync.
- `wrangler.jsonc`: the Cloudflare Workers config for the web version.
