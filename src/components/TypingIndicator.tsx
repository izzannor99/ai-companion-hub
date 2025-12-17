import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-accent-foreground" />
      </div>
      <div className="message-bubble message-assistant">
        <div className="typing-indicator flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
        </div>
      </div>
    </div>
  );
}
