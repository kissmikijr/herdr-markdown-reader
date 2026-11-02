# Markdown Reader

A Markdown reading space beside your work.
Open it with **Ctrl+Shift+M**, or find **Markdown Reader** in the command palette.

## Open a document

The reader starts in the selected terminal's current folder.
Click a folder in the file tree to expand or collapse it, then click a Markdown file to open it.
The sidebar button hides or shows the tree.
Use the tree kebab menu to collapse all folders.

Click the folder indicator to enter a workspace path or **Browse this computer** to use the system folder picker.
The tree and filename search use that folder until you choose another one.
An invalid folder keeps the current document and workspace.
In a remote workspace, a typed folder path uses the remote machine; Browse selects a local folder.

Type part of a filename, such as `readme`, or a path, such as `guides/install`, to search across subfolders.
Results show filenames and parent folders, with up to 50 results in a scrollable list.
A folder path ending in `/` lists that folder's Markdown files and subfolders.
You can also paste an absolute or relative file path and press **Enter** or **Open**.
Dropping a local file opens it without changing the workspace folder.

Use **↑ / ↓** to select, **Tab** to complete a path, and **Enter** to open a file or enter a folder.
**Esc**, clearing the search, or opening a file closes the result list.
**Ctrl+L** or **Command+L** focuses the search field.

Search indexes up to 3,000 files and skips dependency/cache folders.
Without ripgrep, Windows uses a bounded scan; a `+` after the file count indicates a partial list.
You can always open a full path directly.

- Absolute paths and `~/` paths work.
- Relative paths start from the chosen workspace folder.
- Local UTF-8 Markdown and text files up to **1 MiB** are supported.
- The reader checks the file for changes every **5 seconds**.
  **Refresh files and document** in the Menu checks immediately and refreshes the tree and search index.

The reader remembers the last open file, expanded folders, text size, and sidebar visibility for each workspace folder.
Local and remote folders have separate saved state.
State is stored by Herdr and returns when you reopen the reader or select that folder again.
A file given explicitly when opening the reader takes priority over the saved file.

## Make yourself comfortable

Open the toolbar **kebab menu** to use **A−** and **A+** for text size, or **Reset text size** to return to 15 px.
The Menu also has **Use terminal folder** to set the workspace from the terminal again.
Text can be selected and copied.
Links use Herdr's Markdown renderer.

Choose **Open in tab** in the overlay's Menu for a full reading workspace.
This keeps the file, folder, machine context, text size, and sidebar visibility.
You can split a terminal beside it using Herdr's normal pane controls.

> This viewer follows your Herdr theme automatically.

## Open beside a terminal

Press **Ctrl+Shift+R** to open a reader pane to the right of the focused pane.

From a terminal, use:

```powershell
herdr-app do pane.split --direction right --mod markdown-reader
```

Or open the reader with **Ctrl+Shift+M** whenever you need it.
