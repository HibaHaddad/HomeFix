"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { HouseSceneState } from "./scene-state";

type V3 = [number, number, number];
const C = { cream: "#f0e3cc", white: "#fff9ed", green: "#335b48", mint: "#a7bda2", peach: "#d98660", roof: "#b66646", gold: "#e7b96f", blue: "#a9d0cf", metal: "#bdc7c3", ink: "#293d36" };

function Box({ at = [0, 0, 0], size, color = C.white, round = false, rotation, metal = false }: { at?: V3; size: V3; color?: string; round?: boolean; rotation?: V3; metal?: boolean }) {
  const material = <meshStandardMaterial color={color} roughness={metal ? 0.25 : 0.7} metalness={metal ? 0.75 : 0} />;
  return round ? <RoundedBox position={at} args={size} radius={Math.min(...size) * 0.18} smoothness={2} rotation={rotation} castShadow receiveShadow>{material}</RoundedBox> : <mesh position={at} rotation={rotation} castShadow receiveShadow><boxGeometry args={size} />{material}</mesh>;
}
function Ball({ at, size, color }: { at: V3; size: V3; color: string }) {
  return <mesh position={at} scale={size} castShadow><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>;
}
function Pipe({ at, radius, height, color = C.metal, rotation }: { at: V3; radius: number; height: number; color?: string; rotation?: V3 }) {
  return <mesh position={at} rotation={rotation} castShadow><cylinderGeometry args={[radius, radius, height, 12]} /><meshStandardMaterial color={color} roughness={0.3} metalness={color === C.metal ? 0.8 : 0} /></mesh>;
}
function Plant({ at, scale = 1 }: { at: V3; scale?: number }) {
  return <group position={at} scale={scale}>
    <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.23, 0.16, 0.5, 20]} /><meshStandardMaterial color={C.peach} /></mesh>
    <Pipe at={[0, 0.7, 0]} radius={0.025} height={0.8} color={C.green} />
    {Array.from({ length: 5 }, (_, i) => <group key={i} rotation={[0, i * 2.4, -0.25]} position={[0, 0.55 + i * 0.13, 0]}><Ball at={[0.13, 0.1, 0]} size={[0.26, 0.1, 0.1]} color={i % 2 ? C.green : "#789269"} /></group>)}
  </group>;
}
function Window({ x = 0, z = -1.84 }: { x?: number; z?: number }) {
  return <group position={[x, 1.65, z]}>
    <Box size={[1.05, 1.1, 0.07]} color={C.green} />
    <Box at={[0, 0, 0.05]} size={[0.88, 0.93, 0.04]} color="#bed8d1" />
    <Box at={[0, 0, 0.09]} size={[0.045, 0.96, 0.035]} />
    <Box at={[0, 0, 0.09]} size={[0.91, 0.045, 0.035]} />
    <Box at={[0, -0.56, 0.05]} size={[1.2, 0.1, 0.22]} color={C.cream} />
  </group>;
}

