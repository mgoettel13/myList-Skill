# Lister Skill

OpenClaw skill for natural language control of [Lister.ai](https://lister.ai) task management.

## Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Set environment variables
export LISTER_BASE_URL="https://api.mylister.dev"
export LISTER_API_KEY="your-api-key-here"
```

## Usage

### CLI
```bash
node dist/index.js add "call Notary" to my today list
node dist/index.js get priority items
node dist/index.js mark item 123 done
node dist/index.js remove item 456
node dist/index.js update item 789 to "new title"
```

### As Module
```typescript
import { handleCommand } from './dist/index.js';

const response = await handleCommand('add "buy groceries" to my today list');
console.log(response);
```

## Supported Commands

| Command | Example |
|---------|---------|
| Add item | `add "task" to my [list] list` |
| Get items | `get my [list] list` |
| Priority items | `get priority items` |
| Mark done | `mark item [id] done` |
| Remove item | `remove item [id]` |
| Update item | `update item [id] to "new text"` |
| Move item | `move item [id] to my [list] list` |
| Add note | `note for item [id]: "text"` |
| Item comments | `comment on item [id]: "text"` |
| Note comments | `comment on note [note_id] for item [id]: "text"` |
| Reminders | `add "task" to my today list reminder tomorrow at 9am` |
| Notebook lists | `create a new list called Journal notebook` |
| Move completed | `move completed to bottom of my today list` |

## API

- **Base URL:** `https://api.mylister.dev`
- **Auth:** API key via `X-API-Key`
- **Endpoints:** `/v1/lists`, `/v1/items`, `/v1/items/priority`, `/v1/items/{id}/comments`, `/v1/items/{id}/notes/{note_id}/comments`

## License

MIT
