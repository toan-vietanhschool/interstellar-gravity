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
  float edge = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.45, 1.0, t));
  vec3 hot = vec3(1.0, 0.98, 0.94);
  vec3 warm = vec3(0.85, 0.55, 0.36);     // nâu bụi ở rìa ngoài (vệt dust)
  vec3 col = mix(hot, warm, t);
  float ang = atan(vLocal.y, vLocal.x);
  float swirl = 0.8 + 0.2 * sin(ang * 4.0 - uTime * 0.7 + r * 0.18);
  float dop = 1.0 + 0.22 * cos(ang);     // Doppler nhẹ (gần đối xứng)
  float bright = (3.0 * (1.0 - t) + 0.45) * edge * swirl * dop;
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
  float glow = pow(1.0 - t, 1.5);              // dải sáng DÀY, vắt trên/dưới cầu
  float innerFade = smoothstep(0.0, 0.05, t);  // mềm ở mép trong (vành photon)
  float ang = atan(vLocal.y, vLocal.x);
  float dop = 1.0 + 0.2 * cos(ang);            // Doppler nhẹ
  float a = glow * innerFade * dop;
  vec3 col = vec3(1.0, 0.97, 0.92);
  gl_FragColor = vec4(col * a * 2.6, 1.0);
}`;

export function BlackHole({ body, size }: { body: Body; size: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const diskUniforms = useMemo(() => ({
    uInner: { value: size * 1.25 },
    uOuter: { value: size * 4.6 },
    uTime: { value: 0 },
  }), [size]);

  const haloUniforms = useMemo(() => ({
    uInner: { value: size * 1.0 },
    uOuter: { value: size * 3.0 },
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
        <ringGeometry args={[size * 1.0, size * 3.0, 160]} />
        <shaderMaterial
          args={[{ uniforms: haloUniforms, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }]}
        />
      </mesh>

      {/* Đĩa bồi tụ — mặt phẳng xích đạo (nằm ngang) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <ringGeometry args={[size * 1.25, size * 4.6, 200]} />
        <shaderMaterial
          args={[{ uniforms: diskUniforms, vertexShader: DISK_VERT, fragmentShader: DISK_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }]}
        />
      </mesh>
    </group>
  );
}
