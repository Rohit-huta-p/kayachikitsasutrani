"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Shield, ChevronDown, LogIn, User, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import AvatarCircle from "@/components/student/AvatarCircle";

const Navbar: React.FC = () => {
  const { state, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close dropdown on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  const isAuthed = state.status === "authed";

  return (
    <header className="bg-white border-b border-[#E5DDD0] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5 md:px-6 md:py-3 min-h-[44px]">
        <Link
          href={isAuthed ? "/home" : "/"}
          className="shrink-0"
        >
          <span className="font-bold text-brown text-base md:text-lg tracking-tight">
            Chikitsa Sutra
          </span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {isAuthed && state.status === "authed" ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-full hover:bg-accent-soft transition"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <AvatarCircle
                  name={state.user.name}
                  email={state.user.email}
                  size={30}
                />
                <span className="hidden md:inline text-sm text-brown font-medium truncate max-w-[120px]">
                  {state.user.name.split(/\s+/)[0]}
                </span>
                <ChevronDown size={14} className="text-brown" />
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white border border-[#E5DDD0] rounded-xl shadow-lg overflow-hidden z-50"
                >
                  <div className="px-3 py-2.5 border-b border-[#F0E7D8]">
                    <div className="text-xs text-gray-500">Signed in as</div>
                    <div className="text-sm font-semibold text-brown truncate">
                      {state.user.name}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {state.user.email}
                    </div>
                  </div>

                  <Link
                    href="/me"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-brown hover:bg-accent-soft transition"
                  >
                    <User size={14} className="shrink-0" />
                    Profile
                  </Link>

                  {state.user.role === "admin" && (
                    <>
                      <Link
                        href="/admin/shlokas"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-brown hover:bg-accent-soft transition"
                      >
                        <Shield size={14} className="shrink-0" />
                        Admin
                      </Link>
                      <Link
                        href="/admin/access-requests"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-brown hover:bg-accent-soft transition"
                      >
                        <UserPlus size={14} className="shrink-0" />
                        Access requests
                      </Link>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      await logout();
                      router.push("/login");
                    }}
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition text-left"
                  >
                    <LogOut size={14} className="shrink-0" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1 text-sm text-brown font-medium px-2 py-1 rounded hover:bg-accent-soft transition"
              >
                <LogIn size={14} />
                <span>Login</span>
              </Link>
              <Link
                href="/signup"
                className="bg-accent text-white text-sm font-semibold rounded-full px-3 py-1.5 hover:opacity-90 transition"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
