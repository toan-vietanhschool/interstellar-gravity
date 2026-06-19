/* ============================================================
   BlackHole.tsx — Gargantua (Interstellar) dựng bằng hình học
   - Quả cầu đen: chân trời sự kiện (shadow)
   - Đĩa bồi tụ phẳng (xích đạo): shader trắng→vàng, additive
   - Vầng halo billboard ôm quanh cầu: thấu kính + vành photon
   Đáng tin, luôn render đúng — không ray-march mò.
   ============================================================ */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Body } from '../physics/types';

// ----- Đĩa bồi tụ (mặt phẳng xích đạo) -----
const DISK_VERT = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const DISK_FRAG = /* glsl */ `
precision highp float;
varying vec3 vLocal;
uniform float uInner;
uniform float uOuter;
uniform float uTime;
void main() {
  float r = length(vLocal.xy);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.72, 1.0, t));
  vec3 hot = vec3(1.0, 0.97, 0.90);
  vec3 warm = vec3(1.0, 0.74, 0.42);
  vec3 col = mix(hot, warm, t);
  float ang = atan(vLocal.y, vLocal.x);
  float swirl = 0.82 + 0.18 * sin(ang * 3.0 - uTime * 0.8 + r * 0.15);
  float dop = 1.0 + 0.55 * cos(ang);     // Doppler: bên +x sáng & dày hơn
  float bright = (2.7 * (1.0 - t) + 0.6) * edge * swirl * dop;
  gl_FragColor = vec4(col * bright, 1.0);
}`;

// ----- Vầng halo (billboard, ôm quanh cầu) -----
const HALO_VERT = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
precision highp float;
varying vec3 vLocal;
uniform float uInner;
uniform float uOuter;
void main() {
  float r = length(vLocal.xy);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float glow = pow(1.0 - t, 2.2);              // sáng sát mép cầu, nhạt dần ra
  float innerFade = smoothstep(0.0, 0.06, t);  // mềm ở mép trong (vành photon)
  float ang = atan(vLocal.y, vLocal.x);
  float dop = 1.0 + 0.45 * cos(ang);     // Doppler: sáng hơn một bên
  float a = glow * innerFade * dop;
  vec3 col = vec3(1.0, 0.95, 0.86);
  gl_FragColor = vec4(col * a * 1.9, 1.0);
}`;

export function BlackHole({ body, size }: { body: Body; size: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const diskUniforms = useMemo(() => ({
    uInner: { value: size * 1.25 },
    uOuter: { value: size * 3.1 },
    uTime: { value: 0 },
  }), [size]);

  const haloUniforms = useMemo(() => ({
    uInner: { value: size * 1.0 },
    uOuter: { value: size * 2.7 },
  }), [size]);

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.position.set(body.pos.x, body.pos.y, body.pos.z);
    diskUniforms.uTime.value += dt;
    if (haloRef.current) haloRef.current.lookAt(camera.position); // luôn hướng camera
  });

  return (
    <group ref={groupRef}>
      {/* Chân trời sự kiện — quả cầu đen */}
      <mesh>
        <sphereGeometry args={[size, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Vầng halo (thấu kính + vành photon) — billboard quanh cầu */}
      <mesh ref={haloRef} renderOrder={2}>
        <ringGeometry args={[size * 1.0, size * 2.7, 160]} />
        <shaderMaterial
          args={[{ uniforms: haloUniforms, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }]}
        />
      </mesh>

      {/* Đĩa bồi tụ — mặt phẳng xích đạo (nằm ngang) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <ringGeometry args={[size * 1.25, size * 3.1, 200]} />
        <shaderMaterial
          args={[{ uniforms: diskUniforms, vertexShader: DISK_VERT, fragmentShader: DISK_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }]}
        />
      </mesh>
    </group>
  );
}
