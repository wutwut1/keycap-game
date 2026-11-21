// =============================================================
//  game.js : ตัวเกม "ประกอบคีย์แคป"
//  Three.js = วาดภาพ 3D, แสง, เงา
//  cannon-es = ฟิสิกส์ (แรงโน้มถ่วง การชน การกองทับกัน)
//
//  สารบัญ
//   1. ตั้งค่า (แก้ตัวเลข/สีตรงนี้ได้เลย)
//   2. ฉาก กล้อง แสง
//   3. ฟิสิกส์
//   4. คีย์บอร์ดและช่องใส่ปุ่ม
//   5. คีย์แคป
//   6. การลากด้วยเมาส์ / นิ้ว
//   7. เอฟเฟกต์ (tween, ประกาย, จอสั่น)
//   8. สถานะเกม (เริ่ม ชนะ แพ้ เวลา)
//   9. ลูปหลัก และเริ่มต้นโปรแกรม
// =============================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'cannon-es';
import { ROWS } from './keys.js';
import * as Sound from './sound.js';

// =============================================================
// 1. ตั้งค่า
// =============================================================
const CONFIG = {
  timeLimit: 10 * 60,   // เวลาเล่น (วินาที)
  keyHeight: 0.45,      // ความสูงคีย์แคป (1 = ความกว้างปุ่มปกติ)
  keyGap: 0.08,         // ช่องว่างระหว่างปุ่ม
  holdHeight: 2.6,      // ยกคีย์แคปสูงเท่าไรตอนลาก
  snapTolerance: 0.35,  // ระยะเผื่อตอนวาง (มาก = วางง่าย)
  touchLift: 60,        // บนมือถือ ให้คีย์แคปลอยเหนือนิ้วกี่พิกเซล (นิ้วจะได้ไม่บัง)
  gravity: -24,         // แรงโน้มถ่วง (ติดลบ = ตกลง)
  shakeCooldown: 3,     // ปุ่มเขย่ากดซ้ำได้ทุกกี่วินาที
};

const COLORS = {
  rows: ['#FFD3E0', '#FFF0C2', '#CFF3E1', '#D6E6FF', '#E6DCFF'], // สีคีย์แคปแต่ละแถว
  mod: '#C8B6F2',        // ปุ่มพิเศษ (Shift, Tab, ...)
  accent: '#FFAFC5',     // Enter, Backspace
  space: '#B5E6D2',      // Spacebar
  legend: '#5B4B8A',     // ตัวอักษรบนปุ่ม
  legendSoft: '#9A8BC4', // ตัวอักษรเล็ก
  case: '#FFC9DE',       // ตัวเคสคีย์บอร์ด
  plate: '#FFF1F7',      // แผ่นเพลทด้านใน
  slot: '#F6DCEA',       // ช่องว่างที่ยังไม่มีปุ่ม
  slotGood: '#9EEBC6',   // ช่องเรืองสีเขียวเมื่อจะวางถูก
  slotBad: '#FF8FA8',    // ช่องกะพริบแดงเมื่อวางผิด
  stem: '#FF8FB1',       // แกนสวิตช์ (กากบาท)
  mat: '#FFFFFF',        // แผ่นรองโต๊ะ
  sparkle: ['#FF9EC4', '#FFD86E', '#8EE3C0', '#9CC7FF', '#C7A6FF'],
};

// ตำแหน่งในฉาก (หน่วยเดียวกับขนาดปุ่ม)
const KB_Z = -3.4;                                         // กึ่งกลางคีย์บอร์ด (แนวลึก)
const CASE_H = 0.7;                                        // ความสูงเคส
const PLATE_Y = CASE_H + 0.06;                             // ผิวบนของเพลท
const PLACED_Y = PLATE_Y + 0.12 + CONFIG.keyHeight / 2;    // ความสูงคีย์แคปเมื่อประกอบแล้ว
const PILE = { minX: -7.4, maxX: 7.4, minZ: 0.9, maxZ: 7.2 };   // พื้นที่กองคีย์แคป
const TABLE = { minX: -8.6, maxX: 8.6, minZ: -6.8, maxZ: 8.2 }; // ขอบโต๊ะ (มีผนังล่องหนกั้น)

const FONT = "'Kanit', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif";

// ฟังก์ชันช่วยเล็กๆ
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const $ = (sel) => document.querySelector(sel);

