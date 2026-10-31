"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/* UniKyn palette */
const PINK = "#f02b9b";
const SOFT_PINK = "#f6b8e0";
const CREAM = "#fffaf5";
const INK = "#130a12";
const CARD = "#1c1020";
const GREEN = "#34d399";
const AMBER = "#f5c26b";
const BG = "#080609";

/** Normalised pointer (-1..1), shared with the scene without React re-renders. */
const pointer = { x: 0, y: 0 };

/** Small deterministic PRNG so the layout is stable across renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ------------------------------------------------------------------ */
/* Board layout                                                        */
/* ------------------------------------------------------------------ */

const COLUMN_X = [-3.3, 0, 3.3];
const COLUMN_LABEL_COLORS = [SOFT_PINK, AMBER, GREEN];
const CARD_W = 2.3;
const CARD_H = 0.78;
const CARD_D = 0.08;
const CARD_GAP = 0.98;
const BOARD_TOP = 1.9;
const BOARD_Z = -1.2;

type CardSpec = { id: number; column: number; row: number; status: 0 | 1 | 2; progress: number; lines: number };

function makeCards(): CardSpec[] {
  const rand = mulberry32(42);
  const specs: CardSpec[] = [];
  let id = 0;
  const perColumn = [4, 3, 3];
  perColumn.forEach((n, column) => {
    for (let row = 0; row < n; row++) {
      specs.push({
        id: id++,
        column,
        row,
        status: column as 0 | 1 | 2,
        progress: column === 2 ? 1 : column === 1 ? 0.35 + rand() * 0.5 : rand() * 0.15,
        lines: 1 + Math.round(rand()),
      });
    }
  });
  return specs;
}

const CARDS = makeCards();

