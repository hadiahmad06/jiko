// app/components/PortalScene.tsx
"use client";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePortal } from "@/context/PortalContext";
import LotusFlower from "./LotusFlower";

const CanvasRoot = React.memo(function CanvasRoot() {
  return <LotusFlower />;
});

export default function PortalScene() {
  const { target } = usePortal();

  // create single stable container element — created once
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
  if (!containerRef.current) {
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "100%";
    containerRef.current = el;
  }

  // attach fallback to body
  const el = containerRef.current;
  if (!el.parentElement) document.body.appendChild(el);

  return () => {
    if (el.parentElement) document.body.removeChild(el);
  };
  }, []);

  // On mount, attach container to body as fallback
  useEffect(() => {
    const el = containerRef.current!;
    if (!el.parentElement) document.body.appendChild(el);
    return () => {
      if (el.parentElement) el.parentElement.removeChild(el);
    };
  }, []);

  // Whenever target changes, move the same container DOM node into the target
  useEffect(() => {
    const el = containerRef.current!;
    if (target) {
      // move element under target
      target.appendChild(el);
    } else {
      // fallback: attach to body to keep it mounted somewhere
      if (document.body && document.body !== el.parentElement) {
        document.body.appendChild(el);
      }
    }
  }, [target]);

  // Render your CanvasRoot into the stable container. React will keep this mounted
  // even when the container is moved in the DOM.

//   const CanvasRoot = () => {return <LotusFlower />};
  return containerRef.current
    ? createPortal(<CanvasRoot />, containerRef.current)
    : null;
}

