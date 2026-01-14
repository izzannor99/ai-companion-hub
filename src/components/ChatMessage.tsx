import { useState, useCallback, useEffect } from 'react';
import { Copy, Check, Pencil, Trash2, User, Bot, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Message } from '@/lib/db';
import { cn } from '@/lib/utils';
import { speak, stopSpeaking, isTTSSupported } from '@/lib/tts';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from '@/components/CodeBlock';

interface ChatMessageProps {
  message: Message;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}

export function ChatMessage({ message, onEdit, onDelete }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isUser = message.role === 'user';
  const ttsSupported = isTTSSupported();

  // Stop speaking when component unmounts
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim()) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      speak(message.content, { onEnd: () => setIsSpeaking(false) });
      setIsSpeaking(true);
    }
  }, [isSpeaking, message.content]);

  return (
    <div
      className={cn(
        'group flex gap-3 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          isUser ? 'bg-primary' : 'bg-accent'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-accent-foreground" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'flex flex-col items-end')}>
        {isEditing ? (
          <div className="space-y-2 w-full">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[100px] bg-secondary"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'message-bubble',
              isUser ? 'message-user' : 'message-assistant'
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    code: ({ className, children, node, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      
                      // Check if it's a code block (has language or multiple lines)
                      const isBlock = match || codeString.includes('\n') || codeString.length > 100;
                      
                      if (isBlock) {
                        return (
                          <CodeBlock
                            code={codeString}
                            language={match?.[1]}
                            className="my-3"
                          />
                        );
                      }
                      
                      return (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <>{children}</>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div
            className={cn(
              'flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
              isUser && 'flex-row-reverse'
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-3 h-3 text-accent" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
            {/* TTS button for assistant messages */}
            {!isUser && ttsSupported && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('w-7 h-7', isSpeaking && 'text-primary')}
                onClick={handleSpeak}
                title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
              >
                {isSpeaking ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </Button>
            )}
            {isUser && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={() => onDelete(message.id)}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
