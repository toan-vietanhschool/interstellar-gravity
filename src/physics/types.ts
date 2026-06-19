import type { V3 } from './vec';

export type BodyKind = 'star' | 'planet' | 'blackhole';

export interface Body {
  id: number;
  name?: string;
  kind: BodyKind;
  pos: V3;
  vel: V3;
  acc: V3;
  mass: number;
  radius: number;       // bán kính hiển thị (đơn vị mô phỏng)
  color: [number, number, number]; // rgb 0..1
  major: boolean;       // vẽ cầu + vệt + vector (vật thể lớn/đáng chú ý)
  trail: number[];      // lịch sử vị trí phẳng [x,y,z, x,y,z, ...]
  alive: boolean;
}

export interface Conservation {
  ke: number;
  pe: number | null;     // null nếu N quá lớn (bỏ tính O(n²))
  energy: number | null;
  pmag: number;          // độ lớn động lượng
  lmag: number;          // độ lớn mô-men động lượng
  bary: V3;
  count: number;
}
