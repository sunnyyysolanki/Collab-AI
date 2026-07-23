import React from "react";
import { X, User, Trash2, Edit2 } from "lucide-react";

// Using the proper interface structure from the Project component
interface User {
    id: string;
    email: string;
}

interface Collaborator extends User {
    accessLevel: 'admin' | 'readwrite' | 'readonly';
    isCreator?: boolean;
}

interface UserAccess {
    accessLevel: 'admin' | 'readwrite' | 'readonly';
    isAdmin: boolean;
    canWrite: boolean;
}

interface SlidePanelProps {
    isOpen: boolean;
    collaborators: Collaborator[];
    onClose: () => void;
    userAccess?: UserAccess;
    handleRemoveCollaborator?: (userId: string) => Promise<void>;
    handleUpdateCollaboratorAccess?: (userId: string, newAccessLevel: string) => Promise<void>;
}

const SlidePanel: React.FC<SlidePanelProps> = ({
    isOpen,
    collaborators,
    onClose,
    userAccess,
    handleRemoveCollaborator,
    handleUpdateCollaboratorAccess
}) => {
    // Helper function to get badge color based on access level
    const getBadgeColor = (accessLevel: string, isCreator?: boolean) => {
        if (isCreator) return "bg-purple-100 text-purple-800";
        switch (accessLevel) {
            case "admin": return "bg-red-100 text-red-800";
            case "readwrite": return "bg-green-100 text-green-800";
            case "readonly": return "bg-blue-100 text-blue-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    // Helper function to get a readable name for the access level
    const getAccessLevelLabel = (accessLevel: string, isCreator?: boolean) => {
        if (isCreator) return "Creator";
        switch (accessLevel) {
            case "admin": return "Admin";
            case "readwrite": return "Edit";
            case "readonly": return "View";
            default: return accessLevel;
        }
    };

    // Generate access level options for dropdown
    // const accessLevelOptions = [
    //     { value: "admin", label: "Admin" },
    //     { value: "readwrite", label: "Edit" },
    //     { value: "readonly", label: "View" }
    // ];
    console.log(collaborators)
    return (
        <div
            className={`slidepanel w-full h-full flex flex-col bg-slate-50 absolute top-0 left-0 z-10 transition-all duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"
                }`}
        >
            <header className="flex justify-between items-center p-4 bg-slate-200">
                <h1 className="font-semibold text-lg">Project Collaborators</h1>
                <button
                    className="p-2 rounded-full hover:bg-slate-300 transition-colors"
                    onClick={onClose}
                >
                    <X size={18} className="text-slate-700" />
                </button>
            </header>

            <div className="collaborators-list flex flex-col gap-2 p-4 overflow-y-auto">
                {collaborators.length === 0 ? (
                    <p className="text-slate-500 italic">No collaborators yet</p>
                ) : (
                    collaborators.map((collaborator) => (
                        <div
                            key={collaborator.id}
                            className="collaborator flex justify-between items-center p-3 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="avatar flex-shrink-0 w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center">
                                    <User size={20} className="text-slate-600" />
                                </div>
                                <div className="user-info">
                                    <p className="font-medium">{collaborator.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`access-badge px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor(collaborator.accessLevel, collaborator.isCreator)}`}>
                                    {getAccessLevelLabel(collaborator.accessLevel, collaborator.isCreator)}
                                </div>

                                {userAccess?.isAdmin && !collaborator.isCreator && (
                                    <div className="flex items-center">
                                        <button
                                            className="p-1.5 rounded-full hover:bg-slate-200 transition-colors"
                                            onClick={() => {
                                                if (handleUpdateCollaboratorAccess) {
                                                    // Simple dropdown for access level change
                                                    const newLevel = window.prompt(
                                                        "Select new access level: admin, readwrite, readonly",
                                                        collaborator.accessLevel
                                                    );
                                                    if (newLevel && ['admin', 'readwrite', 'readonly'].includes(newLevel)) {
                                                        handleUpdateCollaboratorAccess(collaborator.id, newLevel);
                                                    }
                                                }
                                            }}
                                        >
                                            <Edit2 size={16} className="text-slate-600" />
                                        </button>
                                        <button
                                            className="p-1.5 rounded-full hover:bg-red-100 transition-colors"
                                            onClick={() => {
                                                if (handleRemoveCollaborator && confirm(`Remove ${collaborator.email} from this project?`)) {
                                                    handleRemoveCollaborator(collaborator.id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={16} className="text-red-600" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-auto p-4 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                    Access levels: Creator (owner), Admin (can manage users), Edit (can modify files), View (read-only access)
                </p>
            </div>
        </div>
    );
};

export default SlidePanel;