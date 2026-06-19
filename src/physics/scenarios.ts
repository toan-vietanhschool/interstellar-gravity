/* ============================================================
   scenarios.ts — Các kịch bản dựng sẵn (đơn vị mô phỏng)
   ============================================================ */
import type { Body, BodyKind } from './types';
import { type V3, v3 } from './vec';
import type { BodySpec } from './engine';

export interface Scenario {
  name: string;
  label: string;     // tiếng Việt
  desc: string;
  G: number;
  soft: number;
  dt: number;
  speed: number;        // số bước/khung gợi ý
  cameraDistance: number;
  blackHole: boolean;   // bật shader thấu kính hấp dẫn
  bhRadius: number;     // bán kính "kích thước" hố đen cho shader (đơn vị mô phỏng)
  build: () => BodySpec[];
}

type Rgb = [number, number, number];

function mk(o: {
  pos: V3; vel?: V3; mass: number; radius: number; color: Rgb;
  kind?: BodyKind; name?: string; major?: boolean;
}): BodySpec {
  return {
    name: o.name,
    kind: o.kind ?? 'planet',
    pos: o.pos,
    vel: o.vel ?? v3(),
    mass: o.mass,
    radius: o.radius,
    color: o.color,
    major: o.major ?? false,
  };
}

/** Vật thể trên quỹ đạo tròn quanh tâm khối lượng M (tâm đứng yên ở gốc). */
function orbit(M: number, G: number, r: number, o: {
  mass: number; radius: number; color: Rgb; name?: string; major?: boolean;
  inc?: number; phase?: number; retro?: boolean;
}): BodySpec {
  const a = o.phase ?? Math.random() * Math.PI * 2;
  const inc = o.inc ?? 0;
  let px = r * Math.cos(a), py = 0, pz = r * Math.sin(a);
  const vmag = Math.sqrt((G * M) / r) * (o.retro ? -1 : 1);
  let vx = -Math.sin(a) * vmag, vy = 0, vz = Math.cos(a) * vmag;
  // nghiêng quỹ đạo quanh trục x
  const ci = Math.cos(inc), si = Math.sin(inc);
  [py, pz] = [py * ci - pz * si, py * si + pz * ci];
  [vy, vz] = [vy * ci - vz * si, vy * si + vz * ci];
  return mk({ pos: v3(px, py, pz), vel: v3(vx, vy, vz), mass: o.mass, radius: o.radius, color: o.color, name: o.name, major: o.major });
}

const PLANET_COLORS: Rgb[] = [
  [0.66, 0.74, 1.0], [0.91, 0.77, 0.49], [0.29, 0.56, 0.89], [0.82, 0.30, 0.24],
  [0.91, 0.66, 0.49], [0.96, 0.87, 0.70], [0.53, 0.79, 0.91], [0.78, 0.72, 0.92],
];

