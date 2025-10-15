"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ReactiveButton from "./common/ReactiveButton";

export default function Hero() {
  const [isAppleDevice, setIsAppleDevice] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent;
      setIsAppleDevice(/iPhone|iPad|Mac/.test(ua));
    }
  }, []);

  return (
    <section className="flex flex-col items-center justify-center px-6">
      
      {/* Main Heading */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center leading-none mb-2">
        <span className="italic">Jiko</span> <br />
        <span className="text-3xl sm:text-4xl md: text-5xl">is tired of your excuses.</span>
      </h1>

      {/* Subheading */}
      <p className="text-gray-500 text-center mb-8">
        Restructure your life.
      </p>

      {/* Get Started Button */}
      <ReactiveButton className="bg-black text-background font-bold px-18 py-3 rounded-12 border-2 border-black">
        <div className="flex flex-row items-center justify-center gap-3 ">
            <Image
            src={isAppleDevice ? "/imessage.png" : "/altmessage.png"}
            alt="Message Icon"
            width={24}
            height={24}
            className=""
            />
            Get Started
        </div>
      </ReactiveButton>

      {/* Terms Text */}
      <p className="text-xs text-gray-400 text-center mt-4 mb-12">
        By continuing, you agree to our Terms and Privacy.
      </p>

    </section>
  );
}