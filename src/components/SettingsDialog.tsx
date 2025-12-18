import { useState, useEffect } from 'react';
import { X, Cloud, Server, RefreshCw, Volume2 } from 'lucide-react';
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
import { ChatSettings, DEFAULT_SETTINGS, AVAILABLE_MODELS } from '@/lib/chat-api';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg glass-panel border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="backend" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 bg-muted">
            <TabsTrigger value="backend">Backend</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="backend" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                className={cn(
                  'p-4 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'local'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'local' })
                }
              >
                <Server className="w-6 h-6 mb-2 text-accent" />
                <p className="font-medium">Local</p>
                <p className="text-xs text-muted-foreground">
                  Connect to llama.cpp
                </p>
              </button>

              <button
                className={cn(
                  'p-4 rounded-xl border-2 transition-all text-left',
                  localSettings.backend === 'cloud'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() =>
                  setLocalSettings({ ...localSettings, backend: 'cloud' })
                }
              >
                <Cloud className="w-6 h-6 mb-2 text-primary" />
                <p className="font-medium">Cloud</p>
                <p className="text-xs text-muted-foreground">
                  Use Lovable AI APIs
                </p>
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
          </TabsContent>

          <TabsContent value="model" className="space-y-4 mt-4">
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
            <p className="text-xs text-muted-foreground">
              Uses your browser's built-in speech synthesis. You can also manually 
              click the speaker icon on any message to read it aloud.
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
