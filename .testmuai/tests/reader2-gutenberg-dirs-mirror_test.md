---
mode: testing
max_steps: 50
target: chrome
url: http://localhost:5173
headless: true
---

# Session: reader2-gutenberg-dirs-mirror

## Step 1
Go to http://localhost:5173. Sign in with email suite-reader2-gutenberg-dirs-mirror-{{smart.random_string_8}}@test.local and code 000000. Open the file-a-book page. Paste https://www.gutenberg.org/dirs/1/3/4/2/1342/ into the book source input. Click the "FILE THIS EDITION" button. Verify that Pride and Prejudice is successfully filed and that no error message is displayed.
