import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, ExternalLink, Terminal, X, Play, Square, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PreviewPaneProps {
  previewUrl?: string;
  isServerRunning: boolean;
  logs: string[];
  errors: string[];
  onRefresh: () => void;
  onStartServer: () => void;
  onStopServer: () => void;
  onOpenExternal?: () => void;
  className?: string;
}

export function PreviewPane({
  previewUrl,
  isServerRunning,
  logs,
  errors,
  onRefresh,
  onStartServer,
  onStopServer,
  onOpenExternal,
  className,
}: PreviewPaneProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'console'>('preview');
  const [isMaximized, setIsMaximized] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, errors]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    onRefresh();
  };

  return (
    <div className={cn('flex flex-col h-full bg-card', isMaximized && 'fixed inset-0 z-50', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'console')}>
            <TabsList className="h-7">
              <TabsTrigger value="preview" className="text-xs px-2 py-1">
                Preview
              </TabsTrigger>
              <TabsTrigger value="console" className="text-xs px-2 py-1">
                Console
                {errors.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                    {errors.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-1">
          {isServerRunning ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStopServer}>
                <Square className="h-4 w-4 text-destructive" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStartServer}>
              <Play className="h-4 w-4 text-green-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenExternal}>
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setIsMaximized(!isMaximized)}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'preview' ? (
          <div className="h-full bg-white">
            {isServerRunning && previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-muted/20 text-muted-foreground">
                <Terminal className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No preview available</p>
                <p className="text-sm mt-1">Start the dev server to see your app</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={onStartServer}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Dev Server
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div
              ref={consoleRef}
              className="p-3 font-mono text-xs space-y-1"
            >
              {logs.length === 0 && errors.length === 0 ? (
                <div className="text-muted-foreground">No console output yet...</div>
              ) : (
                <>
                  {logs.map((log, i) => (
                    <div key={`log-${i}`} className="text-muted-foreground">
                      <span className="text-blue-400">[info]</span> {log}
                    </div>
                  ))}
                  {errors.map((error, i) => (
                    <div key={`error-${i}`} className="text-destructive">
                      <span className="text-red-400">[error]</span> {error}
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border text-xs text-muted-foreground bg-card">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isServerRunning ? 'bg-green-500' : 'bg-muted'
            )}
          />
          <span>{isServerRunning ? 'Server running' : 'Server stopped'}</span>
        </div>
        {previewUrl && <span className="font-mono">{previewUrl}</span>}
      </div>
    </div>
  );
}
