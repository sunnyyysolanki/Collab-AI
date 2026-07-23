import React from "react";

const Alert = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        variant?: "default" | "destructive";
    }
>(({ className = "", variant = "default", ...props }, ref) => {
    const variantStyles = {
        default: "bg-gray-100 text-gray-900",
        destructive: "bg-red-100 text-red-900",
    };

    return (
        <div
            ref={ref}
            role="alert"
            className={`relative w-full rounded-lg border p-4 ${variantStyles[variant]} ${className}`}
            {...props}
        />
    );
});

Alert.displayName = "Alert";

const AlertDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => (
    <div
        ref={ref}
        className={`text-sm [&_p]:leading-relaxed ${className}`}
        {...props}
    />
));

AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription };