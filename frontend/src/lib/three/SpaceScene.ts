/**
 * Realistic Three.js Space, Procedural Planets, Space Hazards (Asteroids, Debris, Solar Wind),
 * Multi-Level Space Pirates, Multiplayer Ships, AI Autopilot & Manual Flight Engine
 * (`frontend/src/lib/three/SpaceScene.ts`)
 */
import * as THREE from 'three';
import type { FlightTelemetry } from '../stores/gameStore';

export interface Planet3DData {
  id: string;
  name: string;
  name_ko: string;
  biome: string;
  sector: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  color_primary: string;
  color_secondary: string;
  atmosphere_color: string;
  has_rings: number | boolean;
  danger_level: number;
}

interface HazardObject {
  id: string;
  type: 'ASTEROID_FRAGMENT' | 'SPACE_DEBRIS' | 'SOLAR_WIND';
  name: string;
  mesh: THREE.Object3D;
  radius: number;
  velocity: THREE.Vector3;
}

export class SpaceEngine3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private shipGroup: THREE.Group;
  private thrusterFlames: THREE.Mesh[] = [];
  private miningBeam: THREE.Line | null = null;
  private combatLaser: THREE.Line | null = null;
  private navLine: THREE.Line | null = null;
  private targetBeacon: THREE.Mesh | null = null;
  private planetMeshes: Map<string, THREE.Group> = new Map();
  private pirateMeshes: Map<string, THREE.Group> = new Map();
  private otherPlayerMeshes: Map<string, THREE.Group> = new Map();
  private hazards: HazardObject[] = [];
  private explosionParticles: THREE.Points | null = null;

  private planetsData: Planet3DData[] = [];
  private piratesData: any[] = [];
  private otherPlayersData: any[] = [];
  private starField!: THREE.Points;

  // Flight modes: ORBIT | MANUAL | AI_AUTOPILOT
  private flightMode: 'ORBIT' | 'MANUAL' | 'AI_AUTOPILOT' = 'ORBIT';
  private targetPos = new THREE.Vector3(95, 2, 12);
  private isWarping = false;
  private selectedTargetPlanetId: string | null = 'planet_2';

  // Manual Flight Physics
  private shipYaw = 0;
  private shipPitch = 0;
  private shipRoll = 0;
  private currentSpeed = 0;
  private speedMultiplier = 1.0;
  private keys: Record<string, boolean> = {};
  private lastCollisionTime = 0;
  private shakeIntensity = 0;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private onPlanetSelect: (planetId: string) => void;
  private onTelemetry?: (telemetry: FlightTelemetry) => void;
  private onHazardCollision?: (hazardType: string, colliderName: string) => void;
  private onPirateEncounter?: (pirateId: string) => void;
  private onAiAutopilotArrive?: (planetId: string) => void;

  private frameId = 0;
  private lastTelemetryTime = 0;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundPointerDown: (e: MouseEvent) => void;
  private boundResize: () => void;

  constructor(
    container: HTMLElement,
    onPlanetSelect: (planetId: string) => void,
    onTelemetry?: (telemetry: FlightTelemetry) => void,
    callbacks?: {
      onHazardCollision?: (hazardType: string, colliderName: string) => void;
      onPirateEncounter?: (pirateId: string) => void;
      onAiAutopilotArrive?: (planetId: string) => void;
    }
  ) {
    this.container = container;
    this.onPlanetSelect = onPlanetSelect;
    this.onTelemetry = onTelemetry;
    this.onHazardCollision = callbacks?.onHazardCollision;
    this.onPirateEncounter = callbacks?.onPirateEncounter;
    this.onAiAutopilotArrive = callbacks?.onAiAutopilotArrive;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020617, 0.0003);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      8000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);

    this.initLightsAndSun();
    this.initStarfield(6000);
    this.initSpaceHazards();
    this.shipGroup = this.buildRealisticSpaceship(0xcbd5e1, 0x38bdf8);
    this.shipGroup.position.set(95, 2, 12);
    this.scene.add(this.shipGroup);
    this.initNavigationVisuals();

    this.boundKeyDown = (e) => this.handleKey(e, true);
    this.boundKeyUp = (e) => this.handleKey(e, false);
    this.boundPointerDown = (e) => this.handlePointerDown(e);
    this.boundResize = () => this.onResize();

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    this.renderer.domElement.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('resize', this.boundResize);

    this.animate();
  }

  /**
   * Spawns 3D Asteroid Fragments, Space Debris & Solar Wind Plasma Zones across space lanes
   */
  private initSpaceHazards() {
    const rockGeo = new THREE.DodecahedronGeometry(2.8, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9, metalness: 0.15 });

    const debrisGeo = new THREE.BoxGeometry(3.2, 0.5, 2.2);
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.85 });

    const solarGeo = new THREE.TorusGeometry(9, 1.4, 12, 32);
    const solarMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.42,
    });

    // 45 Asteroid Fragments
    for (let i = 0; i < 45; i++) {
      const angle = i * 0.45;
      const dist = 75 + (i % 15) * 42;
      const mesh = new THREE.Mesh(rockGeo, rockMat);
      mesh.position.set(
        Math.cos(angle) * dist + (Math.random() - 0.5) * 35,
        ((i % 5) - 2) * 8,
        Math.sin(angle) * dist + (Math.random() - 0.5) * 35
      );
      const scale = 0.7 + (i % 4) * 0.45;
      mesh.scale.set(scale, scale * 0.8, scale * 1.1);
      this.scene.add(mesh);
      this.hazards.push({
        id: `ast_${i}`,
        type: 'ASTEROID_FRAGMENT',
        name: 'Asteroid Fragment',
        mesh,
        radius: 3.2 * scale,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12),
      });
    }

    // 25 Space Debris Wreckage
    for (let i = 0; i < 25; i++) {
      const angle = i * 0.78 + 0.3;
      const dist = 85 + (i % 12) * 45;
      const mesh = new THREE.Mesh(debrisGeo, debrisMat);
      mesh.position.set(
        Math.cos(angle) * dist,
        ((i % 3) - 1) * 6,
        Math.sin(angle) * dist
      );
      this.scene.add(mesh);
      this.hazards.push({
        id: `deb_${i}`,
        type: 'SPACE_DEBRIS',
        name: 'Orbital Space Debris',
        mesh,
        radius: 3.5,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08),
      });
    }

    // 12 Solar Wind Plasma Storms
    for (let i = 0; i < 12; i++) {
      const angle = i * 1.05;
      const dist = 110 + i * 52;
      const mesh = new THREE.Mesh(solarGeo, solarMat);
      mesh.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      mesh.rotation.x = Math.PI / 3;
      this.scene.add(mesh);
      this.hazards.push({
        id: `sol_${i}`,
        type: 'SOLAR_WIND',
        name: 'Solar Wind Plasma Storm',
        mesh,
        radius: 9.5,
        velocity: new THREE.Vector3(0, 0, 0),
      });
    }
  }

  public triggerExplosionEffect(pos?: THREE.Vector3, colorHex: number = 0xf97316) {
    if (this.explosionParticles) {
      this.scene.remove(this.explosionParticles);
      this.explosionParticles = null;
    }
    const center = pos || this.shipGroup.position.clone();
    const count = 90;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = center.x + (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = center.y + (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: colorHex, size: 1.8, transparent: true, opacity: 0.95 });
    this.explosionParticles = new THREE.Points(geo, mat);
    this.scene.add(this.explosionParticles);
    this.shakeIntensity = 1.6;

    setTimeout(() => {
      if (this.explosionParticles) {
        this.scene.remove(this.explosionParticles);
        this.explosionParticles = null;
      }
    }, 650);
  }

  public fireCombatLaserAt(targetPos: THREE.Vector3, colorHex: number = 0xf43f5e) {
    if (this.combatLaser) {
      this.scene.remove(this.combatLaser);
      this.combatLaser = null;
    }
    const pts = [this.shipGroup.position.clone(), targetPos.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3 });
    this.combatLaser = new THREE.Line(geo, mat);
    this.scene.add(this.combatLaser);
    this.triggerExplosionEffect(targetPos, colorHex);
    setTimeout(() => {
      if (this.combatLaser) {
        this.scene.remove(this.combatLaser);
        this.combatLaser = null;
      }
    }, 450);
  }

  public syncMultiplayerEntities(otherPlayers: any[], pirates: any[]) {
    this.otherPlayersData = otherPlayers || [];
    this.piratesData = pirates || [];

    // Sync Other Player Ships
    for (const p of this.otherPlayersData) {
      let grp = this.otherPlayerMeshes.get(p.id);
      if (!grp) {
        grp = this.buildRealisticSpaceship(0x34d399, 0x10b981);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(3.2, 3.8, 24),
          new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
        );
        ring.rotation.x = Math.PI / 2;
        grp.add(ring);
        this.scene.add(grp);
        this.otherPlayerMeshes.set(p.id, grp);
      }
      grp.position.lerp(new THREE.Vector3(p.x, p.y, p.z), 0.25);
    }

    // Sync Space Pirate Ships (Hostile Crimson Ships with Red Beacon)
    for (const pr of this.piratesData) {
      let grp = this.pirateMeshes.get(pr.id);
      if (!grp) {
        grp = this.buildRealisticSpaceship(0xef4444, 0xf97316);
        const scale = 1.0 + Math.min(1.5, pr.level * 0.12);
        grp.scale.set(scale, scale, scale);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(4.0, 4.9, 24),
          new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide })
        );
        ring.rotation.x = Math.PI / 2;
        ring.userData = { pirateId: pr.id };
        grp.add(ring);
        if (grp.children[0]) grp.children[0].userData = { pirateId: pr.id };
        this.scene.add(grp);
        this.pirateMeshes.set(pr.id, grp);
      }
      grp.position.lerp(new THREE.Vector3(pr.x, pr.y, pr.z), 0.2);
      grp.rotation.y += 0.02;
    }
  }

  private handleKey(e: KeyboardEvent, isDown: boolean) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const code = e.code;
    this.keys[code] = isDown;

    if (
      isDown &&
      ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)
    ) {
      if (this.flightMode !== 'MANUAL') {
        this.setFlightMode('MANUAL');
      }
    }
  }

  public setControlInput(code: string, active: boolean) {
    this.keys[code] = active;
    if (active && this.flightMode !== 'MANUAL') {
      this.setFlightMode('MANUAL');
    }
  }

  public setFlightMode(mode: 'ORBIT' | 'MANUAL' | 'AI_AUTOPILOT') {
    this.flightMode = mode;
    if (mode === 'ORBIT') {
      this.currentSpeed = 0;
    }
  }

  public startAiAutopilotTo(planet: Planet3DData) {
    this.selectedTargetPlanetId = planet.id;
    this.flightMode = 'AI_AUTOPILOT';
    this.alignShipToPlanet(planet);
  }

  public getFlightMode(): 'ORBIT' | 'MANUAL' | 'AI_AUTOPILOT' {
    return this.flightMode;
  }

  public setSpeedMultiplier(mult: number) {
    this.speedMultiplier = Math.max(0.8, mult || 1.0);
  }

  public setTargetPlanet(planetId: string | null) {
    this.selectedTargetPlanetId = planetId;
  }

  public alignShipToPlanet(planet: Planet3DData) {
    if (!planet) return;
    this.selectedTargetPlanetId = planet.id;
    const dx = planet.x - this.shipGroup.position.x;
    const dy = planet.y - this.shipGroup.position.y;
    const dz = planet.z - this.shipGroup.position.z;
    this.shipYaw = Math.atan2(-dx, -dz);
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    this.shipPitch = Math.max(-0.85, Math.min(0.85, Math.atan2(dy, Math.max(1, horizDist))));
  }

  private handlePointerDown(e: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const targets: THREE.Object3D[] = [];
    for (const [, grp] of this.planetMeshes) {
      if (grp.children[0]) targets.push(grp.children[0]);
    }
    for (const [, grp] of this.pirateMeshes) {
      if (grp.children[0]) targets.push(grp.children[0]);
    }
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const uData = hits[0].object.userData;
      if (uData?.pirateId && this.onPirateEncounter) {
        this.onPirateEncounter(uData.pirateId);
      } else if (uData?.planetId) {
        this.selectedTargetPlanetId = uData.planetId;
        this.onPlanetSelect(uData.planetId);
      }
    }
  }

  private initNavigationVisuals() {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -10),
    ]);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 6,
      gapSize: 3,
      transparent: true,
      opacity: 0.75,
    });
    this.navLine = new THREE.Line(lineGeo, lineMat);
    this.scene.add(this.navLine);

    const beaconGeo = new THREE.RingGeometry(8, 10.2, 48);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    this.targetBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.targetBeacon.rotation.x = Math.PI / 2;
    this.targetBeacon.visible = false;
    this.scene.add(this.targetBeacon);
  }

  private initLightsAndSun() {
    const ambient = new THREE.AmbientLight(0x1e293b, 1.45);
    this.scene.add(ambient);

    const sunLight = new THREE.PointLight(0xfff7ed, 3.4, 5500, 0.45);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);

    const sunGeo = new THREE.SphereGeometry(28, 48, 48);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    this.scene.add(new THREE.Mesh(sunGeo, sunMat));

    const coronaGeo = new THREE.SphereGeometry(38, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    this.scene.add(new THREE.Mesh(coronaGeo, coronaMat));
  }

  private initStarfield(count: number) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 450 + Math.random() * 2600;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.45;
      positions[i * 3 + 2] = r * Math.cos(phi);

      const tint = Math.random();
      colors[i * 3] = tint > 0.7 ? 0.75 : 1.0;
      colors[i * 3 + 1] = tint > 0.4 ? 0.88 : 0.75;
      colors[i * 3 + 2] = 1.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 2.1, vertexColors: true, transparent: true, opacity: 0.9 });
    this.starField = new THREE.Points(geo, mat);
    this.scene.add(this.starField);
  }

  private buildRealisticSpaceship(hullColorHex: number = 0xcbd5e1, glowHex: number = 0x38bdf8): THREE.Group {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({ color: hullColorHex, metalness: 0.82, roughness: 0.28 });
    const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.4 });
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: glowHex,
      emissive: glowHex,
      emissiveIntensity: 0.55,
      metalness: 0.95,
      roughness: 0.1,
    });
    const thrusterMat = new THREE.MeshBasicMaterial({ color: glowHex, transparent: true, opacity: 0.88 });

    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(1.3, 6.2, 8), hullMat);
    fuselage.rotation.x = -Math.PI / 2;
    group.add(fuselage);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), cockpitMat);
    canopy.scale.set(0.85, 0.55, 1.8);
    canopy.position.set(0, 0.55, -0.8);
    group.add(canopy);

    const wingGeo = new THREE.BoxGeometry(5.8, 0.18, 2.2);
    const wings = new THREE.Mesh(wingGeo, darkTrimMat);
    wings.position.set(0, -0.1, 0.8);
    group.add(wings);

    for (const side of [-1, 1]) {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 3.6, 12), hullMat);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(side * 2.2, 0.05, 1.1);
      group.add(nacelle);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.4, 12), thrusterMat);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(side * 2.2, 0.05, 3.8);
      if (hullColorHex === 0xcbd5e1) {
        this.thrusterFlames.push(flame);
      }
      group.add(flame);
    }

    return group;
  }

  private createProceduralPlanetTexture(primaryHex: string, secondaryHex: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, primaryHex);
    grad.addColorStop(0.5, secondaryHex);
    grad.addColorStop(1, primaryHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = i % 2 === 0 ? primaryHex : secondaryHex;
      ctx.globalAlpha = 0.22;
      const y = Math.random() * canvas.height;
      const h = 2 + Math.random() * 10;
      ctx.fillRect(0, y, canvas.width, h);
    }
    return new THREE.CanvasTexture(canvas);
  }

  public syncPlanets(planets: Planet3DData[]) {
    this.planetsData = planets;
    for (const p of planets) {
      if (this.planetMeshes.has(p.id)) continue;

      const group = new THREE.Group();
      group.position.set(p.x, p.y, p.z);

      const tex = this.createProceduralPlanetTexture(p.color_primary, p.color_secondary);
      const sphereMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.65,
        metalness: 0.15,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 36, 36), sphereMat);
      sphere.userData = { planetId: p.id };
      group.add(sphere);

      const atmoMat = new THREE.MeshBasicMaterial({
        color: p.atmosphere_color,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.16, 28, 28), atmoMat));

      if (p.has_rings) {
        const ringGeo = new THREE.RingGeometry(p.radius * 1.45, p.radius * 2.35, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: p.color_secondary,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.3;
        group.add(ring);
      }

      this.scene.add(group);
      this.planetMeshes.set(p.id, group);
    }
  }

  public warpToPlanet(planet: Planet3DData) {
    this.flightMode = 'ORBIT';
    this.isWarping = true;
    this.currentSpeed = 0;
    this.targetPos.set(planet.x + planet.radius * 2.3, planet.y + 2.2, planet.z + planet.radius * 2.3);
    setTimeout(() => {
      this.isWarping = false;
    }, 950);
  }

  public fireMiningLaser(planet: Planet3DData) {
    if (this.miningBeam) {
      this.scene.remove(this.miningBeam);
      this.miningBeam = null;
    }
    const pts = [this.shipGroup.position.clone(), new THREE.Vector3(planet.x, planet.y, planet.z)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
    this.miningBeam = new THREE.Line(geo, mat);
    this.scene.add(this.miningBeam);
    setTimeout(() => {
      if (this.miningBeam) {
        this.scene.remove(this.miningBeam);
        this.miningBeam = null;
      }
    }, 650);
  }

  private onResize() {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private animate() {
    this.frameId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const isBoosting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['BOOST']);
    const targetPlanet = this.planetsData.find((p) => p.id === this.selectedTargetPlanetId);

    // Animate Hazards (Asteroids, Space Debris, Solar Winds)
    for (const h of this.hazards) {
      h.mesh.rotation.x += 0.008;
      h.mesh.rotation.y += 0.012;
      h.mesh.position.add(h.velocity);
    }

    if (this.flightMode === 'AI_AUTOPILOT' && targetPlanet) {
      // AI Agent Autopilot: Smoothly steer toward target planet while weaving around hazards
      const goal = new THREE.Vector3(
        targetPlanet.x + targetPlanet.radius * 2.1,
        targetPlanet.y + 2,
        targetPlanet.z + targetPlanet.radius * 2.1
      );
      const toGoal = goal.clone().sub(this.shipGroup.position);
      const distToGoal = toGoal.length();

      if (distToGoal <= 14) {
        this.flightMode = 'ORBIT';
        this.currentSpeed = 0;
        this.targetPos.copy(goal);
        this.onAiAutopilotArrive?.(targetPlanet.id);
      } else {
        this.alignShipToPlanet(targetPlanet);
        this.currentSpeed = 3.2 * this.speedMultiplier;
        const euler = new THREE.Euler(this.shipPitch, this.shipYaw, 0, 'YXZ');
        this.shipGroup.quaternion.setFromEuler(euler);
        const dir = toGoal.normalize();
        this.shipGroup.position.addScaledVector(dir, this.currentSpeed);

        const chaseOffset = new THREE.Vector3(0, 5.5, 15).applyQuaternion(this.shipGroup.quaternion);
        this.camera.position.lerp(this.shipGroup.position.clone().add(chaseOffset), 0.14);
        this.camera.lookAt(goal);
      }
    } else if (this.flightMode === 'MANUAL') {
      // Direct Manual Flight Controls
      const turnRate = 0.032;
      const pitchRate = 0.024;
      const maxBaseSpeed = 2.6 * this.speedMultiplier * (isBoosting ? 2.2 : 1.0);

      if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
        this.shipYaw += turnRate;
        this.shipRoll = THREE.MathUtils.lerp(this.shipRoll, 0.38, 0.1);
      } else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
        this.shipYaw -= turnRate;
        this.shipRoll = THREE.MathUtils.lerp(this.shipRoll, -0.38, 0.1);
      } else {
        this.shipRoll = THREE.MathUtils.lerp(this.shipRoll, 0, 0.1);
      }

      if (this.keys['KeyQ'] || this.keys['KeyR']) {
        this.shipPitch = Math.min(0.85, this.shipPitch + pitchRate);
      } else if (this.keys['KeyE'] || this.keys['KeyF']) {
        this.shipPitch = Math.max(-0.85, this.shipPitch - pitchRate);
      }

      if (this.keys['KeyW'] || this.keys['ArrowUp']) {
        this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, maxBaseSpeed, 0.06);
      } else if (this.keys['KeyS'] || this.keys['ArrowDown']) {
        this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, -maxBaseSpeed * 0.45, 0.08);
      } else if (this.keys['Space']) {
        this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, 0.18);
      } else {
        this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, 0.015);
      }

      const euler = new THREE.Euler(this.shipPitch, this.shipYaw, this.shipRoll, 'YXZ');
      this.shipGroup.quaternion.setFromEuler(euler);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.shipGroup.quaternion);
      this.shipGroup.position.addScaledVector(forward, this.currentSpeed);

      // Check Collisions in MANUAL Mode (Cooldown 3.5 seconds)
      if (now - this.lastCollisionTime > 3500 && Math.abs(this.currentSpeed) > 0.25) {
        // 1. Check Asteroid / Debris / Solar Wind collision
        for (const h of this.hazards) {
          const d = this.shipGroup.position.distanceTo(h.mesh.position);
          if (d < h.radius + 2.4) {
            this.lastCollisionTime = now;
            this.currentSpeed = -0.8; // Bounce back
            this.triggerExplosionEffect(this.shipGroup.position, 0xf97316);
            this.onHazardCollision?.(h.type, h.name);
            break;
          }
        }

        // 2. Check Other Player Spaceship collision
        for (const op of this.otherPlayersData) {
          const opGroup = this.otherPlayerMeshes.get(op.id);
          if (opGroup && this.shipGroup.position.distanceTo(opGroup.position) < 5.5) {
            this.lastCollisionTime = now;
            this.currentSpeed = -1.0;
            this.triggerExplosionEffect(this.shipGroup.position, 0xef4444);
            this.onHazardCollision?.('PLAYER_COLLISION', op.pilot_name);
            break;
          }
        }

        // 3. Check Pirate Encounter Ambush proximity
        for (const pr of this.piratesData) {
          const prGroup = this.pirateMeshes.get(pr.id);
          if (prGroup && this.shipGroup.position.distanceTo(prGroup.position) < 12) {
            this.lastCollisionTime = now;
            this.currentSpeed = 0;
            this.onPirateEncounter?.(pr.id);
            break;
          }
        }
      }

      const chaseOffset = new THREE.Vector3(0, 5.2, 14.5).applyQuaternion(this.shipGroup.quaternion);
      const desiredCamPos = this.shipGroup.position.clone().add(chaseOffset);
      if (this.shakeIntensity > 0.02) {
        desiredCamPos.x += (Math.random() - 0.5) * this.shakeIntensity;
        desiredCamPos.y += (Math.random() - 0.5) * this.shakeIntensity;
        this.shakeIntensity *= 0.88;
      }
      this.camera.position.lerp(desiredCamPos, 0.14);
      const lookAhead = this.shipGroup.position.clone().add(forward.multiplyScalar(18));
      this.camera.lookAt(lookAhead);
    } else {
      // ORBIT / WARP Mode
      this.shipGroup.position.lerp(this.targetPos, this.isWarping ? 0.12 : 0.05);
      this.shipGroup.lookAt(this.targetPos);

      const camOffset = new THREE.Vector3(0, 6.5, 16);
      this.camera.position.lerp(this.shipGroup.position.clone().add(camOffset), 0.08);
      this.camera.lookAt(this.shipGroup.position);
    }

    // Animate thruster flames
    const flameScale =
      this.isWarping || isBoosting || this.flightMode === 'AI_AUTOPILOT'
        ? 2.2 + Math.sin(Date.now() * 0.03) * 0.4
        : Math.max(0.5, Math.abs(this.currentSpeed) * 0.8 + 0.55 + Math.sin(Date.now() * 0.015) * 0.15);
    for (const flame of this.thrusterFlames) {
      flame.scale.set(1, flameScale, 1);
    }

    for (const [, pGroup] of this.planetMeshes) {
      pGroup.rotation.y += 0.0025;
    }

    if (targetPlanet && this.navLine && this.targetBeacon) {
      const pVec = new THREE.Vector3(targetPlanet.x, targetPlanet.y, targetPlanet.z);
      const posAttr = this.navLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, this.shipGroup.position.x, this.shipGroup.position.y - 0.5, this.shipGroup.position.z);
      posAttr.setXYZ(1, pVec.x, pVec.y, pVec.z);
      posAttr.needsUpdate = true;
      this.navLine.computeLineDistances();
      this.navLine.visible = true;

      this.targetBeacon.position.copy(pVec);
      const s = targetPlanet.radius * 0.25 + Math.sin(Date.now() * 0.005) * 0.15;
      this.targetBeacon.scale.set(s, s, s);
      this.targetBeacon.visible = true;
    }

    if (this.onTelemetry && now - this.lastTelemetryTime > 120 && this.planetsData.length > 0) {
      this.lastTelemetryTime = now;
      let nearest = this.planetsData[0];
      let minDist = Infinity;

      for (const p of this.planetsData) {
        const dx = p.x - this.shipGroup.position.x;
        const dy = p.y - this.shipGroup.position.y;
        const dz = p.z - this.shipGroup.position.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      }

      let targetDist = 0;
      if (targetPlanet) {
        const tdx = targetPlanet.x - this.shipGroup.position.x;
        const tdy = targetPlanet.y - this.shipGroup.position.y;
        const tdz = targetPlanet.z - this.shipGroup.position.z;
        targetDist = Math.round(Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz));
      }

      const dockThreshold = nearest.radius * 4.2 + 24;
      this.onTelemetry({
        x: Math.round(this.shipGroup.position.x),
        y: Math.round(this.shipGroup.position.y),
        z: Math.round(this.shipGroup.position.z),
        speed: Math.round(Math.abs(this.currentSpeed) * 180),
        isBoosting,
        nearestPlanetId: nearest.id,
        nearestPlanetName: nearest.name_ko,
        nearestPlanetSector: nearest.sector,
        nearestDistance: Math.round(minDist),
        canDock: minDist <= dockThreshold,
        targetPlanetId: targetPlanet?.id || null,
        targetDistance: targetDist,
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    window.removeEventListener('resize', this.boundResize);
    this.renderer.dispose();
  }
}
