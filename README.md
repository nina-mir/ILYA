# ILYA

**A personal classics workshop.**

ILYA turns public-domain texts from [Project Gutenberg](https://www.gutenberg.org/) into personal, editable reading editions. Find a book, file it to a private library, read it in an editorial-style workspace, and make changes that persist between sessions.

The application runs on an independent **React + Hono + PostgreSQL** stack. Its Gutenberg text-cleaning pipeline is deterministic; no AI model is required to import a book.

## Features

- **Private library:** Email-code sign-in and a personal shelf for each reader.
- **Three ways to file:** Search by title or author in a local copy of Project Gutenberg's catalog, paste a Project Gutenberg URL, or enter a Gutenberg ebook ID.
- **Background import:** A database-backed worker downloads plain text, processes it into Markdown, caches the source edition, and prepares a separate personal copy.
- **Book editor:** Read and edit text with [Tiptap](https://tiptap.dev/); changes autosave to PostgreSQL.
- **Reading experience:** Editorial typography, chapter navigation, and saved reading position.
- **Reading settings:** Adjust font size, line width, and background lightness from the **Aa** button; choices are saved per reader.
- **Withdrawals:** Remove an edition—including during an import—without deleting another reader's copy or the shared cache.

## Built at Kane CLI Hack Day (Oct 24, 2026)

Ilya was migrated by hand from a proprietary AI-agent platform to this stack before the event. Everything up to the [`before-hackathon`](https://github.com/nina-mir/ILYA/tree/before-hackathon) tag existed at 10 AM; everything after it was built on the day, using Codex as the coding agent and [Kane CLI](https://www.testmuai.com/docs/kane-cli-introduction) to verify the app in a real browser.

**What Kane caught, and how it was fixed** (each bug failed in Kane first, was fixed, and then passed on a new commit):

| Bug | Red run | Green run |
|---|---|---|
| Gutenberg `/dirs/` mirror links were rejected by the server and misread as book 1 in the browser | KR-107 | KR-119 |
| The library showed a placeholder title for the whole import instead of the book's title | KR-135 | KR-143 |
| Searching "Jack London" didn't show *The Call of the Wild* (results sorted by title, cut at 24) | KR-229 | KR-239 |

**New on the day**
- **Reading settings:** an **Aa** button in the editor adjusts font size, line width, and background lightness, saved per reader. Verified by Kane (KR-184, KR-189).
- **Local catalog:** search used to call Gutendex, which kept timing out. Ilya now imports Project Gutenberg's own catalog (78,383 books) into Postgres, so search and filing work without it.
- **Assurance loop:** `docs/requirements.md` was turned into use-cases and generated tests with Kane's `context` and `design` commands. The generated reload test passed at the limit values (24px / Full / 60%, KR-269), and `kane-cli cover` reports 2 of 21 reading-settings criteria proven, with the rest listed as still owed.

### Test login (development only)
With `EMAIL_MODE=console`, any email ending in `@test.local` signs in with the code `000000`. Each new address starts with an empty shelf. This shortcut exists so Kane can sign in on its own; it is disabled in production.

### Running the Kane tests
Install [Kane CLI](https://www.testmuai.com/docs/kane-cli-installation), start Ilya with `npm run dev`, then:

```bash
npm run test:kane
```

This prepares fresh test data and runs the saved flows in `.testmuai/tests/` headlessly. Each flow is plain English, and Kane also exports it as a Playwright script.

**Dev-only import delay:** set `IMPORT_DEBUG_TEXT_DELAY_MS=30000` in `apps/api/.env` to pause imports for 30 seconds after metadata, which makes the mid-import test reliable. It defaults to 0 and is ignored in production.

## Stack

| Layer | Technology |
| --- | --- |
| Web | React, Vite, TypeScript, Tiptap, Zustand, Wouter, SWR |
| API | Node.js, Hono, TypeScript |
| Database | PostgreSQL 16, Drizzle ORM |
| Authentication | Six-digit email-code login and cookie-based sessions |
| Background work | PostgreSQL import jobs and a Node.js worker |
| Catalogue and texts | Project Gutenberg catalog (imported locally), Gutendex fallback, Project Gutenberg downloads |
| Local development | npm workspaces, Docker Compose, concurrently |

## Repository layout

```text
apps/
  web/                 React frontend and Tiptap editor
  api/
    src/
      routes/          Hono HTTP endpoints
      auth/            Login, sessions, and authorization
      db/              Drizzle schema and database client
      importer/        Gutenberg fetching, processing, and job handling
      worker.ts        Import worker entry point
packages/
  shared/
    src/gutenberg/     Gutenberg ID parsing, metadata, and text processing
scripts/               Project utilities
```

## Run locally

**Requirements:** Node.js **20.19+**, npm, Docker, and Docker Compose. Ports **5432**, **3000**, and **5173** must be available.

```bash
git clone https://github.com/nina-mir/ILYA.git
cd ILYA
npm ci
```

### 1. Configure the API

Create `apps/api/.env` (and a matching root `.env` if using root-level tooling). For local development:

```dotenv
DATABASE_URL=postgres://ilya:ilya_dev_password@localhost:5432/ilya_dev
API_PORT=3000
WEB_ORIGIN=http://localhost:5173
AUTH_COOKIE_NAME=ilya_session
AUTH_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
EMAIL_MODE=console
```

Generate a secret with `openssl rand -hex 32`. Do not commit `.env` files or actual secrets. Other authentication and import settings have defaults in `apps/api/src/env.ts`.

**Note:** The existing `.env.example` contains older `SESSION_*` names. The current API expects `AUTH_COOKIE_NAME` and `AUTH_SECRET`, as shown above.

### 2. Start PostgreSQL and apply migrations

```bash

# Only if the system PostgreSQL service conflicts with Docker
sudo systemctl stop postgresql

# Ubuntu: start the Docker daemon if necessary
sudo systemctl start docker

# Start ILYA's PostgreSQL container
npm run db:up

npm run db:migrate
npm run db:check

# Populate the local Gutenberg catalogue on a fresh database
npm run catalog:import
```

Docker Compose stores database files in a persistent volume. `npm run db:down` stops the container without removing the volume. Avoid `docker compose down -v` unless you intend to delete local data.

If port 5432 is already in use, stop the conflicting local PostgreSQL service or change the Docker port mapping and `DATABASE_URL` together.

### 3. Start ILYA

```bash
npm run dev
```

This runs three development processes in one terminal:

- **Web:** <http://localhost:5173>
- **API:** <http://localhost:3000> (health check: <http://localhost:3000/health>)
- **Worker:** Polls for pending Gutenberg imports and processes them automatically.

The PostgreSQL container must already be running. Press **Ctrl+C** to stop the development processes; PostgreSQL remains available separately.

### 4. Sign in and file a book

Open the web URL and enter an email address. In `EMAIL_MODE=console`, the six-digit sign-in code appears in the **API terminal output**, not in an inbox. Complete sign-in, then search for a title or enter a known Gutenberg ID, such as `174` (*The Picture of Dorian Gray*). The worker prepares the edition in the background; once it is ready, open it from the shelf and edit it.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start web, API, and worker together |
| `npm run dev:web` | Start only the web app |
| `npm run dev:api` | Start only the API |
| `npm run dev:worker` | Start only the import worker |
| `npm run typecheck` | Type-check web and API |
| `npm run build` | Build web and API |
| `npm run db:up` / `npm run db:down` | Start / stop local PostgreSQL |
| `npm run db:migrate` | Apply existing Drizzle migrations |
| `npm run catalog:import` | Download and upsert Gutenberg's catalog for local search |
| `npm run db:check` | Check database connectivity and table counts |
| `npm run db:studio` | Open Drizzle Studio |

## Design and implementation notes

After migrating a new database, run `npm run catalog:import` before searching.
Search uses the local catalog, matching words across title and author, and returns
up to 24 results. Re-run the command to refresh metadata; it updates existing IDs
without deleting cached text or personal editions. To import a saved CSV instead,
use `npm run catalog:import -- /absolute/path/pg_catalog.csv`. The complete file is
validated before a transactional update, so a failed import preserves the catalog.
The worker also reads metadata and the text URL from this table first, falling
back to Gutendex only for an ID absent from the catalog. Text downloads still
come from Project Gutenberg and keep the existing validation and size limits.

ILYA uses linen-and-umber, print-inspired typography rather than a conventional dashboard interface. The source processing deliberately favors repeatable, deterministic cleanup over generative rewriting. A shared cached edition and a reader's editable copy are stored separately, so personal changes do not alter the common source text.

**Current scope:** Local-first MVP. Public deployment, a more robust import-cancellation workflow, and improvements to Gutenberg table-of-contents recognition remain future work. Catalog refreshes and book downloads require external Gutenberg services; searching an imported catalog works locally.

## Development workflow

Changes are developed on feature branches, reviewed through GitHub pull requests, and merged into `main`. Run `npm run typecheck` and `npm run build` before opening a PR, along with feature-specific manual or automated tests.

## Credits

Created by [Nina Mir](https://github.com/nina-mir). Book metadata and public-domain texts are retrieved from [Gutendex](https://gutendex.com/) and [Project Gutenberg](https://www.gutenberg.org/). Check the rights and usage requirements for each text in your jurisdiction.
