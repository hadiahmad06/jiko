"use client";

import Image from "next/image";
import ReactiveButton from "./common/ReactiveButton";

export default function Contact() {
  return (
    <section className="flex flex-col items-center justify-center px-6">

      {/* Profile Image */}
      <div className="w-32 h-32 bg-gray-300 rounded-full mb-4 flex items-center justify-center">
        <Image
          src="/images/hadi.jpeg"
          alt="Hadi Ahmad"
          width={128}
          height={128}
          className="rounded-full w-32 h-32"
        />
      </div>

      {/* Horizontal Empty Div (for social icons / links later) */}
      <div className="w-full max-w-md h-12 mb-6 flex flex-row items-center justify-center gap-4">
        <ReactiveButton
          className="px-3 py-3"
          onClick={() => window.open("https://github.com/hadiahmad06", "_blank", "noopener,noreferrer")}
          dark={false}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.997.108-.775.418-1.305.76-1.605-2.665-.3-5.467-1.335-5.467-5.93 0-1.31.467-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 013.005-.404c1.02.005 2.045.137 3.005.404 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.435.375.81 1.11.81 2.24 0 1.62-.015 2.925-.015 3.32 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </ReactiveButton>
        <ReactiveButton
          className="px-3 py-3"
          onClick={() => window.open("https://www.linkedin.com/in/hadiahmad06", "_blank", "noopener,noreferrer")}
          dark={false}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.025-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.353V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.37-1.852 3.604 0 4.27 2.372 4.27 5.456v6.287zM5.337 7.433a2.07 2.07 0 110-4.14 2.07 2.07 0 010 4.14zM6.814 20.452H3.861V9h2.953v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.728v20.543C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.728C24 .774 23.2 0 22.225 0z"/>
          </svg>
        </ReactiveButton>
        <ReactiveButton
          className="px-3 py-3"
          onClick={() => window.open("https://aidah.dev", "_blank", "noopener,noreferrer")}
          dark={false}
        >
         <svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="w-6 h-6">
          <g clipPath="url(#a)">
            <path fillRule="evenodd" clipRule="evenodd" d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1" fill="#666"/>
            </g>
            <defs>
              <clipPath id="a">
                <path fill="#fff" d="M0 0h16v16H0z"/>
              </clipPath>
            </defs>
          </svg>
        </ReactiveButton>
        <ReactiveButton
          className="px-3 py-3"
          onClick={() => window.location.href = "mailto:ahmad287@umn.edu?subject=Jiko%20Inquiry"}
          dark={false}
        >
         <svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
            <path d="M3 8C3 7.06812 3 6.60218 3.15224 6.23463C3.35523 5.74458 3.74458 5.35523 4.23463 5.15224C4.60218 5 5.06812 5 6 5V5H18V5C18.9319 5 19.3978 5 19.7654 5.15224C20.2554 5.35523 20.6448 5.74458 20.8478 6.23463C21 6.60218 21 7.06812 21 8V16C21 16.9319 21 17.3978 20.8478 17.7654C20.6448 18.2554 20.2554 18.6448 19.7654 18.8478C19.3978 19 18.9319 19 18 19V19H6V19C5.06812 19 4.60218 19 4.23463 18.8478C3.74458 18.6448 3.35523 18.2554 3.15224 17.7654C3 17.3978 3 16.9319 3 16V8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M4 7L10.683 11.8476C11.437 12.5074 12.563 12.5074 13.317 11.8476L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </ReactiveButton>
      </div>

      {/* Introductory Text */}
      <p className="text-center text-gray-700 mb-8">
        {"Hey! I'm Hadi, I'm working solo on Jiko."}<br />{"Feel free to email me with any questions at "}
        <a href="mailto:ahmad287@umn.edu" className="text-blue-500 underline">
          {"ahmad287@umn.edu"}
        </a>
      </p>

    </section>
  );
}