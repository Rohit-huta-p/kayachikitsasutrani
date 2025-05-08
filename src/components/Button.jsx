"use client";
export const Button = ({ children, onClick, className }) => {
  return (
    <button
      onClick={onClick}
      className={`bg-green text-white p-2 rounded ${className}`}
    >
      {children}
    </button>
  );
}