// =============================================================
// 2. ฉาก กล้อง แสง
// =============================================================
const container = $('#game');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
const cameraBase = new THREE.Vector3();               // ตำแหน่งกล้องปกติ (ก่อนสั่น)
const cameraTarget = new THREE.Vector3(0, 0, 0.7);    // กล้องมองไปที่จุดนี้

// แสงรอบทิศ (ฟ้าขาว พื้นชมพู) ทำให้เงาไม่ดำเกินไป
scene.add(new THREE.HemisphereLight('#ffffff', '#ffd1e6', 1.6));

// แสงแดด สร้างเงา
const sun = new THREE.DirectionalLight('#fff6ec', 2.4);
sun.position.set(5, 16, 9);
sun.target.position.copy(cameraTarget);
sun.castShadow = true;
const smallScreen = Math.min(innerWidth, innerHeight) < 600;
sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// แผ่นรองโต๊ะสีขาวมุมมน
const tableW = TABLE.maxX - TABLE.minX + 0.6;
const tableD = TABLE.maxZ - TABLE.minZ + 0.6;
const tableZ = (TABLE.minZ + TABLE.maxZ) / 2;
const mat = new THREE.Mesh(
  new RoundedBoxGeometry(tableW, 0.2, tableD, 4, 0.1),
  new THREE.MeshStandardMaterial({ color: COLORS.mat, roughness: 0.9 })
);
mat.position.set(0, -0.1, tableZ);
mat.receiveShadow = true;
mat.castShadow = true;
scene.add(mat);

// พื้นล่องหนที่รับแค่เงา (เงาของแผ่นรองตกลงบนพื้นหลังสีพาสเทล)
const shadowFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.ShadowMaterial({ opacity: 0.12 })
);
shadowFloor.rotation.x = -Math.PI / 2;
shadowFloor.position.y = -0.3;
shadowFloor.receiveShadow = true;
scene.add(shadowFloor);

// =============================================================
// 3. ฟิสิกส์
// =============================================================
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, CONFIG.gravity, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;          // วัตถุที่นิ่งแล้วจะ "หลับ" ช่วยให้เครื่องไม่หนัก
world.solver.iterations = 12;

const capMaterial = new CANNON.Material('cap');
const tableMaterial = new CANNON.Material('table');
world.addContactMaterial(new CANNON.ContactMaterial(capMaterial, capMaterial, { friction: 0.25, restitution: 0.15 }));
world.addContactMaterial(new CANNON.ContactMaterial(capMaterial, tableMaterial, { friction: 0.35, restitution: 0.2 }));

function addStaticBox(hx, hy, hz, x, y, z) {
  const body = new CANNON.Body({ mass: 0, material: tableMaterial, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
  body.position.set(x, y, z);
  world.addBody(body);
}

// พื้นโต๊ะ
const floorBody = new CANNON.Body({ mass: 0, material: tableMaterial, shape: new CANNON.Plane() });
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(floorBody);

// ผนังล่องหน 4 ด้าน กันคีย์แคปหล่นจากโต๊ะ
addStaticBox(0.3, 6, 10, TABLE.minX - 0.3, 6, tableZ);
addStaticBox(0.3, 6, 10, TABLE.maxX + 0.3, 6, tableZ);
addStaticBox(10, 6, 0.3, 0, 6, TABLE.minZ - 0.3);
addStaticBox(10, 6, 0.3, 0, 6, TABLE.maxZ + 0.3);

// ตัวคีย์บอร์ด (คีย์แคปที่ตกลงมาจะวางบนคีย์บอร์ดได้)
addStaticBox(7.85, CASE_H / 2, 2.85, 0, CASE_H / 2, KB_Z);

// =============================================================
// 4. คีย์บอร์ดและช่องใส่ปุ่ม
// =============================================================

// คำนวณตำแหน่งปุ่มทุกปุ่มจาก keys.js
const keyDefs = [];
ROWS.forEach((row, rowIndex) => {
  let x = -7.5;                       // เริ่มจากซ้ายสุด (คีย์บอร์ดกว้าง 15u)
  const z = KB_Z - 2 + rowIndex;
  for (const k of row) {
    const w = k.w || 1;
    keyDefs.push({
      ...k,
      w,
      row: rowIndex,
      x: x + w / 2,
      z,
      // ปุ่มตัวอักษรต้องตรงช่องเป๊ะ ส่วนปุ่มพิเศษที่หน้าตาเหมือนกัน (Ctrl, Alt, Win) สลับกันได้
      match: k.th ? k.en : `${k.en}|${w}`,
    });
    x += w;
  }
});
const TOTAL_KEYS = keyDefs.length;

function buildKeyboardBody() {
  const caseMesh = new THREE.Mesh(
    new RoundedBoxGeometry(15.7, CASE_H, 5.7, 4, 0.25),
    new THREE.MeshStandardMaterial({ color: COLORS.case, roughness: 0.55 })
  );
  caseMesh.position.set(0, CASE_H / 2, KB_Z);
  caseMesh.castShadow = caseMesh.receiveShadow = true;

  const plate = new THREE.Mesh(
    new RoundedBoxGeometry(15.25, 0.1, 5.25, 2, 0.04),
    new THREE.MeshStandardMaterial({ color: COLORS.plate, roughness: 0.7 })
  );
  plate.position.set(0, PLATE_Y - 0.05, KB_Z);
  plate.receiveShadow = true;
  scene.add(caseMesh, plate);

  // แกนสวิตช์รูปกากบาท (ใช้ InstancedMesh = วาดหลายชิ้นในครั้งเดียว เบาเครื่อง)
  const stemMat = new THREE.MeshStandardMaterial({ color: COLORS.stem, roughness: 0.5 });
  const barA = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.12, 0.07), stemMat, TOTAL_KEYS);
  const barB = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.12, 0.24), stemMat, TOTAL_KEYS);
  const m = new THREE.Matrix4();
  keyDefs.forEach((d, i) => {
    m.makeTranslation(d.x, PLATE_Y + 0.06, d.z);
    barA.setMatrixAt(i, m);
    barB.setMatrixAt(i, m);
  });
  barA.castShadow = barB.castShadow = true;
  scene.add(barA, barB);
}

