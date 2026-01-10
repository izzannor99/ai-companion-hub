import { useState, useEffect } from 'react';
import { Download, Check, Loader2, Mic, Volume2, Trash2, AlertCircle, Cpu, Zap, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  clearDownloadedModel,
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
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

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
      toast.success('Model ready for offline voice input!');
    } else {
      toast.error('Failed to download model. Check your connection.');
    }

    setLoadingModel(null);
    setLoadProgress(null);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setSelectedWhisperModel(modelId);
    
    // If model was previously downloaded, load it
    if (downloadedModels.includes(modelId) && !isWhisperLoaded()) {
      handleDownloadModel(modelId);
    }
  };

  const handleUnloadModel = () => {
    unloadWhisper();
    setModelLoaded(false);
    toast.success('Model unloaded to free memory');
  };

  const handleDeleteModel = async (modelId: string) => {
    setDeletingModel(modelId);
    try {
      await clearDownloadedModel(modelId);
      setDownloadedModels(getDownloadedModels());
      if (selectedModel === modelId) {
        unloadWhisper();
        setModelLoaded(false);
      }
      toast.success('Model cache cleared');
    } catch (error) {
      toast.error('Failed to clear model cache');
    }
    setDeletingModel(null);
  };

  const isDownloaded = (modelId: string) => downloadedModels.includes(modelId);
  const isSelected = (modelId: string) => selectedModel === modelId;
  const isLoading = (modelId: string) => loadingModel === modelId;

  const getModelRecommendation = (modelId: string) => {
    if (modelId.includes('tiny.en')) return 'Recommended';
    if (modelId.includes('base.en')) return 'Better accuracy';
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={cn(
        'p-3 rounded-lg border flex items-center gap-3',
        modelLoaded 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-muted/50 border-border'
      )}>
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          modelLoaded ? 'bg-green-500/20' : 'bg-muted'
        )}>
          <Mic className={cn('w-5 h-5', modelLoaded ? 'text-green-500' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1">
          <p className={cn('font-medium text-sm', modelLoaded ? 'text-green-500' : 'text-foreground')}>
            {modelLoaded ? 'Offline voice ready' : 'No voice model loaded'}
          </p>
          <p className="text-xs text-muted-foreground">
            {modelLoaded 
              ? 'Speech-to-text works without internet' 
              : 'Download a model below for offline voice input'}
          </p>
        </div>
        {modelLoaded && (
          <Button variant="outline" size="sm" onClick={handleUnloadModel} className="shrink-0">
            Unload
          </Button>
        )}
      </div>

      {/* Hardware Info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {webGPUSupported ? (
            <>
              <Zap className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">WebGPU acceleration</span>
            </>
          ) : (
            <>
              <Cpu className="w-3.5 h-3.5" />
              <span>WASM fallback (slower)</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5" />
          <span>{downloadedModels.length} model{downloadedModels.length !== 1 ? 's' : ''} cached</span>
        </div>
      </div>

      {/* Speech-to-Text Models */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Speech-to-Text Models</h3>
        </div>

        <div className="space-y-2">
          {WHISPER_MODELS.map((model) => {
            const recommendation = getModelRecommendation(model.id);
            return (
              <div
                key={model.id}
                className={cn(
                  'p-3 rounded-lg border transition-all cursor-pointer group',
                  isSelected(model.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() => handleSelectModel(model.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{model.name}</span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        {model.size}
                      </Badge>
                      {isDownloaded(model.id) && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-green-500 border-green-500/30">
                          <Check className="w-2.5 h-2.5 mr-0.5" />
                          Cached
                        </Badge>
                      )}
                      {recommendation && (
                        <Badge className="text-[10px] py-0 px-1.5 bg-primary/20 text-primary border-0">
                          {recommendation}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {model.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isDownloaded(model.id) && !isLoading(model.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        disabled={deletingModel === model.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteModel(model.id);
                        }}
                        title="Clear cache"
                      >
                        {deletingModel === model.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant={isDownloaded(model.id) ? 'outline' : 'default'}
                      size="sm"
                      className="h-8"
                      disabled={isLoading(model.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadModel(model.id);
                      }}
                    >
                      {isLoading(model.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isDownloaded(model.id) ? (
                        'Load'
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-1" />
                          Get
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {isLoading(model.id) && loadProgress && (
                  <div className="mt-3 space-y-1.5">
                    <Progress value={loadProgress.progress || 0} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {loadProgress.message}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Text-to-Speech Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Text-to-Speech</h3>
        </div>

        <div className={cn(
          'p-3 rounded-lg border',
          isTTSSupported() 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-destructive/10 border-destructive/30'
        )}>
          <div className="flex items-center gap-2">
            {isTTSSupported() ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-500 font-medium">
                  {ttsVoices.length} voices available
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">Not supported in this browser</span>
              </>
            )}
          </div>
          {isTTSSupported() && (
            <p className="text-xs text-muted-foreground mt-1">
              Built-in browser voices work offline. Configure in the TTS tab.
            </p>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
          How it works
        </h4>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong>Speech-to-Text:</strong> Whisper AI runs in your browser using {webGPUSupported ? 'GPU' : 'CPU'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong>Text-to-Speech:</strong> Uses your browser's built-in speech synthesis</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong>Privacy:</strong> All voice processing happens locally on your device</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
