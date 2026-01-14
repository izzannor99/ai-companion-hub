// Python Runner using Pyodide (WebAssembly Python)

let pyodide: any = null;
let loadingPromise: Promise<any> | null = null;

export interface PythonResult {
  success: boolean;
  output: string;
  error?: string;
}

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<any>;
  }
}

async function loadPyodideScript(): Promise<void> {
  if (window.loadPyodide) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Pyodide script'));
    document.head.appendChild(script);
  });
}

export async function loadPyodide(): Promise<any> {
  if (pyodide) return pyodide;
  
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await loadPyodideScript();
      
      pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
      });

      // Set up stdout/stderr capture
      await pyodide.runPythonAsync(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.stdout = StringIO()
        self.stderr = StringIO()
        
    def get_output(self):
        return self.stdout.getvalue()
    
    def get_error(self):
        return self.stderr.getvalue()
    
    def clear(self):
        self.stdout = StringIO()
        self.stderr = StringIO()

_output_capture = OutputCapture()
      `);

      return pyodide;
    } catch (error) {
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

export async function runPython(code: string): Promise<PythonResult> {
  try {
    const py = await loadPyodide();
    
    // Wrap code to capture output
    const wrappedCode = `
import sys
from io import StringIO

_stdout_backup = sys.stdout
_stderr_backup = sys.stderr
_captured_stdout = StringIO()
_captured_stderr = StringIO()
sys.stdout = _captured_stdout
sys.stderr = _captured_stderr

try:
    exec(${JSON.stringify(code)})
    _result_output = _captured_stdout.getvalue()
    _result_error = _captured_stderr.getvalue()
except Exception as e:
    _result_output = _captured_stdout.getvalue()
    _result_error = str(e)
finally:
    sys.stdout = _stdout_backup
    sys.stderr = _stderr_backup

(_result_output, _result_error)
`;

    const result = await py.runPythonAsync(wrappedCode);
    const [output, error] = result.toJs();

    if (error && error.trim()) {
      return {
        success: false,
        output: output || '',
        error: error,
      };
    }

    return {
      success: true,
      output: output || '(No output)',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: error.message || String(error),
    };
  }
}

export async function installPackage(packageName: string): Promise<boolean> {
  try {
    const py = await loadPyodide();
    await py.loadPackage('micropip');
    const micropip = py.pyimport('micropip');
    await micropip.install(packageName);
    return true;
  } catch (error) {
    console.error('Failed to install package:', error);
    return false;
  }
}

export function isPyodideLoaded(): boolean {
  return pyodide !== null;
}

export function isPyodideLoading(): boolean {
  return loadingPromise !== null && pyodide === null;
}
