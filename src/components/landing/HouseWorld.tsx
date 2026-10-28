"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { LivingHouse } from "./HouseModels";
import type { HouseSceneState } from "./scene-state";

type Props = { state: RefObject<HouseSceneState>; reduced: boolean; paused: boolean };

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <WorldFallback /> : this.props.children; }
}

export function WorldFallback() {
  return <div className="hf-world-fallback" role="img" aria-label="Maison HomeFix. Tous les services restent accessibles dans la page."><svg viewBox="0 0 600 420" aria-hidden="true"><ellipse cx="310" cy="355" rx="245" ry="35" fill="#d3d5bd" /><path d="m110 190 210-120 195 112v150l-210 43-195-80Z" fill="#e2d2b6" /><path d="m110 190 210-120v162l-210 63Z" fill="#f4e7cd" /><path d="m80 187 235-153 230 143-32 37L315 95 111 221Z" fill="#b76949" /><path d="m277 235 55-10v132l-55 12Z" fill="#345a48" /><path d="m155 227 65-23v64l-65 21ZM381 225l70 28v61l-70-23Z" fill="#9eb8a6" /></svg><span>Votre maison. Nos professionnels.</span></div>;
}

function CameraRig({ state, mobile }: { state: RefObject<HouseSceneState>; mobile: boolean }) {
  const { camera, invalidate, gl, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      // Keep a consistent horizontal framing even in a narrow/tall visual column.
      const base = THREE.MathUtils.degToRad(mobile ? 38 : 36);
      const aspect = size.width / Math.max(1, size.height);
      const fit = Math.max(1, (mobile ? 1.05 : 1.15) / aspect);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(base / 2) * fit));
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, mobile, invalidate, size.width, size.height]);
  const curves = useMemo(() => {
    const positions = mobile ? [[10, 7, 13], [8, 8, 15], [-1.7, 3.4, 6.8], [1.6, 3.4, 6.8], [4.9, 3.4, 6.8], [11, 8, 15], [10, 7, 13]] : [[13, 9, 16], [9, 10, 18], [-1.9, 3.3, 6.6], [1.4, 3.3, 6.6], [4.7, 3.3, 6.6], [13, 10, 18], [13, 9, 16]];
    const targets = [[0, 1, 0], [0, 1, 0], [-3.3, 1.2, -0.5], [0, 1.2, -0.5], [3.3, 1.4, -0.5], [0, 1, 0], [0, 1, 0]];
    return { position: new THREE.CatmullRomCurve3(positions.map(p => new THREE.Vector3(...p))), target: new THREE.CatmullRomCurve3(targets.map(p => new THREE.Vector3(...p))) };
  }, [mobile]);
  useEffect(() => {
    state.current.invalidate = invalidate;
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); canvas.closest(".hf-world")?.setAttribute("data-context-lost", "true"); };
    const restored = () => { canvas.closest(".hf-world")?.removeAttribute("data-context-lost"); invalidate(); };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => { state.current.invalidate = undefined; canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored); };
  }, [gl, invalidate, state]);
  useFrame(() => {
    const t = state.current.reduced ? 0 : THREE.MathUtils.clamp(state.current.progress, 0, 1);
    curves.position.getPoint(t, camera.position);
    curves.target.getPoint(t, look);
    if (!state.current.reduced && !state.current.paused && !mobile) {
      camera.position.x += state.current.pointer[0] * 0.17;
      camera.position.y += state.current.pointer[1] * 0.12;
    }
    camera.lookAt(look);
  });
  return null;
}

const roomLabels = [
  { x: -3.3, id: "plomberie", number: "01", label: "Plomberie" },
  { x: 0, id: "electricite", number: "02", label: "\u00c9lectricit\u00e9" },
  { x: 3.3, id: "climatisation", number: "03", label: "Climatisation" },
];
type LabelRefs = RefObject<(HTMLAnchorElement | null)[]>;

// The links belong to the page's React root. Only their projected positions are
// updated here, avoiding nested DOM roots and synchronous unmounts in Drei Html.
function RoomLabelPositions({ state, labels, mobile }: { state: RefObject<HouseSceneState>; labels: LabelRefs; mobile: boolean }) {
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const visible = !mobile && !state.current.reduced && state.current.progress > 0.11 && state.current.progress < 0.22;
    camera.updateMatrixWorld();
    roomLabels.forEach(({ x }, i) => {
      const label = labels.current[i];
      if (!label) return;
      point.set(x, 3.1, 0).project(camera);
      const inView = visible && point.z > -1 && point.z < 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1;
      label.style.visibility = inView ? "visible" : "hidden";
      if (inView) label.style.transform = `translate3d(${(point.x + 1) * size.width / 2}px, ${(1 - point.y) * size.height / 2}px, 0) translate(-50%, -50%)`;
    });
  });
  return null;
}

