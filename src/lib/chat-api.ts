// Chat API abstraction supporting both cloud and local backends

export interface ChatSettings {
  backend: 'cloud' | 'local';
  localUrl: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  autoPlayTTS: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const DEFAULT_SETTINGS: ChatSettings = {
  backend: 'local',
  localUrl: 'http://127.0.0.1:8081',
  model: 'default',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  systemPrompt: 'You are AraChat, a helpful, harmless, and honest AI assistant. Be concise and clear in your responses.',
  autoPlayTTS: false,
};

export const AVAILABLE_MODELS = [
  { id: 'default', name: 'Default Model', backend: 'local' },
  { id: 'gemini-flash', name: 'Gemini 2.5 Flash', backend: 'cloud' },
  { id: 'gemini-pro', name: 'Gemini 2.5 Pro', backend: 'cloud' },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function sendChatMessage(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const allMessages = settings.systemPrompt 
    ? [{ role: 'system' as const, content: settings.systemPrompt }, ...messages]
    : messages;

  if (settings.backend === 'local') {
    return sendLocalMessage(allMessages, settings, onChunk);
  } else {
    return sendCloudMessage(allMessages, settings, onChunk);
  }
}

async function sendLocalMessage(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const response = await fetch(`${settings.localUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    throw new Error(`Local API error: ${response.status}`);
  }

  if (onChunk && response.body) {
    return streamResponse(response, onChunk);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function sendCloudMessage(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Cloud backend not configured. Please enable Lovable Cloud.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      messages,
      model: settings.model,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Cloud API error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  if (onChunk && response.body) {
    return streamResponse(response, onChunk);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function streamResponse(
  response: Response,
  onChunk: (chunk: string) => void
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  }

  return fullContent;
}

export function loadSettings(): ChatSettings {
  try {
    const saved = localStorage.getItem('arachat-settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: ChatSettings): void {
  localStorage.setItem('arachat-settings', JSON.stringify(settings));
}
