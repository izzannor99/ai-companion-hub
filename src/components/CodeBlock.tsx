import { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  Check,
  Play,
  Save,
  Loader2,
  Eye,
  X,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  saveSnippet,
  generateSnippetId,
  detectLanguage,
  type CodeSnippet,
} from '@/lib/code-snippets-db';
import { runPython, loadPyodide, isPyodideLoaded, isPyodideLoading } from '@/lib/python-runner';
import {
  isFileSystemSupported,
  openDirectory,
  getCurrentDirectory,
  writeFile,
} from '@/lib/file-system';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState('');
  const [filePath, setFilePath] = useState('');
  const [isLoadingPyodide, setIsLoadingPyodide] = useState(false);
  const { toast } = useToast();

  const detectedLang = language || detectLanguage(code);
  const isExecutable = ['python', 'py'].includes(detectedLang.toLowerCase());
  const canApplyToFile = isFileSystemSupported();

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard' });
  }, [code, toast]);

  const handleRun = useCallback(async () => {
    if (!isExecutable) return;

    setIsRunning(true);
    setOutput(null);
    setShowOutput(true);

    try {
      if (!isPyodideLoaded()) {
        setIsLoadingPyodide(true);
        toast({ title: 'Loading Python runtime...' });
        await loadPyodide();
        setIsLoadingPyodide(false);
        toast({ title: 'Python runtime ready!' });
      }

      const result = await runPython(code);
      if (result.success) {
        setOutput(result.output);
      } else {
        setOutput(`Error: ${result.error}\n\n${result.output}`);
      }
    } catch (error: any) {
      setOutput(`Failed to run: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [code, isExecutable, toast]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!snippetTitle.trim()) {
      toast({ variant: 'destructive', title: 'Please enter a title' });
      return;
    }

    const snippet: CodeSnippet = {
      id: generateSnippetId(),
      title: snippetTitle.trim(),
      language: detectedLang,
      code,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveSnippet(snippet);
    setShowSaveDialog(false);
    setSnippetTitle('');
    toast({ title: 'Saved to code library' });
    
    // Dispatch event for sidebar to refresh
    window.dispatchEvent(new CustomEvent('snippet-saved'));
  }, [snippetTitle, detectedLang, code, toast]);

  const handleApplyToFile = useCallback(async () => {
    if (!filePath.trim()) {
      toast({ variant: 'destructive', title: 'Please enter a file path' });
      return;
    }

    try {
      let dir = getCurrentDirectory();
      if (!dir) {
        toast({ title: 'Select your project folder' });
        dir = await openDirectory();
        if (!dir) return;
      }

      await writeFile(filePath.trim(), code);
      setShowApplyDialog(false);
      setFilePath('');
      toast({ title: `Saved to ${filePath}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: `Failed: ${error.message}` });
    }
  }, [filePath, code, toast]);

  const handleOpenDirectory = useCallback(async () => {
    try {
      await openDirectory();
      toast({ title: 'Project folder selected' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: error.message });
    }
  }, [toast]);

  return (
    <div className={cn('relative group rounded-lg overflow-hidden', className)}>
      {/* Language badge */}
      <div className="absolute top-2 left-3 z-10">
        <span className="text-xs px-2 py-0.5 rounded bg-muted/80 text-muted-foreground font-mono">
          {detectedLang}
        </span>
      </div>

      {/* Action buttons */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-muted/80 hover:bg-muted"
          onClick={handleCopy}
          title="Copy"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>

        {isExecutable && (
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 bg-muted/80 hover:bg-muted"
            onClick={handleRun}
            disabled={isRunning || isLoadingPyodide}
            title="Run Python"
          >
            {isRunning || isLoadingPyodide ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-accent" />
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-muted/80 hover:bg-muted"
          onClick={() => setShowSaveDialog(true)}
          title="Save to library"
        >
          <Save className="w-3.5 h-3.5" />
        </Button>

        {canApplyToFile && (
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 bg-muted/80 hover:bg-muted"
            onClick={() => setShowApplyDialog(true)}
            title="Apply to file"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Code display */}
      <SyntaxHighlighter
        language={detectedLang}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '2.5rem 1rem 1rem',
          background: 'hsl(var(--muted))',
          fontSize: '0.875rem',
          borderRadius: '0.5rem',
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>

      {/* Output panel */}
      {showOutput && (
        <div className="border-t border-border bg-card p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">Output</span>
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5"
              onClick={() => setShowOutput(false)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/90 max-h-48 overflow-auto">
            {output || (isRunning ? 'Running...' : 'No output')}
          </pre>
        </div>
      )}

      {/* Save to library dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save to Code Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Snippet title..."
              value={snippetTitle}
              onChange={(e) => setSnippetTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveToLibrary()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveToLibrary}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply to file dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDirectory}
                className="shrink-0"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                {getCurrentDirectory()?.name || 'Select Folder'}
              </Button>
            </div>
            <Input
              placeholder="File path (e.g., src/utils/helper.ts)"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyToFile()}
            />
            <p className="text-xs text-muted-foreground">
              This will create or overwrite the file in your selected project folder.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyToFile}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
