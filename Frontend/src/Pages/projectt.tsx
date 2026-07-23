// import React, { useEffect, useState, useRef } from "react";
// import { useLocation } from "react-router-dom";
// import axios from "../config/axios";
// import { initializeSocket, receiveMessage, sendMessage } from "../config/socket";
// import { useSelector } from "react-redux";
// import { RootState } from "../App/store";
// import Markdown from "markdown-to-jsx";

// interface User {
//     id: string;
//     email: string;
// }

// interface Project {
//     id: string;
//     name: string;
//     users: User[];
//     version: number;
// }

// interface Message {
//     sender: string;
//     message: string;
//     type: "incoming" | "outgoing";
// }

// const Project = () => {
//     const location = useLocation();
//     const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);
//     const [isModalOpen, setIsModalOpen] = useState(false);
//     const [collaborators, setCollaborators] = useState<User[]>([]);
//     const [project, setProject] = useState<Project>(location.state.project);
//     const [allUsers, setAllUsers] = useState<User[]>([]);
//     const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
//     const [message, setMessage] = useState<string>("");
//     const [messages, setMessages] = useState<Message[]>([]);
//     const { user } = useSelector((state: RootState) => state.auth);
//     const messageBoxRef = useRef<HTMLDivElement>(null);

//     useEffect(() => {
//         initializeSocket(project.id);

//         receiveMessage("project-message", (data) => {
//             if (user && data.sender.email !== user.email) {
//                 console.log("Received message:", data);
//                 setMessages((prevMessages) => [
//                     ...prevMessages,
//                     { sender: data.sender.email, message: data.message, type: "incoming" },
//                 ]);
//             }
//         });

//         axios.get<{ project: Project }>(`/project/get-project/${location.state.project.id}`)
//             .then((res) => setCollaborators(res.data.project.users))
//             .catch((err) => console.error("Error fetching project data:", err));

//         axios.get<User[]>("/users/all")
//             .then((res) => setAllUsers(res.data))
//             .catch((err) => console.error("Error fetching users:", err));
//     }, []);

//     const handleSendMessage = () => {
//         if (message.trim() && user) {
//             const newMessage: Message = {
//                 sender: user.email,
//                 message,
//                 type: "outgoing",
//             };
//             setMessages((prevMessages) => [...prevMessages, newMessage]);
//             sendMessage("project-message", { message, sender: user.email });
//             setMessage("");
//         } else {
//             console.error("Message is empty or user is not authenticated.");
//         }
//     };

//     useEffect(() => {
//         if (messageBoxRef.current) {
//             messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight;
//         }
//     }, [messages]);

//     return (
//         <main className="h-screen w-screen flex">
//             <section className="left relative flex flex-col h-full min-w-96 bg-slate-300">
//                 <header className="flex justify-between items-center p-2 px-4 w-full bg-slate-100">
//                     <button className="flex gap-2" onClick={() => setIsModalOpen(true)}>
//                         <i className="ri-add-large-fill"></i>
//                         Add Collaborator
//                     </button>
//                     <button onClick={() => setIsSlidePanelOpen(!isSlidePanelOpen)} className="p-2">
//                         <i className="ri-group-fill"></i>
//                     </button>
//                 </header>

//                 <div className="conversation-area h-[calc(100vh-56px)] flex flex-col">
//                     <div
//                         ref={messageBoxRef}
//                         className="message-box p-1 flex flex-1 flex-col gap-1 overflow-y-scroll custom-scrollbar"
//                     >
//                         {messages.map((msg, index) => (
//                             <div
//                                 key={index}
//                                 className={`message max-w-56 flex flex-col p-2 rounded-md ${msg.type === "incoming"
//                                     ? "bg-slate-50 w-fit"
//                                     : "bg-blue-500 text-white w-fit ml-auto"
//                                     }`}
//                             >
//                                 <small className="opacity-65 text-xs">{msg.sender}</small>
//                                 <Markdown className="text-sm">{msg.message}</Markdown>
//                             </div>
//                         ))}
//                     </div>

