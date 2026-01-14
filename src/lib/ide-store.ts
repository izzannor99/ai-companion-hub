// IDE State Management using localStorage

import { IDESettings, Project, Plugin, DEFAULT_SETTINGS, ProjectFile } from './ide-types';

const SETTINGS_KEY = 'ide-settings';
const PROJECTS_KEY = 'ide-projects';
const CURRENT_PROJECT_KEY = 'ide-current-project';
const PLUGINS_KEY = 'ide-plugins';
const LEARNING_DATA_KEY = 'ide-learning-data';

// Settings
export function getIDESettings(): IDESettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load IDE settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveIDESettings(settings: Partial<IDESettings>): void {
  try {
    const current = getIDESettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
    window.dispatchEvent(new CustomEvent('ide-settings-changed', { detail: settings }));
  } catch (e) {
    console.error('Failed to save IDE settings:', e);
  }
}

// Projects
export function getProjects(): Project[] {
  try {
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
  return [];
}

export function saveProject(project: Project): void {
  try {
    const projects = getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    window.dispatchEvent(new CustomEvent('ide-projects-changed'));
  } catch (e) {
    console.error('Failed to save project:', e);
  }
}

export function deleteProject(projectId: string): void {
  try {
    const projects = getProjects().filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    window.dispatchEvent(new CustomEvent('ide-projects-changed'));
  } catch (e) {
    console.error('Failed to delete project:', e);
  }
}

export function getCurrentProjectId(): string | null {
  return localStorage.getItem(CURRENT_PROJECT_KEY);
}

export function setCurrentProjectId(projectId: string | null): void {
  if (projectId) {
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
  } else {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
  window.dispatchEvent(new CustomEvent('ide-current-project-changed'));
}

// Plugins
export function getPlugins(): Plugin[] {
  try {
    const stored = localStorage.getItem(PLUGINS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load plugins:', e);
  }
  return [];
}

export function savePlugin(plugin: Plugin): void {
  try {
    const plugins = getPlugins();
    const index = plugins.findIndex(p => p.id === plugin.id);
    if (index >= 0) {
      plugins[index] = plugin;
    } else {
      plugins.push(plugin);
    }
    localStorage.setItem(PLUGINS_KEY, JSON.stringify(plugins));
    window.dispatchEvent(new CustomEvent('ide-plugins-changed'));
  } catch (e) {
    console.error('Failed to save plugin:', e);
  }
}

export function deletePlugin(pluginId: string): void {
  try {
    const plugins = getPlugins().filter(p => p.id !== pluginId);
    localStorage.setItem(PLUGINS_KEY, JSON.stringify(plugins));
    window.dispatchEvent(new CustomEvent('ide-plugins-changed'));
  } catch (e) {
    console.error('Failed to delete plugin:', e);
  }
}

// Learning Data
export interface LearningData {
  codingPatterns: string[];
  preferredLibraries: string[];
  namingExamples: Record<string, string>;
  folderStructures: string[];
  commonPrompts: string[];
}

export function getLearningData(): LearningData {
  try {
    const stored = localStorage.getItem(LEARNING_DATA_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load learning data:', e);
  }
  return {
    codingPatterns: [],
    preferredLibraries: [],
    namingExamples: {},
    folderStructures: [],
    commonPrompts: [],
  };
}

export function saveLearningData(data: Partial<LearningData>): void {
  try {
    const current = getLearningData();
    localStorage.setItem(LEARNING_DATA_KEY, JSON.stringify({ ...current, ...data }));
  } catch (e) {
    console.error('Failed to save learning data:', e);
  }
}

// Helper to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new project with default files based on framework
export function createProject(name: string, framework: Project['framework']): Project {
  const id = generateId();
  const now = Date.now();
  
  const files: ProjectFile[] = getDefaultFilesForFramework(framework);
  
  return {
    id,
    name,
    framework,
    files,
    createdAt: now,
    updatedAt: now,
  };
}

function getDefaultFilesForFramework(framework: Project['framework']): ProjectFile[] {
  switch (framework) {
    case 'react':
    case 'vite':
      return [
        {
          id: generateId(),
          name: 'src',
          path: '/src',
          content: '',
          language: '',
          isDirectory: true,
          children: [
            {
              id: generateId(),
              name: 'App.tsx',
              path: '/src/App.tsx',
              content: `import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your App</h1>
        <p className="text-gray-400">Start building something amazing!</p>
      </div>
    </div>
  );
}

export default App;`,
              language: 'typescript',
              isDirectory: false,
            },
            {
              id: generateId(),
              name: 'main.tsx',
              path: '/src/main.tsx',
              content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
              language: 'typescript',
              isDirectory: false,
            },
            {
              id: generateId(),
              name: 'index.css',
              path: '/src/index.css',
              content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
              language: 'css',
              isDirectory: false,
            },
          ],
        },
        {
          id: generateId(),
          name: 'index.html',
          path: '/index.html',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
          language: 'html',
          isDirectory: false,
        },
        {
          id: generateId(),
          name: 'package.json',
          path: '/package.json',
          content: JSON.stringify({
            name: 'my-app',
            version: '0.1.0',
            type: 'module',
            scripts: {
              dev: 'vite',
              build: 'vite build',
              preview: 'vite preview',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/react': '^18.2.0',
              '@types/react-dom': '^18.2.0',
              '@vitejs/plugin-react': '^4.0.0',
              typescript: '^5.0.0',
              vite: '^5.0.0',
              tailwindcss: '^3.4.0',
              autoprefixer: '^10.4.0',
              postcss: '^8.4.0',
            },
          }, null, 2),
          language: 'json',
          isDirectory: false,
        },
      ];
    case 'arduino':
    case 'esp32':
      return [
        {
          id: generateId(),
          name: 'src',
          path: '/src',
          content: '',
          language: '',
          isDirectory: true,
          children: [
            {
              id: generateId(),
              name: 'main.cpp',
              path: '/src/main.cpp',
              content: `#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  Serial.println("Hello from ${framework.toUpperCase()}!");
}

void loop() {
  // Your code here
  delay(1000);
}`,
              language: 'cpp',
              isDirectory: false,
            },
          ],
        },
        {
          id: generateId(),
          name: 'platformio.ini',
          path: '/platformio.ini',
          content: `[env:${framework}]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200`,
          language: 'ini',
          isDirectory: false,
        },
      ];
    case 'raspberrypi':
      return [
        {
          id: generateId(),
          name: 'main.py',
          path: '/main.py',
          content: `#!/usr/bin/env python3
"""
Raspberry Pi Project
"""

import time

def main():
    print("Hello from Raspberry Pi!")
    while True:
        # Your code here
        time.sleep(1)

if __name__ == "__main__":
    main()`,
          language: 'python',
          isDirectory: false,
        },
        {
          id: generateId(),
          name: 'requirements.txt',
          path: '/requirements.txt',
          content: `# Python dependencies
RPi.GPIO
gpiozero`,
          language: 'text',
          isDirectory: false,
        },
      ];
    default:
      return [];
  }
}
