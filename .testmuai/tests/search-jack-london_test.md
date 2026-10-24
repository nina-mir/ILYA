---
mode: testing
max_steps: 50
target: chrome
url: http://localhost:5173
headless: true
---

# Session: search-jack-london

## Step 1
Go to http://localhost:5173 and sign in as suite-search-jack-london-{{smart.random_string_8}}@test.local with code 000000. Open the file-a-book page. Enter exactly "Jack London" into the ADDRESS · NUMBER · TITLE search input and wait for its search results to load. Verify that a book titled "The Call of the Wild" (case-insensitive title match) appears among the rendered search results. Keep the query "Jack London" unchanged; do not enter a book ID, file a book, or switch to a title search.
