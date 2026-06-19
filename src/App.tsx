import { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import { Scene, type SelInfo } from './scene/Scene';
import { SCENARIOS, getScenario } from './physics/scenarios';
import type { Conservation } from './physics/types';

const fmt = (n: number | null | undefined, d = 2): string => {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e5 || a < 1e-2)) return n.toExponential(d);
  return n.toFixed(d);
};

const kindVi = (k: string) => (k === 'blackhole' ? 'Hố đen' : k === 'star' ? 'Sao' : 'Hành tinh');

export function App() {
  const [scenarioName, setScenarioName] = useState('interstellar');
  const [resetKey, setResetKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTrails, setShowTrails] = useState(true);
  const [showVectors, setShowVectors] = useState(false);
  const [showBary, setShowBary] = useState(false);
  const [colorBySpeed, setColorBySpeed] = useState(true);
  const [follow, setFollow] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cons, setCons] = useState<Conservation | null>(null);
  const [sel, setSel] = useState<SelInfo | null>(null);

  const scen = getScenario(scenarioName);
  const followId = follow ? selectedId : null;
  const near = Math.max(0.01, scen.cameraDistance * 0.01);
  const far = Math.max(4000, scen.cameraDistance * 30);
  // Hố đen: khung gần-edge-on để thấy vầng halo trên/dưới; còn lại nhìn chếch.
  const camPos: [number, number, number] = scen.blackHole
    ? [0, scen.cameraDistance * 0.2, scen.cameraDistance * 0.97]
    : [scen.cameraDistance * 0.7, scen.cameraDistance * 0.5, scen.cameraDistance * 0.7];

  const onConserve = useCallback((c: Conservation) => setCons(c), []);
  const onSel = useCallback((s: SelInfo | null) => setSel(s), []);
  const onSelect = useCallback((id: number) => setSelectedId(id), []);

  const changeScenario = (name: string) => { setScenarioName(name); setSelectedId(null); setSel(null); };
  const reset = () => { setResetKey((k) => k + 1); setSelectedId(null); setSel(null); };

  return (
    <div className="app">
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera
          key={scenarioName}
          makeDefault
          position={camPos}
          fov={55} near={near} far={far}
        />
        <OrbitControls
          key={'c-' + scenarioName}
          makeDefault enablePan
          minDistance={scen.cameraDistance * 0.04}
          maxDistance={scen.cameraDistance * 4}
        />
        <color attach="background" args={['#03040a']} />
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 0, 0]} intensity={2.2} distance={0} decay={0} color="#fff2dd" />
        <Stars radius={scen.cameraDistance * 3} depth={scen.cameraDistance} count={2500} factor={4} fade speed={0.4} />

        <Scene
          scenarioName={scenarioName} resetKey={resetKey}
          paused={paused} speed={speed}
          showTrails={showTrails} showVectors={showVectors} showBary={showBary} colorBySpeed={colorBySpeed}
          followId={followId} selectedId={selectedId}
          onSelect={onSelect} onConserve={onConserve} onSel={onSel}
        />
      </Canvas>

      <div className="overlay">
        <div className="title">
          <h1>Hố Đen <span>Interstellar</span></h1>
          <p>Mô phỏng hấp dẫn N-vật thể 3D · thấu kính hấp dẫn</p>
        </div>

        <div className="panel glass">
          <div>
            <h2>Kịch bản</h2>
            <div className="scenario-grid">
              {SCENARIOS.map((s) => (
                <button key={s.name} className={'btn' + (s.name === scenarioName ? ' active' : '')} onClick={() => changeScenario(s.name)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2>Điều khiển</h2>
            <div className="row">
              <button className="btn primary" onClick={() => setPaused((p) => !p)}>{paused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}</button>
              <button className="btn" onClick={reset}>↻ Đặt lại</button>
            </div>
            <div className="slider" style={{ marginTop: 10 }}>
              <div className="lab"><span>Tốc độ mô phỏng</span><span>{speed.toFixed(2)}×</span></div>
              <input type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} />
            </div>
          </div>

          <div>
            <h2>Hiển thị</h2>
            <label className="toggle"><input type="checkbox" checked={showTrails} onChange={(e) => setShowTrails(e.target.checked)} /> Vệt quỹ đạo</label>
            <label className="toggle"><input type="checkbox" checked={showVectors} onChange={(e) => setShowVectors(e.target.checked)} /> Vector vận tốc (xanh) &amp; lực (cam)</label>
            <label className="toggle"><input type="checkbox" checked={colorBySpeed} onChange={(e) => setColorBySpeed(e.target.checked)} /> Màu sao theo tốc độ</label>
            <label className="toggle"><input type="checkbox" checked={showBary} onChange={(e) => setShowBary(e.target.checked)} /> Khối tâm hệ</label>
            <label className="toggle"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Camera bám vật đã chọn</label>
          </div>
        </div>

        <div className="conserve glass">
          <div className="badge">ĐẠI LƯỢNG BẢO TOÀN</div>
          <div className="stat"><span className="k">Động năng (KE)</span><span className="v">{fmt(cons?.ke)}</span></div>
          <div className="stat"><span className="k">Thế năng (PE)</span><span className="v">{fmt(cons?.pe)}</span></div>
          <div className="stat"><span className="k">Tổng năng lượng E</span><span className="v warn">{fmt(cons?.energy)}</span></div>
          <div className="stat"><span className="k">Động lượng |p|</span><span className="v">{fmt(cons?.pmag)}</span></div>
          <div className="stat"><span className="k">Mô-men động lượng |L|</span><span className="v">{fmt(cons?.lmag)}</span></div>
          <div className="stat"><span className="k">Số vật thể</span><span className="v">{cons?.count ?? '—'}</span></div>
        </div>

        {sel && (
          <div className="inspector glass">
            <div className="badge">VẬT THỂ ĐÃ CHỌN</div>
            <h3>{sel.name ?? 'Vật thể'}</h3>
            <div className="stat"><span className="k">Loại</span><span className="v">{kindVi(sel.kind)}</span></div>
            <div className="stat"><span className="k">Khối lượng</span><span className="v">{fmt(sel.mass)}</span></div>
            <div className="stat"><span className="k">Tốc độ</span><span className="v">{fmt(sel.speed)}</span></div>
            <div className="stat"><span className="k">K/c tới tâm</span><span className="v">{fmt(sel.dist)}</span></div>
          </div>
        )}

        <div className="legend glass">
          <p><b>{scen.label}.</b> {scen.desc}</p>
          <p style={{ marginTop: 6 }}>🖱️ Kéo để xoay · lăn để phóng to · chuột phải để dời. Bấm vào sao/hành tinh để soi.</p>
        </div>
      </div>
    </div>
  );
}
