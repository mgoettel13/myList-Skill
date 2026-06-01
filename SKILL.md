# Lister — Natural Language Task Management

**Skill name:** `lister`
**Description:** Natural language task management with Lister.ai — add, view, update, move, and organize to-do items across lists via conversational commands.

## When to Use This Skill

Use this skill whenever the user wants to manage tasks, to-do items, or lists using natural language. Trigger phrases include (but are not limited to):

- **"create a new list"** — create a new list
- **"delete my list"** — delete a list
- **"add to list"** — create a new task item
- **"get my lists"** — view all lists or items in a list
- **"priority items"** — see urgent/important items
- **"mark done"** — complete an item
- **"remove item"** — delete an item
- **"update item"** — change an item's text or priority
- **"move item"** — transfer an item to another list
- **"note for item"** — attach a note to an item
- **"export list"** — export a list as JSON or HTML
- **"email list"** — email a list to someone
- **"export priority"** — export all priority items
- **"email priority"** — email priority items to someone

## Configuration

The following environment variables must be set before invoking the skill:

| Variable | Required | Description |
|----------|----------|-------------|
| `LISTER_BASE_URL` | No | Lister API base URL. Defaults to `https://lister-api-staging.up.railway.app` |
| `LISTER_API_KEY` | **Yes** | Bearer token for authenticating with the Lister API |

## How to Invoke

The skill exposes a `handleCommand(input: string): Promise<string>` function. Pass any natural language string and receive a formatted response.

**CLI:**
```bash
node dist/index.js <natural language command>
```

**As a module:**
```typescript
import { handleCommand } from './dist/index.js';
const result = await handleCommand('add "buy milk" to my groceries list');
console.log(result);
```

## Supported Commands

### 1. Add Item
Add a new task to a specific list. Use quotes for the task text. Mark items as priority with the word "priority" or "urgent".

| Pattern | Example |
|---------|---------|
| `add "text" to my [list] list` | `add "call Notary" to my today list` |
| `create "text" in [list] list` | `create "review contract" in work list` |
| `put "text" on my [list] list` | `put "walk the dog" on my errands list` |
| `add "text" to my [list] list` (priority) | `add "fix server outage" to my today list urgent` |

**Keywords:** `add`, `create`, `new`, `put`

### 2. Get / List Items
View all items in a specific list, or show all lists if no list name is given.

| Pattern | Example |
|---------|---------|
| `get my [list] list` | `get my today list` |
| `show [list] list` | `show work list` |
| `list [list] list` | `list groceries list` |
| `get my lists` (no list name) | `get my lists` → shows all lists |
| `view [list] list` | `view personal list` |
| `find [list] list` | `find work list` |

**Keywords:** `get`, `show`, `list`, `view`, `find`, `search`

### 3. Priority Items
Get all items marked as priority/urgent across all lists.

| Pattern | Example |
|---------|---------|
| `get priority items` | `get priority items` |
| `show urgent items` | `show urgent items` |
| `get important items` | `get important items` |

**Keywords:** `priority`, `urgent`, `important` (combined with `get`/`show`/`list`)

### 4. Mark Done
Mark a task item as completed.

| Pattern | Example |
|---------|---------|
| `mark item [id] done` | `mark item 123 done` |
| `complete item [id]` | `complete item 456` |
| `finish item [id]` | `finish item 789` |
| `done item [id]` | `done item 101` |

**Keywords:** `mark`, `complete`, `done`, `finish`

### 5. Remove Item
Delete a task item permanently.

| Pattern | Example |
|---------|---------|
| `remove item [id]` | `remove item 123` |
| `delete item [id]` | `delete item 456` |
| `drop item [id]` | `drop item 789` |
| `clear item [id]` | `clear item 101` |

**Keywords:** `remove`, `delete`, `drop`, `clear`

### 6. Update Item
Change an item's text or set it as priority.

| Pattern | Example |
|---------|---------|
| `update item [id] to "new text"` | `update item 123 to "call Notary at 3pm"` |
| `edit item [id] to "new text"` | `edit item 456 to "buy organic milk"` |
| `change item [id] to "new text"` | `change item 789 to "schedule dentist"` |
| `update item [id]` (priority) | `update item 123 priority` |

**Keywords:** `update`, `edit`, `change`, `modify`, `rename`

### 7. Move Item
Transfer an item from its current list to another list.

| Pattern | Example |
|---------|---------|
| `move item [id] to my [list] list` | `move item 123 to my work list` |
| `transfer item [id] to [list] list` | `transfer item 456 to personal list` |

