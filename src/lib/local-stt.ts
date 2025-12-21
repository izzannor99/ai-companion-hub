// Local Speech-to-Text using Hugging Face Transformers (Whisper)
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = true;
env.useBrowserCache = true;

export interface WhisperModel {
  id: string;
  name: string;
  size: string;
  description: string;
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: 'onnx-community/whisper-tiny.en',
    name: 'Whisper Tiny (English)',
    size: '~40MB',
    description: 'Fastest, English only. Best for quick transcription.',
  },
  {
    id: 'onnx-community/whisper-base.en',
    name: 'Whisper Base (English)',
    size: '~75MB',
    description: 'Good balance of speed and accuracy for English.',
  },
  {
    id: 'onnx-community/whisper-small.en',
    name: 'Whisper Small (English)',
    size: '~250MB',
    description: 'Higher accuracy, slower. English only.',
  },
  {
    id: 'onnx-community/whisper-tiny',
    name: 'Whisper Tiny (Multilingual)',
    size: '~40MB',
    description: 'Fastest multilingual model. Supports 99+ languages.',
  },
  {
    id: 'onnx-community/whisper-base',
    name: 'Whisper Base (Multilingual)',
    size: '~75MB',
    description: 'Good multilingual support with reasonable speed.',
  },
];

export const DEFAULT_WHISPER_MODEL = 'onnx-community/whisper-tiny.en';

// Storage key for persisted model choice
const WHISPER_MODEL_KEY = 'whisper-model';
const WHISPER_DOWNLOADED_KEY = 'whisper-downloaded-models';

export function getSelectedWhisperModel(): string {
  if (typeof window === 'undefined') return DEFAULT_WHISPER_MODEL;
  return localStorage.getItem(WHISPER_MODEL_KEY) || DEFAULT_WHISPER_MODEL;
}

export function setSelectedWhisperModel(modelId: string): void {
  localStorage.setItem(WHISPER_MODEL_KEY, modelId);
}

export function getDownloadedModels(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(WHISPER_DOWNLOADED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function markModelAsDownloaded(modelId: string): void {
  const downloaded = getDownloadedModels();
  if (!downloaded.includes(modelId)) {
    downloaded.push(modelId);
    localStorage.setItem(WHISPER_DOWNLOADED_KEY, JSON.stringify(downloaded));
  }
}

// Singleton transcriber instance
let transcriber: any = null;
let currentModelId: string | null = null;

export interface TranscriptionProgress {
  status: 'loading' | 'downloading' | 'ready' | 'transcribing' | 'error';
  progress?: number;
  message?: string;
}

export type ProgressCallback = (progress: TranscriptionProgress) => void;

export async function loadWhisperModel(
  modelId: string = getSelectedWhisperModel(),
  onProgress?: ProgressCallback,
  useWebGPU: boolean = true
): Promise<boolean> {
  // If already loaded with the same model, skip
  if (transcriber && currentModelId === modelId) {
    onProgress?.({ status: 'ready', message: 'Model already loaded' });
    return true;
  }

  try {
    onProgress?.({ status: 'downloading', progress: 0, message: 'Loading model...' });

    // Determine device - try WebGPU first, fall back to WASM
    let device: 'webgpu' | 'wasm' = 'wasm';
    if (useWebGPU && 'gpu' in navigator) {
      try {
        const gpu = await (navigator as any).gpu?.requestAdapter();
        if (gpu) {
          device = 'webgpu';
        }
      } catch {
        console.log('WebGPU not available, using WASM');
      }
    }

    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      device,
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          onProgress?.({
            status: 'downloading',
            progress: pct,
            message: `Downloading: ${pct}%`,
          });
        }
      },
    });

    currentModelId = modelId;
    markModelAsDownloaded(modelId);
    onProgress?.({ status: 'ready', message: 'Model ready!' });
    return true;
  } catch (error) {
    console.error('Failed to load Whisper model:', error);
    onProgress?.({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load model',
    });
    return false;
  }
}

export async function transcribeAudio(
  audioData: Float32Array | Blob | string,
  onProgress?: ProgressCallback
): Promise<string> {
  if (!transcriber) {
    throw new Error('Whisper model not loaded. Call loadWhisperModel first.');
  }

  onProgress?.({ status: 'transcribing', message: 'Transcribing...' });

  try {
    const result = await transcriber(audioData);
    onProgress?.({ status: 'ready', message: 'Done!' });
    return result.text || '';
  } catch (error) {
    console.error('Transcription error:', error);
    onProgress?.({
      status: 'error',
      message: error instanceof Error ? error.message : 'Transcription failed',
    });
    throw error;
  }
}

export function isWhisperLoaded(): boolean {
  return transcriber !== null;
}

export function unloadWhisper(): void {
  transcriber = null;
  currentModelId = null;
}

// Check if WebGPU is supported
export async function isWebGPUSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu?.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}
