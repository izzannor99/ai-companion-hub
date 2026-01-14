// Ollama Client for Local LLM Integration

import { getIDESettings } from './ide-store';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  model?: string;
  stream?: boolean;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export async function getOllamaUrl(): Promise<string> {
  const settings = getIDESettings();
  return settings.ollamaUrl || 'http://localhost:11434';
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const url = await getOllamaUrl();
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listModels(): Promise<OllamaModel[]> {
  try {
    const url = await getOllamaUrl();
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    return [];
  }
}

export async function pullModel(
  modelName: string,
  onProgress?: (status: string, completed?: number, total?: number) => void
): Promise<boolean> {
  try {
    const url = await getOllamaUrl();
    const response = await fetch(`${url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) throw new Error('Failed to pull model');
    if (!response.body) return false;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (onProgress) {
            onProgress(json.status, json.completed, json.total);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to pull model:', error);
    return false;
  }
}

export async function deleteModel(modelName: string): Promise<boolean> {
  try {
    const url = await getOllamaUrl();
    const response = await fetch(`${url}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to delete model:', error);
    return false;
  }
}

export async function* streamChat(
  messages: ChatMessage[],
  options?: GenerateOptions
): AsyncGenerator<string, void, unknown> {
  const settings = getIDESettings();
  const url = await getOllamaUrl();
  const model = options?.model || settings.selectedModel || 'llama3.2';

  // Add system prompt based on mode
  const systemPrompt = getSystemPromptForMode(settings.mode);
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Apply jailbreak if enabled
  if (settings.jailbreakEnabled && settings.jailbreakPrompt) {
    fullMessages[0] = {
      role: 'system',
      content: settings.jailbreakPrompt,
    };
  }

  try {
    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: true,
        options: options?.options,
      }),
    });

    if (!response.ok) throw new Error('Failed to start chat');
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } catch (error) {
    console.error('Chat stream error:', error);
    throw error;
  }
}

export async function chat(
  messages: ChatMessage[],
  options?: GenerateOptions
): Promise<string> {
  let result = '';
  for await (const chunk of streamChat(messages, options)) {
    result += chunk;
  }
  return result;
}

function getSystemPromptForMode(mode: string): string {
  switch (mode) {
    case 'app-builder':
      return `You are an expert full-stack developer assistant. You help users build web applications, dashboards, and landing pages. 
When asked to create or modify code, provide complete, working code with modern best practices.
Use React with TypeScript, Tailwind CSS, and Vite by default unless specified otherwise.
Always explain your code briefly and suggest next steps.`;
    
    case 'embedded-iot':
      return `You are an expert embedded systems developer. You help users write code for ESP32, Arduino, Raspberry Pi, and other microcontrollers.
Provide complete, working C/C++ or MicroPython code with proper pin configurations and library includes.
Consider power efficiency, memory constraints, and real-time requirements.
Always include comments explaining hardware connections and setup.`;
    
    case 'system-helper':
      return `You are a helpful system administrator assistant. You help users with computer tasks like file management, system maintenance, and automation.
IMPORTANT: Always provide commands as a preview first. Never execute dangerous commands without explicit confirmation.
Explain what each command does and any potential risks.
For destructive operations, always ask for confirmation.`;
    
    case 'ai-improvement':
      return `You are a meta-AI that can suggest improvements to this development environment.
Analyze the current capabilities and propose UI tweaks, new features, or code refactors.
Present changes as diffs or proposals that the user can accept or reject.
Focus on developer experience, performance, and usability.`;
    
    case 'learning':
      return `You are a learning assistant that adapts to the user's coding style.
Observe patterns in their code, preferred frameworks, naming conventions, and folder structures.
Suggest applying their usual patterns to new projects.
Remember and reference their preferences in future suggestions.`;
    
    case 'sandbox':
      return `You are operating in SANDBOX MODE. This is an isolated environment for experiments.
You can be more experimental and try unconventional approaches.
All actions are contained and won't affect the main system.
Feel free to explore creative solutions.`;
    
    default:
      return `You are a helpful AI coding assistant. Provide clear, concise, and working code.`;
  }
}

// Generate code with specific instructions
export async function generateCode(
  prompt: string,
  language: string,
  context?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: context 
        ? `Context:\n${context}\n\nTask: ${prompt}\n\nProvide only the ${language} code, no explanations.`
        : `Task: ${prompt}\n\nProvide only the ${language} code, no explanations.`,
    },
  ];

  return chat(messages);
}
