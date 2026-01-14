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
  getSelectedWhisperModel,
  getDownloadedModels
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

    // Check if local Whisper is available (same check as phone button)
    const [whisperAvailable, setWhisperAvailable] = useState(() => {
      return isWhisperLoaded() || getDownloadedModels().length > 0;
    });
    
    useEffect(() => {
      // Update whisper availability when models change
      const checkWhisper = () => {
        setWhisperAvailable(isWhisperLoaded() || getDownloadedModels().length > 0);
      };
      checkWhisper();
      // Listen for model changes
      window.addEventListener('whisper-model-changed', checkWhisper);
      return () => window.removeEventListener('whisper-model-changed', checkWhisper);
    }, []);

    // Voice input is always shown - uses local Whisper only (like phone button)
    const isVoiceSupported = true;

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

    // Local Whisper is the only voice input method (like phone button)
    // Browser speech recognition removed for consistency

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

      // Check if Whisper model is available (same as phone button)
      if (!whisperAvailable) {
        toast.info('Download a voice model first', {
          description: 'Go to Settings → Voice Models to download Whisper for offline speech recognition.',
          action: {
            label: 'Open Settings',
            onClick: () => {
              window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'voicemodels' } }));
            }
          },
          duration: 5000,
        });
        return;
      }

      // Use local Whisper for transcription
      startLocalRecording();
    }, [isRecording, whisperAvailable, startLocalRecording, stopRecording]);

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
                    'rounded-full transition-all',
                    isRecording && 'bg-destructive text-destructive-foreground animate-pulse-glow',
                    isTranscribing && 'bg-primary/20',
                    !isRecording && !isTranscribing && whisperAvailable && 'text-green-500 hover:text-green-400 hover:bg-green-500/10',
                    !isRecording && !isTranscribing && !whisperAvailable && 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={toggleRecording}
                  disabled={isLoading || isTranscribing}
                  title={
                    isTranscribing ? "Transcribing..." :
                    isRecording ? "Stop listening" : 
                    whisperAvailable ? "Voice input (offline)" : "Setup required - click to learn more"
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