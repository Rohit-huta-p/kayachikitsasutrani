"use client";

export const Select = ({ className, options = [], ...props }) => {
    return (
        <select
            {...props}
            className={`outline-none p-2 bg-primary-light rounded-lg ${className}`}
        >
            {options.map((option, index) => (
                <option key={index} value={option.value} className="bg-white">
                    {option.label}
                </option>
            ))}
        </select>
    );
};
