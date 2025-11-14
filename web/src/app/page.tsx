"use client";

import Hero from "@/components/Hero";
import PortalAnchor from "@/components/PortalAnchor";
import { usePortal } from "@/context/PortalContext";
import { useEffect, useRef } from "react";

export default function Home() {
  return (
    <div className="h-full" >
      <Hero />
      <PortalAnchor className="h-[400px]" />
    </div>
  );
}
