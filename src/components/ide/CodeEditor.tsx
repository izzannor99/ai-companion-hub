import React, { useCallback } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import { ProjectFile } from '@/lib/ide-types';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CodeEditorProps {
  file: ProjectFile | null;
  openFiles: ProjectFile[];
  onFileChange: (path: string, content: string) => void;
  onCloseFile: (path: string) => void;
  onSelectFile: (file: ProjectFile) => void;
  fontSize?: number;
  className?: string;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    py: 'python',
    cpp: 'cpp',
    c: 'c',
    h: 'cpp',
    hpp: 'cpp',
    rs: 'rust',
    go: 'go',
    java: 'java',
    sh: 'shell',
    bash: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    ini: 'ini',
    toml: 'toml',
  };
  return languageMap[ext || ''] || 'plaintext';
}

export function CodeEditor({
  file,
  openFiles,
  onFileChange,
  onCloseFile,
  onSelectFile,
  fontSize = 14,
  className,
}: CodeEditorProps) {
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    // Configure editor theme
    monaco.editor.defineTheme('lovable-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#79c0ff',
        'editorLineNumber.foreground': '#484f58',
        'editorLineNumber.activeForeground': '#e6edf3',
      },
    });
    monaco.editor.setTheme('lovable-dark');

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Trigger save
      window.dispatchEvent(new CustomEvent('ide-save-file'));
    });
  }, []);

  const handleEditorChange: OnChange = useCallback(
    (value) => {
      if (file && value !== undefined) {
        onFileChange(file.path, value);
      }
    },
    [file, onFileChange]
  );

  return (
    <div className={cn('flex flex-col h-full bg-[#0d1117]', className)}>
      {/* Tab bar */}
      <div className="flex items-center bg-card border-b border-border overflow-x-auto scrollbar-thin">
        {openFiles.map((f) => (
          <div
            key={f.path}
            className={cn(
              'flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-colors min-w-0',
              f.path === file?.path
                ? 'bg-[#0d1117] text-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted/50'
            )}
            onClick={() => onSelectFile(f)}
          >
            <span className="text-sm truncate max-w-[120px]">{f.name}</span>
            {f.isModified && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 opacity-50 hover:opacity-100 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(f.path);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {file ? (
          <Editor
            height="100%"
            language={getLanguageFromPath(file.path)}
            value={file.content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              fontSize,
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: true, scale: 0.75 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              insertSpaces: true,
              automaticLayout: true,
              padding: { top: 16 },
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
              suggest: {
                showKeywords: true,
                showSnippets: true,
              },
            }}
            theme="vs-dark"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg">No file open</p>
              <p className="text-sm mt-1">Select a file from the explorer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
