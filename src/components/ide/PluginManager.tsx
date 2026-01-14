import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plugin, PluginCommand } from '@/lib/ide-types';
import { getPlugins, savePlugin, deletePlugin, generateId } from '@/lib/ide-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Plug, Trash2, Edit2, Play, Settings, Code } from 'lucide-react';
import { toast } from 'sonner';

interface PluginManagerProps {
  plugins: Plugin[];
  onPluginsChange: (plugins: Plugin[]) => void;
  className?: string;
}

export function PluginManager({ plugins, onPluginsChange, className }: PluginManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [newPlugin, setNewPlugin] = useState<Partial<Plugin>>({
    name: '',
    description: '',
    commands: [],
  });
  const [newCommand, setNewCommand] = useState<Partial<PluginCommand>>({
    name: '',
    description: '',
    endpoint: '',
    script: '',
  });

  const handleTogglePlugin = (plugin: Plugin) => {
    const updated = { ...plugin, enabled: !plugin.enabled };
    savePlugin(updated);
    onPluginsChange(plugins.map(p => p.id === plugin.id ? updated : p));
    toast.success(`${plugin.name} ${updated.enabled ? 'enabled' : 'disabled'}`);
  };

  const handleDeletePlugin = (pluginId: string) => {
    deletePlugin(pluginId);
    onPluginsChange(plugins.filter(p => p.id !== pluginId));
    toast.success('Plugin deleted');
  };

  const handleAddPlugin = () => {
    if (!newPlugin.name) {
      toast.error('Plugin name is required');
      return;
    }

    const plugin: Plugin = {
      id: generateId(),
      name: newPlugin.name,
      description: newPlugin.description || '',
      enabled: true,
      commands: newPlugin.commands || [],
    };

    savePlugin(plugin);
    onPluginsChange([...plugins, plugin]);
    setNewPlugin({ name: '', description: '', commands: [] });
    setShowAddDialog(false);
    toast.success('Plugin added');
  };

  const handleAddCommand = () => {
    if (!newCommand.name) return;
    
    const command: PluginCommand = {
      name: newCommand.name,
      description: newCommand.description || '',
      endpoint: newCommand.endpoint,
      script: newCommand.script,
    };

    setNewPlugin(prev => ({
      ...prev,
      commands: [...(prev.commands || []), command],
    }));

    setNewCommand({ name: '', description: '', endpoint: '', script: '' });
  };

  const handleRunCommand = async (plugin: Plugin, command: PluginCommand) => {
    toast.info(`Running ${command.name}...`);
    
    // In a real implementation, this would execute the command
    if (command.endpoint) {
      try {
        const response = await fetch(command.endpoint);
        const data = await response.json();
        toast.success(`${command.name} completed`, {
          description: JSON.stringify(data).substring(0, 100),
        });
      } catch (error) {
        toast.error(`${command.name} failed`, {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else if (command.script) {
      // Would execute script via local agent
      toast.info('Script execution requires local agent');
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Plugins</h2>
          <Badge variant="secondary">{plugins.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Plugin
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {plugins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No plugins installed</p>
              <p className="text-sm mt-1">Add plugins to extend functionality</p>
            </div>
          ) : (
            plugins.map((plugin) => (
              <Card key={plugin.id} className={cn(!plugin.enabled && 'opacity-60')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{plugin.name}</CardTitle>
                      <CardDescription>{plugin.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={plugin.enabled}
                        onCheckedChange={() => handleTogglePlugin(plugin)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingPlugin(plugin)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeletePlugin(plugin.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {plugin.commands.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Commands</Label>
                      <div className="flex flex-wrap gap-2">
                        {plugin.commands.map((cmd, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={!plugin.enabled}
                            onClick={() => handleRunCommand(plugin, cmd)}
                          >
                            <Play className="h-3 w-3" />
                            {cmd.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add Plugin Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Plugin</DialogTitle>
            <DialogDescription>
              Create a custom plugin with commands or API endpoints
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={newPlugin.name}
                onChange={(e) => setNewPlugin({ ...newPlugin, name: e.target.value })}
                placeholder="My Plugin"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={newPlugin.description}
                onChange={(e) => setNewPlugin({ ...newPlugin, description: e.target.value })}
                placeholder="What does this plugin do?"
              />
            </div>

            {/* Commands */}
            <div className="space-y-2">
              <Label>Commands</Label>
              {(newPlugin.commands || []).map((cmd, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                  <Code className="h-4 w-4" />
                  <span>{cmd.name}</span>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Command name"
                  value={newCommand.name}
                  onChange={(e) => setNewCommand({ ...newCommand, name: e.target.value })}
                />
                <Input
                  placeholder="API endpoint (optional)"
                  value={newCommand.endpoint}
                  onChange={(e) => setNewCommand({ ...newCommand, endpoint: e.target.value })}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleAddCommand}>
                <Plus className="h-4 w-4 mr-1" />
                Add Command
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPlugin}>Create Plugin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
