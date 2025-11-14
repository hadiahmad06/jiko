// app/context/PortalContext.tsx
"use client";

import React, { createContext, useContext, useState } from "react";

type PortalContextType = {
  target: HTMLElement | null;
  setTarget: (el: HTMLElement | null) => void;
};

const PortalContext = createContext<PortalContextType | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return (
    <PortalContext.Provider value={{ target, setTarget }}>
      {children}
    </PortalContext.Provider>
  );
}

export const usePortal = () => {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
};