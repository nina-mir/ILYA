---
assurance:
  id: t-1
  base: sha256:4501aedd2c64135400acf218f4af3f0b66804f50e60a343102360f88e5dd7bc5
---
# Reader settings stay separate across accounts

> After reader A saves settings, inspect reader B's settings in the same browser and ensure A's preferences are not attributed to B.

## Step 1

Open {{start_url}} in a browser and reach the editor of ready edition {{edition_a_title}} as reader {{reader_a_email}}.

## Step 2

In reader {{reader_a_email}}'s editor, open the Aa Reading settings panel and set font size to 24 px, line width to Full, and background to 60%.

## Step 3 @verifies ac-3

In the same browser, establish reader {{reader_b_email}}'s own account and open ready edition {{edition_b_title}}; open its Aa Reading settings panel, then assert reader A's 24 px, Full, 60% preferences are absent as reader B's unsaved preferences.
