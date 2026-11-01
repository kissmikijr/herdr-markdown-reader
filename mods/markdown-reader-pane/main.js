import { View, div } from "gpui-kit";
import { focused, panes, spaces, props, run, closeOverlay, notify } from "herdr";

// A shortcut launcher: dismiss itself, then split the pane it was opened from.
export default class MarkdownBeside extends View {
  init(_props, cx) {
    const overlay = props()?.overlay;
    const pane = focused()?.pane;
    const f = focused(), space = spaces().find(s => s.active);
    const cwd = f?.cwd || panes().find(p => p.tab === f?.tab && p.terminal && p.cwd)?.cwd || space?.folder;
    const on = space?.machine || null;
    if (!overlay) return;
    cx.timer.after(1, () => {
      closeOverlay(overlay);
      if (pane) run("pane.split", { pane, direction: "right", mod: "markdown-reader", props: { cwd, on } });
      else notify({ title: "Select a pane first", body: "Click a terminal or reader pane, then press Ctrl+Shift+R.", level: "info" });
    });
  }

  render() { return div().size(1); }
}
