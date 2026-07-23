import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from '../App/store';
import { Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    creator: string;
    language: string;
    description?: string;
    version: number;
}

interface ShareLinkInfo {
    accessLevel: 'readonly' | 'readwrite';
    projectId: string;
    expiresAt: string;
}

const JoinProject: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
    const [status, setStatus] = useState<'loading' | 'checking' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState<string>('');
    const [project, setProject] = useState<Project | null>(null);
    const [shareInfo, _setShareInfo] = useState<ShareLinkInfo | null>(null);

    // First check if the token is valid and get info about it
    // useEffect(() => {
    //     const checkShareLink = async () => {
    //         if (!token) return;

    //         try {
    //             // You'll need to implement this endpoint in your backend
    //             const response = await axios.get<any>(`${import.meta.env.VITE_API_URL}/project/share-link-info/${token}`);
    //             setShareInfo(response.data);
    //             setStatus('checking');
    //         } catch (error: any) {
    //             setMessage(error.response?.data?.message || 'Invalid or expired share link');
    //             setStatus('error');
    //         }
    //     };

    //     checkShareLink();
    // }, [token]);

    // Then handle login and joining
    useEffect(() => {


        if (!isAuthenticated || !user) {
            // Store the token in sessionStorage so we can use it after login
            if (token) {
                sessionStorage.setItem('pendingJoinToken', token);
            }
            navigate('/login', { state: { redirectTo: `/join/${token}` } });
            return;
        }

        const joinProject = async () => {
            try {
                const response = await axios.get<any>(`${import.meta.env.VITE_API_URL}/project/join/${token}`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                });
                setProject(response.data.project);
                setMessage(response.data.message);
                setStatus('success');

                // Automatically redirect to the project after 3 seconds
                setTimeout(() => {
                    navigate(`/project/${response.data.project.id}`, {
                        state: { project: response.data.project }
                    });
                }, 3000);
            } catch (error: any) {
                setMessage(error.response?.data?.message || 'Failed to join project');
                setStatus('error');
            }
        };

        joinProject();
    }, [token, navigate, isAuthenticated, user, status]);

    const getAccessLevelDisplay = (level: string) => {
        switch (level) {
            case 'readwrite': return 'Edit Access';
            case 'readonly':
            default: return 'View Only';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md">
                {status === 'loading' && (
                    <div className="flex flex-col items-center text-center">
                        <Loader2 className="h-16 w-16 text-blue-500 animate-spin mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-800">Checking Share Link</h2>
                        <p className="mt-2 text-gray-600">Please wait while we verify this share link...</p>
                    </div>
                )}

                {status === 'checking' && (
                    <div className="flex flex-col items-center text-center">
                        <Loader2 className="h-16 w-16 text-blue-500 animate-spin mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-800">Joining Project</h2>
                        <p className="mt-2 text-gray-600">Please wait while we process your request...</p>

                        {shareInfo && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg w-full flex items-start">
                                <Info className="text-blue-500 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-700">
                                    <p>You're joining with <strong>{getAccessLevelDisplay(shareInfo.accessLevel)}</strong> permissions.</p>
                                    <p className="mt-1">This share link expires on {new Date(shareInfo.expiresAt).toLocaleDateString()}.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-800">Success!</h2>
                        <p className="mt-2 text-gray-600">{message}</p>
                        {project && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg w-full">
                                <h3 className="font-medium text-gray-800">{project.name}</h3>
                                <p className="text-sm text-gray-500">Language: {project.language}</p>
                                {project.description && (
                                    <p className="text-sm text-gray-500 mt-2">{project.description}</p>
                                )}
                                {shareInfo && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <p className="text-sm font-medium text-gray-700">
                                            Your access level: {getAccessLevelDisplay(shareInfo.accessLevel)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="mt-4 text-sm text-gray-500">
                            You will be redirected to the project in a few seconds...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-800">Unable to Join</h2>
                        <p className="mt-2 text-gray-600">{message}</p>
                        <button
                            onClick={() => navigate('/home')}
                            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoinProject;