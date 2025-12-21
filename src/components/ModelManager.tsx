import { useState, useEffect, useCallback } from 'react';
import { Download, ExternalLink, Trash2, Plus, HardDrive, RefreshCw, Search, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LocalModel {
  id: string;
  name: string;
  filename: string;
  size?: string;
  addedAt: number;
}

interface HFSearchResult {
  id: string;
  modelId: string;
  author: string;
  downloads: number;
  likes: number;
  siblings?: { rfilename: string }[];
}

interface GGUFFile {
  repo: string;
  filename: string;
  size?: string;
}

interface DownloadState {
  isDownloading: boolean;
  progress: number;
  filename: string;
}

interface ModelManagerProps {
  localUrl: string;
  onModelSelect?: (modelId: string) => void;
}

// Popular GGUF models from Hugging Face
const POPULAR_GGUF_MODELS = [
  {
    name: 'Llama 3.2 3B Instruct',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '2.0 GB',
    description: 'Fast, great for most tasks',
  },
  {
    name: 'Llama 3.1 8B Instruct',
    repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    size: '4.9 GB',
    description: 'Balanced performance',
  },
  {
    name: 'Mistral 7B Instruct v0.3',
    repo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    filename: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    size: '4.4 GB',
    description: 'Excellent reasoning',
  },
  {
    name: 'Phi-3.5 Mini Instruct',
    repo: 'bartowski/Phi-3.5-mini-instruct-GGUF',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    size: '2.3 GB',
    description: 'Microsoft, very capable',
  },
  {
    name: 'Qwen2.5 7B Instruct',
    repo: 'bartowski/Qwen2.5-7B-Instruct-GGUF',
    filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    size: '4.7 GB',
    description: 'Alibaba, multilingual',
  },
  {
    name: 'Gemma 2 9B Instruct',
    repo: 'bartowski/gemma-2-9b-it-GGUF',
    filename: 'gemma-2-9b-it-Q4_K_M.gguf',
    size: '5.8 GB',
    description: 'Google, high quality',
  },
  {
    name: 'DeepSeek Coder V2 Lite',
    repo: 'bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF',
    filename: 'DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf',
    size: '9.4 GB',
    description: 'Excellent for coding',
  },
  {
    name: 'TinyLlama 1.1B Chat',
    repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    size: '0.7 GB',
    description: 'Very fast, lightweight',
  },
];

const STORAGE_KEY = 'arachat-local-models';

export function ModelManager({ localUrl, onModelSelect }: ModelManagerProps) {
  const [savedModels, setSavedModels] = useState<LocalModel[]>([]);
  const [customRepo, setCustomRepo] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [serverModels, setServerModels] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GGUFFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoFiles, setRepoFiles] = useState<GGUFFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  
  // Download state
  const [downloadState, setDownloadState] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    filename: '',
  });

  // Load saved models from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSavedModels(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save models to localStorage
  const saveModels = (models: LocalModel[]) => {
    setSavedModels(models);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  };

  // Scan local server for models
  const scanServer = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`${localUrl}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        const models = data.data?.map((m: any) => m.id) || [];
        setServerModels(models);
        toast.success(`Found ${models.length} model(s) on server`);
      }
    } catch (err) {
      console.error('Failed to scan server:', err);
      toast.error('Could not connect to local server');
    }
    setIsScanning(false);
  };

  // Search Hugging Face for GGUF models
  const searchHuggingFace = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSelectedRepo(null);
    setRepoFiles([]);

    try {
      // Search HF API for GGUF models
      const response = await fetch(
        `https://huggingface.co/api/models?search=${encodeURIComponent(searchQuery)}&filter=gguf&sort=downloads&direction=-1&limit=20`
      );

      if (!response.ok) throw new Error('Search failed');

      const models: HFSearchResult[] = await response.json();

      // Extract repos that have GGUF files
      const ggufRepos = models.map((m) => ({
        repo: m.modelId || m.id,
        filename: '',
        size: `${m.downloads?.toLocaleString() || 0} downloads`,
      }));

      setSearchResults(ggufRepos);

      if (ggufRepos.length === 0) {
        toast.info('No GGUF models found. Try a different search term.');
      } else {
        toast.success(`Found ${ggufRepos.length} GGUF repositories`);
      }
    } catch (err) {
      console.error('HF search error:', err);
      toast.error('Failed to search Hugging Face');
    }

    setIsSearching(false);
  };

  // Fetch GGUF files from a specific repo
  const fetchRepoFiles = async (repo: string) => {
    setSelectedRepo(repo);
    setIsLoadingFiles(true);
    setRepoFiles([]);

    try {
      const response = await fetch(`https://huggingface.co/api/models/${repo}`);
      if (!response.ok) throw new Error('Failed to fetch repo');

      const data = await response.json();
      const siblings = data.siblings || [];

      // Filter for GGUF files
      const ggufFiles: GGUFFile[] = siblings
        .filter((s: { rfilename: string }) => s.rfilename.endsWith('.gguf'))
        .map((s: { rfilename: string }) => ({
          repo,
          filename: s.rfilename,
          size: undefined,
        }));

      setRepoFiles(ggufFiles);

      if (ggufFiles.length === 0) {
        toast.info('No GGUF files found in this repository');
      }
    } catch (err) {
      console.error('Failed to fetch repo files:', err);
      toast.error('Failed to load repository files');
    }

    setIsLoadingFiles(false);
  };

  const addCustomModel = () => {
    if (!customRepo || !customFilename) {
      toast.error('Please enter both repo and filename');
      return;
    }

    const newModel: LocalModel = {
      id: `${customRepo}/${customFilename}`,
      name: customFilename.replace('.gguf', ''),
      filename: customFilename,
      addedAt: Date.now(),
    };

    saveModels([...savedModels, newModel]);
    setCustomRepo('');
    setCustomFilename('');
    toast.success('Model added to your list');
  };

  const addFromSearch = (repo: string, filename: string) => {
    const newModel: LocalModel = {
      id: `${repo}/${filename}`,
      name: filename.replace('.gguf', ''),
      filename,
      addedAt: Date.now(),
    };

    if (savedModels.some((m) => m.id === newModel.id)) {
      toast.info('Model already in your list');
      return;
    }

    saveModels([...savedModels, newModel]);
    toast.success('Model added to your list');
  };

  const removeModel = (id: string) => {
    saveModels(savedModels.filter(m => m.id !== id));
    toast.success('Model removed');
  };

  const getDownloadUrl = (repo: string, filename: string) => {
    return `https://huggingface.co/${repo}/resolve/main/${filename}?download=true`;
  };

  const getRepoUrl = (repo: string) => {
    return `https://huggingface.co/${repo}`;
  };

  // Download file - opens HuggingFace download URL directly in new tab
  // This is the most reliable method as it bypasses CORS and lets HF handle the download
  const downloadFile = useCallback((repo: string, filename: string) => {
    const url = getDownloadUrl(repo, filename);
    
    // Add to saved models first
    addFromSearch(repo, filename);
    
    // Open the download URL in a new tab - HuggingFace will handle the download
    window.open(url, '_blank', 'noopener,noreferrer');
    
    toast.success(`Download page opened! Save the file and load it in llama.cpp.`, { duration: 5000 });
  }, [savedModels]);

  return (
    <div className="space-y-4">
      {/* Download Progress Indicator */}
      {downloadState.isDownloading && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Downloading: {downloadState.filename}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Check your browser's download manager for progress
          </p>
        </div>
      )}
      {/* Server Status */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Local Server</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={scanServer}
            disabled={isScanning}
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', isScanning && 'animate-spin')} />
            Scan
          </Button>
        </div>
        {serverModels.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            Loaded: {serverModels.join(', ')}
          </div>
        )}
      </div>

      {/* Search Hugging Face */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Search Hugging Face for GGUF Models</Label>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models (e.g., llama, mistral, phi)"
            className="bg-muted text-sm"
            onKeyDown={(e) => e.key === 'Enter' && searchHuggingFace()}
          />
          <Button
            variant="outline"
            onClick={searchHuggingFace}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <ScrollArea className="h-40 rounded-lg border border-border">
            <div className="p-2 space-y-1">
              {searchResults.map((result) => (
                <div
                  key={result.repo}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors',
                    selectedRepo === result.repo
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => fetchRepoFiles(result.repo)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.repo}</p>
                    <p className="text-xs text-muted-foreground">{result.size}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(getRepoUrl(result.repo), '_blank');
                    }}
                    title="View on Hugging Face"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Repo Files */}
        {selectedRepo && (
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">
              GGUF files in {selectedRepo}:
            </Label>
            {isLoadingFiles ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : repoFiles.length > 0 ? (
              <ScrollArea className="h-32 mt-1 rounded-lg border border-border">
                <div className="p-2 space-y-1">
                  {repoFiles.map((file) => (
                    <div
                      key={file.filename}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
                    >
                      <p className="text-xs font-mono truncate flex-1">{file.filename}</p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6"
                          onClick={() => addFromSearch(selectedRepo, file.filename)}
                          title="Add to list"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6"
                          onClick={() => downloadFile(selectedRepo!, file.filename)}
                          disabled={downloadState.isDownloading}
                          title="Download"
                        >
                          {downloadState.isDownloading && downloadState.filename === file.filename ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-xs text-muted-foreground p-2">No GGUF files found</p>
            )}
          </div>
        )}
      </div>

      {/* Popular Models */}
      <div>
        <Label className="text-sm font-medium">Popular GGUF Models</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Download these files and load them in llama.cpp
        </p>
        <ScrollArea className="h-40 rounded-lg border border-border">
          <div className="p-2 space-y-1">
            {POPULAR_GGUF_MODELS.map((model) => (
              <div
                key={model.repo + model.filename}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{model.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {model.description} • {model.size}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={() => window.open(getRepoUrl(model.repo), '_blank')}
                    title="View on Hugging Face"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={() => downloadFile(model.repo, model.filename)}
                    disabled={downloadState.isDownloading}
                    title="Download GGUF"
                  >
                    {downloadState.isDownloading && downloadState.filename === model.filename ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Add Custom Model */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Add Custom Model from Hugging Face</Label>
        <div className="flex gap-2">
          <Input
            value={customRepo}
            onChange={(e) => setCustomRepo(e.target.value)}
            placeholder="owner/repo-name"
            className="bg-muted text-sm"
          />
          <Input
            value={customFilename}
            onChange={(e) => setCustomFilename(e.target.value)}
            placeholder="model.gguf"
            className="bg-muted text-sm"
          />
          <Button variant="outline" size="icon" onClick={addCustomModel}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Find models at huggingface.co/models?library=gguf
        </p>
      </div>

      {/* Saved Models */}
      {savedModels.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Your Models</Label>
          <ScrollArea className="h-32 mt-2 rounded-lg border border-border">
            <div className="p-2 space-y-1">
              {savedModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{model.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{model.filename}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => {
                        const [repo] = model.id.split('/').slice(0, 2).join('/').split('/');
                        const fullRepo = model.id.replace(`/${model.filename}`, '');
                        window.open(getDownloadUrl(fullRepo, model.filename), '_blank');
                      }}
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-destructive"
                      onClick={() => removeModel(model.id)}
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Instructions */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">How to use GGUF models:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Download a GGUF file from the list above</li>
          <li>Run llama.cpp server with the model:</li>
        </ol>
        <code className="block p-2 rounded bg-background font-mono text-[10px] break-all">
          ./llama-server -m your-model.gguf --port 8081
        </code>
        <p>Then connect using the Local backend in AraChat.</p>
      </div>
    </div>
  );
}