const slots = [];

function createSlot(d, w, depth, legendTexture) {
  // พื้นช่อง
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.02, depth),
    new THREE.MeshStandardMaterial({ color: COLORS.slot, roughness: 0.8 })
  );
  base.position.set(d.x, PLATE_Y + 0.01, d.z);
  base.receiveShadow = true;

  // ตัวอักษรจางๆ ลอยเหนือช่อง เป็นคำใบ้ว่าช่องนี้ต้องใส่ปุ่มอะไร
  const ghost = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.3, depth - 0.3),
    new THREE.MeshBasicMaterial({ map: legendTexture, transparent: true, opacity: 0.4, depthWrite: false })
  );
  ghost.rotation.x = -Math.PI / 2;
  ghost.position.set(d.x, PLATE_Y + 0.14, d.z);

  scene.add(base, ghost);
  slots.push({ x: d.x, z: d.z, w, depth, match: d.match, filled: false, base, ghost });
}

// =============================================================
// 5. คีย์แคป
// =============================================================
const caps = [];
const geometryCache = new Map();

// สร้างรูปทรงคีย์แคป: กล่องมุมมน ด้านบนแคบกว่าด้านล่างนิดหน่อย (เหมือนของจริง)
function getCapGeometry(w, depth, h) {
  const key = w.toFixed(3);
  if (geometryCache.has(key)) return geometryCache.get(key);
  const geo = new RoundedBoxGeometry(w, h, depth, 3, 0.09);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + h / 2) / h;   // 0 = ล่างสุด, 1 = บนสุด
    const inset = 0.09 * t;
    pos.setX(i, pos.getX(i) - Math.sign(pos.getX(i)) * inset);
    pos.setZ(i, pos.getZ(i) - Math.sign(pos.getZ(i)) * inset);
  }
  geometryCache.set(key, geo);
  return geo;
}

function capColor(d) {
  if (d.en === 'Space') return COLORS.space;
  if (d.en === 'Enter' || d.en === 'Backspace') return COLORS.accent;
  if (!d.th) return COLORS.mod;
  return COLORS.rows[d.row];
}

// สระบน/ล่างและวรรณยุกต์ ต้องมีวงกลมประ ◌ นำหน้าถึงจะแสดงผลสวย
const THAI_MARK = /[ัิ-ฺ็-๎]/;
const showThai = (ch) => (THAI_MARK.test(ch) ? '◌' + ch : ch);

