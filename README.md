# Aurora Tasks

A fast, animated to-do list that runs entirely in your browser. There is no account,
no backend, and no sync — every task lives in your browser's `localStorage`, on your
own machine. It is for one person who wants a calm, keyboard-friendly list for a single
day or week, not a team task tracker.

> **Draft notice.** This README is a draft written against the current `main` branch,
> ahead of the full documentation task (FELA-24). Screenshots and the live demo link
> are placeholders until that task ships. The
> "Features" section below marks what is actually in `main` today versus what is still
> being built, so this page does not promise more than the app currently does.

<!-- TODO: скриншот -->

<!-- TODO: ссылка на демо -->

## Tech stack

| Choice | What | Why |
|---|---|---|
| UI | React 19 + TypeScript (strict) | already in the repository |
| Build | Vite 8 | already in the repository |
| Styles | Tailwind CSS v4 on top of a CSS design-token layer | utilities are fast to write, but every value still has to come from a token, not a hardcoded number |
| Animation | Framer Motion | already in the repository |
| Tests | Vitest + Testing Library + jsdom | already in the repository |
| Data | `localStorage`, no backend | there is no server by design |

No new runtime dependency is added without a reason recorded in the task and a
TechLead/Security review — see `docs/ARCHITECTURE.md` §1. This keeps the dependency
tree small on purpose ("boring technology"), which also keeps the attack surface small.

## Getting started

### Requirements

- Node.js 24 or newer (the project is built and tested against `v24.21.0`)
- npm (ships with Node.js)

### Install

```bash
npm install
```

### Run the app locally

```bash
npm run dev
```

Starts the Vite dev server and prints a local URL (typically `http://localhost:5173/`).
Open it in a browser; the page reloads on every file change.

### Build for production

```bash
npm run build
```

Runs the TypeScript project build (`tsc -b`) and then the Vite production build. Output
goes to `dist/`. This command fails if there is a type error, so it is also the
authoritative type-check for a release.

### Preview the production build

```bash
npm run preview
```

Serves the `dist/` folder built above, the same way GitHub Pages will. Useful to check
the production build before it ships, since `npm run dev` does not use the same bundling
path.

### Lint and type-check

```bash
npm run lint       # oxlint
npm run typecheck  # tsc -b, no emit
```

### Run the test suite

```bash
npm run test
```

Runs the Vitest suite once (no watch mode). On `main` at the time of writing this is 48
test files and 423 tests, all passing.

All four commands above (`lint`, `typecheck`, `test`, `build`) are also the required CI
checks for every pull request — see [Contributing](#contributing).

## Project structure

Full detail, including the reasoning behind each decision, lives in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Short version:

```
src/
  domain/      pure TypeScript, no React — task model, list operations, filters, due dates
  storage/     localStorage wrapper, schema validation, debounced persistence
  state/       the single task reducer, React context/providers (tasks, theme, toasts)
  components/  presentational building blocks (Button, Checkbox, Menu, Toast, ...)
  features/    screen-level logic that connects the store to components (composer, toolbar, ...)
  layout/      page shell, header, animated background, floating action button
  lib/         small framework-agnostic helpers (debounce, focus/dismiss handling, ...)
  styles/      the token layer (`tokens.css`) and global CSS (`base.css`)
```

The rule that keeps this useful: `domain/` never imports React, and `components/` never
reads application state directly — a component that needs the task store belongs in
`features/`, not `components/`. See `docs/ARCHITECTURE.md` §2 for the full rationale and
`docs/CODE-RULES.md` for the security-relevant rules (what must never turn user text into
HTML, how search highlighting is required to work, and so on).

## Data storage

Everything lives in the browser's `localStorage`, in two keys:

- `aurora.tasks.v1` — the task list, as `{ "version": 1, "tasks": Task[] }`.
- `aurora.theme` — the chosen theme, `"light"` or `"dark"`.

The list is read once, synchronously, before the first render, and written back with a
250 ms debounce after every change. Nothing ever leaves the browser: there is no network
call in the app at all.

**If the stored data is unreadable** (corrupted JSON, tampered by hand, written by a
different app version), the app does not lose it silently. The unparsed bytes are copied
first into a quarantine key, `aurora.tasks.v1.corrupted`, before anything else touches
`aurora.tasks.v1`. The app then starts with an empty list in memory and shows an error
banner explaining that the stored data could not be read, with a button to export the
original, untouched bytes from the quarantine copy to a file. This way a bad write never
destroys data — it only has to be recovered.

## Features

What you can actually do with the app on `main` today:

- Switch between light and dark theme; the choice is saved and restored on reload
  (`aurora.theme`), and the correct theme applies before the first paint, with no flash
  of the wrong theme.
- See a graceful error banner — with a one-click export of the untouched raw data — if
  the stored task list on your machine is unreadable.

Everything below is part of the design spec (`docs/design-spec.md`) but **not yet wired
up in `main`** — in progress, do not expect it in a build today:

- Adding, editing, completing, and deleting tasks through the UI (the composer and task
  list components exist in the codebase but are not yet mounted into the running app).
- Priority and due-date tags on tasks.
- Manual drag-and-drop reordering of the list, with a keyboard-accessible alternative.
- Search and filtering (all / active / completed) with a visible count per filter.
- Undo for deletion (toast + `Ctrl/Cmd+Z`), and a confirmation dialog for clearing all
  completed tasks.
- Keyboard shortcuts (the header's shortcuts button already exists but currently opens a
  placeholder panel that says the real list is coming later).
- Empty states for an empty list, a search with no matches, and a fully completed list.

## Contributing

- `main` is always green: there are no direct commits to `main`.
- One branch per task, named with the ticket id, e.g. `feat/FELA-15-task-list`,
  `fix/FELA-65-composer-focus`, `docs/FELA-99-readme-draft`.
- Commits are [Conventional Commits](https://www.conventionalcommits.org/), in English,
  naming the ticket, e.g. `feat: add task list reducer (FELA-9)`.
- Every change ships as a pull request. CI must be green: `lint`, `typecheck`, `test`,
  and `build` (see [Getting started](#getting-started) — these are exactly the four
  `npm run` commands above).
- The PR author does not merge their own PR. A `review-ack` check keeps the PR red until
  a reviewer posts a comment whose first line is exactly `/merge-ok` (optionally
  `/merge-ok <sha>`) on the current commit; any new push resets it. See
  `.github/workflows/review-ack.yml` for the mechanics and
  `.github/pull_request_template.md` for the full PR checklist, including the security
  checklist from `docs/CODE-RULES.md`.

## License

[MIT](LICENSE).
