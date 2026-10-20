# Code rules — Todo App

These rules are binding for every pull request in this repository. They come from the
threat model (FELA-4) and are enforced by `oxlint` where the linter can see the problem,
and by review where it cannot.

Source of truth for *why* each rule exists: the `threat-model` document on FELA-4,
sections 3–6. This file is the short, actionable form.

## 1. Never turn a string into HTML or into code

Forbidden, no exceptions without a Security review:

| Pattern | Why |
|---|---|
| `dangerouslySetInnerHTML` | stored XSS straight from the todo title |
| `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` via a `ref` | same thing, bypassing React |
| `eval`, `new Function`, `setTimeout`/`setInterval` with a string body | executes a string as code |
| user text in `href`, `src`, `action`, `formAction` | `javascript:` URL executes on click |
| user text inside `<svg>`, `<math>`, `<iframe srcdoc>` | different parsing context; React escaping does not protect there |
| rendering the todo title as markdown or HTML with any library | the library returns an HTML string, which lands back in `dangerouslySetInnerHTML` |
| `document.querySelector` with a user string, manual DOM writes through a `ref` | bypasses the React model and its escaping |
| third-party scripts or fonts from a CDN | external code in our origin, plus a user IP leak to a third party |

React escapes text in JSX, so `{todo.title}` is safe even for `<img src=x onerror=alert(1)>`.

**Do not sanitize the todo title on save.** Escaping belongs on output, and React does it.
Sanitizing on input silently corrupts legal `<`, `>` and `&` characters in titles.

If markdown in todos is ever needed, it is a separate ticket with a Security review, and it
requires sanitization (DOMPurify) **and** a CSP — not one of the two.

## 2. Search highlighting returns `ReactNode[]`, never a string with tags

Highlighting matched text is the most likely place for XSS in this product.

```tsx
// FORBIDDEN: stored XSS. A todo titled `<img src=x onerror=...>` runs code for
// anyone who types a matching search query.
<span dangerouslySetInnerHTML={{ __html: title.replace(query, `<mark>${query}</mark>`) }} />
```

Split the string and hand React **elements**:

```tsx
// Substring search, no regex: a user-supplied query inside a RegExp is its own
// problem (ReDoS / broken pattern).
export function highlight(title: string, query: string): React.ReactNode {
  const q = query.trim().toLowerCase()
  if (!q) return title
  const parts: React.ReactNode[] = []
  let rest = title
  let key = 0
  for (;;) {
    const at = rest.toLowerCase().indexOf(q)
    if (at === -1) break
    if (at > 0) parts.push(rest.slice(0, at))
    parts.push(<mark key={key++}>{rest.slice(at, at + q.length)}</mark>)
    rest = rest.slice(at + q.length)
  }
  parts.push(rest)
  return parts
}
```

Do not build a `RegExp` from a user query. Search by substring and cap the query length.

## 3. Reading `localStorage` is untrusted input

`localStorage` is readable and writable by any JavaScript on the same origin, and the demo
origin `annisorw.github.io` is shared with every other Pages project of the account. The
key name is hygiene, not isolation.

Keys are `aurora.tasks.v1` (payload `{ "version": 1, "tasks": Task[] }`) and `aurora.theme`
— see `docs/ARCHITECTURE.md` section 5, which is authoritative for key names and payload
shape. The `todo-app:` prefix of the scaffold placeholder is gone.

- `JSON.parse(raw) as Task[]` is a lie to the compiler — `as` checks nothing. Parse with a
  validating parser that rebuilds each object from known fields and drops invalid entries.
- Cap title length (500 characters) and item count (1000). Both limits are defined once, in
  the storage module owned by FELA-11, and imported by the parser, the writer and the input
  `maxLength`. Two copies of the same number will drift.
- Wrap writes in `try`/`catch` and handle `QuotaExceededError`. Never let a full quota crash
  the app.
- Regression tests are mandatory for: broken JSON, non-array payload, item with missing
  fields, non-string `title`, over-limit text, and a todo titled
  `<img src=x onerror=alert(1)>` rendering as text.

Allowed in `localStorage`: todo text, the done flag, ids, order, UI filter/sort, theme,
schema version. Forbidden: tokens, API keys, JWTs, passwords, personal data, cross-site
analytics ids, anything private. If server sync is ever added, a token in `localStorage` is
not an option — that is a separate ticket with a Security review.

## 4. The build is public

The repository, the bundle and the git history are public. Anything merged to `main` is
disclosed permanently.

- `import.meta.env.VITE_*` is inlined into the bundle text at build time. Put only values
  you would print on the landing page in a `VITE_` variable.
- `public/` is copied into `dist/` byte for byte. No drafts, dumps, screenshots or notes.
- Keep `build.sourcemap: false`.
- Tests and fixtures use synthetic data. No real names, e-mail addresses or personal todos.
- Never print the environment in CI (`env`, `printenv`, `set -x` around secrets).

## 5. What the linter catches, and what it does not

`.oxlintrc.json` enables these rules, each verified to fire on oxlint 1.88:

```jsonc
"react/no-danger": "error",
"react/no-danger-with-children": "error",
"react/jsx-no-target-blank": "error",
"no-script-url": "error",
"no-eval": "error",
"no-new-func": "error"
```

Known gaps in this version — verified **not** to fire, so only review catches them:

- `no-implied-eval` on `setTimeout('alert(1)')`
- `react/jsx-no-script-url` on an expression in `href` (only a literal is caught)
- `no-eval` on `globalThis.eval`
- `no-restricted-syntax` is not available

That is why the pull request checklist carries one explicit line: *no new place where a
string becomes HTML or code.* It is not a formality — it is the only control covering the
four cases above.

## 6. Review is a process gate, not a GitHub setting

`main` is protected with `required_approving_review_count: 0`. This is intentional, not an
oversight: every agent in this workspace pushes to GitHub under the same account
(`annisorw`), and GitHub refuses to let an account approve its own pull request. Raising
`required_approving_review_count` to `1` would not add a review — it would make every pull
request unmergeable, because the author and the only available approver are the same
account. Do not "fix" this by raising the required review count; that blocks the entire
merge pipeline instead of enforcing review.

The control is therefore process, not configuration: the pull request template carries a
"Merge gate" checklist item stating that the author does not merge their own pull request —
the task is moved to `in_review`, assigned to the reviewer (normally TechLead), and the
reviewer performs the merge. This only works if every agent honors the checklist; it is not
backstopped by GitHub.