// วาดตัวอักษรบนหน้าปุ่มด้วย canvas 2D แล้วแปะเป็นลายบนปุ่ม 3D
function makeLegendTexture(d, planeW, planeD) {
  const H = 160;
  const W = Math.round((H * planeW) / planeD);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.textBaseline = 'middle';

  if (d.th) {
    g.fillStyle = COLORS.legend;
    g.textAlign = 'center';
    g.font = `600 86px ${FONT}`;
    g.fillText(showThai(d.th), W / 2, H * 0.62);

    g.fillStyle = COLORS.legendSoft;
    g.font = `500 34px ${FONT}`;
    g.textAlign = 'left';
    g.fillText(d.en, 10, 26);
    g.textAlign = 'right';
    g.fillText(showThai(d.ths), W - 10, 26);
  } else {
    g.fillStyle = COLORS.legend;
    g.textAlign = 'center';
    g.font = `500 44px ${FONT}`;
    g.fillText(d.en, W / 2, H / 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildCaps() {
  const h = CONFIG.keyHeight;
  for (const d of keyDefs) {
    const w = d.w - CONFIG.keyGap;
    const depth = 1 - CONFIG.keyGap;

    // ส่วนที่มองเห็น (Three.js)
    const group = new THREE.Group();
    const shell = new THREE.Mesh(
      getCapGeometry(w, depth, h),
      new THREE.MeshStandardMaterial({ color: capColor(d), roughness: 0.45 })
    );
    shell.castShadow = shell.receiveShadow = true;

    const pw = w - 0.3;
    const pd = depth - 0.3;
    const tex = makeLegendTexture(d, pw, pd);
    const legend = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, pd),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 })
    );
    legend.rotation.x = -Math.PI / 2;
    legend.position.y = h / 2 + 0.004;
    group.add(shell, legend);
    scene.add(group);

    // ส่วนฟิสิกส์ (cannon-es) เป็นกล่องธรรมดาขนาดเท่าคีย์แคป
    const body = new CANNON.Body({
      mass: 1,
      material: capMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, depth / 2)),
      linearDamping: 0.05,
      angularDamping: 0.15,
      sleepSpeedLimit: 0.25,
      sleepTimeLimit: 0.6,
    });
    body.addEventListener('collide', onCapCollide);
    world.addBody(body);

    const cap = { d, group, body, placed: false };
    group.userData.cap = cap;
    caps.push(cap);

    createSlot(d, w, depth, tex);
  }
}

// เล่นเสียงตอนคีย์แคปกระแทกกัน ยิ่งแรงยิ่งดัง
function onCapCollide(e) {
  const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (speed > 1.2) Sound.drop(Math.min(speed / 12, 1));
}

// โปรยคีย์แคปลงบนกอง (rain = ตกลงมาจากฟ้าทีละชิ้น)
function scatterCaps(rain) {
  const order = caps.slice().sort(() => Math.random() - 0.5);
  order.forEach((cap, i) => {
    const b = cap.body;
    const half = (cap.d.w - CONFIG.keyGap) / 2;
    b.type = CANNON.Body.DYNAMIC;
    b.position.set(
      rand(PILE.minX + half, PILE.maxX - half),
      rain ? 3 + i * 0.22 : rand(0.5, 2),
      rand(PILE.minZ + 0.5, PILE.maxZ - 0.5)
    );
    // ประมาณ 30% จะคว่ำหน้า ผู้เล่นต้องหาเอง
    const flip = Math.random() < 0.3 ? Math.PI : 0;
    b.quaternion.setFromEuler(flip + rand(-0.6, 0.6), rand(-Math.PI, Math.PI), rand(-0.6, 0.6));
    b.velocity.setZero();
    b.angularVelocity.setZero();
    b.wakeUp();
    cap.placed = false;
    cap.group.scale.set(1, 1, 1);
  });
}

function wakeAll() {
  for (const cap of caps) if (!cap.placed) cap.body.wakeUp();
}

// =============================================================
// 6. การลากด้วยเมาส์ / นิ้ว
// =============================================================
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const holdPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CONFIG.holdHeight); // ระนาบที่คีย์แคปลอยอยู่
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLATE_Y);           // ระนาบของช่องบนคีย์บอร์ด
const holdTarget = new THREE.Vector3();
const aimPoint = new THREE.Vector3();

let held = null;          // คีย์แคปที่กำลังถืออยู่
let heldPointerId = null;
let hover = null;         // ช่องที่อยู่ใต้คีย์แคปตอนนี้ { slot, ok }
let wakeTimer = 0;

function setRay(e, liftPx = 0) {
  const r = canvas.getBoundingClientRect();
  pointerNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointerNdc.y = -((e.clientY - r.top - liftPx) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
}

function pickCap(e) {
  setRay(e);
  const targets = caps.filter((c) => !c.placed).map((c) => c.group);
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !obj.userData.cap) obj = obj.parent;
  return obj ? obj.userData.cap : null;
}