function Dust({ state, mobile }: { state: RefObject<HouseSceneState>; mobile: boolean }) {
  const particles = useRef<THREE.Points>(null);
  const time = useRef(0);
  const positions = useMemo(() => new Float32Array(Array.from({ length: (mobile ? 12 : 40) * 3 }, (_, i) => {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return (n - Math.floor(n) - 0.5) * (i % 3 === 1 ? 4 : 11) + (i % 3 === 1 ? 2.5 : 0);
  })), [mobile]);
  useFrame((_, delta) => {
    if (!state.current.reduced && !state.current.paused) time.current += Math.min(delta, 0.05);
    if (particles.current) particles.current.position.y = Math.sin(time.current * 0.2) * 0.15;
  });
  return <points ref={particles}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial size={0.028} color="#dcb783" transparent opacity={0.36} depthWrite={false} /></points>;
}

function Scene({ state, mobile, labels }: { state: RefObject<HouseSceneState>; mobile: boolean; labels: LabelRefs }) {
  return <>
    <CameraRig state={state} mobile={mobile} />
    <ambientLight intensity={0.7} />
    <hemisphereLight args={["#fff7e7", "#9eae8d", 1.3]} />
    <directionalLight position={[-5, 12, 8]} intensity={3.1} color="#fff0d9" castShadow={!mobile} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-normalBias={0.045} />
    <directionalLight position={[8, 5, -6]} intensity={1.5} color="#c5ddd7" />
    <Environment resolution={mobile ? 64 : 128} frames={1}>
      <Lightformer position={[0, 7, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 9, 1]} intensity={2} color="#ffefd6" />
      <Lightformer position={[-7, 3, 0]} rotation={[0, Math.PI / 2, 0]} scale={[7, 7, 1]} intensity={1.5} />
    </Environment>
    <LivingHouse state={state} />
    <Dust state={state} mobile={mobile} />
    <RoomLabelPositions state={state} labels={labels} mobile={mobile} />
    <ContactShadows position={[0, -0.55, 0]} opacity={0.3} scale={25} blur={2.8} far={9} resolution={mobile ? 128 : 256} frames={1} color="#566049" />
  </>;
}

export default function HouseWorld({ state, reduced, paused }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLAnchorElement | null)[]>([]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const resize = () => setMobile(query.matches);
    resize(); query.addEventListener("change", resize);
    const testCanvas = document.createElement("canvas");
    try { const context = testCanvas.getContext("webgl2"); setAvailable(Boolean(context)); context?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { setAvailable(false); }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && !document.hidden));
    if (container.current) observer.observe(container.current);
    const visibility = () => setVisible(!document.hidden && Boolean(container.current && container.current.getBoundingClientRect().bottom > 0));
    document.addEventListener("visibilitychange", visibility);
    return () => { query.removeEventListener("change", resize); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => { state.current.reduced = reduced; state.current.paused = paused; state.current.invalidate?.(); }, [reduced, paused, state]);
  return <div ref={container} className={`hf-world ${ready ? "is-ready" : ""}`}>
    <div className="hf-context-fallback"><WorldFallback /></div>
    {available === false ? <WorldFallback /> : available === null ? <div className="hf-scene-loading">Préparation de votre maison<span /></div> : <SceneBoundary><Suspense fallback={<div className="hf-scene-loading">Préparation de votre maison<span /></div>}>
      <Canvas className="hf-canvas" shadows={!mobile} dpr={mobile ? [1, 1.25] : [1, 1.6]} frameloop={visible && !reduced && !paused ? "always" : "demand"} camera={{ position: [13, 9, 16], fov: mobile ? 50 : 36, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true, powerPreference: mobile ? "low-power" : "high-performance" }} fallback={<WorldFallback />} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; setReady(true); }}>
        <Scene state={state} mobile={mobile} labels={labels} />
      </Canvas>
    </Suspense></SceneBoundary>}
    {available && ready && !mobile && <div className="hf-room-labels" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {roomLabels.map(({ id, number, label }, i) => <a key={id} ref={node => { labels.current[i] = node; }} className="hf-room-label" href={`#${id}`} style={{ position: "absolute", top: 0, left: 0, visibility: "hidden", pointerEvents: "auto" }}><span>{number}</span>{label}<b aria-hidden="true">&#8599;</b></a>)}
    </div>}
  </div>;
}
