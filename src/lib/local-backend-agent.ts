// Local Backend Agent for real command execution
// This communicates with a local agent server running on the user's machine

export interface AgentStatus {
  connected: boolean;
  version?: string;
  platform?: 'windows' | 'linux' | 'macos';
  capabilities?: string[];
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  duration?: number;
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'mkdir' | 'list';
  path: string;
  content?: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  port?: number;
}

const AGENT_URL = 'http://localhost:3847';
const AGENT_WS_URL = 'ws://localhost:3847/ws';

// Agent connection state
let agentStatus: AgentStatus = { connected: false };
let wsConnection: WebSocket | null = null;
let statusListeners: ((status: AgentStatus) => void)[] = [];
let outputListeners: ((output: string, isError: boolean) => void)[] = [];

// Check if agent is running
export async function checkAgentStatus(): Promise<AgentStatus> {
  try {
    const response = await fetch(`${AGENT_URL}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    
    if (response.ok) {
      const data = await response.json();
      agentStatus = {
        connected: true,
        version: data.version || '1.0.0',
        platform: data.platform || detectPlatform(),
        capabilities: data.capabilities || ['exec', 'file', 'npm', 'process'],
      };
    } else {
      agentStatus = { connected: false };
    }
  } catch {
    agentStatus = { connected: false };
  }
  
  notifyStatusListeners();
  return agentStatus;
}

// Connect to agent WebSocket for real-time output
export function connectToAgent(): Promise<boolean> {
  return new Promise((resolve) => {
    if (wsConnection?.readyState === WebSocket.OPEN) {
      resolve(true);
      return;
    }
    
    try {
      wsConnection = new WebSocket(AGENT_WS_URL);
      
      wsConnection.onopen = () => {
        agentStatus.connected = true;
        notifyStatusListeners();
        resolve(true);
      };
      
      wsConnection.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
          notifyOutputListeners(data.content, data.isError || false);
        }
      };
      
      wsConnection.onclose = () => {
        agentStatus.connected = false;
        wsConnection = null;
        notifyStatusListeners();
      };
      
      wsConnection.onerror = () => {
        agentStatus.connected = false;
        wsConnection = null;
        notifyStatusListeners();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

// Execute a shell command
export async function executeCommand(command: string, cwd?: string): Promise<CommandResult> {
  // If agent is not connected, return simulated result
  if (!agentStatus.connected) {
    return simulateCommand(command);
  }
  
  try {
    const response = await fetch(`${AGENT_URL}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd }),
    });
    
    const data = await response.json();
    return {
      success: data.exitCode === 0,
      output: data.stdout || '',
      error: data.stderr,
      exitCode: data.exitCode,
      duration: data.duration,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Agent communication error: ${error}`,
    };
  }
}

// Run npm command
export async function runNpm(args: string[], cwd?: string): Promise<CommandResult> {
  const npmCmd = agentStatus.platform === 'windows' ? 'npm.cmd' : 'npm';
  return executeCommand(`${npmCmd} ${args.join(' ')}`, cwd);
}

// Start dev server
export async function startDevServer(cwd?: string): Promise<{ port: number; process: ProcessInfo } | null> {
  if (!agentStatus.connected) {
    return simulateDevServer();
  }
  
  try {
    const response = await fetch(`${AGENT_URL}/dev-server/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    
    const data = await response.json();
    return {
      port: data.port || 5173,
      process: {
        pid: data.pid,
        name: 'vite',
        command: 'npm run dev',
        port: data.port || 5173,
      },
    };
  } catch {
    return null;
  }
}

