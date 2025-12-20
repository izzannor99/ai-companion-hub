import { useState, useEffect } from 'react';
import { Cloud, Server, RefreshCw, Volume2, Play, Key, Mic, Bot } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ChatSettings, DEFAULT_SETTINGS, AVAILABLE_MODELS, DEFAULT_API_KEYS } from '@/lib/chat-api';
import { getAvailableVoices, speak, isTTSSupported } from '@/lib/tts';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
}

const HUGGINGFACE_MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.2',
  'meta-llama/Meta-Llama-3-8B-Instruct',
  'microsoft/Phi-3-mini-4k-instruct',
  'google/gemma-7b-it',
  'Qwen/Qwen2-7B-Instruct',
  'tiiuae/falcon-7b-instruct',
];

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [customHFModel, setCustomHFModel] = useState('');

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = getAvailableVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    
    // Voices may load asynchronously
    if (isTTSSupported()) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (isTTSSupported()) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    onOpenChange(false);
  };

  const scanLocalModels = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`${localSettings.localUrl}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        const models = data.data?.map((m: any) => m.id) || [];
        setLocalModels(models);
      }
    } catch (err) {
      console.error('Failed to scan models:', err);
    }
    setIsScanning(false);
  };

  const filteredModels = AVAILABLE_MODELS.filter(
    m => m.backend === localSettings.backend
  );

  const updateApiKey = (provider: keyof typeof DEFAULT_API_KEYS, value: string) => {
    setLocalSettings({
      ...localSettings,
      apiKeys: {
        ...localSettings.apiKeys,
        [provider]: value,
      },
    });
  };

  const getBackendLabel = (backend: string) => {
    switch (backend) {
      case 'local': return 'Local';
      case 'cloud': return 'Cloud';
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'google': return 'Google AI';
      case 'huggingface': return 'Hugging Face';
      default: return backend;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg glass-panel border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="backend" className="mt-4">
          <TabsList className="grid w-full grid-cols-5 bg-muted">
            <TabsTrigger value="backend" className="text-xs">Backend</TabsTrigger>
            <TabsTrigger value="model" className="text-xs">Model</TabsTrigger>
            <TabsTrigger value="apikeys" className="text-xs">API Keys</TabsTrigger>
            <TabsTrigger value="voice" className="text-xs">Voice</TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs">Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="backend" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'local'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'local', model: 'default' })
                }
              >
                <Server className="w-5 h-5 mb-1 text-accent" />
                <p className="font-medium text-sm">Local</p>
                <p className="text-[10px] text-muted-foreground">llama.cpp</p>
              </button>

              <button
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'cloud'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'cloud', model: 'gemini-flash' })
                }
              >
                <Cloud className="w-5 h-5 mb-1 text-primary" />
                <p className="font-medium text-sm">Cloud</p>
                <p className="text-[10px] text-muted-foreground">Lovable AI</p>
              </button>

              <button
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'openai'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'openai', model: 'gpt-4o' })
                }
              >
                <Bot className="w-5 h-5 mb-1 text-green-500" />
                <p className="font-medium text-sm">OpenAI</p>
                <p className="text-[10px] text-muted-foreground">GPT-4o</p>
              </button>

              <button
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'anthropic'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'anthropic', model: 'claude-3-5-sonnet-20241022' })
                }
              >
                <Bot className="w-5 h-5 mb-1 text-orange-500" />
                <p className="font-medium text-sm">Anthropic</p>
                <p className="text-[10px] text-muted-foreground">Claude</p>
              </button>

              <button
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'google'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'google', model: 'gemini-1.5-pro' })
                }
              >
                <Bot className="w-5 h-5 mb-1 text-blue-500" />
                <p className="font-medium text-sm">Google</p>
                <p className="text-[10px] text-muted-foreground">Gemini</p>
              </button>

              <button
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'huggingface'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'huggingface' })
                }
              >
                <Bot className="w-5 h-5 mb-1 text-yellow-500" />
                <p className="font-medium text-sm">HuggingFace</p>
                <p className="text-[10px] text-muted-foreground">Any model</p>
              </button>
            </div>

            {localSettings.backend === 'local' && (
              <div className="space-y-2">
                <Label>Local Server URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={localSettings.localUrl}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        localUrl: e.target.value,
                      })
                    }
                    placeholder="http://127.0.0.1:8081"
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={scanLocalModels}
                    disabled={isScanning}
                  >
                    <RefreshCw
                      className={cn('w-4 h-4', isScanning && 'animate-spin')}
                    />
                  </Button>
                </div>
                {localModels.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Found models: {localModels.join(', ')}
                  </p>
                )}
              </div>
            )}

            {['openai', 'anthropic', 'google', 'huggingface'].includes(localSettings.backend) && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  <Key className="w-3 h-3 inline mr-1" />
                  Using your own API key. Add it in the API Keys tab.
                  {localSettings.backend === 'huggingface' && ' Supports any model from Hugging Face Hub.'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="model" className="space-y-4 mt-4">
            {localSettings.backend === 'huggingface' ? (
              <div className="space-y-2">
                <Label>Hugging Face Model</Label>
                <select
                  value={localSettings.huggingfaceModel}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, huggingfaceModel: e.target.value })
                  }
                  className="w-full p-2 rounded-lg bg-muted border border-border"
                >
                  {HUGGINGFACE_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  {customHFModel && !HUGGINGFACE_MODELS.includes(customHFModel) && (
                    <option value={customHFModel}>{customHFModel}</option>
                  )}
                </select>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={customHFModel}
                    onChange={(e) => setCustomHFModel(e.target.value)}
                    placeholder="org/model-name (custom)"
                    className="bg-muted text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (customHFModel) {
                        setLocalSettings({ ...localSettings, huggingfaceModel: customHFModel });
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter any model ID from huggingface.co/models (must support chat completions API)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Model</Label>
                <select
                  value={localSettings.model}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, model: e.target.value })
                  }
                  className="w-full p-2 rounded-lg bg-muted border border-border"
                >
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {localModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Temperature</Label>
                <span className="text-sm text-muted-foreground">
                  {localSettings.temperature.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[localSettings.temperature]}
                onValueChange={([v]) =>
                  setLocalSettings({ ...localSettings, temperature: v })
                }
                min={0}
                max={2}
                step={0.01}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Top P</Label>
                <span className="text-sm text-muted-foreground">
                  {localSettings.topP.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[localSettings.topP]}
                onValueChange={([v]) =>
                  setLocalSettings({ ...localSettings, topP: v })
                }
                min={0}
                max={1}
                step={0.01}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Max Tokens</Label>
                <span className="text-sm text-muted-foreground">
                  {localSettings.maxTokens}
                </span>
              </div>
              <Slider
                value={[localSettings.maxTokens]}
                onValueChange={([v]) =>
                  setLocalSettings({ ...localSettings, maxTokens: v })
                }
                min={256}
                max={8192}
                step={256}
                className="py-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="apikeys" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-green-500" />
                  OpenAI API Key
                </Label>
                <Input
                  type="password"
                  value={localSettings.apiKeys.openai}
                  onChange={(e) => updateApiKey('openai', e.target.value)}
                  placeholder="sk-..."
                  className="bg-muted font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Get your key at platform.openai.com
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-orange-500" />
                  Anthropic API Key
                </Label>
                <Input
                  type="password"
                  value={localSettings.apiKeys.anthropic}
                  onChange={(e) => updateApiKey('anthropic', e.target.value)}
                  placeholder="sk-ant-..."
                  className="bg-muted font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Get your key at console.anthropic.com
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  Google AI API Key
                </Label>
                <Input
                  type="password"
                  value={localSettings.apiKeys.google}
                  onChange={(e) => updateApiKey('google', e.target.value)}
                  placeholder="AIza..."
                  className="bg-muted font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Get your key at aistudio.google.com
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-yellow-500" />
                  Hugging Face Token
                </Label>
                <Input
                  type="password"
                  value={localSettings.apiKeys.huggingface}
                  onChange={(e) => updateApiKey('huggingface', e.target.value)}
                  placeholder="hf_..."
                  className="bg-muted font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Get your token at huggingface.co/settings/tokens
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border mt-4">
              <p className="text-xs text-muted-foreground">
                <Key className="w-3 h-3 inline mr-1" />
                API keys are stored locally in your browser and sent directly to the providers. 
                They never pass through our servers.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Auto-play responses</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically read AI responses aloud
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.autoPlayTTS}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, autoPlayTTS: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-medium">Voice Conversation</p>
                  <p className="text-xs text-muted-foreground">
                    Continue listening after AI speaks
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.voiceConversation}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, voiceConversation: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="flex gap-2">
                <select
                  value={localSettings.ttsVoice}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, ttsVoice: e.target.value })
                  }
                  className="flex-1 p-2 rounded-lg bg-muted border border-border"
                >
                  <option value="">System Default</option>
                  {voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => speak('Hello! This is a preview of the selected voice.', {
                    voice: localSettings.ttsVoice,
                    rate: localSettings.ttsRate,
                  })}
                  title="Preview voice"
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Speech Rate</Label>
                <span className="text-sm text-muted-foreground">
                  {localSettings.ttsRate.toFixed(1)}x
                </span>
              </div>
              <Slider
                value={[localSettings.ttsRate]}
                onValueChange={([v]) =>
                  setLocalSettings({ ...localSettings, ttsRate: v })
                }
                min={0.5}
                max={2}
                step={0.1}
                className="py-2"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Uses your browser's built-in speech synthesis. Voice conversation mode 
              will auto-listen for your next message after the AI finishes speaking.
            </p>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea
                value={localSettings.systemPrompt}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    systemPrompt: e.target.value,
                  })
                }
                placeholder="You are a helpful assistant..."
                className="min-h-[200px] bg-muted"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setLocalSettings({
                  ...localSettings,
                  systemPrompt: DEFAULT_SETTINGS.systemPrompt,
                })
              }
            >
              Reset to default
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}