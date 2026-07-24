import React, { useState, useRef, useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { WebContainer, WebContainerProcess } from "@webcontainer/api";
import axiosInstance from "../config/axios";
import { receiveMessage, sendMessage } from "../config/socket";
import { getIcon } from "./Explorer";

loader.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs",
  },
});

interface FileContent {
  file: {
    contents: string;
    language?: string;
  };
}

interface DirectoryContent {
  directory: {
    [key: string]: FileNode;
  };
}

type FileNode = FileContent | DirectoryContent;

interface FileTree {
  [key: string]: FileNode;
}

interface User {
  id: string;
  email: string;
}

interface Collaborator extends User {
  accessLevel: "admin" | "readwrite" | "readonly";
  isCreator?: boolean;
}

interface Project {
  id: string;
  name: string;
  creator: string;
  language: string;
  description?: string;
  collaborators: Collaborator[];
  fileTree: FileTree;
  version: number;
  adminOnlyEdit: boolean;
}

interface UserAccess {
  accessLevel: "admin" | "readwrite" | "readonly";
  isAdmin: boolean;
  canWrite: boolean;
}

interface CodeEditorProps {
  fileTree: FileTree;
  setFileTree: React.Dispatch<React.SetStateAction<FileTree>>;
  currentFile: string | null;
  setCurrentFile: React.Dispatch<React.SetStateAction<string | null>>;
  openFiles: string[];
  setOpenFiles: React.Dispatch<React.SetStateAction<string[]>>;
  webContainer: WebContainer | null;
  project: Project;
  userAccess: UserAccess;
}

// Input modal component
interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (inputs: string[]) => void;
  inputPrompts: string[];
  setInputValues: React.Dispatch<React.SetStateAction<string[]>>;
  inputValues: string[];
}
const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  inputPrompts,
  setInputValues,
  inputValues,
}) => {
  useEffect(() => {
    // Reset input values when modal opens with new prompts
    setInputValues(Array(inputPrompts.length).fill(""));
  }, [inputPrompts]);

  const handleChange = (index: number, value: string) => {
    const newValues = [...inputValues];
    newValues[index] = value;
    setInputValues(newValues);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(inputValues);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0  bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 overflow-auto h-[650px] rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-white mb-4">
          Program Input Required
        </h2>
        <form onSubmit={handleSubmit}>
          {inputPrompts.map((prompt, index) => (
            <div key={index} className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                {prompt || `Input ${index + 1}`}
              </label>
              <textarea
                value={inputValues[index]}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as unknown as React.FormEvent); // Trigger submit on Enter
                  }
                }}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white resize-none"
                placeholder="Enter value"
                rows={2}
              />
            </div>
          ))}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const languageMap: { [key: string]: string } = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    c: "c",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    svg: "xml",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    php: "php",
    go: "go",
    rust: "rust",
    rb: "ruby",
    pl: "perl",
    lua: "lua",
    swift: "swift",
    vue: "html",
    dart: "dart",
    graphql: "graphql",
    kt: "kotlin",
    scala: "scala",
  };
  return languageMap[ext || ""] || "plaintext";
};

const setNestedValue = (
  obj: FileTree,
  path: string[],
  value: FileContent
): FileTree => {
  if (path.length === 1) {
    return {
      ...obj,
      [path[0]]: value,
    };
  }

  const [first, ...rest] = path;

  // Check if the current path exists and is a directory
  const currentNode = obj[first];
  const isDirectory = currentNode && "directory" in currentNode;

  // Get the existing directory or create an empty one
  const existingDirectory = isDirectory
    ? (currentNode as DirectoryContent).directory
    : {};

  // Recursively set the value in the nested structure
  const updatedDirectory = setNestedValue(existingDirectory, rest, value);

  return {
    ...obj,
    [first]: {
      directory: updatedDirectory,
    },
  };
};

const editorThemes = [
  { id: "vs-dark", name: "VS Dark" },
  { id: "vs-light", name: "VS Light" },
  { id: "hc-black", name: "High Contrast Dark" },
  { id: "hc-light", name: "High Contrast Light" },
];
const fontSizeOptions = [12, 14, 16, 18, 20, 22, 24];

// Helper function to get nested value
const getNestedValue = (
  obj: FileTree,
  path: string[]
): FileContent | undefined => {
  if (path.length === 1) {
    return obj[path[0]] as FileContent;
  }

  const [first, ...rest] = path;
  const currentNode = obj[first];
  if (!currentNode || !("directory" in currentNode)) return undefined;

  return getNestedValue((currentNode as DirectoryContent).directory, rest);
};

