---
assurance:
  id: t-2
  base: sha256:8639d7388b0ed2bb165494d29b270bdfaedd121719cb1849a7d7c168ea192234
---
# Saved reading settings survive same-edition reload

> Change reading settings and reload the same edition for the same reader.

## Step 1

Go to http://localhost:5173 and sign in with email {{reader_a_email}} and code 000000. Open the ready edition {{edition_a_title}} in the editor.

## Step 2 @verifies ac-7

In that editor, open Aa Reading settings and change font size to 24 px, line width to Full, and background to 60%, then assert the reading appearance reflects the selected settings without reloading.

## Step 3 @verifies ac-1

Reload the same edition in the same browser as reader {{reader_a_email}} and reopen Aa Reading settings, then assert its reading preferences are the explicitly saved 24 px, Full, and 60%.
