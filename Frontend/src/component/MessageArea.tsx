import React, { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../App/store";
import Markdown from "markdown-to-jsx";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { sendMessage } from "../config/socket";
import axiosInstance from "../config/axios";
import whatsappBg from "../assets/Screenshot 2025-04-13 at 12.20.47╬ôC╠º┬╗AM.png"; // You'll need to add this asset

interface Message {
  sender: string;
  message: any;
  timestamp?: Date;
}

interface User {
  id: string;
  email: string;
}

interface Collaborator extends User {
  accessLevel: "admin" | "readwrite" | "readonly";
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
  collaborators: Collaborator[];
  fileTree: FileTree;
  version: number;
  adminOnlyEdit: boolean;
  messages: Message[];
}

interface MessageAreaProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  project: Project;
}

const MessageArea: React.FC<MessageAreaProps> = ({
  messages,
  setMessages,
  project,
}) => {
  const [message, setMessage] = useState<string>("");
  // const [searchVisible, setSearchVisible] = useState<boolean>(false);
  const [searchTerm, _setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(0);
  const messageBoxRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { user } = useSelector((state: RootState) => state.auth);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (message.trim() && user) {
      const newMessage: Message = { sender: user.email, message };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      sendMessage("project-message", { message, sender: user.email });
      try {
        await axiosInstance.post(
          `/project/add-message`,
          {
            projectId: project.id,
            message,
          }
        );
      } catch (error) {
        console.error("Error sending message:", error);
      }
      setMessage("");
    }
  };

  useEffect(() => {
    if (messageBoxRef.current) {
      messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    messageRefs.current = messageRefs.current.slice(0, messages.length);
  }, [messages]);

  // Search functionality
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const results: number[] = [];
    messages.forEach((msg, index) => {
      const msgContent =
        typeof msg.message === "string"
          ? msg.message
          : typeof msg.message === "object" && msg.message !== null
            ? JSON.stringify(msg.message)
            : "";

      if (
        msgContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.sender.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchTerm, messages]);

  // Scroll to highlighted message
  useEffect(() => {
    if (searchResults.length > 0 && currentSearchIndex >= 0) {
      const messageIndex = searchResults[currentSearchIndex];
      if (messageRefs.current[messageIndex]) {
        messageRefs.current[messageIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentSearchIndex, searchResults, messages]);

  const renderMessageContent = (msg: Message) => {
    if (msg.sender === "AI") {
      // The AI message may be JSON ({ text, fileTree, ... }) OR plain markdown.
      // JSON.parse here runs DURING RENDER — if it throws, React unmounts the
      // whole app (white screen). So parse defensively and fall back to raw text.
      let displayText: string = msg.message;
      try {
        const parsed = JSON.parse(msg.message);
        displayText = parsed?.text ?? msg.message;
      } catch {
        displayText = msg.message; // not JSON — show it as-is
      }

      return (
        <div className="overflow-auto bg-slate-950 text-white p-2 rounded-md">
          <Markdown
            options={{
              overrides: {
                code: {
                  component: ({ children }) => (
                    <SyntaxHighlighter language="javascript" style={oneDark}>
                      {String(children).trim()}
                    </SyntaxHighlighter>
                  ),
                },
              },
            }}
          >
            {displayText || "No content provided."}
          </Markdown>
        </div>
      );
    }
    return <span>{msg.message}</span>;
  };

  // Highlight text with search term
  const highlightSearchTerm = (text: string) => {
    if (!searchTerm.trim() || typeof text !== "string") return text;

    const regex = new RegExp(`(${searchTerm})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-300">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach((msg) => {
      const date = msg.timestamp
        ? new Date(msg.timestamp).toLocaleDateString()
        : "Unknown Date";
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="conversation-area h-[calc(100vh-56px)] flex flex-col flex-grow">
      {/* WhatsApp-style header */}
      {/* <div className="bg-emerald-600 text-white p-3 shadow-md flex items-center">
                {searchVisible ? (
                    <div className="flex items-center w-full bg-white rounded-md">
                        <button
                            onClick={() => setSearchVisible(false)}
                            className="text-gray-600 px-2"
                        >
                            <i className="ri-arrow-left-line"></i>
                        </button>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search messages"
                            className="flex-grow p-2 outline-none text-gray-800 rounded-md"
                            autoFocus
                        />
                        {searchTerm && (
                            <div className="flex items-center text-gray-600 px-2">
                                <span className="text-xs mr-2">
                                    {searchResults.length > 0
                                        ? `${currentSearchIndex + 1}/${searchResults.length}`
                                        : "0/0"}
                                </span>
                                <button
                                    onClick={handleSearchPrev}
                                    className="p-1"
                                    disabled={searchResults.length === 0}
                                >
                                    <i className="ri-arrow-up-s-line"></i>
                                </button>
                                <button
                                    onClick={handleSearchNext}
                                    className="p-1"
                                    disabled={searchResults.length === 0}
                                >
                                    <i className="ri-arrow-down-s-line"></i>
                                </button>
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="p-1 ml-1"
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <i className="ri-group-line text-xl text-gray-600"></i>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold">{project.name}</h3>
                            <p className="text-xs opacity-90">
                                {project.collaborators.length} participants
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button
                                className="text-white"
                                onClick={() => setSearchVisible(true)}
                            >
                                <i className="ri-search-line text-xl"></i>
                            </button>

                        </div>
                    </>
                )}
            </div> */}

      {/* Messages area with WhatsApp-style background */}
      <div
        ref={messageBoxRef}
        className="message-box p-3 flex-1 flex flex-col gap-2 overflow-y-scroll custom-scrollbar"
        style={{
          backgroundImage: `url(${whatsappBg})`,
          backgroundSize: "contain",
          backgroundColor: "#e5ddd5",
        }}
      >
        {Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date} className="date-group">
            {msgs.map((msg, _groupIdx) => {
              const actualIndex = messages.findIndex((m) => m === msg);
              const isCurrentUser = msg.sender === user?.email;
              const isHighlighted =
                searchResults.indexOf(actualIndex) === currentSearchIndex;

              // Get message content for highlighting
              let displayMessage =
                typeof msg.message === "string"
                  ? msg.message
                  : typeof msg.message === "object" && msg.message !== null
                    ? JSON.stringify(msg.message)
                    : "";

              return (
                <div
                  key={actualIndex}
                  ref={(el) => (messageRefs.current[actualIndex] = el)}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"
                    } mb-2`}
                >
                  <div
                    className={`message relative max-w-72 rounded-lg p-2 px-3 shadow ${isCurrentUser
                        ? "bg-emerald-100 text-gray-800 rounded-tr-none"
                        : "bg-white text-gray-800 rounded-tl-none"
                      } ${isHighlighted ? "ring-2 ring-yellow-500" : ""}`}
                  >
                    {/* Sender email */}
                    <div
                      className={`text-xs font-medium ${isCurrentUser ? "text-emerald-700" : "text-blue-600"
                        }`}
                    >
                      {searchTerm
                        ? highlightSearchTerm(msg.sender)
                        : msg.sender}
                    </div>

                    {/* Message content */}
                    <div className="text-sm mt-1">
                      {/* Use regular content rendering for complex content */}
                      {msg.sender === "AI" ? (
                        renderMessageContent(msg)
                      ) : (
                        // Highlight simple text messages only
                        <span className="whitespace-pre-wrap break-words">
                          {searchTerm
                            ? highlightSearchTerm(displayMessage)
                            : displayMessage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* WhatsApp-style input area */}
      <div className="bg-gray-100 p-2 border-t border-gray-200">
        <div className="flex items-center bg-white rounded-full overflow-hidden pl-3 pr-1 shadow-sm">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-grow py-2 px-1 outline-none text-gray-800"
            placeholder="Type a message"
          />
          <button
            onClick={handleSendMessage}
            className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center ml-1"
            disabled={!message.trim()}
          >
            <i className="ri-send-plane-fill"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageArea;

// return (
//   <div className="conversation-area h-[calc(100vh-56px)]  flex flex-col">
//     <div
//       ref={messageBoxRef}
//       className="message-box p-1 flex flex-1 flex-col gap-1 overflow-y-scroll custom-scrollbar"
//     >
//       {messages.map((msg, index) => (
//         <div
//           key={index}
//           className={`message flex flex-col p-2 max-w-60 rounded-md ${
//             msg.sender === user?.email
//               ? "bg-blue-500 text-white w-fit ml-auto"
//               : "bg-slate-50 w-fit"
//           }`}
//         >
//           <small className="opacity-65 text-xs">{msg.sender}</small>
//           <div className="text-sm">{renderMessageContent(msg)}</div>
//         </div>
//       ))}
//     </div>

//     <div className="inputField w-full flex">
//       <input
//         type="text"
//         value={message}
//         onChange={(e) => setMessage(e.target.value)}
//         className="flex-grow p-2 px-4 border-none outline-none"
//         placeholder="Enter message"
//       />
//       <button
//         onClick={handleSendMessage}
//         className="px-5 bg-slate-950 text-white"
//       >
//         <i className="ri-send-plane-fill"></i>
//       </button>
//     </div>
//   </div>
// );
// };
