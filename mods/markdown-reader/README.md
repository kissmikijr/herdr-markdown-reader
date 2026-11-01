# Markdown Reader

A calm reading space beside your work. Open it with **Ctrl+Shift+M**, or find **Markdown Reader** in the command palette.

## Open a document

Paste a file path into the path field and press **Enter** or **Open**. You can also drag a file from Explorer into the reader.

While the reader is active, press **Ctrl+L** to focus the file-path bar and select its contents.

The reader starts in your current terminal folder with the search field focused. The file list stays hidden until you type a non-empty search, and hides again when you clear the field or open a file. Type part of a filename (for example `readme` or `implplan`) to fuzzy-search nearby Markdown files, including subfolders. Type a folder path ending in `/` to browse its Markdown files and subfolders.

Use **↑ / ↓** to select, **Tab** to complete a path, and **Enter** to open a file or enter a folder. **Esc** dismisses suggestions. The folder is shown below the bar; **Use terminal folder** switches back to the current terminal's location. **Refresh** also refreshes the file list.

Search lists up to 3,000 files and skips dependency/cache folders. Without ripgrep, Windows uses a bounded scan; a `+` after the file count indicates a partial list. You can always open a full path directly.

- Absolute paths and `~/` paths work.
- Relative paths start from the terminal folder where you opened the reader.
- Local UTF-8 Markdown and text files up to **1 MiB** are supported.
- The reader checks the file for changes every **5 seconds**. **Refresh** checks immediately.

## Make yourself comfortable

Use **A−** and **A+** to change the text size. Text can be selected and copied. Links open in your browser.

Choose **Open in tab** for a full reading workspace. You can split a terminal beside it using Herdr's normal pane controls.

> This viewer follows your Herdr theme automatically.

## Open beside a terminal

Press **Ctrl+Shift+R** to open a reader pane to the right of the focused pane.

From a terminal, use:

```powershell
herdr-app do pane.split --direction right --mod markdown-reader
```

Or open the reader with **Ctrl+Shift+M** whenever you need it.
