import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Input, InputState, TextView } from "gpui-base";
import { theme, props, focused, panes, spaces, home, readTextFile, run, closeOverlay, nextCommand } from "herdr";
import { indexMarkdown, listFolder } from "./files.js";
import { clean, resolvePath, rankFiles } from "./search.js";

function currentFolder() {
  const f = focused(), space = spaces().find(s => s.active);
  const terminal = panes().find(p => p.tab === f?.tab && p.terminal && p.cwd);
  return { cwd: f?.cwd || terminal?.cwd || space?.folder || home(), on: space?.machine || null };
}

const WELCOME = `# A little room to read

Your Markdown, beautifully at home in Herdr.

Open a file above, or **drop a Markdown file anywhere in this reader**. Relative paths start from the terminal folder you opened the reader in.

## Made for your workflow

- Read documentation beside your terminal.
- Select and copy text, follow links, and scroll at your own pace.
- Adjust the text size with **A−** and **A+**.
- File changes appear automatically, every few seconds.

> A quieter way to read a README, review a plan, or keep your notes close.

## All the familiar Markdown

**Bold ideas**, *small details*, and \`inline code\` get their own place.

\`\`\`js
const idea = "Keep the docs beside the work.";
console.log(idea);
\`\`\`

| Read | Review | Reference |
| --- | --- | --- |
| Project READMEs | Implementation plans | Personal notes |

---

Use **Ctrl+Shift+M** to open this reader again. Choose **Open in tab** for a full reading workspace.
`;

