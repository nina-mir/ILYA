# Local Kane suite

From the repository root, with the API, web app and worker already running:

```sh
npm run test:kane
```

This first prepares the local test data, then runs all six configured tests in one
headless, serial Kane execution through `kanehack report`. Kane sign-in, credits
and report consent must already be available. This command spends Kane credits.

The runner passes `--evidence` to `kanehack report`. A small stream wrapper copies
the exact suite pack identified by Kane's execution ID into a unique
`.testmuai/evidence/suite-*/suite.evidence` path before reporting. It forwards
Kane's NDJSON and preserves its exit code, including failed runs. Missing packs
are errors; the runner never substitutes an older pack. These artifacts are ignored
by git. The installed `kanehack` uploads packs up to 4 MB directly; for larger packs
it records the SHA-256 and instructs you to upload through the Proof tab.

## Required local setup

- `apps/api/.env`: `EMAIL_MODE=console` and `IMPORT_DEBUG_TEXT_DELAY_MS=30000`.
  Restart the worker after changing its environment. The API must be in development
  mode so `@test.local` readers can use code `000000`.
- API at `http://localhost:3000`, web app at `http://localhost:5173`.
- Local development database with cached Frankenstein (84) and Pride and Prejudice
  (1342). Both are present in the database inspected during suite preparation.
- No active Dracula (345) imports from another run or reader.

`test:kane:prepare` checks the database is local and its name ends in `_dev`, checks
the two required cached books, and removes only Dracula's shared cache entry.
It never deletes readers or personal editions. It does not start or restart the
app. No database reset has been executed as part of preparing these files.

## Isolation and expectations

| Test | Setup |
| --- | --- |
| Empty shelf | Fresh `suite-reader1-empty-shelf-…@test.local` reader. |
| Gutenberg mirror URL | Fresh reader; cached Pride and Prejudice. |
| Mid-import title | Fresh reader; uncached Dracula; live worker with text delay. Wait for the text-fetching byline before checking the title and `IN SETTING` together. Ready/failed before that phase is a failure. |
| Settings apply | Fresh reader; cached Frankenstein; no previously saved reading preferences. |
| Settings persist | Separate fresh reader; cached Frankenstein; set preferences, reload, and check all three labels. |
| Jack London search | Fresh reader; imported local catalog; verify The Call of the Wild is returned for Jack London. |

Each saved test uses `{{smart.random_string_8}}` in its email. Kane resolves it
once for that test objective, including on subsequent replays. Browser profiles
are isolated by the suite runner. Old reader1–reader10 accounts and their saved
preferences do not affect these runs. Re-run preparation before each full suite;
the mid-import test must not be run again against the cache left by a prior run.

The mid-import test reads metadata from the imported local catalog and downloads
text from Gutenberg. A download timeout is a dependency failure, not proof of a title regression.
The apply recording previously verified the settings labels instead of independently
asserting rendered styles; its assertions have not been broadened in this setup-only change.
Edits to test objectives cause Kane to record those steps again on the next run.
