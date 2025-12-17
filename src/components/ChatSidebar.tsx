import { useState } from 'react';
import { Plus, Search, MessageSquare, Trash2, Settings, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Conversation } from '@/lib/db';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function ChatSidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  onExport,
  onImport,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          <h1 className="text-lg font-semibold gradient-text">AraChat</h1>
        </div>
        
        <Button 
          onClick={onNew}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent border-sidebar-border"
          />
        </div>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              {searchQuery ? 'No chats found' : 'No conversations yet'}
            </p>
          ) : (
            filtered.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                  currentId === conv.id
                    ? 'bg-sidebar-accent'
                    : 'hover:bg-sidebar-accent/50'
                )}
                onClick={() => onSelect(conv.id)}
              >
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{conv.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(conv.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start"
            onClick={onExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start"
            onClick={onImport}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onOpenSettings}
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}