function cardPosition(column: number, row: number): [number, number, number] {
  return [COLUMN_X[column], BOARD_TOP - 0.55 - row * CARD_GAP, BOARD_Z];
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function useCardGeometry() {
  return useMemo(() => new RoundedBoxGeometry(CARD_W, CARD_H, CARD_D, 4, 0.1), []);
}

/** One task card: body, status strip, "text" lines, progress bar and an avatar dot. */
function TaskCard({
  spec,
  geometry,
  done,
  onToggle,
  position,
  floatSeed,
}: {
  spec: CardSpec;
  geometry: THREE.BufferGeometry;
  done: boolean;
  onToggle: (id: number) => void;
  position: [number, number, number];
  floatSeed: number;
}) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const status = done ? 2 : spec.status;
  const accent = COLUMN_LABEL_COLORS[status];
  const progress = done ? 1 : spec.progress;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const lift = hover ? 0.35 : 0;
    g.position.x = THREE.MathUtils.lerp(g.position.x, position[0], 0.08);
    g.position.y = THREE.MathUtils.lerp(g.position.y, position[1] + Math.sin(t * 0.8 + floatSeed) * 0.05, 0.08);
    g.position.z = THREE.MathUtils.lerp(g.position.z, position[2] + lift, 0.12);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, hover ? -pointer.y * 0.25 : 0, 0.1);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, hover ? pointer.x * 0.25 : 0, 0.1);
    const s = hover ? 1.08 : 1;
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, s, 0.12));
  });

  return (
    <group ref={group} position={position}>
      <mesh
        geometry={geometry}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onToggle(spec.id);
        }}
      >
        <meshStandardMaterial
          color={CARD}
          roughness={0.55}
          metalness={0.15}
          emissive={accent}
          emissiveIntensity={hover ? 0.12 : 0.03}
          transparent
          opacity={0.96}
        />
      </mesh>
      {/* status strip */}
      <mesh position={[-CARD_W / 2 + 0.06, 0, CARD_D / 2 + 0.005]}>
        <boxGeometry args={[0.06, CARD_H - 0.22, 0.01]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      {/* title line */}
      <mesh position={[-0.25, 0.2, CARD_D / 2 + 0.005]}>
        <boxGeometry args={[1.3, 0.07, 0.01]} />
        <meshBasicMaterial color={CREAM} transparent opacity={done ? 0.35 : 0.85} />
      </mesh>
      {/* secondary line */}
      {spec.lines > 1 && (
        <mesh position={[-0.45, 0.04, CARD_D / 2 + 0.005]}>
          <boxGeometry args={[0.9, 0.05, 0.01]} />
          <meshBasicMaterial color={CREAM} transparent opacity={0.3} />
        </mesh>
      )}
      {/* progress track + fill */}
      <mesh position={[-0.1, -0.24, CARD_D / 2 + 0.005]}>
        <boxGeometry args={[1.6, 0.045, 0.01]} />
        <meshBasicMaterial color={CREAM} transparent opacity={0.12} />
      </mesh>
      <mesh position={[-0.1 - (1.6 * (1 - progress)) / 2, -0.24, CARD_D / 2 + 0.008]}>
        <boxGeometry args={[Math.max(0.02, 1.6 * progress), 0.045, 0.01]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      {/* avatar dot */}
      <mesh position={[CARD_W / 2 - 0.25, 0.16, CARD_D / 2 + 0.02]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={0.5} />
      </mesh>
      {/* check mark when done */}
      {done && (
        <group position={[CARD_W / 2 - 0.25, -0.2, CARD_D / 2 + 0.02]} rotation={[0, 0, -Math.PI / 4]}>
          <mesh position={[-0.045, -0.02, 0]}>
            <boxGeometry args={[0.04, 0.1, 0.02]} />
            <meshBasicMaterial color={GREEN} />
          </mesh>
          <mesh position={[0.04, -0.05, 0]}>
            <boxGeometry args={[0.2, 0.04, 0.02]} />
            <meshBasicMaterial color={GREEN} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Column header bars with a small count pill. */
function ColumnHeaders() {
  return (
    <group position={[0, BOARD_TOP + 0.15, BOARD_Z]}>
      {COLUMN_X.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh>
            <boxGeometry args={[CARD_W, 0.04, 0.02]} />
            <meshBasicMaterial color={COLUMN_LABEL_COLORS[i]} transparent opacity={0.7} />
          </mesh>
          <mesh position={[-CARD_W / 2 + 0.45, 0.16, 0]}>
            <boxGeometry args={[0.9, 0.09, 0.01]} />
            <meshBasicMaterial color={CREAM} transparent opacity={0.5} />
          </mesh>
          <mesh position={[CARD_W / 2 - 0.15, 0.16, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color={COLUMN_LABEL_COLORS[i]} />
          </mesh>
        </group>
      ))}
      {/* faint column backdrops */}
      {COLUMN_X.map((x, i) => (
        <mesh key={`bg-${i}`} position={[x, -2.1, -0.08]}>
          <planeGeometry args={[CARD_W + 0.3, 4.6]} />
          <meshBasicMaterial color={INK} transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

/** A card that keeps travelling To do → In progress → Done, so the board is never still. */
function FlowCard({ geometry }: { geometry: THREE.BufferGeometry }) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const strip = useRef<THREE.MeshBasicMaterial>(null);
  const start = useMemo(() => new THREE.Vector3(...cardPosition(0, 4)), []);
  const mid = useMemo(() => new THREE.Vector3(...cardPosition(1, 3)), []);
  const end = useMemo(() => new THREE.Vector3(...cardPosition(2, 3)), []);
  const CYCLE = 9;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = (state.clock.elapsedTime % CYCLE) / CYCLE;
    // 0–0.15 rest, 0.15–0.4 move to in-progress, 0.4–0.6 rest, 0.6–0.85 move to done, 0.85–1 fade out
    let from = start;
    let to = start;
    let k = 0;
    let color = COLUMN_LABEL_COLORS[0];
    if (t < 0.15) {
      k = 0;
    } else if (t < 0.4) {
      from = start;
      to = mid;
      k = easeInOut((t - 0.15) / 0.25);
      color = COLUMN_LABEL_COLORS[1];
    } else if (t < 0.6) {
      from = mid;
      to = mid;
      k = 1;
      color = COLUMN_LABEL_COLORS[1];
    } else if (t < 0.85) {
      from = mid;
      to = end;
      k = easeInOut((t - 0.6) / 0.25);
      color = COLUMN_LABEL_COLORS[2];
    } else {
      from = end;
      to = end;
      k = 1;
      color = COLUMN_LABEL_COLORS[2];
    }
    g.position.lerpVectors(from, to, k);
    const moving = (t > 0.15 && t < 0.4) || (t > 0.6 && t < 0.85);
    g.position.z = from.z + (moving ? Math.sin(k * Math.PI) * 0.9 : 0);
    g.rotation.z = moving ? Math.sin(k * Math.PI) * -0.12 : 0;
    const fade = t > 0.9 ? 1 - (t - 0.9) / 0.1 : t < 0.08 ? t / 0.08 : 1;
    if (material.current) material.current.opacity = 0.96 * fade;
    if (strip.current) {
      strip.current.color.set(color);
      strip.current.opacity = fade;
    }
  });

  return (
    <group ref={group} position={start.toArray()}>
      <mesh geometry={geometry}>
        <meshStandardMaterial ref={material} color={CARD} roughness={0.5} metalness={0.2} emissive={PINK} emissiveIntensity={0.15} transparent />
      </mesh>
      <mesh position={[-CARD_W / 2 + 0.06, 0, CARD_D / 2 + 0.005]}>
        <boxGeometry args={[0.06, CARD_H - 0.22, 0.01]} />
        <meshBasicMaterial ref={strip} color={SOFT_PINK} transparent />
      </mesh>
      <mesh position={[-0.25, 0.18, CARD_D / 2 + 0.005]}>
        <boxGeometry args={[1.3, 0.07, 0.01]} />
        <meshBasicMaterial color={CREAM} transparent opacity={0.85} />
      </mesh>
      <mesh position={[CARD_W / 2 - 0.25, 0.16, CARD_D / 2 + 0.02]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={SOFT_PINK} emissive={SOFT_PINK} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/** Dependency links between cards, with a pulse of light travelling along each one. */
function Links({ pairs }: { pairs: [[number, number], [number, number]][] }) {
  const lines = useMemo(
    () =>
      pairs.map(([a, b]) => {
        const pa = new THREE.Vector3(...cardPosition(a[0], a[1]));
        const pb = new THREE.Vector3(...cardPosition(b[0], b[1]));
        pa.x += CARD_W / 2;
        pb.x -= CARD_W / 2;
        const ctrl = new THREE.Vector3((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, BOARD_Z + 0.6);
        const curve = new THREE.QuadraticBezierCurve3(pa, ctrl, pb);
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: SOFT_PINK, transparent, opacity: 0.35 }));
        return { line, curve };
      }),
    [pairs],
  );
  const pulses = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    lines.forEach(({ curve }, i) => {
      const m = pulses.current[i];
      if (!m) return;
      const t = ((state.clock.elapsedTime * 0.18 + i * 0.37) % 1 + 1) % 1;
      m.position.copy(curve.getPoint(t));
    });
  });

  return (
    <group>
      {lines.map(({ line }, i) => (
        <group key={i}>
          <primitive object={line} />
          <mesh
            ref={(el) => {
              pulses.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshBasicMaterial color={PINK} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const transparent = true;

/** Progress ring (arc) with an orbiting dot, like a project's completion gauge. */
function ProgressRing({ position, value, scale = 1 }: { position: [number, number, number]; value: number; scale?: number }) {
  const group = useRef<THREE.Group>(null);
  const dot = useRef<THREE.Mesh>(null);
  const arc = Math.PI * 2 * value;
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.rotation.z -= delta * 0.15;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, pointer.x * 0.5, 0.03);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -pointer.y * 0.5, 0.03);
    if (dot.current) {
      const t = state.clock.elapsedTime * 0.5;
      dot.current.position.set(Math.cos(t) * 1.0, Math.sin(t) * 1.0, 0.05);
    }
  });
  return (
    <group ref={group} position={position} scale={scale}>
      <mesh>
        <torusGeometry args={[1, 0.035, 12, 80]} />
        <meshBasicMaterial color={CREAM} transparent opacity={0.12} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1, 0.06, 12, 80, arc]} />
        <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={0.7} />
      </mesh>
      <mesh ref={dot}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color={SOFT_PINK} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color={INK} emissive={PINK} emissiveIntensity={0.25} roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

function Dust({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = mulberry32(7);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rand() - 0.5) * 30;
      arr[i * 3 + 1] = (rand() - 0.5) * 16;
      arr[i * 3 + 2] = -2 - rand() * 14;
    }
    return arr;
  }, [count]);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.01;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={SOFT_PINK} size={0.04} sizeAttenuation transparent opacity={0.6} depthWrite={false} />
    </points>
  );
}

function CameraRig() {
  useFrame((state) => {
    const cam = state.camera;
    const t = state.clock.elapsedTime;
    const driftX = Math.sin(t * 0.15) * 0.25;
    const driftY = Math.cos(t * 0.12) * 0.15;
    cam.position.x = THREE.MathUtils.lerp(cam.position.x, pointer.x * 1.1 + driftX, 0.04);
    cam.position.y = THREE.MathUtils.lerp(cam.position.y, 0.3 + pointer.y * 0.7 + driftY, 0.04);
    cam.lookAt(0.6, 0.1, BOARD_Z);
  });
  return null;
}

function Board({ lowPower }: { lowPower: boolean }) {
  const geometry = useCardGeometry();
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const toggle = (id: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <group rotation={[0.08, -0.34, 0]} position={[lowPower ? 0.4 : 2.3, lowPower ? 0.6 : 0.05, lowPower ? -1.5 : 0]} scale={lowPower ? 0.8 : 0.9}>
      <ColumnHeaders />
      {CARDS.map((c) => (
        <TaskCard
          key={c.id}
          spec={c}
          geometry={geometry}
          done={done.has(c.id)}
          onToggle={toggle}
          position={cardPosition(c.column, c.row)}
          floatSeed={c.id * 1.7}
        />
      ))}
      <FlowCard geometry={geometry} />
      {!lowPower && (
        <Links
          pairs={[
            [
              [0, 0],
              [1, 1],
            ],
            [
              [1, 0],
              [2, 1],
            ],
            [
              [0, 2],
              [1, 2],
            ],
          ]}
        />
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function detectSupport() {
  if (typeof window === "undefined") return { enabled: false, lowPower: false };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  return {
    enabled: !reduced && Boolean(gl),
    lowPower: window.innerWidth < 1024 || (navigator.hardwareConcurrency ?? 8) <= 4,
  };
}

/**
 * Interactive 3D backdrop for the login page: a floating kanban board whose
 * cards lift on hover and tick off on click, a card that keeps moving across
 * the columns, dependency links with light pulses, progress rings and dust,
 * all parallaxing with the mouse. Skipped for reduced motion / no WebGL.
 */
export function LoginScene() {
  // Only ever rendered on the client (dynamic import, ssr: false).
  const [{ enabled, lowPower }] = useState(detectSupport);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.cursor = "";
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, lowPower ? 1.25 : 1.75]}
        camera={{ position: [0, 0.3, 9.5], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <fog attach="fog" args={[BG, 9, 22]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 6]} intensity={1.4} color={CREAM} />
        <pointLight position={[-5, 2, 3]} intensity={25} color={PINK} />
        <pointLight position={[6, -3, 2]} intensity={12} color={SOFT_PINK} />
        <CameraRig />
        <Dust count={lowPower ? 350 : 800} />
        <Board lowPower={lowPower} />
        <ProgressRing position={[-5.2, 2.4, -3]} value={0.72} scale={0.9} />
        <ProgressRing position={[5.6, -2.6, -4]} value={0.45} scale={0.7} />
        <gridHelper args={[60, 60, "#3a1f36", "#1d1120"]} position={[0, -3.4, -4]} />
      </Canvas>
    </div>
  );
}
