// import React, { useState } from "react";
// import { useSelector } from "react-redux";
// import { RootState } from "../App/store";
// import { IoMdRemoveCircleOutline } from "react-icons/io";
// import { X, Check, AlertCircle } from "lucide-react";

// interface User {
//     id: string;
//     email: string;
// }

// interface Collaborator {
//     id: string;
//     email: string;
//     accessLevel: 'admin' | 'readwrite' | 'readonly';
//     isCreator?: boolean;
// }

// interface FileContent {
//     file: {
//         contents: string;
//         language?: string;
//     };
// }

// interface DirectoryContent {
//     directory: {
//         [key: string]: FileNode;
//     };
// }

// type FileNode = FileContent | DirectoryContent;

// interface FileTree {
//     [key: string]: FileNode;
// }

// interface Project {
//     id: string;
//     name: string;
//     creator: string;
//     language: string;
//     description?: string;
//     fileTree: FileTree;
//     version: number;
//     adminOnlyEdit: boolean; // New field
// }

// interface UserAccess {
//     accessLevel: 'admin' | 'readwrite' | 'readonly';
//     isAdmin: boolean;
//     canWrite: boolean;
// }

// interface CollaboratorModalProps {
//     collaborators: Collaborator[];
//     allUsers: User[];
//     handleAddCollaborators: (selectedUsers: string[], accessLevel: string) => void;
//     handleRemoveCollaborator: (userId: string) => void;
//     handleUpdateCollaboratorAccess: (userId: string, accessLevel: string) => void;
//     onClose: () => void;
//     project: Project;
//     userAccess: UserAccess;
//     handleToggleAdminOnlyEdit: (projectId: string, adminOnlyEdit: boolean) => void; // New prop
// }

// const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
//     collaborators,
//     allUsers,
//     handleAddCollaborators,
//     handleRemoveCollaborator,
//     handleUpdateCollaboratorAccess,
//     onClose,
//     project,
//     userAccess,
//     handleToggleAdminOnlyEdit // New prop
// }) => {
//     const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
//     const [accessLevel, setAccessLevel] = useState<string>("readonly");
//     const [expandedUser, setExpandedUser] = useState<string | null>(null);
//     const { user } = useSelector((state: RootState) => state.auth);

//     const creatorId = project.creator;
//     const isAdmin = userAccess?.isAdmin === true;

//     const availableUsers = allUsers.filter(
//         (user) => !collaborators.some((c) => c.id === user.id)
//     );

//     const toggleUserExpand = (userId: string) => {
//         if (expandedUser === userId) {
//             setExpandedUser(null);
//         } else {
//             setExpandedUser(userId);
//         }
//     };

//     const handleRemoveClick = (e: React.MouseEvent, userId: string) => {
//         e.stopPropagation();
//         handleRemoveCollaborator(userId);
//     };

//     const handleAccessLevelChange = (userId: string, newAccessLevel: string) => {
//         handleUpdateCollaboratorAccess(userId, newAccessLevel);
//         setExpandedUser(null);
//     };

//     const handleAddCollaboratorsClick = () => {
//         handleAddCollaborators(selectedUsers, accessLevel);
//         setSelectedUsers([]);
//     };

//     const handleToggleAdminOnlyEditChange = () => {
//         handleToggleAdminOnlyEdit(project.id, !project.adminOnlyEdit);
//     };

//     return (
//         <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//             <div className="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
//                 <div className="modal-header mb-4 flex justify-between items-center">
//                     <h2 className="text-xl font-bold">Project Collaborators</h2>
//                     <button
//                         onClick={onClose}
//                         className="p-1 rounded-full hover:bg-slate-100"
//                         aria-label="Close"
//                     >
//                         <X size={20} className="text-slate-500" />
//                     </button>
//                 </div>

//                 {/* 
//                 {isAdmin && (
//                     <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
//                         <AlertCircle size={18} className="text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
//                         <div className="text-sm text-yellow-800">
//                             Only project admins can add users with elevated permissions or modify existing permissions.
//                         </div>
//                     </div>
//                 )} */}

