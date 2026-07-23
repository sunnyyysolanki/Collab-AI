import React from 'react';

interface InfoProps {
    title: string; // Tooltip text to display
    size?: number; // Optional: Size of the icon
    className?: string; // Optional: Additional CSS classes for styling
}

const Info: React.FC<InfoProps> = ({ title, size = 16, className = '' }) => {
    return (
        <div className="relative group">
            {/* Info Icon */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`text-slate-400 cursor-help ${className}`}
                width={size}
                height={size}
            >
                <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM11 10a1 1 0 112 0v5a1 1 0 11-2 0v-5zm1-4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                    clipRule="evenodd"
                />
            </svg>

            {/* Tooltip */}
            <div
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-black text-white text-xs rounded-md px-2 py-1 shadow-lg whitespace-nowrap"
                style={{ zIndex: 10 }}
            >
                {title}
            </div>
        </div>
    );
};

export default Info;