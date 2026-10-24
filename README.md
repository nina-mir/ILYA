# ILYA

**A personal classics workshop.**

ILYA turns public-domain texts from [Project Gutenberg](https://www.gutenberg.org/) into personal, editable reading editions. Find a book, file it to a private library, read it in an editorial-style workspace, and make changes that persist between sessions.

The application runs on an independent **React + Hono + PostgreSQL** stack. Its Gutenberg text-cleaning pipeline is deterministic; no AI model is required to import a book.

## Features

- **Private library:** Email-code sign-in and a personal shelf for each reader.
- **Three ways to file:** Search by title or author via [Gutendex](https://gutendex.com/), paste a Project Gutenberg URL, or enter a Gutenberg ebook ID.
- **Background import:** A database-backed worker downloads plain text, processes it into Markdown, caches the source edition, and prepares a separate personal copy.
- **Book editor:** Read and edit text with [Tiptap](https://tiptap.dev/); changes autosave to PostgreSQL.
- **Reading experience:** Editorial typography, chapter navigation, and saved reading position.
- **Withdrawals:** Remove an edition—including during an import—without deleting another reader's copy or the shared cache.

## Stack

| Layer | Technology |
| --- | --- |
| Web | React, Vite, TypeScript, Tiptap, Zustand, Wouter, SWR |
| API | Node.js, Hono, TypeScript |
| Database | PostgreSQL 16, Drizzle ORM |
| Authentication | Six-digit email-code login and cookie-based sessions |
| Background work | PostgreSQL import jobs and a Node.js worker |
| Catalogue and texts | Gutendex and Project Gutenberg |
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
npm run db:up
npm run db:migrate
npm run db:check
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
| `npm run db:check` | Check database connectivity and table counts |
| `npm run db:studio` | Open Drizzle Studio |

## Design and implementation notes

ILYA uses linen-and-umber, print-inspired typography rather than a conventional dashboard interface. The source processing deliberately favors repeatable, deterministic cleanup over generative rewriting. A shared cached edition and a reader's editable copy are stored separately, so personal changes do not alter the common source text.

**Current scope:** Local-first MVP. Public deployment, a more robust import-cancellation workflow, and improvements to Gutenberg table-of-contents recognition remain future work. Availability of catalogue search and downloads depends on external Gutenberg services and network connectivity.

## Development workflow

Changes are developed on feature branches, reviewed through GitHub pull requests, and merged into `main`. Run `npm run typecheck` and `npm run build` before opening a PR, along with feature-specific manual or automated tests.

## Credits

Created by [Nina Mir](https://github.com/nina-mir). Book metadata and public-domain texts are retrieved from [Gutendex](https://gutendex.com/) and [Project Gutenberg](https://www.gutenberg.org/). Check the rights and usage requirements for each text in your jurisdiction.
