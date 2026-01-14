import React, { useState, useEffect, useCallback } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { FileTree } from '@/components/ide/FileTree';
import { CodeEditor } from '@/components/ide/CodeEditor';
import { PreviewPane } from '@/components/ide/PreviewPane';
import { IDEChat } from '@/components/ide/IDEChat';
import { ConnectionIndicator } from '@/components/ide/ConnectionIndicator';
import { IDESettings as IDESettingsType, Project, ProjectFile, DEFAULT_SETTINGS } from '@/lib/ide-types';
import { getIDESettings, saveIDESettings, getProjects, saveProject, createProject, generateId } from '@/lib/ide-store';
import { isOllamaRunning, streamChat, ChatMessage } from '@/lib/ollama-client';
import { Button } from '@/components/ui/button';
import { Settings, FolderPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Load settings and check Ollama
  useEffect(() => {
    setSettings(getIDESettings());
    const checkOllama = async () => {
      const connected = await isOllamaRunning();
      setOllamaConnected(connected);
    };
    checkOllama();
    const interval = setInterval(checkOllama, 10000);
    return () => clearInterval(interval);
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
    } catch (error) {
      toast.error('Failed to get response. Check Ollama connection.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold gradient-text">LocalDev AI</h1>
          <span className="text-sm text-muted-foreground">{project?.name || 'No Project'}</span>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionIndicator mode={settings.connectionMode} ollamaConnected={ollamaConnected} />
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
            onToggleCodeLibrary={() => {}}
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
        
        {/* Preview Panel */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <PreviewPane
            isServerRunning={isServerRunning}
            logs={logs}
            errors={errors}
            onRefresh={() => {}}
            onStartServer={() => { setIsServerRunning(true); setLogs(['Starting dev server...']); }}
            onStopServer={() => setIsServerRunning(false)}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
