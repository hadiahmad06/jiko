"use client";

import { useRouter } from "next/navigation";
import ReactiveButton from "./common/ReactiveButton";

export default function Navbar() {
  const router = useRouter();
  return (
    <header
      className="inline top-0 left-0 w-full z-50 transition-opacity duration-300"
      style={{ backgroundColor: 'transparent' }}
    >
      <div className="p-4 flex flex-row w-full justify-center gap-6 px-12"> {/* style={{ opacity: headerOpacity }}*/}
        <ReactiveButton 
          className="text-xl sm:text-2xl font-cursive font-bold py-2 px-4"
          onClick={() => router.push('/')}
        >
          Jiko
        </ReactiveButton>
        <ReactiveButton 
          className="text-xl sm:text-2xl font-sans py-2 px-4"
          onClick={() => router.push('/contact')}
        >
          Contact
        </ReactiveButton>
      </div>
    </header>
  );
}