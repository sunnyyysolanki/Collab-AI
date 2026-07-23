// ShareLinkModal.tsx
import React, { useState } from "react";
import { X, Copy } from "lucide-react";
import axios from "axios";
// import { useSelector } from "react-redux";
// import { RootState } from "../App/store";

interface ShareLinkModalProps {
    projectId: string;
    projectCreator: string;
    onClose: () => void;
    userAccessLevel: string;
}

const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
    projectId,
    // projectCreator,
    onClose,
    userAccessLevel
}) => {
    const [shareUrl, setShareUrl] = useState<string>("");
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isCopied, setIsCopied] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [accessLevel, setAccessLevel] = useState<string>("readonly");
    const [expirationDays, setExpirationDays] = useState<number>(7);

    // const { user } = useSelector((state: RootState) => state.auth);
    const isAdmin = userAccessLevel === 'admin';
    const canCreateWriteLink = isAdmin;
    const canCreateReadLink = ['admin', 'readwrite'].includes(userAccessLevel);

    const generateShareLink = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post<any>(
                `${import.meta.env.VITE_API_URL}/project/share-link`,
                {
                    projectId,
                    accessLevel,
                    expirationDays
                },
                {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                }
            );
            setShareUrl(response.data.shareUrl);
            setExpiresAt(new Date(response.data.expiresAt));
            setIsLoading(false);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to generate share link");
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
    };

    // If user doesn't have at least write access, show error
    if (!canCreateReadLink) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
                <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-100">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-xl font-semibold">Share Project</h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-4">
                        You need at least write access to share this project.
                    </div>
                    <button onClick={onClose} className="w-full py-2 px-4 bg-blue-600 text-white rounded">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-100">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xl font-semibold">Share Project</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Access Level
                    </label>
                    <select
                        className="w-full p-2 border rounded"
                        value={accessLevel}
                        onChange={(e) => setAccessLevel(e.target.value)}
                    >
                        <option value="readonly">Read Only</option>
                        {canCreateWriteLink && (
                            <option value="readwrite">Edit Access</option>
                        )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        {accessLevel === "readonly"
                            ? "Recipients can view the project but cannot make changes."
                            : "Recipients can view and edit the project."}
                    </p>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link Expiration
                    </label>
                    <select
                        className="w-full p-2 border rounded"
                        value={expirationDays}
                        onChange={(e) => setExpirationDays(parseInt(e.target.value))}
                    >
                        <option value={1}>1 day</option>
                        <option value={7}>7 days</option>
                        <option value={30}>30 days</option>
                        <option value={90}>90 days</option>
                    </select>
                </div>

                {!shareUrl ? (
                    <button
                        onClick={generateShareLink}
                        disabled={isLoading}
                        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        {isLoading ? "Generating..." : "Generate Share Link"}
                    </button>
                ) : (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Share this link:</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                className="flex-1 p-2 border rounded text-sm"
                            />
                            <button
                                onClick={copyToClipboard}
                                className="p-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            >
                                {isCopied ? "Copied!" : <Copy size={18} />}
                            </button>
                        </div>
                        {expiresAt && (
                            <p className="text-xs text-slate-500 mt-2">
                                Expires on: {expiresAt.toLocaleDateString()} {expiresAt.toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                )}

                {error && (
                    <p className="p-3 bg-red-50 text-red-700 border border-red-100 rounded mt-4">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ShareLinkModal;