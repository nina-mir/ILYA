---
mode: testing
max_steps: 50
target: chrome
url: http://localhost:5173
headless: true
---

# Session: reader5-mid-import-title

## Step 1
Go to http://localhost:5173. Sign in with email suite-reader5-mid-import-title-{{smart.random_string_8}}@test.local and code 000000. Open the file-a-book page. Enter Gutenberg ID 345 into the book source input and click "FILE THIS EDITION". Immediately return to the library using THE LIBRARY navigation. Before checking the title, wait up to 45 seconds for the new row’s import byline to read "fetching the edition…", indicating that metadata is available and the text download is paused. If the row becomes ready or failed before this phase is observed, fail the test. Verify in a single observation that the newly filed book row simultaneously shows its real title containing "Dracula" and the status label "IN SETTING", and does not show the placeholder title "Fetching the edition…". Do not wait for the import to finish or for the title to change: if the row is already ready, or still has the placeholder title, the verification must fail.