**Keywords:** `move`, `transfer`

### 8. Add Note
Attach a note/comment to an item.

| Pattern | Example |
|---------|---------|
| `note for item [id]: "text"` | `note for item 123: "remember to bring documents"` |
| `comment for item [id]: "text"` | `comment for item 456: "follow up next week"` |
| `memo for item [id]: "text"` | `memo for item 789: "waiting on response"` |

**Keywords:** `note`, `comment`, `memo`

### 9. Export List
Export a list to JSON or HTML format.

| Pattern | Example |
|---------|---------|
| `export my [list] list` | `export my today list` (defaults to JSON) |
| `export my [list] list as json` | `export my work list as json` |
| `export my [list] list as html` | `export my today list as html` |
| `export my [list] list as html theme dark` | `export my projects list as html theme dark` |
| `export my [list] list with archived` | `export my today list with archived` |

**Keywords:** `export`, `as json`, `as html`, `theme`, `with archived`

### 10. Email List
Email a list to yourself or someone else.

| Pattern | Example |
|---------|---------|
| `email my [list] list to email@example.com` | `email my today list to maik@example.com` |
| `email my [list] list` | `email my work list` (sends to your email) |
| `email my [list] list theme dark` | `email my projects list theme dark` |

**Keywords:** `email`, `to`

### 11. Export Priority Items
Export all priority/urgent items across all lists.

| Pattern | Example |
|---------|---------|
| `export priority items` | `export priority items` (defaults to JSON) |
| `export priority items as html` | `export priority items as html` |
| `export priority items as html theme dark` | `export priority items as html theme dark` |

**Keywords:** `export`, `priority`, `urgent`, `important`

### 12. Email Priority Items
Email all priority items to yourself or someone else.

| Pattern | Example |
|---------|---------|
| `email priority items to email@example.com` | `email priority items to maik@example.com` |
| `email priority items` | `email priority items` (sends to your email) |
| `email priority items theme dark` | `email priority items theme dark` |

**Keywords:** `email`, `priority`, `urgent`, `important`

### 13. Create List
Create a new list.

| Pattern | Example |
|---------|---------|
| `create a new list called [name]` | `create a new list called Projects` |
| `make a new list named [name]` | `make a new list named Work` |

**Keywords:** `create`, `make`, `add`

### 14. Delete List
Delete an existing list (all items are permanently removed).

| Pattern | Example |
|---------|---------|
| `delete my [list] list` | `delete my old projects list` |
| `delete list [name]` | `delete list Archive` |

**Keywords:** `delete`

**Note:** List name matching is case-insensitive.

### 15. Search
Search across all lists and items.

| Pattern | Example |
|---------|---------|
| `search for [query]` | `search for meeting` |
| `find [query]` | `find contract` |
| `search for [query] with notes` | `search for call with notes` |

**Keywords:** `search`, `find` (combined with search terms, not list name)

**Note:** Use `with notes` or `include notes` to include note content in search results.

### 16. Lists Summary
Get a summary of all lists with item counts.

| Pattern | Example |
|---------|---------|
| `list summary` | `list summary` |
| `lists summary` | `lists summary` |
| `get list summary` | `get list summary` |

**Keywords:** `summary`

### 17. Archive List
Archive a list (hides it from normal views).

| Pattern | Example |
|---------|---------|
| `archive my [list] list` | `archive my old project list` |

**Keywords:** `archive`

### 18. Unarchive List
Restore an archived list.

| Pattern | Example |
|---------|---------|
| `unarchive my [list] list` | `unarchive my project list` |

**Keywords:** `unarchive`

**Note:** archived lists are automatically searched when resolving list names.

### 19. Share List
Share a list with another user.

| Pattern | Example |
|---------|---------|
| `share my [list] list with [email]` | `share my work list with user@example.com` |
| `share my [list] list with [email] as [perm]` | `share my work list with user@example.com as edit` |

**Keywords:** `share`, `with`, `as`

**Permissions:** `read`, `edit` (default), `admin`

### 20. List Users
Show users who have access to a list.

| Pattern | Example |
|---------|---------|
| `list users for [list] list` | `list users for my work list` |
| `show users of [list] list` | `show users of work list` |

**Keywords:** `users`, `for`, `of`

### 21. Remove User From List
Remove a user's access from a shared list.

| Pattern | Example |
|---------|---------|
| `remove user [email] from my [list] list` | `remove user@example.com from my work list` |

