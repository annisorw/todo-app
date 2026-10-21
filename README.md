# Aurora Tasks

A fast, animated to-do list that runs entirely in your browser. There is no account,
no backend, and no sync — every task lives in your browser's `localStorage`, on your
own machine. It is for one person who wants a calm, keyboard-friendly list for a single
day or week, not a team task tracker.

**Live demo:** https://annisorw.github.io/todo-app/

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

Starts the Vite dev server and prints a local URL: `http://localhost:5173/todo-app/`.
The `/todo-app/` path is not optional — the app is built with that base path (see
`vite.config.ts`), and it will not mount at the bare root. Open the printed URL in a
browser; the page reloads on every file change.

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

Serves the `dist/` folder built above, at `http://localhost:4173/todo-app/` — the same
way the app will be served once DevOps publishes it. Useful to check the production
build before it ships, since `npm run dev` does not use the same bundling path.

### Lint and type-check

```bash
npm run lint       # oxlint
npm run typecheck  # tsc -b, no emit
```

### Run the test suite

```bash
npm run test
```

Runs the Vitest suite once (no watch mode) and prints how many files and tests passed.
That count moves with nearly every PR, so this page does not pin it down — run the
command to see where `main` stands today.

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
  lib/         small helpers, mostly React hooks (debounce, focus/dismiss handling, ...)
  styles/      the token layer (`tokens.css`) and global CSS (`base.css`)
  assets/      self-hosted font subsets (see "Fonts" below)
