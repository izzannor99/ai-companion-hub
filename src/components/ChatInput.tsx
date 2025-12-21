import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Send, Mic, MicOff, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { 
  isWhisperLoaded, 
  loadWhisperModel, 
  transcribeAudio, 
  getSelectedWhisperModel 
} from '@/lib/local-stt';

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
    const [isTranscribing, setIsTranscribing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const pendingMessageRef = useRef('');
    const { isOnline } = useNetworkStatus();

    // Check if local Whisper is available
    const [whisperAvailable, setWhisperAvailable] = useState(false);
    
    useEffect(() => {
      // Check if Whisper model is loaded
      setWhisperAvailable(isWhisperLoaded());
    }, []);

    // Check if browser speech recognition is supported
    const isBrowserSpeechSupported = typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // Voice input is supported if either browser speech (online) or local Whisper is available
    const isVoiceSupported = isBrowserSpeechSupported || whisperAvailable;

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      startListening: () => {
        if (!isRecording && !isTranscribing) {
          toggleRecording();
        }
      },
      stopListening: () => {
        if (isRecording) {
          stopRecording();
        }
      },
      isListening: isRecording,
    }), [isRecording, isTranscribing]);

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    }, [message]);

    // Initialize browser speech recognition (for online use)
    useEffect(() => {
      if (!isBrowserSpeechSupported) {
        console.log('Browser speech recognition not supported');
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
            toast.error('Voice input requires internet (browser limitation). Your chat messages still work offline with local AI.');
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
    }, [isBrowserSpeechSupported, autoSendOnVoice, onSend]);

    // Start recording with local Whisper (for offline use)
    const startLocalRecording = useCallback(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          
          if (audioChunksRef.current.length === 0) {
            return;
          }

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setIsTranscribing(true);
          
          try {
            // Ensure model is loaded
            if (!isWhisperLoaded()) {
              toast.error('Loading Whisper model...');
              const success = await loadWhisperModel(getSelectedWhisperModel(), (progress) => {
                if (progress.message) {
                  toast.loading(progress.message, { id: 'whisper-loading' });
                }
              });
              toast.dismiss('whisper-loading');
              if (!success) {
                throw new Error('Failed to load model');
              }
              setWhisperAvailable(true);
            }

            // Convert blob to audio data for Whisper
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const audioData = audioBuffer.getChannelData(0);

            const text = await transcribeAudio(audioData);
            
            if (text.trim()) {
              if (autoSendOnVoice) {
                onSend(text.trim());
              } else {
                setMessage(text.trim());
              }
            }
          } catch (error) {
            console.error('Transcription error:', error);
            toast.error('Failed to transcribe audio');
          } finally {
            setIsTranscribing(false);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
        toast.success('Recording... (local Whisper)', { duration: 1500 });
      } catch (error) {
        console.error('Failed to start recording:', error);
        toast.error('Failed to access microphone');
      }
    }, [autoSendOnVoice, onSend]);

    const stopRecording = useCallback(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }, []);

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
      if (isRecording) {
        stopRecording();
        return;
      }

      // Decide which method to use: local Whisper or browser speech API
      const useLocalWhisper = !isOnline || whisperAvailable;

      if (useLocalWhisper && whisperAvailable) {
        // Use local Whisper for offline transcription
        startLocalRecording();
      } else if (isOnline && isBrowserSpeechSupported && recognitionRef.current) {
        // Use browser speech API (requires internet)
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
      } else if (!isOnline && !whisperAvailable) {
        // Offline but no Whisper model
        toast.error('Download a Whisper model in Settings → Voice for offline voice input');
      } else {
        toast.error('Voice input not available. Download Whisper model in Settings.');
      }
    }, [isRecording, isOnline, whisperAvailable, isBrowserSpeechSupported, startLocalRecording, stopRecording]);

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
              {isVoiceSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'rounded-full transition-colors',
                    isRecording && 'bg-destructive text-destructive-foreground animate-pulse-glow',
                    isTranscribing && 'bg-primary/20'
                  )}
                  onClick={toggleRecording}
                  disabled={isLoading || isTranscribing}
                  title={
                    isTranscribing ? "Transcribing..." :
                    isRecording ? "Stop listening" : 
                    whisperAvailable ? "Voice input (offline)" : "Voice input"
                  }
                >
                  {isTranscribing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isRecording ? (
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