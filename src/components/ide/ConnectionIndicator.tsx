import React from 'react';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { ConnectionMode } from '@/lib/ide-types';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConnectionIndicatorProps {
  mode: ConnectionMode;
  ollamaConnected: boolean;
  className?: string;
}

export function ConnectionIndicator({
  mode,
  ollamaConnected,
  className,
}: ConnectionIndicatorProps) {
  const getModeInfo = () => {
    switch (mode) {
      case 'offline':
        return {
          label: 'Offline',
          icon: WifiOff,
          color: 'bg-amber-500',
          description: 'Running fully offline with local models',
        };
      case 'online-research':
        return {
          label: 'Online',
          icon: Cloud,
          color: 'bg-green-500',
          description: 'Online research mode enabled',
        };
      case 'updating':
        return {
          label: 'Updating',
          icon: RefreshCw,
          color: 'bg-blue-500',
          description: 'Downloading models or updates',
        };
    }
  };

  const modeInfo = getModeInfo();
  const Icon = modeInfo.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 cursor-help transition-colors',
              mode === 'offline' && 'border-amber-500/50 text-amber-500',
              mode === 'online-research' && 'border-green-500/50 text-green-500',
              mode === 'updating' && 'border-blue-500/50 text-blue-500'
            )}
          >
            <Icon className={cn('h-3 w-3', mode === 'updating' && 'animate-spin')} />
            {modeInfo.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{modeInfo.description}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs',
              ollamaConnected ? 'text-green-500' : 'text-destructive'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                ollamaConnected ? 'bg-green-500' : 'bg-destructive'
              )}
            />
            <span>Ollama</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>
            {ollamaConnected
              ? 'Connected to local Ollama server'
              : 'Ollama not connected - check if server is running'}
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
