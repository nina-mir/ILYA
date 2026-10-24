# Ilya reader journeys — current behavior

These requirements describe the current implementation, based on the reader pages, reading-settings component and hook, and README. They are not new feature requests.

## Sign in with an email code
A reader enters an email address, requests a six-digit code, and enters or pastes the code to reach their private library. Invalid codes show an error and allow another attempt. A code can be resent after a 30-second cooldown. In local console email mode, the code is delivered to the API terminal output.

## File a book by ID, link, or search
From the library, the reader opens the filing page and enters a Project Gutenberg ebook number, pastes a Gutenberg link, or searches by title or author and selects a result. Filing creates or opens the reader's personal edition. Invalid input and filing or search failures display an error; searches can also return no results.

## Watch an import
The personal edition is prepared in the background. The library and edition page refresh while import is underway, displaying preparation status as metadata and text are fetched and processed. A ready edition opens for reading and editing; a failed import displays its failure message.

## Read and edit
The reader opens a ready edition, reads the text, and navigates detected headings through Contents. The text is editable, with selection controls for bold, italic, chapter heading, blockquote, and links. Edits autosave with visible saving, saved, or error feedback. Saved edits belong to the personal copy and remain when it is reopened.

## Resume reading
The browser remembers position per edition. Reopening the edition restores the saved heading when available, otherwise the saved scroll position. Position is saved after scrolling pauses, when the page is hidden, and when leaving the editor. This is browser-local persistence.

## Withdraw an edition
The reader requests withdrawal from the library or editor and sees a confirmation naming the edition. Cancelling keeps it on the shelf. Confirming removes the personal reading copy and annotations, clears its saved reading position, and returns or refreshes the library. Editions can also be withdrawn during import. Other readers' copies and the shared original remain available.

## Reading settings that persist
In the editor, the reader opens the Aa button labelled Reading settings. Font size changes in 2 px steps from 14 to 24 px; line width offers Narrow, Medium, Wide, and Full; background changes in 10-point steps from 60% to 100%. Each control shows its value and disables decrease or increase at its limit. Changes immediately affect the reading appearance.

Preferences persist for the same reader across reloads and reopening editions in the same browser using local storage keyed by reader ID. Different readers have separate preferences. Defaults are Medium width and 100% background, with 16 px font on screens at least 900 px wide and 18 px on narrower screens until an explicit font size is saved. Invalid stored values fall back to defaults. If storage is unavailable, controls still work for the current page. Clicking outside closes the settings panel; Escape closes it and returns focus to the Aa trigger.