//                     <div className="inputField w-full flex">
//                         <input
//                             type="text"
//                             value={message}
//                             onChange={(e) => setMessage(e.target.value)}
//                             className="flex-grow p-2 px-4 border-none outline-none"
//                             placeholder="Enter message"
//                         />
//                         <button
//                             onClick={handleSendMessage}
//                             className="px-5 bg-slate-950 text-white"
//                         >
//                             <i className="ri-send-plane-fill"></i>
//                         </button>
//                     </div>

//                     <div className={`slidepanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute top-0 transition-all ${isSlidePanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
//                         <header className='flex justify-between items-center p-2 px-4 bg-slate-200'>
//                             <h1 className='font-semibold text-lg'>Collaborators</h1>
//                             <button className='p-2' onClick={() => setIsSlidePanelOpen(!isSlidePanelOpen)}>
//                                 <i className="ri-close-circle-line"></i>
//                             </button>
//                         </header>

//                         <div className="users flex flex-col gap-2">
//                             {collaborators.map((user) => (
//                                 <div key={user.id} className="user flex gap-2 cursor-pointer items-center hover:bg-slate-200 p-2">
//                                     <div className='aspect-square rounded-full w-fit h-fit p-4 flex items-center justify-center bg-slate-500 text-white'>
//                                         <i className="ri-user-fill absolute"></i>
//                                     </div>
//                                     <h1 className='font-semibold text-lg'>{user.email}</h1>
//                                 </div>
//                             ))}
//                         </div>
//                     </div>
//                 </div>
//             </section>

//             {/* Collaborator Modal */}
//             {isModalOpen && (
//                 <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
//                     <div className="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4">
//                         <div className="modal-header mb-4">
//                             <h2 className="text-xl font-bold">Add Collaborators</h2>
//                         </div>

//                         <div className="modal-body">
//                             <div className="current-collaborators mb-6">
//                                 <h3 className="text-sm font-semibold mb-2">Current Collaborators</h3>
//                                 <div className="flex flex-col gap-2">
//                                     {collaborators.map((user) => (
//                                         <div key={user.id} className="flex items-center gap-2 p-2 bg-slate-100 rounded">
//                                             <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center">
//                                                 <i className="ri-user-fill text-white"></i>
//                                             </div>
//                                             <span>{user.email}</span>
//                                         </div>
//                                     ))}
//                                 </div>
//                             </div>
//                             <div className="available-users max-h-72 overflow-scroll">
//                                 <h3 className="text-sm font-semibold mb-2">Available Users</h3>
//                                 <div className="flex flex-col gap-2">
//                                     {allUsers
//                                         .filter((user) => !collaborators.some((c) => c.id === user.id))
//                                         .map((user) => (
//                                             <div key={user.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded">
//                                                 <input
//                                                     type="checkbox"
//                                                     id={`user-${user.id}`}
//                                                     checked={selectedUsers.includes(user.id)}
//                                                     onChange={() =>
//                                                         setSelectedUsers((prev) =>
//                                                             prev.includes(user.id)
//                                                                 ? prev.filter((id) => id !== user.id)
//                                                                 : [...prev, user.id]
//                                                         )
//                                                     }
//                                                     className="w-4 h-4"
//                                                 />
//                                                 <label htmlFor={`user-${user.id}`} className="cursor-pointer">
//                                                     {user.email}
//                                                 </label>
//                                             </div>
//                                         ))}
//                                 </div>
//                             </div>
//                         </div>

//                         <div className="modal-footer mt-6 flex justify-end gap-2">
//                             <button
//                                 className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
//                                 onClick={() => setIsModalOpen(false)}
//                             >
//                                 Cancel
//                             </button>
//                             <button
//                                 className="px-4 py-2 bg-slate-950 text-white rounded hover:bg-slate-800"
//                                 onClick={() => {
//                                     // Add collaborators logic
//                                     setIsModalOpen(false);
//                                 }}
//                             >
//                                 Add Selected
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             )}
//         </main>
//     );
// };

// export default Project;
