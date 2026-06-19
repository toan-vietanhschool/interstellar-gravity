/* ============================================================
   engine.ts — Engine N-vật thể: Velocity Verlet (symplectic) +
   Barnes-Hut + sáp nhập va chạm + đại lượng bảo toàn.
   ============================================================ */
import type { Body, Conservation } from './types';
import { type V3, v3, cross } from './vec';
import { Octree } from './octree';

const MAX_TRAIL = 1800;   // 600 điểm × 3
const MERGE_LIMIT = 200;  // N lớn hơn thì bỏ kiểm tra va chạm O(n²)
const PE_LIMIT = 500;     // N lớn hơn thì bỏ tính thế năng O(n²)

export type BodySpec = Omit<Body, 'id' | 'acc' | 'trail' | 'alive'>;

export class Engine {
  bodies: Body[] = [];
  G = 1;
  soft = 0.4;
  dt = 0.01;
  time = 0;
  private nextId = 0;
  private scratch: V3 = { x: 0, y: 0, z: 0 };

  load(specs: BodySpec[], opts: { G: number; soft: number; dt: number }): void {
    this.G = opts.G; this.soft = opts.soft; this.dt = opts.dt;
    this.time = 0; this.nextId = 0;
    this.bodies = specs.map((s) => ({
      ...s,
      pos: { ...s.pos }, vel: { ...s.vel },
      id: this.nextId++, acc: v3(), trail: [], alive: true,
    }));
    this.computeAccel();
  }

  private computeAccel(): void {
    const tree = new Octree(this.bodies);
    const soft2 = this.soft * this.soft;
    for (const b of this.bodies) {
      if (!b.alive) continue;
      tree.accel(b, this.G, soft2, this.scratch);
      b.acc.x = this.scratch.x; b.acc.y = this.scratch.y; b.acc.z = this.scratch.z;
    }
  }

  step(h: number): void {
    const bodies = this.bodies;
    for (const b of bodies) {
      if (!b.alive) continue;
      b.pos.x += b.vel.x * h + 0.5 * b.acc.x * h * h;
      b.pos.y += b.vel.y * h + 0.5 * b.acc.y * h * h;
      b.pos.z += b.vel.z * h + 0.5 * b.acc.z * h * h;
    }
    const tree = new Octree(bodies);
    const soft2 = this.soft * this.soft;
    for (const b of bodies) {
      if (!b.alive) continue;
      const ax = b.acc.x, ay = b.acc.y, az = b.acc.z;
      tree.accel(b, this.G, soft2, this.scratch);
      b.vel.x += 0.5 * (ax + this.scratch.x) * h;
      b.vel.y += 0.5 * (ay + this.scratch.y) * h;
      b.vel.z += 0.5 * (az + this.scratch.z) * h;
      b.acc.x = this.scratch.x; b.acc.y = this.scratch.y; b.acc.z = this.scratch.z;
    }
    this.handleMerges();
    this.time += h;
  }

  /** Gọi 1 lần mỗi khung hình để cập nhật vệt cho vật thể lớn. */
  pushTrails(): void {
    for (const b of this.bodies) {
      if (!b.alive || !b.major) continue;
      b.trail.push(b.pos.x, b.pos.y, b.pos.z);
      if (b.trail.length > MAX_TRAIL) b.trail.splice(0, b.trail.length - MAX_TRAIL);
    }
  }

  private handleMerges(): void {
    const bodies = this.bodies;
    if (bodies.length > MERGE_LIMIT) return;
    let merged = false;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (!b.alive) continue;
        const d = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y, b.pos.z - a.pos.z);
        if (d < a.radius + b.radius) {
          const big = a.mass >= b.mass ? a : b;
          const small = big === a ? b : a;
          const m = big.mass + small.mass;
          big.vel.x = (big.mass * big.vel.x + small.mass * small.vel.x) / m;
          big.vel.y = (big.mass * big.vel.y + small.mass * small.vel.y) / m;
          big.vel.z = (big.mass * big.vel.z + small.mass * small.vel.z) / m;
          big.mass = m;
          if (big.kind !== 'blackhole') {
            big.radius = Math.cbrt(big.radius ** 3 + small.radius ** 3);
          }
          small.alive = false;
          merged = true;
        }
      }
    }
    if (merged) this.bodies = bodies.filter((b) => b.alive);
  }

  conservation(): Conservation {
    const bodies = this.bodies.filter((b) => b.alive);
    let ke = 0, px = 0, py = 0, pz = 0, lx = 0, ly = 0, lz = 0, M = 0, bx = 0, by = 0, bz = 0;
    for (const b of bodies) {
      const v2 = b.vel.x ** 2 + b.vel.y ** 2 + b.vel.z ** 2;
      ke += 0.5 * b.mass * v2;
      px += b.mass * b.vel.x; py += b.mass * b.vel.y; pz += b.mass * b.vel.z;
      const c = cross(b.pos, b.vel);
      lx += b.mass * c.x; ly += b.mass * c.y; lz += b.mass * c.z;
      M += b.mass; bx += b.mass * b.pos.x; by += b.mass * b.pos.y; bz += b.mass * b.pos.z;
    }
    let pe: number | null = null;
    if (bodies.length <= PE_LIMIT) {
      pe = 0;
      const soft2 = this.soft * this.soft;
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i], b = bodies[j];
          const d = Math.sqrt(
            (a.pos.x - b.pos.x) ** 2 + (a.pos.y - b.pos.y) ** 2 + (a.pos.z - b.pos.z) ** 2 + soft2,
          );
          pe -= (this.G * a.mass * b.mass) / d;
        }
      }
    }
    return {
      ke,
      pe,
      energy: pe === null ? null : ke + pe,
      pmag: Math.hypot(px, py, pz),
      lmag: Math.hypot(lx, ly, lz),
      bary: { x: M ? bx / M : 0, y: M ? by / M : 0, z: M ? bz / M : 0 },
      count: bodies.length,
    };
  }
}