export const SCENARIOS: Scenario[] = [
  {
    name: 'interstellar',
    label: 'Interstellar (Gargantua)',
    desc: 'Hố đen siêu khối lượng với thấu kính hấp dẫn + đĩa bồi tụ. Hành tinh của Miller quay quanh.',
    G: 1, soft: 2.0, dt: 0.01, speed: 1, cameraDistance: 100, blackHole: true, bhRadius: 11,
    build: () => {
      const M = 1_000_000;
      const out: BodySpec[] = [
        mk({ pos: v3(0, 0, 0), mass: M, radius: 7, color: [0, 0, 0], kind: 'blackhole', name: 'Gargantua', major: true }),
      ];
      out.push(orbit(M, 1, 120, { mass: 2, radius: 2.4, color: [0.45, 0.6, 0.95], name: "Hành tinh Miller", major: true, inc: 0.04, phase: 0.3 }));
      out.push(orbit(M, 1, 175, { mass: 1.5, radius: 2.0, color: [0.8, 0.55, 0.4], name: "Hành tinh Mann", major: true, inc: -0.12, phase: 2.1 }));
      // vành mảnh vụn
      for (let i = 0; i < 60; i++) {
        const r = 95 + Math.random() * 130;
        out.push(orbit(M, 1, r, { mass: 0.001, radius: 0.6, color: [0.95, 0.7, 0.4], inc: (Math.random() - 0.5) * 0.1 }));
      }
      return out;
    },
  },
  {
    name: 'solar',
    label: 'Hệ Mặt Trời',
    desc: 'Mặt Trời và các hành tinh trên quỹ đạo gần tròn.',
    G: 1, soft: 0.6, dt: 0.02, speed: 1, cameraDistance: 380, blackHole: false, bhRadius: 0,
    build: () => {
      const M = 6000;
      const out: BodySpec[] = [mk({ pos: v3(0, 0, 0), mass: M, radius: 12, color: [1, 0.85, 0.3], kind: 'star', name: 'Mặt Trời', major: true })];
      const data: [number, number, number][] = [[34, 1, 0], [55, 2, 1], [78, 2.5, 2], [104, 1.8, 3], [150, 6, 4], [195, 5, 5], [240, 4, 6], [285, 4, 7]];
      const names = ['Thuỷ', 'Kim', 'Trái Đất', 'Hoả', 'Mộc', 'Thổ', 'Thiên', 'Hải'];
      data.forEach(([r, mass, ci], i) =>
        out.push(orbit(M, 1, r, { mass, radius: 1.2 + mass * 0.5, color: PLANET_COLORS[ci], name: names[i], major: true, inc: (Math.random() - 0.5) * 0.05 })),
      );
      return out;
    },
  },
  {
    name: 'binary',
    label: 'Sao đôi',
    desc: 'Hai sao quay quanh khối tâm chung + hành tinh vòng ngoài.',
    G: 1, soft: 0.8, dt: 0.02, speed: 1, cameraDistance: 360, blackHole: false, bhRadius: 0,
    build: () => {
      const m = 2500, sep = 80;
      const vrel = Math.sqrt((1 * 2 * m) / sep) / 2;
      const out: BodySpec[] = [
        mk({ pos: v3(-sep / 2, 0, 0), vel: v3(0, 0, vrel), mass: m, radius: 9, color: [1, 0.8, 0.4], kind: 'star', name: 'Sao A', major: true }),
        mk({ pos: v3(sep / 2, 0, 0), vel: v3(0, 0, -vrel), mass: m, radius: 9, color: [1, 0.5, 0.4], kind: 'star', name: 'Sao B', major: true }),
      ];
      for (let i = 0; i < 5; i++) {
        const r = 180 + i * 30;
        out.push(orbit(2 * m, 1, r, { mass: 1, radius: 1.6, color: PLANET_COLORS[i % PLANET_COLORS.length], name: `Hành tinh ${i + 1}`, major: true, inc: (Math.random() - 0.5) * 0.08 }));
      }
      return out;
    },
  },
  {
    name: 'figure8',
    label: 'Quỹ đạo số 8',
    desc: 'Vũ điệu 3 vật thể nổi tiếng (Chenciner–Montgomery): 3 vật bằng khối lượng đuổi nhau theo hình số 8.',
    G: 1, soft: 0.0, dt: 0.003, speed: 1, cameraDistance: 3.4, blackHole: false, bhRadius: 0,
    build: () => {
      const c: Rgb[] = [[1, 0.5, 0.4], [0.45, 0.85, 0.5], [0.5, 0.7, 1]];
      return [
        mk({ pos: v3(-0.97000436, 0.24308753, 0), vel: v3(0.466203685, 0.43236573, 0), mass: 1, radius: 0.05, color: c[0], kind: 'star', major: true }),
        mk({ pos: v3(0.97000436, -0.24308753, 0), vel: v3(0.466203685, 0.43236573, 0), mass: 1, radius: 0.05, color: c[1], kind: 'star', major: true }),
        mk({ pos: v3(0, 0, 0), vel: v3(-0.93240737, -0.86473146, 0), mass: 1, radius: 0.05, color: c[2], kind: 'star', major: true }),
      ];
    },
  },
  {
    name: 'galaxy',
    label: 'Thiên hà',
    desc: 'Hố đen trung tâm + ~240 ngôi sao tạo thành đĩa xoáy.',
    G: 1, soft: 1.2, dt: 0.012, speed: 1, cameraDistance: 720, blackHole: false, bhRadius: 0,
    build: () => {
      const M = 200_000;
      const out: BodySpec[] = [mk({ pos: v3(0, 0, 0), mass: M, radius: 16, color: [1, 0.95, 0.8], kind: 'star', name: 'Nhân thiên hà', major: true })];
      for (let i = 0; i < 240; i++) {
        const r = 50 + Math.pow(Math.random(), 0.6) * 360;
        const star = orbit(M, 1, r, {
          mass: 1, radius: 1.2,
          color: [0.7 + Math.random() * 0.3, 0.75 + Math.random() * 0.2, 1.0],
          inc: (Math.random() - 0.5) * 0.25,
        });
        star.pos.y += (Math.random() - 0.5) * 18;
        out.push(star);
      }
      return out;
    },
  },
];

export const getScenario = (name: string): Scenario =>
  SCENARIOS.find((s) => s.name === name) ?? SCENARIOS[0];
