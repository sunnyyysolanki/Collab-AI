import React, { useState, useRef, useEffect } from "react";
import { receiveMessage, sendMessage } from "../config/socket";
import axios from "../config/axios";
import {
    Folder,
    FolderOpen,
    FileText,
    File,
    FileType,
    FileImage,
} from "lucide-react";
import { FaJava, FaJs, FaMicrosoft, FaTerminal } from "react-icons/fa";
import { IoLogoPython } from "react-icons/io";
import { TbJson } from "react-icons/tb";
import { AiFillCopyrightCircle } from "react-icons/ai";
import { IoLogoCss3 } from "react-icons/io5";
import { PiFileJsxFill, PiFileTsxFill } from "react-icons/pi";
import { SiApple, SiCplusplus, SiDart, SiFortran, SiGo, SiGraphql, SiHaskell, SiHtml5, SiKotlin, SiLua, SiMysql, SiPerl, SiPhp, SiR, SiRuby, SiRust, SiScala, SiSwift, SiXml, SiYaml } from "react-icons/si";
import { PiFileTsFill } from "react-icons/pi";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { CgExport, CgImport } from "react-icons/cg";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { handleSuccess, handleError } from "../config/toastUtility";
import { useSelector } from "react-redux";
import { RootState } from "../App/store";
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from "react-icons/md";

// Following WebContainer's file structure
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

interface ExplorerProps {
    fileTree: FileTree;
    setFileTree: React.Dispatch<React.SetStateAction<FileTree>>;
    currentFile: string | null;
    setCurrentFile: React.Dispatch<React.SetStateAction<string | null>>;
    openFiles: string[];
    setOpenFiles: React.Dispatch<React.SetStateAction<string[]>>;
    project: Project;
    userAccess: UserAccess;
}

// Function to determine icon for file/folder
export const getIcon = (
    name: string,
    isDirectory: boolean,
    isOpen: boolean = false
): JSX.Element => {
    if (isDirectory) {
        return isOpen ? (
            <FolderOpen size={18} className="text-amber-600" />
        ) : (
            <Folder size={18} className="text-amber-600" />
        );
    }

    const extension = name.split(".").pop()?.toLowerCase();
    const iconProps = { size: 18, className: "text-slate-600" };

    switch (extension) {
        case "js":
            return <FaJs {...iconProps} className="text-yellow-500" />;
        case "py":
            return (
                <IoLogoPython {...iconProps} size={20} className="text-blue-600" />
            );
        case "c":
            return <AiFillCopyrightCircle {...iconProps} className="text-blue-600" />;
        case "html":
            return <SiHtml5 {...iconProps} className="text-orange-500" />;
        case "jsx":
            return <PiFileJsxFill {...iconProps} className="text-blue-600" />;
        case "ts":
            return <PiFileTsFill {...iconProps} className="text-blue-600" />;
        case "tsx":
            return <PiFileTsxFill {...iconProps} className="text-blue-600" />;
        case "json":
            return <TbJson {...iconProps} className="text-green-600" />;
        case "java":
            return <FaJava  {...iconProps} className="text-blue-600" />;
        case "rb":
            return <SiRuby   {...iconProps} className="text-red-600" />;
        case "cpp":
        case "cc":
        case "cxx":
            return <SiCplusplus {...iconProps} className="text-blue-600" />;
        case "php":
            return <SiPhp {...iconProps} className="text-purple-600" />;
        case "go":
            return <SiGo {...iconProps} className="text-blue-600" />;
        case "bash":
            return <FaTerminal {...iconProps} className="text-green-600" />;
        case "swift":
            return <SiSwift {...iconProps} className="text-orange-500" />;
        case "rust":
            return <SiRust {...iconProps} className="text-orange-500" />;
        case "kt":
            return <SiKotlin {...iconProps} className="text-purple-600" />;
        case "scala":
            return <SiScala {...iconProps} className="text-red-600" />;
        case "pl":
            return <SiPerl {...iconProps} className="text-blue-600" />;
        case "lua":
            return <SiLua {...iconProps} className="text-blue-600" />;
        case "sh":
        case "sql":
            return <SiMysql {...iconProps} className="text-blue-600" />;
        case "css":
        case "scss":
            return <IoLogoCss3 {...iconProps} className="text-blue-600" />;
        case "less":
            return <FileType {...iconProps} className="text-pink-600" />;
        case "png":
        case "jpg":
        case "jpeg":
        case "gif":
        case "svg":
            return <FileImage {...iconProps} className="text-purple-600" />;
        case "md":
        case "txt":
            return <FileText {...iconProps} className="text-slate-600" />;
        case "dart":
            return <SiDart {...iconProps} className="text-blue-600" />;
        case "graphql":
            return <SiGraphql {...iconProps} className="text-pink-600" />;
        case "haskell":
            return <SiHaskell {...iconProps} className="text-purple-600" />;
        case "r":
            return <SiR {...iconProps} className="text-blue-600" />;
        case "cs":
            return <FaMicrosoft {...iconProps} className="text-purple-600" />;
        case "pascal":
            return <File {...iconProps} className="text-blue-600" />; // Use a generic file icon
        case "objective-c":
            return <SiApple {...iconProps} className="text-blue-600" />;
        case "fortran":
            return <SiFortran {...iconProps} className="text-blue-600" />;
        case "yaml":
        case "yml":
            return <SiYaml {...iconProps} className="text-blue-600" />;
        case "xml":
            return <SiXml {...iconProps} className="text-orange-500" />;
        default:
            return <File {...iconProps} />;
    }

};