**Keywords:** `remove user`, `from`

### 22. Update Note
Edit the text of an existing note on an item.

| Pattern | Example |
|---------|---------|
| `update note for item [id] note [id]: "text"` | `update note for item abc123 note def456: "updated text"` |
| `edit note for item [id] note [id]: "text"` | `edit note for item abc123 note def456: "new text"` |

**Keywords:** `update note`, `edit note`, `change note`

### 23. Delete Note
Delete a note from an item.

| Pattern | Example |
|---------|---------|
| `delete note for item [id] note [id]` | `delete note for item abc123 note def456` |
| `remove note for item [id] note [id]` | `remove note for item abc123 note def456` |

**Keywords:** `delete note`, `remove note`

---

## API Reference

The skill communicates with the Lister REST API. The following endpoints are used internally:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/lists` | Fetch all lists (supports `?includeArchived=true`) |
| `POST` | `/api/lists` | Create a new list |
| `DELETE` | `/api/lists/{id}` | Delete a list |
| `PUT` | `/api/lists/{id}/archive` | Archive/unarchive a list |
| `GET` | `/api/lists/summary` | Get lists summary with counts |
| `GET` | `/api/lists/{id}/items` | Get items in a list |
| `POST` | `/api/lists/{id}/items` | Add an item to a list |
| `PUT` | `/api/items/{id}` | Update an item (text, status, priority, archived) |
| `DELETE` | `/api/items/{id}` | Delete an item |
| `POST` | `/api/items/{id}/move` | Move item to another list |
| `POST` | `/api/items/{id}/notes` | Add a note to an item |
| `PUT` | `/api/items/{id}/notes/{nid}` | Update a note |
| `DELETE` | `/api/items/{id}/notes/{nid}` | Delete a note |
| `GET` | `/api/items/priority` | Get all priority items |
| `GET` | `/api/search` | Search across all lists & items |
| `POST` | `/api/lists/{id}/share` | Share a list with a user |
| `GET` | `/api/lists/{id}/users` | Get list users/permissions |
| `DELETE` | `/api/lists/{id}/users/{uid}` | Remove user from list |
| `POST` | `/api/lists/{id}/export` | Export a list (JSON/HTML) |
| `POST` | `/api/lists/{id}/export/email` | Email a list |
| `POST` | `/api/items/priority/export` | Export priority items (JSON/HTML) |
| `POST` | `/api/items/priority/export/email` | Email priority items |

**Authentication:** Bearer token via `X-API-Key` header (NOT Authorization header).

## Response Format

Responses are formatted with emoji indicators:

- ✅ Success — followed by details or item lists
- ❌ Error — with explanation of what went wrong
- ❓ Unknown — with helpful suggestions

Item lists include:
- Numbered entries
- 🔥 for priority items
- ✅ for completed items

## Error Handling

The skill validates input before making API calls. Common validation messages:

- Missing quoted text for add/update → prompts user to use quotes
- Missing list name → prompts user to specify a list
- Missing item ID → prompts user to provide an item ID
- List not found → tells user the list name wasn't found
- API errors → surfaces the error message from the API

## File Layout

```
lister-skill/
├── SKILL.md          ← This file (skill definition for OpenClaw)
├── skill.json        ← Skill metadata
├── src/
│   └── index.ts      ← TypeScript source
├── dist/
│   └── index.js      ← Compiled JavaScript (entry point)
├── package.json
└── tsconfig.json
```

## Notes for Agents

1. **Always quote item text** — the parser extracts text between quotes (`" "` or `' '`). If the user doesn't use quotes, ask them to.
2. **List names are case-insensitive** — `today`, `Today`, and `TODAY` all match the same list.
3. **Item IDs are MongoDB ObjectIds** — 24-character hex strings, extracted from patterns like `item 6a1d5a16...`, `id 6a1d5a16...`, or `#6a1d5a16...`. Numeric IDs also work for compatibility.
4. **The skill auto-resolves list names to IDs** — users don't need to know internal list IDs; they use friendly names.
5. **If the list doesn't exist**, the skill will report an error — it does **not** auto-create lists. The user must create the list first or use an existing one.
6. **Archived lists** are automatically included in list name resolution — if a list name isn't found in active lists, the skill searches archived lists too.
7. **Search** uses the `/api/search` endpoint and returns matching items across all lists.
8. **Sharing** requires a user ID (email) and permission level (`read`, `edit`, or `admin`).
