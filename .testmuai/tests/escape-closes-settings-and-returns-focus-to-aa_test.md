---
assurance:
  id: t-8
  base: sha256:00d044a0d5f9d40db95cf7c3e05a2f68fd33f0fbdcee334593f11b9ff28a3ca5
---
# Escape closes settings and returns focus to Aa

> With Reading settings open, press Escape and observe closure and restored focus on Aa.

## Step 1

Open {{start_url}} in a browser and reach the editor of ready edition {{edition_a_title}} as reader {{reader_a_email}}.

## Step 2 @verifies ac-21

In that editor, activate the Aa button labelled Reading settings, then assert the Reading settings panel is open.

## Step 3 @verifies ac-19, ac-20

With Reading settings open, press Escape, then assert the panel is closed and browser focus has returned to the Aa Reading settings trigger.
