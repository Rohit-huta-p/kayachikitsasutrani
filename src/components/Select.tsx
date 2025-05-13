"use client";

export const Select = ({ className, options = [], ...props }:any) => {
    return (
        <select
            {...props}
            className={`outline-none p-2 bg-primary-light rounded-lg ${className}`}
        >
            {options.map((option: any, index: any) => (
                <option key={index} value={option.value} className="bg-white">
                    {option.label}
                </option>
            ))}
        </select>
    );
};
