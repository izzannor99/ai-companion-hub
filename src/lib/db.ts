// IndexedDB wrapper for chat history persistence

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: string;
}

const DB_NAME = 'AraChat';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
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
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(conversation);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllConversations(): Promise<Conversation[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('updatedAt');
    const request = index.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result as Conversation[];
      resolve(results.sort((a, b) => b.updatedAt - a.updatedAt));
    };
  });
}

export async function deleteConversation(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function searchConversations(query: string): Promise<Conversation[]> {
  const all = await getAllConversations();
  const lowerQuery = query.toLowerCase();
  return all.filter(conv => 
    conv.title.toLowerCase().includes(lowerQuery) ||
    conv.messages.some(m => m.content.toLowerCase().includes(lowerQuery))
  );
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
