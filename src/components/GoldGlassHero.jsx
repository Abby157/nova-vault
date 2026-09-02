import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Sparkles, MeshTransmissionMaterial, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { C } from "../theme";

const GOLD = new THREE.Color(C.gold);
const GOLD_LIGHT = new THREE.Color(C.goldLight);

function GoldShard({ position, rotation, scale, geometry = "octahedron" }) {
  const geo = useMemo(() => {
    if (geometry === "icosahedron") return new THREE.IcosahedronGeometry(1, 0);
    if (geometry === "tetrahedron") return new THREE.TetrahedronGeometry(1, 0);
    return new THREE.OctahedronGeometry(1, 0);
  }, [geometry]);
  return (
    <Float speed={1.4} rotationIntensity={1.1} floatIntensity={1.6}>
      <mesh position={position} rotation={rotation} scale={scale} geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={GOLD}
          metalness={1}
          roughness={0.22}
          clearcoat={1}
          clearcoatRoughness={0.15}
          reflectivity={1}
          envMapIntensity={2.8}
          emissive={GOLD_LIGHT}
          emissiveIntensity={0.04}
        />
      </mesh>
    </Float>
  );
}

function GlassShard({ position, rotation, scale, geometry = "icosahedron" }) {
  const geo = useMemo(() => {
    if (geometry === "icosahedron") return new THREE.IcosahedronGeometry(1, 0);
    if (geometry === "tetrahedron") return new THREE.TetrahedronGeometry(1, 0);
    return new THREE.OctahedronGeometry(1, 0);
  }, [geometry]);
  return (
    <Float speed={1.1} rotationIntensity={0.9} floatIntensity={1.9}>
      <mesh position={position} rotation={rotation} scale={scale} geometry={geo} castShadow>
        <MeshTransmissionMaterial
          thickness={0.6}
          roughness={0.06}
          transmission={1}
          ior={1.5}
          chromaticAberration={0.04}
          anisotropy={0.15}
          distortion={0.15}
          distortionScale={0.2}
          temporalDistortion={0.1}
          color={C.goldLight}
          background={new THREE.Color(C.bg)}
        />
      </mesh>
    </Float>
  );
}

function Cluster() {
  const group = useRef();
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.09;
  });

  const shards = useMemo(() => ([
    { type: "gold",  geometry: "octahedron",   position: [0, 0.2, 0],       rotation: [0.4, 0.3, 0],   scale: 1.35 },
    { type: "glass", geometry: "icosahedron",  position: [1.6, 0.6, -0.6],  rotation: [0.2, 0.6, 0.1], scale: 0.9  },
    { type: "gold",  geometry: "tetrahedron",  position: [-1.7, -0.3, 0.3], rotation: [0.6, 0.1, 0.3], scale: 0.85 },
    { type: "glass", geometry: "octahedron",   position: [-1.1, 1.1, -0.9], rotation: [0.3, 0.9, 0.2], scale: 0.65 },
    { type: "gold",  geometry: "icosahedron",  position: [1.3, -1.0, 0.4],  rotation: [0.1, 0.4, 0.5], scale: 0.6  },
    { type: "glass", geometry: "tetrahedron",  position: [0.2, -1.3, -0.4], rotation: [0.5, 0.2, 0.1], scale: 0.75 },
  ]), []);

  return (
    <group ref={group}>
      {shards.map((s, i) =>
        s.type === "gold"
          ? <GoldShard key={i} position={s.position} rotation={s.rotation} scale={s.scale} geometry={s.geometry} />
          : <GlassShard key={i} position={s.position} rotation={s.rotation} scale={s.scale} geometry={s.geometry} />
      )}
    </group>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 6, 14]} />
      <ambientLight intensity={0.45} />
      <spotLight position={[4, 5, 4]} angle={0.35} penumbra={1} intensity={3} color={C.goldLight} castShadow />
      <spotLight position={[-4, -2, -3]} angle={0.5} penumbra={1} intensity={1.2} color={C.gold} />
      <Suspense fallback={null}>
        <Environment preset="studio" />
        <Cluster />
        <Sparkles count={60} scale={7} size={2.4} speed={0.35} color={C.goldLight} opacity={0.6} />
        <ContactShadows position={[0, -2.1, 0]} opacity={0.5} scale={10} blur={2.4} far={3} color={C.gold} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.35} luminanceSmoothing={0.9} intensity={0.7} mipmapBlur />
          <Vignette eskil={false} offset={0.15} darkness={0.65} />
        </EffectComposer>
      </Suspense>
    </>
  );
}

export default function GoldGlassHero({ height = 340 }) {
  return (
    <div style={{ width: "100%", height, borderRadius: 24, overflow: "hidden", position: "relative" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6.2], fov: 42 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
