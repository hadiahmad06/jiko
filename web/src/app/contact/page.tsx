"use client";

import Contact from "@/components/Contact";
import PortalAnchor from "@/components/PortalAnchor";
import { usePortal } from "@/context/PortalContext";
import { useEffect, useRef } from "react";

export default function ContactPage() {
  return (
    <div className="h-full" >
      <Contact />
      <PortalAnchor className="h-[400px]" />
    </div>
  );
}