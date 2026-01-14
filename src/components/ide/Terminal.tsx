import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { executeCommand, getAgentStatus, onOutput, AgentStatus } from '@/lib/local-backend-agent';
import { toast } from 'sonner';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: number;
}

interface TerminalProps {
  className?: string;
  initialCommands?: string[];
  cwd?: string;
}

export function Terminal({ className, initialCommands = [], cwd }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: '0',
      type: 'system',
      content: 'LocalDev Terminal v1.0.0',
      timestamp: Date.now(),
    },
    {
      id: '1',
      type: 'system',
      content: 'Type "help" for available commands. Agent: checking...',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isMaximized, setIsMaximized] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ connected: false });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(2);

  // Check agent status
  useEffect(() => {
    const checkStatus = async () => {
      const status = getAgentStatus();
      setAgentStatus(status);
      
      // Update the "checking..." message
      setLines(prev => prev.map(line => {
        if (line.content.includes('Agent: checking...')) {
          return {
            ...line,
            content: `Type "help" for available commands. Agent: ${status.connected ? '✓ connected' : '✗ not running'}`,
          };
        }
        return line;
      }));
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time output
  useEffect(() => {
    const unsubscribe = onOutput((output, isError) => {
      addLine(isError ? 'error' : 'output', output);
    });
    return unsubscribe;
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Run initial commands
  useEffect(() => {
    initialCommands.forEach(cmd => {
      runCommand(cmd);
    });
  }, []);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [
      ...prev,
      {
        id: String(lineIdRef.current++),
        type,
        content,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const runCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Add to history
    setHistory(prev => [...prev.filter(h => h !== trimmed), trimmed]);
    setHistoryIndex(-1);

    // Add input line
    addLine('input', `$ ${trimmed}`);

    // Built-in commands
    if (trimmed === 'help') {
      addLine('output', `Available commands:
  help          Show this help message
  clear         Clear the terminal
  agent         Show agent connection status
  ls            List files (requires agent)
  pwd           Show current directory
  npm <args>    Run npm command (requires agent)
  node <file>   Run Node.js file (requires agent)
  
Note: Commands marked (requires agent) need the LocalDev Agent running.
Download it from the Settings menu.`);
      return;
    }

    if (trimmed === 'clear') {
      setLines([]);
      return;
    }

    if (trimmed === 'agent') {
      addLine('output', agentStatus.connected
        ? `Agent Status: ✓ Connected\nVersion: ${agentStatus.version}\nPlatform: ${agentStatus.platform}\nCapabilities: ${agentStatus.capabilities?.join(', ')}`
        : 'Agent Status: ✗ Not connected\n\nTo run commands for real, download and run the LocalDev Agent from Settings.');
      return;
    }

    if (trimmed === 'pwd') {
      addLine('output', cwd || process.cwd?.() || '/');
      return;
    }

    // Execute through agent or simulate
    try {
      const result = await executeCommand(trimmed, cwd);
      
      if (result.output) {
        addLine('output', result.output);
      }
      
      if (result.error) {
        addLine('error', result.error);
      }
    } catch (error) {
      addLine('error', `Command failed: ${error}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const handleCopy = () => {
    const text = lines.map(l => l.content).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-black text-green-400 font-mono text-sm',
        isMaximized && 'fixed inset-0 z-50',
        className
      )}
      onClick={focusInput}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" />
          <span className="text-zinc-400 text-xs">Terminal</span>
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              agentStatus.connected ? 'bg-green-500' : 'bg-zinc-600'
            )}
            title={agentStatus.connected ? 'Agent connected' : 'Agent not connected'}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-zinc-800"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          >
            <Copy className="h-3 w-3 text-zinc-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-zinc-800"
            onClick={(e) => { e.stopPropagation(); setLines([]); }}
          >
            <Trash2 className="h-3 w-3 text-zinc-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-zinc-800"
            onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}
          >
            {isMaximized ? (
              <Minimize2 className="h-3 w-3 text-zinc-400" />
            ) : (
              <Maximize2 className="h-3 w-3 text-zinc-400" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-1">
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                'whitespace-pre-wrap break-all',
                line.type === 'input' && 'text-cyan-400',
                line.type === 'output' && 'text-green-400',
                line.type === 'error' && 'text-red-400',
                line.type === 'system' && 'text-zinc-500'
              )}
            >
              {line.content}
            </div>
          ))}
        </div>

        {/* Input line */}
        <form onSubmit={handleSubmit} className="flex items-center mt-1">
          <span className="text-cyan-400 mr-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-green-400 caret-green-400"
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </ScrollArea>
    </div>
  );
}
