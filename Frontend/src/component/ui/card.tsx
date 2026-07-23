import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> { }

export const Card: React.FC<CardProps> = ({ className = "", ...props }) => {
    return (
        <div className={`bg-white shadow rounded-lg ${className}`}

            {...props} />
    );
};

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> { }

export const CardContent: React.FC<CardContentProps> = ({ className = "", ...props }) => {
    return (
        <div className={`p-4 ${className}`} {...props} />
    );
};