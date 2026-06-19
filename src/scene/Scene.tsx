/* ============================================================
   Scene.tsx — Nội dung 3D: chạy engine, vẽ vật thể, vệt, vector,
   điểm sao, khối tâm, hố đen.
   ============================================================ */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { engine } from '../sim';
import { getScenario } from '../physics/scenarios';
import type { Body, Conservation } from '../physics/types';
import { BlackHole } from './BlackHole';

export interface SelInfo {
  name?: string;
  kind: string;
  mass: number;
  speed: number;
  dist: number;
  color: [number, number, number];
}

const hex = (c: [number, number, number]) =>
  '#' + c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');

const normTo = (x: number, y: number, z: number) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l] as const;
};

// ---------------- Stepper: chạy vật lý + callback ----------------
function Stepper(props: {
  paused: boolean; speed: number; dt: number;
  followId: number | null; selectedId: number | null;
  onConserve: (c: Conservation) => void; onSel: (s: SelInfo | null) => void;
}) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const tick = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!props.paused) {
      const n = Math.max(1, Math.min(10, Math.round(props.speed * 3)));
      for (let i = 0; i < n; i++) engine.step(props.dt);
      engine.pushTrails();
    }
    if (props.followId != null && controls) {
      const b = engine.bodies.find((x) => x.id === props.followId && x.alive);
      if (b) { target.set(b.pos.x, b.pos.y, b.pos.z); controls.target.lerp(target, 0.12); }
    }
    tick.current++;
    if (tick.current % 6 === 0) {
      props.onConserve(engine.conservation());
      if (props.selectedId != null) {
        const b = engine.bodies.find((x) => x.id === props.selectedId && x.alive);
        props.onSel(b ? {
          name: b.name, kind: b.kind, mass: b.mass,
          speed: Math.hypot(b.vel.x, b.vel.y, b.vel.z),
          dist: Math.hypot(b.pos.x, b.pos.y, b.pos.z), color: b.color,
        } : null);
      }
    }
  });
  return null;
}

// ---------------- Vật thể lớn: cầu + vệt + vector ----------------
function MajorBody(props: {
  body: Body; showTrail: boolean; showVector: boolean; selected: boolean;
  onSelect: (id: number) => void; velScale: number; maxArrow: number;
}) {
  const { body } = props;
  const meshRef = useRef<THREE.Mesh>(null);

  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1800), 3));
    g.setDrawRange(0, 0);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(...body.color), transparent: true, opacity: 0.5 }));
  }, [body]);

  const seg = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  };
  const velLine = useMemo(() => new THREE.Line(seg(), new THREE.LineBasicMaterial({ color: 0x5ad1ff })), [body]);
  const accLine = useMemo(() => new THREE.Line(seg(), new THREE.LineBasicMaterial({ color: 0xffb347 })), [body]);

  useFrame(() => {
    const m = meshRef.current;
    if (m) {
      m.visible = body.alive;
      m.position.set(body.pos.x, body.pos.y, body.pos.z);
      m.scale.setScalar(props.selected ? 1.4 : 1);
    }
    if (props.showTrail && body.trail.length >= 6) {
      const arr = trail.geometry.attributes.position.array as Float32Array;
      arr.set(body.trail);
      trail.geometry.setDrawRange(0, body.trail.length / 3);
      trail.geometry.attributes.position.needsUpdate = true;
      trail.geometry.computeBoundingSphere();
    }
    if (props.showVector) {
      const p = body.pos;
      const vd = normTo(body.vel.x, body.vel.y, body.vel.z);
      const vl = Math.min(props.maxArrow, Math.hypot(body.vel.x, body.vel.y, body.vel.z) * props.velScale);
      const va = velLine.geometry.attributes.position.array as Float32Array;
      va[0] = p.x; va[1] = p.y; va[2] = p.z;
      va[3] = p.x + vd[0] * vl; va[4] = p.y + vd[1] * vl; va[5] = p.z + vd[2] * vl;
      velLine.geometry.attributes.position.needsUpdate = true;
      const ad = normTo(body.acc.x, body.acc.y, body.acc.z);
      const al = props.maxArrow * 0.55;
      const aa = accLine.geometry.attributes.position.array as Float32Array;
      aa[0] = p.x; aa[1] = p.y; aa[2] = p.z;
      aa[3] = p.x + ad[0] * al; aa[4] = p.y + ad[1] * al; aa[5] = p.z + ad[2] * al;
      accLine.geometry.attributes.position.needsUpdate = true;
    }
  });

  const c = hex(body.color);
  return (
    <>
      <mesh ref={meshRef} onClick={(e: any) => { e.stopPropagation(); props.onSelect(body.id); }}>
        <sphereGeometry args={[body.radius, 28, 28]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={body.kind === 'star' ? 1.5 : 0.45} roughness={0.4} metalness={0.1} />
      </mesh>
      {props.showTrail && <primitive object={trail} />}
      {props.showVector && <primitive object={velLine} />}
      {props.showVector && <primitive object={accLine} />}
    </>
  );
}

