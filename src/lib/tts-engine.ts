// Text-to-Speech Engine using browser SpeechSynthesis API
// Fully offline, no external services required

export interface TTSSettings {
  enabled: boolean;
  voice: string | null;
  rate: number; // 0.5 - 2
  pitch: number; // 0 - 2
  volume: number; // 0 - 1
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  enabled: false,
  voice: null,
  rate: 1,
  pitch: 1,
  volume: 1,
};

// Storage key
const TTS_SETTINGS_KEY = 'localdev-tts-settings';

// Current state
let currentUtterance: SpeechSynthesisUtterance | null = null;
let settings: TTSSettings = DEFAULT_TTS_SETTINGS;
let isInitialized = false;

// Initialize TTS and load settings
export function initTTS(): boolean {
  if (!isTTSSupported()) {
    return false;
  }
  
  // Load settings from storage
  const stored = localStorage.getItem(TTS_SETTINGS_KEY);
  if (stored) {
    try {
      settings = { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(stored) };
    } catch {
      settings = DEFAULT_TTS_SETTINGS;
    }
  }
  
  isInitialized = true;
  return true;
}

// Check if TTS is supported
export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

// Get available voices
export function getVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  return speechSynthesis.getVoices();
}

// Get voices async (needed because voices may load lazily)
export function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTTSSupported()) {
      resolve([]);
      return;
    }
    
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    
    // Wait for voices to load
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
    
    // Timeout fallback
    setTimeout(() => {
      resolve(speechSynthesis.getVoices());
    }, 1000);
  });
}

// Get current settings
export function getTTSSettings(): TTSSettings {
  return { ...settings };
}

// Save settings
export function saveTTSSettings(newSettings: Partial<TTSSettings>): void {
  settings = { ...settings, ...newSettings };
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings));
}

// Find voice by name
export function findVoice(name: string): SpeechSynthesisVoice | null {
  const voices = getVoices();
  return voices.find(v => v.name === name) || null;
}

// Get default/preferred voice
export function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = getVoices();
  
  // Try saved voice first
  if (settings.voice) {
    const saved = voices.find(v => v.name === settings.voice);
    if (saved) return saved;
  }
  
  // Prefer English voices
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  
  // Prefer local voices (not network-based)
  const localEnglish = englishVoices.filter(v => v.localService);
  if (localEnglish.length > 0) return localEnglish[0];
  
  // Any English voice
  if (englishVoices.length > 0) return englishVoices[0];
  
  // Default voice
  const defaultVoice = voices.find(v => v.default);
  if (defaultVoice) return defaultVoice;
  
  return voices[0] || null;
}

// Strip markdown and code blocks for cleaner TTS
function cleanTextForTTS(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' code block ')
    // Remove inline code
    .replace(/`[^`]+`/g, ' code ')
    // Remove markdown links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown formatting
    .replace(/[*_~#]+/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Speak text
export function speak(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
  }
): void {
  if (!isTTSSupported() || !settings.enabled) {
    return;
  }
  
  // Stop any current speech
  stop();
  
  const cleanText = cleanTextForTTS(text);
  if (!cleanText) return;
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  currentUtterance = utterance;
  
  // Apply settings
  const voice = getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  utterance.volume = settings.volume;
  
  // Event handlers
  utterance.onstart = () => {
    options?.onStart?.();
  };
  
  utterance.onend = () => {
    currentUtterance = null;
    options?.onEnd?.();
  };
  
  utterance.onerror = (event) => {
    currentUtterance = null;
    options?.onError?.(new Error(event.error));
  };
  
  speechSynthesis.speak(utterance);
}

// Speak AI response with chunking for better performance
export function speakAIResponse(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (!isTTSSupported() || !settings.enabled) {
    return;
  }
  
  const cleanText = cleanTextForTTS(text);
  if (!cleanText) return;
  
  // Split into sentences for better pacing
  const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
  
  let currentIndex = 0;
  let hasStarted = false;
  
  const speakNext = () => {
    if (currentIndex >= sentences.length) {
      options?.onEnd?.();
      return;
    }
    
    const sentence = sentences[currentIndex].trim();
    if (!sentence) {
      currentIndex++;
      speakNext();
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(sentence);
    currentUtterance = utterance;
    
    const voice = getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    
    utterance.onstart = () => {
      if (!hasStarted) {
        hasStarted = true;
        options?.onStart?.();
      }
    };
    
    utterance.onend = () => {
      currentIndex++;
      speakNext();
    };
    
    utterance.onerror = () => {
      currentIndex++;
      speakNext();
    };
    
    speechSynthesis.speak(utterance);
  };
  
  speakNext();
}

// Stop speaking
export function stop(): void {
  if (isTTSSupported()) {
    speechSynthesis.cancel();
    currentUtterance = null;
  }
}

// Pause speaking
export function pause(): void {
  if (isTTSSupported()) {
    speechSynthesis.pause();
  }
}

// Resume speaking
export function resume(): void {
  if (isTTSSupported()) {
    speechSynthesis.resume();
  }
}

// Check if currently speaking
export function isSpeaking(): boolean {
  return isTTSSupported() && speechSynthesis.speaking;
}

// Check if paused
export function isPaused(): boolean {
  return isTTSSupported() && speechSynthesis.paused;
}

// Toggle TTS on/off
export function toggleTTS(enabled?: boolean): boolean {
  const newEnabled = enabled ?? !settings.enabled;
  saveTTSSettings({ enabled: newEnabled });
  
  if (!newEnabled) {
    stop();
  }
  
  return newEnabled;
}
