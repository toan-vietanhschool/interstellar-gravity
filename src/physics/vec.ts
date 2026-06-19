/* Vec3 tối giản dạng {x,y,z} cho engine vật lý. */
export interface V3 { x: number; y: number; z: number; }

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const clone = (a: V3): V3 => ({ x: a.x, y: a.y, z: a.z });
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const len2 = (a: V3): number => a.x * a.x + a.y * a.y + a.z * a.z;
export const dist = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const normalize = (a: V3): V3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
/** Một vector vuông góc với a (bất kỳ). */
export const perp = (a: V3): V3 => {
  const ref: V3 = Math.abs(a.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  return normalize(cross(a, ref));
};
