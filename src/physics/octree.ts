/* ============================================================
   octree.ts — Cây bát phân Barnes-Hut (3D) → tính lực O(n log n)
   ============================================================ */
import type { Body } from './types';
import type { V3 } from './vec';

const THETA = 0.6; // ngưỡng s/d: nhỏ hơn = chính xác hơn, lớn hơn = nhanh hơn

class Node {
  cx: number; cy: number; cz: number; half: number;
  mass = 0; comx = 0; comy = 0; comz = 0;
  body: Body | null = null;
  children: (Node | null)[] | null = null;

  constructor(cx: number, cy: number, cz: number, half: number) {
    this.cx = cx; this.cy = cy; this.cz = cz; this.half = half;
  }

  insert(b: Body): void {
    // cập nhật khối lượng + tâm khối của nút (gồm mọi vật trong cây con)
    const m = this.mass + b.mass;
    this.comx = (this.comx * this.mass + b.pos.x * b.mass) / m;
    this.comy = (this.comy * this.mass + b.pos.y * b.mass) / m;
    this.comz = (this.comz * this.mass + b.pos.z * b.mass) / m;
    this.mass = m;

    if (this.children === null && this.body === null) {
      this.body = b;
      return;
    }
    if (this.children === null) {
      const old = this.body!;
      this.body = null;
      this.children = [null, null, null, null, null, null, null, null];
      this.place(old);
    }
    this.place(b);
  }

  private place(b: Body): void {
    const ix = b.pos.x > this.cx ? 1 : 0;
    const iy = b.pos.y > this.cy ? 1 : 0;
    const iz = b.pos.z > this.cz ? 1 : 0;
    const idx = ix + iy * 2 + iz * 4;
    let c = this.children![idx];
    if (!c) {
      const h = this.half / 2;
      c = new Node(this.cx + (ix ? h : -h), this.cy + (iy ? h : -h), this.cz + (iz ? h : -h), h);
      this.children![idx] = c;
    }
    c.insert(b);
  }
}

export class Octree {
  private root: Node;

  constructor(bodies: Body[]) {
    let min = Infinity, max = -Infinity;
    for (const b of bodies) {
      min = Math.min(min, b.pos.x, b.pos.y, b.pos.z);
      max = Math.max(max, b.pos.x, b.pos.y, b.pos.z);
    }
    if (!isFinite(min)) { min = -1; max = 1; }
    const cx = (min + max) / 2;
    const half = Math.max((max - min) / 2, 1) * 1.5 + 1;
    this.root = new Node(cx, cx, cx, half);
    for (const b of bodies) if (b.alive) this.root.insert(b);
  }

  /** Gia tốc hấp dẫn lên b, cộng dồn vào out. */
  accel(b: Body, G: number, soft2: number, out: V3): void {
    out.x = 0; out.y = 0; out.z = 0;
    this.walk(this.root, b, G, soft2, out);
  }

  private walk(node: Node | null, b: Body, G: number, soft2: number, out: V3): void {
    if (!node || node.mass === 0 || node.body === b) return;
    const dx = node.comx - b.pos.x;
    const dy = node.comy - b.pos.y;
    const dz = node.comz - b.pos.z;
    const d2 = dx * dx + dy * dy + dz * dz + soft2;
    const d = Math.sqrt(d2);
    const s = node.half * 2;
    if (node.children === null || s / d < THETA) {
      const f = (G * node.mass) / (d2 * d);
      out.x += f * dx; out.y += f * dy; out.z += f * dz;
    } else {
      for (const c of node.children) this.walk(c, b, G, soft2, out);
    }
  }
}
