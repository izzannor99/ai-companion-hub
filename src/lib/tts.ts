// Text-to-Speech utility using browser's SpeechSynthesis API

export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, 'image: $1');
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}

export function findVoiceByName(name: string): SpeechSynthesisVoice | null {
  if (!name) return null;
  const voices = getAvailableVoices();
  return voices.find(v => v.name === name) || null;
}

export function speak(
  text: string, 
  options?: {
    voice?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onEnd?: () => void;
  }
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const cleanText = stripMarkdown(text);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  // Set voice if specified
  if (options?.voice) {
    const voice = findVoiceByName(options.voice);
    if (voice) {
      utterance.voice = voice;
    }
  }
  
  utterance.rate = options?.rate ?? 1.0;
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.volume = options?.volume ?? 1.0;
  
  if (options?.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }
  
  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
