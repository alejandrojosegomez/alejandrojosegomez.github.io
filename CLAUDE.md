# CLAUDE.md — Rules for editing alejandrogomez.me

This repo is Alejandro Gomez's live portfolio. `main` deploys straight to
production (https://alejandrogomez.me) through Vercel. Treat `main` as live.

Also read `AGENTS.md` (Next.js version notes — this Next.js has breaking
changes; check `node_modules/next/dist/docs/` before using an API you're unsure of).

## Safe change workflow (always follow)

1. **Start fresh:** `git fetch origin main && git checkout -b claude/<short-change-name> origin/main`
2. **Make only the change that was asked for.** No unrelated refactors,
   renames, dependency upgrades or style rewrites.
3. **Check before pushing:**
   - `npx tsc --noEmit` must pass.
   - `npm run lint` must not get worse than before the change (compare error count).
   - `npm run build` should pass. In sandboxes without access to Google Fonts,
     the build can fail only on `next/font` fetching Geist; that is an environment
     issue, not a code issue — rely on the Vercel preview build instead.
4. **Push the branch, never `main`:** `git push -u origin claude/<short-change-name>`
   and open a pull request.
5. **Verify the Vercel preview:** the preview deployment for the branch must
   reach `READY`. If it fails, read the build logs, fix, and push again.
6. **Send Alejandro the preview link and wait for his OK.** Only after he
   approves: merge the PR into `main` (squash), then confirm the production
   deployment is `READY` and alejandrogomez.me loads.

## Credit and authorship

- Every commit is authored by **Alejandro Gomez <alejandrogom2025@my.fit.edu>**
  (`git -c user.name="Alejandro Gomez" -c user.email="alejandrogom2025@my.fit.edu" commit ...`).
- Claude is credited only as a co-author, with one trailer line at the end of the message:
  `Co-Authored-By: Claude <noreply@anthropic.com>`
- Pull requests are opened and merged under Alejandro's GitHub account. No
  "Generated with Claude Code" footer or session links in PRs or commits.

## Never do

- Never push or force-push directly to `main`.
- Never put secrets, API keys or `DATABASE_URL` in code. Secrets live in
  Vercel → Project Settings → Environment Variables.
- Never delete or edit `CNAME`, DNS settings, Vercel domain settings or
  environment variables unless explicitly asked.
- Never delete images in `public/assets/` unless explicitly asked.
- Never bump `next`, `react` or other dependencies unless explicitly asked.

## If production breaks

Roll back right away in Vercel (Deployments → last good build → Instant
Rollback / promote), then fix forward on a new branch with `git revert`.

## Project map

- `app/page.tsx` — the whole single-page portfolio (sections, content, data).
- `app/layout.tsx` — fonts, metadata (canonical should be https://alejandrogomez.me).
- `app/globals.css` — Tailwind v4 global styles.
- `public/assets/` — portrait and project images.
