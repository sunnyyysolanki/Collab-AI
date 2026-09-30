import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import axiosInstance from "../config/axios";
import { initializeSocket, receiveMessage, stopReceiving } from "../config/socket";
import { useSelector } from "react-redux";
import { RootState } from "../App/store";
import SlidePanel from "../component/SlidePanel";
import MessageArea from "../component/MessageArea";
import CollaboratorModal from "../component/CollaboratorModal";
import ShareLinkModal from "../component/ShareLinkModal";
import CodeEditor from "../component/Monaco";
import { WebContainer } from "@webcontainer/api";
import { getWebContainer } from "../config/wbContainer";
import Explorer from "../component/Explorer";
import ErrorBoundary from "../component/ErrorBoundary";
import { Link, UserPlus, Users } from "lucide-react";
import { handleSuccess, handleError, showApiError } from "../config/toastUtility";

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
  messages: Message[];
}

interface Message {
  sender: string;
  message: string;
}

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

// Does every value in this object look like a tree node? Used to tell a real
// child named "contents" apart from the bogus wrapper level described below.
const isNodeMap = (v: any): boolean =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.values(v).every(
    (c: any) => c && typeof c === "object" && ("file" in c || "directory" in c)
  );

// WebContainer requires file contents to be a string. The AI sometimes emits
// package.json as a real JSON object instead of a JSON string — stringify it
// rather than letting it degrade to the literal text "[object Object]".
const toContents = (v: any): string => {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "";
    }
  }
  return String(v);
};

// Insert a node at a nested path, creating/reusing directories along the way.
// Needed because a key may arrive as a whole path ("src/components/App.js")
// instead of a single segment.
const insertAt = (tree: FileTree, parts: string[], node: FileNode): void => {
  const [head, ...rest] = parts;
  if (rest.length === 0) {
    tree[head] = node;
    return;
  }
  const existing = tree[head];
  const dir: FileTree =
    existing && "directory" in existing ? existing.directory : {};
  if (!existing || !("directory" in existing)) tree[head] = { directory: dir };
  insertAt(dir, rest, node);
};

// Repair the loose shapes the AI (and any project saved before this fix) can
// produce, so the tree always matches WebContainer's FileSystemTree:
//
//   1. { directory: { contents: {...} } }  -> children wrapped one level too deep.
//      This is what threw "Cannot convert undefined or null to object" in mount().
//   2. { "src/App.js": ... }               -> a path used as a key. WebContainer
//      keys are single segments, and Monaco splits currentFile on "/", so a flat
//      path key silently desyncs the editor from the tree.
//   3. { file: "code" }                    -> contents shorthand, loses the file.
//   4. non-string contents                 -> rejected by mount().
//   5. nodes that are neither file nor directory -> dropped.
const normalizeTree = (tree: any): FileTree => {
  const out: FileTree = {};
  if (!tree || typeof tree !== "object" || Array.isArray(tree)) return out;

  for (const [rawKey, node] of Object.entries<any>(tree)) {
    if (!node || typeof node !== "object") continue;

    let normalized: FileNode | null = null;

    if ("directory" in node) {
      const dir = node.directory;
      const wrapped =
        dir &&
        typeof dir === "object" &&
        Object.keys(dir).length === 1 &&
        "contents" in dir &&
        isNodeMap(dir.contents);
      normalized = { directory: normalizeTree(wrapped ? dir.contents : dir) };
    } else if ("file" in node) {
      const f = node.file;
      normalized = {
        file: {
          ...(f && typeof f === "object" ? f : {}),
          contents: toContents(typeof f === "string" ? f : f?.contents),
        },
      };
    }
    if (!normalized) continue;

    const parts = String(rawKey).split("/").filter(Boolean);
    if (parts.length === 0) continue;
    insertAt(out, parts, normalized);
  }
  return out;
};

// Deep-merge an incoming (AI-generated) tree INTO the existing tree without
// mutating either. Existing files/folders are kept; matching paths are
// overwritten by the incoming tree; directories merge recursively. This stops
// AI generations from wiping files the user already had.
const deepMergeTrees = (base: FileTree, incoming: FileTree): FileTree => {
  const result: FileTree = { ...base };
  for (const [key, node] of Object.entries(incoming)) {
    const existing = result[key];
    if (
      node && "directory" in node &&
      existing && "directory" in existing
    ) {
      result[key] = {
        directory: deepMergeTrees(existing.directory, node.directory),
      };
    } else {
      // New file/dir, or type changed -> take the incoming node.
      result[key] = node;
    }
  }
  return result;
};

interface UserAccess {
  accessLevel: "admin" | "readwrite" | "readonly";
  isAdmin: boolean;
  canWrite: boolean;
}

