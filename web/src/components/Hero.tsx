"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ReactiveButton from "./common/ReactiveButton";
import { motion, AnimatePresence } from "framer-motion";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

export default function Hero() {
  const isMobile = useIsMobile()
  const [isAppleDevice, setIsAppleDevice] = useState(false);
  const [phrases] = useState([
    "done waiting.",
    "tired of your excuses.",
    "ready for change.",
    "here to help."
  ]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent;
      setIsAppleDevice(/iPhone|iPad|Mac/.test(ua));
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  return (
    <section className="flex flex-col items-center justify-center px-6">
      
      {/* Main Heading */}
      {isMobile ? (
      <h1 className="mb-2 text-4xl sm:text-5xl md:text-6xl font-bold leading-none whitespace-nowrap text-center w-full">
        <span className="inline-block text-center"><span className="italic">{"Jiko "}</span>{"is "}{phrases[3]}</span>
      </h1>) : (
      <h1 className="mb-2 text-4xl sm:text-5xl md:text-6xl font-bold leading-none whitespace-nowrap flex justify-center items-center w-full">
        <span className="pr-2 w-5/12 text-right"><span className="italic">{"Jiko "}</span>{"is "}</span>
        <span className="pl-2 relative inline-block w-7/12 text-left">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={index}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-block align-baseline"
            >
              {phrases[index]}
            </motion.span>
          </AnimatePresence>
        </span>
      </h1>)}

      {/* Subheading */}
      <p className="text-gray-500 text-center mb-8">
        Restructure your life.
      </p>

      {/* Get Started Button */}
      <ReactiveButton className="bg-black text-background font-bold px-18 py-3 rounded-12 border-2 border-black">
        <div className="flex flex-row items-center justify-center gap-3 ">
            <Image
            src={isAppleDevice ? "/images/imessage.png" : "/images/altmessage.png"}
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