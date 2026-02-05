---
name: efficient-backlog
description: Reduces token usage when working with Todo.md or similar backlog files by searching for uncompleted items instead of reading the entire file. Use when the user asks to implement features from Todo, 待办, 未实现的需求, or when the agent would otherwise read a long checklist to find remaining work.
---

# Efficient Backlog / Todo Handling

## Rule: Search First, Read Minimal

When the goal is to **find uncompleted work** (e.g. "实现未实现的功能", "implement from Todo", "继续做待办"), do **not** read the entire backlog file.

### 1. Find Unchecked Items Only

Use **grep** to list lines that represent unfinished work:

- **Markdown checklists**: Unchecked = `- [ ]` (space in brackets)
- **Pattern**: `\[ \]` or `- \[ \]`

**Example (Grep tool):**

```
pattern: - \[ \]
path: Todo.md
output_mode: content
```

Or with ripgrep-style pattern:

```
pattern: \-\s+\[ \]
path: Todo.md
output_mode: content
-B: 1
```

Use `-B: 1` (or `-B: 2`) to get the preceding line(s) so you see the section/version (e.g. "### V0.2.4") without reading the whole file.

### 2. Read Only When Necessary

- **Do not** call `read_file` on the full Todo.md (or similar) just to discover what's left.
- **Do** use `read_file` with **offset** and **limit** only when you need the exact wording of one or two unchecked items after grep has already identified their line numbers.
- If grep output plus 1–2 context lines per item is enough, do not read the file at all.

### 3. When Full Read Is Acceptable

- User explicitly asks to "read Todo.md", "list all tasks", or "show full backlog".
- User asks to "update" or "synchronize" the whole document structure.
- File is short (e.g. under ~30 lines).

## Workflow Summary

| Goal                         | Action                                                                 |
|-----------------------------|------------------------------------------------------------------------|
| Find what to implement next | Grep for `- [ ]` in Todo.md (with optional `-B: 1`), then implement   |
| Get exact text of one item  | Grep first → note line number → read_file(path, offset, limit: ~5)   |
| List only uncompleted       | Grep for `- [ ]`; do not read full file                              |
| User asks "read Todo"       | Full read is acceptable                                               |

## File Names

Apply the same search-first approach to any file that acts as a backlog or checklist, for example:

- `Todo.md`, `TODO.md`, `todo.md`
- `ROADMAP.md`, `BACKLOG.md`
- `CHANGELOG.md` when looking for "what's not yet released"

Adjust the unchecked pattern if the file uses a different format (e.g. `[ ]` without `- `).

## Anti-Pattern

- **Avoid**: `read_file("Todo.md")` at the start of a "implement remaining features" or "继续实现未实现的功能" request.
- **Prefer**: `grep(pattern: "- [ ]", path: "Todo.md", output_mode: content, -B: 1)` then targeted read or no read.
