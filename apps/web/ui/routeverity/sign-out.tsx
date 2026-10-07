"use client";

import { signOut } from "next-auth/react";

export function SignOut() {
  return (
    <button
      className="text-left text-sm hover:underline"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
