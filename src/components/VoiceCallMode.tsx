import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  isWhisperLoaded, 
  loadWhisperModel, 
  transcribeAudio, 
  getSelectedWhisperModel,
  getDownloadedModels 
} from '@/lib/local-stt';
import { speak, stopSpeaking, isTTSSupported } from '@/lib/tts';

interface VoiceCallModeProps {
  onSendMessage: (message: string) => Promise<string>;
  ttsVoice?: string;
  ttsRate?: number;
  disabled?: boolean;
}

type CallState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceCallMode({ 
  onSendMessage, 
  ttsVoice, 
  ttsRate = 1.0,
  disabled 
}: VoiceCallModeProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isCallActiveRef = useRef(false);

  // Check if voice call is available (need Whisper model + TTS)
  const whisperReady = isWhisperLoaded() || getDownloadedModels().length > 0;
  const ttsReady = isTTSSupported();
  const canMakeCall = whisperReady && ttsReady;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!isCallActiveRef.current) return;
    
    setCallState('listening');
    setTranscript('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (!isCallActiveRef.current) return;
        
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          // No audio captured, restart listening
          if (isCallActiveRef.current) {
            setTimeout(() => startListening(), 500);
          }
          return;
        }

        setCallState('processing');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          // Ensure Whisper is loaded
          if (!isWhisperLoaded()) {
            const success = await loadWhisperModel(getSelectedWhisperModel(), (progress) => {
              if (progress.message) {
                setTranscript(progress.message);
              }
            });
            if (!success) {
              throw new Error('Failed to load Whisper model');
            }
          }

          // Convert to audio data
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const audioData = audioBuffer.getChannelData(0);
          await audioContext.close();

          const text = await transcribeAudio(audioData);
          
          if (text.trim() && isCallActiveRef.current) {
            setTranscript(text.trim());
            
            // Send to AI
            const response = await onSendMessage(text.trim());
            
            if (response && isCallActiveRef.current) {
              setAiResponse(response);
              setCallState('speaking');
              
              // Speak the response
              speak(response, {
                voice: ttsVoice,
                rate: ttsRate,
                onEnd: () => {
                  if (isCallActiveRef.current) {
                    // Continue the conversation loop
                    setTimeout(() => startListening(), 300);
                  }
                },
              });
            } else if (isCallActiveRef.current) {
              // No response, restart listening
              setTimeout(() => startListening(), 500);
            }
          } else if (isCallActiveRef.current) {
            // No speech detected, restart
            setTimeout(() => startListening(), 500);
          }
        } catch (error) {
          console.error('Voice call error:', error);
          if (isCallActiveRef.current) {
            toast.error('Voice processing failed');
            setTimeout(() => startListening(), 1000);
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      // Auto-stop after 10 seconds of recording
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 10000);
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      toast.error('Microphone access failed');
      if (isCallActiveRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, [onSendMessage, ttsVoice, ttsRate]);

  const startCall = useCallback(async () => {
    if (!canMakeCall) {
      toast.error('Download a Whisper model in Settings → Voice to enable voice calls');
      return;
    }

    // Request mic permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      toast.error('Microphone access required for voice calls');
      return;
    }

    isCallActiveRef.current = true;
    setIsInCall(true);
    setTranscript('');
    setAiResponse('');
    toast.success('Voice call started - speak anytime', { duration: 2000 });
    
    // Start listening immediately
    startListening();
  }, [canMakeCall, startListening]);

  const endCall = useCallback(() => {
    isCallActiveRef.current = false;
    setIsInCall(false);
    setCallState('idle');
    setTranscript('');
    setAiResponse('');
    
    // Stop any ongoing recording
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop TTS
    stopSpeaking();
  }, []);

  const stopListeningManually = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  if (!isInCall) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-full transition-all',
          canMakeCall ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground'
        )}
        onClick={startCall}
        disabled={disabled || !canMakeCall}
        title={canMakeCall ? 'Start voice call (offline)' : 'Download Whisper model to enable'}
      >
        <Phone className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6">
      {/* Call status indicator */}
      <div className="text-center mb-8">
        <div className={cn(
          'w-24 h-24 rounded-full flex items-center justify-center mb-4 mx-auto transition-all',
          callState === 'listening' && 'bg-primary/20 animate-pulse',
          callState === 'processing' && 'bg-yellow-500/20',
          callState === 'speaking' && 'bg-green-500/20 animate-pulse'
        )}>
          {callState === 'listening' && <Mic className="w-10 h-10 text-primary" />}
          {callState === 'processing' && <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />}
          {callState === 'speaking' && <Volume2 className="w-10 h-10 text-green-500" />}
        </div>
        
        <p className="text-lg font-medium mb-2">
          {callState === 'listening' && 'Listening...'}
          {callState === 'processing' && 'Processing...'}
          {callState === 'speaking' && 'Speaking...'}
        </p>
        
        <p className="text-sm text-muted-foreground">
          {callState === 'listening' && 'Speak now, or tap to send'}
        </p>
      </div>

      {/* Transcript display */}
      {transcript && (
        <div className="max-w-md w-full mb-4 p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground mb-1">You said:</p>
          <p className="text-foreground">{transcript}</p>
        </div>
      )}

      {/* AI response display */}
      {aiResponse && (
        <div className="max-w-md w-full mb-8 p-4 rounded-lg bg-primary/10">
          <p className="text-sm text-primary mb-1">AI:</p>
          <p className="text-foreground line-clamp-4">{aiResponse}</p>
        </div>
      )}

      {/* Call controls */}
      <div className="flex gap-4">
        {callState === 'listening' && (
          <Button
            variant="outline"
            size="lg"
            className="rounded-full"
            onClick={stopListeningManually}
          >
            <Mic className="w-5 h-5 mr-2" />
            Done Speaking
          </Button>
        )}
        
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full px-8"
          onClick={endCall}
        >
          <PhoneOff className="w-5 h-5 mr-2" />
          End Call
        </Button>
      </div>

      {/* Status info */}
      <p className="mt-8 text-xs text-muted-foreground">
        Voice call works completely offline • Using local Whisper + Browser TTS
      </p>
    </div>
  );
}
