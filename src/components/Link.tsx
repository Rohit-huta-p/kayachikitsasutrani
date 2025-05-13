"use client";
import Link from 'next/link';
interface CustomLinkProps {
  href: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  className?: string;
}

export const Custom_Link = ({ href, children, onClick, className }: CustomLinkProps) => {
  return (
    <Link
        href={href}
      onClick={onClick}
      className={`rounded  ${className}`}
    >
      {children}
    </Link>
  );
}