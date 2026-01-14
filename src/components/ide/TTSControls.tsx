import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Volume2, VolumeX, Settings, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  getTTSSettings,
  saveTTSSettings,
  getVoicesAsync,
  isSpeaking,
  stop,
  toggleTTS,
  TTSSettings,
} from '@/lib/tts-engine';

interface TTSControlsProps {
  className?: string;
  compact?: boolean;
}

export function TTSControls({ className, compact = false }: TTSControlsProps) {
  const [settings, setSettings] = useState<TTSSettings>(getTTSSettings());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  // Load voices
  useEffect(() => {
    getVoicesAsync().then(setVoices);
  }, []);

  // Poll speaking state
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeaking(isSpeaking());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const newEnabled = toggleTTS();
    setSettings(prev => ({ ...prev, enabled: newEnabled }));
  };

  const handleStop = () => {
    stop();
    setSpeaking(false);
  };

  const updateSetting = <K extends keyof TTSSettings>(key: K, value: TTSSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveTTSSettings({ [key]: value });
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            settings.enabled && 'text-primary',
            speaking && 'animate-pulse'
          )}
          onClick={handleToggle}
          title={settings.enabled ? 'Disable TTS' : 'Enable TTS'}
        >
          {settings.enabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>
        
        {speaking && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={handleStop}
            title="Stop speaking"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant={settings.enabled ? 'default' : 'outline'}
        size="sm"
        className="gap-2"
        onClick={handleToggle}
      >
        {settings.enabled ? (
          <>
            <Volume2 className="h-4 w-4" />
            TTS On
          </>
        ) : (
          <>
            <VolumeX className="h-4 w-4" />
            TTS Off
          </>
        )}
      </Button>

      {speaking && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleStop}
        >
          <Square className="h-4 w-4 mr-2" />
          Stop
        </Button>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <h4 className="font-medium">Text-to-Speech Settings</h4>
            
            {/* Voice selection */}
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select
                value={settings.voice || ''}
                onValueChange={(v) => updateSetting('voice', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                      {voice.localService && ' ⚡'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ⚡ = Local voice (works offline)
              </p>
            </div>

            {/* Rate */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Speed</Label>
                <span className="text-sm text-muted-foreground">{settings.rate}x</span>
              </div>
              <Slider
                value={[settings.rate]}
                onValueChange={([v]) => updateSetting('rate', v)}
                min={0.5}
                max={2}
                step={0.1}
              />
            </div>

            {/* Pitch */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Pitch</Label>
                <span className="text-sm text-muted-foreground">{settings.pitch}</span>
              </div>
              <Slider
                value={[settings.pitch]}
                onValueChange={([v]) => updateSetting('pitch', v)}
                min={0}
                max={2}
                step={0.1}
              />
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Volume</Label>
                <span className="text-sm text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
              </div>
              <Slider
                value={[settings.volume]}
                onValueChange={([v]) => updateSetting('volume', v)}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
