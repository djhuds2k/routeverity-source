"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("RouteVerity page failed", error);
  }, [error]);
  return (
    <main className="rv-page">
      <div className="rv-card rv-stack">
        <h1>Something went wrong</h1>
        <p>
          The request could not be completed. Please retry. If it continues,
          check the application logs.
        </p>
        <button className="rv-button w-fit" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
