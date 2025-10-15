"use client";

import ReactiveButton from "@/components/common/ReactiveButton";
import Hero from "@/components/Hero";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      document.body.style.setProperty('--cursor-x', `${x}px`);
      document.body.style.setProperty('--cursor-y', `${y}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="text-foreground min-h-screen font-sans flex flex-col">
      {/* {headerOpacity !== 0 &&  */}
        <header
          className="fixed hidden sm:inline top-0 left-0 w-full z-50 transition-opacity duration-300"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className="p-4 flex flex-row w-full justify-center gap-6 px-12"> {/* style={{ opacity: headerOpacity }}*/}
            <ReactiveButton 
              className="text-2xl font-cursive font-bold py-2 px-4"
              onClick={() => router.push('/#Hero')}
            >
              Jiko
            </ReactiveButton>
            {/* <div className="flex flex-row gap-6 self-end">
              <ReactiveButton 
                className="text-xl text-gray-400 py-2 px-4"
                onClick={() => router.push('/#AboutMe')}
              >
                About Me
              </ReactiveButton>
              <ReactiveButton 
                className="text-xl text-gray-400 py-2 px-4"
                onClick={() => router.push('/#Projects')}
              >
                Projects
              </ReactiveButton>
              <ReactiveButton 
                className="text-xl text-gray-400 py-2 px-4"
                onClick={() => router.push('/#Contact')}
              >
                Contact
              </ReactiveButton>
            </div> */}
          </div>
        </header>
      {/* } */}
      {/* Hero Section */}
      <Hero />
    </div>
  );
}
