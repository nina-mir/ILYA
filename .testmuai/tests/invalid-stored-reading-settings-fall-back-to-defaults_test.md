---
assurance:
  id: t-3
  base: sha256:7e64aa9045cf4bbab30767eb4b4736a24e716ec460bbc0e033ce28ae73012274
---
# Invalid stored reading settings fall back to defaults

> Expose an invalid saved setting for a reader and check the documented default.

## Step 1

Open {{start_url}} in a browser at 900 px viewport width and reach the editor of ready edition {{edition_a_title}} as reader {{reader_a_email}}.

## Step 2

For reader {{reader_a_email}}, identify the browser-local reading-settings entry associated with the active reader ID and replace its stored font, width, and background values with invalid values before reopening the editor.

## Step 3 @verifies ac-5, ac-14, ac-16, ac-17

In that editor at 900 px viewport width, open Aa Reading settings after loading the invalid stored values, then assert each invalid value has fallen back to its documented default: font size 16 px, width Medium, background 100%.