const Explorer: React.FC<ExplorerProps> = ({
    fileTree,
    setFileTree,
    currentFile,
    setCurrentFile,
    openFiles,
    setOpenFiles,
    project,
    userAccess,
}) => {
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [newItemPath, setNewItemPath] = useState<string | null>(null);
    const [newItemType, setNewItemType] = useState<"file" | "directory">("file");
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
        new Set()
    );
    const [selectedFolder, setSelectedFolder] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    const isSubmittingRef = useRef<boolean>(false);
    const user = useSelector((state: RootState) => state.auth.user);

    useEffect(() => {
        if ((editingPath || newItemPath) && inputRef.current) {
            inputRef.current.focus();
            if (newItemPath) {
                inputRef.current.select();
            }
        }
    }, [editingPath, newItemPath]);



    useEffect(() => {
        receiveMessage("fileTree-update", (data: any) => {
            setFileTree(data);
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
            }
        );

        receiveMessage(
            "files-imported",
            (data: {
                importedItems: { name: string; type: "file" | "directory" }[];
                username: string;
            }) => {
                console.log("Received files-imported message:", data);
                const importedItems = data.importedItems;
                console.log("Imported items:", importedItems);
                if (importedItems.length > 2) {
                    handleSuccess("This is a test notification.");
                    handleSuccess(
                        `${importedItems[0].name} (${importedItems[0].type}) imported by ${data.username}.`
                    );
                } else {
                    const itemNames = importedItems
                        .map((item) => `${item.name} (${item.type})`)
                        .join(", ");
                    handleSuccess(`${itemNames} imported by ${data.username}.`);
                }
            }
        );
    }, [fileTree, setFileTree, user?.email]);

    const mergeTrees = (target: FileTree, source: FileTree): void => {
        Object.entries(source).forEach(([key, value]) => {
            if ("directory" in value) {
                target[key] = target[key] || { directory: {} };
                mergeTrees(
                    (target[key] as DirectoryContent).directory,
                    value.directory
                );
            } else if ("file" in value) {
                target[key] = value;
            }
        });
    };

    // Helper function to convert files to the desired structure
    const buildFileTree = (files: FileList): FileTree => {
        const tree: FileTree = {};

        Array.from(files).forEach((file) => {
            const pathParts = file.webkitRelativePath.split("/");
            let current: FileNode = { directory: tree };

            pathParts.forEach((part, index) => {
                if (index === pathParts.length - 1) {
                    (current as DirectoryContent).directory![part] = {
                        file: { contents: "" },
                    }; // Add an empty "contents" placeholder for simplicity
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        (
                            (current as DirectoryContent).directory![part] as FileContent
                        ).file.contents = e.target!.result as string;
                    };
                    reader.readAsText(file);
                } else {
                    const nextDir = ((current as DirectoryContent).directory![part] = (
                        current as DirectoryContent
                    ).directory![part] || { directory: {} });
                    current = nextDir;
                }
            });
        });

        return tree;
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;
        if (!files) return;

        console.log("Importing files:", files);

        const newTree = buildFileTree(files);
        const updatedTree = { ...fileTree };
        mergeTrees(updatedTree, newTree);
        setFileTree(updatedTree);
        saveToBackend(updatedTree);

        // Collect details of imported items
        const importedItems: { name: string; type: string }[] = [];
        const collectImportedItems = (tree: FileTree, path: string = "") => {
            Object.entries(tree).forEach(([key, value]) => {
                const fullPath = path ? `${path}/${key}` : key;
                if (isDirectory(value)) {
                    importedItems.push({ name: fullPath, type: "directory" });
                    collectImportedItems(value.directory, fullPath);
                } else if (isFile(value)) {
                    importedItems.push({ name: fullPath, type: "file" });
                }
            });
        };
        collectImportedItems(newTree);

        console.log("Imported items:", importedItems);

        // Send detailed notifications
        sendMessage("files-imported", { importedItems, username: user?.email });
    };

    // Helper function to build ZIP recursively
    const addFilesToZip = (tree: FileTree, parentFolder: JSZip): void => {
        Object.entries(tree).forEach(([key, value]) => {
            if ("file" in value) {
                const fileContent = value.file.contents || ""; // Ensure file contents are not undefined
                parentFolder.file(key, fileContent);
            } else if ("directory" in value) {
                const folder = parentFolder.folder(key);
                if (folder) {
                    addFilesToZip(value.directory, folder);
                }
            }
        });
    };

    // Handle export functionality
    const handleExport = (): void => {
        if (Object.keys(fileTree).length === 0) {
            alert("No files or folders to export.");
            return;
        }

        const zip = new JSZip();

        // If no specific files are selected, export the entire tree
        addFilesToZip(fileTree, zip);

        zip
            .generateAsync({ type: "blob" })
            .then((content) => {
                saveAs(content, `${project.name}.zip`);
            })
            .catch((error) => {
                console.error("Error generating ZIP file:", error);
            });
    };

    const isFile = (node: FileNode): node is FileContent => {
        return "file" in node;
    };

    const isDirectory = (node: FileNode): node is DirectoryContent => {
        return "directory" in node;
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

    /**
     * updateNodeAtPath takes an input tree, a path, a node, and an action.
     * It returns a new tree with the change applied.
     */
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

    const createNewItem = (type: "file" | "directory") => {
        if (project.adminOnlyEdit && !userAccess.isAdmin) return;

        const parentPath = selectedFolder;

        if (parentPath) {
            // Verify the parent path exists and is a directory
            const parent = getNodeAtPath(parentPath);
            if (!parent || !isDirectory(parent)) {
                return;
            }
        }

        const parentChildren =
            parentPath === ""
                ? fileTree
                : (getNodeAtPath(parentPath) as DirectoryContent).directory;

        let baseName = type === "file" ? "untitled" : "new-folder";
        let counter = 1;
        let tempName = `${baseName}${counter}`;
        if (type === "file") tempName += ".txt";

        while (parentChildren[tempName]) {
            counter++;
            tempName = `${baseName}${counter}`;
            if (type === "file") tempName += ".txt";
        }

        const fullPath = parentPath ? `${parentPath}/${tempName}` : tempName;

        // Prepare for edit instead of immediately creating the node
        setNewItemPath(fullPath);
        setNewItemType(type);

        if (parentPath) {
            expandFolder(parentPath);
        }
    };

    const handleNewItemSubmit = (e: React.KeyboardEvent | React.FocusEvent) => {
        if (
            e.type === "keydown" &&
            (e as React.KeyboardEvent).key !== "Enter" &&
            (e as React.KeyboardEvent).key !== "Escape"
        ) {
            return;
        }

        if (!newItemPath || !inputRef.current) {
            setNewItemPath(null);
            setNewItemType("file");
            return;
        }

        if ((e as React.KeyboardEvent).key === "Escape") {
            setNewItemPath(null);
            setNewItemType("file");
            return;
        }

        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        const newName = inputRef.current.value.trim();
        if (!newName) {
            setNewItemPath(null);
            setNewItemType("file");
            isSubmittingRef.current = false;
            return;
        }

        const parts = newItemPath.split("/");
        const parentPath = parts.slice(0, -1).join("/");
        const parentNode = getNodeAtPath(parentPath);

        if (!parentNode || !isDirectory(parentNode)) {
            if (parentPath !== "") {
                setNewItemPath(null);
                setNewItemType("file");
                isSubmittingRef.current = false;
                return;
            }
        }

        const newFullPath = parentPath ? `${parentPath}/${newName}` : newName;
        const parentChildren =
            parentPath === "" ? fileTree : (parentNode as DirectoryContent).directory;

        // Check for duplicates
        if (parentChildren[newName]) {
            handleError(
                `An item named "${newName}" already exists in this location.`
            );
            isSubmittingRef.current = false;
            return;
        }

        try {
            const newNode: FileNode =
                newItemType === "file"
                    ? { file: { contents: "", language: "plaintext" } }
                    : { directory: {} };

            const updatedTree = updateNodeAtPath(
                fileTree,
                newFullPath,
                newNode,
                "create"
            );

            setFileTree(updatedTree);
            broadcastChanges(updatedTree);

            sendMessage("file-created", {
                path: newFullPath,
                type: newItemType,
                username: user?.email,
            });
            handleSuccess(
                `${newItemType.charAt(0).toUpperCase() + newItemType.slice(1)
                } created at "${newFullPath}" by ${user?.email}.`
            );

            if (newItemType === "file") {
                setCurrentFile(newFullPath);
                if (!openFiles.includes(newFullPath)) {
                    setOpenFiles([...openFiles, newFullPath]);
                }
            }
        } catch (error) {
            handleError("Failed to create new item.");
            console.error("Failed to create new item:", error);
        }

        setNewItemPath(null);
        setNewItemType("file");
        isSubmittingRef.current = false;
    };

    const handleRename = (
        e: React.KeyboardEvent | React.FocusEvent,
        oldPath: string
    ) => {
        if (project.adminOnlyEdit && !userAccess.isAdmin) return;

        if (
            e.type === "keydown" &&
            (e as React.KeyboardEvent).key !== "Enter" &&
            (e as React.KeyboardEvent).key !== "Escape"
        ) {
            return;
        }

        if ((e as React.KeyboardEvent).key === "Escape") {
            setEditingPath(null);
            return;
        }

        if (!inputRef.current) {
            setEditingPath(null);
            return;
        }

        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        const newName = inputRef.current.value.trim();
        if (!newName) {
            setEditingPath(null);
            isSubmittingRef.current = false;
            return;
        }

        const parts = oldPath.split("/");
        const parentPath = parts.slice(0, -1).join("/");
        const oldName = parts[parts.length - 1];
        const parentNode = getNodeAtPath(parentPath);

        if (!parentNode || !isDirectory(parentNode)) {
            if (parentPath !== "") {
                setEditingPath(null);
                isSubmittingRef.current = false;
                return;
            }
        }

        const newFullPath = parentPath ? `${parentPath}/${newName}` : newName;
        const parentChildren =
            parentPath === "" ? fileTree : (parentNode as DirectoryContent).directory;

        // Check for duplicates
        if (parentChildren[newName] && newName !== oldName) {
            handleError(
                `An item named "${newName}" already exists in this location.`
            );
            isSubmittingRef.current = false;
            return;
        }

        // If the new name is the same as the old name, exit early
        if (newFullPath === oldPath) {
            setEditingPath(null);
            isSubmittingRef.current = false;
            return;
        }

        try {
            const node = getNodeAtPath(oldPath);
            if (!node) throw new Error("Node not found");

            let updatedTree = updateNodeAtPath(fileTree, oldPath, null, "delete");
            updatedTree = updateNodeAtPath(updatedTree, newFullPath, node, "create");

            if (isFile(node)) {
                const newOpenFiles = openFiles.map((f) =>
                    f === oldPath ? newFullPath : f
                );
                setOpenFiles(newOpenFiles);
                if (currentFile === oldPath) {
                    setCurrentFile(newFullPath);
                }
            } else if (isDirectory(node)) {
                const newExpandedFolders = new Set(expandedFolders);
                if (newExpandedFolders.has(oldPath)) {
                    newExpandedFolders.delete(oldPath);
                    newExpandedFolders.add(newFullPath);
                    setExpandedFolders(newExpandedFolders);
                }

                const updatedOpenFiles = openFiles.map((f) => {
                    if (f.startsWith(oldPath + "/")) {
                        return newFullPath + f.substring(oldPath.length);
                    }
                    return f;
                });

                setOpenFiles(updatedOpenFiles);

                if (currentFile && currentFile.startsWith(oldPath + "/")) {
                    setCurrentFile(newFullPath + currentFile.substring(oldPath.length));
                }
            }

            setFileTree(updatedTree);

            // Only broadcast changes if the name actually changed
            broadcastChanges(updatedTree);

            sendMessage("file-renamed", {
                oldPath,
                newPath: newFullPath,
                username: user?.email,
            });
            const itemType = isDirectory(node) ? "folder" : "file";
            handleSuccess(
                `${itemType.charAt(0).toUpperCase() + itemType.slice(1)
                } renamed from "${oldPath}" to "${newFullPath}" by ${user?.email}.`
            );
        } catch (error) {
            handleError("Failed to rename item.");
            console.error("Failed to rename item:", error);
        }

        setEditingPath(null);
        isSubmittingRef.current = false;
    };

    const deleteItem = (path: string, e: React.MouseEvent) => {
        if (project.adminOnlyEdit && !userAccess.isAdmin) return;

        e.stopPropagation();

        const node = getNodeAtPath(path);
        if (!node) return;

        const confirmMessage = isDirectory(node)
            ? `Are you sure you want to delete the folder "${path}" and all its contents?`
            : `Are you sure you want to delete the file "${path}"?`;

        if (!window.confirm(confirmMessage)) return;

        try {
            const updatedTree = updateNodeAtPath(fileTree, path, null, "delete");

            if (isFile(node)) {
                const newOpenFiles = openFiles.filter((f) => f !== path);
                setOpenFiles(newOpenFiles);
                if (currentFile === path) {
                    setCurrentFile(
                        newOpenFiles.length > 0
                            ? newOpenFiles[newOpenFiles.length - 1]
                            : null
                    );
                }
            } else if (isDirectory(node)) {
                const newExpandedFolders = new Set(expandedFolders);
                newExpandedFolders.delete(path);
                setExpandedFolders(newExpandedFolders);

                const newOpenFiles = openFiles.filter((f) => !f.startsWith(path + "/"));
                setOpenFiles(newOpenFiles);

                if (currentFile && currentFile.startsWith(path + "/")) {
                    setCurrentFile(
                        newOpenFiles.length > 0
                            ? newOpenFiles[newOpenFiles.length - 1]
                            : null
                    );
                }
            }

            setFileTree(updatedTree);
            broadcastChanges(updatedTree);

            sendMessage("file-deleted", { path, username: user?.email });
            const itemType = isDirectory(node) ? "folder" : "file";
            handleSuccess(
                `${itemType.charAt(0).toUpperCase() + itemType.slice(1)
                } deleted at "${path}" by ${user?.email}.`
            );
        } catch (error) {
            handleError("Failed to delete item.");
            console.error("Failed to delete item:", error);
        }

        if (selectedFolder === path) {
            setSelectedFolder("");
        }
    };

    const startRenaming = (path: string, e: React.MouseEvent) => {
        if (project.adminOnlyEdit && !userAccess.isAdmin) return;

        e.stopPropagation();
        setEditingPath(path);
    };

    const handleFileClick = (path: string) => {
        const node = getNodeAtPath(path);
        if (!node) return;

        if (isFile(node)) {
            setCurrentFile(path);
            if (!openFiles.includes(path)) {
                setOpenFiles([...openFiles, path]);
            }
        } else if (isDirectory(node)) {
            toggleFolder(path);
            setSelectedFolder(path);
        }
    };

    const toggleFolder = (path: string) => {
        const newExpandedFolders = new Set(expandedFolders);
        if (newExpandedFolders.has(path)) {
            newExpandedFolders.delete(path);
        } else {
            newExpandedFolders.add(path);
        }
        setExpandedFolders(newExpandedFolders);
    };

    const expandFolder = (path: string) => {
        if (path && !expandedFolders.has(path)) {
            const newExpandedFolders = new Set(expandedFolders);
            newExpandedFolders.add(path);
            setExpandedFolders(newExpandedFolders);
        }
    };

    const truncateFilename = (filename: string, maxLength: number = 20) => {
        if (filename.length <= maxLength) return filename;
        const lastSlash = filename.lastIndexOf("/");
        const basename =
            lastSlash >= 0 ? filename.substring(lastSlash + 1) : filename;
        if (basename.length <= maxLength) return basename;
        const extension =
            basename.lastIndexOf(".") > 0
                ? basename.substring(basename.lastIndexOf("."))
                : "";
        const name = basename.substring(
            0,
            basename.lastIndexOf(".") > 0
                ? basename.lastIndexOf(".")
                : basename.length
        );
        if (name.length <= maxLength - 3 - extension.length) return basename;
        return `${name.substring(
            0,
            maxLength - 3 - extension.length
        )}...${extension}`;
    };

    const saveToBackend = (ft: FileTree) => {
        axios
            .put(`${import.meta.env.VITE_API_URL}/project/update-file-tree`, {
                projectId: project.id,
                fileTree: ft,
            })
            .then((res) => {
                console.log(res);
            })
            .catch((err) => {
                console.error(err);
            });
    };

    /**
     * broadcastChanges sends the updated tree to all connected clients and saves it.
     */
    const broadcastChanges = (updatedFileTree: FileTree) => {
        sendMessage("fileTree-update", updatedFileTree);
        saveToBackend(updatedFileTree);
    };

    const getFolderInfo = () => {
        return selectedFolder ? `${selectedFolder}` : "root";
    };

    // ======= DRAG & DROP FUNCTIONS =======
    const handleDragStart = (e: React.DragEvent, path: string) => {
        e.stopPropagation();
        e.dataTransfer.setData("text/plain", path);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent, targetPath: string) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedPath = e.dataTransfer.getData("text/plain");
        if (draggedPath) {
            // If dropping on a file, get its parent directory
            const targetNode = getNodeAtPath(targetPath);
            if (targetNode && isFile(targetNode)) {
                targetPath = targetPath.split("/").slice(0, -1).join("/");
            }

            // Check if trying to drop into itself or its descendant
            if (
                draggedPath === targetPath ||
                targetPath.startsWith(draggedPath + "/")
            ) {
                handleError("Cannot drop an item into itself or its descendant.");
                return;
            }

            moveItem(draggedPath, targetPath);
        }
    };

    const moveItem = (oldPath: string, newParentPath: string) => {
        const parts = oldPath.split("/");
        const itemName = parts[parts.length - 1];
        const newFullPath = newParentPath
            ? `${newParentPath}/${itemName}`
            : itemName;

        if (oldPath === newFullPath) {
            return;
        }

        const node = getNodeAtPath(oldPath);
        if (!node) return;

        let targetParent: any;
        if (newParentPath === "") {
            targetParent = fileTree;
        } else {
            targetParent = getNodeAtPath(newParentPath);
            if (!targetParent || !isDirectory(targetParent)) {
                handleError("Target folder does not exist.");
                return;
            }
            targetParent = (targetParent as DirectoryContent).directory;
        }

        if (targetParent[itemName]) {
            handleError(
                `An item named "${itemName}" already exists in the target folder.`
            );
            return;
        }

        try {
            let updatedTree = updateNodeAtPath(fileTree, oldPath, null, "delete");
            updatedTree = updateNodeAtPath(updatedTree, newFullPath, node, "create");

            if (isFile(node)) {
                const newOpenFiles = openFiles.map((f) =>
                    f === oldPath ? newFullPath : f
                );
                setOpenFiles(newOpenFiles);
                if (currentFile === oldPath) {
                    setCurrentFile(newFullPath);
                }
            } else if (isDirectory(node)) {
                const updatedOpenFiles = openFiles.map((f) => {
                    if (f === oldPath || f.startsWith(oldPath + "/")) {
                        return newFullPath + f.substring(oldPath.length);
                    }
                    return f;
                });
                setOpenFiles(updatedOpenFiles);
                if (
                    currentFile &&
                    (currentFile === oldPath || currentFile.startsWith(oldPath + "/"))
                ) {
                    setCurrentFile(newFullPath + currentFile.substring(oldPath.length));
                }
                const newExpandedFolders = new Set(expandedFolders);
                if (newExpandedFolders.has(oldPath)) {
                    newExpandedFolders.delete(oldPath);
                    newExpandedFolders.add(newFullPath);
                }
                setExpandedFolders(newExpandedFolders);
            }

            setFileTree(updatedTree);
            broadcastChanges(updatedTree);
            const itemType = isDirectory(node) ? "folder" : "file";
            handleSuccess(
                `${itemType.charAt(0).toUpperCase() + itemType.slice(1)
                } moved from "${oldPath}" to "${newFullPath}" by ${user?.email}.`
            );
        } catch (error) {
            handleError("Failed to move item.");
            console.error("Failed to move item:", error);
        }
    };

    const handleRootDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedPath = e.dataTransfer.getData("text/plain");
        if (draggedPath) {
            moveItem(draggedPath, "");
        }
    };

    // Modified to handle root directory drag over
    const handleRootDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // ======= END DRAG & DROP =======

    const renderTree = (tree: FileTree, basePath: string = ""): JSX.Element[] => {
        return Object.keys(tree)
            .map((name) => {
                const node = tree[name];
                const fullPath = basePath ? `${basePath}/${name}` : name;

                if (isDirectory(node)) {
                    const isExpanded = expandedFolders.has(fullPath);
                    const isSelected = selectedFolder === fullPath;

                    return (
                        <div key={fullPath} className="directory">
                            <div
                                className={`flex justify-between items-center hover:bg-slate-300/50 rounded-md group transition-colors
                                ${isSelected ? "bg-slate-300/70" : ""}`}
                                onClick={() => handleFileClick(fullPath)}
                                draggable={!editingPath}
                                onDragStart={(e) => handleDragStart(e, fullPath)}
                                onDragOver={(e) => handleDragOver(e)}
                                onDragLeave={(e) => handleDragLeave(e)}
                                onDrop={(e) => handleDrop(e, fullPath)}
                            >
                                {editingPath === fullPath ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        defaultValue={name}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === "Escape") {
                                                handleRename(e, fullPath);
                                            }
                                        }}
                                        onBlur={(e) => handleRename(e, fullPath)}
                                        className="p-1 border rounded-md flex-1 m-1 focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <>
                                        <div className="cursor-pointer py-1.5 px-0 flex items-center gap-2 w-full rounded-md overflow-hidden">
                                            <span className="w-4 text-center text-xs text-slate-500">
                                                {isExpanded ? (
                                                    <MdKeyboardArrowDown size={20} />
                                                ) : (
                                                    <MdKeyboardArrowRight size={20} />
                                                )}
                                            </span>
                                            {getIcon(name, true, isExpanded)}
                                            <p className="font-medium truncate text-sm">
                                                {truncateFilename(name)}
                                            </p>
                                        </div>
                                        <div className="flex flex-shrink-0 opacity-0 group-hover:opacity-100 mr-2 transition-opacity">
                                            <button
                                                onClick={(e) => startRenaming(fullPath, e)}
                                                className="p-1 text-slate-600 hover:bg-slate-400/50 rounded-md"
                                                title="Rename"
                                                disabled={project.adminOnlyEdit && !userAccess.isAdmin}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={(e) => deleteItem(fullPath, e)}
                                                className="p-1 text-slate-600 hover:bg-slate-400/50 rounded-md"
                                                title="Delete"
                                                disabled={project.adminOnlyEdit && !userAccess.isAdmin}
                                            >
                                                ❌
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            {isExpanded && node.directory && (
                                <div className="pl-4 border-l border-slate-300 ml-2 mt-1">
                                    {renderTree(node.directory, fullPath)}
                                    {newItemPath && parentPathOf(newItemPath) === fullPath && (
                                        <div className="flex justify-between items-center hover:bg-slate-300 rounded-md group">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                defaultValue=""
                                                onKeyDown={(e) => handleNewItemSubmit(e)}
                                                onBlur={(e) => handleNewItemSubmit(e)}
                                                className="p-1 border rounded-md flex-1 m-1 focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                } else if (isFile(node)) {
                    const isOpen = openFiles.includes(fullPath);
                    return (
                        <div
                            key={fullPath}
                            className={`flex justify-between items-center hover:bg-slate-300/50 rounded-md group transition-colors
                            ${currentFile === fullPath ? "bg-slate-300/70" : ""
                                }`}
                            onClick={() => handleFileClick(fullPath)}
                            draggable={!editingPath}
                            onDragStart={(e) => handleDragStart(e, fullPath)}
                            onDragOver={(e) => handleDragOver(e)}
                            onDragLeave={(e) => handleDragLeave(e)}
                            onDrop={(e) => handleDrop(e, parentPathOf(fullPath))}
                        >
                            {editingPath === fullPath ? (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    defaultValue={name}
                                    onKeyDown={(e) => handleRename(e, fullPath)}
                                    onBlur={(e) => handleRename(e, fullPath)}
                                    className="p-1 border rounded-md flex-1 m-1 focus:ring-2 focus:ring-blue-500"
                                />
                            ) : (
                                <>
                                    <div
                                        className="cursor-pointer py-1.5 px-4 pl-6 flex items-center gap-2 w-full rounded-md overflow-hidden"
                                        title={fullPath}
                                    >
                                        {getIcon(name, false, isOpen)}
                                        <p className="font-medium truncate text-sm">
                                            {truncateFilename(name)}
                                        </p>
                                    </div>
                                    <div className="flex flex-shrink-0 opacity-0 group-hover:opacity-100 mr-2 transition-opacity">
                                        <button
                                            onClick={(e) => startRenaming(fullPath, e)}
                                            className="p-1 text-slate-600 hover:bg-slate-400/50 rounded-md"
                                            title="Rename"
                                            disabled={project.adminOnlyEdit && !userAccess.isAdmin}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={(e) => deleteItem(fullPath, e)}
                                            className="p-1 text-slate-600 hover:bg-slate-400/50 rounded-md"
                                            title="Delete"
                                            disabled={project.adminOnlyEdit && !userAccess.isAdmin}
                                        >
                                            ❌
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                }
                return null;
            })
            .filter(Boolean) as JSX.Element[];
    };

    const parentPathOf = (path: string): string => {
        const parts = path.split("/");
        return parts.slice(0, -1).join("/");
    };

    const renderNewItemAtRoot = () => {
        if (newItemPath && !newItemPath.includes("/")) {
            return (
                <div className="flex justify-between items-center hover:bg-slate-300 rounded group">
                    <input
                        ref={inputRef}
                        type="text"
                        defaultValue=""
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") {
                                handleNewItemSubmit(e);
                            }
                        }}
                        onBlur={(e) => {
                            if (!isSubmittingRef.current) {
                                handleNewItemSubmit(e);
                            }
                        }}
                        className="p-1 border flex-1 m-1"
                    />
                </div>
            );
        }
        return null;
    };

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    setSelectedFolder("");
                }
            }}
            onDrop={handleRootDrop}
            onDragOver={handleRootDragOver}
            className="explorer h-full max-w-64 min-w-64 bg-slate-100 p-2 border-r border-slate-200"
        >
            <ToastContainer />
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="font-bold text-slate-700">Explorer</h3>
                <div className="flex space-x-2">
                    <button
                        onClick={() => createNewItem("file")}
                        className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        title={`New File in ${getFolderInfo()}`}
                        disabled={project.adminOnlyEdit && !userAccess.isAdmin}
                    >
                        <FileText size={14} />
                    </button>
                    <button
                        onClick={() => createNewItem("directory")}
                        className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        title={`New Folder in ${getFolderInfo()}`}
                        disabled={project.adminOnlyEdit && !userAccess.isAdmin}
                    >
                        <Folder size={14} />
                    </button>

                    <label
                        htmlFor="file-input"
                        className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        <CgImport />
                    </label>
                    <input
                        id="file-input"
                        type="file"
                        ref={(input) => {
                            if (input) {
                                input.setAttribute("webkitdirectory", "true");
                                input.setAttribute("directory", "true");
                            }
                        }}
                        multiple
                        style={{ display: "none" }}
                        onChange={handleImport}
                    />
                    {/* 
                    <label htmlFor="file" className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                        <CgImport />
                    </label>
                    <input
                        id="file"
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleImport}
                    /> */}

                    <button
                        onClick={handleExport}
                        className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        <CgExport />
                    </button>
                </div>
            </div>
            <div className="file-tree w-full flex flex-col gap-1">
                {renderTree(fileTree)}
                {renderNewItemAtRoot()}
            </div>
        </div>
    );
};

export default Explorer;
