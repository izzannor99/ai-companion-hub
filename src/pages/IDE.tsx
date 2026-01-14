import React, { useState, useEffect, useCallback } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree } from '@/components/ide/FileTree';
import { CodeEditor } from '@/components/ide/CodeEditor';
import { PreviewPane } from '@/components/ide/PreviewPane';
import { IDEChat } from '@/components/ide/IDEChat';
import { ConnectionIndicator } from '@/components/ide/ConnectionIndicator';
import { SystemCommandPanel } from '@/components/ide/SystemCommandPanel';
import { PluginManager } from '@/components/ide/PluginManager';
import { Terminal } from '@/components/ide/Terminal';
import { TTSControls } from '@/components/ide/TTSControls';
import { IDESettings as IDESettingsType, Project, ProjectFile, Plugin, DEFAULT_SETTINGS } from '@/lib/ide-types';
import { getIDESettings, saveIDESettings, getProjects, saveProject, createProject, generateId, getPlugins } from '@/lib/ide-store';
import { isOllamaRunning, streamChat, ChatMessage } from '@/lib/ollama-client';
import { SystemCommand, parseCommandFromAIResponse, executeCommand as executeSystemCommand } from '@/lib/system-commands';
import { downloadProjectAsZip, downloadStartupScript, generateDocumentation } from '@/lib/project-export';
import { checkAgentStatus, downloadAgentScript, startDevServer, stopDevServer, AgentStatus, onOutput } from '@/lib/local-backend-agent';
import { initTTS, speakAIResponse, getTTSSettings } from '@/lib/tts-engine';
import { Button } from '@/components/ui/button';
import { Settings, FolderPlus, Download, FileText, Play, Square, Terminal as TerminalIcon, Plug, Home, Bot, MonitorDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message extends ChatMessage {
  id: string;
  timestamp: number;
}

export default function IDE() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<IDESettingsType>(DEFAULT_SETTINGS);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [openFiles, setOpenFiles] = useState<ProjectFile[]>([]);
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ connected: false });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [systemCommands, setSystemCommands] = useState<SystemCommand[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'terminal' | 'commands' | 'plugins'>('preview');
  const [codeLibraryOpen, setCodeLibraryOpen] = useState(false);

  // Load settings, plugins, check connections, and init TTS
  useEffect(() => {
    setSettings(getIDESettings());
    setPlugins(getPlugins());
    initTTS();
    
    const checkConnections = async () => {
      const ollamaOk = await isOllamaRunning();
      setOllamaConnected(ollamaOk);
      
      const agent = await checkAgentStatus();
      setAgentStatus(agent);
    };
    
    checkConnections();
    const interval = setInterval(checkConnections, 10000);
    
    // Listen for agent output
    const unsubscribe = onOutput((output, isError) => {
      if (isError) {
        setErrors(prev => [...prev, output]);
      } else {
        setLogs(prev => [...prev, output]);
      }
    });
    
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  // Create default project if none exists
  useEffect(() => {
    const projects = getProjects();
    if (projects.length === 0) {
      const newProject = createProject('My App', 'react');
      saveProject(newProject);
      setProject(newProject);
    } else {
      setProject(projects[0]);
    }
  }, []);

  // Update right panel based on mode
  useEffect(() => {
    if (settings.mode === 'system-helper') {
      setRightPanelTab('commands');
    } else if (settings.mode === 'plugin') {
      setRightPanelTab('plugins');
    } else {
      setRightPanelTab('preview');
    }
  }, [settings.mode]);

  const handleSelectFile = useCallback((file: ProjectFile) => {
    if (!file.isDirectory) {
      setSelectedFile(file);
      if (!openFiles.find(f => f.path === file.path)) {
        setOpenFiles(prev => [...prev, file]);
      }
    }
  }, [openFiles]);

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== path));
    if (selectedFile?.path === path) {
      setSelectedFile(openFiles.find(f => f.path !== path) || null);
    }
  }, [openFiles, selectedFile]);

  const handleFileChange = useCallback((path: string, content: string) => {
    if (!project) return;
    const updateFile = (files: ProjectFile[]): ProjectFile[] => {
      return files.map(f => {
        if (f.path === path) return { ...f, content, isModified: true };
        if (f.children) return { ...f, children: updateFile(f.children) };
        return f;
      });
    };
    const updatedProject = { ...project, files: updateFile(project.files), updatedAt: Date.now() };
    setProject(updatedProject);
    saveProject(updatedProject);
    setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, content, isModified: true } : f));
    if (selectedFile?.path === path) setSelectedFile(prev => prev ? { ...prev, content, isModified: true } : null);
  }, [project, selectedFile]);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = { id: generateId(), role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent('');

    try {
      const chatMessages: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }));
      chatMessages.push({ role: 'user', content });
      
      let fullResponse = '';
      for await (const chunk of streamChat(chatMessages)) {
        fullResponse += chunk;
        setStreamingContent(fullResponse);
      }

      const assistantMessage: Message = { id: generateId(), role: 'assistant', content: fullResponse, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent('');

      // Speak response if TTS enabled
      const ttsSettings = getTTSSettings();
      if (ttsSettings.enabled) {
        speakAIResponse(fullResponse);
      }

      // Parse system commands if in system-helper mode
      if (settings.mode === 'system-helper') {
        const commands = parseCommandFromAIResponse(fullResponse);
        if (commands.length > 0) {
          setSystemCommands(prev => [...prev, ...commands]);
          setRightPanelTab('commands');
          toast.info(`${commands.length} command(s) need review`);
        }
      }
    } catch (error) {
      toast.error('Failed to get response. Check Ollama connection.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, settings.mode]);

  // System command handlers
  const handleApproveCommand = (id: string) => {
    setSystemCommands(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' as const } : c));
  };

  const handleRejectCommand = (id: string) => {
    setSystemCommands(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' as const } : c));
  };

  const handleExecuteCommand = async (id: string) => {
    setSystemCommands(prev => prev.map(c => c.id === id ? { ...c, status: 'running' as const } : c));
    
    const command = systemCommands.find(c => c.id === id);
    if (command) {
      const result = await executeSystemCommand(command);
      setSystemCommands(prev => prev.map(c => c.id === id ? result : c));
    }
  };

  const handleClearCommands = () => {
    setSystemCommands([]);
  };

  // Dev server controls
  const handleStartServer = async () => {
    setLogs(prev => [...prev, 'Starting dev server...']);
    
    const result = await startDevServer();
    if (result) {
      setIsServerRunning(true);
      setPreviewUrl(`http://localhost:${result.port}`);
      setLogs(prev => [...prev, `Dev server running on http://localhost:${result.port}`]);
      toast.success('Dev server started');
    } else {
      // Simulated mode
      setIsServerRunning(true);
      setPreviewUrl('http://localhost:5173');
      setLogs(prev => [...prev, '[Simulated] Dev server running on http://localhost:5173']);
      toast.info('Dev server started (simulated - run LocalDev Agent for real)');
    }
  };

  const handleStopServer = async () => {
    await stopDevServer();
    setIsServerRunning(false);
    setPreviewUrl(undefined);
    setLogs(prev => [...prev, 'Dev server stopped']);
    toast.success('Dev server stopped');
  };

  // Download handlers
  const handleDownloadZip = async () => {
    if (!project) return;
    try {
      await downloadProjectAsZip(project);
      toast.success('Project downloaded');
    } catch (error) {
      toast.error('Failed to download project');
    }
  };

  const handleDownloadStartupScript = (platform: 'windows' | 'linux' | 'macos') => {
    downloadStartupScript(settings, platform);
    toast.success(`Startup script for ${platform} downloaded`);
  };

  const handleDownloadDocs = () => {
    if (!project) return;
    const docs = generateDocumentation(project, settings);
    const blob = new Blob([docs], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Documentation downloaded');
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <Home className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold gradient-text">LocalDev AI</h1>
          <span className="text-sm text-muted-foreground">{project?.name || 'No Project'}</span>
          
          {/* Agent status */}
          <div className="flex items-center gap-1.5 text-xs">
            <Bot className="h-3.5 w-3.5" />
            <span className={agentStatus.connected ? 'text-green-500' : 'text-muted-foreground'}>
              {agentStatus.connected ? 'Agent Connected' : 'Agent Offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TTSControls compact />
          <ConnectionIndicator mode={settings.connectionMode} ollamaConnected={ollamaConnected} />
          
          {/* Download menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Download className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadZip}>
                <FileText className="h-4 w-4 mr-2" />
                Download as ZIP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadDocs}>
                <FileText className="h-4 w-4 mr-2" />
                Download Documentation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDownloadStartupScript('windows')}>
                <TerminalIcon className="h-4 w-4 mr-2" />
                Startup Script (Windows)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadStartupScript('linux')}>
                <TerminalIcon className="h-4 w-4 mr-2" />
                Startup Script (Linux)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadStartupScript('macos')}>
                <TerminalIcon className="h-4 w-4 mr-2" />
                Startup Script (macOS)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => downloadAgentScript('windows')}>
                <MonitorDown className="h-4 w-4 mr-2" />
                Download Agent (Windows)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAgentScript('linux')}>
                <MonitorDown className="h-4 w-4 mr-2" />
                Download Agent (Linux/macOS)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <IDEChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            streamingContent={streamingContent}
            mode={settings.mode}
            onOpenSettings={() => navigate('/settings')}
            onToggleCodeLibrary={() => setCodeLibraryOpen(!codeLibraryOpen)}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* Editor Panel */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
              <FileTree
                files={project?.files || []}
                selectedFile={selectedFile?.path}
                onSelectFile={handleSelectFile}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={75}>
              <CodeEditor
                file={selectedFile}
                openFiles={openFiles}
                onFileChange={handleFileChange}
                onCloseFile={handleCloseFile}
                onSelectFile={handleSelectFile}
                fontSize={settings.fontSize}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* Right Panel - Preview/Commands/Plugins */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="h-full flex flex-col">
            <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)} className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-card px-2">
                <TabsTrigger value="preview" className="gap-1">
                  <Play className="h-3 w-3" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="terminal" className="gap-1">
                  <TerminalIcon className="h-3 w-3" />
                  Terminal
                </TabsTrigger>
                <TabsTrigger value="commands" className="gap-1">
                  <TerminalIcon className="h-3 w-3" />
                  Commands
                  {systemCommands.filter(c => c.status === 'pending').length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                      {systemCommands.filter(c => c.status === 'pending').length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="plugins" className="gap-1">
                  <Plug className="h-3 w-3" />
                  Plugins
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="flex-1 m-0">
                <PreviewPane
                  previewUrl={previewUrl}
                  isServerRunning={isServerRunning}
                  logs={logs}
                  errors={errors}
                  onRefresh={() => {}}
                  onStartServer={handleStartServer}
                  onStopServer={handleStopServer}
                />
              </TabsContent>
              
              <TabsContent value="terminal" className="flex-1 m-0">
                <Terminal className="h-full" />
              </TabsContent>
              
              <TabsContent value="commands" className="flex-1 m-0">
                <SystemCommandPanel
                  commands={systemCommands}
                  onApprove={handleApproveCommand}
                  onReject={handleRejectCommand}
                  onExecute={handleExecuteCommand}
                  onClear={handleClearCommands}
                />
              </TabsContent>
              
              <TabsContent value="plugins" className="flex-1 m-0">
                <PluginManager
                  plugins={plugins}
                  onPluginsChange={setPlugins}
                />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
