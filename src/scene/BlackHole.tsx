/* ============================================================
   BlackHole.tsx — Hố đen Gargantua + thấu kính hấp dẫn (ray-march)
   Góc nhìn ngoài, gần-edge-on: đĩa trắng sáng mượt, thấu kính uốn
   mặt sau thành vầng halo trên/dưới, vành photon sáng, nền sao.
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

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

vec3 starField(vec3 dir) {
  vec3 d = normalize(dir) * 140.0;
  float h = hash(floor(d));
  float s = smoothstep(0.9935, 1.0, h);
  float h2 = hash(floor(d * 2.3 + 7.0));
  s += 0.35 * smoothstep(0.997, 1.0, h2);
  vec3 col = vec3(s);
  col += 0.008 * vec3(0.1, 0.12, 0.25);
  return col * 0.3;
}

vec3 diskColor(float r, float ang, float dop) {
  float t = clamp((r - uDiskIn) / (uDiskOut - uDiskIn), 0.0, 1.0);
  vec3 hot = vec3(1.0, 0.98, 0.94);
  vec3 warm = vec3(1.0, 0.80, 0.60);
  vec3 col = mix(hot, warm, t);
  float swirl = 0.72 + 0.28 * sin(ang * 2.0 - uTime * 0.9 + r * 0.12);
  float bright = mix(2.1, 0.55, t * t) * (0.65 + 0.35 * swirl) * dop;
  return col * bright;
}

vec3 photonRingGlow(float r) {
  float r_photon = uHorizon * 1.5;
  float width = uHorizon * 0.25;
  float dist = abs(r - r_photon);
  if (dist < width) {
    float fade = (1.0 - dist / width);
    fade = fade * fade;
    return vec3(1.0, 0.92, 0.65) * fade * 1.8;
  }
  return vec3(0.0);
}

void main() {
  vec3 dir = normalize(vWorld - uCam);
  vec3 p = uCam;
  vec3 v = dir;
  vec3 col = vec3(0.0);
  vec3 glowAccum = vec3(0.0);

  float GM = uHorizon * uHorizon * 6.4;
  float maxDist = length(uBH - uCam) + uDiskOut * 3.0 + 250.0;
  float travelled = 0.0;
  bool horizon = false;
  int diskHits = 0;
  const int maxDiskHits = 4;

  for (int i = 0; i < 200; i++) {
    vec3 toBH = uBH - p;
    float r = length(toBH);

    float step = clamp(r * 0.11, 0.3, 10.0);
    v = normalize(v + normalize(toBH) * (GM / (r * r)) * step);
    vec3 prev = p;
    p += v * step;
    travelled += step;

    if (r < uHorizon) {
      horizon = true;
      break;
    }

    // vầng photon
    glowAccum += photonRingGlow(r) * 0.12;

    // nhiều lần cắt mặt phẳng đĩa → ảnh chính + ảnh thấu kính
    if (diskHits < maxDiskHits) {
      float y0 = prev.y - uBH.y;
      float y1 = p.y - uBH.y;
      if (y0 * y1 < 0.0) {
        float tt = y0 / (y0 - y1);
        vec3 hit = mix(prev, p, tt);
        vec2 rel = vec2(hit.x - uBH.x, hit.z - uBH.z);
        float rr = length(rel);
        if (rr > uDiskIn && rr < uDiskOut) {
          float ang = atan(rel.y, rel.x);
          vec3 tang = normalize(vec3(-rel.y, 0.0, rel.x));
          float dop = 1.0 + 0.7 * dot(tang, normalize(uCam - hit));
          vec3 diskCol = diskColor(rr, ang, clamp(dop, 0.35, 1.85));
          float weight = 1.0 / (1.0 + float(diskHits) * 0.5);
          col += diskCol * weight;
          diskHits++;
        }
      }
    }

    if (travelled > maxDist) break;
  }

  if (horizon) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  col += glowAccum;
  col += starField(v);
  col = col / (col + vec3(1.0));   // tone-map Reinhard
  col = pow(col, vec3(0.87));
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
    if (meshRef.current) meshRef.current.position.copy(camera.position);
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