/** Original articulated characters, built from geometry and animated at the joints. */
function Professional({ at, kind, state, rotation = 0 }: { at: V3; kind: "plumber" | "electrician" | "climate"; state: RefObject<HouseSceneState>; rotation?: number }) {
  const arm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const clock = useRef(0);
  useFrame((_, delta) => {
    if (!state.current.paused && !state.current.reduced) clock.current += Math.min(delta, 0.05);
    const t = clock.current;
    if (arm.current) { arm.current.rotation.x = -1.15 + Math.sin(t * 3.3) * 0.17; arm.current.rotation.z = Math.sin(t * 2.2) * 0.13; }
    if (body.current) body.current.rotation.x = -0.08 + Math.sin(t * 1.7) * 0.025;
  });
  const shirt = kind === "electrician" ? C.peach : kind === "climate" ? "#6b9295" : C.green;
  return <group position={at} rotation={[0, rotation, 0]} scale={0.88}>
    <Box at={[-0.15, 0.08, 0.08]} size={[0.2, 0.14, 0.36]} color={C.ink} round />
    <Box at={[0.15, 0.08, 0.08]} size={[0.2, 0.14, 0.36]} color={C.ink} round />
    <Pipe at={[-0.15, 0.42, 0]} radius={0.105} height={0.62} color="#506578" />
    <Pipe at={[0.15, 0.42, 0]} radius={0.105} height={0.62} color="#506578" />
    <group ref={body} position={[0, 0.72, 0]}>
      <Box at={[0, 0.25, 0]} size={[0.57, 0.62, 0.34]} color={shirt} round />
      <Box at={[0, 0.02, 0.19]} size={[0.58, 0.09, 0.05]} color="#a07747" />
      <Box at={[-0.16, 0.32, 0.18]} size={[0.06, 0.47, 0.025]} color="#c4c7aa" />
      <Box at={[0.16, 0.32, 0.18]} size={[0.06, 0.47, 0.025]} color="#c4c7aa" />
      <Ball at={[0, 0.79, 0]} size={[0.23, 0.27, 0.23]} color="#d6a578" />
      <mesh position={[0, 0.98, 0]} castShadow><sphereGeometry args={[0.245, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={kind === "electrician" ? C.gold : shirt} /></mesh>
      <Box at={[0, 0.98, 0.16]} size={[0.46, 0.045, 0.32]} color={kind === "electrician" ? C.gold : shirt} round />
      <Ball at={[-0.08, 0.81, 0.213]} size={[0.025, 0.027, 0.016]} color={C.ink} /><Ball at={[0.08, 0.81, 0.213]} size={[0.025, 0.027, 0.016]} color={C.ink} />
      <Ball at={[0, 0.75, 0.235]} size={[0.04, 0.055, 0.04]} color="#c78e63" />
      <group position={[-0.35, 0.47, 0]} rotation={[-0.5, 0, -0.15]}><Pipe at={[0, -0.18, 0]} radius={0.09} height={0.35} color={shirt} /><Ball at={[0, -0.4, 0]} size={[0.085, 0.12, 0.085]} color="#d6a578" /></group>
      <group ref={arm} position={[0.35, 0.47, 0]} rotation={[-1.15, 0, 0]}>
        <Pipe at={[0, -0.15, 0]} radius={0.09} height={0.3} color={shirt} />
        <Pipe at={[0, -0.4, 0.03]} radius={0.07} height={0.22} color="#d6a578" />
        <Ball at={[0, -0.53, 0.03]} size={[0.085, 0.1, 0.085]} color="#d6a578" />
        <group position={[0, -0.62, 0.03]} rotation={[0, 0, 0.5]}>
          <Box size={[0.055, 0.34, 0.045]} color={C.metal} metal />
          <Box at={[-0.055, -0.2, 0]} size={[0.06, 0.12, 0.07]} color={C.metal} metal /><Box at={[0.055, -0.2, 0]} size={[0.06, 0.12, 0.07]} color={C.metal} metal />
          {kind === "electrician" && <Box at={[0, 0.11, 0]} size={[0.1, 0.2, 0.08]} color="#eeb248" round />}
        </group>
      </group>
    </group>
  </group>;
}

function Water({ state }: { state: RefObject<HouseSceneState> }) {
  const drops = useRef<THREE.InstancedMesh>(null);
  const object = useMemo(() => new THREE.Object3D(), []);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!state.current.reduced && !state.current.paused) time.current += Math.min(delta, 0.05);
    if (!drops.current) return;
    for (let i = 0; i < 7; i++) { const f = (time.current * 0.8 + i / 7) % 1; object.position.set(-0.3, 1.34 - f * 0.42, -0.74); object.scale.set(0.018, 0.035, 0.018); object.updateMatrix(); drops.current.setMatrixAt(i, object.matrix); }
    drops.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={drops} args={[undefined, undefined, 7]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#66b9c5" roughness={0.1} metalness={0.2} /></instancedMesh>;
}

function Bathroom({ state }: { state: RefObject<HouseSceneState> }) {
  return <>
    <Box at={[0, 0.03, 0]} size={[3.2, 0.14, 3.8]} color="#bad0c2" />
    {Array.from({ length: 6 }, (_, i) => <Box key={i} at={[-1.36 + i * 0.54, 0.11, 0]} size={[0.012, 0.008, 3.8]} color="#e0e7d8" />)}
    <Box at={[0, 1.4, -1.95]} size={[3.2, 2.8, 0.15]} color="#c2d2bf" />
    <Window x={0.83} />
    <Box at={[-0.45, 0.55, -1.27]} size={[1.3, 0.9, 0.8]} color={C.green} round />
    <Box at={[-0.45, 1.04, -1.26]} size={[1.42, 0.12, 0.9]} color={C.white} round />
    <mesh position={[-0.45, 1.11, -1.2]} scale={[0.46, 0.09, 0.29]}><sphereGeometry args={[1, 24, 12]} /><meshStandardMaterial color="#d6dfd5" roughness={0.23} /></mesh>
    <Pipe at={[-0.3, 1.3, -1.52]} radius={0.035} height={0.42} />
    <Pipe at={[-0.3, 1.5, -1.3]} radius={0.035} height={0.42} rotation={[Math.PI / 2, 0, 0]} />
    <mesh position={[-0.45, 1.97, -1.84]}><circleGeometry args={[0.49, 40]} /><meshStandardMaterial color="#c2d6d0" metalness={0.8} roughness={0.12} /></mesh>
    <mesh position={[-0.45, 1.97, -1.86]}><torusGeometry args={[0.51, 0.035, 8, 40]} /><meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.3} /></mesh>
    <Water state={state} />
    <Professional at={[-0.03, 0.12, 0]} kind="plumber" rotation={-2.6} state={state} />
    <Box at={[0.9, 0.27, 0.8]} size={[0.48, 0.32, 0.3]} color={C.peach} round />
    <Pipe at={[0.9, 0.46, 0.8]} radius={0.025} height={0.35} color={C.ink} rotation={[0, 0, Math.PI / 2]} />
    <Plant at={[1.1, 0.1, -1.25]} scale={0.6} />
  </>;
}
function ElectricRoom({ state }: { state: RefObject<HouseSceneState> }) {
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!state.current.reduced && !state.current.paused) time.current += Math.min(delta, 0.05);
    if (lamp.current) lamp.current.emissiveIntensity = 0.7 + Math.sin(time.current * 1.8) * 0.25;
  });
  return <>
    <Box at={[0, 0.03, 0]} size={[3.2, 0.14, 3.8]} color="#d5b794" />
    {Array.from({ length: 7 }, (_, i) => <Box key={i} at={[-1.4 + i * 0.47, 0.105, 0]} size={[0.01, 0.006, 3.8]} color="#b99774" />)}
    <Box at={[0, 1.4, -1.95]} size={[3.2, 2.8, 0.15]} color={C.cream} />
    <Box at={[-0.3, 1.7, -1.8]} size={[0.75, 0.83, 0.17]} color="#6f8278" round />
    <Box at={[-0.3, 1.7, -1.69]} size={[0.61, 0.67, 0.1]} color={C.ink} />
    {Array.from({ length: 4 }, (_, i) => <Box key={i} at={[-0.49 + i * 0.13, 1.72, -1.61]} size={[0.08, 0.23, 0.07]} color={i === 2 ? C.peach : C.white} round />)}
    <Pipe at={[-0.3, 2.4, -1.83]} height={0.6} radius={0.025} color={C.ink} />
    <Professional at={[0.12, 0.12, -0.55]} kind="electrician" rotation={Math.PI} state={state} />
    <Box at={[1.05, 0.55, -1.13]} size={[0.66, 0.9, 0.7]} color={C.peach} round />
    <Pipe at={[1.05, 1.45, -1.13]} radius={0.025} height={0.85} color={C.ink} />
    <mesh position={[1.05, 1.88, -1.13]} castShadow><coneGeometry args={[0.38, 0.42, 24, 1, true]} /><meshStandardMaterial color={C.gold} side={THREE.DoubleSide} /></mesh>
    <mesh position={[1.05, 1.74, -1.13]}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial ref={lamp} color="#ffe4a2" emissive="#ffb852" emissiveIntensity={1} /></mesh>
    <Box at={[-1.13, 0.3, 0.5]} size={[0.5, 0.37, 0.38]} color={C.green} round />
    <Plant at={[-1.12, 0.1, -1.3]} scale={0.8} />
  </>;
}
function ClimateRoom({ state }: { state: RefObject<HouseSceneState> }) {
  const air = useRef<THREE.Group>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!state.current.reduced && !state.current.paused) time.current += Math.min(delta, 0.05);
    if (air.current) { air.current.position.z = Math.sin(time.current * 1.5) * 0.13; air.current.scale.z = 1 + Math.sin(time.current * 1.5) * 0.12; }
  });
  const curves = useMemo(() => [-0.3, 0, 0.3].map(x => new THREE.CatmullRomCurve3([new THREE.Vector3(x, 2.03, -1.4), new THREE.Vector3(x + 0.1, 1.87, -0.9), new THREE.Vector3(x, 1.9, -0.3), new THREE.Vector3(x + 0.1, 1.72, 0.2)])), []);
  return <>
    <Box at={[0, 0.03, 0]} size={[3.2, 0.14, 3.8]} color="#d5b794" />
    <Box at={[0, 1.4, -1.95]} size={[3.2, 2.8, 0.15]} color="#e7ddc7" />
    <Box at={[0.25, 2.28, -1.72]} size={[1.25, 0.45, 0.33]} color={C.white} round />
    <Box at={[0.25, 2.12, -1.52]} size={[1.04, 0.05, 0.04]} color="#658b7f" />
    <Box at={[0.7, 2.29, -1.53]} size={[0.07, 0.035, 0.015]} color="#76a693" />
    <group ref={air} position={[0.25, 0, 0]}>{curves.map((curve, i) => <mesh key={i}><tubeGeometry args={[curve, 16, 0.012, 5, false]} /><meshStandardMaterial color="#9bbfc0" transparent opacity={0.65} /></mesh>)}</group>
    <group position={[0.6, 0.14, -0.5]} rotation={[0, 0, -0.1]}>
      <Pipe at={[-0.3, 0.6, 0]} height={1.3} radius={0.035} color={C.peach} /><Pipe at={[0.3, 0.6, 0]} height={1.3} radius={0.035} color={C.peach} />
      {[0.25, 0.55, 0.85, 1.15].map(y => <Pipe key={y} at={[0, y, 0]} height={0.6} radius={0.03} color={C.peach} rotation={[0, 0, Math.PI / 2]} />)}
    </group>
    <Professional at={[0.6, 0.72, -0.3]} kind="climate" rotation={Math.PI} state={state} />
    <Box at={[-0.6, 0.3, 0.8]} size={[1.7, 0.43, 0.77]} color={C.green} round />
    <Box at={[-0.6, 0.66, 1.09]} size={[1.7, 0.48, 0.2]} color={C.green} round />
    <Box at={[-1.35, 0.49, 0.8]} size={[0.2, 0.55, 0.8]} color={C.green} round />
    <Box at={[0.15, 0.49, 0.8]} size={[0.2, 0.55, 0.8]} color={C.green} round />
    <Box at={[-0.85, 0.66, 0.8]} size={[0.4, 0.25, 0.16]} color={C.peach} round rotation={[-0.15, 0, 0.15]} />
    <Plant at={[1.14, 0.1, 1.15]} scale={1.15} />
    <Box at={[-1.3, 1.8, -1.83]} size={[0.39, 0.55, 0.06]} color={C.peach} /><Box at={[-1.3, 1.8, -1.78]} size={[0.29, 0.45, 0.025]} color={C.white} />
  </>;
}

