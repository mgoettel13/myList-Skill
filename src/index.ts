/**
 * Lister Skill — OpenClaw integration for Lister.ai task management
 * 
 * Supports natural language commands:
 * - "Add 'call Notary' to my today list"
 * - "Create a new list called 'Projects'"
 * - "Delete my old list"
 * - "Get all priority items"
 * - "Mark item 123 as done"
 * - "Remove item 456"
 * - "Update item 789 to 'new title'"
 * - "Move item 123 to my work list"
 * - "Add note to item 123: remember to call back"
 */

import fetch from 'node-fetch';

// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl: process.env.LISTER_BASE_URL || 'https://lister-api-staging.up.railway.app',
  apiKey: process.env.LISTER_API_KEY || '',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Intent = 'add_item' | 'get_items' | 'get_priority' | 'mark_done' | 
              'remove_item' | 'update_item' | 'move_item' | 'add_note' | 
              'export_list' | 'export_priority' | 'email_list' | 'email_priority' | 
              'create_list' | 'delete_list' | 'unknown';

interface ParsedIntent {
  intent: Intent;
  entities: {
    itemText?: string;
    listName?: string;
    targetListName?: string;
    itemId?: string;
    priority?: boolean;
    note?: string;
    format?: 'json' | 'html';
    theme?: 'light' | 'dark';
    email?: string;
    includeArchived?: boolean;
  };
}

