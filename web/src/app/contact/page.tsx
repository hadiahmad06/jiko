"use client";

// import MeasuredSection from "@/components/common/MeasuredSection";
import Contact from "@/components/Contact";
import PortalAnchor from "@/components/PortalAnchor";
// import { useSectionHeight } from "@/context/SectionHeightContext";

export default function ContactPage() {
  return (
    <div className="h-full" >
      <div className="min-h-[35vh]">
        <Contact />
      </div>
      <PortalAnchor className="h-[400px]" />
    </div>
  );
}