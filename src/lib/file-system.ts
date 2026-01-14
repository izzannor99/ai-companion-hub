// Browser File System Access API wrapper for reading/writing local files

export interface FileHandle {
  name: string;
  handle: FileSystemFileHandle;
}

export interface DirectoryHandle {
  name: string;
  handle: FileSystemDirectoryHandle;
}

let currentDirectoryHandle: FileSystemDirectoryHandle | null = null;

// Check if File System Access API is supported
export function isFileSystemSupported(): boolean {
  return 'showDirectoryPicker' in window && 'showOpenFilePicker' in window;
}

// Open a directory picker and store the handle
export async function openDirectory(): Promise<DirectoryHandle | null> {
  if (!isFileSystemSupported()) {
    throw new Error('File System Access API not supported in this browser');
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });
    currentDirectoryHandle = handle;
    return { name: handle.name, handle };
  } catch (error: any) {
    if (error.name === 'AbortError') return null;
    throw error;
  }
}

// Get the current directory handle
export function getCurrentDirectory(): DirectoryHandle | null {
  if (!currentDirectoryHandle) return null;
  return { name: currentDirectoryHandle.name, handle: currentDirectoryHandle };
}

// List files in a directory
export async function listFiles(
  dirHandle?: FileSystemDirectoryHandle,
  path: string = ''
): Promise<{ name: string; path: string; isDirectory: boolean }[]> {
  const handle = dirHandle || currentDirectoryHandle;
  if (!handle) throw new Error('No directory selected');

  const entries: { name: string; path: string; isDirectory: boolean }[] = [];

  for await (const entry of (handle as any).values()) {
    entries.push({
      name: entry.name,
      path: path ? `${path}/${entry.name}` : entry.name,
      isDirectory: entry.kind === 'directory',
    });
  }

  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Read a file's contents
export async function readFile(filePath: string): Promise<string> {
  if (!currentDirectoryHandle) throw new Error('No directory selected');

  const parts = filePath.split('/').filter(Boolean);
  let currentHandle: FileSystemDirectoryHandle = currentDirectoryHandle;

  // Navigate to the file's directory
  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
  }

  // Get the file handle
  const fileName = parts[parts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return await file.text();
}

// Write to a file (create if doesn't exist)
export async function writeFile(filePath: string, content: string): Promise<void> {
  if (!currentDirectoryHandle) throw new Error('No directory selected');

  const parts = filePath.split('/').filter(Boolean);
  let currentHandle: FileSystemDirectoryHandle = currentDirectoryHandle;

  // Navigate/create directories
  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
  }

  // Create/overwrite the file
  const fileName = parts[parts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
}

// Create a new file with content
export async function createFile(filePath: string, content: string = ''): Promise<void> {
  return writeFile(filePath, content);
}

// Delete a file
export async function deleteFile(filePath: string): Promise<void> {
  if (!currentDirectoryHandle) throw new Error('No directory selected');

  const parts = filePath.split('/').filter(Boolean);
  let currentHandle: FileSystemDirectoryHandle = currentDirectoryHandle;

  // Navigate to the file's directory
  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
  }

  // Delete the file
  const fileName = parts[parts.length - 1];
  await (currentHandle as any).removeEntry(fileName);
}

// Check if a file exists
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

// Get file extension
export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// Get language from file extension
export function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    txt: 'text',
  };
  return langMap[ext] || 'text';
}
