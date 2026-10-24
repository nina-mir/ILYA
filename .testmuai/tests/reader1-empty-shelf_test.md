---
mode: testing
max_steps: 50
target: chrome
url: http://localhost:5173
headless: true
---

# Session: reader1-empty-shelf

## Step 1
Go to http://localhost:5173. Sign in with email suite-reader1-empty-shelf-{{smart.random_string_8}}@test.local and code 000000, then verify the library page shows the empty-shelf message "An empty shelf."
