"use client";

import {useGLTF, Stage, Environment, useProgress} from "@react-three/drei";
import { Canvas, ThreeElements, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
// import { extend } from "@react-three/fiber";
import { AmbientLight, Mesh, MeshStandardMaterial, Object3D} from "three";
import { motion } from "framer-motion";
// import Hero from "./Hero";
// extend({ Hero })

type ModelProps = ThreeElements["primitive"]

function Model({src, ...props}: {src: string} & Omit<ModelProps, "object">) {
  const {scene} = useGLTF(src);
  scene.traverse((child: Object3D) => {
  if ((child as Mesh).isMesh) {
    const mesh = child as Mesh;
    mesh.material = new MeshStandardMaterial({
      color: 0x111111, // very dark
      metalness: 1,
      roughness: 1,
    });
  }
});
  return <primitive object={scene} {...props} />  
}

function useCursor() {
  const [cursorX, setCursorX] = useState(50); // start at center
  const [cursorY, setCursorY] = useState(50); // start at center
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorX((e.clientX / window.innerWidth) * 100);
      setCursorY((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);
  return {cursorX, cursorY};
}

function useMobileFov(): number {
  const [fov, setFov] = useState(10); // default

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches; // matches Tailwind 'md' breakpoint
    setFov(isMobile ? 12 : 10);
  }, []);

  return fov;
}

export default function LotusFlower() {
  const {cursorX, cursorY} = useCursor();
  const fov = useMobileFov();
  const { loaded } = useProgress();

  return (
    <motion.div
      className="w-screen h-80 overflow-hidden mx-auto md:pr-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      transition={{ duration: 1 }}
    >
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{
          fov: fov, // field of view
          near: 0.1,
          far: 10,
          position: [-0.1, 0.2, 1.2], // x, y, z camera position
        }}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "block",
        }}
      >
        {/* smoother load */}
        <Suspense fallback={null}>
          
          {/* ambient & directional lights */}
          <ambientLight intensity={0.1} />
          {/* <directionalLight
            castShadow
            position={[5, 5, 5]}
            intensity={1}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          /> */}
          {/* <pointLight position={[2, 3, 2]} intensity={0.5} /> */}
          {/* <spotLight
            position={[0, 5, 10]}
            angle={0.8}
            penumbra={0.1}
            intensity={0.6}
            castShadow
          /> */}

          {/* environment lighting preset */}
          <Environment preset="sunset" background={false} />

          {/* stage wrapper handles shadow + light baking */}
          <Stage
            intensity={1.5}
            // contactShadow={{
            //   opacity: 0.4,
            //   blur: 2,
            // }}
            adjustCamera={false}
            // environment="city"
          >
            <Model src="/lotus_flower.glb" scale={0.1} />
          </Stage>
          <CursorFollow cursorX={cursorX} cursorY={cursorY} />
        </Suspense>
      </Canvas>
    </motion.div>
  );
}

function CursorFollow({ cursorX, cursorY }: { cursorX: number; cursorY: number }) {
  const { camera, scene } = useThree();
  const ambientRef = useRef<AmbientLight>(null!);
  useFrame(() => {
    // Map cursorX and cursorY from [0, 100] to [-0.5, 0.5]
    const x = (cursorX / 100) - 0.5;
    const y = (cursorY / 100) - 0.5;
    // Update camera position based on cursor
    camera.position.x = -0.1 + x * -0.5; // Adjust multiplier for sensitivity
    camera.position.y = 0.2 + y * 0.1; // Adjust multiplier for sensitivity
    camera.lookAt(0, 0, 0); // Always look at the center
    camera.updateProjectionMatrix();

    const distanceFromCenter = Math.sqrt(x * x + y * y); // 0 at center, max ~0.7 at corners
    const intensity = 0.1 + (1 - Math.min(distanceFromCenter, 1)) * 0.9;

    // Either find existing ambient light or create one dynamically
    let light: AmbientLight | undefined = ambientRef.current;
    if (!light) {
      light = new AmbientLight(0xffffff, intensity);
      scene.add(light);
      ambientRef.current = light;
    } else {
      light.intensity = intensity;
    }
  });
  return null;
}