import React from "react";

interface SwitchProps {
  id: string; // Unique identifier for the switch
  checked: boolean; // Whether the switch is on or off
  onCheckedChange: (checked: boolean) => void; // Callback when the switch is toggled
  disabled?: boolean; // Optional: Whether the switch is disabled
}

export const Switch: React.FC<SwitchProps> = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
}) => {
  console.log(checked);
  return (
    <label
      htmlFor={id}
      className={`relative inline-flex items-center cursor-pointer ${
        disabled ? " cursor-not-allowed" : ""
      }`}
    >
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={disabled}
      />
      <div
        className={`w-8 h-4 rounded-full transition-colors ${
          checked ? "bg-blue-400" : "bg-gray-300"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full transform transition-transform ${
            checked ? "translate-x-4 bg-white" : "translate-x-0 bg-white"
          }`}
        ></div>
      </div>
    </label>
  );
};
