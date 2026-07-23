// src/component/UserProfile.tsx
import React from 'react';
interface User {
    id: string;
    email: string;
}

interface UserProfileProps {
    user: User;
}

const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm mx-auto">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">User Profile</h2>
            <div className="flex items-center mb-4">
                <img
                    src={`https://ui-avatars.com/api/?name=${user.email}`}
                    alt={user.email}
                    className="w-12 h-12 rounded-full mr-4"
                />
                <div>
                    <p className="text-lg font-medium text-slate-700">{user.email}</p>
                    <p className="text-sm text-slate-500">User ID: {user.id}</p>
                </div>
            </div>
            {/* Add more profile information here if needed */}
        </div>
    );
};

export default UserProfile;
