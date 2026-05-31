# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of small, self-contained web apps ("toys") hosted on Cloudflare Pages with optional Cloudflare Workers backends. Each app is a single HTML file with inline CSS and JavaScript - no build tools, no frameworks, no transpilation.

**Production**: <https://toys.tfduesing.net>
**Preview deployments**: <https://*.toys-bm4.pages.dev>

## Architecture

**Frontend apps** live in the repository root as standalone `.html` files (e.g., `pickleball.html`, `soundboard.html`, `counter.html`). Each is fully self-contained with inline `<style>` and `<script>` tags. `index.html` is the landing page that links to all apps.

**Backend services** live under `workers/` (e.g., `workers/counter/`, `workers/snippets/`). The counter backend uses Cloudflare Workers with Durable Objects for real-time WebSocket sync and D1 (SQLite) for persistence. The snippets backend is a Cloudflare Worker backed by a D1 database with a REST API. Note: a worker's deployed name and URL come from the `name` field in its `wrangler.toml`, not the directory name.

Apps are either client-only (pickleball, soundboard, etc.) or client+worker (counter, snippets). The `snippets/` directory is a **separate Cloudflare Pages project** (not `toys-bm4`) with its own preview subdomain pattern (`*.snippets-68u.pages.dev`). Each worker's `PREVIEW_ORIGIN_PATTERN` must match the Pages project that hosts its frontend.

## Commands

### Deploy the counter worker

One-time setup (creates the D1 database, only needed if recreating from scratch - copy the printed `database_id` into `workers/counter/wrangler.toml`):

```shell
npx wrangler d1 create counter-db
npx wrangler d1 execute counter-db --remote --file=workers/counter/schema.sql --config workers/counter/wrangler.toml
```

Deploy:

```shell
npx wrangler deploy --config workers/counter/wrangler.toml
```

### Deploy the snippets worker

One-time setup (creates the D1 database, only needed if recreating from scratch — copy the printed `database_id` into `workers/snippets/wrangler.toml`):

```shell
npx wrangler d1 create snippets-db
npx wrangler d1 execute snippets-db --remote --file=workers/snippets/schema.sql --config workers/snippets/wrangler.toml
```

Deploy:

```shell
npx wrangler deploy --config workers/snippets/wrangler.toml
```

### Local development

No build step. Open any `.html` file directly in a browser, or use a local server. The counter and snippets apps require their deployed worker backends.

## Conventions

- **Single-file HTML** -- styles and scripts are inline. No separate CSS or JS files per app.
- **Vanilla JS only** -- no React, Vue, or other frameworks. No npm dependencies for frontend apps.
- **Adding a new app** -- create `appname.html` in the root, then add an entry to `index.html`'s `<ul>` list.
- **CSS reset** -- every page starts with `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`.
- **System font stack** -- `system-ui, Helvetica, Arial, sans-serif` as the default.
- **Security headers** -- apps that make network requests include a Content-Security-Policy meta tag scoped to their specific endpoints.
- **CORS** -- worker backends validate origins against an allowlist that includes production and `*.toys-bm4.pages.dev` preview domains.

## Deployment

Push to GitHub triggers automatic Cloudflare Pages deployment. Worker changes require a manual `wrangler deploy`.

## Git

This repo uses **rebase-only merges**. PR branches containing a merge commit must be linearized before GitHub will accept them: `git rebase main`, resolve any conflicts, then `git push --force-with-lease`.
