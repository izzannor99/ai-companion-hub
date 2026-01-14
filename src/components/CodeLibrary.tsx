import { useState, useEffect, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Code2,
  Search,
  Trash2,
  Copy,
  Play,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getAllSnippets,
  deleteSnippet,
  searchSnippets,
  type CodeSnippet,
} from '@/lib/code-snippets-db';
import { runPython, isPyodideLoaded, loadPyodide } from '@/lib/python-runner';

interface CodeLibraryProps {
  className?: string;
  onClose?: () => void;
}

export function CodeLibrary({ className, onClose }: CodeLibraryProps) {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const loadSnippets = useCallback(async () => {
    const all = searchQuery
      ? await searchSnippets(searchQuery)
      : await getAllSnippets();
    setSnippets(all);
  }, [searchQuery]);

  useEffect(() => {
    loadSnippets();

    // Listen for new snippets saved
    const handleSaved = () => loadSnippets();
    window.addEventListener('snippet-saved', handleSaved);
    return () => window.removeEventListener('snippet-saved', handleSaved);
  }, [loadSnippets]);

  const handleDelete = async (id: string) => {
    await deleteSnippet(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
    toast({ title: 'Snippet deleted' });
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast({ title: 'Copied to clipboard' });
  };

  const handleRun = async (snippet: CodeSnippet) => {
    if (!['python', 'py'].includes(snippet.language.toLowerCase())) {
      toast({
        variant: 'destructive',
        title: 'Only Python code can be run',
      });
      return;
    }

    setRunningId(snippet.id);
    try {
      if (!isPyodideLoaded()) {
        toast({ title: 'Loading Python runtime...' });
        await loadPyodide();
      }

      const result = await runPython(snippet.code);
      setOutputs((prev) => ({
        ...prev,
        [snippet.id]: result.success
          ? result.output
          : `Error: ${result.error}\n${result.output}`,
      }));
      setExpandedId(snippet.id);
    } catch (error: any) {
      setOutputs((prev) => ({
        ...prev,
        [snippet.id]: `Failed: ${error.message}`,
      }));
    } finally {
      setRunningId(null);
    }
  };

  const groupedSnippets = snippets.reduce((acc, snippet) => {
    const lang = snippet.language.toLowerCase();
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(snippet);
    return acc;
  }, {} as Record<string, CodeSnippet[]>);

  return (
    <div className={cn('flex flex-col h-full bg-sidebar', className)}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Code Library</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-sidebar-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent"
          />
        </div>
      </div>

      {/* Snippets list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {Object.entries(groupedSnippets).map(([lang, langSnippets]) => (
            <Collapsible key={lang} defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className="w-4 h-4 transition-transform [&[data-state=closed]]:rotate-[-90deg]" />
                <span className="uppercase">{lang}</span>
                <span className="text-xs">({langSnippets.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {langSnippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="rounded-lg border border-sidebar-border bg-sidebar-accent overflow-hidden"
                  >
                    {/* Snippet header */}
                    <div
                      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                      onClick={() =>
                        setExpandedId(expandedId === snippet.id ? null : snippet.id)
                      }
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {expandedId === snippet.id ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                        <span className="font-medium truncate">{snippet.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(snippet.code);
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {['python', 'py'].includes(snippet.language.toLowerCase()) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRun(snippet);
                            }}
                            disabled={runningId === snippet.id}
                          >
                            {runningId === snippet.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-accent" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(snippet.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {expandedId === snippet.id && (
                      <div className="border-t border-sidebar-border">
                        <SyntaxHighlighter
                          language={snippet.language}
                          style={oneDark}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            background: 'transparent',
                            fontSize: '0.75rem',
                          }}
                          wrapLongLines
                        >
                          {snippet.code}
                        </SyntaxHighlighter>

                        {/* Output */}
                        {outputs[snippet.id] && (
                          <div className="border-t border-sidebar-border p-3 bg-muted/30">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Output
                            </div>
                            <pre className="text-xs font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                              {outputs[snippet.id]}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}

          {snippets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Code2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No snippets saved yet</p>
              <p className="text-xs mt-1">
                Save code from chat using the save button
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
