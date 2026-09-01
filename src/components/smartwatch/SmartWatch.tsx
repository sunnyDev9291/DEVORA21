"use client";

import WatchBody from "./WatchBody";

export default function SmartWatch() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[#f5f0e6] px-4 py-10">
      <div className="flex min-h-[430px] max-h-[500px] w-full max-w-[420px] items-center justify-center sm:min-h-[480px]">
        <WatchBody />
      </div>
    </div>
  );
}
