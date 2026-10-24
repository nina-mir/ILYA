---
assurance:
  id: t-7
  base: sha256:7b46420ccc0a627e93c0a8339e21fc9ef7dbff07a54fe03157925958a3f5bc80
---
# Unsaved narrow-screen reading defaults

> For a reader with no explicitly saved font size, compare initial defaults at 899 px to the 900 px threshold.

## Step 1

Open {{start_url}} in a browser at 899 px viewport width and reach the editor of ready edition {{edition_a_title}} as reader {{reader_a_email}}, with no explicitly saved reading font size, width, or background for this reader.

## Step 2 @verifies ac-15, ac-16, ac-17

At 899 px viewport width in that editor, open Aa Reading settings, then assert the unsaved font size is 18 px, line width is Medium, and background is 100%.
