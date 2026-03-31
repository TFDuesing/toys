# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of small, self-contained web apps ("toys") hosted on Cloudflare Pages with optional Cloudflare Workers backends. Each app is a single HTML file with inline CSS and JavaScript -- no build tools, no frameworks, no transpilation.

**Production**: https://toys.tfduesing.net
**Preview deployments**: https://*.toys-bm4.pages.dev

## Architecture

**Frontend apps** live in the repository root as standalone `.html` files (e.g., `counter.html`, `soundboard.html`, `pickleball.html`). Each is fully self-contained with inline `<style>` and `<script>` tags. `index.html` is the landing page that links to all apps.

**Backend services** live in their own directories (e.g., `counter-worker/`). The counter backend uses Cloudflare Workers with Durable Objects for real-time WebSocket sync and D1 (SQLite) for persistence.

Apps are either client-only (pickleball, soundboard) or client+worker (counter). The `snippets/` directory is a separate Cloudflare Pages app.

## Commands

### Deploy the counter worker
```
npx wrangler deploy --config counter-worker/wrangler.toml
```

### Local development
No build step. Open any `.html` file directly in a browser, or use a local server. The counter app requires the deployed worker backend.

## Conventions

- **Vanilla JS only** -- no React, Vue, or other frameworks. No npm dependencies for frontend apps.
- **Single-file HTML** -- styles and scripts are inline. No separate CSS or JS files per app.
- **System font stack** -- `system-ui, Helvetica, Arial, sans-serif` as the default.
- **CSS reset** -- every page starts with `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`.
- **Security headers** -- apps that make network requests include a Content-Security-Policy meta tag scoped to their specific endpoints.
- **CORS** -- worker backends validate origins against an allowlist that includes production and `*.toys-bm4.pages.dev` preview domains.
- **Adding a new app** -- create `appname.html` in the root, then add an entry to `index.html`'s `<ul>` list.

## Deployment

Push to GitHub triggers automatic Cloudflare Pages deployment. Worker changes require a manual `wrangler deploy`.
