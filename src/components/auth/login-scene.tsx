"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PINK = "#f02b9b";
const SOFT_PINK = "#f6b8e0";
/** The shape sits in the upper right so it stays clear of the headline. */
const SHAPE_X = 1.9;
const SHAPE_Y = 1.4;

/** Normalised mouse position (-1..1), shared with the scene without re-rendering React. */
const pointer = { x: 0, y: 0 };

/** Small deterministic PRNG so the particle layout is stable across renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ParticleField({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = mulberry32(1337);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // A flattened disc of stars with some depth, so parallax reads as 3D.
      const r = 4 + rand() * 10;
      const a = rand() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = (rand() - 0.5) * 8;
      arr[i * 3 + 2] = Math.sin(a) * r - 4;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    const points = ref.current;
    if (!points) return;
    points.rotation.y += delta * 0.03;
    points.rotation.x = THREE.MathUtils.lerp(points.rotation.x, pointer.y * 0.15, 0.03);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={SOFT_PINK} size={0.045} sizeAttenuation transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

function WireShape() {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += delta * 0.12;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.35 + pointer.y * 0.35, 0.04);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -pointer.x * 0.25, 0.04);
    g.position.y = SHAPE_Y + Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
    if (inner.current) inner.current.rotation.x -= delta * 0.25;
  });

  return (
    <group ref={group} position={[SHAPE_X, SHAPE_Y, -0.8]} scale={0.7}>
      <mesh>
        <icosahedronGeometry args={[1.9, 1]} />
        <meshBasicMaterial color={PINK} wireframe transparent opacity={0.35} />
      </mesh>
      <mesh ref={inner}>
        <torusKnotGeometry args={[0.75, 0.22, 120, 16]} />
        <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={0.35} roughness={0.35} metalness={0.7} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[2.6, 0.012, 8, 120]} />
        <meshBasicMaterial color={SOFT_PINK} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function CameraRig() {
  useFrame((state) => {
    const cam = state.camera;
    cam.position.x = THREE.MathUtils.lerp(cam.position.x, pointer.x * 0.6, 0.04);
    cam.position.y = THREE.MathUtils.lerp(cam.position.y, pointer.y * 0.4, 0.04);
    cam.lookAt(0, 0, 0);
  });
  return null;
}

/**
 * Animated 3D backdrop for the login page: a slowly turning wireframe shape
 * with a glowing core and a field of particles, all tilting with the mouse.
 * Renders nothing when the visitor prefers reduced motion or has no WebGL.
 */
function detectSupport() {
  if (typeof window === "undefined") return { enabled: false, lowPower: false };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  return {
    enabled: !reduced && Boolean(gl),
    lowPower: window.innerWidth < 1280 || (navigator.hardwareConcurrency ?? 8) <= 4,
  };
}

export function LoginScene() {
  // This component is only ever rendered on the client (dynamic import, ssr: false).
  const [{ enabled, lowPower }] = useState(detectSupport);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, lowPower ? 1.25 : 1.75]}
        camera={{ position: [0, 0, 7], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[3, 3, 4]} intensity={18} color={SOFT_PINK} />
        <pointLight position={[-4, -2, 2]} intensity={6} color={PINK} />
        <CameraRig />
        <ParticleField count={lowPower ? 500 : 1100} />
        <WireShape />
      </Canvas>
      {/* Keeps the headline readable over the scene. */}
      <div className="absolute inset-0 bg-linear-to-r from-background/80 via-background/30 to-transparent" />
    </div>
  );
}
