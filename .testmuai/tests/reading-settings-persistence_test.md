---
mode: testing
max_steps: 50
target: chrome
---

# Session: reading-settings-persistence

## Step 1
Go to http://localhost:5173 and sign in as reader9@test.local with code 000000. File Gutenberg ID 84 from the file-a-book page to open the cached Frankenstein edition. Open Aa using the Reading settings button. Use the row controls to set Font size to 22 px, Line width to Wide, and Background to 80%. Reload the page, reopen Aa using Reading settings, and verify the popover shows all three values: Font size 22 px, Line width Wide, and Background 80%. Do not edit book content.
