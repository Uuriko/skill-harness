// Dependency-free YAML-subset parser, just enough for SKILL.md frontmatter.
// Supports: `key: value` (plain / single- / double-quoted scalars), nested maps
// via indentation (e.g. `metadata:`), literal `|` and folded `>` block scalars,
// `#` comments. Anything fancier returns { ok: false, error }.

export function splitFrontmatter(text) {
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { ok: false, error: "missing frontmatter delimiters (--- ... ---)" };
  return { ok: true, raw: m[1], body: text.slice(m[0].length) };
}

function unquote(s) {
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n");
  }
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

export function parseYamlSubset(raw) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    i++;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    const kv = trimmed.match(/^([A-Za-z0-9_.-]+):(?:[ \t]+(.*))?$/);
    if (!kv) return { ok: false, error: `unparseable line: ${trimmed.slice(0, 60)}` };
    const key = kv[1];
    let rest = (kv[2] ?? "").trim();
    // Strip trailing comments on plain scalars.
    if (rest && !rest.startsWith('"') && !rest.startsWith("'")) {
      const ci = rest.search(/[ \t]#/);
      if (ci >= 0) rest = rest.slice(0, ci).trim();
    }
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (rest === "" || rest === "|" || rest === ">") {
      // Nested map or block scalar.
      if (rest === "|" || rest === ">") {
        const buf = [];
        const bIndent = indent + 2;
        while (i < lines.length) {
          const bl = lines[i];
          if (!bl.trim()) { buf.push(""); i++; continue; }
          const bi = bl.match(/^ */)[0].length;
          if (bi < bIndent) break;
          buf.push(bl.slice(bIndent));
          i++;
        }
        parent[key] = rest === "|" ? buf.join("\n") : buf.join(" ").replace(/\n{2,}/g, "\n\n");
      } else {
        const child = {};
        parent[key] = child;
        stack.push({ indent, obj: child });
      }
    } else {
      parent[key] = unquote(rest);
    }
  }
  return { ok: true, value: root };
}

export function parseFrontmatter(text) {
  const split = splitFrontmatter(text);
  if (!split.ok) return split;
  const parsed = parseYamlSubset(split.raw);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.value, body: split.body };
}
