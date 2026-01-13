import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, Volume2, Loader2, MicOff, Hand } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface VoiceCallModeProps {
  onSendMessage: (message: string) => Promise<string>;
  ttsVoice?: string;
  ttsRate?: number;
  disabled?: boolean;
}

type CallState = 'idle' | 'loading' | 'listening' | 'processing' | 'speaking' | 'waiting';

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
  const [pushToTalk, setPushToTalk] = useState(() => {
    const saved = localStorage.getItem('voice-push-to-talk');
    return saved === 'true';
  });
  const [isHoldingSpace, setIsHoldingSpace] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isCallActiveRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pushToTalkRef = useRef(pushToTalk);

  // Keep ref in sync with state
  useEffect(() => {
    pushToTalkRef.current = pushToTalk;
    localStorage.setItem('voice-push-to-talk', String(pushToTalk));
  }, [pushToTalk]);

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
          if (isCallActiveRef.current && !pushToTalkRef.current) {
            setTimeout(() => startListening(), 500);
          } else if (isCallActiveRef.current && pushToTalkRef.current) {
            setCallState('waiting');
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
                    if (pushToTalkRef.current) {
                      // In push-to-talk mode, wait for user to press space
                      setCallState('waiting');
                    } else {
                      // Continue the conversation loop
                      setTimeout(() => startListening(), 300);
                    }
                  }
                },
              });
            } else if (isCallActiveRef.current) {
              if (pushToTalkRef.current) {
                setCallState('waiting');
              } else {
                setTimeout(() => startListening(), 500);
              }
            }
          } else if (isCallActiveRef.current) {
            // No speech detected
            if (pushToTalkRef.current) {
              setCallState('waiting');
            } else {
              setTimeout(() => startListening(), 500);
            }
          }
        } catch (error) {
          console.error('Voice call error:', error);
          if (isCallActiveRef.current) {
            toast.error('Voice processing failed. Retrying...');
            if (pushToTalkRef.current) {
              setCallState('waiting');
            } else {
              setTimeout(() => startListening(), 1000);
            }
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      // Only setup silence detection if NOT in push-to-talk mode
      if (!pushToTalkRef.current) {
        detectSilence(stream, () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        });
      }
      
      // Safety timeout - stop after 30 seconds max (60s for push-to-talk)
      const maxDuration = pushToTalkRef.current ? 60000 : 30000;
      silenceTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, maxDuration);
      
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
    
    const modeText = pushToTalk ? 'Hold Space to talk' : 'Speak anytime';
    toast.success(`Voice call started - ${modeText}`, { duration: 2000 });
    
    // Start listening immediately (or wait for push-to-talk)
    if (pushToTalk) {
      setCallState('waiting');
    } else {
      startListening();
    }
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

  const handlePhoneClick = () => {
    if (!canMakeCall) {
      toast.info('Download a voice model first', {
        description: 'Go to Settings → Voice Models to download Whisper for offline speech recognition.',
        action: {
          label: 'Open Settings',
          onClick: () => {
            // Dispatch a custom event that Index.tsx can listen for
            window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'voicemodels' } }));
          }
        },
        duration: 5000,
      });
      return;
    }
    startCall();
  };

  // Keyboard shortcuts for voice call
  useEffect(() => {
    if (!isInCall) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Spacebar behavior
      if (e.code === 'Space') {
        e.preventDefault();
        
        if (pushToTalkRef.current) {
          // Push-to-talk mode: start recording on keydown
          if (callState === 'waiting' && !isHoldingSpace) {
            setIsHoldingSpace(true);
            startListening();
          } else if (callState === 'speaking') {
            // Interrupt TTS and start listening
            stopSpeaking();
            setIsHoldingSpace(true);
            startListening();
          }
        } else {
          // Auto-detect mode: toggle recording
          if (callState === 'listening') {
            stopListeningManually();
          } else if (callState === 'speaking') {
            stopSpeaking();
            startListening();
          }
        }
      }

      // Escape to end call
      if (e.code === 'Escape') {
        e.preventDefault();
        endCall();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Push-to-talk: stop recording on key release
      if (e.code === 'Space' && pushToTalkRef.current && isHoldingSpace) {
        e.preventDefault();
        setIsHoldingSpace(false);
        if (callState === 'listening') {
          stopListeningManually();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isInCall, callState, isHoldingSpace, stopListeningManually, startListening, endCall]);

  if (!isInCall) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-full transition-all',
          canMakeCall ? 'text-green-500 hover:text-green-400 hover:bg-green-500/10' : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={handlePhoneClick}
        disabled={disabled}
        title={canMakeCall ? 'Start voice call (offline)' : 'Setup required - click to learn more'}
      >
        <Phone className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6">
      {/* Mode toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-3 bg-muted/50 rounded-full px-4 py-2 border border-border">
        <Label htmlFor="push-to-talk" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-2">
          <Hand className="w-4 h-4" />
          Push to Talk
        </Label>
        <Switch
          id="push-to-talk"
          checked={pushToTalk}
          onCheckedChange={setPushToTalk}
        />
      </div>

      {/* Call status indicator */}
      <div className="text-center mb-8">
        <div className={cn(
          'w-32 h-32 rounded-full flex items-center justify-center mb-4 mx-auto transition-all shadow-lg',
          callState === 'loading' && 'bg-blue-500/20',
          callState === 'listening' && 'bg-green-500/20 animate-pulse ring-4 ring-green-500/30',
          callState === 'processing' && 'bg-yellow-500/20',
          callState === 'speaking' && 'bg-primary/20 animate-pulse ring-4 ring-primary/30',
          callState === 'waiting' && 'bg-muted/50 border-2 border-dashed border-muted-foreground/30'
        )}>
          {callState === 'loading' && <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />}
          {callState === 'listening' && <Mic className="w-12 h-12 text-green-500" />}
          {callState === 'processing' && <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />}
          {callState === 'speaking' && <Volume2 className="w-12 h-12 text-primary" />}
          {callState === 'waiting' && <Hand className="w-12 h-12 text-muted-foreground" />}
        </div>
        
        <p className="text-xl font-medium mb-2">
          {callState === 'loading' && 'Getting Ready...'}
          {callState === 'listening' && (pushToTalk ? 'Recording...' : 'Listening...')}
          {callState === 'processing' && 'Thinking...'}
          {callState === 'speaking' && 'Speaking...'}
          {callState === 'waiting' && 'Ready'}
        </p>
        
        <p className="text-sm text-muted-foreground">
          {callState === 'loading' && loadingMessage}
          {callState === 'listening' && (pushToTalk ? 'Release Space when done' : 'Speak now - Press Space to send early')}
          {callState === 'processing' && 'Processing your voice...'}
          {callState === 'speaking' && 'Press Space to interrupt • Esc to end call'}
          {callState === 'waiting' && 'Hold Space to speak'}
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
        {callState === 'listening' && !pushToTalk && (
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
        
        {callState === 'waiting' && pushToTalk && (
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full px-6"
            onMouseDown={() => {
              setIsHoldingSpace(true);
              startListening();
            }}
            onMouseUp={() => {
              setIsHoldingSpace(false);
              stopListeningManually();
            }}
            onMouseLeave={() => {
              if (isHoldingSpace) {
                setIsHoldingSpace(false);
                stopListeningManually();
              }
            }}
          >
            <Mic className="w-5 h-5 mr-2" />
            Hold to Talk
          </Button>
        )}
        
        {callState === 'listening' && pushToTalk && (
          <Button
            variant="default"
            size="lg"
            className="rounded-full px-6 bg-green-600 hover:bg-green-700"
            onMouseUp={() => {
              setIsHoldingSpace(false);
              stopListeningManually();
            }}
          >
            <Mic className="w-5 h-5 mr-2 animate-pulse" />
            Recording...
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
        <br />
        <span className="opacity-70">
          {pushToTalk ? 'Hold Space: record • Esc: end call' : 'Space: toggle • Esc: end call'}
        </span>
      </p>
    </div>
  );
}
