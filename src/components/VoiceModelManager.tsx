import { useState, useEffect } from 'react';
import { Download, Check, Loader2, Mic, Volume2, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  WHISPER_MODELS,
  getSelectedWhisperModel,
  setSelectedWhisperModel,
  getDownloadedModels,
  loadWhisperModel,
  isWhisperLoaded,
  unloadWhisper,
  isWebGPUSupported,
  type TranscriptionProgress,
} from '@/lib/local-stt';
import { isTTSSupported, getAvailableVoices } from '@/lib/tts';

export function VoiceModelManager() {
  const [selectedModel, setSelectedModel] = useState(getSelectedWhisperModel());
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<TranscriptionProgress | null>(null);
  const [webGPUSupported, setWebGPUSupported] = useState(false);
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    setDownloadedModels(getDownloadedModels());
    setModelLoaded(isWhisperLoaded());
    
    // Check WebGPU support
    isWebGPUSupported().then(setWebGPUSupported);
    
    // Get TTS voices
    getAvailableVoices().then(setTtsVoices);
  }, []);

  const handleDownloadModel = async (modelId: string) => {
    setLoadingModel(modelId);
    setLoadProgress({ status: 'downloading', progress: 0 });

    const success = await loadWhisperModel(modelId, (progress) => {
      setLoadProgress(progress);
    }, webGPUSupported);

    if (success) {
      setDownloadedModels(getDownloadedModels());
      setSelectedModel(modelId);
      setSelectedWhisperModel(modelId);
      setModelLoaded(true);
      toast.success('Model downloaded and ready!');
    } else {
      toast.error('Failed to download model');
    }

    setLoadingModel(null);
    setLoadProgress(null);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setSelectedWhisperModel(modelId);
    
    // If model was previously downloaded, load it
    if (downloadedModels.includes(modelId)) {
      handleDownloadModel(modelId);
    }
  };

  const handleUnloadModel = () => {
    unloadWhisper();
    setModelLoaded(false);
    toast.success('Model unloaded from memory');
  };

  const isDownloaded = (modelId: string) => downloadedModels.includes(modelId);
  const isSelected = (modelId: string) => selectedModel === modelId;
  const isLoading = (modelId: string) => loadingModel === modelId;

  return (
    <div className="space-y-6">
      {/* Speech-to-Text Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Speech-to-Text (Whisper)</h3>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Download a Whisper model for offline voice input. Models are cached in your browser.
          {webGPUSupported && (
            <span className="text-green-500 ml-1">✓ WebGPU acceleration available</span>
          )}
        </p>

        {modelLoaded && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-500">Model loaded and ready for offline use</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnloadModel}
              className="ml-auto h-7 text-xs"
            >
              Unload
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {WHISPER_MODELS.map((model) => (
            <div
              key={model.id}
              className={cn(
                'p-3 rounded-lg border transition-all cursor-pointer',
                isSelected(model.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              )}
              onClick={() => handleSelectModel(model.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{model.name}</span>
                    <span className="text-xs text-muted-foreground">({model.size})</span>
                    {isDownloaded(model.id) && (
                      <Check className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {model.description}
                  </p>
                </div>

                <Button
                  variant={isDownloaded(model.id) ? 'outline' : 'default'}
                  size="sm"
                  className="shrink-0"
                  disabled={isLoading(model.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadModel(model.id);
                  }}
                >
                  {isLoading(model.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isDownloaded(model.id) ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Load
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </>
                  )}
                </Button>
              </div>

              {isLoading(model.id) && loadProgress && (
                <div className="mt-2 space-y-1">
                  <Progress value={loadProgress.progress || 0} className="h-1" />
                  <p className="text-xs text-muted-foreground">
                    {loadProgress.message}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Text-to-Speech Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Text-to-Speech</h3>
        </div>

        {isTTSSupported() ? (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-500">
                Browser TTS available ({ttsVoices.length} voices)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Text-to-speech uses your browser's built-in voices and works offline.
              Configure voice settings in the Voice tab.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">
                Text-to-speech not supported in this browser
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
        <h4 className="font-medium text-sm">How it works</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• <strong>Speech-to-Text:</strong> Whisper models run entirely in your browser using WebGPU/WASM</li>
          <li>• <strong>Text-to-Speech:</strong> Uses your browser's built-in speech synthesis</li>
          <li>• <strong>Offline:</strong> Once downloaded, voice features work without internet</li>
          <li>• <strong>Privacy:</strong> All processing happens locally on your device</li>
        </ul>
      </div>
    </div>
  );
}