// หาช่องใต้จุดที่เล็งอยู่: ok = true แปลว่าช่องนี้ถูกต้องสำหรับปุ่มที่ถือ
function findSlotUnder(p, cap) {
  const tol = CONFIG.snapTolerance;
  for (const s of slots) {
    if (!s.filled && s.match === cap.d.match &&
        Math.abs(p.x - s.x) <= s.w / 2 + tol && Math.abs(p.z - s.z) <= s.depth / 2 + tol) {
      return { slot: s, ok: true };
    }
  }
  for (const s of slots) {
    if (Math.abs(p.x - s.x) <= s.w / 2 && Math.abs(p.z - s.z) <= s.depth / 2) {
      return { slot: s, ok: false };
    }
  }
  return null;
}

function setHover(h) {
  if (hover && !hover.slot.filled) hover.slot.base.material.color.set(COLORS.slot);
  hover = h;
  if (hover && hover.ok) hover.slot.base.material.color.set(COLORS.slotGood);
}

function updateHold(e) {
  setRay(e, e.pointerType === 'mouse' ? 0 : CONFIG.touchLift);
  raycaster.ray.intersectPlane(holdPlane, holdTarget);
  raycaster.ray.intersectPlane(aimPlane, aimPoint);
  holdTarget.x = clamp(holdTarget.x, TABLE.minX + 0.5, TABLE.maxX - 0.5);
  holdTarget.z = clamp(holdTarget.z, TABLE.minZ + 0.5, TABLE.maxZ - 0.5);
  setHover(findSlotUnder(aimPoint, held));
}

