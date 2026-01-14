// Code Snippets Database using IndexedDB

export interface CodeSnippet {
  id: string;
  title: string;
  language: string;
  code: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'code-snippets-db';
const DB_VERSION = 1;
const STORE_NAME = 'snippets';

let db: IDBDatabase | null = null;

export async function initSnippetsDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('language', 'language', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

export async function saveSnippet(snippet: CodeSnippet): Promise<void> {
  const database = await initSnippetsDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(snippet);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getSnippet(id: string): Promise<CodeSnippet | undefined> {
  const database = await initSnippetsDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllSnippets(): Promise<CodeSnippet[]> {
  const database = await initSnippetsDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const snippets = request.result as CodeSnippet[];
      snippets.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(snippets);
    };
  });
}

export async function deleteSnippet(id: string): Promise<void> {
  const database = await initSnippetsDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function searchSnippets(query: string): Promise<CodeSnippet[]> {
  const all = await getAllSnippets();
  const q = query.toLowerCase();
  return all.filter(
    s =>
      s.title.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q)) ||
      s.language.toLowerCase().includes(q)
  );
}

export function generateSnippetId(): string {
  return `snippet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function detectLanguage(code: string): string {
  // Simple language detection based on patterns
  if (/^\s*(import|from)\s+[\w.]+/.test(code) && /def\s+\w+\s*\(/.test(code)) return 'python';
  if (/^\s*#!\s*\/.*python/.test(code)) return 'python';
  if (/^\s*(const|let|var|function|import|export)\s/.test(code)) return 'javascript';
  if (/^\s*(interface|type|const|let)\s.*:\s*\w+/.test(code)) return 'typescript';
  if (/<\/?[a-z][\s\S]*>/i.test(code) && !/^\s*(const|let|var|function)/.test(code)) return 'html';
  if (/^\s*[\.\#\@]?[\w-]+\s*\{/.test(code)) return 'css';
  if (/^\s*\{[\s\S]*"[\w]+"[\s\S]*:/.test(code)) return 'json';
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\s/i.test(code)) return 'sql';
  if (/^\s*```(\w+)?/.test(code)) {
    const match = code.match(/```(\w+)/);
    return match?.[1] || 'text';
  }
  return 'text';
}