```

The rule that keeps this useful: `domain/` never imports React, and `components/` never
reads application state directly — a component that needs the task store belongs in
`features/`, not `components/`. `ErrorBanner` (in `components/`) is the one deliberate
exception: it reads `useTaskStore`/`useToast` directly, because the export button needs
the live task list and the quarantined backup that only `storage/` keeps — see the
comment on `ErrorBanner.tsx`. `lib/` is "small helpers", not "framework-agnostic": most of
it (`useDismissable`, `useDebouncedValue`, `useMediaQuery`, ...) is React hooks; only a
few modules there (`cn`, `dismissStack`, ...) hold no React import at all. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §2 for the full rationale and
[`docs/CODE-RULES.md`](docs/CODE-RULES.md) for the security-relevant rules (what must
never turn user text into HTML, how search highlighting is required to work, and so on).
The full visual contract — tokens, component states, screen states, acceptance
criteria — is [`docs/design-spec.md`](docs/design-spec.md).

Two of those acceptance criteria are internal layout/typography contracts rather than
product features, so they only get a line each here: `AppHeader` and `main` sit in one
centered column (`--layout-content-max`), and the header itself has no background, no
border, and no `sticky` (criterion 34); monospace text (segment counters, the shortcuts
table) is always weight 400 through the single `.text-mono-num` class — never a bare
`font-family: var(--font-mono)` in markup (criterion 35).

## How to use

- **Add a task.** Type in the composer field and press `Enter` (or tap the `+`/FAB
  button on mobile). You can set a priority (none/low/medium/high) and a due date on the
  same field before submitting.
- **Edit an existing task.** Open the editor with the edit button, a double-click on the
  row, the "Изменить" item in the row's menu, or the `E` key while the row is focused.
  The editor is the only place that changes all three fields at once — text, priority,
  and due date — together; `Enter` saves while focus is in the text field, `Esc`
  cancels, and clicking outside the editor saves. Leaving the text empty cancels the
  edit instead of deleting the task.
  On desktop there is a faster path for the other two fields: clicking the priority chip
  or the due-date chip directly on the row opens the same picker and applies the new
  value immediately, with no separate save step. On mobile the editor is a bottom sheet
  instead of an inline row, and the chips on the row are not clickable there — editing
  priority or due date on mobile always goes through that sheet.
- **Filter and search.** Use the All / Active / Completed segments, or the search field,
  to narrow the list; they combine, and each segment shows a live count.
- **Reorder tasks.** Drag a row by its handle, or do it from the keyboard: focus the
  row's drag handle, press `Space` to pick it up, `↑`/`↓` to move it, `Space` again to
  drop it, `Esc` to cancel. On mobile there is no drag handle; open the row's menu and choose
  "Переместить" for the same up/down controls without a mouse. `Ctrl`/`Cmd`+`↑`/`↓` on a
  focused row also moves it one step at a time, on any device, without entering that
  mode.
- **Undo a delete.** Deleting a task shows a toast with a "Вернуть" button for a few
  seconds; the global `Ctrl`/`Cmd+Z` shortcut does the same thing.
- **Switch themes.** Use the theme toggle in the header; the choice is saved
  (`aurora.theme`) and restored on reload, before the first paint, with no flash of the
  wrong theme.
- **Keyboard shortcuts.** Press `?`, or the header's shortcuts button, to see this same
  table inside the app:

  | Key | Action |
  |---|---|
  | `N` | New task |
  | `/` | Focus the search field |
  | `1` `2` `3` | Switch filter (All / Active / Completed) |
  | `?` | Open the shortcuts cheat sheet |
  | `Esc` | Close / cancel / clear, whichever is open |
  | `↑` `↓` | Move focus between rows |
  | `Space` | Toggle the focused task done |
  | `E` | Edit the focused task (text, priority, and due date) |
  | `Delete` / `Backspace` | Delete the focused task |
  | `Ctrl`/`Cmd`+`Z` | Undo the last delete |
  | `Ctrl`/`Cmd`+`↑`/`↓` | Move the focused row by one step |

  (source: `docs/design-spec.md` §6.3 — there is no separate shortcut for priority or
  due date on purpose: the editor behind `E` already reaches both.)

## Data storage

Everything lives in the browser's `localStorage`, in three keys:

- `aurora.tasks.v1` — the task list, as `{ "version": 1, "tasks": Task[] }`.
- `aurora.theme` — the chosen theme, `"light"` or `"dark"`.
- `aurora.tasks.v1.corrupted` — a quarantine copy of `aurora.tasks.v1`'s raw bytes,
  written only when a read finds them unreadable (see below).

**There is no server and no account.** Nothing ever leaves the browser: there is no
network call in the app at all. Clearing this browser's site data (or `localStorage`)
deletes your tasks permanently — there is nothing to recover them from.

The list is read once, synchronously, before the first render, and written back with a
250 ms debounce after every change.

**If the stored data is unreadable** (corrupted JSON, tampered by hand, written by a
different app version), the app tries to keep it, but that is not a guarantee. On read
it attempts to copy the unparsed bytes into a third key, `aurora.tasks.v1.corrupted`,
before anything else touches `aurora.tasks.v1` — but that copy can itself fail (storage
quota, private-mode restrictions, an unavailable backend), in which case the attempt is
only logged in development and the original bytes are gone. The app then starts with an
empty list in memory and shows an error banner explaining that the stored data could not
be read. The banner's export button downloads the quarantine copy only if one was
actually saved and is still reachable; otherwise it shows a toast ("Выгружать нечего:
повреждённые данные не сохранились.") and does not produce a file.

## Fonts

The two typefaces (`Inter` variable and `JetBrains Mono`, 400 weight only) ship as
subset `.woff2` files committed in `src/assets/fonts/`, not loaded from a CDN — this
repository's dependency policy forbids third-party CDNs for scripts or fonts (see
[`docs/CODE-RULES.md`](docs/CODE-RULES.md) §1: it is both a third-party request on every
visit and external code/content in the app's own origin).

This is also why the build never needs network access: everything it serves is already
in the repository. To rebuild the subsets from the upstream font releases (only needed
if the subset's character coverage has to change), run `scripts/subset-fonts.sh` — it
takes the upstream `.ttf` files as arguments, and the script's header comment pins the
exact upstream release and `sha256` for each one, plus the `fonttools`/`brotli` versions
needed for a byte-for-byte reproducible rebuild.

## Contributing

- `main` is always green: there are no direct commits to `main`.
- One branch per task, named with the ticket id, e.g. `feat/FELA-15-task-list`,
  `fix/FELA-65-composer-focus`, `docs/FELA-24-readme`.
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
  checklist from [`docs/CODE-RULES.md`](docs/CODE-RULES.md).

## License

[MIT](LICENSE).
