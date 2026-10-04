import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const Interactive3DBackground: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.0018);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 85;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 1. Particle Constellation
    const particleCount = 1400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const palette = [
      new THREE.Color(0xd97706), // Gold / Amber
      new THREE.Color(0x38bdf8), // Light Cyan / Sky
      new THREE.Color(0x10b981), // Emerald
      new THREE.Color(0x818cf8), // Indigo
      new THREE.Color(0xfef3c7), // Warm white
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 260;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle texture canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.3, 'rgba(251,191,36,0.8)');
      grad.addColorStop(0.8, 'rgba(56,189,248,0.2)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    const particleTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 2. Central Floating 3D Geometric Ring (Iraqi Federal Emblem Ring)
    const ringGeom = new THREE.TorusGeometry(32, 0.45, 16, 120);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    scene.add(ring);

    // Outer counter-rotating ring
    const outerRingGeom = new THREE.TorusGeometry(48, 0.25, 12, 100);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    });
    const outerRing = new THREE.Mesh(outerRingGeom, outerRingMat);
    scene.add(outerRing);

    // 3. Subtle floating golden geodesic sphere
    const sphereGeom = new THREE.IcosahedronGeometry(20, 2);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    scene.add(sphere);

    // Mouse Tracking Physics
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      mouseX = (e.clientX - halfW) * 0.05;
      mouseY = (e.clientY - halfH) * 0.05;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const halfW = window.innerWidth / 2;
        const halfH = window.innerHeight / 2;
        mouseX = (touch.clientX - halfW) * 0.05;
        mouseY = (touch.clientY - halfH) * 0.05;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Window Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Damped camera tracking
      targetX += (mouseX - targetX) * 0.04;
      targetY += (mouseY - targetY) * 0.04;

      camera.position.x = targetX * 0.6;
      camera.position.y = -targetY * 0.6;
      camera.lookAt(scene.position);

      // Rotate geometric elements
      particles.rotation.y = elapsedTime * 0.035;
      particles.rotation.x = Math.sin(elapsedTime * 0.02) * 0.08;

      ring.rotation.x = elapsedTime * 0.12;
      ring.rotation.y = elapsedTime * 0.18;

      outerRing.rotation.x = -elapsedTime * 0.08;
      outerRing.rotation.y = -elapsedTime * 0.14;

      sphere.rotation.y = elapsedTime * 0.05;
      sphere.rotation.z = elapsedTime * 0.03;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      outerRingGeom.dispose();
      outerRingMat.dispose();
      sphereGeom.dispose();
      sphereMat.dispose();
      particleTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 40%, rgba(15, 23, 42, 0.75) 0%, rgba(2, 6, 23, 0.98) 100%)'
      }}
    />
  );
};