canvas.addEventListener('pointerdown', (e) => {
  Sound.init();
  if (state !== 'playing' || held) return;
  const cap = pickCap(e);
  if (!cap) return;
  held = cap;
  heldPointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  cap.body.type = CANNON.Body.KINEMATIC;   // ระหว่างถือ ฟิสิกส์จะไม่ดึงลง แต่ยังชนของอื่นได้
  cap.body.angularVelocity.setZero();
  wakeAll();
  Sound.pick();
  updateHold(e);
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('pointermove', (e) => {
  if (held && e.pointerId === heldPointerId) {
    updateHold(e);
  } else if (!held && e.pointerType === 'mouse') {
    canvas.style.cursor = state === 'playing' && pickCap(e) ? 'grab' : 'default';
  }
});

function releaseHeld() {
  if (!held) return;
  const cap = held;
  const h = hover;
  held = null;
  heldPointerId = null;
  canvas.style.cursor = 'default';
  setHover(null);

  if (h && h.ok && state === 'playing') {
    placeCap(cap, h.slot);
    return;
  }
  // วางไม่ตรงช่อง: ปล่อยให้ตกลงตามฟิสิกส์
  cap.body.type = CANNON.Body.DYNAMIC;
  cap.body.velocity.scale(0.4, cap.body.velocity);
  wakeAll();
  if (h && !h.ok) {
    Sound.wrong();
    flashSlot(h.slot);
  }
}

function onPointerUp(e) {
  if (e.pointerId === heldPointerId) releaseHeld();
}
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);

// ขยับคีย์แคปที่ถืออยู่ตามนิ้ว (เรียกทุกเฟรม)
const tmpQuat = new THREE.Quaternion();
const tiltQuat = new THREE.Quaternion();
const tiltEuler = new THREE.Euler();

function updateHeld(dt) {
  if (!held) return;
  const b = held.body;
  const k = 14;   // ยิ่งมากยิ่งตามนิ้วไว
  const vx = clamp((holdTarget.x - b.position.x) * k, -30, 30);
  const vy = clamp((holdTarget.y - b.position.y) * k, -30, 30);
  const vz = clamp((holdTarget.z - b.position.z) * k, -30, 30);
  b.wakeUp();   // ถ้าถือนิ่งๆ นานๆ ฟิสิกส์จะทำให้หลับ ต้องปลุกไว้ตลอด
  b.velocity.set(vx, vy, vz);
  b.angularVelocity.setZero();

  // หมุนให้หงายหน้าขึ้น และเอียงตามทิศที่ลาก ให้ดูมีน้ำหนัก
  tiltEuler.set(clamp(vz * 0.02, -0.35, 0.35), 0, clamp(-vx * 0.02, -0.35, 0.35));
  tiltQuat.setFromEuler(tiltEuler);
  tmpQuat.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  tmpQuat.slerp(tiltQuat, 1 - Math.exp(-dt * 12));
  b.quaternion.set(tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w);

  // ปลุกคีย์แคปที่หลับอยู่เป็นระยะ กันไม่ให้ลอยค้างเมื่อชิ้นข้างล่างถูกดึงออก
  wakeTimer += dt;
  if (wakeTimer > 0.4) {
    wakeTimer = 0;
    wakeAll();
  }
}

// วางคีย์แคปลงช่องที่ถูกต้อง พร้อมอนิเมชัน
function placeCap(cap, slot) {
  slot.filled = true;
  slot.ghost.visible = false;
  slot.base.material.color.set(COLORS.slot);
  cap.placed = true;

  // ฟิสิกส์: กลายเป็นวัตถุนิ่ง อยู่ในช่อง (ของที่ตกลงมาจะวางทับได้)
  const b = cap.body;
  b.type = CANNON.Body.KINEMATIC;
  b.velocity.setZero();
  b.angularVelocity.setZero();
  b.position.set(slot.x, PLACED_Y, slot.z);
  b.quaternion.set(0, 0, 0, 1);
  wakeAll();

  // ภาพ: เลื่อนลงไปในช่อง แล้วยุบตัว-เด้งกลับ
  const g = cap.group;
  const fromP = g.position.clone();
  const fromQ = g.quaternion.clone();
  const toQ = new THREE.Quaternion();
  tween(0.22, (p) => {
    const e = easeOutCubic(p);
    g.position.x = THREE.MathUtils.lerp(fromP.x, slot.x, e);
    g.position.z = THREE.MathUtils.lerp(fromP.z, slot.z, e);
    g.position.y = THREE.MathUtils.lerp(fromP.y, PLACED_Y, p * p);
    g.quaternion.slerpQuaternions(fromQ, toQ, e);
  }, () => {
    Sound.snap();
    burst(new THREE.Vector3(slot.x, PLACED_Y, slot.z), 16);
    shakeCamera(0.05);
    tween(0.28, (p) => {
      const squash = 0.25 * Math.sin(Math.PI * p) * (1 - p);
      g.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      g.position.y = PLACED_Y - (squash * CONFIG.keyHeight) / 2;
    });
  });

  placedCount++;
  updateProgress();
  if (placedCount === TOTAL_KEYS) win();
}

function flashSlot(slot) {
  if (slot.filled) return;
  slot.base.material.color.set(COLORS.slotBad);
  setTimeout(() => {
    if (!slot.filled && hover?.slot !== slot) slot.base.material.color.set(COLORS.slot);
  }, 350);
}

// =============================================================
// 7. เอฟเฟกต์
// =============================================================

// --- tween: เปลี่ยนค่าอย่างนุ่มนวลตามเวลา ---
const tweens = [];
function tween(duration, onUpdate, onDone) {
  tweens.push({ t: 0, duration, onUpdate, onDone });
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const p = Math.min(tw.t / tw.duration, 1);
    tw.onUpdate(p);
    if (p >= 1) {
      tweens.splice(i, 1);
      if (tw.onDone) tw.onDone();
    }
  }
}
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

// --- ประกายเพชรพาสเทล ---
const sparkGeo = new THREE.OctahedronGeometry(0.09);
const sparkMats = COLORS.sparkle.map((c) => new THREE.MeshBasicMaterial({ color: c }));
const sparks = [];

function burst(pos, count, power = 1) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(sparkGeo, pickOne(sparkMats));
    mesh.position.copy(pos);
    mesh.position.y += 0.3;
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(2, 5) * power;
    sparks.push({
      mesh,
      vx: Math.cos(angle) * speed,
      vy: rand(4, 8) * power,
      vz: Math.sin(angle) * speed,
      spin: rand(-10, 10),
      life: 0,
      maxLife: rand(0.6, 1),
    });
    scene.add(mesh);
  }
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life += dt;
    const t = s.life / s.maxLife;
    if (t >= 1) {
      scene.remove(s.mesh);
      sparks.splice(i, 1);
      continue;
    }
    s.vy -= 14 * dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.mesh.rotation.x += s.spin * dt;
    s.mesh.rotation.y += s.spin * dt;
    s.mesh.scale.setScalar(1 - t);
  }
}

