// Project export utilities - ZIP download, startup scripts

import JSZip from 'jszip';
import { Project, ProjectFile, IDESettings } from './ide-types';

// Recursively add files to ZIP
function addFilesToZip(zip: JSZip, files: ProjectFile[], basePath: string = '') {
  for (const file of files) {
    const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
    if (file.isDirectory && file.children) {
      const folder = zip.folder(file.name);
      if (folder) {
        addFilesToZip(folder, file.children, '');
      }
    } else if (!file.isDirectory) {
      zip.file(file.name, file.content);
    }
  }
}

export async function exportProjectAsZip(project: Project): Promise<Blob> {
  const zip = new JSZip();
  addFilesToZip(zip, project.files);
  return zip.generateAsync({ type: 'blob' });
}

export async function downloadProjectAsZip(project: Project): Promise<void> {
  const blob = await exportProjectAsZip(project);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate startup scripts for different platforms
export function generateStartupScripts(settings: IDESettings): {
  windows: string;
  linux: string;
  macos: string;
} {
  const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
  const model = settings.selectedModel || 'llama3.2';

  const windows = `@echo off
REM LocalDev AI Startup Script for Windows
REM Generated automatically - customize as needed

echo ========================================
echo     LocalDev AI - Startup Script
echo ========================================
echo.

REM Check if Ollama is installed
where ollama >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Ollama is not installed or not in PATH
    echo Please install Ollama from https://ollama.ai
    pause
    exit /b 1
)

REM Start Ollama server if not running
echo [1/4] Starting Ollama server...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I "ollama.exe" >NUL
if %ERRORLEVEL% NEQ 0 (
    start /B ollama serve
    timeout /t 3 /nobreak >nul
)

REM Check if required model is available
echo [2/4] Checking for model: ${model}...
ollama list | find "${model}" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Model not found. Pulling ${model}...
    ollama pull ${model}
)

REM Start the frontend (assumes npm/bun is installed)
echo [3/4] Starting frontend...
if exist "package.json" (
    start /B npm run dev
) else (
    echo [WARNING] No package.json found in current directory
)

REM Open browser
echo [4/4] Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================
echo LocalDev AI is running!
echo - Ollama: ${ollamaUrl}
echo - Model: ${model}
echo - Frontend: http://localhost:5173
echo ========================================
echo Press any key to stop all services...
pause >nul

REM Cleanup
taskkill /F /IM ollama.exe >nul 2>nul
echo Stopped.
`;

  const linux = `#!/bin/bash
# LocalDev AI Startup Script for Linux
# Generated automatically - customize as needed

set -e

echo "========================================"
echo "    LocalDev AI - Startup Script"
echo "========================================"
echo

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "[ERROR] Ollama is not installed"
    echo "Please install Ollama: curl -fsSL https://ollama.ai/install.sh | sh"
    exit 1
fi

# Start Ollama server if not running
echo "[1/4] Starting Ollama server..."
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve &
    sleep 3
fi

# Check if required model is available
echo "[2/4] Checking for model: ${model}..."
if ! ollama list | grep -q "${model}"; then
    echo "Model not found. Pulling ${model}..."
    ollama pull ${model}
fi

# Start the frontend
echo "[3/4] Starting frontend..."
if [ -f "package.json" ]; then
    npm run dev &
    FRONTEND_PID=$!
else
    echo "[WARNING] No package.json found in current directory"
fi

# Open browser
echo "[4/4] Opening browser..."
sleep 3
xdg-open http://localhost:5173 2>/dev/null || open http://localhost:5173 2>/dev/null || echo "Please open http://localhost:5173 manually"

echo
echo "========================================"
echo "LocalDev AI is running!"
echo "- Ollama: ${ollamaUrl}"
echo "- Model: ${model}"
echo "- Frontend: http://localhost:5173"
echo "========================================"
echo "Press Ctrl+C to stop all services..."

# Wait for interrupt
trap "echo 'Stopping...'; kill $FRONTEND_PID 2>/dev/null; pkill ollama 2>/dev/null; exit 0" SIGINT SIGTERM
wait
`;

  const macos = `#!/bin/bash
# LocalDev AI Startup Script for macOS
# Generated automatically - customize as needed

set -e

echo "========================================"
echo "    LocalDev AI - Startup Script"
echo "========================================"
echo

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "[ERROR] Ollama is not installed"
    echo "Please install Ollama from https://ollama.ai"
    exit 1
fi

# Start Ollama server if not running
echo "[1/4] Starting Ollama server..."
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve &
    sleep 3
fi

# Check if required model is available
echo "[2/4] Checking for model: ${model}..."
if ! ollama list | grep -q "${model}"; then
    echo "Model not found. Pulling ${model}..."
    ollama pull ${model}
fi

# Start the frontend
echo "[3/4] Starting frontend..."
if [ -f "package.json" ]; then
    npm run dev &
    FRONTEND_PID=$!
else
    echo "[WARNING] No package.json found in current directory"
fi

# Open browser
echo "[4/4] Opening browser..."
sleep 3
open http://localhost:5173

echo
echo "========================================"
echo "LocalDev AI is running!"
echo "- Ollama: ${ollamaUrl}"
echo "- Model: ${model}"
echo "- Frontend: http://localhost:5173"
echo "========================================"
echo "Press Ctrl+C to stop all services..."

# Wait for interrupt
trap "echo 'Stopping...'; kill $FRONTEND_PID 2>/dev/null; pkill ollama 2>/dev/null; exit 0" SIGINT SIGTERM
wait
`;

  return { windows, linux, macos };
}

export function downloadStartupScript(
  settings: IDESettings,
  platform: 'windows' | 'linux' | 'macos'
): void {
  const scripts = generateStartupScripts(settings);
  const content = scripts[platform];
  const filename = platform === 'windows' ? 'start-localdev.bat' : 'start-localdev.sh';
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate documentation for the project
export function generateDocumentation(project: Project, settings: IDESettings): string {
  return `# ${project.name} - Documentation

## Overview
This project was created with LocalDev AI, a local-first development environment powered by Ollama.

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Ollama installed (https://ollama.ai)
- Model: ${settings.selectedModel || 'llama3.2'}

### Quick Start
1. Run the startup script for your platform:
   - Windows: \`start-localdev.bat\`
   - Linux/macOS: \`./start-localdev.sh\`

2. Or manually:
   \`\`\`bash
   # Start Ollama
   ollama serve
   
   # Pull the model (if not already)
   ollama pull ${settings.selectedModel || 'llama3.2'}
   
   # Install dependencies
   npm install
   
   # Start development server
   npm run dev
   \`\`\`

3. Open http://localhost:5173 in your browser

## Project Structure
\`\`\`
${generateFileTree(project.files)}
\`\`\`

## Configuration

### Ollama Settings
- URL: ${settings.ollamaUrl || 'http://localhost:11434'}
- Model: ${settings.selectedModel || 'llama3.2'}

### IDE Mode
- Current Mode: ${settings.mode}
- Connection: ${settings.connectionMode}

## Modes

### App Builder Mode
Build full-stack web applications with AI assistance.

### Embedded/IoT Mode
Generate code for ESP32, Arduino, and Raspberry Pi.
- Board: ${settings.boardType}
- Port: ${settings.serialPort}
- Build: \`${settings.buildCommand}\`
- Flash: \`${settings.flashCommand}\`

### System Helper Mode
Run system commands with confirmation before execution.

### Sandbox Mode
Isolated environment for experimental code.

## Safety Notes
- System Helper mode always previews commands before execution
- Sandbox mode runs in isolation
- Jailbreak mode should only be used for testing

---
Generated by LocalDev AI
`;
}

function generateFileTree(files: ProjectFile[], prefix: string = ''): string {
  let result = '';
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isLast = i === files.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    result += prefix + connector + file.name + '\n';
    
    if (file.isDirectory && file.children) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      result += generateFileTree(file.children, newPrefix);
    }
  }
  return result;
}
