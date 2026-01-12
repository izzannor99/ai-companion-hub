import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, Volume2, Loader2, MicOff } from 'lucide-react';
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

type CallState = 'idle' | 'loading' | 'listening' | 'processing' | 'speaking';

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
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isCallActiveRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

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

  const detectSilence = useCallback((stream: MediaStream, onSilence: () => void) => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyserRef.current = analyser;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let silenceStart = 0;
    const SILENCE_THRESHOLD = 15; // Lower = more sensitive
    const SILENCE_DURATION = 1500; // 1.5 seconds of silence to trigger stop
    
    const checkAudio = () => {
      if (!isCallActiveRef.current) return;
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      
      if (average < SILENCE_THRESHOLD) {
        if (!silenceStart) silenceStart = Date.now();
        if (Date.now() - silenceStart > SILENCE_DURATION) {
          onSilence();
          return;
        }
      } else {
        silenceStart = 0;
      }
      
      requestAnimationFrame(checkAudio);
    };
    
    checkAudio();
  }, []);

  const startListening = useCallback(async () => {
    if (!isCallActiveRef.current) return;
    
    setCallState('listening');
    setTranscript('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;
      
      // Try to get the best available format
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (!isCallActiveRef.current) return;
        
        // Cleanup audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          if (isCallActiveRef.current) {
            setTimeout(() => startListening(), 500);
          }
          return;
        }

        setCallState('processing');
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        try {
          // Ensure Whisper is loaded
          if (!isWhisperLoaded()) {
            setLoadingMessage('Loading speech model...');
            setCallState('loading');
            const success = await loadWhisperModel(getSelectedWhisperModel(), (progress) => {
              if (progress.message) {
                setLoadingMessage(progress.message);
              }
            });
            if (!success) {
              throw new Error('Failed to load Whisper model');
            }
            setCallState('processing');
          }

          // Convert to audio data for Whisper
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
              setTimeout(() => startListening(), 500);
            }
          } else if (isCallActiveRef.current) {
            // No speech detected, restart
            setTimeout(() => startListening(), 500);
          }
        } catch (error) {
          console.error('Voice call error:', error);
          if (isCallActiveRef.current) {
            toast.error('Voice processing failed. Retrying...');
            setTimeout(() => startListening(), 1000);
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      // Setup silence detection to auto-stop
      detectSilence(stream, () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      });
      
      // Safety timeout - stop after 30 seconds max
      silenceTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 30000);
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      toast.error('Microphone access failed');
      if (isCallActiveRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, [onSendMessage, ttsVoice, ttsRate, detectSilence]);

  const startCall = useCallback(async () => {
    if (!canMakeCall) {
      toast.error('Download a Whisper model in Settings → Voice Models to enable voice calls');
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
    setLoadingMessage('');
    
    // Pre-load Whisper model if needed
    if (!isWhisperLoaded()) {
      setCallState('loading');
      setLoadingMessage('Loading speech recognition...');
      const success = await loadWhisperModel(getSelectedWhisperModel(), (progress) => {
        if (progress.message) {
          setLoadingMessage(progress.message);
        }
      });
      if (!success) {
        toast.error('Failed to load speech model');
        isCallActiveRef.current = false;
        setIsInCall(false);
        setCallState('idle');
        return;
      }
    }
    
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
    setLoadingMessage('');
    
    // Clear timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    // Stop any ongoing recording
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop TTS
    stopSpeaking();
  }, []);

  const stopListeningManually = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
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
          canMakeCall ? 'text-green-500 hover:text-green-400 hover:bg-green-500/10' : 'text-muted-foreground'
        )}
        onClick={startCall}
        disabled={disabled || !canMakeCall}
        title={canMakeCall ? 'Start voice call (offline)' : 'Download Whisper model in Settings → Voice Models'}
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
          'w-32 h-32 rounded-full flex items-center justify-center mb-4 mx-auto transition-all shadow-lg',
          callState === 'loading' && 'bg-blue-500/20',
          callState === 'listening' && 'bg-green-500/20 animate-pulse ring-4 ring-green-500/30',
          callState === 'processing' && 'bg-yellow-500/20',
          callState === 'speaking' && 'bg-primary/20 animate-pulse ring-4 ring-primary/30'
        )}>
          {callState === 'loading' && <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />}
          {callState === 'listening' && <Mic className="w-12 h-12 text-green-500" />}
          {callState === 'processing' && <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />}
          {callState === 'speaking' && <Volume2 className="w-12 h-12 text-primary" />}
        </div>
        
        <p className="text-xl font-medium mb-2">
          {callState === 'loading' && 'Getting Ready...'}
          {callState === 'listening' && 'Listening...'}
          {callState === 'processing' && 'Thinking...'}
          {callState === 'speaking' && 'Speaking...'}
        </p>
        
        <p className="text-sm text-muted-foreground">
          {callState === 'loading' && loadingMessage}
          {callState === 'listening' && 'Speak now - I\'ll hear you when you pause'}
          {callState === 'processing' && 'Processing your voice...'}
          {callState === 'speaking' && 'Wait for me to finish, then speak'}
        </p>
      </div>

      {/* Transcript display */}
      {transcript && (
        <div className="max-w-md w-full mb-4 p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">You said:</p>
          <p className="text-foreground">{transcript}</p>
        </div>
      )}

      {/* AI response display */}
      {aiResponse && (
        <div className="max-w-md w-full mb-8 p-4 rounded-xl bg-primary/10 border border-primary/20">
          <p className="text-xs font-medium text-primary mb-1 uppercase tracking-wide">Assistant:</p>
          <p className="text-foreground line-clamp-6">{aiResponse}</p>
        </div>
      )}

      {/* Call controls */}
      <div className="flex gap-4">
        {callState === 'listening' && (
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full px-6"
            onClick={stopListeningManually}
          >
            <MicOff className="w-5 h-5 mr-2" />
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
      <p className="mt-8 text-xs text-muted-foreground text-center">
        🔒 100% offline • Local Whisper STT + Browser TTS
      </p>
    </div>
  );
}
