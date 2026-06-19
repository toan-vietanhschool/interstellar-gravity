/* ============================================================
   BlackHole.tsx — Hố đen + thấu kính hấp dẫn (ray-march GLSL)
   Một quả cầu nền lớn bám theo camera; fragment shader bắn tia từ
   camera, bẻ cong quanh hố đen (Schwarzschild gần đúng), dựng đĩa
   bồi tụ + vành sáng (Einstein ring) + nền sao bị thấu kính.
   ============================================================ */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Body } from '../physics/types';

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform vec3 uCam;
uniform vec3 uBH;
uniform float uTime;
uniform float uHorizon;
uniform float uDiskIn;
uniform float uDiskOut;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

vec3 starField(vec3 dir){
  vec3 d = normalize(dir) * 140.0;
  float h = hash(floor(d));
  float s = smoothstep(0.9935, 1.0, h);
  float h2 = hash(floor(d * 2.3 + 7.0));
  s += 0.5 * smoothstep(0.997, 1.0, h2);
  vec3 col = vec3(s);
  col += 0.015 * vec3(0.25, 0.32, 0.6); // ánh nền tinh vân mờ
  return col;
}

vec3 diskColor(float r, float ang, float dop){
  float t = clamp((r - uDiskIn) / (uDiskOut - uDiskIn), 0.0, 1.0);
  vec3 hot = vec3(1.0, 0.96, 0.86);
  vec3 cool = vec3(1.0, 0.42, 0.10);
  vec3 col = mix(hot, cool, t);
  float swirl = 0.55 + 0.45 * sin(ang * 3.0 - uTime * 1.6 + r * 0.25);
  float bright = mix(1.7, 0.45, t) * (0.55 + 0.7 * swirl) * dop;
  return col * bright;
}

void main(){
  vec3 dir = normalize(vWorld - uCam);
  vec3 p = uCam;
  vec3 v = dir;
  vec3 col = vec3(0.0);
  float GM = uHorizon * uHorizon * 3.2;      // độ mạnh bẻ cong
  float maxDist = length(uBH - uCam) + uDiskOut * 3.0 + 250.0;
  float travelled = 0.0;
  bool horizon = false;

  for (int i = 0; i < 160; i++){
    vec3 toBH = uBH - p;
    float r = length(toBH);
    float step = clamp(r * 0.12, 0.4, 14.0);
    v = normalize(v + normalize(toBH) * (GM / (r * r)) * step);  // bẻ cong tia
    vec3 prev = p;
    p += v * step;
    travelled += step;
    if (r < uHorizon){ horizon = true; break; }
    // cắt mặt phẳng đĩa y = uBH.y
    float y0 = prev.y - uBH.y;
    float y1 = p.y - uBH.y;
    if (y0 * y1 < 0.0){
      float tt = y0 / (y0 - y1);
      vec3 hit = mix(prev, p, tt);
      vec2 rel = vec2(hit.x - uBH.x, hit.z - uBH.z);
      float rr = length(rel);
      if (rr > uDiskIn && rr < uDiskOut){
        float ang = atan(rel.y, rel.x);
        // doppler gần đúng: bên quay về phía nhìn sáng hơn
        vec3 tang = normalize(vec3(-rel.y, 0.0, rel.x));
        float dop = 1.0 + 0.6 * dot(tang, normalize(uCam - hit));
        col += diskColor(rr, ang, clamp(dop, 0.35, 1.8));
      }
    }
    if (travelled > maxDist) break;
  }

  if (horizon){ gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  col += starField(v);
  col = col / (col + vec3(1.0));        // tone-map Reinhard
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

export function BlackHole({ body, size }: { body: Body; size: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const uniforms = useMemo(() => ({
    uCam: { value: new THREE.Vector3() },
    uBH: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uHorizon: { value: size },
    uDiskIn: { value: size * 1.6 },
    uDiskOut: { value: size * 7.0 },
  }), [size]);

  useFrame((_, dt) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position); // cầu nền bám camera
    uniforms.uCam.value.copy(camera.position);
    uniforms.uBH.value.set(body.pos.x, body.pos.y, body.pos.z);
    uniforms.uTime.value += dt;
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[3000, 32, 32]} />
      <shaderMaterial
        args={[{ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false }]}
      />
    </mesh>
  );
}