//                 {!project.adminOnlyEdit && (
//                     <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
//                         <AlertCircle size={18} className="text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
//                         <div className="text-sm text-yellow-800">
//                             The "Admin Only" mode is currently disabled, allowing all authorized users to manage permissions, add collaborators, and edit files.
//                         </div>
//                     </div>
//                 )}
//                 {project.adminOnlyEdit && (
//                     <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
//                         <AlertCircle size={18} className="text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
//                         <div className="text-sm text-yellow-800">
//                             The "Admin Only" mode is enabled, restricting the ability to add users with elevated permissions, modify existing permissions, or edit files exclusively to project admins.
//                         </div>
//                     </div>
//                 )}


//                 {isAdmin && (
//                     <div className="mb-4 flex items-center gap-2">
//                         <input
//                             type="checkbox"
//                             id="adminOnlyEdit"
//                             checked={project.adminOnlyEdit}
//                             onChange={handleToggleAdminOnlyEditChange}
//                             className="w-4 h-4"
//                         />
//                         <label htmlFor="adminOnlyEdit" className="text-sm font-medium text-gray-700">
//                             Only admins can edit and add collaborators
//                         </label>
//                     </div>
//                 )}

//                 <div className="modal-body">
//                     <div className="current-collaborators mb-6">
//                         <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Current Collaborators</h3>
//                         <div className="flex flex-col gap-2">
//                             {collaborators.map((collaborator) => (
//                                 <div key={collaborator.id} className="border rounded">
//                                     <div
//                                         className={`flex items-center justify-between gap-2 p-2.5 ${isAdmin ? 'cursor-pointer hover:bg-slate-50' : ''}`}
//                                         onClick={() => isAdmin && toggleUserExpand(collaborator.id)}
//                                     >
//                                         <div className="flex items-center gap-2">
//                                             <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center">
//                                                 <span className="text-white font-semibold">
//                                                     {collaborator.email[0].toUpperCase()}
//                                                 </span>
//                                             </div>
//                                             <div className="flex flex-col">
//                                                 <span className="font-medium">{collaborator.email}</span>
//                                                 <div className="flex gap-1.5 mt-0.5">
//                                                     {collaborator.id === creatorId && (
//                                                         <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
//                                                             Creator
//                                                         </span>
//                                                     )}
//                                                     {collaborator.id === user?.id && (
//                                                         <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
//                                                             You
//                                                         </span>
//                                                     )}
//                                                     <span
//                                                         className={`text-xs px-1.5 py-0.5 rounded ${collaborator.accessLevel === 'admin'
//                                                             ? 'bg-purple-100 text-purple-700'
//                                                             : collaborator.accessLevel === 'readwrite'
//                                                                 ? 'bg-indigo-100 text-indigo-700'
//                                                                 : 'bg-gray-100 text-gray-700'
//                                                             }`}
//                                                     >
//                                                         {collaborator.accessLevel === 'admin'
//                                                             ? 'Admin'
//                                                             : collaborator.accessLevel === 'readwrite'
//                                                                 ? 'Can Edit'
//                                                                 : 'Read Only'}
//                                                     </span>
//                                                 </div>
//                                             </div>
//                                         </div>

//                                         {isAdmin && collaborator.id !== creatorId && collaborator.id !== user?.id && (
//                                             <button
//                                                 onClick={(e) => handleRemoveClick(e, collaborator.id)}
//                                                 className="text-red-600 hover:text-red-800 p-1 rounded"
//                                                 aria-label={`Remove ${collaborator.email}`}
//                                             >
//                                                 <IoMdRemoveCircleOutline size={20} />
//                                             </button>
//                                         )}
//                                     </div>