interface ListerResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ─── Intent Parser ───────────────────────────────────────────────────────────
function parseIntent(input: string): ParsedIntent {
  const lower = input.toLowerCase();
  
  // Extract quoted text
  const quotedMatch = input.match(/["']([^"']+)["']/);
  const itemText = quotedMatch ? quotedMatch[1] : undefined;
  
  // Extract list name: "to my X list", "in my X list", "get my X list", "show X list"
  const listMatch = lower.match(/(?:to|in|on|get|show|view)?\s*(?:my\s+)?(\w+['']?\w*)\s+list/);
  const listName = listMatch ? listMatch[1] : undefined;
  
  // Extract new list name for "create a new list called X" / "create list X"
  const createListMatch = lower.match(/(?:create|make|add)\s*(?:a\s+new\s+)?list\s*(?:called|named|\s)([^\n,]+)/i);
  const newListName = createListMatch ? createListMatch[1].trim() : undefined;
  
  // Extract list name for delete: "delete my X list" or "delete list X"
  const deleteListMatch = lower.match(/^delete\s+(?:my\s+)?(.+?)\s*list$/i);
  const deleteListName = deleteListMatch ? deleteListMatch[1].trim() : undefined;
  
  // Extract item ID: "item 123" or "id 123" or "#123" or MongoDB ObjectId (24 hex chars)
  const idMatch = lower.match(/(?:item\s*|id\s*|#)([a-f0-9]{24}|\d+)/i);
  const itemId = idMatch ? idMatch[1] : undefined;
  
  // Extract email: "to email@address.com"
  const emailMatch = input.match(/to\s+([\w.+-]+@[\w.-]+\.[a-z]{2,})/i);
  const email = emailMatch ? emailMatch[1] : undefined;
  
  // Extract format: "as json", "as html"
  const formatMatch = lower.match(/as\s+(json|html)/i);
  const format = formatMatch ? formatMatch[1] as 'json' | 'html' : undefined;
  
  // Extract theme: "theme light", "theme dark"
  const themeMatch = lower.match(/theme\s+(light|dark)/i);
  const theme = themeMatch ? themeMatch[1] as 'light' | 'dark' : undefined;
  
  // Include archived flag
  const includeArchived = /include\s+archived|with\s+archived/i.test(lower);
  // Priority flag
  const priority = /priority|urgent|important/i.test(lower);
  
  // ── Intent Classification ──
  
  // Export priority items (check before generic export)
  if (/^export\b/.test(lower) && priority) {
    return { intent: 'export_priority', entities: { format, theme, includeArchived } };
  }
  
  // Email priority items (check before generic email list)
  if (/^email\b/.test(lower) && priority) {
    return { intent: 'email_priority', entities: { email, theme, includeArchived } };
  }
  
  // Export list
  if (/^export\b/.test(lower)) {
    return { intent: 'export_list', entities: { listName, format, theme, includeArchived } };
  }
  
  // Email list
  if (/^email\b/.test(lower) && /list/.test(lower)) {
    return { intent: 'email_list', entities: { listName, email, theme, includeArchived } };
  }
  
  // Create list (before add_item — "create a new list called X")
  if (/^create\s*(a\s+new)?\s*list/i.test(lower)) {
    return { intent: 'create_list', entities: { listName: newListName } };
  }
  
  // Delete list (before remove_item — "delete my X list" or "delete list X")
  if (/^delete\s+(?:my\s+)?list\b/i.test(lower)) {
    return { intent: 'delete_list', entities: { listName: deleteListName } };
  }
  
  // Add item
  if (/^(add|create|new|put)\b/.test(lower)) {
    return { intent: 'add_item', entities: { itemText, listName, priority } };
  }
  
  // Get items / list
  if (/^(get|show|list|view|find|search)\b/.test(lower)) {
    if (priority) {
      return { intent: 'get_priority', entities: { listName } };
    }
    return { intent: 'get_items', entities: { listName } };
  }
  
  // Mark done
  if (/^(mark|complete|done|finish)\b/.test(lower)) {
    return { intent: 'mark_done', entities: { itemId } };
  }
  
  // Remove item
  if (/^(remove|delete|drop|clear)\b/.test(lower)) {
    return { intent: 'remove_item', entities: { itemId } };
  }
  
  // Update item
  if (/^(update|edit|change|modify|rename)\b/.test(lower)) {
    return { intent: 'update_item', entities: { itemId, itemText } };
  }
  
  // Move item
  if (/^(move|transfer)\b/.test(lower)) {
    return { intent: 'move_item', entities: { itemId, listName } };
  }
  
  // Add note
  if (/^(note|comment|memo)\b/.test(lower)) {
    const note = quotedMatch ? quotedMatch[1] : undefined;
    return { intent: 'add_note', entities: { itemId, note } };
  }
  
  return { intent: 'unknown', entities: {} };
}

// ─── API Client ──────────────────────────────────────────────────────────────
class ListerClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = CONFIG.baseUrl;
    this.apiKey = CONFIG.apiKey;
  }

  private getAuthHeader(): Record<string, string> {
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async parseResponse(res: any): Promise<{ ok: boolean; data: any }> {
    const raw = await res.json() as any;
    // API wraps data in { success, data } or returns array
    const items = Array.isArray(raw) ? raw : (raw.data ?? raw);
    return { ok: res.ok, data: items };
  }

  async getLists(): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists`, {
        headers: this.getAuthHeader(),
      });
      const { ok, data } = await this.parseResponse(res);
      const lists = Array.isArray(data) ? data : [];
      return { success: ok, message: `Found ${lists.length} lists`, data: lists };
    } catch (err) {
      return { success: false, message: `Error fetching lists: ${err}` };
    }
  }

  async deleteList(listId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists/${listId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader(),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'List deleted' : `Failed: ${data?.detail ?? res.statusText}`, data };
    } catch (err) {
      return { success: false, message: `Error deleting list: ${err}` };
    }
  }

  async createList(name: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ name }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `List '${name}' created` : `Failed: ${data?.detail ?? res.statusText}`, data };
    } catch (err) {
      return { success: false, message: `Error creating list: ${err}` };
    }
  }

  async getItems(listId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists/${listId}/items`, {
        headers: this.getAuthHeader(),
      });
      const { ok, data } = await this.parseResponse(res);
      const items = Array.isArray(data) ? data : [];
      return { success: ok, message: `Found ${items.length} items`, data: items };
    } catch (err) {
      return { success: false, message: `Error fetching items: ${err}` };
    }
  }

  async addItem(listId: string, content: string, isPriority: boolean): Promise<ListerResponse> {
    try {
      const body = {
        content,
        type: 'text',
        status: 'new',
        listId,
        isPriority,
      };
      const res = await fetch(`${this.baseUrl}/api/lists/${listId}/items`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `'${content}' added to list` : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error adding item: ${err}` };
    }
  }

  async updateItem(itemId: string, updates: Record<string, any>): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/${itemId}`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify(updates),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Item updated' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error updating item: ${err}` };
    }
  }

  async deleteItem(itemId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/${itemId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader(),
      });
      return { success: res.ok, message: res.ok ? 'Item deleted' : 'Failed to delete item' };
    } catch (err) {
      return { success: false, message: `Error deleting item: ${err}` };
    }
  }

  async moveItem(itemId: string, targetListId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/${itemId}/move`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ targetListId }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Item moved' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error moving item: ${err}` };
    }
  }

  async addNote(itemId: string, content: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/${itemId}/notes`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ content }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Note added' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error adding note: ${err}` };
    }
  }

  async getPriorityItems(): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/priority`, {
        headers: this.getAuthHeader(),
      });
      const { ok, data } = await this.parseResponse(res);
      const items = Array.isArray(data) ? data : [];
      return { success: ok, message: `Found ${items.length} priority items`, data: items };
    } catch (err) {
      return { success: false, message: `Error fetching priority items: ${err}` };
    }
  }

  async exportList(listId: string, options: { format?: 'json' | 'html'; theme?: 'light' | 'dark'; includeArchived?: boolean; filename?: string }): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists/${listId}/export`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          format: options.format || 'json',
          theme: options.theme,
          includeArchived: options.includeArchived,
          filename: options.filename,
        }),
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          const html = await res.text();
          return { success: true, message: `List exported as HTML (${html.length} bytes)`, data: { format: 'html', size: html.length } };
        }
        const data = await res.json();
        return { success: true, message: `List exported as JSON`, data };
      }
      const data = await res.json() as any;
      return { success: false, message: `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error exporting list: ${err}` };
    }
  }

  async exportPriorityItems(options: { format?: 'json' | 'html'; theme?: 'light' | 'dark'; includeArchived?: boolean; filename?: string }): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/priority/export`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          format: options.format || 'json',
          theme: options.theme,
          includeArchived: options.includeArchived,
          filename: options.filename,
        }),
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          const html = await res.text();
          return { success: true, message: `Priority items exported as HTML (${html.length} bytes)`, data: { format: 'html', size: html.length } };
        }
        const data = await res.json();
        return { success: true, message: `Priority items exported as JSON`, data };
      }
      const data = await res.json() as any;
      return { success: false, message: `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error exporting priority items: ${err}` };
    }
  }

  async emailList(listId: string, options: { toEmail?: string; theme?: 'light' | 'dark'; includeArchived?: boolean }): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists/${listId}/export/email`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          toEmail: options.toEmail,
          theme: options.theme,
          includeArchived: options.includeArchived,
        }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'List emailed successfully' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error emailing list: ${err}` };
    }
  }

  async emailPriorityItems(options: { toEmail?: string; theme?: 'light' | 'dark'; includeArchived?: boolean }): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/priority/export/email`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          toEmail: options.toEmail,
          theme: options.theme,
          includeArchived: options.includeArchived,
        }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Priority items emailed successfully' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error emailing priority items: ${err}` };
    }
  }
}

