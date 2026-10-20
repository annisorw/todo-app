## What changed

<!-- Short description of the change and why it's needed -->

## How to verify

<!-- Commands or steps to check the change locally -->

## Merge gate

Автор не мержит этот PR сам. Это больше не чекбокс на честность: проверка
`review-ack` держит PR красным, пока ревьюер не оставит комментарий
`/merge-ok` (или `/merge-ok <sha>`) на актуальном head SHA. Любой новый пуш
сбрасывает отметку обратно в `failure` — старое одобрение не переживает
`synchronize`. Механика — в `.github/workflows/review-ack.yml`.

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Tests cover the new logic and fail against the old code
- [ ] No dead code, commented-out code, `console.log`, or `TODO` without an issue link

## Security checklist

See [docs/CODE-RULES.md](https://github.com/annisorw/todo-app/blob/main/docs/CODE-RULES.md).
The linter does not catch everything, so these are answered by the author, not by CI.

- [ ] No new place where a string becomes HTML or code — no `dangerouslySetInnerHTML`, no
      `innerHTML`/`outerHTML`/`insertAdjacentHTML` via a `ref`, no `eval`, no `new Function`,
      no `setTimeout`/`setInterval` with a string body
- [ ] No user text in `href`/`src`/`action`, inside `<svg>`, or in `<iframe srcdoc>`
- [ ] Todo text is not rendered as markdown or HTML
- [ ] Search highlighting returns `ReactNode[]`, and no `RegExp` is built from a user query
- [ ] Data read from `localStorage` is validated, not cast with `as`; writes are in
      `try`/`catch`
- [ ] No new runtime dependency; or it is named in the description with a reason, and
      Security has been asked to look
- [ ] No third-party script or font loaded from a CDN
- [ ] Nothing private added to `VITE_*` variables, `public/`, tests, or fixtures
- [ ] No secrets, tokens, keys, or `.env` files in the diff