// ---------------- Điểm sao / mảnh vụn (màu theo tốc độ) ----------------
function MinorPoints({ colorBySpeed }: { colorBySpeed: boolean }) {
  const points = useMemo(() => {
    const n = Math.max(1, engine.bodies.filter((b) => !b.major).length);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95 }));
  }, []);

  useFrame(() => {
    const arr = engine.bodies.filter((b) => !b.major && b.alive);
    const pos = points.geometry.attributes.position.array as Float32Array;
    const col = points.geometry.attributes.color.array as Float32Array;
    let maxv = 1;
    for (const b of arr) { const s = Math.hypot(b.vel.x, b.vel.y, b.vel.z); if (s > maxv) maxv = s; }
    let i = 0;
    for (const b of arr) {
      if (i * 3 + 2 >= pos.length) break;
      pos[i * 3] = b.pos.x; pos[i * 3 + 1] = b.pos.y; pos[i * 3 + 2] = b.pos.z;
      if (colorBySpeed) {
        const t = Math.min(1, Math.hypot(b.vel.x, b.vel.y, b.vel.z) / maxv);
        col[i * 3] = 0.4 + 0.6 * t; col[i * 3 + 1] = 0.6 - 0.15 * t; col[i * 3 + 2] = 1.0 - 0.7 * t;
      } else {
        col[i * 3] = b.color[0]; col[i * 3 + 1] = b.color[1]; col[i * 3 + 2] = b.color[2];
      }
      i++;
    }
    points.geometry.setDrawRange(0, i);
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
    points.geometry.computeBoundingSphere();
  });

  return <primitive object={points} />;
}

// ---------------- Khối tâm ----------------
function Barycenter() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    let M = 0, x = 0, y = 0, z = 0;
    for (const b of engine.bodies) { if (!b.alive) continue; M += b.mass; x += b.mass * b.pos.x; y += b.mass * b.pos.y; z += b.mass * b.pos.z; }
    if (ref.current && M) ref.current.position.set(x / M, y / M, z / M);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.8, 12, 12]} />
      <meshBasicMaterial color="#ffffff" wireframe />
    </mesh>
  );
}

// ---------------- Scene tổng ----------------
export function Scene(props: {
  scenarioName: string; resetKey: number;
  paused: boolean; speed: number;
  showTrails: boolean; showVectors: boolean; showBary: boolean; colorBySpeed: boolean;
  followId: number | null; selectedId: number | null;
  onSelect: (id: number) => void;
  onConserve: (c: Conservation) => void;
  onSel: (s: SelInfo | null) => void;
}) {
  const scen = useMemo(() => getScenario(props.scenarioName), [props.scenarioName]);

  const { majors, bh } = useMemo(() => {
    engine.load(scen.build(), { G: scen.G, soft: scen.soft, dt: scen.dt });
    return {
      majors: engine.bodies.filter((b) => b.major && b.kind !== 'blackhole'),
      bh: engine.bodies.find((b) => b.kind === 'blackhole') ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.scenarioName, props.resetKey]);

  const velScale = scen.cameraDistance / 400;
  const maxArrow = scen.cameraDistance * 0.18;

  return (
    <>
      <Stepper
        key={`step-${props.scenarioName}-${props.resetKey}`}
        paused={props.paused} speed={props.speed} dt={scen.dt}
        followId={props.followId} selectedId={props.selectedId}
        onConserve={props.onConserve} onSel={props.onSel}
      />
      {scen.blackHole && bh && <BlackHole body={bh} size={scen.bhRadius} />}
      {majors.map((b) => (
        <MajorBody
          key={b.id} body={b}
          showTrail={props.showTrails} showVector={props.showVectors}
          selected={props.selectedId === b.id} onSelect={props.onSelect}
          velScale={velScale} maxArrow={maxArrow}
        />
      ))}
      <MinorPoints key={`pts-${props.scenarioName}-${props.resetKey}`} colorBySpeed={props.colorBySpeed} />
      {props.showBary && <Barycenter />}
    </>
  );
}
