"use client";

// import MeasuredSection from "@/components/common/MeasuredSection";
import Features from "@/components/Features";
import Hero from "@/components/Hero";
import PortalAnchor from "@/components/PortalAnchor";

export default function Home() {
  return (
    <div className="h-full" >
      <div className="min-h-[35vh]">
        <Hero />
      </div>
      <PortalAnchor className="h-[400px]" />
      <Features />
    </div>
  );
}