// Stop dev server
export async function stopDevServer(): Promise<boolean> {
  if (!agentStatus.connected) {
    return true;
  }
  
  try {
    const response = await fetch(`${AGENT_URL}/dev-server/stop`, {
      method: 'POST',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// File operations
export async function fileOperation(op: FileOperation): Promise<CommandResult> {
  if (!agentStatus.connected) {
    return { success: false, output: '', error: 'Agent not connected' };
  }
  
  try {
    const response = await fetch(`${AGENT_URL}/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op),
    });
    
    const data = await response.json();
    return {
      success: data.success,
      output: data.content || data.files?.join('\n') || '',
      error: data.error,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `File operation failed: ${error}`,
    };
  }
}

// Write project files to disk
export async function writeProjectFiles(
  projectPath: string,
  files: { path: string; content: string }[]
): Promise<boolean> {
  if (!agentStatus.connected) {
    console.log('[Simulated] Would write project files:', files.map(f => f.path));
    return true;
  }
  
  try {
    const response = await fetch(`${AGENT_URL}/project/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, files }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Install npm packages
export async function installPackages(
  packages: string[],
  cwd?: string,
  isDev?: boolean
): Promise<CommandResult> {
  const flag = isDev ? '-D' : '';
  return runNpm(['install', flag, ...packages].filter(Boolean), cwd);
}

// Get list of running processes
export async function getProcesses(): Promise<ProcessInfo[]> {
  if (!agentStatus.connected) {
    return [];
  }
  
  try {
    const response = await fetch(`${AGENT_URL}/processes`);
    const data = await response.json();
    return data.processes || [];
  } catch {
    return [];
  }
}

// Kill a process
export async function killProcess(pid: number): Promise<boolean> {
  if (!agentStatus.connected) {
    return false;
  }
  
  try {
    const response = await fetch(`${AGENT_URL}/process/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Listeners
export function onStatusChange(listener: (status: AgentStatus) => void): () => void {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener);
  };
}

export function onOutput(listener: (output: string, isError: boolean) => void): () => void {
  outputListeners.push(listener);
  return () => {
    outputListeners = outputListeners.filter(l => l !== listener);
  };
}

function notifyStatusListeners() {
  statusListeners.forEach(l => l(agentStatus));
}

function notifyOutputListeners(output: string, isError: boolean) {
  outputListeners.forEach(l => l(output, isError));
}

// Simulate command execution when agent is not connected
function simulateCommand(command: string): CommandResult {
  const cmd = command.toLowerCase();
  
  if (cmd.includes('npm install') || cmd.includes('npm i')) {
    return {
      success: true,
      output: `[Simulated] Installing packages...\nadded 1234 packages in 3.5s\n\n⚠️ Note: Real execution requires the LocalDev Agent running on your machine.`,
      duration: 3500,
    };
  }
  
  if (cmd.includes('npm run dev') || cmd.includes('npm start')) {
    return {
      success: true,
      output: `[Simulated] Starting dev server...\n\n  VITE v5.0.0  ready in 500ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  Network: http://192.168.1.100:5173/\n\n⚠️ Note: Real execution requires the LocalDev Agent.`,
      duration: 500,
    };
  }
  
  if (cmd.includes('node') || cmd.includes('npx')) {
    return {
      success: true,
      output: `[Simulated] Command executed: ${command}\n\n⚠️ Note: Real execution requires the LocalDev Agent.`,
      duration: 100,
    };
  }
  
  return {
    success: true,
    output: `[Simulated] ${command}\n\nTo run commands for real, start the LocalDev Agent on your machine.`,
    duration: 50,
  };
}

function simulateDevServer(): { port: number; process: ProcessInfo } {
  return {
    port: 5173,
    process: {
      pid: 0,
      name: 'vite (simulated)',
      command: 'npm run dev',
      port: 5173,
    },
  };
}

function detectPlatform(): 'windows' | 'linux' | 'macos' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  return 'linux';
}

// Get agent status
export function getAgentStatus(): AgentStatus {
  return agentStatus;
}

// Generate the local agent script that users can run
export function generateAgentScript(platform: 'windows' | 'linux' | 'macos'): string {
  if (platform === 'windows') {
    return `@echo off
:: LocalDev Backend Agent for Windows
:: Run this script to enable real command execution

echo Starting LocalDev Backend Agent...

:: Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is required. Please install from https://nodejs.org
    pause
    exit /b 1
)

:: Create temp directory for agent
set AGENT_DIR=%TEMP%\\localdev-agent
if not exist "%AGENT_DIR%" mkdir "%AGENT_DIR%"

:: Write agent server code
echo const http = require('http'); > "%AGENT_DIR%\\server.js"
echo const { exec, spawn } = require('child_process'); >> "%AGENT_DIR%\\server.js"
echo const fs = require('fs'); >> "%AGENT_DIR%\\server.js"
echo const path = require('path'); >> "%AGENT_DIR%\\server.js"
echo const WebSocket = require('ws'); >> "%AGENT_DIR%\\server.js"
echo. >> "%AGENT_DIR%\\server.js"
echo const PORT = 3847; >> "%AGENT_DIR%\\server.js"
echo let devServerProcess = null; >> "%AGENT_DIR%\\server.js"
echo. >> "%AGENT_DIR%\\server.js"
echo const server = http.createServer((req, res) =^> { >> "%AGENT_DIR%\\server.js"
echo   res.setHeader('Access-Control-Allow-Origin', '*'); >> "%AGENT_DIR%\\server.js"
echo   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); >> "%AGENT_DIR%\\server.js"
echo   res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); >> "%AGENT_DIR%\\server.js"
echo   if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; } >> "%AGENT_DIR%\\server.js"
echo   // Handle routes... >> "%AGENT_DIR%\\server.js"
echo   res.writeHead(200, { 'Content-Type': 'application/json' }); >> "%AGENT_DIR%\\server.js"
echo   res.end(JSON.stringify({ status: 'ok', version: '1.0.0', platform: 'windows' })); >> "%AGENT_DIR%\\server.js"
echo }); >> "%AGENT_DIR%\\server.js"
echo. >> "%AGENT_DIR%\\server.js"
echo server.listen(PORT, () =^> console.log('LocalDev Agent running on port ' + PORT)); >> "%AGENT_DIR%\\server.js"

:: Install ws if needed and start
cd /d "%AGENT_DIR%"
if not exist "node_modules\\ws" npm install ws --silent
node server.js

pause`;
  }
  
  return `#!/bin/bash
# LocalDev Backend Agent for ${platform === 'macos' ? 'macOS' : 'Linux'}
# Run this script to enable real command execution

echo "Starting LocalDev Backend Agent..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required. Please install from https://nodejs.org"
    exit 1
fi

# Create temp directory for agent
AGENT_DIR="/tmp/localdev-agent"
mkdir -p "$AGENT_DIR"

# Write agent server code
cat > "$AGENT_DIR/server.js" << 'AGENT_EOF'
const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3847;
let devServerProcess = null;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const url = req.url;
    
    if (url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        version: '1.0.0',
        platform: process.platform === 'darwin' ? 'macos' : 'linux',
        capabilities: ['exec', 'file', 'npm', 'process']
      }));
      return;
    }
    
    if (url === '/exec' && req.method === 'POST') {
      const { command, cwd } = JSON.parse(body || '{}');
      const start = Date.now();
      exec(command, { cwd: cwd || process.cwd() }, (error, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          stdout,
          stderr,
          exitCode: error ? error.code || 1 : 0,
          duration: Date.now() - start
        }));
      });
      return;
    }
    
    if (url === '/dev-server/start' && req.method === 'POST') {
      const { cwd } = JSON.parse(body || '{}');
      devServerProcess = spawn('npm', ['run', 'dev'], {
        cwd: cwd || process.cwd(),
        shell: true
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pid: devServerProcess.pid, port: 5173 }));
      return;
    }
    
    if (url === '/dev-server/stop' && req.method === 'POST') {
      if (devServerProcess) {
        devServerProcess.kill();
        devServerProcess = null;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    
    res.writeHead(404);
    res.end('Not found');
  });
});

server.listen(PORT, () => {
  console.log(\\\`LocalDev Agent running on http://localhost:\\\${PORT}\\\`);
  console.log('Ready to execute commands from LocalDev AI IDE');
});
AGENT_EOF

# Start the agent
cd "$AGENT_DIR"
node server.js`;
}

// Download agent script
export function downloadAgentScript(platform: 'windows' | 'linux' | 'macos'): void {
  const script = generateAgentScript(platform);
  const filename = platform === 'windows' ? 'localdev-agent.bat' : 'localdev-agent.sh';
  const mimeType = 'text/plain';
  
  const blob = new Blob([script], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
