/**
 * Lister Skill - OpenClaw integration for Lister.ai task management
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

import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';

// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl: process.env.LISTER_BASE_URL || 'https://lister-api-staging.up.railway.app',
  apiKey: process.env.LISTER_API_KEY || '',
  defaultListName: 'Quick Takes',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Intent = 'add_item' | 'get_items' | 'get_priority' | 'mark_done' |
              'remove_item' | 'update_item' | 'move_item' | 'add_note' |
              'update_note' | 'delete_note' | 'archive_list' | 'unarchive_list' |
              'export_list' | 'export_priority' | 'email_list' | 'email_priority' |
              'create_list' | 'delete_list' | 'search' | 'list_summary' |
              'share_list' | 'list_users' | 'remove_list_user' | 'update_list_user' |
              'reorder_lists' | 'reorder_items' | 'move_completed' |
              'update_list' | 'get_list' | 'unknown';

interface ParsedIntent {
  intent: Intent;
  entities: {
    itemText?: string;
    listName?: string;
    targetListName?: string;
    itemId?: string;
    noteId?: string;
    priority?: boolean;
    note?: string;
    noteStatus?: 'new' | 'complete';
    archived?: boolean;
    format?: 'json' | 'html';
    theme?: 'light' | 'dark';
    email?: string;
    includeArchived?: boolean;
    userId?: string;
    permission?: 'read' | 'edit' | 'admin';
    searchQuery?: string;
    searchLimit?: number;
    includeNotes?: boolean;
    listIds?: string[];
    itemIds?: string[];
  };
}

interface ListerResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface ParsedApiResponse {
  ok: boolean;
  status: number;
  data: any;
  error?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeListName(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || undefined;
}

function extractListName(input: string, verbs: string[] = []): string | undefined {
  const verbPattern = verbs.length ? `(?:${verbs.map(escapeRegExp).join('|')})\\s+` : '';
  const pattern = new RegExp(`^\\s*${verbPattern}(?:my\\s+)?(.+?)\\s+list(?:\\b|$)`, 'i');
  return normalizeListName(input.match(pattern)?.[1]);
}

function extractQuotedText(input: string): string | undefined {
  const doubleQuoted = input.match(/"([^"]+)"/);
  if (doubleQuoted) return doubleQuoted[1];
  const singleQuoted = input.match(/'([^']+)'/);
  return singleQuoted ? singleQuoted[1] : undefined;
}

// ─── Intent Parser ───────────────────────────────────────────────────────────
function parseIntent(input: string): ParsedIntent {
  const lower = input.toLowerCase();

  // Extract quoted text
  const itemText = extractQuotedText(input);

  // Extract list name: "to my X list", "in my X list", "get my X list", "show X list"
  const listName =
    normalizeListName(input.match(/\b(?:to|in|on)\s+(?:my\s+)?(.+?)\s+list\b/i)?.[1]) ??
    normalizeListName(input.match(/\badd\s+to\s+(?:my\s+)?(.+?)(?::|$)/i)?.[1]) ??
    extractListName(input, ['add', 'create', 'put', 'get', 'show', 'view', 'list', 'find', 'search', 'export', 'email', 'archive', 'unarchive', 'update', 'edit', 'rename', 'change']);

  // Extract new list name for "create a new list called X" / "create list X"
  const createListMatch = lower.match(/(?:create|make|add)\s*(?:a\s+new\s+)?list\s*(?:called|named|\s)([^\n,]+)/i);
  const newListName = createListMatch ? createListMatch[1].trim() : undefined;

  // Extract list name for delete: "delete my X list" or "delete list X"
  // Handles: "delete my work list" → work
  const deleteListMatch = input.match(/^delete\s+(?:my\s+)?(.+?)\s+list$/i);
  const deleteListName = deleteListMatch ? deleteListMatch[1].trim() : undefined;
  // Also handle "delete list X": extract X after "delete list "
  const deleteListAltMatch = input.match(/^delete\s+list\s+(.+)$/i);
  const deleteListAltName = deleteListAltMatch ? deleteListAltMatch[1].trim() : undefined;
  const finalDeleteListName = deleteListName || deleteListAltName;

  // Extract item ID: "item 123" or "id 123" or "#123" or MongoDB ObjectId (24 hex chars)
  const idMatch = lower.match(/(?:item\s*|id\s*|#)([a-f0-9]{24}|\d+)/i);
  const itemId = idMatch ? idMatch[1] : undefined;

  // Extract note ID: "note 123" or "note_id 123" or similar (MongoDB ObjectId or numeric)
  const noteIdMatch = lower.match(/note\s*(?:id\s*)?([a-f0-9]{24}|\d+)/i);
  // Only extract noteId if it's explicitly requested (not just an item ID)
  const noteId = /(?:update|edit|change|delete|remove)\s+note/i.test(lower) || /note\s+(?:id\s*)?[a-f0-9]{24}/i.test(lower) ? (noteIdMatch ? noteIdMatch[1] : undefined) : undefined;

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
  if (/^(what|which|show|list|get)\b.*\b(priority|urgent|important)\b.*\b(items?|tasks?)\b/i.test(lower)) {
    return { intent: 'get_priority', entities: { listName } };
  }

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

  // Create list (before add_item - "create a new list called X")
  if (/^create\s*(a\s+new)?\s*list/i.test(lower)) {
    return { intent: 'create_list', entities: { listName: newListName } };
  }

  // Delete list: "delete my X list" (captures X) or "delete list X" (captures X)
  // For "delete list X": don't use deleteListMatch (it expects 'list' at end)
  const isDeleteListPattern = /^delete\s+(?:my\s+)?.*\s+list$/i.test(lower) || /^delete\s+list\s+/i.test(lower);
  if (isDeleteListPattern && finalDeleteListName) {
    return { intent: 'delete_list', entities: { listName: finalDeleteListName } };
  }

  // Search (check before get_items - "search for X" vs "search my X list")
  if (/^(search|find)\b/.test(lower) && !/\blist\b/.test(lower)) {
    const searchQuery = itemText ?? input.replace(/^\s*(?:search|find)\s+(?:for\s+)?/i, '').trim();
    return { intent: 'search', entities: { searchQuery, includeNotes: /with\s+notes/i.test(lower), includeArchived: /include\s+archived|with\s+archived/i.test(lower) } };
  }

  // List summary (must come before get_items)
  if (/^(lists?\s+)?summary/i.test(lower) || /get\s+lists?\s+summary/i.test(lower)) {
    return { intent: 'list_summary', entities: { includeArchived: /include\s+archived|with\s+archived/i.test(lower) } };
  }

  // "get my lists" / "show lists" should list all lists, not look for a list named "my".
  if (/^(get|show|list|view)\s+(?:my\s+)?lists\b/i.test(lower)) {
    return { intent: 'get_items', entities: {} };
  }

  // Archive list (must come before get_items/delete_item)
  if (/^archive\b/.test(lower) && /\blist\b/.test(lower)) {
    return { intent: 'archive_list', entities: { listName } };
  }

  // Unarchive list
  if (/^unarchive\b/.test(lower) && /\blist\b/.test(lower)) {
    return { intent: 'unarchive_list', entities: { listName } };
  }

  // Share list with user
  const shareMatch = input.match(/share\s+(?:my\s+)?(.+?)\s+list\s+with\s+(\S+)/i);
  if (shareMatch) {
    return { intent: 'share_list', entities: { listName: normalizeListName(shareMatch[1]), userId: shareMatch[2], permission: /as\s+(read|edit|admin)/i.test(lower) ? lower.match(/as\s+(read|edit|admin)/i)![1] as any : 'edit' } };
  }
  // "list users of my X list" / "show users for my X list"
  const listUsersMatch = input.match(/(?:list|show|get)\s+users\s+(?:for|of)\s+(?:my\s+)?(.+?)\s+list/i);
  if (listUsersMatch) {
    return { intent: 'list_users', entities: { listName: normalizeListName(listUsersMatch[1]) } };
  }
  // "remove user X from my Y list"
  const removeUserMatch = input.match(/remove\s+user\s+(\S+)\s+from\s+(?:my\s+)?(.+?)\s+list/i);
  if (removeUserMatch) {
    return { intent: 'remove_list_user', entities: { userId: removeUserMatch[1], listName: normalizeListName(removeUserMatch[2]) } };
  }

  // Update note
  if (/^(update|edit|change|modify)\s+note/i.test(lower)) {
    return { intent: 'update_note', entities: { itemId, noteId, note: itemText } };
  }

  // Delete note
  if (/^(delete|remove)\s+note/i.test(lower)) {
    return { intent: 'delete_note', entities: { itemId, noteId } };
  }

  // Reorder lists (must come before add_item)
  if (/^reorder\s+lists?/i.test(lower)) {
    // Parse comma-separated list IDs
    const idMatches = lower.match(/([a-f0-9]{24})/g);
    return { intent: 'reorder_lists', entities: { listIds: idMatches || undefined } as any };
  }

  // Reorder items in a list
  if (/^reorder\s+(?:items\s+)?(?:in\s+)?(?:my\s+)?.+?\s+list/i.test(lower)) {
    const reorderMatch = input.match(/^reorder\s+(?:items\s+)?(?:in\s+)?(?:my\s+)?(.+?)\s+list/i);
    const idMatches = lower.match(/([a-f0-9]{24})/g);
    return { intent: 'reorder_items', entities: { listName: normalizeListName(reorderMatch?.[1]), itemIds: idMatches || undefined } as any };
  }

  // Move completed items
  if (/^move\s+completed\s+(?:from\s+)?(?:my\s+)?.+?\s+list\s+to\s+(?:my\s+)?.+?\s+list/i.test(lower)) {
    const mcMatch = input.match(/^move\s+completed\s+(?:from\s+)?(?:my\s+)?(.+?)\s+list\s+to\s+(?:my\s+)?(.+?)\s+list/i);
    return { intent: 'move_completed', entities: { listName: normalizeListName(mcMatch?.[1]), targetListName: normalizeListName(mcMatch?.[2]) } };
  }

  // Update list (rename, change description, etc.)
  if (/^(update|edit|rename|change)\s+(?:my\s+)?.+?\s+list/i.test(lower)) {
    const ulMatch = input.match(/^(update|edit|rename|change)\s+(?:my\s+)?(.+?)\s+list/i);
    return { intent: 'update_list', entities: { listName: normalizeListName(ulMatch?.[2]), itemText } };
  }

  // Update list user permission
  const updateUserPermMatch = input.match(/(?:update|change|set)\s+(?:user\s+)?(\S+)\s+(?:permission|access)\s+(?:on|for)\s+(?:my\s+)?(.+?)\s+list\s+to\s+(read|edit|admin)/i);
  if (updateUserPermMatch) {
    return { intent: 'update_list_user', entities: { userId: updateUserPermMatch[1], listName: normalizeListName(updateUserPermMatch[2]), permission: updateUserPermMatch[3] as any } };
  }

  if (/^(make|set)\b/i.test(lower) && itemText && listName && priority) {
    return { intent: 'update_item', entities: { itemText, listName, priority: true } };
  }

  // Get list details only when explicitly requested. Plain "show X list" lists items.
  if (/^(get|show|view)\s+(?:my\s+)?.+?\s+list\s+(?:details|info)$/i.test(lower)) {
    return { intent: 'get_list', entities: { listName } };
  }

  // Add item
  if (/^(add|create|new|put)\b/.test(lower)) {
    return { intent: 'add_item', entities: { itemText, listName, priority } };
  }

  // Get items / list (generic fallback for show/view/find/list/get + list name)
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
    return { intent: 'add_note', entities: { itemId, note: itemText } };
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

  private async parseResponse(res: any): Promise<ParsedApiResponse> {
    const raw = await res.json().catch(() => null) as any;
    // API wraps data in { success, data } or returns array
    const data = Array.isArray(raw) ? raw : (raw?.data ?? raw);
    const detail = raw?.detail ?? raw?.message ?? raw?.error ?? res.statusText;
    const error = typeof detail === 'string' ? detail : JSON.stringify(detail);
    return { ok: res.ok, status: res.status, data, error };
  }

  async getLists(options?: { includeArchived?: boolean }): Promise<ListerResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.includeArchived) params.set('includeArchived', 'true');
      const url = `${this.baseUrl}/v1/lists${params.toString() ? '?' + params : ''}`;
      const res = await fetch(url, {
        headers: this.getAuthHeader(),
      });
      const { ok, data, error } = await this.parseResponse(res);
      const lists = Array.isArray(data) ? data : [];
      return { success: ok, message: ok ? `Found ${lists.length} lists` : `Failed: ${error}`, data: lists };
    } catch (err) {
      return { success: false, message: `Error fetching lists: ${err}` };
    }
  }

  async deleteList(listId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}`, {
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
      const res = await fetch(`${this.baseUrl}/v1/lists`, {
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
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/items`, {
        headers: this.getAuthHeader(),
      });
      const { ok, data, error } = await this.parseResponse(res);
      const items = Array.isArray(data) ? data : [];
      return { success: ok, message: ok ? `Found ${items.length} items` : `Failed: ${error}`, data: items };
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
        isPriority,
      };
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/items`, {
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
      const res = await fetch(`${this.baseUrl}/v1/items/${itemId}`, {
        method: 'PATCH',
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
      const res = await fetch(`${this.baseUrl}/v1/items/${itemId}`, {
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
      const res = await fetch(`${this.baseUrl}/v1/items/${itemId}/move`, {
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
      const res = await fetch(`${this.baseUrl}/v1/items/${itemId}/notes`, {
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
      const res = await fetch(`${this.baseUrl}/v1/items/priority`, {
        headers: this.getAuthHeader(),
      });
      const { ok, status, data, error } = await this.parseResponse(res);
      const items = Array.isArray(data) ? data : [];
      if (!ok && status === 404 && error === 'Item not found') {
        return this.getPriorityItemsFallback();
      }
      return { success: ok, message: ok ? `Found ${items.length} priority items` : `Failed: ${error}`, data: items };
    } catch (err) {
      return { success: false, message: `Error fetching priority items: ${err}` };
    }
  }

  private async getPriorityItemsFallback(): Promise<ListerResponse> {
    const listsResult = await this.getLists();
    if (!listsResult.success || !Array.isArray(listsResult.data)) {
      return { success: false, message: `Failed: ${listsResult.message}` };
    }

    const priorityItems: any[] = [];
    for (const list of listsResult.data) {
      const listId = list.id;
      if (!listId) continue;
      const itemsResult = await this.getItems(listId);
      if (!itemsResult.success || !Array.isArray(itemsResult.data)) continue;
      priorityItems.push(
        ...itemsResult.data
          .filter((item: any) => item.isPriority)
          .map((item: any) => ({ ...item, listName: list.name })),
      );
    }

    return {
      success: true,
      message: `Found ${priorityItems.length} priority items`,
      data: priorityItems,
    };
  }

  async exportList(listId: string, options: { format?: 'json' | 'html'; theme?: 'light' | 'dark'; includeArchived?: boolean; filename?: string }): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/export`, {
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
      const res = await fetch(`${this.baseUrl}/v1/items/priority/export`, {
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
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/export/email`, {
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
      const res = await fetch(`${this.baseUrl}/v1/items/priority/export/email`, {
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

  async search(query: string, options: { limit?: number; includeArchived?: boolean; includeNotes?: boolean }): Promise<ListerResponse> {
    try {
      const params = new URLSearchParams({ q: query });
      if (options.limit) params.set('limit', String(options.limit));
      if (options.includeArchived) params.set('include_archived', 'true');
      if (options.includeNotes) params.set('include_notes', 'true');
      const res = await fetch(`${this.baseUrl}/v1/search?${params}`, {
        headers: this.getAuthHeader(),
      });
      const json = await res.json() as any;
      const data = json.data ?? json.results ?? json;
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const totalResults = json.totalResults ?? items.length;
      return { success: res.ok, message: `Found ${totalResults} results`, data: items };
    } catch (err) {
      return { success: false, message: `Error searching: ${err}` };
    }
  }

  async getListsSummary(options: { includeArchived?: boolean }): Promise<ListerResponse> {
    try {
      const params = new URLSearchParams();
      if (options.includeArchived) params.set('includeArchived', 'true');
      const url = `${this.baseUrl}/v1/lists/summary${params.toString() ? '?' + params : ''}`;
      const res = await fetch(url, { headers: this.getAuthHeader() });
      const { ok, data, error } = await this.parseResponse(res);
      return { success: ok, message: ok ? 'Lists summary' : `Failed: ${error}`, data };
    } catch (err) {
      return { success: false, message: `Error fetching lists summary: ${err}` };
    }
  }

  async archiveList(listId: string, archived: boolean): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/archive`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ archived }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? (archived ? 'List archived' : 'List unarchived') : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error archiving list: ${err}` };
    }
  }

  async shareList(listId: string, userId: string, permission: 'read' | 'edit' | 'admin'): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/share`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ userId, permission }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `List shared with ${userId} (${permission})` : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error sharing list: ${err}` };
    }
  }

  async getListUsers(listId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/users`, {
        headers: this.getAuthHeader(),
      });
      const { ok, data, error } = await this.parseResponse(res);
      const users = Array.isArray(data) ? data : [];
      return { success: ok, message: ok ? `Found ${users.length} users` : `Failed: ${error}`, data: users };
    } catch (err) {
      return { success: false, message: `Error fetching list users: ${err}` };
    }
  }

  async removeListUser(listId: string, userId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/users/${userId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader(),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `User ${userId} removed from list` : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error removing user from list: ${err}` };
    }
  }

  async updateListUser(listId: string, userId: string, permission: 'read' | 'edit' | 'admin'): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/users/${userId}`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ permission }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `User ${userId} permission updated to ${permission}` : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error updating user permission: ${err}` };
    }
  }

  async reorderLists(listIds: string[]): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/reorder`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ order: listIds }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Lists reordered' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error reordering lists: ${err}` };
    }
  }

  async reorderItems(listId: string, itemIds: string[]): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/items/reorder`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ order: itemIds }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Items reordered' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error reordering items: ${err}` };
    }
  }

  async moveCompletedItems(listId: string, targetListId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}/items/move-completed`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ targetListId }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Completed items moved' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error moving completed items: ${err}` };
    }
  }

  async getListItem(listId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}`, {
        headers: this.getAuthHeader(),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'List details' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data: data?.data ?? data };
    } catch (err) {
      return { success: false, message: `Error fetching list: ${err}` };
    }
  }

  async updateList(listId: string, updates: Record<string, any>): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/lists/${listId}`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify(updates),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'List updated' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data: data?.data ?? data };
    } catch (err) {
      return { success: false, message: `Error updating list: ${err}` };
    }
  }

  async updateNote(itemId: string, noteId: string, content: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/items/${itemId}/notes/${noteId}`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ content }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Note updated' : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error updating note: ${err}` };
    }
  }

  async deleteNote(itemId: string, noteId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/items/${itemId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader(),
      });
      return { success: res.ok, message: res.ok ? 'Note deleted' : 'Failed to delete note' };
    } catch (err) {
      return { success: false, message: `Error deleting note: ${err}` };
    }
  }

  async updateNoteStatus(itemId: string, noteId: string, status: 'new' | 'complete'): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/items/${itemId}/notes/${noteId}/status`, {
        method: 'PATCH',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `Note marked as ${status}` : `Failed: ${JSON.stringify(data?.detail ?? res.statusText)}`, data };
    } catch (err) {
      return { success: false, message: `Error updating note status: ${err}` };
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
async function resolveList(listName: string, includeArchived: boolean = false): Promise<{ list: any } | { error: string }> {
  let lists = await client.getLists();
  if (!lists.success || !Array.isArray(lists.data)) {
    return { error: `❌ Could not fetch lists: ${lists.message}` };
  }
  let list = findListByName(lists.data, listName);
  // If not found and not already including archived, try again with archived
  if (!list && !includeArchived) {
    lists = await client.getLists({ includeArchived: true } as any);
    if (lists.success && Array.isArray(lists.data)) {
      list = findListByName(lists.data, listName);
    }
  }
  if (!list) {
    const names = (lists.data as any[]).map((l: any) => l.name).join(', ');
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
      let listName = parsed.entities.listName;
      if (!listName) {
        // Default to Quick Takes if no list specified
        listName = CONFIG.defaultListName;
      }
      const result = await resolveList(listName);
      if ('error' in result) return result.error;
      const addResult = await client.addItem(
        result.list.id,
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
      const itemsResult = await client.getItems(result.list.id);
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
      let itemId = parsed.entities.itemId;
      if (!itemId && parsed.entities.itemText && parsed.entities.listName && parsed.entities.priority) {
        const listResult = await resolveList(parsed.entities.listName);
        if ('error' in listResult) return listResult.error;
        const itemsResult = await client.getItems(listResult.list.id);
        if (!itemsResult.success || !Array.isArray(itemsResult.data)) {
          return `❌ Could not fetch items: ${itemsResult.message}`;
        }
        const searchText = parsed.entities.itemText.trim().toLowerCase();
        const item = itemsResult.data.find((candidate: any) => {
          const content = String(candidate.content ?? candidate.text ?? candidate.title ?? '').trim().toLowerCase();
          return content === searchText;
        });
        if (!item?.id) {
          return `❌ Item '${parsed.entities.itemText}' not found in '${parsed.entities.listName}' list`;
        }
        itemId = item.id;
      }

      if (!itemId) {
        return '❌ Please specify which item to update (e.g., "update item 123")';
      }
      const updates: Record<string, any> = {};
      if (parsed.entities.itemText && parsed.entities.itemId) updates.content = parsed.entities.itemText;
      if (parsed.entities.priority) updates.isPriority = true;
      const result = await client.updateItem(itemId, updates);
      return formatResponse(result);
    }

    case 'move_item': {
      if (!parsed.entities.itemId || !parsed.entities.listName) {
        return '❌ Please specify item and target list (e.g., "move item 123 to my work list")';
      }
      const result = await resolveList(parsed.entities.listName);
      if ('error' in result) return result.error;
      const moveResult = await client.moveItem(parsed.entities.itemId, result.list.id);
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
      const exportResult = await client.exportList(result.list.id, {
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
      const emailResult = await client.emailList(result.list.id, {
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
      const cResult = await client.createList(parsed.entities.listName);
      return formatResponse(cResult);
    }

    case 'delete_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to delete (e.g., "delete my old list")';
      }
      const allLists = await client.getLists();
      if (!allLists.success || !Array.isArray(allLists.data)) {
        return `❌ Could not fetch lists: ${allLists.message}`;
      }
      const targetList = findListByName(allLists.data, parsed.entities.listName);
      if (!targetList) {
        const names = allLists.data.map((l: any) => l.name).join(', ');
        return `❌ List '${parsed.entities.listName}' not found. Available: ${names}`;
      }
      const dResult = await client.deleteList(targetList.id);
      return formatResponse(dResult);
    }

    case 'search': {
      if (!parsed.entities.searchQuery) {
        return '❌ Please provide a search query (e.g., "search for meeting" or "find contract")';
      }
      const sResult = await client.search(parsed.entities.searchQuery, {
        limit: parsed.entities.searchLimit,
        includeArchived: parsed.entities.includeArchived,
        includeNotes: parsed.entities.includeNotes,
      });
      return formatResponse(sResult);
    }

    case 'list_summary': {
      const sumResult = await client.getListsSummary({ includeArchived: parsed.entities.includeArchived });
      if (!sumResult.success) return formatResponse(sumResult);
      if (Array.isArray(sumResult.data)) {
        let msg = `📋 **Lists Summary**\n`;
        msg += sumResult.data.map((s: any) => {
          const nm = s.name || 'Untitled';
          const tot = s.totalItems ?? s.itemCount ?? '?';
          const done = s.completedCount ?? s.completedItems ?? s.doneCount ?? 0;
          return `• **${nm}**: ${tot} items (${done} done)`;
        }).join('\n');
        return msg;
      }
      return formatResponse(sumResult);
    }

    case 'archive_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to archive (e.g., "archive my old project list")';
      }
      const arList = await resolveList(parsed.entities.listName);
      if ('error' in arList) return arList.error;
      const arResult = await client.archiveList(arList.list.id, true);
      return formatResponse(arResult);
    }

    case 'unarchive_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to unarchive (e.g., "unarchive my project list")';
      }
      const uList = await resolveList(parsed.entities.listName);
      if ('error' in uList) return uList.error;
      const uResult = await client.archiveList(uList.list.id, false);
      return formatResponse(uResult);
    }

    case 'share_list': {
      if (!parsed.entities.listName || !parsed.entities.userId) {
        return '❌ Please specify the list and user to share with (e.g., "share my work list with user@example.com as edit")';
      }
      const shList = await resolveList(parsed.entities.listName);
      if ('error' in shList) return shList.error;
      const shResult = await client.shareList(shList.list.id, parsed.entities.userId, parsed.entities.permission ?? 'edit');
      return formatResponse(shResult);
    }

    case 'list_users': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list (e.g., "list users for my work list")';
      }
      const luList = await resolveList(parsed.entities.listName);
      if ('error' in luList) return luList.error;
      const luResult = await client.getListUsers(luList.list.id);
      return formatResponse(luResult);
    }

    case 'remove_list_user': {
      if (!parsed.entities.listName || !parsed.entities.userId) {
        return '❌ Please specify the list and user to remove (e.g., "remove user@example.com from my work list")';
      }
      const rmList = await resolveList(parsed.entities.listName);
      if ('error' in rmList) return rmList.error;
      const rmResult = await client.removeListUser(rmList.list.id, parsed.entities.userId);
      return formatResponse(rmResult);
    }

    case 'update_note': {
      if (!parsed.entities.itemId || !parsed.entities.noteId || !parsed.entities.note) {
        return '❌ Please specify item ID, note ID, and new text (e.g., "update note for item abc note xyz: new text")';
      }
      const unResult = await client.updateNote(parsed.entities.itemId, parsed.entities.noteId, parsed.entities.note);
      return formatResponse(unResult);
    }

    case 'delete_note': {
      if (!parsed.entities.itemId || !parsed.entities.noteId) {
        return '❌ Please specify item ID and note ID (e.g., "delete note for item abc note xyz")';
      }
      const dnResult = await client.deleteNote(parsed.entities.itemId, parsed.entities.noteId);
      return formatResponse(dnResult);
    }

    case 'update_list_user': {
      if (!parsed.entities.listName || !parsed.entities.userId || !parsed.entities.permission) {
        return '❌ Please specify the list, user, and permission (e.g., "set user user@example.com permission on my work list to edit")';
      }
      const uluList = await resolveList(parsed.entities.listName);
      if ('error' in uluList) return uluList.error;
      const uluResult = await client.updateListUser(uluList.list.id, parsed.entities.userId, parsed.entities.permission);
      return formatResponse(uluResult);
    }

    case 'reorder_lists': {
      if (!(parsed.entities as any).listIds || !Array.isArray((parsed.entities as any).listIds)) {
        return '❌ Please specify list IDs to reorder (e.g., "reorder lists id1 id2 id3")';
      }
      const rlResult = await client.reorderLists((parsed.entities as any).listIds as string[]);
      return formatResponse(rlResult);
    }

    case 'reorder_items': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to reorder items in (e.g., "reorder items in my today list")';
      }
      const riList = await resolveList(parsed.entities.listName);
      if ('error' in riList) return riList.error;
      const itemIds = (parsed.entities as any).itemIds as string[] | undefined;
      if (!itemIds || itemIds.length === 0) {
        return '❌ Please specify item IDs to reorder';
      }
      const riResult = await client.reorderItems(riList.list.id, itemIds);
      return formatResponse(riResult);
    }

    case 'move_completed': {
      if (!parsed.entities.listName || !parsed.entities.targetListName) {
        return '❌ Please specify source and target list (e.g., "move completed from my today list to my done list")';
      }
      const mcList = await resolveList(parsed.entities.listName);
      if ('error' in mcList) return mcList.error;
      const mcTarget = await resolveList(parsed.entities.targetListName!);
      if ('error' in mcTarget) return mcTarget.error;
      const mcResult = await client.moveCompletedItems(mcList.list.id, mcTarget.list.id);
      return formatResponse(mcResult);
    }

    case 'update_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list to update (e.g., "rename my today list \"New Name\"")';
      }
      const ulList = await resolveList(parsed.entities.listName);
      if ('error' in ulList) return ulList.error;
      const updates: Record<string, any> = {};
      if (parsed.entities.itemText) updates.name = parsed.entities.itemText;
      const ulResult = await client.updateList(ulList.list.id, updates);
      return formatResponse(ulResult);
    }

    case 'get_list': {
      if (!parsed.entities.listName) {
        return '❌ Please specify which list (e.g., "show my today list details")';
      }
      const glList = await resolveList(parsed.entities.listName);
      if ('error' in glList) return glList.error;
      const glResult = await client.getListItem(glList.list.id);
      return formatResponse(glResult);
    }

    default:
      return `❓ I didn't understand that. Try commands like:\n` +
        `• Add "call Notary" to my today list\n` +
        `• Get priority items\n` +
        `• Mark item 123 as done\n` +
        `• Remove item 456\n` +
        `• Export my today list as html\n` +
        `• Search for meeting\n` +
        `• List summary\n` +
        `• Archive my old project list\n` +
        `• Share my work list with user@example.com as edit\n` +
        `• Update note for item abc note xyz: new text`;
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
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