//                                     {isAdmin && expandedUser === collaborator.id && collaborator.id !== creatorId && (
//                                         <div className="p-3 bg-slate-50 border-t">
//                                             <h4 className="text-xs font-semibold mb-2">Change Access Level</h4>
//                                             <div className="flex gap-2">
//                                                 <button
//                                                     onClick={() => handleAccessLevelChange(collaborator.id, 'readonly')}
//                                                     className={`px-3 py-1 text-sm rounded ${collaborator.accessLevel === 'readonly'
//                                                         ? 'bg-gray-800 text-white'
//                                                         : 'bg-gray-200 hover:bg-gray-300'
//                                                         }`}
//                                                 >
//                                                     Read Only
//                                                 </button>
//                                                 <button
//                                                     onClick={() => handleAccessLevelChange(collaborator.id, 'readwrite')}
//                                                     className={`px-3 py-1 text-sm rounded ${collaborator.accessLevel === 'readwrite'
//                                                         ? 'bg-gray-800 text-white'
//                                                         : 'bg-gray-200 hover:bg-gray-300'
//                                                         }`}
//                                                 >
//                                                     Can Edit
//                                                 </button>
//                                                 <button
//                                                     onClick={() => handleAccessLevelChange(collaborator.id, 'admin')}
//                                                     className={`px-3 py-1 text-sm rounded ${collaborator.accessLevel === 'admin'
//                                                         ? 'bg-gray-800 text-white'
//                                                         : 'bg-gray-200 hover:bg-gray-300'
//                                                         }`}
//                                                 >
//                                                     Admin
//                                                 </button>
//                                             </div>
//                                         </div>
//                                     )}
//                                 </div>
//                             ))}
//                         </div>
//                     </div>

//                     {(isAdmin || (!project.adminOnlyEdit && userAccess.canWrite)) && (
//                         <>
//                             <div className="mb-4">
//                                 <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Add New Collaborators</h3>

//                                 <div className="mb-3">
//                                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                                         Access Level
//                                     </label>
//                                     <select
//                                         className="w-full p-2 border rounded"
//                                         value={accessLevel}
//                                         onChange={(e) => setAccessLevel(e.target.value)}
//                                         disabled={!isAdmin && accessLevel !== 'readonly'}
//                                     >
//                                         <option value="readonly">Read Only</option>
//                                         {isAdmin && (
//                                             <>
//                                                 <option value="readwrite">Can Edit</option>
//                                                 <option value="admin">Admin</option>
//                                             </>
//                                         )}
//                                     </select>

//                                     {!isAdmin && (
//                                         <p className="text-xs text-gray-500 mt-1">
//                                             You can only add users with read-only access.
//                                         </p>
//                                     )}
//                                 </div>
//                             </div>

//                             <div className="available-users max-h-72 overflow-y-auto border rounded mb-4">
//                                 {availableUsers.length === 0 ? (
//                                     <div className="p-4 text-center text-gray-500">
//                                         No more users available to add
//                                     </div>
//                                 ) : (
//                                     <>
//                                         {availableUsers.map((availableUser) => (
//                                             <div
//                                                 key={availableUser.id}
//                                                 className="flex items-center gap-2 p-2.5 hover:bg-slate-50 border-b last:border-b-0"
//                                             >
//                                                 <input
//                                                     type="checkbox"
//                                                     id={`user-${availableUser.id}`}
//                                                     checked={selectedUsers.includes(availableUser.id)}
//                                                     onChange={() =>
//                                                         setSelectedUsers((prev) =>
//                                                             prev.includes(availableUser.id)
//                                                                 ? prev.filter((id) => id !== availableUser.id)
//                                                                 : [...prev, availableUser.id]
//                                                         )
//                                                     }
//                                                     className="w-4 h-4"
//                                                 />
//                                                 <label
//                                                     htmlFor={`user-${availableUser.id}`}
//                                                     className="cursor-pointer flex-1 flex items-center gap-2"
//                                                 >
//                                                     <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center">
//                                                         <span className="text-white font-semibold">
//                                                             {availableUser.email[0].toUpperCase()}
//                                                         </span>
//                                                     </div>
//                                                     <span className="font-medium">{availableUser.email}</span>
//                                                 </label>
//                                             </div>
//                                         ))}
//                                     </>
//                                 )}
//                             </div>
//                         </>
//                     )}
//                 </div>

//                 <div className="modal-footer mt-6 flex justify-end gap-2">
//                     <button
//                         className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
//                         onClick={onClose}
//                     >
//                         Cancel
//                     </button>

//                     {(isAdmin || (!project.adminOnlyEdit && userAccess.canWrite)) && (
//                         <button
//                             className="px-4 py-2 bg-slate-950 text-white rounded hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed"
//                             onClick={handleAddCollaboratorsClick}
//                             disabled={selectedUsers.length === 0 || availableUsers.length === 0}
//                         >
//                             Add Selected
//                         </button>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default CollaboratorModal;
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { IoMdRemoveCircleOutline } from 'react-icons/io';
import { X, AlertCircle } from 'lucide-react';
import { handleSuccess } from '../config/toastUtility';
import { RootState } from '../App/store'; // Adjust the import path
import { initializeSocket, sendMessage, receiveMessage } from '../config/socket'; // Adjust the import path

