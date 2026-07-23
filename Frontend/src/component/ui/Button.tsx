import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

export const Button: React.FC<ButtonProps> = ({ className = "", ...props }) => {
    return (
        <button className={`px-4 py-2 rounded-lg transition-all ${className}`} {...props} />
    );
};