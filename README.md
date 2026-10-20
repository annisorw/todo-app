# todo-app

Modern animated to-do list web app. React + TypeScript + Vite + Tailwind CSS + Framer Motion.
Data is stored in `localStorage` only — no backend, no accounts.

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # type-check and build for production
npm run preview    # preview the production build locally
npm run lint        # lint the source
npm run typecheck   # type-check the project
npm run test        # run the test suite
```

## Requirements

- Node.js 24+

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — folder layout, data model, state and storage contract. Read this before writing code.
- [`docs/design-spec.md`](docs/design-spec.md) — design tokens, components, screen states and acceptance criteria.
- [`docs/CODE-RULES.md`](docs/CODE-RULES.md) — binding code rules: what must never turn a string into HTML or code, how search highlighting works, how `localStorage` is validated, and what may go into the public build.
