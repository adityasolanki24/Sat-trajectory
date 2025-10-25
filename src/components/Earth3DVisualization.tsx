import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type LiveSat = { id: string; name: string; lat: number; lon: number; altKm: number; color?: string };

export function Earth3DVisualization({ liveSatellites = [] as LiveSat[], orbitPaths = [] as { id: string; path: { lat: number; lon: number; altKm: number }[]; color?: string }[], links = [] as { id: string; a: LiveSat; b: LiveSat; color?: string }[], autoRotate = false }: { liveSatellites?: LiveSat[]; orbitPaths?: { id: string; path: { lat: number; lon: number; altKm: number }[]; color?: string }[]; links?: { id: string; a: LiveSat; b: LiveSat; color?: string }[]; autoRotate?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // WebGL support check
    try {
      const test = document.createElement('canvas');
      const ok = !!(window.WebGLRenderingContext && (test.getContext('webgl') || test.getContext('experimental-webgl')));
      if (!ok) {
        container.innerText = 'WebGL not supported';
        return;
      }
    } catch {
      container.innerText = 'WebGL not supported';
      return;
    }

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.015);
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000011, 1);
    container.appendChild(renderer.domElement);

    // Earth mesh with textures
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = 'anonymous';
    const earthMap = texLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
    const earthSpec = texLoader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg');
    const material = new THREE.MeshPhongMaterial({
      map: earthMap,
      specularMap: earthSpec,
      specular: new THREE.Color(0x333333),
      shininess: 15
    });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // Clouds layer for depth
    const cloudsGeo = new THREE.SphereGeometry(1.01, 64, 64);
    const cloudsMap = texLoader.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png');
    const cloudsMat = new THREE.MeshLambertMaterial({ map: cloudsMap, transparent: true, opacity: 0.5 });
    const clouds = new THREE.Mesh(cloudsGeo, cloudsMat);
    scene.add(clouds);

    // Debug overlay (DOM)
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.top = '6px';
    label.style.left = '6px';
    label.style.padding = '2px 4px';
    label.style.fontSize = '10px';
    label.style.background = 'rgba(0,0,0,0.5)';
    label.style.color = '#fff';
    label.style.borderRadius = '3px';
    label.textContent = '3D: Earth + orbit + controls';
    container.style.position = 'relative';
    container.appendChild(label);

    // Satellites group
    const satGroup = new THREE.Group();
    scene.add(satGroup);
    satGroupRef.current = satGroup;

    // Lights (basic)
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 5, 5);
    scene.add(dir);

    // Controls for actual 3D interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 10;

    // Stars background
    const starCount = 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 40 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    let raf = 0;
    const animate = () => {
      if (autoRotate) {
        earth.rotation.y += 0.005;
        clouds.rotation.y += 0.007;
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      cloudsGeo.dispose();
      cloudsMat.dispose();
      starGeom.dispose();
      starMat.dispose();
      if (satGroupRef.current) {
        satGroupRef.current.traverse(obj => {
          if ((obj as any).geometry) (obj as any).geometry.dispose?.();
          if ((obj as any).material) (obj as any).material.dispose?.();
        });
      }
      renderer.dispose();
      controls.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      if (label.parentNode === container) container.removeChild(label);
    };
  }, []);

  // Update satellites/paths/links when inputs change
  useEffect(() => {
    const group = satGroupRef.current;
    if (!group) return;
    // Clear old
    while (group.children.length) {
      const child = group.children.pop() as any;
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) child.material.dispose?.();
      child.parent?.remove(child);
    }
    if (!liveSatellites || liveSatellites.length === 0) return;
    // Convert each sat lat/lon/altKm to scene coords (Earth radius=1)
    const R = 6371; // km
    liveSatellites.forEach(s => {
      const lat = THREE.MathUtils.degToRad(s.lat);
      const lon = THREE.MathUtils.degToRad(s.lon);
      const r = 1 + Math.max(0, s.altKm) / R;
      const x = r * Math.cos(lat) * Math.cos(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.sin(lon);
      const geom = new THREE.SphereGeometry(0.05, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: s.color || 0xffd700 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.userData = { id: s.id, name: s.name };
      group.add(mesh);
    });

    // Render orbit polylines
    orbitPaths.forEach(p => {
      if (!p.path || p.path.length < 2) return
      const R = 6371
      const positions: number[] = []
      p.path.forEach(pt => {
        const lat = THREE.MathUtils.degToRad(pt.lat)
        const lon = THREE.MathUtils.degToRad(pt.lon)
        const r = 1 + Math.max(0, pt.altKm) / R
        const x = r * Math.cos(lat) * Math.cos(lon)
        const y = r * Math.sin(lat)
        const z = r * Math.cos(lat) * Math.sin(lon)
        positions.push(x, y, z)
      })
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      const mat = new THREE.LineBasicMaterial({ color: p.color || 0x64b5f6, transparent: true, opacity: 0.8 })
      const line = new THREE.Line(geom, mat)
      group.add(line)
    })

    // Render conjunction link lines
    links.forEach(link => {
      const R = 6371
      const a = link.a, b = link.b
      const aLat = THREE.MathUtils.degToRad(a.lat), aLon = THREE.MathUtils.degToRad(a.lon)
      const bLat = THREE.MathUtils.degToRad(b.lat), bLon = THREE.MathUtils.degToRad(b.lon)
      const ar = 1 + Math.max(0, a.altKm) / R
      const br = 1 + Math.max(0, b.altKm) / R
      const ax = ar * Math.cos(aLat) * Math.cos(aLon)
      const ay = ar * Math.sin(aLat)
      const az = ar * Math.cos(aLat) * Math.sin(aLon)
      const bx = br * Math.cos(bLat) * Math.cos(bLon)
      const by = br * Math.sin(bLat)
      const bz = br * Math.cos(bLat) * Math.sin(bLon)
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute([ax, ay, az, bx, by, bz], 3))
      const mat = new THREE.LineBasicMaterial({ color: link.color || 0xef4444, transparent: true, opacity: 0.9 })
      const line = new THREE.Line(geom, mat)
      group.add(line)
    })
  }, [liveSatellites, orbitPaths, links]);

  return <div ref={containerRef} style={{ width: '100%', height: '400px', background: '#000011', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }} />;
}