// --- จอสั่น ---
let shakeAmount = 0;
function shakeCamera(amount) {
  shakeAmount = Math.max(shakeAmount, amount);
}
function updateCameraShake(dt) {
  camera.position.copy(cameraBase);
  if (shakeAmount > 0.001) {
    camera.position.x += rand(-1, 1) * shakeAmount;
    camera.position.y += rand(-1, 1) * shakeAmount;
    camera.position.z += rand(-1, 1) * shakeAmount;
    shakeAmount *= Math.exp(-dt * 10);
  }
}

// --- ปรับกล้องให้เห็นโต๊ะพอดีจอทุกขนาด ---
const FIT_POINTS = [];
for (const x of [TABLE.minX, TABLE.maxX])
  for (const z of [TABLE.minZ, TABLE.maxZ])
    for (const y of [0, 1.4]) FIT_POINTS.push(new THREE.Vector3(x, y, z));

function fitCamera() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;

  // จอตั้ง (มือถือ) มองจากด้านบนมากขึ้น เพื่อใช้พื้นที่แนวตั้ง
  const elevation = THREE.MathUtils.degToRad(w < h ? 72 : 58);
  const dir = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation));
  const topLimit = 1 - (2 * 70) / h;     // เว้นที่ให้แถบด้านบน
  const bottomLimit = -1 + (2 * 16) / h;
  const v = new THREE.Vector3();

  const placeAt = (dist) => {
    camera.position.copy(cameraTarget).addScaledVector(dir, dist);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
  };
  const fits = () => FIT_POINTS.every((p) => {
    v.copy(p).project(camera);
    return v.z < 1 && Math.abs(v.x) <= 0.97 && v.y <= topLimit && v.y >= bottomLimit;
  });

  // ค้นหาระยะกล้องที่ใกล้ที่สุดที่ยังเห็นครบ (binary search)
  let lo = 2;
  let hi = 200;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    placeAt(mid);
    if (fits()) hi = mid;
    else lo = mid;
  }
  placeAt(hi);
  cameraBase.copy(camera.position);
}
window.addEventListener('resize', fitCamera);

// =============================================================
// 8. สถานะเกม
// =============================================================
const ui = {
  timer: $('#timer'),
  count: $('#count'),
  bar: $('#barFill'),
  start: $('#startScreen'),
  end: $('#endScreen'),
  endEmoji: $('#endEmoji'),
  endTitle: $('#endTitle'),
  endText: $('#endText'),
  best: $('#bestText'),
  toast: $('#toast'),
  shakeBtn: $('#shakeBtn'),
  muteBtn: $('#muteBtn'),
  loading: $('#loading'),
};

let state = 'menu';            // 'menu' | 'playing' | 'won' | 'lost'
let timeLeft = CONFIG.timeLimit;
let lastShownSecond = -1;
let placedCount = 0;

const formatTime = (sec) => {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

function getBest() {
  try { return Number(localStorage.getItem('keycap-best')) || 0; } catch { return 0; }
}
function setBest(sec) {
  try { localStorage.setItem('keycap-best', String(sec)); } catch { /* ไม่เป็นไร */ }
}

function showBest() {
  const best = getBest();
  ui.best.textContent = best ? `🏆 เวลาดีที่สุด ${formatTime(best)}` : '';
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth;   // รีเซ็ตอนิเมชันให้เล่นใหม่
  ui.toast.classList.add('show');
}

function updateProgress() {
  ui.count.textContent = `${placedCount} / ${TOTAL_KEYS}`;
  ui.bar.style.width = `${(placedCount / TOTAL_KEYS) * 100}%`;
  ui.count.classList.remove('bump');
  void ui.count.offsetWidth;
  ui.count.classList.add('bump');
}

function startGame() {
  Sound.init();
  Sound.start();
  ui.start.classList.add('hidden');
  ui.end.classList.add('hidden');

  tweens.length = 0;
  for (const s of slots) {
    s.filled = false;
    s.ghost.visible = true;
    s.base.material.color.set(COLORS.slot);
  }
  placedCount = 0;
  timeLeft = CONFIG.timeLimit;
  lastShownSecond = -1;
  ui.timer.classList.remove('warn');
  updateProgress();
  scatterCaps(true);
  state = 'playing';
  toast('เริ่ม!');
}

function updateTimer(dt) {
  if (state !== 'playing') return;
  timeLeft -= dt;
  const sec = Math.ceil(timeLeft);
  if (sec !== lastShownSecond) {
    lastShownSecond = sec;
    ui.timer.textContent = formatTime(sec);
    ui.timer.classList.toggle('warn', sec <= 60);
    if (sec === 60) toast('เหลือ 1 นาที!');
    if (sec <= 10 && sec > 0) Sound.tick();
  }
  if (timeLeft <= 0) lose();
}

function win() {
  state = 'won';
  const used = Math.ceil(CONFIG.timeLimit - timeLeft);
  const best = getBest();
  const isRecord = !best || used < best;
  if (isRecord) setBest(used);

  Sound.win();
  toast('สุดยอด!');
  // พลุประกายหลายจุดบนคีย์บอร์ด
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      burst(new THREE.Vector3(rand(-6, 6), PLACED_Y + 0.5, KB_Z + rand(-1.5, 1.5)), 30, 1.3);
      shakeCamera(0.08);
    }, i * 180);
  }

  setTimeout(() => {
    ui.endEmoji.textContent = '🎉';
    ui.endTitle.textContent = 'ประกอบเสร็จแล้ว!';
    ui.endText.innerHTML = `ใช้เวลา <b>${formatTime(used)}</b>` +
      (isRecord ? '<br>🏆 สถิติใหม่!' : `<br>เวลาดีที่สุด ${formatTime(best)}`);
    ui.end.classList.remove('hidden');
  }, 1400);
}

