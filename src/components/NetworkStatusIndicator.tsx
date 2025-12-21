import { useNetworkStatus } from '@/hooks/use-network-status';
import { Wifi, WifiOff, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface NetworkStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function NetworkStatusIndicator({ 
  className,
  showDetails = false 
}: NetworkStatusIndicatorProps) {
  const { isOnline, wasOffline, effectiveType, downlink } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  // Show toast when connection is restored
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      toast.success('Back online!', { duration: 3000 });
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show toast when going offline
  useEffect(() => {
    if (!isOnline) {
      toast.warning('You are offline. Some features may be limited.', { 
        duration: 5000,
        id: 'offline-toast'
      });
    }
  }, [isOnline]);

  const getConnectionQuality = () => {
    if (!isOnline) return 'offline';
    if (effectiveType === '4g' || (downlink && downlink > 5)) return 'excellent';
    if (effectiveType === '3g' || (downlink && downlink > 1)) return 'good';
    if (effectiveType === '2g' || effectiveType === 'slow-2g') return 'poor';
    return 'unknown';
  };

  const quality = getConnectionQuality();

  return (
    <div 
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300',
        {
          'bg-destructive/10 text-destructive': !isOnline,
          'bg-accent/10 text-accent': isOnline && showReconnected,
          'bg-muted/50 text-muted-foreground': isOnline && !showReconnected,
        },
        className
      )}
      title={isOnline ? `Online${effectiveType ? ` (${effectiveType})` : ''}` : 'Offline'}
    >
      {isOnline ? (
        <>
          {showReconnected ? (
            <Signal className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <Wifi className="w-3.5 h-3.5" />
          )}
          {showDetails && (
            <span className="hidden sm:inline">
              {showReconnected ? 'Reconnected' : quality === 'excellent' ? 'Online' : quality}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          {showDetails && <span className="hidden sm:inline">Offline</span>}
        </>
      )}
    </div>
  );
}