const Project = () => {
  const location = useLocation();
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [project, setProject] = useState<Project>(location.state.project);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const user = useSelector((state: RootState) => state.auth.user);
  const [fileTree, setFileTree] = useState<FileTree>({});
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [userAccess, setUserAccess] = useState<UserAccess>({
    accessLevel: "readonly",
    isAdmin: false,
    canWrite: false,
  });

  // Refs that always hold the LATEST state. The socket useEffect below runs only
  // once (empty deps) so its handlers would otherwise capture stale state from the
  // first render (empty fileTree, null webContainer). Reading `.current` fixes that.
  const fileTreeRef = useRef<FileTree>(fileTree);
  const currentFileRef = useRef<string | null>(currentFile);
  const openFilesRef = useRef<string[]>(openFiles);
  const webContainerRef = useRef<WebContainer | null>(webContainer);

  useEffect(() => {
    fileTreeRef.current = fileTree;
  }, [fileTree]);
  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);
  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);
  useEffect(() => {
    webContainerRef.current = webContainer;
  }, [webContainer]);

  useEffect(() => {
    console.log("project", project);
    if (!webContainer) {
      getWebContainer()
        .then((container) => {
          setWebContainer(container);
          console.log("container started");
        })
        .catch((err) => {
          // Without this, a boot failure was swallowed and webContainer stayed
          // null forever -> every Run showed "WebContainer not initialized".
          console.error("WebContainer failed to boot:", err);
          handleError(
            err?.message || "WebContainer failed to initialize. See console."
          );
        });
    }

    const isDirectory = (node: FileNode): node is DirectoryContent => {
      return "directory" in node;
    };

    const updateNodeAtPath = (
      tree: FileTree,
      path: string,
      updatedNode: FileNode | null,
      action: "update" | "delete" | "create"
    ): FileTree => {
      const newTree = JSON.parse(JSON.stringify(tree)) as FileTree;

      if (path === "") {
        throw new Error("Cannot update root");
      }

      const parts = path.split("/");
      let current: any = newTree;

      // Navigate to parent directory
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || !isDirectory(current[part])) {
          if (action === "create") {
            // Create parent directories if they don't exist
            current[part] = { directory: {} };
          } else {
            throw new Error(`Invalid path: ${path}`);
          }
        }
        current = current[part].directory;
      }

      const fileName = parts[parts.length - 1];

      if (action === "delete") {
        delete current[fileName];
      } else if (action === "create" || action === "update") {
        current[fileName] = updatedNode!;
      }

      return newTree;
    };

    const getNodeAtPath = (path: string): FileNode | null => {
      const tree = fileTreeRef.current;
      if (path === "") return { directory: tree as any };

      const parts = path.split("/");
      let current: any = tree;

      for (let i = 0; i < parts.length; i++) {
        if (!current[parts[i]]) return null;
        if (i === parts.length - 1) return current[parts[i]];
        if (!isDirectory(current[parts[i]])) {
          return null;
        }
        current = current[parts[i]].directory;
      }
      return null;
    };

    initializeSocket(project.id);

    const unsubProjectMessage = receiveMessage("project-message", async (data: any) => {
      if (user && data.sender !== user.email) {
        const incomingMessage: Message = {
          sender: data.sender,
          message: data.message,
        };
        console.log(data.message);

        setMessages((prevMessages) => [...prevMessages, incomingMessage]);
      }

      if (user && data.sender === "AI") {
        if (data.message) {
          // The AI may return plain text, markdown-fenced JSON, or an error
          // fallback (no fileTree). Parse defensively so files still get created.
          let message: any = null;
          const raw = String(data.message).trim();
          const tryParse = (s: string): any => {
            try {
              return JSON.parse(s);
            } catch {
              return null;
            }
          };
          // 1) direct parse  2) strip ```json fences  3) grab the outermost {...}
          message =
            tryParse(raw) ||
            tryParse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
          if (!message) {
            const first = raw.indexOf("{");
            const last = raw.lastIndexOf("}");
            if (first !== -1 && last > first) {
              message = tryParse(raw.slice(first, last + 1));
            }
          }
          console.log("[AI] parsed message:", message ? "OK" : "FAILED", {
            hasFileTree: !!message?.fileTree,
            rawPreview: raw.slice(0, 120),
          });

          // Only touch the file tree / WebContainer when the AI actually
          // returned one. Mounting an undefined tree crashed with
          // "Cannot convert undefined or null to object" (Object.keys).
          if (message?.fileTree) {
            // Merge AI files INTO the existing tree instead of replacing it,
            // so files the user already had aren't wiped by a new generation.
            const merged = deepMergeTrees(
              fileTreeRef.current,
              normalizeTree(message.fileTree)
            );
            setFileTree(merged);

            try {
              await axiosInstance.put(
                `/project/update-file-tree`,
                {
                  projectId: project.id,
                  fileTree: merged,
                }
              );
            } catch (err) {
              showApiError(err, "The AI's file changes could not be saved.");
            }

            webContainerRef.current?.mount(merged);
          }
        }
      }
    });

    const unsubRenamed = receiveMessage(
      "file-renamed",
      (data: { oldPath: string; newPath: string; username: string }) => {
        const node = getNodeAtPath(data.oldPath);
        if (node) {
          const afterDelete = updateNodeAtPath(
            fileTreeRef.current,
            data.oldPath,
            null,
            "delete"
          );
          const updatedTree = updateNodeAtPath(
            afterDelete,
            data.newPath,
            node,
            "create"
          );
          setFileTree(updatedTree);
          const itemType = isDirectory(node) ? "folder" : "file";
          handleSuccess(
            `${itemType.charAt(0).toUpperCase() + itemType.slice(1)
            } renamed from "${data.oldPath}" to "${data.newPath}" by ${data.username
            }.`
          );

          // Update currentFile if it matches the oldPath
          setCurrentFile((prev) => (prev === data.oldPath ? data.newPath : prev));

          // Update openFiles if it contains the oldPath
          setOpenFiles((prev) =>
            prev.map((file) => (file === data.oldPath ? data.newPath : file))
          );
        }
      }
    );

    const unsubCreated = receiveMessage(
      "file-created",
      (data: {
        path: string;
        type: "file" | "directory";
        username: string;
      }) => {
        const newNode: FileNode =
          data.type === "file"
            ? { file: { contents: "", language: "plaintext" } }
            : { directory: {} };
        const updatedTree = updateNodeAtPath(
          fileTreeRef.current,
          data.path,
          newNode,
          "create"
        );
        setFileTree(updatedTree);
        handleSuccess(
          `${data.type.charAt(0).toUpperCase() + data.type.slice(1)
          } created at "${data.path}" by ${data.username}.`
        );

        // Update currentFile if the new file is created
        if (data.type === "file") {
          setCurrentFile(data.path);
          setOpenFiles((prev) =>
            prev.includes(data.path) ? prev : [...prev, data.path]
          );
        }
      }
    );

    const unsubDeleted = receiveMessage(
      "file-deleted",
      (data: { path: string; username: string }) => {
        // Read the node BEFORE deleting so we can report its type correctly.
        const node = getNodeAtPath(data.path);
        const updatedTree = updateNodeAtPath(
          fileTreeRef.current,
          data.path,
          null,
          "delete"
        );
        setFileTree(updatedTree);
        const itemType = node && isDirectory(node) ? "folder" : "file";
        handleSuccess(
          `${itemType.charAt(0).toUpperCase() + itemType.slice(1)
          } deleted at "${data.path}" by ${data.username}.`
        );

        // Update currentFile if it matches the deleted path
        setCurrentFile((prev) => (prev === data.path ? null : prev));

        // Update openFiles if it contains the deleted path
        setOpenFiles((prev) => prev.filter((file) => file !== data.path));
      }
    );
    axiosInstance
      .get<{ project: Project; userAccess: UserAccess }>(
        `/project/get-project/${location.state.project.id
        }`
      )
      .then((res) => {
        console.log(res.data);
        setCollaborators(res.data.project.collaborators);
        // Repair projects already saved with the bad directory shape.
        setFileTree(normalizeTree(res.data.project.fileTree));
        setUserAccess(res.data.userAccess);
        setMessages(res.data.project.messages);
        // Set user access level
        // const accessLevel = res.data.userAccessLevel as 'admin' | 'readwrite' | 'readonly';
        // setUserAccess({
        //     accessLevel: accessLevel,
        //     isAdmin: accessLevel === 'admin',
        //     canWrite: ['admin', 'readwrite'].includes(accessLevel)
        // });
      })
      .catch((err) => showApiError(err, "Could not load this project."));

    axiosInstance
      .get<User[]>(`/users/all`)
      .then((res) => setAllUsers(res.data))
      .catch((err) => showApiError(err, "Could not load the user list."));

    return () => {
      // Clean up event listeners so they don't stack up (which multiplies toasts).
      unsubProjectMessage();
      unsubRenamed();
      unsubCreated();
      unsubDeleted();
      stopReceiving("collaboratorAdded");
      stopReceiving("adminOnlyModeToggled");
    };
  }, []);

  const handleAddCollaborators = async (
    selectedUsers: string[],
    accessLevel: string
  ) => {
    try {
      await axiosInstance.put(
        `/project/add-user`,
        {
          projectId: project.id,
          users: selectedUsers,
          accessLevel: accessLevel,
        }
      );

      // Update collaborators list by fetching the project data again
      const response = await axiosInstance.get<any>(
        `/project/get-project/${project.id}`
      );

      setCollaborators(response.data.project.collaborators);
      setUserAccess(response.data.userAccess);
      setIsModalOpen(false);
    } catch (error) {
      showApiError(error, "Could not add those collaborators.");
      // Rethrow so CollaboratorModal skips its success toast and socket emit.
      throw error;
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      await axiosInstance.post(
        `/project/remove-collaborator`,
        {
          projectId: project.id,
          collaboratorId: userId,
        }
      );

      setCollaborators((prevCollaborators) =>
        prevCollaborators.filter((collab) => collab.id !== userId)
      );
    } catch (error) {
      showApiError(error, "Could not remove that collaborator.");
      throw error;
    }
  };

  const handleUpdateCollaboratorAccess = async (
    userId: string,
    newAccessLevel: string
  ) => {
    try {
      const response = await axiosInstance.patch<any>(
        `/project/update-collaborator-access`,
        {
          projectId: project.id,
          collaboratorId: userId,
          accessLevel: newAccessLevel,
        }
      );

      setCollaborators(response.data.project.collaborators);
    } catch (error) {
      showApiError(error, "Could not change that collaborator's access.");
      throw error;
    }
  };

  const handleToggleAdminOnlyEdit = async (
    projectId: string,
    adminOnlyEdit: boolean
  ) => {
    try {
      const response = await axiosInstance.patch<any>(
        `/project/toggle-admin-only-edit/${projectId}`,
        { adminOnlyEdit },
        {
          headers: {
            "Content-Type": "application/json",
            // Add any authentication headers if necessary
          },
        }
      );

      if (!response.data) {
        throw new Error("Failed to toggle adminOnlyEdit setting");
      }

      setProject(response.data.project);
    } catch (error) {
      showApiError(error, "Could not change the admin-only edit setting.");
      throw error;
    }
  };

  return (
    <main className="w-full h-screen flex">
      <section className="left relative flex flex-col h-full w-2/6 bg-slate-300">
        <header className="flex justify-between items-center p-2 px-4 w-full bg-slate-100">
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-blue-700"
              onClick={() => setIsModalOpen(true)}
            >
              <UserPlus size={16} />
              <span className="text-sm">Add Collaborator</span>
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1.5 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-green-700"
              onClick={() => setIsShareModalOpen(true)}
            >
              <Link size={16} />
              <span className="text-sm">Share Link</span>
            </button>
          </div>
          <button
            onClick={() => setIsSlidePanelOpen(!isSlidePanelOpen)}
            className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"
          >
            <Users size={18} className="text-slate-700" />
          </button>
        </header>

        <ErrorBoundary>
          <MessageArea
            messages={messages}
            setMessages={setMessages}
            project={project}
          />
        </ErrorBoundary>

        <SlidePanel
          isOpen={isSlidePanelOpen}
          collaborators={collaborators}
          handleRemoveCollaborator={handleRemoveCollaborator}
          handleUpdateCollaboratorAccess={handleUpdateCollaboratorAccess}
          onClose={() => setIsSlidePanelOpen(false)}
        />
      </section>

      <section className="right bg-red-50 w-full  h-full flex">
        <Explorer
          fileTree={fileTree}
          setFileTree={setFileTree}
          currentFile={currentFile}
          setCurrentFile={setCurrentFile}
          openFiles={openFiles}
          setOpenFiles={setOpenFiles}
          project={project}
          userAccess={userAccess}
        />
        <CodeEditor
          fileTree={fileTree}
          setFileTree={setFileTree}
          currentFile={currentFile}
          setCurrentFile={setCurrentFile}
          openFiles={openFiles}
          setOpenFiles={setOpenFiles}
          webContainer={webContainer}
          project={project}
          userAccess={userAccess}
        />
      </section>

      {isModalOpen && (
        <CollaboratorModal
          collaborators={collaborators}
          allUsers={allUsers}
          onClose={() => setIsModalOpen(false)}
          handleAddCollaborators={handleAddCollaborators}
          handleRemoveCollaborator={handleRemoveCollaborator}
          handleUpdateCollaboratorAccess={handleUpdateCollaboratorAccess}
          project={project}
          userAccess={userAccess}
          handleToggleAdminOnlyEdit={handleToggleAdminOnlyEdit}
        />
      )}

      {isShareModalOpen && (
        <ShareLinkModal
          projectId={project.id}
          projectCreator={project.creator}
          onClose={() => setIsShareModalOpen(false)}
          userAccessLevel={userAccess.accessLevel}
        />
      )}
    </main>
  );
};

export default Project;
