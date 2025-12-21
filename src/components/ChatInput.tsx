import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Send, Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  autoSendOnVoice?: boolean;
}

export interface ChatInputRef {
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
}

// Type for browser Speech Recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  function ChatInput({ onSend, isLoading, onStop, autoSendOnVoice }, ref) {
    const [message, setMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const pendingMessageRef = useRef('');

    // Check if speech recognition is supported
    const isSpeechSupported = typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      startListening: () => {
        if (recognitionRef.current && !isRecording) {
          try {
            recognitionRef.current.start();
            setIsRecording(true);
          } catch (err) {
            console.error('Failed to start recording:', err);
          }
        }
      },
      stopListening: () => {
        if (recognitionRef.current && isRecording) {
          recognitionRef.current.stop();
          setIsRecording(false);
        }
      },
      isListening: isRecording,
    }), [isRecording]);

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    }, [message]);

    // Initialize speech recognition
    useEffect(() => {
      if (!isSpeechSupported) {
        console.log('Speech recognition not supported in this browser');
        return;
      }

      try {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionAPI();
        
        recognition.continuous = false; // Stop after each phrase for auto-send
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log('Speech recognition started');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            pendingMessageRef.current = finalTranscript.trim();
            setMessage(finalTranscript.trim());
          } else if (interimTranscript) {
            setMessage(interimTranscript);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error, event.message);
          setIsRecording(false);
          
          if (event.error === 'not-allowed') {
            toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
          } else if (event.error === 'network') {
            toast.error('Network error. Please check your internet connection.');
          } else if (event.error === 'no-speech') {
            // Silent fail for no-speech - user just didn't say anything
            console.log('No speech detected');
          } else if (event.error !== 'aborted') {
            toast.error(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsRecording(false);
          // Auto-send if we have a pending message and autoSendOnVoice is enabled
          if (autoSendOnVoice && pendingMessageRef.current) {
            const msg = pendingMessageRef.current;
            pendingMessageRef.current = '';
            setMessage('');
            onSend(msg);
          }
        };

        recognitionRef.current = recognition;

        return () => {
          try {
            recognition.abort();
          } catch (e) {
            // Ignore errors on cleanup
          }
        };
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
      }
    }, [isSpeechSupported, autoSendOnVoice, onSend]);

    const handleSend = () => {
      if (message.trim() && !isLoading) {
        onSend(message.trim());
        setMessage('');
        pendingMessageRef.current = '';
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const toggleRecording = useCallback(() => {
      if (!recognitionRef.current) {
        toast.error('Speech recognition is not supported in your browser');
        return;
      }

      if (isRecording) {
        recognitionRef.current.stop();
        setIsRecording(false);
      } else {
        try {
          pendingMessageRef.current = '';
          setMessage('');
          recognitionRef.current.start();
          setIsRecording(true);
          toast.success('Listening...', { duration: 1500 });
        } catch (err) {
          console.error('Failed to start recording:', err);
          toast.error('Failed to start voice input');
        }
      }
    }, [isRecording]);

    return (
      <div className="p-4 border-t border-border bg-card/50">
        <div className="max-w-4xl mx-auto">
          <div className="relative glass-panel rounded-2xl input-glow transition-shadow">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening..." : "Send a message..."}
              className="min-h-[52px] max-h-[200px] resize-none border-0 bg-transparent pr-24 py-4 focus-visible:ring-0 scrollbar-thin"
              disabled={isLoading}
              rows={1}
            />
            
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {/* Voice button */}
              {isSpeechSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'rounded-full transition-colors',
                    isRecording && 'bg-destructive text-destructive-foreground animate-pulse-glow'
                  )}
                  onClick={toggleRecording}
                  disabled={isLoading}
                  title={isRecording ? "Stop listening" : "Start voice input"}
                >
                  {isRecording ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
              )}

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
);