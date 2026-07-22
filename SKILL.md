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
- **"comment on item"** — add, view, update, or delete comments on shared items
- **"comment on note"** — add, view, update, or delete comments on item notes
- **"reminder"** — add or update simple item reminders
- **"export list"** — export a list as JSON or HTML
- **"email list"** — email a list to someone
- **"export priority"** — export all priority items
- **"email priority"** — email priority items to someone

## Configuration

The following environment variables must be set before invoking the skill:

| Variable | Required | Description |
|----------|----------|-------------|
| `LISTER_BASE_URL` | No | Lister API base URL. Defaults to `https://api.mylister.dev` |
| `LISTER_API_KEY` | **Yes** | API key for authenticating with the Lister API via `X-API-Key` |

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
| `add "text" to my [list] list reminder tomorrow at 9am` | `add "call Mama" to my today list reminder tomorrow at 9am` |

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
Attach a note to an item.

| Pattern | Example |
|---------|---------|
| `note for item [id]: "text"` | `note for item 123: "remember to bring documents"` |
| `memo for item [id]: "text"` | `memo for item 789: "waiting on response"` |

**Keywords:** `note`, `memo`

### 8a. Item Comments
Add, view, update, or delete comments on an item. This is useful for shared items.

| Pattern | Example |
|---------|---------|
| `comment on item [id]: "text"` | `comment on item 123: "looks good"` |
| `show comments for item [id]` | `show comments for item 123` |
| `update comment [comment_id] on item [id] to "text"` | `update comment 456 on item 123 to "updated"` |
| `delete comment [comment_id] from item [id]` | `delete comment 456 from item 123` |

### 8b. Note Comments
Add, view, update, or delete comments on a note attached to an item.

| Pattern | Example |
|---------|---------|
| `comment on note [note_id] for item [id]: "text"` | `comment on note 456 for item 123: "agree"` |
| `show comments for note [note_id] on item [id]` | `show comments for note 456 on item 123` |
| `update comment [comment_id] on note [note_id] for item [id] to "text"` | `update comment 789 on note 456 for item 123 to "updated"` |
| `delete comment [comment_id] from note [note_id] on item [id]` | `delete comment 789 from note 456 on item 123` |

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
| `create a new list called [name] notebook` | `create a new list called Journal notebook` |

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

**Note:** The production API includes notes by default; `with notes` remains supported for clarity.

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

### 24. Update List User Permission
Change a user's permission level on a shared list.

| Pattern | Example |
|---------|--------|
| `set user [email] permission on my [list] list to [perm]` | `set user alice@example.com permission on my work list to admin` |
| `change user [email] access on [list] list to [perm]` | `change user bob@example.com access on projects list to read` |

**Permissions:** `read`, `edit`, `admin`

**Keywords:** `update user`, `change user`, `set permission`

### 25. Reorder Lists
Change the display order of lists.

| Pattern | Example |
|---------|--------|
| `reorder lists [id1] [id2] [id3]` | `reorder lists abc123 def456 ghi789` |

**Keywords:** `reorder lists`

### 26. Reorder Items
Change the display order of items within a list.

| Pattern | Example |
|---------|--------|
| `reorder items in my [list] list [id1] [id2]` | `reorder items in my today list abc123 def456` |

**Keywords:** `reorder items`

### 27. Move Completed Items
Move all completed items from one list to another.

| Pattern | Example |
|---------|--------|
| `move completed from my [list] list to my [target] list` | `move completed from my today list to my done list` |

**Keywords:** `move completed`

### 28. Update List
Rename or update a list's properties.

| Pattern | Example |
|---------|--------|
| `rename my [list] list "new name"` | `rename my projects list "Current Projects"` |
| `update my [list] list` | `update my work list` |

**Keywords:** `update list`, `rename list`, `edit list`

### 29. Get List Details
View detailed information about a specific list.

| Pattern | Example |
|---------|--------|
| `show my [list] list details` | `show my today list details` |
| `get [list] list info` | `get work list info` |

**Keywords:** `list details`, `list info`

---

## API Reference