interface User {
    id: string;
    email: string;
}

interface Collaborator {
    id: string;
    email: string;
    accessLevel: 'admin' | 'readwrite' | 'readonly';
    isCreator?: boolean;
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

interface Project {
    id: string;
    name: string;
    creator: string;
    language: string;
    description?: string;
    fileTree: FileTree;
    version: number;
    adminOnlyEdit: boolean;
}

interface UserAccess {
    accessLevel: 'admin' | 'readwrite' | 'readonly';
    isAdmin: boolean;
    canWrite: boolean;
}

interface CollaboratorModalProps {
    collaborators: Collaborator[];
    allUsers: User[];
    handleAddCollaborators: (selectedUsers: string[], accessLevel: string) => void;
    handleRemoveCollaborator: (userId: string) => void;
    handleUpdateCollaboratorAccess: (userId: string, accessLevel: string) => void;
    onClose: () => void;
    project: Project;
    userAccess: UserAccess;
    handleToggleAdminOnlyEdit: (projectId: string, adminOnlyEdit: boolean) => void;
}

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
    collaborators,
    allUsers,
    handleAddCollaborators,
    handleRemoveCollaborator,
    handleUpdateCollaboratorAccess,
    onClose,
    project,
    userAccess,
    handleToggleAdminOnlyEdit
}) => {
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [accessLevel, setAccessLevel] = useState<string>('readonly');
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const { user } = useSelector((state: RootState) => state.auth);

    const creatorId = project.creator;
    const isAdmin = userAccess?.isAdmin === true;

    const availableUsers = allUsers.filter(
        (user) => !collaborators.some((c) => c.id === user.id)
    );

    const toggleUserExpand = (userId: string) => {
        if (expandedUser === userId) {
            setExpandedUser(null);
        } else {
            setExpandedUser(userId);
        }
    };

    const handleRemoveClick = (e: React.MouseEvent, userId: string) => {
        e.stopPropagation();
        handleRemoveCollaborator(userId);

        // Emit event to notify all users
        sendMessage('removeCollaborator', {
            removedBy: user?.email,
            userId
        });

        // Show success notification
        const removedUserEmail = allUsers.find(u => u.id === userId)?.email;
        handleSuccess(`Collaborator ${removedUserEmail} removed by ${user?.email}`);
    };

    const handleAccessLevelChange = (userId: string, newAccessLevel: string) => {
        handleUpdateCollaboratorAccess(userId, newAccessLevel);
        setExpandedUser(null);

        // Emit event to notify all users
        sendMessage('updateAccessLevel', {
            changedBy: user?.email,
            userId,
            newAccessLevel
        });

        // Show success notification
        const changedUserEmail = allUsers.find(u => u.id === userId)?.email;
        handleSuccess(`Access level changed to ${newAccessLevel} for ${changedUserEmail} by ${user?.email}`);
    };

    const handleAddCollaboratorsClick = () => {
        handleAddCollaborators(selectedUsers, accessLevel);
        setSelectedUsers([]);

        // Emit event to notify all users
        sendMessage('addCollaborator', {
            addedBy: user?.email,
            collaborators: selectedUsers.map(id => ({
                id,
                accessLevel
            }))
        });

        // Construct the success message
        const addedUsers = selectedUsers.map(id => ({
            email: allUsers.find(u => u.id === id)?.email,
            accessLevel
        })).filter(Boolean);

        const message = addedUsers.length > 4
            ? `Collaborators added successfully by ${user?.email}: ${addedUsers.slice(0, 4).map(u => `${u.email} (${u.accessLevel})`).join(', ')} and +${addedUsers.length - 4} more`
            : `Collaborators added successfully by ${user?.email}: ${addedUsers.map(u => `${u.email} (${u.accessLevel})`).join(', ')}`;

        // Show success notification
        handleSuccess(message);
    };

    const handleToggleAdminOnlyEditChange = () => {
        handleToggleAdminOnlyEdit(project.id, !project.adminOnlyEdit);

        // Emit event to notify all users
        sendMessage('toggleAdminOnlyMode', {
            toggledBy: user?.email,
            adminOnlyEdit: !project.adminOnlyEdit
        });

        // Show success notification
        handleSuccess(`Admin Only mode ${!project.adminOnlyEdit ? 'enabled' : 'disabled'} by ${user?.email}`);
    };

    useEffect(() => {
        // Initialize the socket connection
        initializeSocket(project.id);

        // Listen for events
        receiveMessage('collaboratorAdded', (data: { addedBy: string, collaborators: Array<{ id: string, accessLevel: string }> }) => {
            const addedUsers = data.collaborators.map(c => ({
                email: allUsers.find(u => u.id === c.id)?.email,
                accessLevel: c.accessLevel
            })).filter(Boolean);

            const message = addedUsers.length > 4
                ? `Collaborators added by ${data.addedBy}: ${addedUsers.slice(0, 4).map(u => `${u.email} (${u.accessLevel})`).join(', ')} and +${addedUsers.length - 4} more`
                : `Collaborators added by ${data.addedBy}: ${addedUsers.map(u => `${u.email} (${u.accessLevel})`).join(', ')}`;

            handleSuccess(message);
        });

        receiveMessage('removeCollaborator', (data: { removedBy: string, userId: string }) => {
            const removedUserEmail = allUsers.find(u => u.id === data.userId)?.email;
            handleSuccess(`Collaborator ${removedUserEmail} removed by ${data.removedBy}`);
        });

        receiveMessage('updateAccessLevel', (data: { changedBy: string, userId: string, newAccessLevel: string }) => {
            const changedUserEmail = allUsers.find(u => u.id === data.userId)?.email;
            handleSuccess(`Access level changed to ${data.newAccessLevel} for ${changedUserEmail} by ${data.changedBy}`);
        });

        receiveMessage('adminOnlyModeToggled', (data: { toggledBy: string, adminOnlyEdit: boolean }) => {
            handleSuccess(`Admin Only mode ${data.adminOnlyEdit ? 'enabled' : 'disabled'} by ${data.toggledBy}`);
        });


    }, [project.id]);

    return (
        <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
                <div className="modal-header mb-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Project Collaborators</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100"
                        aria-label="Close"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {!project.adminOnlyEdit && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                        <AlertCircle size={18} className="text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-800">
                            The "Admin Only" mode is currently disabled, allowing all authorized users to manage permissions, add collaborators, and edit files.
                        </div>
                    </div>
                )}
                {project.adminOnlyEdit && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                        <AlertCircle size={18} className="text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-800">
                            The "Admin Only" mode is enabled, restricting the ability to add users with elevated permissions, modify existing permissions, or edit files exclusively to project admins.
                        </div>
                    </div>
                )}

                {isAdmin && (
                    <div className="mb-4 flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="adminOnlyEdit"
                            checked={project.adminOnlyEdit}
                            onChange={handleToggleAdminOnlyEditChange}
                            className="w-4 h-4"
                        />
                        <label htmlFor="adminOnlyEdit" className="text-sm font-medium text-gray-700">
                            Only admins can edit and add collaborators
                        </label>
                    </div>
                )}

                <div className="modal-body">
                    <div className="current-collaborators mb-6">
                        <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Current Collaborators</h3>
                        <div className="flex flex-col gap-2">
                            {collaborators.map((collaborator) => (
                                <div key={collaborator.id} className="border rounded">
                                    <div
                                        className={`flex items-center justify-between gap-2 p-2.5 ${isAdmin ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                        onClick={() => isAdmin && toggleUserExpand(collaborator.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center">
                                                <span className="text-white font-semibold">
                                                    {collaborator.email[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{collaborator.email}</span>
                                                <div className="flex gap-1.5 mt-0.5">
                                                    {collaborator.id === creatorId && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                                            Creator
                                                        </span>
                                                    )}
                                                    {collaborator.id === user?.id && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                            You
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-xs px-1.5 py-0.5 rounded ${collaborator.accessLevel === 'admin'
                                                            ? 'bg-purple-100 text-purple-700'
                                                            : collaborator.accessLevel === 'readwrite'
                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                            }`}
                                                    >
                                                        {collaborator.accessLevel === 'admin'
                                                            ? 'Admin'
                                                            : collaborator.accessLevel === 'readwrite'
                                                                ? 'Can Edit'
                                                                : 'Read Only'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {isAdmin && collaborator.id !== creatorId && collaborator.id !== user?.id && (
                                            <button
                                                onClick={(e) => handleRemoveClick(e, collaborator.id)}
                                                className="text-red-600 hover:text-red-800 p-1 rounded"
                                                aria-label={`Remove ${collaborator.email}`}
                                            >
                                                <IoMdRemoveCircleOutline size={20} />
                                            </button>
                                        )}
                                    </div>

                                    {isAdmin && expandedUser === collaborator.id && collaborator.id !== creatorId && (
                                        <div className="p-3 bg-slate-50 border-t">
                                            <h4 className="text-xs font-semibold mb-2">Change Access Level</h4>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleAccessLevelChange(collaborator.id, 'readonly')}
                                                    className={`px-3 py-1 text-sm rounded ${collaborator.accessLevel === 'readonly'
                                                        ? 'bg-gray-800 text-white'
                                                        : 'bg-gray-200 hover:bg-gray-300'
                                                        }`}
                                                >
                                                    Read Only
                                                </button>
                                                <button
                                                    onClick={() => handleAccessLevelChange(collaborator.id, 'readwrite')}
                                                    className={`px-3 py-1 text-sm rounded ${collaborator.accessLevel === 'readwrite'
                                                        ? 'bg-gray-800 text-white'
                                                        : 'bg-gray-200 hover:bg-gray-300'
                                                        }`}
                                                >
                                                    Can Edit
                                                </button>
                                                <button
                                                    onClick={() => handleAccessLevelChange(collaborator.id, 'admin')}
                                                    className={`px-3 py-1 text-sm rounded ${collaborator.accessLevel === 'admin'
                                                        ? 'bg-gray-800 text-white'
                                                        : 'bg-gray-200 hover:bg-gray-300'
                                                        }`}
                                                >
                                                    Admin
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {(isAdmin || (!project.adminOnlyEdit && userAccess.canWrite)) && (
                        <>
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Add New Collaborators</h3>

                                <div className="mb-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Access Level
                                    </label>
                                    <select
                                        className="w-full p-2 border rounded"
                                        value={accessLevel}
                                        onChange={(e) => setAccessLevel(e.target.value)}
                                        disabled={!isAdmin && accessLevel !== 'readonly'}
                                    >
                                        <option value="readonly">Read Only</option>
                                        {isAdmin && (
                                            <>
                                                <option value="readwrite">Can Edit</option>
                                                <option value="admin">Admin</option>
                                            </>
                                        )}
                                    </select>

                                    {!isAdmin && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            You can only add users with read-only access.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="available-users max-h-72 overflow-y-auto border rounded mb-4">
                                {availableUsers.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500">
                                        No more users available to add
                                    </div>
                                ) : (
                                    <>
                                        {availableUsers.map((availableUser) => (
                                            <div
                                                key={availableUser.id}
                                                className="flex items-center gap-2 p-2.5 hover:bg-slate-50 border-b last:border-b-0"
                                            >
                                                <input
                                                    type="checkbox"
                                                    id={`user-${availableUser.id}`}
                                                    checked={selectedUsers.includes(availableUser.id)}
                                                    onChange={() =>
                                                        setSelectedUsers((prev) =>
                                                            prev.includes(availableUser.id)
                                                                ? prev.filter((id) => id !== availableUser.id)
                                                                : [...prev, availableUser.id]
                                                        )
                                                    }
                                                    className="w-4 h-4"
                                                />
                                                <label
                                                    htmlFor={`user-${availableUser.id}`}
                                                    className="cursor-pointer flex-1 flex items-center gap-2"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center">
                                                        <span className="text-white font-semibold">
                                                            {availableUser.email[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium">{availableUser.email}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer mt-6 flex justify-end gap-2">
                    <button
                        className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
                        onClick={onClose}
                    >
                        Cancel
                    </button>

                    {(isAdmin || (!project.adminOnlyEdit && userAccess.canWrite)) && (
                        <button
                            className="px-4 py-2 bg-slate-950 text-white rounded hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed"
                            onClick={handleAddCollaboratorsClick}
                            disabled={selectedUsers.length === 0 || availableUsers.length === 0}
                        >
                            Add Selected
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CollaboratorModal;
