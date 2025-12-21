import { useState, useRef } from 'react';
import { FileUp, Folder, Check, X, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LocalModelPickerProps {
  onModelSelected?: (file: File) => void;
  className?: string;
}

interface SelectedModel {
  name: string;
  size: string;
  file: File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function LocalModelPicker({ onModelSelected, className }: LocalModelPickerProps) {
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.gguf')) {
      toast.error('Please select a GGUF model file');
      return;
    }

    const model: SelectedModel = {
      name: file.name,
      size: formatFileSize(file.size),
      file,
    };

    setSelectedModel(model);
    onModelSelected?.(file);
    toast.success(`Model selected: ${file.name}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const clearSelection = () => {
    setSelectedModel(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".gguf"
        onChange={handleInputChange}
        className="hidden"
      />

      {selectedModel ? (
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedModel.name}</p>
              <p className="text-xs text-muted-foreground">{selectedModel.size}</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-accent" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={clearSelection}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'relative p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer',
            'hover:border-primary/50 hover:bg-primary/5',
            isDragging 
              ? 'border-primary bg-primary/10' 
              : 'border-border bg-muted/30'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
              isDragging ? 'bg-primary/20' : 'bg-muted'
            )}>
              {isDragging ? (
                <FileUp className="w-6 h-6 text-primary animate-bounce" />
              ) : (
                <Folder className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {isDragging ? 'Drop your model here' : 'Select a local GGUF model'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag and drop or click to browse
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Load a GGUF model file from your computer. The model runs locally in llama.cpp or similar.
      </p>
    </div>
  );
}
