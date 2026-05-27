"use client";

import React from "react";

interface Props {
  name: string;
  email: string;
  size?: number;
  className?: string;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function deriveColor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 65%)`;
}

const AvatarCircle: React.FC<Props> = ({ name, email, size = 40, className = "" }) => {
  const initials = deriveInitials(name);
  const color = deriveColor(email);
  return (
    <span
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, background: color, fontSize: Math.floor(size * 0.4) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};

export default AvatarCircle;
