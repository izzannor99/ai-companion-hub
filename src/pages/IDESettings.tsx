import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Moon, Sun, Wifi, WifiOff, RefreshCw, AlertTriangle, Cpu, Plug, FlaskConical, Brain, BookOpen, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { IDESettings as IDESettingsType, IDEMode, ConnectionMode, MODE_INFO, BOARD_TYPES, FRAMEWORKS, DEFAULT_SETTINGS } from '@/lib/ide-types';
import { getIDESettings, saveIDESettings } from '@/lib/ide-store';
import { listModels, isOllamaRunning, OllamaModel } from '@/lib/ollama-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function IDESettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<IDESettingsType>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [ollamaConnected, setOllamaConnected] = useState(false);

  useEffect(() => {
    setSettings(getIDESettings());
    checkOllama();
  }, []);

  const checkOllama = async () => {
    const connected = await isOllamaRunning();
    setOllamaConnected(connected);
    if (connected) {
      const modelList = await listModels();
      setModels(modelList);
    }
  };

  const updateSetting = <K extends keyof IDESettingsType>(key: K, value: IDESettingsType[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
  };

  const handleSave = () => {
    saveIDESettings(settings);
    toast.success('Settings saved');
  };

  const modeCards: { mode: IDEMode; icon: React.ReactNode }[] = [
    { mode: 'app-builder', icon: <Cpu className="h-5 w-5" /> },
    { mode: 'embedded-iot', icon: <Plug className="h-5 w-5" /> },
    { mode: 'system-helper', icon: <Shield className="h-5 w-5" /> },
    { mode: 'ai-improvement', icon: <Brain className="h-5 w-5" /> },
    { mode: 'learning', icon: <BookOpen className="h-5 w-5" /> },
    { mode: 'sandbox', icon: <FlaskConical className="h-5 w-5" /> },
    { mode: 'jailbreak', icon: <AlertTriangle className="h-5 w-5" /> },
    { mode: 'plugin', icon: <Plug className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ide')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />Save</Button>
      </header>

      <ScrollArea className="h-[calc(100vh-56px)]">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Modes */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Mode</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {modeCards.map(({ mode, icon }) => (
                <Card
                  key={mode}
                  className={cn('cursor-pointer transition-all hover:border-primary/50', settings.mode === mode && 'border-primary bg-primary/5')}
                  onClick={() => updateSetting('mode', mode)}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-center gap-2">
                      {icon}
                      <CardTitle className="text-sm">{MODE_INFO[mode].name}</CardTitle>
                    </div>
                    <CardDescription className="text-xs">{MODE_INFO[mode].description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          <Separator />

          {/* Connection */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Connection</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(['offline', 'online-research', 'updating'] as ConnectionMode[]).map((m) => (
                <Card
                  key={m}
                  className={cn('cursor-pointer transition-all', settings.connectionMode === m && 'border-primary bg-primary/5')}
                  onClick={() => updateSetting('connectionMode', m)}
                >
                  <CardHeader className="p-4 text-center">
                    {m === 'offline' && <WifiOff className="h-6 w-6 mx-auto text-amber-500" />}
                    {m === 'online-research' && <Wifi className="h-6 w-6 mx-auto text-green-500" />}
                    {m === 'updating' && <RefreshCw className="h-6 w-6 mx-auto text-blue-500" />}
                    <CardTitle className="text-sm mt-2 capitalize">{m.replace('-', ' ')}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <div className="space-y-4">
              <div><Label>Ollama URL</Label><Input value={settings.ollamaUrl} onChange={(e) => updateSetting('ollamaUrl', e.target.value)} /></div>
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', ollamaConnected ? 'bg-green-500' : 'bg-red-500')} />
                <span className="text-sm">{ollamaConnected ? 'Connected' : 'Not connected'}</span>
                <Button variant="outline" size="sm" onClick={checkOllama}>Test</Button>
              </div>
              {ollamaConnected && models.length > 0 && (
                <div><Label>Model</Label>
                  <Select value={settings.selectedModel} onValueChange={(v) => updateSetting('selectedModel', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{models.map((m) => <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Editor */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Editor</h2>
            <div className="space-y-4">
              <div><Label>Font Size: {settings.fontSize}px</Label><Slider value={[settings.fontSize]} onValueChange={([v]) => updateSetting('fontSize', v)} min={10} max={24} step={1} /></div>
              <div className="flex items-center justify-between"><Label>Auto Save</Label><Switch checked={settings.autoSave} onCheckedChange={(v) => updateSetting('autoSave', v)} /></div>
            </div>
          </section>

          {settings.mode === 'embedded-iot' && (
            <>
              <Separator />
              <section>
                <h2 className="text-lg font-semibold mb-4">Embedded / IoT</h2>
                <div className="space-y-4">
                  <div><Label>Board Type</Label>
                    <Select value={settings.boardType} onValueChange={(v) => updateSetting('boardType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{BOARD_TYPES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Serial Port</Label><Input value={settings.serialPort} onChange={(e) => updateSetting('serialPort', e.target.value)} /></div>
                  <div><Label>Build Command</Label><Input value={settings.buildCommand} onChange={(e) => updateSetting('buildCommand', e.target.value)} /></div>
                  <div><Label>Flash Command</Label><Input value={settings.flashCommand} onChange={(e) => updateSetting('flashCommand', e.target.value)} /></div>
                </div>
              </section>
            </>
          )}

          {settings.mode === 'jailbreak' && (
            <>
              <Separator />
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Jailbreak / Override</h2>
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardContent className="p-4 space-y-4">
                    <p className="text-sm text-amber-400">⚠️ Advanced: Custom system prompts override default behavior.</p>
                    <div className="flex items-center justify-between"><Label>Enable Override</Label><Switch checked={settings.jailbreakEnabled} onCheckedChange={(v) => updateSetting('jailbreakEnabled', v)} /></div>
                    {settings.jailbreakEnabled && <Textarea value={settings.jailbreakPrompt} onChange={(e) => updateSetting('jailbreakPrompt', e.target.value)} placeholder="Enter custom system prompt..." rows={6} />}
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