// ─── List Name Matching ─────────────────────────────────────────────────────
function findListByName(lists: any[], searchName: string): any | undefined {
  const lower = searchName.toLowerCase().replace(/["']/g, '');
  // Exact match (case-insensitive)
  let match = lists.find(l => l.name?.toLowerCase() === lower);
  if (match) return match;
  // Starts-with match
  match = lists.find(l => l.name?.toLowerCase().startsWith(lower));
  if (match) return match;
  // Contains match
  match = lists.find(l => l.name?.toLowerCase().includes(lower));
  if (match) return match;
  // Remove possessive/punctuation and try again
  const clean = lower.replace(/['']s$/, '').replace(/[^a-z0-9]/g, '');
  match = lists.find(l => l.name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(clean));
  if (match) return match;
  return undefined;
}

// ─── Response Formatter ──────────────────────────────────────────────────────
function formatResponse(response: ListerResponse): string {
  if (!response.success) {
    return `❌ ${response.message}`;
  }
  
  let msg = `✅ ${response.message}\n`;
  
  if (response.data && Array.isArray(response.data)) {
    if (response.data.length === 0) {
      msg += '\n_(empty)_';
    } else {
      msg += response.data.map((item: any, i: number) => {
        const title = item.content || item.text || item.name || item.title || `Item ${i + 1}`;
        const priority = item.isPriority ? ' 🔥' : '';
        const done = item.status === 'complete' ? ' ✅' : '';
        return `${i + 1}. ${title}${priority}${done}`;
      }).join('\n');
    }
  } else if (response.data && typeof response.data === 'object') {
    msg += `\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``;
  }
  
  return msg;
}

// ─── Helper: Resolve list with error ─────────────────────────────────────────
async function resolveList(listName: string): Promise<{ list: any } | { error: string }> {
  const lists = await client.getLists();
  if (!lists.success || !Array.isArray(lists.data)) {
    return { error: `❌ Could not fetch lists: ${lists.message}` };
  }
  const list = findListByName(lists.data, listName);
  if (!list) {
    const names = lists.data.map((l: any) => l.name).join(', ');
    return { error: `❌ List '${listName}' not found. Available: ${names}` };
  }
  return { list };
}

// ─── Main Handler ────────────────────────────────────────────────────────────
const client = new ListerClient();

export async function handleCommand(input: string): Promise<string> {
  const parsed = parseIntent(input);
  
  switch (parsed.intent) {
    case 'add_item': {
      if (!parsed.entities.itemText) {
        return '❌ Please provide what to add (use quotes: "task name")';
      }
      if (!parsed.entities.listName) {
        return '❌ Please specify which list (e.g., "to my today list")';
      }
      const result = await resolveList(parsed.entities.listName);
      if ('error' in result) return result.error;
      const addResult = await client.addItem(
        result.list._id,
        parsed.entities.itemText,
        parsed.entities.priority ?? false,
      );
      return formatResponse(addResult);
    }
    
    case 'get_items': {
      if (!parsed.entities.listName) {
        const result = await client.getLists();
        return formatResponse(result);
      }
      const result = await resolveList(parsed.entities.listName);
      if ('error' in result) return result.error;
      const itemsResult = await client.getItems(result.list._id);
      return formatResponse(itemsResult);
    }
    
    case 'get_priority': {
      const result = await client.getPriorityItems();
      return formatResponse(result);
    }
    
    case 'mark_done': {
      if (!parsed.entities.itemId) {
        return '❌ Please specify which item to mark done (e.g., "mark item 123 done")';
      }
      const result = await client.updateItem(parsed.entities.itemId, { status: 'complete' });
      return formatResponse(result);
    }
    
    case 'remove_item': {
      if (!parsed.entities.itemId) {
        return '❌ Please specify which item to remove (e.g., "remove item 123")';
      }
      const result = await client.deleteItem(parsed.entities.itemId);
      return formatResponse(result);
    }
    
    case 'update_item': {
      if (!parsed.entities.itemId) {
        return '❌ Please specify which item to update (e.g., "update item 123")';
      }
      const updates: Record<string, any> = {};
      if (parsed.entities.itemText) updates.content = parsed.entities.itemText;
      if (parsed.entities.priority) updates.isPriority = true;
      const result = await client.updateItem(parsed.entities.itemId, updates);
      return formatResponse(result);
    }
    
    case 'move_item': {
      if (!parsed.entities.itemId || !parsed.entities.listName) {
        return '❌ Please specify item and target list (e.g., "move item 123 to my work list")';
      }
      const result = await resolveList(parsed.entities.listName);
      if ('error' in result) return result.error;
      const moveResult = await client.moveItem(parsed.entities.itemId, result.list._id);
      return formatResponse(moveResult);
    }
    
    case 'add_note': {
      if (!parsed.entities.itemId || !parsed.entities.note) {
        return '❌ Please specify item and note (e.g., "note for item 123: \\"remember to call back\\"")';
      }
      const result = await client.addNote(parsed.entities.itemId, parsed.entities.note);
      return formatResponse(result);
    }
    
    case 'export_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to export (e.g., "export my today list as html")';
      }
      const result = await resolveList(parsed.entities.listName);
      if ('error' in result) return result.error;
      const exportResult = await client.exportList(result.list._id, {
        format: parsed.entities.format,
        theme: parsed.entities.theme,
        includeArchived: parsed.entities.includeArchived,
      });
      return formatResponse(exportResult);
    }
    
    case 'export_priority': {
      const result = await client.exportPriorityItems({
        format: parsed.entities.format,
        theme: parsed.entities.theme,
        includeArchived: parsed.entities.includeArchived,
      });
      return formatResponse(result);
    }
    
    case 'email_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to email (e.g., "email my today list to user@example.com")';
      }
      const result = await resolveList(parsed.entities.listName);
      if ('error' in result) return result.error;
      const emailResult = await client.emailList(result.list._id, {
        toEmail: parsed.entities.email,
        theme: parsed.entities.theme,
        includeArchived: parsed.entities.includeArchived,
      });
      return formatResponse(emailResult);
    }
    
    case 'email_priority': {
      const result = await client.emailPriorityItems({
        toEmail: parsed.entities.email,
        theme: parsed.entities.theme,
        includeArchived: parsed.entities.includeArchived,
      });
      return formatResponse(result);
    }
    
    case 'create_list': {
      if (!parsed.entities.listName) {
        return '❌ Please provide a name for the new list (e.g., "create a new list called Projects")';
      }
      const result = await client.createList(parsed.entities.listName);
      return formatResponse(result);
    }
    
    case 'delete_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to delete (e.g., "delete my old list")';
      }
      const lists = await client.getLists();
      if (!lists.success || !Array.isArray(lists.data)) {
        return `❌ Could not fetch lists: ${lists.message}`;
      }
      const targetList = findListByName(lists.data, parsed.entities.listName);
      if (!targetList) {
        const names = lists.data.map((l: any) => l.name).join(', ');
        return `❌ List '${parsed.entities.listName}' not found. Available: ${names}`;
      }
      const result = await client.deleteList(targetList._id);
      return formatResponse(result);
    }
    
    default:
      return `❓ I didn't understand that. Try commands like:\n` +
        `• Add "call Notary" to my today list\n` +
        `• Get priority items\n` +
        `• Mark item 123 as done\n` +
        `• Remove item 456\n` +
        `• Export my today list as html\n` +
        `• Email my today list to user@example.com\n` +
        `• Export priority items as json\n` +
        `• Email priority items to user@example.com`;
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv.slice(2).join(' ');
  if (!input) {
    console.log('Usage: node dist/index.js <command>');
    console.log('Examples:');
    console.log('  node dist/index.js add "call Notary" to my today list');
    console.log('  node dist/index.js get priority items');
    console.log('  node dist/index.js mark item 123 done');
    process.exit(1);
  }
  
  handleCommand(input).then(console.log).catch(console.error);
}

export default handleCommand;