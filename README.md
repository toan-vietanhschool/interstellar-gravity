# Hố Đen Interstellar ✦ Mô phỏng hấp dẫn N-vật thể

Mô phỏng hấp dẫn **N-vật thể 3D** trên web với **hố đen thấu kính hấp dẫn** kiểu *Interstellar* (Gargantua) — chạy hoàn toàn trong trình duyệt bằng **Three.js / WebGL**, không backend.

> Bản web này thay cho `gravity_simulator` (Python/tkinter) — vốn được giữ làm bản tham chiếu desktop.

## Tính năng (v1)
- **Vật lý**: tích phân **Velocity Verlet** (symplectic, không trôi năng lượng) + **Barnes-Hut octree** O(n log n) + sáp nhập va chạm + softening.
- **Hố đen thấu kính hấp dẫn**: shader ray-march bẻ cong tia (Schwarzschild gần đúng) → đĩa bồi tụ + vành Einstein + nền sao bị thấu kính (kịch bản *Interstellar*).
- **Đại lượng bảo toàn** realtime: động năng KE, thế năng PE, **tổng E**, động lượng |p|, mô-men |L|, khối tâm.
- **Tương tác**: bấm chọn & soi vật thể; pan/zoom/xoay; **camera bám** vật đã chọn.
- **Trực quan**: vệt quỹ đạo, **vector vận tốc & lực**, màu sao theo tốc độ, đánh dấu khối tâm.
- **5 kịch bản**: Interstellar (Gargantua), Hệ Mặt Trời, Sao đôi, **Quỹ đạo số 8**, Thiên hà.
- **Việt hoá toàn bộ** giao diện.

## Chạy
```bash
cd D:\demo\interstellar-gravity
npm install
npm run dev      # mở địa chỉ Vite in ra
npm run build    # build production (dist/)
```

## Kiến trúc
```
src/
├─ physics/        # engine thuần TS
│  ├─ vec.ts · types.ts
│  ├─ octree.ts    # Barnes-Hut 3D
│  ├─ engine.ts    # Velocity Verlet + bảo toàn + sáp nhập
│  └─ scenarios.ts # 5 kịch bản
├─ scene/
│  ├─ Scene.tsx    # chạy engine + vẽ vật thể/vệt/vector/điểm/khối tâm
│  └─ BlackHole.tsx# shader thấu kính hấp dẫn (GLSL ray-march)
├─ sim.ts          # engine singleton
└─ App.tsx         # Canvas + UI tiếng Việt
```

## Tinh chỉnh nhanh
| Vị trí | Ý nghĩa |
|---|---|
| `scenarios.ts` | thêm/sửa kịch bản, khối lượng, quỹ đạo |
| `octree.ts → THETA` | đánh đổi tốc độ/độ chính xác Barnes-Hut |
| `BlackHole.tsx → GM` | độ mạnh bẻ cong ánh sáng |

## Sẽ bổ sung (fast-follow)
Tua thời gian (rewind), đồ thị bảo toàn theo t, giếng thế hấp dẫn, quỹ đạo dự đoán (ellipse Kepler), đơn vị thật (AU/Msun), va chạm đàn hồi, tối ưu mobile.