// Function to detect input functions in code
const detectInputFunctions = (code: string, language: string): string[] => {
  const inputPatterns: {
    [key: string]: {
      regex: RegExp;
      extractPrompt: (match: RegExpMatchArray) => string;
    };
  } = {
    java: {
      regex:
        /System\.out\.print(?:ln)?\s*\(\s*["']([^"']+)["']\s*\)|\b\w+\s*=\s*\w+\.next\w*\s*\(\s*\)/g,
      extractPrompt: (match) => {
        if (match[1]) return `__PROMPT__${match[1]}`;
        return "__INPUT__";
      },
    },
    python: {
      regex: /input\(([^)]*)\)/g,
      extractPrompt: (match) => {
        const promptText = match[1]?.trim().replace(/["']/g, "") || "";
        return promptText;
      },
    },
    javascript: {
      regex: /prompt\(([^)]*)\)|readline\(\)/g,
      extractPrompt: (match) => {
        const promptText = match[1]?.trim().replace(/["']/g, "") || "";
        return promptText || "Enter input:";
      },
    },
    typescript: {
      regex: /prompt\(([^)]*)\)|readline\(\)/g,
      extractPrompt: (match) => {
        const promptText = match[1]?.trim().replace(/["']/g, "") || "";
        return promptText || "Enter input:";
      },
    },
    cpp: {
      regex: /(?:cout\s*<<\s*["']([^"']+)["']\s*<<\s*)?|cin\s*>>\s*\w+/g,
      extractPrompt: (match) => {
        if (match[1]) return `__PROMPT__${match[1]}`;
        return "__INPUT__";
      },
    },
    c: {
      regex: /printf\s*\(\s*["']([^"']+)["']\s*\)|scanf\s*\(\s*["'][^"']*["']/g,
      extractPrompt: (match) => {
        if (match[1]) return `__PROMPT__${match[1]}`;
        return "__INPUT__";
      },
    },
    ruby: {
      regex:
        /puts\s+["']([^"']+)["']|print\s+["']([^"']+)["']|gets(\.chomp|\.strip)?/g,
      extractPrompt: (match) => {
        if (match[1] || match[2]) return `__PROMPT__${match[1] || match[2]}`;
        return "__INPUT__";
      },
    },
    csharp: {
      regex:
        /Console\.Write(?:Line)?\s*\(\s*["']([^"']+)["']\s*\)|Console\.Read(Line)?\s*\(\s*\)/g,
      extractPrompt: (match) => {
        if (match[1]) return `__PROMPT__${match[1]}`;
        return "__INPUT__";
      },
    },
    go: {
      regex:
        /fmt\.Print(?:ln|f)?\s*\(\s*["']([^"']+)["'][^)]*\)|fmt\.Scan\w*\s*\([^)]*\)/g,
      extractPrompt: (match) => {
        if (match[1]) return `__PROMPT__${match[1]}`;
        return "__INPUT__";
      },
    },
  };

  const pattern =
    inputPatterns[language.toLowerCase()] || inputPatterns["javascript"];

  if (!pattern) return [];

  const matches = Array.from(code.matchAll(pattern.regex));
  const extracted = matches.map((match) => pattern.extractPrompt(match));

  // Process extracted matches: apply prompt only once
  const result: string[] = [];
  let promptQueue: string[] = [];

  for (const item of extracted) {
    if (item.startsWith("__PROMPT__")) {
      // Queue the prompt for the next input
      promptQueue.push(item.replace("__PROMPT__", "").trim());
    } else if (item === "__INPUT__") {
      if (promptQueue.length > 0) {
        result.push(promptQueue.shift()!); // Use and discard prompt
      } else {
        result.push("Enter input:");
      }
    }
  }

  return result;
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  currentFile,
  setCurrentFile,
  fileTree,
  setFileTree,
  openFiles,
  setOpenFiles,
  webContainer,
  project,
  userAccess,
}) => {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [runProcess, setRunProcess] = useState<WebContainerProcess | null>(
    null
  );
  const [inputValues, setInputValues] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "logs">(
    "editor"
  );
  const [logType, setLogType] = useState<"server" | "install">("install");
  const containerRef = useRef<HTMLIFrameElement>(null);
  const logContainerRef = useRef<HTMLPreElement>(null);

  // Auto-scroll the log pane to the newest line as logs stream in.
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [installLogs, serverLogs, logType, activeTab]);

  const [hasError, setHasError] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Input modal states
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputPrompts, setInputPrompts] = useState<string[]>([]);
  const [_pendingExecution, setPendingExecution] = useState<(() => void) | null>(
    null
  );

  const editorRef = useRef<any>(null);

  // Editor preferences
  const [editorTheme, setEditorTheme] = useState<string>("vs-dark");
  const [fontSize, setFontSize] = useState<number>(14);
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);

  // Auto save timeout
  const autoSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // (Editor now uses `path`/`value`, so no manual remount is needed to switch files.)
    const savedTheme = localStorage.getItem("editorTheme");
    const savedFontSize = localStorage.getItem("editorFontSize");
    const savedWordWrap = localStorage.getItem("editorWordWrap");
    const savedShowMinimap = localStorage.getItem("editorShowMinimap");

    if (savedTheme) setEditorTheme(savedTheme);
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
    if (savedWordWrap) setWordWrap(savedWordWrap as "on" | "off");
    if (savedShowMinimap) setShowMinimap(savedShowMinimap === "true");

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [activeTab, currentFile]);

  // Socket subscription: register ONCE with cleanup. Previously this lived in the
  // effect above (deps [activeTab, currentFile]) with no cleanup, so switching tabs
  // or files stacked duplicate "project-code" listeners.
  useEffect(() => {
    const unsub = receiveMessage("project-code", (data: any) => {
      setFileTree(data);
    });
    return unsub;
  }, []);

  // Function to handle editor mounting
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Configure Monaco editor
    configureMonaco(monaco);

    // Focus editor after mount
    editor.focus();
  };

  const configureMonaco = (monaco: any) => {
    if (!monaco) return;

    // Auto bracket completion for all languages
    monaco.languages.setLanguageConfiguration("typescript", {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
        ["<", ">"],
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "<", close: ">" },
      ],
      autoClosingQuotes: [
        { open: "'", close: "'", notIn: ["string", "comment"] },
        { open: '"', close: '"', notIn: ["string"] },
        { open: "`", close: "`", notIn: ["string", "comment"] },
      ],
    });

    // Enhanced HTML/JSX auto-closing tags
    monaco.languages.setLanguageConfiguration("html", {
      onEnterRules: [
        {
          beforeText: /<([_:\w][_:\w-.\d]*)(?:\s+[^>]*)?>[^<]*$/i,
          afterText: /^<\/([_:\w][_:\w-.\d]*)>/i,
          action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
        },
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "'", close: "'" },
        { open: '"', close: '"' },
        { open: "<", close: ">" },
      ],
      autoCloseBefore: ";:.,=}",
    });

    // Register custom themes
    monaco.editor.defineTheme("github-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955" },
        { token: "keyword", foreground: "CF8E6D" },
        { token: "string", foreground: "CE9178" },
      ],
      colors: {
        "editor.background": "#0D1117",
        "editor.foreground": "#E1E4E8",
        "editorCursor.foreground": "#E1E4E8",
        "editor.lineHighlightBackground": "#161B22",
        "editorLineNumber.foreground": "#8B949E",
        "editor.selectionBackground": "#3B5070",
        "editor.inactiveSelectionBackground": "#3A3D41",
      },
    });
  };

  const handleInput = (value: string | undefined) => {
    if (!currentFile || !value || !userAccess.canWrite) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (700ms delay)
    autoSaveTimeoutRef.current = setTimeout(() => {
      const pathParts = currentFile.split("/");
      const fileData: FileContent = {
        file: {
          contents: value,
          language: getLanguageFromFilename(currentFile),
        },
      };

      const updatedTree = setNestedValue(fileTree, pathParts, fileData);
      setFileTree(updatedTree);
      saveFileTree(updatedTree);
      sendMessage("project-code", updatedTree);
    }, 700);
  };

  const getCurrentFileContents = (): string => {
    if (!currentFile) return "";

    const pathParts = currentFile.split("/");
    const fileData = getNestedValue(fileTree, pathParts);
    return fileData?.file?.contents || "";
  };

  const handleFileClick = (file: string) => {
    setCurrentFile(file);
    setActiveTab("editor");
    if (!openFiles.includes(file)) {
      setOpenFiles((prev) => [...prev, file]);
    }
  };

  const handleFileClose = (file: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedOpenFiles = openFiles.filter((f) => f !== file);
    setOpenFiles(updatedOpenFiles);
    if (currentFile === file) {
      setCurrentFile(updatedOpenFiles.length > 0 ? updatedOpenFiles[0] : null);
    }
  };

  const saveFileTree = async (ft: FileTree) => {
    try {
      await axiosInstance.put("/project/update-file-tree", {
        projectId: project.id,
        fileTree: ft,
      });
    } catch (err) {
      console.error("Error saving file tree:", err);
      addLog("install", `❌ Error: Failed to save changes`);
      setHasError(true);
    }
  };

  const saveEditorPreferences = () => {
    localStorage.setItem("editorTheme", editorTheme);
    localStorage.setItem("editorFontSize", fontSize.toString());
    localStorage.setItem("editorWordWrap", wordWrap);
    localStorage.setItem("editorShowMinimap", showMinimap.toString());
  };

  // Apply editor preferences when they change
  useEffect(() => {
    saveEditorPreferences();
  }, [editorTheme, fontSize, wordWrap, showMinimap]);

  // Find the directory that contains a package.json (root or nested, e.g. the
  // AI often puts it in a "server"/"backend" subfolder). Returns "" for root,
  // or a path like "server". Prefers root, then a folder whose name suggests a
  // backend, otherwise the first folder that has one. null if none exists.
  const findPackageJsonDir = (
    tree: FileTree,
    basePath = ""
  ): string | null => {
    if ("package.json" in tree) return basePath;

    const dirEntries = Object.entries(tree).filter(
      ([, node]) => "directory" in node
    );

    // Prefer a backend-ish folder so `npm start` runs the server.
    const preferredOrder = dirEntries.sort(([a], [b]) => {
      const rank = (n: string) =>
        /^(server|backend|api)$/i.test(n) ? 0 : 1;
      return rank(a) - rank(b);
    });

    for (const [name, node] of preferredOrder) {
      const childTree = (node as DirectoryContent).directory;
      const found = findPackageJsonDir(
        childTree,
        basePath ? `${basePath}/${name}` : name
      );
      if (found !== null) return found;
    }
    return null;
  };

  // Strip ANSI escape/control sequences (colors, cursor moves like [1G, clear
  // line [0K) that terminals interpret but render as garbage in the browser.
  const stripAnsi = (input: string): string =>
    input
      // Full ANSI CSI sequences: ESC [ ... final-byte
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
      // WebContainer often emits the CSI body WITHOUT the leading ESC
      // (e.g. "[1G", "[0K") — strip those bare sequences too.
      .replace(/\[[0-9;?]*[A-Za-z]/g, "")
      // Remaining control chars except tab and newline.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");

  // Keep at most this many lines per log so a chatty install can never blow up
  // the UI (npm streams thousands of spinner frames).
  const MAX_LOG_LINES = 500;

  // True for empty lines and npm's progress-spinner frames (\ | / - / braille),
  // which arrive as thousands of one-char lines and flood the log.
  const isNoiseLine = (line: string): boolean => {
    const t = line.trim();
    return t === "" || /^[\\|/\-⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]+$/.test(t);
  };

  const addLog = (type: "install" | "server", message: string) => {
    // A single chunk may contain many newline-separated frames — clean each.
    const lines = stripAnsi(message)
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => !isNoiseLine(l));
    if (lines.length === 0) return;

    const setter = type === "install" ? setInstallLogs : setServerLogs;
    setter((prev) => {
      const next = [...prev, ...lines];
      return next.length > MAX_LOG_LINES
        ? next.slice(next.length - MAX_LOG_LINES)
        : next;
    });
  };

  const flattenFileTree = (
    tree: FileTree,
    path = ""
  ): Record<string, string> => {
    let result: Record<string, string> = {};
    for (const [key, value] of Object.entries(tree)) {
      const newPath = path ? `${path}/${key}` : key;
      if ("file" in value) {
        result[newPath] = value.file.contents;
      } else if ("directory" in value) {
        Object.assign(result, flattenFileTree(value.directory, newPath));
      }
    }
    return result;
  };

  const getJudge0LanguageId = (language: string): number | null => {
    // Updated language IDs to match Judge0 CE API
    const languageMap: Record<string, number | null> = {
      c: 50,
      'cpp': 54,
      java: 62,
      python: 71,
      javascript: 63,
      typescript: 74,
      go: 60,
      ruby: 72,
      php: 68,
      swift: 83,
      rust: 73,
      kotlin: 78,
      scala: 81,
      perl: 85,
      lua: 90,
      haskell: 21,
      csharp: 51,
      r: 80,
      dart: 51, // Using C# language ID as fallback
      "objective-c": 79,
      pascal: 67,
      fortran: 59,
      bash: 46,
      sql: 82,
      json: null, // Not executable
      xml: null, // Not executable
      yaml: null, // Not executable
      plaintext: null, // Not executable
    };

    return languageMap[language.toLowerCase()] || null;
  };

  const runWebContainers = async () => {
    if (!webContainer) {
      addLog("install", `❌ Error: WebContainer not initialized`);
      setActiveTab("logs");
      setLogType("install");
      setHasError(true);
      return;
    }

    setIsRunning(true);
    setInstallLogs([]);
    setServerLogs([]);
    setActiveTab("logs");
    setLogType("install");
    setHasError(false);

    try {
      // Kill existing process if running
      if (runProcess) {
        await runProcess.kill();
        setRunProcess(null);
      }

      // Mount files
      addLog("install", "📁 Mounting files...");
      await webContainer.mount(fileTree);
      addLog("install", "✅ Files mounted successfully");

      // Locate package.json (root OR nested, e.g. inside "server"/"backend").
      const pkgDir = findPackageJsonDir(fileTree);
      if (pkgDir === null) {
        addLog(
          "install",
          "❌ Error: No package.json found anywhere in the project"
        );
        setIsRunning(false);
        setHasError(true);
        return;
      }

      // Run npm in the directory that actually has package.json.
      const spawnOpts = pkgDir ? { cwd: pkgDir } : undefined;
      if (pkgDir) {
        addLog("install", `📁 Using package.json in "./${pkgDir}"`);
      }

      // Install dependencies
      addLog("install", "📦 Installing dependencies...");
      const installProcess = await webContainer.spawn(
        "npm",
        ["install"],
        spawnOpts
      );

      const installExitPromise = new Promise((resolve, reject) => {
        installProcess.output.pipeTo(
          new WritableStream({
            write(chunk) {
              addLog("install", chunk.toString());
            },
          })
        );

        installProcess.exit.then((code) => {
          if (code !== 0) {
            reject(new Error(`npm install failed with code ${code}`));
          } else {
            resolve(null);
          }
        });
      });

      await installExitPromise;

      // Clear port 3000
      addLog("install", "🔄 Clearing port 3000...");
      await webContainer.spawn("npx", ["kill-port", "3000"]);

      // Start development server (in the same package.json directory)
      addLog("install", "🚀 Starting development server...");
      addLog("server", "🚀 Starting development server...");
      const devProcess = await webContainer.spawn("npm", ["start"], spawnOpts);
      setRunProcess(devProcess);

      devProcess.output.pipeTo(
        new WritableStream({
          write(chunk) {
            addLog("server", chunk.toString());
          },
        })
      );

      webContainer.on("server-ready", (_port, url) => {
        const message = `✨ Server ready at ${url}`;
        addLog("install", message);
        addLog("server", message);
        setIframeUrl(url);
        setLogType("server"); // Automatically switch to server logs when ready
        setActiveTab("preview"); // Automatically show preview when ready
      });
    } catch (err) {
      console.error("Run error:", err);
      const errorMsg = `❌ Error: ${err instanceof Error ? err.message : "Unknown error"
        }`;
      addLog("install", errorMsg);
      addLog("server", errorMsg);
      setHasError(true);
    } finally {
      setIsRunning(false);
    }
  };

  const runJavaScriptInIframe = (userInputs: string[] = []): void => {
    addLog("server", `⚡ Running ${currentFile} in iframe...`);

    const jsCode = getCurrentFileContents();

    // Remove existing iframe if present
    const existingIframe = document.getElementById(
      "js-execution-iframe"
    ) as HTMLIFrameElement;
    if (existingIframe && existingIframe.parentNode) {
      existingIframe.parentNode.removeChild(existingIframe);
    }

    const iframe: HTMLIFrameElement = document.createElement("iframe");
    iframe.id = "js-execution-iframe";
    iframe.style.width = "100%";
    iframe.style.height = "400px";
    iframe.style.border = "1px solid #ccc";
    iframe.style.display = "none"; // Hide the iframe
    document.body.appendChild(iframe);

    const iframeDoc: Document | null =
      iframe.contentDocument || iframe.contentWindow?.document || null;
    if (iframeDoc) {
      iframeDoc.open();
      if (iframeDoc.write) {
        iframeDoc.write(`
          <html>
          <head><title>Run Code</title></head>
          <body>
            <script>
              (function() {
                const originalConsoleLog = console.log;
                const originalConsoleError = console.error;
                const originalConsoleWarn = console.warn;
                const originalConsoleInfo = console.info;
                
                console.log = function(...args) {
                  parent.postMessage({ type: 'log', level: 'log', data: args }, '*');
                  originalConsoleLog.apply(console, args);
                };
                
                console.error = function(...args) {
                  parent.postMessage({ type: 'log', level: 'error', data: args }, '*');
                  originalConsoleError.apply(console, args);
                };
                
                console.warn = function(...args) {
                  parent.postMessage({ type: 'log', level: 'warn', data: args }, '*');
                  originalConsoleWarn.apply(console, args);
                };
                
                console.info = function(...args) {
                  parent.postMessage({ type: 'log', level: 'info', data: args }, '*');
                  originalConsoleInfo.apply(console, args);
                };

                // Mock user input functions with provided values
                let inputIndex = 0;
                const userInputs = ${JSON.stringify(userInputs)};
                
                // Override prompt function
                window.prompt = function(message) {
                  const inputValue = userInputs[inputIndex] || '';
                  console.log('Input prompt: ' + message);
                  console.log('User input: ' + inputValue);
                  inputIndex++;
                  return inputValue;
                };
                
                try {
                  ${jsCode} // Runs user-provided JavaScript
                } catch (err) {
                  console.error("Execution Error:", err.message);
                  console.error(err.stack);
                }
                
                parent.postMessage({ type: 'execution-complete' }, '*');
              })();
            </script>
          </body>
          </html>
        `);
        iframeDoc.close();
      }
    }

    const messageHandler = (event: MessageEvent) => {
      if (event.data.type === "log") {
        const prefix =
          event.data.level === "error"
            ? "❌ "
            : event.data.level === "warn"
              ? "⚠️ "
              : event.data.level === "info"
                ? "ℹ️ "
                : "";

        addLog("server", `${prefix}${event.data.data.join(" ")}`);
      } else if (event.data.type === "execution-complete") {
        addLog("server", "✅ Execution completed");
        window.removeEventListener("message", messageHandler);
      }
    };

    window.addEventListener("message", messageHandler);
  };

  const executeWithUserInput = (userInputs: string[] = []) => {
    if (!currentFile) return;
    setActiveTab("logs");
    setLogType("server");

    // Clear previous logs
    setServerLogs([]);
    addLog("server", `🔄 Executing with user inputs: ${userInputs.join(", ")}`);

    // Handle input for Judge0 API
    if (project.language !== "JavaScript" && project.language !== "Node") {
      executeCodeWithJudge0(userInputs);
    } else {
      runJavaScriptInIframe(userInputs);
    }

    setShowInputModal(false);
    setPendingExecution(null);
  };

  const executeCodeWithJudge0 = async (userInputs: string[] = []) => {
    if (isExecuting) return;

    setIsExecuting(true);
    const language = project.language.toLowerCase();

    const languageId = getJudge0LanguageId(language);

    if (!languageId) {
      addLog(
        "server",
        `❌ Error: Language '${language}' is not supported for execution`
      );
      setIsExecuting(false);
      return;
    }

    addLog("server", `📝 Preparing ${language} code for execution...`);

    try {
      const sourceCode = getCurrentFileContents();
      const stdin = userInputs.join("\n");

      addLog("server", "🌐 Sending code to execution service...");

      // For Java files, ensure the class name matches the filename
      if (language === "java") {
        // Look for public class name
        const classMatch = sourceCode.match(/public\s+class\s+([A-Za-z0-9_]+)/);

        if (classMatch && classMatch[1]) {
          const originalClassName = classMatch[1].trim();

          // Replace original class name with 'Main'
          const updatedSourceCode = sourceCode.replace(
            new RegExp(`public\\s+class\\s+${originalClassName}`),
            "public class Main"
          );

          addLog(
            "server",
            `🔧 Renaming Java class '${originalClassName}' to 'Main' and using 'Main.java' as filename`
          );

          const submissionData = {
            language_id: languageId,
            stdin: stdin,
            wait: true,

            source_code: updatedSourceCode,

            files: [
              {
                name: `Main.java`,
                content: updatedSourceCode,
              },
            ],
          };

          console.log(submissionData);
          await submitToJudge0(submissionData);
          return;
        }
      }

      // For non-Java languages, use standard submission
      const submissionData = {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin,
        wait: true,
      };

      await submitToJudge0(submissionData);
    } catch (error) {
      console.error("Judge0 Execution Error:", error);
      addLog(
        "server",
        `❌ Execution failed: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsExecuting(false);
    }
  };
  const filterOutputPrompts = (stdout: string, prompts: string[]): string => {
    let filtered = stdout;
    const inputString: string[] = [];

    prompts.forEach((prompt, index) => {
      if (!prompt) return;

      const escapedPrompt = prompt.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(escapedPrompt + "\\s*", "g");
      filtered = filtered.replace(regex, "");

      // Build readable input summary
      inputString.push(`${prompt} ${inputValues[index] || ""}`);
    });

    const combinedInput = inputString.join("\n");

    return `${combinedInput}\n\n${filtered.trim()}`;
  };

  const handleRun = async () => {
    if (!currentFile) return;

    const fileContent = getCurrentFileContents();
    const language = project.language.toLowerCase();

    // Detect if code contains input functions
    const detectedPrompts = detectInputFunctions(fileContent, language);
    console.log(detectedPrompts);
    if (detectedPrompts.length > 0) {
      // Show input modal
      setInputPrompts(detectedPrompts);
      setShowInputModal(true);

      // Store the execution function to call after getting inputs
      setPendingExecution(() => () => {
        const language = project.language;
        if (language === "Node") {
          runWebContainers();
        } else {
          setActiveTab("logs");
          setLogType("server");
        }
      });
    } else {
      // No inputs needed, execute directly
      const language = project.language;
      if (language === "Node") {
        runWebContainers();
      } else {
        setActiveTab("logs");
        setLogType("server");
        setServerLogs([]); // Clear previous logs

        // For non-Node languages
        if (language === "JavaScript") {
          runJavaScriptInIframe();
        } else {
          executeCodeWithJudge0([]);
        }
      }
    }
  };

  // Extracted Judge0 submission to a separate function
  const submitToJudge0 = async (submissionData: any) => {
    // Using fetch directly with proper headers for Judge0
    const response = await fetch(
      "https://judge0-ce.p.rapidapi.com/submissions?wait=true&base64_encoded=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": import.meta.env.JUDGE0_API_KEY || 'f72520e9f9msh9e7426361479b74p144c1ejsn730574d7951d',
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
        body: JSON.stringify(submissionData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${errorText}`);
    }

    const result = await response.json();

    // Process and display the result
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const compile_output = result.compile_output || "";
    const status = result.status?.description || "Unknown";

    const cleanOutput = filterOutputPrompts(stdout, inputPrompts);
    console.log(cleanOutput);
    addLog("server", `📊 Status: ${status}`);

    if (compile_output) {
      addLog("server", `📝 Compilation output:\n${compile_output}`);
    }

    if (stderr) {
      addLog("server", `❌ Error output:\n${stderr}`);
    }

    if (stdout) {
      addLog("server", `📤 Program output:\n${cleanOutput}`);
    }

    if (!stdout && !stderr && !compile_output) {
      addLog("server", "⚠️ No output received from program");
    }
  };

  const handleStop = async () => {
    if (runProcess) {
      try {
        await runProcess.kill();
        setRunProcess(null);
        addLog("server", "🛑 Server stopped");
        setIsRunning(false);
      } catch (err) {
        console.error("Error stopping server:", err);
        addLog(
          "server",
          `❌ Error stopping server: ${err instanceof Error ? err.message : "Unknown error"
          }`
        );
      }
    }
  };

  const getFileLanguage = (filename: string | null): string => {
    if (!filename) return "plaintext";
    return getLanguageFromFilename(filename);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Tab bar */}
      <div className="flex bg-gray-800 text-white overflow-x-auto">
        {openFiles.map((file) => (
          <div
            key={file}
            className={`flex items-center px-3 py-2 cursor-pointer border-b-2 ${currentFile === file ? "border-blue-500" : "border-transparent"
              } ${currentFile === file ? "bg-gray-700" : ""}`}
            onClick={() => handleFileClick(file)}
          >
            <span className="mr-1">{getIcon(file, false)}</span>
            <span className="truncate max-w-xs">{file.split("/").pop()}</span>
            <button
              className="ml-2 text-gray-400 hover:text-white"
              onClick={(e) => handleFileClose(file, e)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex justify-between items-center p-2 bg-gray-800 text-white border-t border-gray-700">
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 rounded flex items-center ${isRunning || isExecuting
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
              } ${!currentFile ||
                !userAccess.canWrite ||
                (isExecuting && !isRunning)
                ? "opacity-50 cursor-not-allowed"
                : ""
              }`}
            onClick={isRunning ? handleStop : handleRun}
            disabled={
              !currentFile ||
              !userAccess.canWrite ||
              (isExecuting && !isRunning)
            }
          >
            {isRunning ? (
              <>
                <span className="mr-1">Stop</span>
                <span>⏹️</span>
              </>
            ) : isExecuting ? (
              <>
                <span className="mr-1">Executing...</span>
              </>
            ) : (
              <>
                <span className="mr-1">Run</span>
                <span>▶️</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button
            className={`px-2 py-1 rounded ${activeTab === "editor"
              ? "bg-gray-600"
              : "bg-gray-700 hover:bg-gray-600"
              }`}
            onClick={() => setActiveTab("editor")}
          >
            Editor
          </button>
          <button
            className={`px-2 py-1 rounded ${activeTab === "preview"
              ? "bg-gray-600"
              : "bg-gray-700 hover:bg-gray-600"
              }`}
            onClick={() => setActiveTab("preview")}
          >
            Preview
          </button>
          <button
            className={`px-2 py-1 rounded ${activeTab === "logs"
              ? "bg-gray-600"
              : "bg-gray-700 hover:bg-gray-600"
              }`}
            onClick={() => setActiveTab("logs")}
          >
            Logs {hasError ? "⚠️" : ""}
          </button>
          <button
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
          >
            Settings ⚙️
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettingsPanel && (
        <div className="bg-gray-800 text-white p-3 border-t border-gray-700">
          <h3 className="text-sm font-semibold mb-2">Editor Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Theme</label>
              <select
                className="w-full bg-gray-700 p-1 rounded"
                value={editorTheme}
                onChange={(e) => setEditorTheme(e.target.value)}
              >
                {editorThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Font Size</label>
              <select
                className="w-full bg-gray-700 p-1 rounded"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
              >
                {fontSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Word Wrap</label>
              <select
                className="w-full bg-gray-700 p-1 rounded"
                value={wordWrap}
                onChange={(e) => setWordWrap(e.target.value as "on" | "off")}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Minimap</label>
              <select
                className="w-full bg-gray-700 p-1 rounded"
                value={showMinimap ? "true" : "false"}
                onChange={(e) => setShowMinimap(e.target.value === "true")}
              >
                <option value="true">Show</option>
                <option value="false">Hide</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content area — min-h-0 + overflow-hidden so logs/editor stay bounded
          inside the flex column instead of expanding and breaking the page. */}
      <div className="flex-grow relative min-h-0 overflow-hidden">
        {activeTab === "editor" && (
          <div className="h-full w-full">
            {currentFile ? (
              <Editor
                height="100%"
                path={currentFile}
                language={getFileLanguage(currentFile)}
                value={getCurrentFileContents()}
                theme={editorTheme}
                onChange={handleInput}
                onMount={handleEditorDidMount}
                options={{
                  readOnly: !userAccess.canWrite,
                  fontSize: fontSize,
                  wordWrap: wordWrap,
                  minimap: { enabled: showMinimap },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "all",
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full bg-gray-900 text-gray-400">
                <p>Select a file to edit</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "preview" && (
          <div className="h-full w-full bg-gray-900 flex items-center justify-center">
            {iframeUrl ? (
              <iframe
                src={iframeUrl}
                className="w-full h-full border-none"
                title="Preview"
                ref={containerRef}
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi"
              />
            ) : (
              <div className="text-gray-400">
                <p>Run your project to see the preview</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="h-full w-full bg-gray-900 text-white p-2 flex flex-col overflow-hidden">
            <div className="flex mb-2 space-x-2 shrink-0">
              <button
                className={`px-2 py-1 rounded text-sm ${logType === "install" ? "bg-blue-600" : "bg-gray-700"
                  }`}
                onClick={() => setLogType("install")}
              >
                Installation Logs
              </button>
              <button
                className={`px-2 py-1 rounded text-sm ${logType === "server" ? "bg-blue-600" : "bg-gray-700"
                  }`}
                onClick={() => setLogType("server")}
              >
                Server Logs
              </button>
            </div>
            {/* Scrollable terminal-style pane that auto-scrolls to newest line */}
            <pre
              ref={logContainerRef}
              className="flex-1 min-h-0 overflow-auto whitespace-pre-wrap break-words font-mono text-sm bg-black/40 rounded p-2"
            >
              {(logType === "install" ? installLogs : serverLogs).join("\n")}
            </pre>
          </div>
        )}
      </div>

      {/* Input Modal */}
      <InputModal
        isOpen={showInputModal}
        onClose={() => setShowInputModal(false)}
        onSubmit={executeWithUserInput}
        inputPrompts={inputPrompts}
        setInputValues={setInputValues}
        inputValues={inputValues}
      />
    </div>
  );
};

export default CodeEditor;