The skill uses the **Public API (\`/v1/\`)** endpoints, which are accessible via API key. The **Private API (\`/api/\`)** is reserved for the app frontend and should not be used by integrations.

| Method | Endpoint | Purpose |
|--------|----------|----------|
| \`GET\` | \`/v1/lists\` | Fetch all lists (supports \`?includeArchived=true\`) |
| \`POST\` | \`/v1/lists\` | Create a new list |
| \`GET\` | \`/v1/lists/{id}\` | Get list details |
| \`PUT\` | \`/v1/lists/{id}\` | Update a list (name, description, etc.) |
| \`DELETE\` | \`/v1/lists/{id}\` | Delete a list |
| \`PUT\` | \`/v1/lists/{id}/archive\` | Archive/unarchive a list |
| \`PUT\` | \`/v1/lists/reorder\` | Reorder lists |
| \`GET\` | \`/v1/lists/summary\` | Get lists summary with counts |
| \`POST\` | \`/v1/lists/defaults\` | Create default starter lists |
| \`GET\` | \`/v1/lists/{id}/items\` | Get items in a list |
| \`POST\` | \`/v1/lists/{id}/items\` | Add an item to a list |
| \`PUT\` | \`/v1/lists/{id}/items/reorder\` | Reorder items in a list |
| \`POST\` | \`/v1/lists/{id}/items/move-completed\` | Move completed items to the bottom of the same list |
| \`POST\` | \`/v1/lists/{id}/share\` | Share a list with a user |
| \`GET\` | \`/v1/lists/{id}/users\` | Get list users/permissions |
| \`PUT\` | \`/v1/lists/{id}/users/{uid}\` | Update user permission on a list |
| \`DELETE\` | \`/v1/lists/{id}/users/{uid}\` | Remove user from list |
| \`POST\` | \`/v1/lists/{id}/export\` | Export a list (JSON/HTML) |
| \`POST\` | \`/v1/lists/{id}/export/email\` | Email a list |
| \`GET\` | \`/v1/items/{id}\` | Get item details |
| \`PATCH\` | \`/v1/items/{id}\` | Update an item (text, status, priority, archived, reminder) |
| \`DELETE\` | \`/v1/items/{id}\` | Delete an item |
| \`POST\` | \`/v1/items/{id}/comments\` | Add an item comment |
| \`GET\` | \`/v1/items/{id}/comments\` | Get item comments |
| \`PUT\` | \`/v1/items/{id}/comments/{cid}\` | Update an item comment |
| \`DELETE\` | \`/v1/items/{id}/comments/{cid}\` | Delete an item comment |
| \`POST\` | \`/v1/items/{id}/move\` | Move item to another list |
| \`POST\` | \`/v1/items/{id}/notes\` | Add a note to an item |
| \`PUT\` | \`/v1/items/{id}/notes/{nid}\` | Update a note |
| \`DELETE\` | \`/v1/items/{id}/notes/{nid}\` | Delete a note |
| \`PATCH\` | \`/v1/items/{id}/notes/{nid}/status\` | Update note status |
| \`POST\` | \`/v1/items/{id}/notes/{nid}/comments\` | Add a note comment |
| \`GET\` | \`/v1/items/{id}/notes/{nid}/comments\` | Get note comments |
| \`PUT\` | \`/v1/items/{id}/notes/{nid}/comments/{cid}\` | Update a note comment |
| \`DELETE\` | \`/v1/items/{id}/notes/{nid}/comments/{cid}\` | Delete a note comment |
| \`GET\` | \`/v1/items/priority\` | Get all priority items |
| \`POST\` | \`/v1/items/priority/export\` | Export priority items (JSON/HTML) |
| \`POST\` | \`/v1/items/priority/export/email\` | Email priority items |
| \`GET\` | \`/v1/search\` | Search across all lists & items |

Auth endpoints remain at \`/api/auth/\` (not \`/v1/\`):

| Method | Endpoint | Purpose |
|--------|----------|----------|
| \`POST\` | \`/api/auth/register\` | Register a new user |
| \`POST\` | \`/api/auth/login\` | Login |
| \`POST\` | \`/api/auth/api-keys\` | Create API key |
| \`GET\` | \`/api/auth/api-keys\` | List API keys |
| \`DELETE\` | \`/api/auth/api-keys/{id}\` | Delete API key |
| \`GET\` | \`/api/auth/me\` | Get current user |
| \`DELETE\` | \`/api/auth/me\` | Delete current user |

**Authentication:** API key via \`X-API-Key\` header (recommended) or Bearer token via \`Authorization\` header for all \`/v1/\` endpoints.

**⚠️ Important:** Always use \`/v1/\` (Public API) endpoints. The \`/api/\` (Private API) endpoints are for the app frontend and may not be accessible via API key in the future.\n\n## Response Format

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
3. **IDs are now consistent** — The API returns `id` (not `_id`) across all resources: lists, items, notes, and users. IDs are 24-character hex strings, extracted from patterns like `item 6a1d5a16...`, `id 6a1d5a16...`, or `#6a1d5a16...`.
4. **The skill auto-resolves list names to IDs** — users don't need to know internal list IDs; they use friendly names.
5. **If the list doesn't exist**, the skill will report an error — it does **not** auto-create lists. The user must create the list first or use an existing one.
6. **Archived lists** are automatically included in list name resolution — if a list name isn't found in active lists, the skill searches archived lists too.
7. **Search** uses the `/v1/search` endpoint. The production API includes note content by default.
8. **Sharing** requires a user ID (email) and permission level (`read`, `edit`, or `admin`).
9. **Item statuses** can be `new`, `in-progress`, or `complete` (the `in-progress` status is new).
10. **Item creation** no longer requires `listId` in the request body — it's derived from the URL path.
11. **API key creation** now returns `201 Created` (was `200 OK`).
12. **Note creation** now returns `201 Created` (was `200 OK`).
13. **User self-deletion** is now supported (`DELETE /api/auth/me` returns `200`).
14. **Comments are first-class resources** on both items and notes. Use the comment endpoints instead of treating item comments as notes.
15. **Move completed** reorders completed items to the bottom of the same list; it no longer moves them to another list.
16. **Notebook lists** are created by passing `type: "notebook"` when the user asks for a notebook or journal list.
