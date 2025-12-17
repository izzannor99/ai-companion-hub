import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, isLoading, onStop }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // For now, just show a placeholder message
        // In production, this would send to a STT service
        setMessage(prev => prev + ' [Voice input recorded - STT integration required]');
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="p-4 border-t border-border bg-card/50">
      <div className="max-w-4xl mx-auto">
        <div className="relative glass-panel rounded-2xl input-glow transition-shadow">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className="min-h-[52px] max-h-[200px] resize-none border-0 bg-transparent pr-24 py-4 focus-visible:ring-0 scrollbar-thin"
            disabled={isLoading}
            rows={1}
          />
          
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {/* Voice button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'rounded-full transition-colors',
                isRecording && 'bg-destructive text-destructive-foreground animate-pulse-glow'
              )}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>

            {/* Send/Stop button */}
            {isLoading ? (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onStop}
              >
                <Square className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="rounded-full bg-primary hover:bg-primary/90"
                onClick={handleSend}
                disabled={!message.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        <p className="text-center text-xs text-muted-foreground mt-2">
          AraChat can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}
