import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { SystemCommand } from '@/lib/system-commands';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Check, X, Play, Loader2, Terminal, Shield, Trash2, Network, Cpu, FolderOpen } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SystemCommandPanelProps {
  commands: SystemCommand[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
  onClear: () => void;
  className?: string;
}

const categoryIcons: Record<SystemCommand['category'], React.ReactNode> = {
  file: <FolderOpen className="h-4 w-4" />,
  system: <Cpu className="h-4 w-4" />,
  network: <Network className="h-4 w-4" />,
  process: <Terminal className="h-4 w-4" />,
  cleanup: <Trash2 className="h-4 w-4" />,
};

export function SystemCommandPanel({
  commands,
  onApprove,
  onReject,
  onExecute,
  onClear,
  className,
}: SystemCommandPanelProps) {
  const [confirmCommand, setConfirmCommand] = useState<SystemCommand | null>(null);

  const pendingCommands = commands.filter(c => c.status === 'pending');
  const executedCommands = commands.filter(c => c.status !== 'pending');

  const handleApprove = (command: SystemCommand) => {
    if (command.dangerous) {
      setConfirmCommand(command);
    } else {
      onApprove(command.id);
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-card', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">System Commands</h2>
          {pendingCommands.length > 0 && (
            <Badge variant="secondary">{pendingCommands.length} pending</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear All
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {commands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No commands to review</p>
              <p className="text-sm mt-1">
                System commands from AI will appear here for approval
              </p>
            </div>
          ) : (
            commands.map((command) => (
              <div
                key={command.id}
                className={cn(
                  'rounded-lg border p-4 space-y-3',
                  command.dangerous && command.status === 'pending' && 'border-amber-500/50 bg-amber-500/5',
                  command.status === 'completed' && 'border-green-500/50 bg-green-500/5',
                  command.status === 'failed' && 'border-red-500/50 bg-red-500/5',
                  command.status === 'rejected' && 'opacity-50'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {categoryIcons[command.category]}
                    <span className="text-sm font-medium">{command.description}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {command.dangerous && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Dangerous
                      </Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {command.status}
                    </Badge>
                  </div>
                </div>

                {/* Command preview */}
                <div className="bg-background rounded-md p-3 font-mono text-sm overflow-x-auto">
                  <code>{command.command}</code>
                </div>

                {/* Output */}
                {command.output && (
                  <div className="bg-muted/50 rounded-md p-3 text-sm font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                    {command.output}
                  </div>
                )}

                {/* Error */}
                {command.error && (
                  <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                    {command.error}
                  </div>
                )}

                {/* Actions */}
                {command.status === 'pending' && (
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => handleApprove(command)}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive"
                      onClick={() => onReject(command.id)}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {command.status === 'approved' && (
                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" className="gap-1" onClick={() => onExecute(command.id)}>
                      <Play className="h-4 w-4" />
                      Execute
                    </Button>
                  </div>
                )}

                {command.status === 'running' && (
                  <div className="flex items-center gap-2 pt-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Running...</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Dangerous command confirmation */}
      <AlertDialog open={!!confirmCommand} onOpenChange={() => setConfirmCommand(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Dangerous Command
            </AlertDialogTitle>
            <AlertDialogDescription>
              This command is potentially dangerous and could cause data loss or system issues.
              <div className="mt-4 p-3 bg-muted rounded-md font-mono text-sm">
                {confirmCommand?.command}
              </div>
              <p className="mt-4">Are you sure you want to approve this command?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600"
              onClick={() => {
                if (confirmCommand) {
                  onApprove(confirmCommand.id);
                  setConfirmCommand(null);
                }
              }}
            >
              I understand, approve it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
