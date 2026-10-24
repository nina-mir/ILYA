#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Only test setup is performed here; the application must already be running.
npm run test:kane:prepare

tests=(
  .testmuai/tests/reader1-empty-shelf_test.md
  .testmuai/tests/reader2-gutenberg-dirs-mirror_test.md
  .testmuai/tests/reader5-mid-import-title_test.md
  .testmuai/tests/reading-settings-apply_test.md
  .testmuai/tests/reading-settings-persistence_test.md
)

# Serial execution avoids CPU-heavy book layout competing across browsers.
# stdin is closed so testrun emits NDJSON and exits without opening a TUI.
mkdir -p .testmuai/evidence
suite_artifacts=$(mktemp -d .testmuai/evidence/suite-XXXXXX)
KANE_CLI_USER_AGENT=codex kanehack report --evidence "$suite_artifacts/suite.evidence" -- \
  node scripts/capture-kane-evidence.mjs "$suite_artifacts/suite.evidence" \
  kane-cli testrun run "${tests[@]}" \
  --agent --headless --parallel 1 < /dev/null
