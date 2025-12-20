// Chat API abstraction supporting cloud, local, and custom API providers

export interface APIKeys {
  openai: string;
  anthropic: string;
  google: string;
  huggingface: string;
}

export interface ChatSettings {
  backend: 'cloud' | 'local' | 'openai' | 'anthropic' | 'google' | 'huggingface';
  localUrl: string;
  model: string;
  huggingfaceModel: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  autoPlayTTS: boolean;
  ttsVoice: string;
  ttsRate: number;
  voiceConversation: boolean;
  apiKeys: APIKeys;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const DEFAULT_API_KEYS: APIKeys = {
  openai: '',
  anthropic: '',
  google: '',
  huggingface: '',
};

export const DEFAULT_SETTINGS: ChatSettings = {
  backend: 'local',
  localUrl: 'http://127.0.0.1:8081',
  model: 'default',
  huggingfaceModel: 'mistralai/Mistral-7B-Instruct-v0.2',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  systemPrompt: 'You are AraChat, a helpful, harmless, and honest AI assistant. Be concise and clear in your responses.',
  autoPlayTTS: false,
  ttsVoice: '',
  ttsRate: 1.0,
  voiceConversation: false,
  apiKeys: DEFAULT_API_KEYS,
};

export const AVAILABLE_MODELS = [
  { id: 'default', name: 'Default Model', backend: 'local' },
  { id: 'gemini-flash', name: 'Gemini 2.5 Flash', backend: 'cloud' },
  { id: 'gemini-pro', name: 'Gemini 2.5 Pro', backend: 'cloud' },
  // OpenAI models
  { id: 'gpt-4o', name: 'GPT-4o', backend: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', backend: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', backend: 'openai' },
  // Anthropic models
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', backend: 'anthropic' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', backend: 'anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', backend: 'anthropic' },
  // Google models
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', backend: 'google' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', backend: 'google' },
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

  switch (settings.backend) {
    case 'local':
      return sendLocalMessage(allMessages, settings, onChunk);
    case 'openai':
      return sendOpenAIMessage(allMessages, settings, onChunk);
    case 'anthropic':
      return sendAnthropicMessage(allMessages, settings, onChunk);
    case 'google':
      return sendGoogleMessage(allMessages, settings, onChunk);
    case 'huggingface':
      return sendHuggingFaceMessage(allMessages, settings, onChunk);
    case 'cloud':
    default:
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

// OpenAI API (direct client-side call with user's key)
async function sendOpenAIMessage(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const apiKey = settings.apiKeys.openai;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add your key in Settings → API Keys.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  if (onChunk && response.body) {
    return streamResponse(response, onChunk);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Anthropic API (direct client-side call with user's key)
async function sendAnthropicMessage(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const apiKey = settings.apiKeys.anthropic;
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Add your key in Settings → API Keys.');
  }

  // Extract system message if present
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: settings.maxTokens,
      system: systemMessage,
      messages: chatMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// Google AI API (direct client-side call with user's key)
async function sendGoogleMessage(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const apiKey = settings.apiKeys.google;
  if (!apiKey) {
    throw new Error('Google AI API key not configured. Add your key in Settings → API Keys.');
  }

  // Convert to Google AI format
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find(m => m.role === 'system')?.content;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: settings.temperature,
          topP: settings.topP,
          maxOutputTokens: settings.maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Hugging Face API (direct client-side call with user's key)
async function sendHuggingFaceMessage(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const apiKey = settings.apiKeys.huggingface;
  if (!apiKey) {
    throw new Error('Hugging Face API key not configured. Add your key in Settings → API Keys.');
  }

  const model = settings.huggingfaceModel || 'mistralai/Mistral-7B-Instruct-v0.2';

  const response = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Hugging Face API error: ${response.status}`);
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