function lose() {
  state = 'lost';
  releaseHeld();
  Sound.lose();
  ui.timer.textContent = '0:00';
  setTimeout(() => {
    ui.endEmoji.textContent = '⏰';
    ui.endTitle.textContent = 'หมดเวลา!';
    ui.endText.innerHTML = `ประกอบได้ <b>${placedCount} / ${TOTAL_KEYS}</b> ปุ่ม<br>ลองอีกครั้งนะ!`;
    ui.end.classList.remove('hidden');
  }, 600);
}

// ปุ่มเขย่า: ดีดคีย์แคปในกองให้ลอยขึ้นและพลิก
ui.shakeBtn.addEventListener('click', () => {
  Sound.init();
  if (state !== 'playing') return;
  for (const cap of caps) {
    if (cap.placed || cap === held) continue;
    const b = cap.body;
    b.wakeUp();
    b.velocity.set(rand(-2, 2), rand(5, 8), rand(-2, 2));
    b.angularVelocity.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
  }
  Sound.shake();
  shakeCamera(0.15);
  ui.shakeBtn.classList.add('cooling');
  setTimeout(() => ui.shakeBtn.classList.remove('cooling'), CONFIG.shakeCooldown * 1000);
});

ui.muteBtn.addEventListener('click', () => {
  Sound.init();
  ui.muteBtn.textContent = Sound.toggleMute() ? '🔇' : '🔊';
});

$('#startBtn').addEventListener('click', startGame);
$('#retryBtn').addEventListener('click', startGame);

// =============================================================
// 9. ลูปหลัก และเริ่มต้นโปรแกรม
// =============================================================
let lastTime = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updateHeld(dt);
  world.step(1 / 60, dt, 3);

  // ให้ภาพ 3D ตามตำแหน่งฟิสิกส์
  for (const cap of caps) {
    if (cap.placed) continue;
    const b = cap.body;
    if (b.position.y < -3) {   // กันหลุดโลก
      b.position.set(rand(-5, 5), 4, rand(PILE.minZ + 1, PILE.maxZ - 1));
      b.velocity.setZero();
    }
    cap.group.position.copy(b.position);
    cap.group.quaternion.copy(b.quaternion);
  }

  updateTweens(dt);
  updateSparks(dt);
  updateTimer(dt);
  updateCameraShake(dt);
  renderer.render(scene, camera);
}

// รอฟอนต์ไทยโหลดเสร็จก่อนวาดตัวอักษรบนปุ่ม (รอไม่เกิน 3 วินาที)
async function loadFonts() {
  if (!document.fonts) return;
  const wait = Promise.all([
    document.fonts.load(`600 86px Kanit`, 'กขค'),
    document.fonts.load(`500 34px Kanit`, 'ABC'),
  ]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  try { await Promise.race([wait, timeout]); } catch { /* ใช้ฟอนต์สำรอง */ }
}

async function init() {
  await loadFonts();
  buildKeyboardBody();
  buildCaps();
  fitCamera();
  scatterCaps(true);     // โปรยให้เห็นเป็นฉากหลังของหน้าเริ่ม
  updateProgress();
  showBest();
  ui.loading.classList.add('hidden');
  ui.start.classList.remove('hidden');
  requestAnimationFrame(loop);
}

init();
