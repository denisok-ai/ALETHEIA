'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Мягкая круглая текстура для частиц (звёзды/пыль), без жёстких квадратов
function useSoftPointTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.25, 'rgba(255,248,230,0.5)');
    gradient.addColorStop(0.5, 'rgba(212,175,135,0.15)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

const COUNT = 800;

function CosmicParticles({ mouse }: { mouse: { x: number; y: number } }) {
  const ref = useRef<THREE.Points>(null);
  const texture = useSoftPointTexture();
  const prevMouse = useRef({ x: mouse.x * 5, y: mouse.y * 5 });
  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      vel[i * 3] = (Math.random() - 0.5) * 0.015;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.015;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.008;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const points = ref.current;
    const pos = (points.geometry as THREE.BufferGeometry).attributes.position?.array as Float32Array;
    if (!pos) return;
    const mx = mouse.x * 5;
    const my = mouse.y * 5;
    const dx = mx - prevMouse.current.x;
    const dy = my - prevMouse.current.y;
    prevMouse.current = { x: mx, y: my };
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const dist = Math.sqrt((pos[ix] - mx) ** 2 + (pos[ix + 1] - my) ** 2) || 0.01;
      const force = 0.06 / dist;
      pos[ix] += (dx * force + velocities[ix]) * 0.35;
      pos[ix + 1] += (dy * force + velocities[ix + 1]) * 0.35;
      pos[ix + 2] += velocities[ix + 2];
      if (Math.abs(pos[ix]) > 11) velocities[ix] *= -1;
      if (Math.abs(pos[ix + 1]) > 11) velocities[ix + 1] *= -1;
      if (Math.abs(pos[ix + 2]) > 5) velocities[ix + 2] *= -1;
    }
    (points.geometry as THREE.BufferGeometry).attributes.position!.needsUpdate = true;
    points.rotation.y = state.clock.elapsedTime * 0.012;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.28}
        color="#e8e0d4"
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const SOFT_COUNT = 350;

function StardustLayer() {
  const ref = useRef<THREE.Points>(null);
  const texture = useSoftPointTexture();
  const positionsSoft = useMemo(() => {
    const pos = new Float32Array(SOFT_COUNT * 3);
    for (let i = 0; i < SOFT_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return pos;
  }, []);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.008;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={SOFT_COUNT} array={positionsSoft} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.45}
        color="#f5f0e8"
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Мягкие «туманности» — полупрозрачные сферы без жёстких границ
function NebulaGlow({ position, scale, color }: { position: [number, number, number]; scale: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.4) * 0.3;
    ref.current.rotation.y = state.clock.elapsedTime * 0.06;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.08}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// Мягкие световые «звёзды» — маленькие свечения вместо жёстких сфер
function SoftOrb({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.25;
    ref.current.rotation.y = state.clock.elapsedTime * 0.1;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[0.4, 24, 24]} />
      <meshBasicMaterial
        color="#f5eed8"
        transparent
        opacity={0.25}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function ParticleBackground() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = -(e.clientY - rect.top) / rect.height + 0.5;
      setMouse({ x, y });
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0">
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 85% 75% at 50% 50%, transparent 45%, rgba(245,242,236,0.2) 100%)',
        }}
        aria-hidden
      />
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ minHeight: '100%' }}
      >
        <color attach="background" args={['#f5f2ec']} />
        <ambientLight intensity={0.6} />
        <pointLight position={[2, 2, 5]} intensity={0.4} color="#e8dcc8" />

        {/* Фоновые мягкие «туманности» в тонах картинки */}
        <NebulaGlow position={[1.5, 0.5, -4]} scale={2.5} color="#c4a876" />
        <NebulaGlow position={[-1.2, -0.3, -3.5]} scale={1.8} color="#d4c4e0" />
        <NebulaGlow position={[0, 1, -3]} scale={1.2} color="#a68b5b" />

        <CosmicParticles mouse={mouse} />
        <StardustLayer />

        <SoftOrb position={[2.2, 1, -1.5]} scale={1.2} />
        <SoftOrb position={[-1.8, -0.5, -1]} scale={0.9} />
        <SoftOrb position={[1, -1.2, -0.5]} scale={0.7} />
      </Canvas>
    </div>
  );
}
