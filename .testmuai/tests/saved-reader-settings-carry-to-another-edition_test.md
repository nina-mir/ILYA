---
assurance:
  id: t-5
  base: sha256:4a0ae0a25a2621c415cd38c673d861604e8da5569d27694489f7318040626e38
---
# Saved reader settings carry to another edition

> After saving preferences, open a different edition for the same reader in the same browser.

## Step 1

Open {{start_url}} in a browser and reach the editor of ready edition {{edition_a_title}} as reader {{reader_a_email}}.

## Step 2

In the first edition's Aa Reading settings panel, set font size to 24 px, line width to Full, and background to 60%.

## Step 3 @verifies ac-2

In the same browser as reader {{reader_a_email}}, open a different ready edition {{edition_b_title}} and its Aa Reading settings panel, then assert its settings equal this reader's explicitly saved 24 px, Full, and 60% preferences.
