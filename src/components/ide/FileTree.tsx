import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Trash2, Edit2, Download, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectFile } from '@/lib/ide-types';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FileTreeProps {
  files: ProjectFile[];
  selectedFile?: string;
  onSelectFile: (file: ProjectFile) => void;
  onCreateFile?: (path: string, isDirectory: boolean) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newPath: string) => void;
  className?: string;
}

interface FileNodeProps {
  file: ProjectFile;
  depth: number;
  selectedFile?: string;
  onSelectFile: (file: ProjectFile) => void;
  onCreateFile?: (path: string, isDirectory: boolean) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newPath: string) => void;
  expandedPaths: Set<string>;
  toggleExpanded: (path: string) => void;
}

function getFileIcon(fileName: string, isDirectory: boolean, isOpen: boolean): React.ReactNode {
  if (isDirectory) {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 text-amber-400" />
    ) : (
      <Folder className="h-4 w-4 text-amber-400" />
    );
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  const iconColors: Record<string, string> = {
    tsx: 'text-blue-400',
    ts: 'text-blue-500',
    jsx: 'text-yellow-400',
    js: 'text-yellow-500',
    css: 'text-pink-400',
    html: 'text-orange-400',
    json: 'text-green-400',
    md: 'text-gray-400',
    py: 'text-green-500',
    cpp: 'text-purple-400',
    c: 'text-blue-300',
    h: 'text-purple-300',
    ini: 'text-gray-500',
  };

  return <File className={cn('h-4 w-4', iconColors[ext || ''] || 'text-muted-foreground')} />;
}

function FileNode({
  file,
  depth,
  selectedFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  expandedPaths,
  toggleExpanded,
}: FileNodeProps) {
  const isExpanded = expandedPaths.has(file.path);
  const isSelected = selectedFile === file.path;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(file.name);

  const handleClick = () => {
    if (file.isDirectory) {
      toggleExpanded(file.path);
    } else {
      onSelectFile(file);
    }
  };

  const handleRename = () => {
    if (editName !== file.name && onRenameFile) {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
      onRenameFile(file.path, `${parentPath}/${editName}`);
    }
    setIsEditing(false);
  };

  const contextMenuItems = (
    <>
      {file.isDirectory && (
        <>
          <ContextMenuItem onClick={() => onCreateFile?.(file.path, false)}>
            <Plus className="h-4 w-4 mr-2" />
            New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateFile?.(file.path, true)}>
            <Folder className="h-4 w-4 mr-2" />
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem onClick={() => setIsEditing(true)}>
        <Edit2 className="h-4 w-4 mr-2" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onDeleteFile?.(file.path)} className="text-destructive">
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </ContextMenuItem>
    </>
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm transition-colors',
              'hover:bg-muted/50',
              isSelected && 'bg-primary/20 text-primary'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={handleClick}
          >
            {file.isDirectory ? (
              <span className="w-4 h-4 flex items-center justify-center">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
            ) : (
              <span className="w-4" />
            )}
            {getFileIcon(file.name, file.isDirectory, isExpanded)}
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setEditName(file.name);
                    setIsEditing(false);
                  }
                }}
                className="flex-1 bg-transparent border border-primary rounded px-1 text-sm outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm truncate flex-1">{file.name}</span>
            )}
            {file.isModified && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{contextMenuItems}</ContextMenuContent>
      </ContextMenu>

      {file.isDirectory && isExpanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileNode
              key={child.path}
              file={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              onCreateFile={onCreateFile}
              onDeleteFile={onDeleteFile}
              onRenameFile={onRenameFile}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function FileTree({
  files,
  selectedFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  className,
}: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/src']));

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateFile?.('/', false)}>
              <Plus className="h-4 w-4 mr-2" />
              New File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateFile?.('/', true)}>
              <Folder className="h-4 w-4 mr-2" />
              New Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Download className="h-4 w-4 mr-2" />
              Download as ZIP
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 overflow-auto py-1 scrollbar-thin">
        {files.map((file) => (
          <FileNode
            key={file.path}
            file={file}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onCreateFile={onCreateFile}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
            expandedPaths={expandedPaths}
            toggleExpanded={toggleExpanded}
          />
        ))}
      </div>
    </div>
  );
}
