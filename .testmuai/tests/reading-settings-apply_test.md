---
mode: testing
max_steps: 50
target: chrome
url: http://localhost:5173
headless: true
---

# Session: reading-settings-apply

## Step 1
Go to http://localhost:5173 and sign in as suite-reading-settings-apply-{{smart.random_string_8}}@test.local with code 000000. File Gutenberg ID 84 from the file-a-book page to open the cached Frankenstein edition. Open Aa using the Reading settings button. Use the row controls to set Font size to 22 px, Line width to Wide, and Background to 80%. Verify the reading text is visibly larger, the reading column is wider, and the linen page background is lighter than the defaults. Do not edit book content.
