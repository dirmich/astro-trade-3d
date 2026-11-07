/**
 * Realistic Three.js Space, Procedural Planet, Asteroid Belt & Multi-Mesh Spaceship Engine
 * (`frontend/src/lib/three/SpaceScene.ts`)
 */
import * as THREE from 'three';

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

export class SpaceEngine3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private shipGroup: THREE.Group;
  private thrusterFlames: THREE.Mesh[] = [];
  private miningBeam: THREE.Line | null = null;
  private planetMeshes: Map<string, THREE.Group> = new Map();
  private starField!: THREE.Points;
  private targetPos = new THREE.Vector3(90, 0, 0);
  private isWarping = false;
  private onPlanetSelect: (planetId: string) => void;
  private frameId = 0;

  constructor(container: HTMLElement, onPlanetSelect: (planetId: string) => void) {
    this.container = container;
    this.onPlanetSelect = onPlanetSelect;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020617, 0.00045);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      6000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.initLightsAndSun();
    this.initStarfield(6000);
    this.shipGroup = this.buildRealisticSpaceship();
    this.scene.add(this.shipGroup);

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  private initLightsAndSun() {
    const ambient = new THREE.AmbientLight(0x1e293b, 1.3);
    this.scene.add(ambient);

    const sunLight = new THREE.PointLight(0xfff7ed, 3.2, 4500, 0.5);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);

    // Central Helios Star & Corona
    const sunGeo = new THREE.SphereGeometry(28, 48, 48);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(sunMesh);

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
      const r = 450 + Math.random() * 2400;
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

  private buildRealisticSpaceship(): THREE.Group {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.82, roughness: 0.28 });
    const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.4 });
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      metalness: 0.95,
      roughness: 0.1,
    });
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 });

    // Main Fuselage
    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(1.3, 6.2, 8), hullMat);
    fuselage.rotation.x = Math.PI / 2;
    group.add(fuselage);

    // Cockpit Canopy
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), cockpitMat);
    canopy.scale.set(0.85, 0.55, 1.8);
    canopy.position.set(0, 0.55, -0.8);
    group.add(canopy);

    // Swept Delta Wings
    const wingGeo = new THREE.BoxGeometry(5.8, 0.18, 2.2);
    const wings = new THREE.Mesh(wingGeo, darkTrimMat);
    wings.position.set(0, -0.1, 0.8);
    group.add(wings);

    // Twin Warp Nacelles & Ion Thrusters
    for (const side of [-1, 1]) {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 3.6, 12), hullMat);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(side * 2.2, 0.05, 1.1);
      group.add(nacelle);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.1, 12), thrusterMat);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(side * 2.2, 0.05, 3.6);
      this.thrusterFlames.push(flame);
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

      // Atmosphere Halo
      const atmoMat = new THREE.MeshBasicMaterial({
        color: p.atmosphere_color,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.16, 28, 28), atmoMat));

      // Planetary Rings
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
    this.isWarping = true;
    this.targetPos.set(planet.x + planet.radius * 2.2, planet.y + 2, planet.z + planet.radius * 2.2);
    setTimeout(() => {
      this.isWarping = false;
    }, 900);
  }

  private onResize() {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private animate() {
    this.frameId = requestAnimationFrame(() => this.animate());

    // Smooth ship movement toward current planet orbit
    this.shipGroup.position.lerp(this.targetPos, this.isWarping ? 0.12 : 0.05);
    this.shipGroup.lookAt(this.targetPos);

    for (const [, pGroup] of this.planetMeshes) {
      pGroup.rotation.y += 0.0025;
    }

    const camOffset = new THREE.Vector3(0, 6.5, 16);
    this.camera.position.lerp(this.shipGroup.position.clone().add(camOffset), 0.08);
    this.camera.lookAt(this.shipGroup.position);

    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    cancelAnimationFrame(this.frameId);
    this.renderer.dispose();
  }
}
