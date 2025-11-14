// app/components/PortalAnchor.tsx
"use client";
import React, { useEffect, useRef } from "react";
import { usePortal } from "@/context/PortalContext";

export default function PortalAnchor({ 
    children, 
    className
}: { 
    children?: React.ReactNode, 
    className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { setTarget } = usePortal();

  useEffect(() => {
    // register this anchor as the current target
    setTarget(ref.current);
    return () => {
      // clear on unmount so ThreeScene can fallback
      setTarget(null);
    };
    // intentionally only run on mount/unmount
  }, [setTarget]);

  return (
    <div ref={ref} className={`h-80 ${className}`}>
      {children}
    </div>
  );
}