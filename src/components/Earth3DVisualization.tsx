import { useEffect, useRef } from 'react';
// ECI conversion helpers (match SatMap style)
export const eciToThreeJS = (eci: { x: number; y: number; z: number }, scale: number) =>
  new THREE.Vector3(eci.x * scale, eci.z * scale, -eci.y * scale);
export const eciVecToThreeJSVec = (eci: { x: number; y: number; z: number }) =>
  new THREE.Vector3(eci.x, eci.z, -eci.y).normalize();
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type LiveSat = { id: string; name: string; lat: number; lon: number; altKm: number; color?: string };
type LiveSatEci = { id: string; name: string; eci: { x: number; y: number; z: number }; altKm: number; color?: string };

type OrbitPath = { id: string; path: { lat: number; lon: number; altKm: number }[]; color?: string }
type OrbitPathEci = { id: string; points: { x: number; y: number; z: number }[]; color?: string }

type Link = { id: string; a: LiveSat; b: LiveSat; color?: string }

type AffectedArea = { latThresholdDeg: number; color?: number; opacity?: number }

type ConjunctionPoint = { lat: number; lon: number; altKm: number; tca: string }

export function Earth3DVisualization({ liveSatellites = [] as LiveSat[], orbitPaths = [] as OrbitPath[], links = [] as Link[], autoRotate = false, onSelectSatellite, affectedArea, conjunctionPoint }: { liveSatellites?: LiveSat[]; orbitPaths?: OrbitPath[]; links?: Link[]; autoRotate?: boolean; onSelectSatellite?: (id: string) => void; affectedArea?: AffectedArea; conjunctionPoint?: ConjunctionPoint | null; eciLiveSatellites?: LiveSatEci[]; eciOrbitTrails?: OrbitPathEci[]; gmstRad?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const satMeshGroupRef = useRef<THREE.Group | null>(null);
  const orbitGroupRef = useRef<THREE.Group | null>(null);
  const linkGroupRef = useRef<THREE.Group | null>(null);
  const areaGroupRef = useRef<THREE.Group | null>(null);
  const conjunctionGroupRef = useRef<THREE.Group | null>(null);
  const onSelectRef = useRef<typeof onSelectSatellite>();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  onSelectRef.current = onSelectSatellite;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const test = document.createElement('canvas');
      const ok = !!(window.WebGLRenderingContext && (test.getContext('webgl') || test.getContext('experimental-webgl')));
      if (!ok) { container.innerText = 'WebGL not supported'; return; }
    } catch { container.innerText = 'WebGL not supported'; return; }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.015);
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000011, 1);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = 'anonymous';
    // Use the SAME equirectangular map as the 2D view for perfect alignment
    const mapUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Equirectangular_projection_SW.jpg/2048px-Equirectangular_projection_SW.jpg';
    const earthMap = texLoader.load(mapUrl);
    const material = new THREE.MeshPhongMaterial({ map: earthMap, specular: new THREE.Color(0x222222), shininess: 10 });
    const earth = new THREE.Mesh(geometry, material);
    earth.renderOrder = 0;
    // Keep sphere aligned; any constant offset can be tuned here if needed
    earth.rotation.y = 0;
    scene.add(earth);

    // Optional clouds removed to avoid any visual rotation ambiguity vs 2D map

    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.top = '6px';
    label.style.left = '6px';
    label.style.padding = '4px 8px';
    label.style.fontSize = '11px';
    label.style.background = 'rgba(0,0,0,0.7)';
    label.style.color = '#fff';
    label.style.borderRadius = '4px';
    label.style.pointerEvents = 'none';
    label.innerHTML = '🖱️ Drag to rotate • Scroll to zoom<br/>💥 <span style="color: #ff0066">Pink marker</span> = Conjunction point';
    container.style.position = 'relative';
    container.appendChild(label);

    const satMeshGroup = new THREE.Group();
    const orbitGroup = new THREE.Group();
    const linkGroup = new THREE.Group();
    const areaGroup = new THREE.Group();
    const conjunctionGroup = new THREE.Group();
    scene.add(orbitGroup);
    scene.add(linkGroup);
    scene.add(areaGroup);
    scene.add(satMeshGroup);
    scene.add(conjunctionGroup);
    satMeshGroupRef.current = satMeshGroup;
    orbitGroupRef.current = orbitGroup;
    linkGroupRef.current = linkGroup;
    areaGroupRef.current = areaGroup;
    conjunctionGroupRef.current = conjunctionGroup;
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 5, 5);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 10;

    const starCount = 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 40 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      starPositions[i * 3] = x; starPositions[i * 3 + 1] = y; starPositions[i * 3 + 2] = z;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, depthWrite: false });
    const stars = new THREE.Points(starGeom, starMat);
    stars.renderOrder = 1;
    scene.add(stars);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (event: MouseEvent) => {
      if (!satMeshGroupRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(satMeshGroupRef.current.children, false);
      if (intersects.length > 0) {
        for (const hit of intersects) {
          const obj = hit.object as any;
          const id = obj?.userData?.id;
          if (id && onSelectRef.current) { onSelectRef.current(id); break; }
        }
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    let raf = 0;
    const animate = () => {
      // Rotate Earth by -GMST(simTime) so ECI orbits stay fixed
      earth.rotation.y = -gmstRad;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', onClick);
      geometry.dispose(); material.dispose();
      starGeom.dispose(); starMat.dispose();
      ;[satMeshGroupRef.current, orbitGroupRef.current, linkGroupRef.current, areaGroupRef.current].forEach(grp => {
        if (grp) {
          grp.traverse(obj => { if ((obj as any).geometry) (obj as any).geometry.dispose?.(); if ((obj as any).material) (obj as any).material.dispose?.(); })
        }
      })
      renderer.dispose(); controls.dispose();
      if (renderer.domElement.parentNode === container) { container.removeChild(renderer.domElement); }
      if (label.parentNode === container) container.removeChild(label);
    };
  }, [autoRotate]);

  // Render content
  useEffect(() => {
    const satGroup = satMeshGroupRef.current;
    const orbitGroup = orbitGroupRef.current;
    const linkGroup = linkGroupRef.current;
    const areaGroup = areaGroupRef.current;
    if (!satGroup || !orbitGroup || !linkGroup || !areaGroup) return;

    // Clear previous
    ;[satGroup, orbitGroup, linkGroup, areaGroup].forEach(group => {
    while (group.children.length) {
      const child = group.children.pop() as any;
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) child.material.dispose?.();
      child.parent?.remove(child);
    }
    })

    const R = 6371; // km
    // Satellites (fallback geodetic -> 3D). Can be overridden by ECI props in future.
    liveSatellites.forEach(s => {
      const lat = THREE.MathUtils.degToRad(s.lat);
      const lon = THREE.MathUtils.degToRad(s.lon);
      const r = 1 + Math.max(0, s.altKm) / R;
      // Standard mapping: +Z at lon=0°, +X at lon=90°E, +Y north
      const x = r * Math.cos(lat) * Math.sin(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.cos(lon);
      const geom = new THREE.SphereGeometry(0.065, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: s.color || 0xffd700 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.userData = { id: s.id, name: s.name, type: 'sat' };
      satGroup.add(mesh);
    });

    // Orbits
    orbitPaths.forEach(p => {
      if (!p.path || p.path.length < 2) return
      const positions: number[] = []
      p.path.forEach(pt => {
        const lat = THREE.MathUtils.degToRad(pt.lat)
        const lon = THREE.MathUtils.degToRad(pt.lon)
        const r = 1 + Math.max(0, pt.altKm) / R
        const x = r * Math.cos(lat) * Math.sin(lon)
        const y = r * Math.sin(lat)
        const z = r * Math.cos(lat) * Math.cos(lon)
        positions.push(x, y, z)
      })
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      const mat = new THREE.LineBasicMaterial({ color: p.color || 0x64b5f6, transparent: true, opacity: 0.85, depthWrite: false })
      const line = new THREE.Line(geom, mat)
      orbitGroup.add(line)
    })

    // Links
    links.forEach(link => {
      const a = link.a, b = link.b
      const aLat = THREE.MathUtils.degToRad(a.lat), aLon = THREE.MathUtils.degToRad(a.lon)
      const bLat = THREE.MathUtils.degToRad(b.lat), bLon = THREE.MathUtils.degToRad(b.lon)
      const ar = 1 + Math.max(0, a.altKm) / R
      const br = 1 + Math.max(0, b.altKm) / R
      // Standard Three.js spherical coordinates
      const ax = ar * Math.cos(aLat) * Math.sin(aLon)
      const ay = ar * Math.sin(aLat)
      const az = ar * Math.cos(aLat) * Math.cos(aLon)
      const bx = br * Math.cos(bLat) * Math.sin(bLon)
      const by = br * Math.sin(bLat)
      const bz = br * Math.cos(bLat) * Math.cos(bLon)
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute([ax, ay, az, bx, by, bz], 3))
      const mat = new THREE.LineBasicMaterial({ color: link.color || 0xef4444, transparent: true, opacity: 0.95, depthWrite: false })
      const line = new THREE.Line(geom, mat)
      linkGroup.add(line)
    })

    // Affected area bands (auroral caps)
    if (affectedArea && affectedArea.latThresholdDeg > 0 && affectedArea.latThresholdDeg < 90) {
      const lat0 = affectedArea.latThresholdDeg
      const color = affectedArea.color ?? 0xff0000
      const opacity = affectedArea.opacity ?? 0.18
      const buildCap = (latDeg: number, north: boolean) => {
        const lat1 = THREE.MathUtils.degToRad((north ? +1 : -1) * latDeg)
        const lat2 = THREE.MathUtils.degToRad((north ? +1 : -1) * 89.5)
        const segments = 180
        const positions: number[] = []
        for (let i = 0; i < segments; i++) {
          const lon1 = THREE.MathUtils.degToRad((i / segments) * 360)
          const lon2 = THREE.MathUtils.degToRad(((i + 1) / segments) * 360)
          const pts = (lat: number, lon: number) => {
            const r = 1
            // Standard Three.js spherical coordinates
          const x = r * Math.cos(lat) * Math.sin(lon)
          const y = r * Math.sin(lat)
          const z = r * Math.cos(lat) * Math.cos(lon)
            return [x, y, z] as [number, number, number]
          }
          const [x1,y1,z1] = pts(lat1, lon1)
          const [x2,y2,z2] = pts(lat1, lon2)
          const [x3,y3,z3] = pts(lat2, lon1)
          const [x4,y4,z4] = pts(lat2, lon2)
          // tri 1: 1-3-2, tri 2: 2-3-4
          positions.push(x1,y1,z1, x3,y3,z3, x2,y2,z2)
          positions.push(x2,y2,z2, x3,y3,z3, x4,y4,z4)
        }
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geom.computeVertexNormals()
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
        const mesh = new THREE.Mesh(geom, mat)
        areaGroup.add(mesh)
      }
      buildCap(lat0, true)
      buildCap(lat0, false)
    }
  }, [liveSatellites, orbitPaths, links, affectedArea]);

  // Render conjunction point marker
  useEffect(() => {
    const conjGroup = conjunctionGroupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!conjGroup) return;
    
    // Clear existing markers
    while (conjGroup.children.length > 0) {
      const child = conjGroup.children[0];
      conjGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }
    
    if (!conjunctionPoint) return;
    
    const { lat, lon, altKm } = conjunctionPoint;
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon);
    const r = 1 + altKm / 6371;
    
    // Standard Three.js spherical coordinates
    const x = r * Math.cos(latRad) * Math.sin(lonRad);
    const y = r * Math.sin(latRad);
    const z = r * Math.cos(latRad) * Math.cos(lonRad);
    
    // Create small, simple marker at conjunction point
    const markerGeom = new THREE.SphereGeometry(0.015, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ 
      color: 0xff0066, // Bright pink
      transparent: true, 
      opacity: 1.0,
      depthWrite: false 
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(x, y, z);
    conjGroup.add(marker);
    
    // Zoom camera to conjunction point
    if (camera && controls) {
      const targetPos = new THREE.Vector3(x, y, z);
      const distance = 2.5; // Distance from conjunction point
      const direction = targetPos.clone().normalize();
      camera.position.copy(direction.multiplyScalar(distance));
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [conjunctionPoint]);

  return <div ref={containerRef} style={{ width: '100%', height: '400px', background: '#000011', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }} />;
}
