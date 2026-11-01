import { exec, window } from "herdr";
import { isMarkdown } from "./search.js";

const quote = text => "'" + text.replaceAll("'", "''") + "'";
const SKIP = [".git", "node_modules", "AppData", ".codex", ".cache", ".venv", "venv", "target", "dist", "build", "$RECYCLE.BIN"];

export async function indexMarkdown(root, on) {
  try {
    const r = await exec("rg", ["--files", "--hidden", "--iglob", "*.{md,markdown,mdown,mkd,mdx}", ...SKIP.flatMap(name => ["-g", "!**/" + name + "/**"])], { cwd: root, on });
    if (r.code === 0 || r.code === 1) {
      const files = r.stdout.split(/\r?\n/).filter(Boolean);
      return { files: files.slice(0, 3000).map(path => ({ path, dir: false })), limited: files.length > 3000 };
    }
  } catch { /* Use the platform's built-in tools when rg isn't installed. */ }
  if (!on && window()?.platform === "windows") {
    // Bound traversal, skip symlinks and dependency folders, and never interpolate a shell expression.
    const script = `& { param($root)
      $queue = [Collections.Generic.Queue[object]]::new(); $queue.Enqueue(@($root,0));
      $found = [Collections.Generic.List[string]]::new(); $visited=0; $dirs=0; $limited=$false;
      $skip=@(${SKIP.map(quote).join(",")});
      while($queue.Count -gt 0 -and $visited -lt 20000 -and $dirs -lt 600 -and $found.Count -lt 3000) {
        $item=$queue.Dequeue(); $dirs++;
        try { foreach($entry in [IO.DirectoryInfo]::new($item[0]).EnumerateFileSystemInfos()) {
          $visited++; if($visited -ge 20000) { $limited=$true; break }
          if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
          if($entry.Attributes -band [IO.FileAttributes]::Directory) {
            if($skip -contains $entry.Name) { continue }
            if($item[1] -lt 6) { $queue.Enqueue(@($entry.FullName,($item[1]+1))) } else { $limited=$true }
          } elseif($entry.Extension -match '^\\.(md|markdown|mdown|mkd|mdx)$') {
            $found.Add($entry.FullName.Substring($root.TrimEnd([char[]]'\\/').Length+1).Replace('\\','/'));
            if($found.Count -ge 3000) { $limited=$true; break }
          }
        } } catch { if($dirs -eq 1) { throw } }
      }
      if($queue.Count -gt 0) { $limited=$true }
      @{ files=@($found.ToArray()); limited=$limited } | ConvertTo-Json -Compress
    } ` + quote(root);
    const r = await exec("powershell", ["-NoProfile", "-Command", script]);
    if (r.code !== 0) throw new Error(r.stderr || "Cannot search this folder");
    const result = JSON.parse(r.stdout);
    return { files: (result.files || []).map(path => ({ path, dir: false })), limited: result.limited };
  }
  throw new Error("Filename search needs ripgrep (rg) on this machine. You can still open a file by its full path.");
}

export async function listFolder(dir, on) {
  if (!on && window()?.platform === "windows") {
    const script = `& { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop |
      Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } |
      Select-Object -First 1000 | ForEach-Object { @{ path=$_.Name; dir=$_.PSIsContainer } }) | ConvertTo-Json -Compress } ` + quote(dir);
    const r = await exec("powershell", ["-NoProfile", "-Command", script]);
    if (r.code !== 0) throw new Error("Cannot list this folder. Check the path.");
    const entries = JSON.parse(r.stdout || "[]");
    return (Array.isArray(entries) ? entries : [entries]).filter(e => e.dir || isMarkdown(e.path));
  }
  const r = await exec("find", [dir, "-mindepth", "1", "-maxdepth", "1", "-printf", "%y\\0%f\\0"], { on });
  if (r.code !== 0) throw new Error("Cannot list this folder. Check the path.");
  const fields = r.stdout.split("\0"), entries = [];
  for (let i=0; i+1<fields.length && entries.length<1000; i+=2) {
    const dir = fields[i] === "d", path = fields[i+1];
    if (dir || (fields[i] === "f" && isMarkdown(path))) entries.push({ path, dir });
  }
  return entries;
}
