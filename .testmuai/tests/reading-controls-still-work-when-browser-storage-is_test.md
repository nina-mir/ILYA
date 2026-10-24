---
assurance:
  id: t-4
  base: sha256:eeec22490f610117d1a84b47cbd8199edfec8d1a70cc14987959a98d10502d7d
---
# Reading controls still work when browser storage is unavailable

> Make local storage unavailable and change reading appearance on the current page.

## Step 1

Open {{start_url}} in a browser and reach the editor of ready edition {{edition_a_title}} as reader {{reader_a_email}}.

## Step 2

For this page, configure browser local storage access to be unavailable before loading the editor with its Reading settings control.

## Step 3 @verifies ac-6

On the current editor page, open Aa Reading settings and change the reading font size, then assert reading appearance changes on the current page despite unavailable local storage.
