import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export const Input: React.FC<InputProps> = ({ className = "", ...props }) => {
    return (
        <input className={`px-4 py-2 rounded-lg border ${className}`} {...props} />
    );
};