import { Sparkles, Zap, Brain, Code } from 'lucide-react';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

const suggestions = [
  {
    icon: Code,
    title: 'Write code',
    prompt: 'Write a Python function to calculate fibonacci numbers',
  },
  {
    icon: Brain,
    title: 'Explain concept',
    prompt: 'Explain quantum computing in simple terms',
  },
  {
    icon: Sparkles,
    title: 'Creative writing',
    prompt: 'Write a short story about a robot learning to paint',
  },
  {
    icon: Zap,
    title: 'Brainstorm ideas',
    prompt: 'Give me 5 creative startup ideas for 2024',
  },
];

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 glow-primary">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      
      <h2 className="text-2xl font-semibold mb-2 gradient-text">
        Welcome to AraChat
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Your local AI assistant powered by Llama. Fast, private, and offline-capable.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
        {suggestions.map((s) => (
          <button
            key={s.title}
            onClick={() => onSuggestionClick(s.prompt)}
            className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-card/80 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <s.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="font-medium text-sm">{s.title}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                {s.prompt}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