export function LivingHouse({ state }: { state: RefObject<HouseSceneState> }) {
  const house = useRef<THREE.Group>(null);
  const roof = useRef<THREE.Group>(null);
  const facade = useRef<THREE.Group>(null);
  const bathroom = useRef<THREE.Group>(null);
  const climate = useRef<THREE.Group>(null);
  const roofMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const frontMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const previousOpening = useRef(-1);
  useEffect(() => {
    [roof.current, facade.current].forEach(group => group?.traverse(object => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { material.transparent = true; material.needsUpdate = true; });
      }
    }));
  }, []);
  useFrame(() => {
    const p = state.current.reduced ? 0 : state.current.progress * 6;
    const angles = [0, -0.07, 0.025, -0.025, 0.035, -0.06, 0];
    const index = Math.min(5, Math.floor(p));
    if (house.current) house.current.rotation.y = THREE.MathUtils.lerp(angles[index], angles[index + 1], p - index);
    const opening = THREE.MathUtils.smoothstep(p, 0.15, 0.95) * (1 - THREE.MathUtils.smoothstep(p, 5.1, 5.95));
    const explode = THREE.MathUtils.smoothstep(p, 4.4, 5) * (1 - THREE.MathUtils.smoothstep(p, 5.15, 5.9));
    if (roof.current) { roof.current.position.y = opening * 4; roof.current.visible = opening < 0.98; }
    if (roofMaterial.current) roofMaterial.current.opacity = 1 - opening;
    if (facade.current) { facade.current.position.y = -opening * 3; facade.current.visible = opening < 0.95; }
    if (frontMaterial.current) frontMaterial.current.opacity = 1 - opening;
    if (opening !== previousOpening.current) {
      [roof.current, facade.current].forEach(group => group?.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = opening < 0.01;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => { material.opacity = 1 - opening; material.depthWrite = opening < 0.1; });
        }
      }));
      previousOpening.current = opening;
    }
    if (bathroom.current) { bathroom.current.position.x = -3.3 - explode * 0.7; bathroom.current.position.y = explode * 0.15; }
    if (climate.current) { climate.current.position.x = 3.3 + explode * 0.7; climate.current.position.y = explode * 0.45; }
  });
  return <group ref={house}>
    <Box at={[0, -0.28, 0]} size={[10.7, 0.42, 5.1]} color="#a4b397" round />
    <Box at={[0, -0.02, 0]} size={[10.4, 0.18, 4.8]} color={C.cream} round />
    <group ref={bathroom} position={[-3.3, 0, 0]}><Bathroom state={state} /><Box at={[-1.67, 1.4, 0]} size={[0.15, 2.8, 3.8]} color={C.cream} /></group>
    <group><ElectricRoom state={state} /></group>
    <group ref={climate} position={[3.3, 0, 0]}><ClimateRoom state={state} /><Box at={[1.67, 1.4, 0]} size={[0.15, 2.8, 3.8]} color={C.cream} /></group>
    <Box at={[-1.65, 1.4, -1.1]} size={[0.12, 2.8, 1.7]} color={C.cream} /><Box at={[1.65, 1.4, -1.1]} size={[0.12, 2.8, 1.7]} color={C.cream} />
    <group ref={facade}>
      <mesh position={[0, 1.4, 1.94]} castShadow><boxGeometry args={[10.1, 2.8, 0.17]} /><meshStandardMaterial ref={frontMaterial} color={C.cream} transparent /></mesh>
      <group position={[-3.3, 0, 3.96]}><Window /></group><group position={[3.3, 0, 3.96]}><Window /></group>
      <Box at={[0, 1.01, 2.05]} size={[1.05, 2.02, 0.12]} color={C.green} round />
      <Box at={[0, 1.29, 2.13]} size={[0.7, 1.04, 0.03]} color="#88a99b" /><Ball at={[0.35, 0.88, 2.14]} size={[0.04, 0.04, 0.04]} color={C.gold} />
    </group>
    <group ref={roof}>
      <mesh position={[0, 3.17, -1.05]} rotation={[-0.46, 0, 0]} castShadow><boxGeometry args={[10.7, 0.18, 2.5]} /><meshStandardMaterial ref={roofMaterial} color={C.roof} roughness={0.8} transparent /></mesh>
      <mesh position={[0, 3.17, 1.05]} rotation={[0.46, 0, 0]} castShadow><boxGeometry args={[10.7, 0.18, 2.5]} /><meshStandardMaterial color={C.roof} roughness={0.8} /></mesh>
      {Array.from({ length: 18 }, (_, i) => <group key={i} position={[-5.08 + i * 0.6, 0, 0]}><Box at={[0, 3.27, -1.05]} size={[0.045, 0.06, 2.51]} color="#9e563b" rotation={[-0.46, 0, 0]} /><Box at={[0, 3.27, 1.05]} size={[0.045, 0.06, 2.51]} color="#9e563b" rotation={[0.46, 0, 0]} /></group>)}
      <Box at={[3.4, 3.75, -0.6]} size={[0.55, 1.1, 0.55]} color={C.cream} /><Box at={[3.4, 4.31, -0.6]} size={[0.7, 0.12, 0.7]} color={C.peach} />
    </group>
    <Plant at={[-4.7, 0.05, 2.1]} scale={0.7} /><Plant at={[4.7, 0.05, 2.1]} scale={0.7} />
    <Box at={[0, -0.1, 2.85]} size={[1.7, 0.13, 1.2]} color="#c9b99c" round />
    <group position={[-5.45, -0.08, -1.4]}><Pipe at={[0, 0.8, 0]} radius={0.12} height={1.6} color="#94724c" /><Ball at={[0, 2, 0]} size={[0.75, 1.1, 0.72]} color="#718966" /><Ball at={[-0.35, 1.65, 0.1]} size={[0.6, 0.7, 0.6]} color="#819675" /></group>
    <group position={[5.6, -0.08, -1.3]}><Pipe at={[0, 0.7, 0]} radius={0.1} height={1.4} color="#94724c" /><Ball at={[0, 1.7, 0]} size={[0.65, 0.9, 0.65]} color="#819675" /></group>
  </group>;
}
