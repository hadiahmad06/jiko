// app/components/PortalScene.tsx
"use client";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePortal } from "@/context/PortalContext";
import LotusFlower from "./LotusFlower";

// This is your actual 3D content: the canvas + WebGL setup
function CanvasRoot() {
    return <LotusFlower/>
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);

//   useEffect(() => {
//     const canvas = canvasRef.current!;
//     // Initialize your WebGL/Three.js scene here using `canvas`
//     // Example pseudo-code:
//     // const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
//     // ...setup scene, camera, animate loop...
//     //
//     // return cleanup to stop animation and dispose renderer/scene
//     return () => {
//       // cleanup renderer, stop animation loops, dispose resources
//     };
//   }, []);

//   return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

export default function PortalScene() {
  const { target } = usePortal();

  // create single stable container element — created once
  const containerRef = useRef<HTMLDivElement | null>(null);
  if (containerRef.current === null) {
    containerRef.current = document.createElement("div");
    // ensure it's sized/positioned by CSS from wherever it's moved to
    containerRef.current.style.width = "100%";
    containerRef.current.style.height = "100%";
  }

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
  return createPortal(<CanvasRoot />, containerRef.current);
}