export default class MarkdownReader extends View {
  init(_props, cx) {
    const p = props() || {};
    const context = currentFolder();
    this.base = p.cwd || context.cwd;
    this.on = p.on !== undefined ? p.on : context.on;
    this.file = null;
    this.content = WELCOME;
    this.fontSize = 15;
    this.request = 0;
    this.loading = false;
    this.error = null;
    this.files = []; this.matches = []; this.selected = 0;
    this.searchVersion = 0; this.indexVersion = 0;
    this.showSuggestions = false;
    this.inputFocused = false;
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.input = InputState.new({ placeholder: "Search Markdown files or type a folder/path…", value: p.file || p.query || "" });
    this.input.on("change", (_e, cx) => this.queryChanged(cx));
    this.input.on("submit", (_e, cx) => this.submit(cx));
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    if (p.file) this.open(p.file, cx);
    else if (clean(p.query)) this.queryChanged(cx);
    this.reindex(cx);
    // Pane creation assigns focus after init; focus the search once it mounts.
    cx.timer.after(1, cx => { this.focusPath(); cx.notify(); });
    cx.timer.every(5000, cx => { if (this.file && !this.loading) this.load(cx, true); });
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        if (command === "refresh" && this.file) this.load(cx);
        if (command === "open") this.focusPath();
      }
    });
  }

  reindex(cx) {
    const version = ++this.indexVersion, base = this.base, on = this.on;
    this.indexing = true; this.searchError = null;
    cx.spawn(async cx => {
      try {
        const result = await indexMarkdown(base, on);
        if (version !== this.indexVersion) return;
        this.files = result.files; this.limited = result.limited;
      } catch (e) { if (version === this.indexVersion) this.searchError = String(e.message || e); }
      finally {
        if (version === this.indexVersion) {
          this.indexing = false;
          if (this.showSuggestions) this.queryChanged(cx);
          cx.notify();
        }
      }
    });
  }

  queryChanged(cx) {
    this.selected = 0;
    this.matches = []; this.folderError = null; this.searching = false;
    const version = ++this.searchVersion, query = clean(this.input.value());
    this.showSuggestions = Boolean(query);
    if (!query) { cx.notify(); return; }
    // A short debounce only for directory reads; indexed filename matching is immediate.
    if (!query.includes("/")) {
      this.matches = rankFiles(this.files, query);
      cx.notify(); return;
    }
    this.searching = true;
    cx.timer.after(140, cx => {
      if (version !== this.searchVersion) return;
      cx.spawn(async cx => {
        try {
          const slash = query.lastIndexOf("/"), prefix = query.slice(0, slash + 1), term = query.slice(slash + 1);
          const dir = resolvePath(prefix, this.base, this.on ? null : home());
          const entries = await listFolder(dir, this.on);
          if (version !== this.searchVersion) return;
          this.matches = rankFiles(entries, term).map(entry => ({ ...entry, path: prefix + entry.path }));
        } catch (e) { if (version === this.searchVersion) this.folderError = String(e.message || e); }
        finally { if (version === this.searchVersion) { this.searching = false; cx.notify(); } }
      });
    });
    cx.notify();
  }

  choose(entry, cx, completeOnly = false) {
    const value = entry.path + (entry.dir ? "/" : "");
    this.input.set_value(value);
    if (entry.dir || completeOnly) {
      this.queryChanged(cx); this.input.focus();
      this.input.set_selected_range({ start: value.length, end: value.length });
    } else this.open(value, cx);
  }

  submit(cx) {
    const match = this.showSuggestions && this.matches[this.selected];
    if (match) this.choose(match, cx);
    else if (clean(this.input.value()).endsWith("/")) this.queryChanged(cx);
    else this.open(this.input.value(), cx);
  }

  key(event, cx) {
    if (event.keystroke === "ctrl-l") { this.focusPath(); cx.stop_propagation(); return; }
    if (!this.showSuggestions || !this.inputFocused) return;
    if ((event.key === "down" || event.key === "up") && this.matches.length) {
      this.selected = (this.selected + (event.key === "down" ? 1 : -1) + this.matches.length) % this.matches.length;
      cx.notify(); cx.stop_propagation();
    } else if (event.key === "tab" && this.matches[this.selected]) {
      this.choose(this.matches[this.selected], cx, true); cx.stop_propagation();
    } else if (event.key === "escape") {
      this.showSuggestions = false; this.searchVersion++; cx.notify(); cx.stop_propagation();
    }
  }

  focusPath() {
    this.input.focus();
    this.input.set_selected_range({ start: 0, end: this.input.value().length });
  }

  open(value, cx) {
    let file = clean(value);
    if (!file) { this.input.focus(); return; }
    file = resolvePath(file, this.base, this.on ? null : home());
    this.file = file;
    this.input.set_value(file);
    this.showSuggestions = false; this.searchVersion++;
    this.load(cx);
  }

  load(cx, quiet = false) {
    const file = this.file, request = ++this.request;
    this.loading = true;
    if (!quiet) { this.error = null; cx.notify(); }
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(file, { on: this.on });
        if (request !== this.request) return;
        if (text === null) throw new Error("File not found. Check the path and try again.");
        if (text.includes("\0")) throw new Error("This looks like a binary file. Open a Markdown or text file instead.");
        const changed = this.content !== text || this.error || this.loadedFile !== file;
        this.content = text;
        this.loadedFile = file;
        this.error = null;
        if (changed || !quiet) cx.notify();
      } catch (error) {
        if (request !== this.request) return;
        const message = String(error.message || error);
        if (this.error !== message || !quiet) { this.error = message; cx.notify(); }
      } finally {
        if (request === this.request) { this.loading = false; if (!quiet) cx.notify(); }
      }
    });
  }

  button(id, label, action, primary = false) {
    const t = theme();
    return h_flex().id(id).h(30).px(10).gap(5).items_center().rounded(7)
      .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
      .text_size(12).font_medium().cursor_pointer().hover(s => s.opacity(0.8)).on_click(action).child(label);
  }

  render() {
    const t = theme(), p = props() || {};
    const name = this.file ? this.file.split(/[\\/]/).pop() : "Markdown Reader";
    const words = this.content.trim().split(/\s+/).filter(Boolean).length;
    return v_flex().id("markdown-reader").size_full().min_h(0).bg(t.surface).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((event, cx) => this.key(event, cx))
      .on_drop((event, cx) => { if (event.paths?.length) { this.on = null; this.open(event.paths[0], cx); } })
      .child(h_flex().px(18).py(13).gap(10).items_center().bg(t.chrome)
        .child(svg("mods/markdown-reader/book.svg").size(22).text_color(t.accent))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().text_size(14).font_semibold().truncate().child(name))
          .child(div().text_size(10).text_color(t.muted).child("MARKDOWN  /  READER")))
        .child(this.button("reader-smaller", "A−", (_e, cx) => { this.fontSize = Math.max(12, this.fontSize - 1); cx.notify(); }))
        .child(this.button("reader-larger", "A+", (_e, cx) => { this.fontSize = Math.min(23, this.fontSize + 1); cx.notify(); }))
        .when(Boolean(p.overlay), el => el.child(this.button("reader-tab", "Open in tab", () => {
          run("tab.new", { name: this.file ? name : "Markdown", mod: "markdown-reader", props: { file: this.file, cwd: this.base, on: this.on } });
          closeOverlay(p.overlay);
        })))
        .when(Boolean(p.overlay), el => el.child(this.button("reader-close", "Close", () => closeOverlay(p.overlay)))))
      .child(h_flex().px(18).py(10).gap(8).items_center()
        .child(Input.new(this.input).flex_1().min_w(0).h(34).px(10).rounded(7).border_1()
          .border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_color(t.foreground).text_size(12))
        .child(this.button("reader-open", "Open", (_e, cx) => this.submit(cx), true))
        .child(this.button("reader-refresh", "Refresh", (_e, cx) => { if (this.file) this.load(cx); this.reindex(cx); })))
      .child(h_flex().px(18).pb(8).gap(8).items_center().text_size(10).text_color(t.muted)
        .child(div().flex_1().min_w(0).truncate().child("Folder: " + this.base))
        .child(this.button("reader-current-folder", "Use terminal folder", (_e, cx) => {
          const context = currentFolder(); this.base = context.cwd; this.on = context.on;
          this.input.set_value(""); this.files = []; this.queryChanged(cx); this.reindex(cx); this.input.focus();
        })))
      .when(this.showSuggestions, el => el.child(v_flex().mx(18).mb(10).p(6).gap(2).rounded(8).bg(t.raised)
        .h(Math.min(250, 38 + Math.max(1, this.matches.length) * 32)).flex_shrink_0().overflow_y_scrollbar().id("reader-suggestions")
        .child(div().px(7).py(4).text_size(10).text_color(t.muted).child(
          this.folderError || this.searchError || (this.searching || this.indexing ? "Finding Markdown files…" :
            `${this.files.length}${this.limited ? "+" : ""} Markdown files · ↑ ↓ select · Tab complete · Enter open · Esc dismiss`)))
        .children(this.matches.map((entry, index) => h_flex().id("reader-match-" + index).px(8).py(6).gap(8).rounded(5)
          .bg(index === this.selected ? t.selected : t.raised).hover(s => s.bg(t.hover)).cursor_pointer()
          .on_click((_e, cx) => this.choose(entry, cx))
          .child(div().text_size(10).text_color(t.accent).child(entry.dir ? "DIR" : "MD"))
          .child(div().flex_1().min_w(0).text_size(12).truncate().text_color(t.foreground).child(entry.path + (entry.dir ? "/" : "")))))
        .when(!this.matches.length && !this.indexing && !this.searching, el => el.child(div().p(8).text_size(12).text_color(t.muted)
          .child("No matching Markdown files. Try a folder path, or paste a full file path.")))))
      .when(Boolean(this.error), el => el.child(v_flex().mx(18).mb(10).p(12).gap(4).rounded(8).bg(t.raised)
        .child(div().text_size(12).text_color(t.blocked).child("Could not open this file"))
        .child(div().text_size(12).text_color(t.muted).child(this.error))))
      .child(div().id("reader-scroll").flex_1().min_h(0).w_full().overflow_y_scrollbar().px(28).py(18)
        .child(v_flex().w_full().max_w(820).mx_auto().gap(12)
          .when(!this.error, el => el.child(TextView.markdown("reader-document-" + (this.loadedFile || "welcome"), this.content || "*This file is empty.*")
            .w_full().text_size(this.fontSize).text_color(t.foreground).selectable(true).scrollable(false)))))
      .child(h_flex().px(18).py(9).gap(12).items_center().bg(t.chrome).text_size(10).text_color(t.muted)
        .child(div().flex_1().truncate().child(this.error ? "Check the path above · UTF-8 text, up to 1 MiB" : this.loading ? "Loading…" : this.file ? "Live · refreshes every 5 seconds" : "Drop a file to begin · Ctrl+Shift+M to reopen"))
        .child(div().child(`${words.toLocaleString()} words · ${Math.max(1, Math.ceil(words / 220))} min read`)));
  }
}
