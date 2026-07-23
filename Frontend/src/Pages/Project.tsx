import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { initializeSocket, receiveMessage } from "../config/socket";
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
import { Link, UserPlus, Users } from "lucide-react";
import { handleSuccess } from "../config/toastUtility";

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

  useEffect(() => {
    console.log("project", project);
    if (!webContainer) {
      getWebContainer().then((container) => {
        setWebContainer(container);
        console.log("container started");
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
      if (path === "") return { directory: fileTree as any };

      const parts = path.split("/");
      let current: any = fileTree;

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

    const socketInstance = initializeSocket(project.id);

    receiveMessage("project-message", async (data: any) => {
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
          console.log("bhavik");
          const message = JSON.parse(data.message);
          console.log(message.fileTree);
          if (message.fileTree) {
            setFileTree(message.fileTree);

            try {
              const response = await axios.put(
                `${import.meta.env.VITE_API_URL}/project/update-file-tree`,
                {
                  projectId: project.id,
                  fileTree: message.fileTree,
                },
                {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                  },
                }
              );
              console.log("response", response.data);
            } catch (err) {
              console.error("Error saving file tree:", err);
            }
            console.log(fileTree);
          }

          webContainer?.mount(message.fileTree);
        }
      }
    });

    receiveMessage(
      "file-renamed",
      (data: { oldPath: string; newPath: string; username: string }) => {
        const updatedTree = updateNodeAtPath(
          fileTree,
          data.oldPath,
          null,
          "delete"
        );
        const node = getNodeAtPath(data.oldPath);
        if (node) {
          updateNodeAtPath(updatedTree, data.newPath, node, "create");
          setFileTree(updatedTree);
          const itemType = isDirectory(node) ? "folder" : "file";
          handleSuccess(
            `${itemType.charAt(0).toUpperCase() + itemType.slice(1)
            } renamed from "${data.oldPath}" to "${data.newPath}" by ${data.username
            }.`
          );

          // Update currentFile if it matches the oldPath
          if (currentFile === data.oldPath) {
            setCurrentFile(data.newPath);
          }

          // Update openFiles if it contains the oldPath
          setOpenFiles(
            openFiles.map((file) =>
              file === data.oldPath ? data.newPath : file
            )
          );
        }
      }
    );

    receiveMessage(
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
          fileTree,
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
          setOpenFiles([...openFiles, data.path]);
        }
      }
    );

    receiveMessage(
      "file-deleted",
      (data: { path: string; username: string }) => {
        const updatedTree = updateNodeAtPath(
          fileTree,
          data.path,
          null,
          "delete"
        );
        setFileTree(updatedTree);
        const node = getNodeAtPath(data.path);
        const itemType = node && isDirectory(node) ? "folder" : "file";
        handleSuccess(
          `${itemType.charAt(0).toUpperCase() + itemType.slice(1)
          } deleted at "${data.path}" by ${data.username}.`
        );

        // Update currentFile if it matches the deleted path
        if (currentFile === data.path) {
          setCurrentFile(null);
        }

        // Update openFiles if it contains the deleted path
        setOpenFiles(openFiles.filter((file) => file !== data.path));
      }
    );
    axios
      .get<{ project: Project; userAccess: UserAccess }>(
        `${import.meta.env.VITE_API_URL}/project/get-project/${location.state.project.id
        }`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      )
      .then((res) => {
        console.log(res.data);
        setCollaborators(res.data.project.collaborators);
        setFileTree(res.data.project.fileTree);
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
      .catch((err) => console.error("Error fetching project data:", err));

    axios
      .get<User[]>(`${import.meta.env.VITE_API_URL}/users/all`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      .then((res) => setAllUsers(res.data))
      .catch((err) => console.error("Error fetching users:", err));

    return () => {
      // Clean up event listeners
      socketInstance?.off("collaboratorAdded");
      socketInstance?.off("adminOnlyModeToggled");
    };
  }, []);

  const handleAddCollaborators = async (
    selectedUsers: string[],
    accessLevel: string
  ) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/project/add-user`,
        {
          projectId: project.id,
          users: selectedUsers,
          accessLevel: accessLevel,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Update collaborators list by fetching the project data again
      const response = await axios.get<any>(
        `${import.meta.env.VITE_API_URL}/project/get-project/${project.id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setCollaborators(response.data.project.collaborators);
      setUserAccess(response.data.userAccess);
      console.log(["p"], collaborators);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding collaborators:", error);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/project/remove-collaborator`,
        {
          projectId: project.id,
          collaboratorId: userId,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setCollaborators((prevCollaborators) =>
        prevCollaborators.filter((collab) => collab.id !== userId)
      );
    } catch (error) {
      console.error("Error removing collaborator:", error);
    }
  };

  const handleUpdateCollaboratorAccess = async (
    userId: string,
    newAccessLevel: string
  ) => {
    try {
      console.log("newAccesslevel", newAccessLevel);
      const response = await axios.patch<any>(
        `${import.meta.env.VITE_API_URL}/project/update-collaborator-access`,
        {
          projectId: project.id,
          collaboratorId: userId,
          accessLevel: newAccessLevel,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      console.log(response.data);
      setCollaborators(response.data.project.collaborators);

      // Update the collaborator's access level locally
      // setCollaborators(prevCollaborators =>
      //     prevCollaborators.map(collab =>
      //         collab.id === userId
      //             ? { ...collab, accessLevel: newAccessLevel as 'admin' | 'readwrite' | 'readonly' }
      //             : collab
      //     )
      // );
    } catch (error) {
      console.error("Error updating collaborator access:", error);
    }
  };

  const handleToggleAdminOnlyEdit = async (
    projectId: string,
    adminOnlyEdit: boolean
  ) => {
    try {
      const response = await axios.patch<any>(
        `${import.meta.env.VITE_API_URL
        }/project/toggle-admin-only-edit/${projectId}`,
        { adminOnlyEdit },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            // Add any authentication headers if necessary
          },
        }
      );

      if (!response.data) {
        throw new Error("Failed to toggle adminOnlyEdit setting");
      }

      setProject(response.data.project);

      // Optionally, update the project state in your component
      // setProject(data.project);
    } catch (error) {
      console.error("Error toggling adminOnlyEdit setting:", error);
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

        <MessageArea
          messages={messages}
          setMessages={setMessages}
          project={project}
        />

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
