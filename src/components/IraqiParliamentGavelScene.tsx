import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { playParliamentGavelStrikeSound } from '../utils/audio';

// Texture generators for 100% procedural, zero-404 visual realism
const createMahoganyWoodTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base rich dark mahogany gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#2d130a');
    grad.addColorStop(0.3, '#3e1b0f');
    grad.addColorStop(0.6, '#260e06');
    grad.addColorStop(1, '#1b0903');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle wood grain streaks
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(80, 35, 18, 0.25)' : 'rgba(15, 6, 3, 0.3)';
      const y = Math.random() * 512;
      const h = 2 + Math.random() * 5;
      ctx.beginPath();
      ctx.ellipse(256, y, 260 + Math.random() * 40, h, (Math.random() - 0.5) * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine organic wood grain lines
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + Math.sin(x * 0.05) * 12, 170,
        x - Math.cos(x * 0.04) * 10, 340,
        x, 512
      );
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

const createGoldOrnamentTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Polished brass/gold background
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(0.25, '#d97706');
    grad.addColorStop(0.5, '#fef08a');
    grad.addColorStop(0.75, '#b45309');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Embossed geometric Islamic / Mesopotamian star borders
    ctx.strokeStyle = 'rgba(77, 34, 4, 0.4)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 512; i += 40) {
      ctx.strokeRect(i, 0, 30, 512);
      ctx.beginPath();
      ctx.arc(i + 15, 256, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Golden specular highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, 120, 512, 40);
    ctx.fillRect(0, 350, 512, 30);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const createParliamentEmblemTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);

    // Golden outer decorative ring
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(256, 256, 230, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 256, 210, 0, Math.PI * 2);
    ctx.stroke();

    // Central Golden Shield
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.arc(256, 256, 185, 0, Math.PI * 2);
    ctx.fill();

    // Eagle of Saladin silhouette in gold
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(256, 150, 24, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.beginPath();
    ctx.moveTo(256, 170);
    ctx.quadraticCurveTo(150, 190, 110, 260);
    ctx.quadraticCurveTo(170, 270, 210, 240);
    ctx.lineTo(256, 320);
    ctx.lineTo(302, 240);
    ctx.quadraticCurveTo(342, 270, 402, 260);
    ctx.quadraticCurveTo(362, 190, 256, 170);
    ctx.fill();

    // Shield on breast (Tricolor)
    ctx.fillStyle = '#dc2626'; // Red
    ctx.fillRect(226, 235, 60, 18);
    ctx.fillStyle = '#ffffff'; // White
    ctx.fillRect(226, 253, 60, 18);
    ctx.fillStyle = '#0f172a'; // Black
    ctx.fillRect(226, 271, 60, 18);

    // Kufic green script placeholder "الله أكبر"
    ctx.fillStyle = '#16a34a';
    ctx.font = 'bold 13px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('الله أكبر', 256, 266);

    // Arabic Title Ring: جمهورية العراق - مجلس النواب
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 24px "Cairo", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('جمهورية العراق', 256, 110);
    ctx.fillText('مجلس النواب العراقي', 256, 405);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

interface IraqiParliamentGavelSceneProps {
  onStrikeGavel?: () => void;
  isCinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
}

export const IraqiParliamentGavelScene: React.FC<IraqiParliamentGavelSceneProps> = ({
  onStrikeGavel,
  isCinemaMode = false,
  onToggleCinemaMode
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const chapterNameRef = useRef<HTMLSpanElement>(null);

  // High-level UI state (kept minimal to avoid unnecessary re-renders)
  const [isPlaying, setIsPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState<'cinematic' | 'gavel' | 'podium' | 'free'>('cinematic');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [strikeCount, setStrikeCount] = useState(0);
  const [isStrikingState, setIsStrikingState] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5>(1);
  const [isEcoMode, setIsEcoMode] = useState(false);

  // Control refs for the Three.js tick loop without rebuilding the scene
  const cameraModeRef = useRef<'cinematic' | 'gavel' | 'podium' | 'free'>('cinematic');
  const isPlayingRef = useRef(true);
  const soundEnabledRef = useRef(true);
  const playbackSpeedRef = useRef<number>(1);
  const isEcoModeRef = useRef(false);
  const tourTimeRef = useRef<number>(0);
  const seekTargetRef = useRef<number | null>(null);
  const onStrikeCallbackRef = useRef(onStrikeGavel);
  const requestStrikeRef = useRef<(() => void) | null>(null);

  // Sync state to refs immediately
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    isEcoModeRef.current = isEcoMode;
  }, [isEcoMode]);

  useEffect(() => {
    onStrikeCallbackRef.current = onStrikeGavel;
  }, [onStrikeGavel]);

  // Trigger procedural 3D gavel strike
  const handleTriggerStrike = useCallback(() => {
    if (requestStrikeRef.current) {
      requestStrikeRef.current();
    }
  }, []);

  // Jump to specific chapter in the 15-second cinematic clip
  const handleJumpToChapter = (second: number) => {
    tourTimeRef.current = second;
    seekTargetRef.current = second;
    cameraModeRef.current = 'cinematic';
    setCameraMode('cinematic');
    isPlayingRef.current = true;
    setIsPlaying(true);
  };

  // Interactive timeline scrubbing
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSecond = progress * 15;
    tourTimeRef.current = targetSecond;
    seekTargetRef.current = targetSecond;
  };

  // Setup Three.js Scene ONCE on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect mobile / touch environment for optimized DPR and FOV
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);

    // 1. Safe software WebGL check
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Hardware-accelerated, clamped-DPR WebGLRenderer (Zero lag on mobile & laptops)
    const initialDpr = isSoftwareGl || isEcoModeRef.current
      ? 1
      : isMobile
        ? Math.min(window.devicePixelRatio, 1.2) // Mobile clamped for 60fps
        : Math.min(window.devicePixelRatio, 1.5); // Desktop clamped

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && !isMobile,
      powerPreference: 'high-performance',
      alpha: true,
      stencil: false,
      depth: true
    });

    const getDimensions = () => ({
      width: container.clientWidth || window.innerWidth,
      height: container.clientHeight || window.innerHeight
    });

    const { width: initWidth, height: initHeight } = getDimensions();
    renderer.setSize(initWidth, initHeight);
    renderer.setPixelRatio(initialDpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Shadows enabled only if not software GL and not in eco mode
    renderer.shadowMap.enabled = !isSoftwareGl && !isMobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Scene & Atmospheric Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060b17, 0.015);

    // 4. Studio Environment Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.03).texture;
    pmremGenerator.dispose();

    // 5. Responsive Perspective Camera
    const initialAspect = initWidth / initHeight;
    // On vertical/portrait phones, use a slightly wider FOV so the podium doesn't get cut off
    const initialFov = initialAspect < 1 ? 55 : 42;
    const camera = new THREE.PerspectiveCamera(initialFov, initialAspect, 0.1, 150);
    // Base camera framing
    camera.position.set(0, initialAspect < 1 ? 14 : 11, initialAspect < 1 ? 36 : 28);

    // 6. Procedural Textures & PBR Materials
    const woodTexture = createMahoganyWoodTexture();
    const goldTexture = createGoldOrnamentTexture();
    const emblemTexture = createParliamentEmblemTexture();

    const polishedWoodMat = new THREE.MeshStandardMaterial({
      map: woodTexture,
      roughness: 0.28,
      metalness: 0.12,
      color: 0x3d1708
    });

    const presidentialMahoganyMat = new THREE.MeshStandardMaterial({
      map: woodTexture,
      roughness: 0.35,
      metalness: 0.08,
      color: 0x270d04
    });

    const imperialGoldMat = new THREE.MeshStandardMaterial({
      map: goldTexture,
      roughness: 0.22,
      metalness: 0.88,
      color: 0xffd700
    });

    const brassMat = new THREE.MeshStandardMaterial({
      roughness: 0.25,
      metalness: 0.92,
      color: 0xeab308
    });

    const emblemMat = new THREE.MeshStandardMaterial({
      map: emblemTexture,
      transparent: true,
      roughness: 0.25,
      metalness: 0.85
    });

    // -------------------------------------------------------------
    // BUILD SCENE: 1. Presidential Podium Desk (منصة الرئاسة)
    // -------------------------------------------------------------
    const podiumGroup = new THREE.Group();

    // Desk Top Slab
    const deskTopGeom = new THREE.BoxGeometry(34, 1.5, 20);
    const deskTopMesh = new THREE.Mesh(deskTopGeom, presidentialMahoganyMat);
    deskTopMesh.position.set(0, 0, 0);
    deskTopMesh.receiveShadow = true;
    deskTopMesh.castShadow = true;
    podiumGroup.add(deskTopMesh);

    // Gold Trim Rim
    const deskTrimGeom = new THREE.BoxGeometry(34.4, 0.2, 20.4);
    const deskTrimMesh = new THREE.Mesh(deskTrimGeom, imperialGoldMat);
    deskTrimMesh.position.set(0, 0.65, 0);
    podiumGroup.add(deskTrimMesh);

    // Front Panel
    const frontPanelGeom = new THREE.BoxGeometry(30, 13, 1.2);
    const frontPanelMesh = new THREE.Mesh(frontPanelGeom, presidentialMahoganyMat);
    frontPanelMesh.position.set(0, -6.5, 9.6);
    frontPanelMesh.castShadow = true;
    frontPanelMesh.receiveShadow = true;
    podiumGroup.add(frontPanelMesh);

    // Golden Crest Plaque
    const crestPlaqueGeom = new THREE.CylinderGeometry(4.2, 4.2, 0.3, 36);
    crestPlaqueGeom.rotateX(Math.PI / 2);
    const crestPlaqueMesh = new THREE.Mesh(crestPlaqueGeom, emblemMat);
    crestPlaqueMesh.position.set(0, -5.5, 10.3);
    podiumGroup.add(crestPlaqueMesh);

    const crestRimGeom = new THREE.TorusGeometry(4.3, 0.18, 12, 48);
    const crestRimMesh = new THREE.Mesh(crestRimGeom, imperialGoldMat);
    crestRimMesh.position.set(0, -5.5, 10.3);
    podiumGroup.add(crestRimMesh);

    // Golden Gooseneck Microphones
    const micBaseGeom = new THREE.CylinderGeometry(0.65, 0.85, 0.35, 18);
    const micHeadGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.8, 14);
    micHeadGeom.rotateX(Math.PI / 4);

    // Left Mic
    const micBaseLeft = new THREE.Mesh(micBaseGeom, brassMat);
    micBaseLeft.position.set(-6, 0.9, 2.5);
    podiumGroup.add(micBaseLeft);

    const micLeftCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-6, 1.1, 2.5),
      new THREE.Vector3(-5, 4.2, 1.2),
      new THREE.Vector3(-4.5, 5.8, 0)
    );
    const micNeckLeftMesh = new THREE.Mesh(new THREE.TubeGeometry(micLeftCurve, 14, 0.07, 6, false), brassMat);
    podiumGroup.add(micNeckLeftMesh);

    const micHeadLeft = new THREE.Mesh(micHeadGeom, brassMat);
    micHeadLeft.position.set(-4.5, 5.8, 0);
    podiumGroup.add(micHeadLeft);

    // Right Mic
    const micBaseRight = new THREE.Mesh(micBaseGeom, brassMat);
    micBaseRight.position.set(6, 0.9, 2.5);
    podiumGroup.add(micBaseRight);

    const micRightCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(6, 1.1, 2.5),
      new THREE.Vector3(5, 4.2, 1.2),
      new THREE.Vector3(4.5, 5.8, 0)
    );
    const micNeckRightMesh = new THREE.Mesh(new THREE.TubeGeometry(micRightCurve, 14, 0.07, 6, false), brassMat);
    podiumGroup.add(micNeckRightMesh);

    const micHeadRight = new THREE.Mesh(micHeadGeom, brassMat);
    micHeadRight.position.set(4.5, 5.8, 0);
    podiumGroup.add(micHeadRight);

    // Diplomatic Executive Document Folder
    const folderMesh = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.15, 5),
      new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4 })
    );
    folderMesh.position.set(-7.5, 0.82, -1);
    folderMesh.rotation.y = 0.12;
    podiumGroup.add(folderMesh);

    scene.add(podiumGroup);

    // -------------------------------------------------------------
    // BUILD SCENE: 2. Sound Block (قاعدة المطرقة / Sounding Block)
    // -------------------------------------------------------------
    const soundBlockGroup = new THREE.Group();
    soundBlockGroup.position.set(0, 0.75, -1);

    // Base Tier
    const blockBaseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 5.0, 0.6, 36),
      polishedWoodMat
    );
    blockBaseMesh.castShadow = true;
    blockBaseMesh.receiveShadow = true;
    soundBlockGroup.add(blockBaseMesh);

    // Brass Accent Ring
    const blockRingMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(4.65, 4.65, 0.12, 36),
      imperialGoldMat
    );
    blockRingMesh.position.set(0, 0.32, 0);
    soundBlockGroup.add(blockRingMesh);

    // Upper Striking Tier
    const blockTopMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.5, 0.45, 36),
      polishedWoodMat
    );
    blockTopMesh.position.set(0, 0.58, 0);
    blockTopMesh.castShadow = true;
    blockTopMesh.receiveShadow = true;
    soundBlockGroup.add(blockTopMesh);

    // Inlaid Brass Striking Center Disc
    const strikeDiscMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 2.7, 0.08, 36),
      brassMat
    );
    strikeDiscMesh.position.set(0, 0.82, 0);
    strikeDiscMesh.receiveShadow = true;
    soundBlockGroup.add(strikeDiscMesh);

    // Golden Shockwave Ring (expands outward on impact)
    const shockwaveMesh = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.2, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );
    shockwaveMesh.position.set(0, 0.85, 0);
    soundBlockGroup.add(shockwaveMesh);

    scene.add(soundBlockGroup);

    // -------------------------------------------------------------
    // BUILD SCENE: 3. The 3D Parliament Gavel (مطرقة رئاسة مجلس النواب)
    // -------------------------------------------------------------
    const gavelPivot = new THREE.Group();
    gavelPivot.position.set(0, 2.05, -1);

    const gavelModel = new THREE.Group();

    // A. Double-Headed Mallet Head
    const malletLength = 5.0;
    const malletRadius = 1.05;
    const malletGeom = new THREE.CylinderGeometry(malletRadius, malletRadius, malletLength, 28);
    malletGeom.rotateZ(Math.PI / 2);
    const malletMesh = new THREE.Mesh(malletGeom, polishedWoodMat);
    malletMesh.castShadow = true;
    malletMesh.receiveShadow = true;
    gavelModel.add(malletMesh);

    // Golden Decorative End Caps on both striking faces
    const capGeom = new THREE.CylinderGeometry(malletRadius * 1.04, malletRadius * 1.04, 0.35, 24);
    capGeom.rotateZ(Math.PI / 2);

    const leftCap = new THREE.Mesh(capGeom, imperialGoldMat);
    leftCap.position.set(-malletLength / 2 + 0.15, 0, 0);
    gavelModel.add(leftCap);

    const rightCap = new THREE.Mesh(capGeom, imperialGoldMat);
    rightCap.position.set(malletLength / 2 - 0.15, 0, 0);
    gavelModel.add(rightCap);

    // Central Golden Collar Ring
    const centerCollarGeom = new THREE.CylinderGeometry(malletRadius * 1.06, malletRadius * 1.06, 0.7, 24);
    centerCollarGeom.rotateZ(Math.PI / 2);
    const centerCollar = new THREE.Mesh(centerCollarGeom, imperialGoldMat);
    gavelModel.add(centerCollar);

    // Miniature Iraqi Eagle Emblem medallion on top of mallet center
    const gavelEmblemGeom = new THREE.CylinderGeometry(0.65, 0.65, 0.1, 24);
    const gavelEmblem = new THREE.Mesh(gavelEmblemGeom, emblemMat);
    gavelEmblem.position.set(0, malletRadius + 0.05, 0);
    gavelModel.add(gavelEmblem);

    // B. Turned Mahogany Handle
    const handleLength = 11.5;
    const handleGeom = new THREE.CylinderGeometry(0.38, 0.48, handleLength, 20);
    handleGeom.rotateX(Math.PI / 2);
    const handleMesh = new THREE.Mesh(handleGeom, polishedWoodMat);
    handleMesh.position.set(0, 0, handleLength / 2);
    handleMesh.castShadow = true;
    gavelModel.add(handleMesh);

    // Golden Grip Accent Rings on handle
    for (let i = 0; i < 4; i++) {
      const gripRingGeom = new THREE.CylinderGeometry(0.52, 0.52, 0.18, 18);
      gripRingGeom.rotateX(Math.PI / 2);
      const gripRing = new THREE.Mesh(gripRingGeom, imperialGoldMat);
      gripRing.position.set(0, 0, 5.0 + i * 1.6);
      gavelModel.add(gripRing);
    }

    // Golden Bottom Pommel Finial
    const pommelGeom = new THREE.SphereGeometry(0.75, 18, 14);
    pommelGeom.scale(1, 1, 1.4);
    const pommel = new THREE.Mesh(pommelGeom, imperialGoldMat);
    pommel.position.set(0, 0, handleLength + 0.5);
    gavelModel.add(pommel);

    // Rest gavel resting angle
    gavelModel.rotation.y = 0.28;
    gavelPivot.add(gavelModel);
    scene.add(gavelPivot);

    // -------------------------------------------------------------
    // BUILD SCENE: 4. Grand Parliament Chamber Hall Architecture
    // -------------------------------------------------------------
    const hallGroup = new THREE.Group();

    // Marble acoustic pillars
    const pillarGeom = new THREE.CylinderGeometry(1.4, 1.6, 26, 20);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1a2638,
      roughness: 0.35,
      metalness: 0.15
    });

    const pillarCapitalGeom = new THREE.CylinderGeometry(2.0, 1.5, 1.2, 20);
    const pillarBaseGeom = new THREE.CylinderGeometry(1.8, 2.2, 1.4, 20);

    const pillarPositions = [
      [-19, 9, -15],
      [-19, 9, -5],
      [-19, 9, 6],
      [19, 9, -15],
      [19, 9, -5],
      [19, 9, 6],
    ];

    pillarPositions.forEach(([x, y, z]) => {
      const pMesh = new THREE.Mesh(pillarGeom, pillarMat);
      pMesh.position.set(x, y, z);
      hallGroup.add(pMesh);

      const capMesh = new THREE.Mesh(pillarCapitalGeom, imperialGoldMat);
      capMesh.position.set(x, y + 13, z);
      hallGroup.add(capMesh);

      const baseMesh = new THREE.Mesh(pillarBaseGeom, imperialGoldMat);
      baseMesh.position.set(x, y - 13, z);
      hallGroup.add(baseMesh);
    });

    // Rear Curved Wall of Parliament Chamber
    const wallGeom = new THREE.CylinderGeometry(38, 38, 28, 32, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0a1220,
      roughness: 0.7,
      side: THREE.BackSide
    });
    const wallMesh = new THREE.Mesh(wallGeom, wallMat);
    wallMesh.position.set(0, 9, 0);
    hallGroup.add(wallMesh);

    // Golden Ceiling Halo Dome
    const ceilingHalo = new THREE.Mesh(
      new THREE.TorusGeometry(18, 0.4, 12, 48).rotateX(Math.PI / 2),
      imperialGoldMat
    );
    ceilingHalo.position.set(0, 21, 0);
    hallGroup.add(ceilingHalo);

    scene.add(hallGroup);

    // -------------------------------------------------------------
    // BUILD SCENE: 5. Dynamic Lighting & Golden Volumetric Spark System
    // -------------------------------------------------------------
    const ambLight = new THREE.AmbientLight(0xfff3db, 0.85);
    scene.add(ambLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffeed6, 1.8);
    mainKeyLight.position.set(12, 22, 16);
    if (!isMobile && !isSoftwareGl) {
      mainKeyLight.castShadow = true;
      mainKeyLight.shadow.mapSize.width = 1024;
      mainKeyLight.shadow.mapSize.height = 1024;
      mainKeyLight.shadow.camera.near = 0.5;
      mainKeyLight.shadow.camera.far = 60;
      mainKeyLight.shadow.bias = -0.0005;
    }
    scene.add(mainKeyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-16, 12, -14);
    scene.add(rimLight);

    // Warm golden gavel spotlight
    const gavelSpot = new THREE.SpotLight(0xfbbf24, 2.5, 30, Math.PI / 5, 0.45);
    gavelSpot.position.set(0, 14, 3);
    gavelSpot.target = soundBlockGroup;
    scene.add(gavelSpot);

    // Flash light triggered on gavel impact
    const impactLight = new THREE.PointLight(0xfef08a, 0, 16);
    impactLight.position.set(0, 2.4, -1);
    scene.add(impactLight);

    // Golden particle sparks on strike (budgeted for mobile 60fps)
    const sparkCount = isMobile ? 35 : 70;
    const sparkGeom = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3] = (Math.random() - 0.5) * 0.4;
      sparkPositions[i * 3 + 1] = 1.0;
      sparkPositions[i * 3 + 2] = -1 + (Math.random() - 0.5) * 0.4;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.5;
      sparkVelocities[i * 3] = Math.cos(angle) * speed;
      sparkVelocities[i * 3 + 1] = 3.5 + Math.random() * 5.0; // upward trajectory
      sparkVelocities[i * 3 + 2] = Math.sin(angle) * speed;
    }
    sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: isMobile ? 0.22 : 0.28,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const sparkParticles = new THREE.Points(sparkGeom, sparkMat);
    scene.add(sparkParticles);

    // Gentle floating atmospheric dust motes
    const dustCount = isMobile ? 40 : 80;
    const dustGeom = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 36;
      dustPos[i * 3 + 1] = Math.random() * 18;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.12,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const dustMesh = new THREE.Points(dustGeom, dustMat);
    scene.add(dustMesh);

    // -------------------------------------------------------------
    // GAVEL STRIKE PHYSICS & LOGIC
    // -------------------------------------------------------------
    let strikeState: 'idle' | 'windup' | 'strike_down' | 'rebound' | 'settle' = 'idle';
    let strikeTimer = 0;
    let shockwaveRadius = 2.6;
    let shockwaveOpacity = 0;

    const executeStrike = () => {
      if (strikeState !== 'idle') return;
      strikeState = 'windup';
      strikeTimer = 0;
      setIsStrikingState(true);
      setStrikeCount(prev => prev + 1);

      if (soundEnabledRef.current) {
        setTimeout(() => {
          playParliamentGavelStrikeSound();
        }, 300);
      }
    };

    requestStrikeRef.current = executeStrike;

    // -------------------------------------------------------------
    // TOUCH & MOUSE INTERACTION (Zero lag, responsive on phones & PC)
    // -------------------------------------------------------------
    let pointerX = 0;
    let pointerY = 0;
    let isPointerDown = false;
    let lastTouchX = 0;
    let lastTouchY = 0;

    const onPointerMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      pointerX = (e.clientX - halfW) / halfW;
      pointerY = (e.clientY - halfH) / halfH;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isPointerDown = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaX = (touch.clientX - lastTouchX) / window.innerWidth;
        const deltaY = (touch.clientY - lastTouchY) / window.innerHeight;
        pointerX = Math.max(-1.5, Math.min(1.5, pointerX + deltaX * 2.2));
        pointerY = Math.max(-1.5, Math.min(1.5, pointerY + deltaY * 2.2));
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
      }
    };

    const onTouchEnd = () => {
      isPointerDown = false;
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    // Responsive Resize Handler with FOV adaptation
    const onResize = () => {
      if (!container) return;
      const { width, height } = getDimensions();
      const aspect = width / height;
      camera.aspect = aspect;
      // Adapt FOV for portrait phones vs landscape desktops
      camera.fov = aspect < 1 ? 55 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    // -------------------------------------------------------------
    // 60-FPS ANIMATION LOOP (Decoupled from React State for Zero Lag)
    // -------------------------------------------------------------
    let frameId = 0;
    const clock = new THREE.Clock();
    let lastTimeUpdate = 0;
    let autoStrikeInterval = 0;

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.08);

      // Playback speed scaling
      const speed = playbackSpeedRef.current;
      if (isPlayingRef.current) {
        tourTimeRef.current += delta * speed;
      }

      const totalSec = tourTimeRef.current % 15;
      const progressRatio = totalSec / 15;

      // Update DOM progress bar & time counter directly (NO React setState in loop)
      const now = performance.now();
      if (now - lastTimeUpdate > 60) { // ~16 updates per second for DOM text
        lastTimeUpdate = now;
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${Math.round(progressRatio * 100)}%`;
        }
        if (timeDisplayRef.current) {
          const currentSecInt = Math.floor(totalSec);
          timeDisplayRef.current.textContent = `00:${currentSecInt < 10 ? '0' : ''}${currentSecInt} / 00:15`;
        }
        if (chapterNameRef.current) {
          let name = '🏛️ المشهد 1: نظرة عامة لقاعة مجلس النواب';
          if (totalSec >= 4 && totalSec < 8) {
            name = '⚖️ المشهد 2: التركيز على مطرقة الرئاسة';
          } else if (totalSec >= 8 && totalSec < 11) {
            name = '💥 المشهد 3: لحظة طرق المطرقة وافتتاح الجلسة';
          } else if (totalSec >= 11) {
            name = '🎖️ المشهد 4: منصة الرئاسة والتحضير';
          }
          chapterNameRef.current.textContent = name;
        }
      }

      // Auto-strike once per loop cycle around 8.5 seconds
      autoStrikeInterval += delta * speed;
      if (isPlayingRef.current && autoStrikeInterval > 15) {
        autoStrikeInterval = 0;
        executeStrike();
      }

      const mode = cameraModeRef.current;
      const isPortrait = camera.aspect < 1;

      // 1. Camera Choreography Logic
      if (mode === 'cinematic' && isPlayingRef.current) {
        if (totalSec < 4) {
          // Stage 1: Sweeping wide crane shot
          const t = totalSec / 4;
          const camX = Math.sin(t * 0.5) * (isPortrait ? 8 : 14);
          const camY = (isPortrait ? 15 : 12) - t * 3;
          const camZ = (isPortrait ? 38 : 30) - t * 6;
          camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
          camera.lookAt(0, 1.2, -1);
        } else if (totalSec < 8) {
          // Stage 2: Macro orbit around the gavel
          const t = (totalSec - 4) / 4;
          const angle = -0.3 + t * 0.8;
          const dist = isPortrait ? 13 : 10;
          const camX = Math.sin(angle) * dist;
          const camY = 5.2 + Math.sin(t * Math.PI) * 1.2;
          const camZ = Math.cos(angle) * dist;
          camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
          camera.lookAt(0, 1.6, -1);
        } else if (totalSec < 11) {
          // Stage 3: Close impact angle for the gavel strike
          const camX = (isPortrait ? 3.0 : 4.0) + pointerX * 0.4;
          const camY = 5.8 - pointerY * 0.4;
          const camZ = isPortrait ? 9.5 : 7.8;
          camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
          camera.lookAt(0, 1.4, -1);
        } else {
          // Stage 4: Executive frontal console
          const targetZ = isPortrait ? 26 : 21;
          const targetY = isPortrait ? 9.5 : 7.8;
          camera.position.lerp(new THREE.Vector3(0, targetY, targetZ), 0.06);
          camera.lookAt(0, 1.0, -0.5);
        }
      } else if (mode === 'gavel') {
        const z = isPortrait ? 10.5 : 8.2;
        camera.position.lerp(new THREE.Vector3(3.2, 5.0, z), 0.08);
        camera.lookAt(0, 1.7, -1);
      } else if (mode === 'podium') {
        const z = isPortrait ? 25 : 20;
        camera.position.lerp(new THREE.Vector3(0, 5.5, z), 0.08);
        camera.lookAt(0, 1.0, 0);
      } else {
        // Free interactive mouse/touch orbit
        const targetX = pointerX * (isPortrait ? 8 : 12);
        const targetY = (isPortrait ? 10 : 8) - pointerY * 5;
        const targetZ = isPortrait ? 26 : 21;
        camera.position.lerp(new THREE.Vector3(targetX, Math.max(3.5, targetY), targetZ), 0.08);
        camera.lookAt(0, 1.4, -1);
      }

      // 2. Gavel Strike Physics
      if (strikeState === 'windup') {
        strikeTimer += delta;
        const progress = Math.min(strikeTimer / 0.3, 1);
        const ease = Math.sin((progress * Math.PI) / 2);
        gavelPivot.rotation.x = -ease * 0.88; // Tilt back 50 degrees
        gavelPivot.position.y = 2.05 + ease * 3.6;

        if (progress >= 1) {
          strikeState = 'strike_down';
          strikeTimer = 0;
        }
      } else if (strikeState === 'strike_down') {
        strikeTimer += delta;
        const progress = Math.min(strikeTimer / 0.085, 1);
        const ease = progress * progress * progress; // Acceleration snap
        gavelPivot.rotation.x = -0.88 + ease * 0.88;
        gavelPivot.position.y = 5.65 - ease * 3.6;

        if (progress >= 1) {
          // IMPACT MOMENT!
          strikeState = 'rebound';
          strikeTimer = 0;
          gavelPivot.rotation.x = 0;
          gavelPivot.position.y = 2.05;

          // Shockwave & flash
          shockwaveRadius = 2.6;
          shockwaveOpacity = 1.0;
          impactLight.intensity = 20;

          // Fire sparks
          const posAttr = sparkParticles.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < sparkCount; i++) {
            posAttr.setXYZ(i, (Math.random() - 0.5) * 0.6, 1.1, -1 + (Math.random() - 0.5) * 0.6);
          }
          posAttr.needsUpdate = true;
          (sparkParticles.material as THREE.PointsMaterial).opacity = 0.95;

          if (onStrikeCallbackRef.current) {
            onStrikeCallbackRef.current();
          }
        }
      } else if (strikeState === 'rebound') {
        strikeTimer += delta;
        const progress = Math.min(strikeTimer / 0.12, 1);
        const bounce = Math.sin(progress * Math.PI) * 0.16;
        gavelPivot.rotation.x = -bounce;
        gavelPivot.position.y = 2.05 + bounce * 0.7;

        if (progress >= 1) {
          strikeState = 'settle';
          strikeTimer = 0;
        }
      } else if (strikeState === 'settle') {
        strikeTimer += delta;
        const progress = Math.min(strikeTimer / 0.22, 1);
        gavelPivot.rotation.x = THREE.MathUtils.lerp(gavelPivot.rotation.x, 0, 0.18);
        gavelPivot.position.y = THREE.MathUtils.lerp(gavelPivot.position.y, 2.05, 0.18);

        if (progress >= 1) {
          strikeState = 'idle';
          setIsStrikingState(false);
        }
      }

      // 3. Shockwave expansion
      if (shockwaveOpacity > 0.01) {
        shockwaveRadius += delta * 15;
        shockwaveOpacity = Math.max(0, shockwaveOpacity - delta * 3.4);
        shockwaveMesh.scale.set(shockwaveRadius / 2.6, shockwaveRadius / 2.6, 1);
        (shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = shockwaveOpacity;
      }

      // 4. Flash decay
      if (impactLight.intensity > 0.1) {
        impactLight.intensity = THREE.MathUtils.damp(impactLight.intensity, 0, 14, delta);
      }

      // 5. Update sparks
      const sparkMatRef = sparkParticles.material as THREE.PointsMaterial;
      if (sparkMatRef.opacity > 0.02) {
        sparkMatRef.opacity = THREE.MathUtils.damp(sparkMatRef.opacity, 0, 6, delta);
        const posAttr = sparkParticles.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < sparkCount; i++) {
          posAttr.setXYZ(
            i,
            posAttr.getX(i) + sparkVelocities[i * 3] * delta * 0.45,
            posAttr.getY(i) + sparkVelocities[i * 3 + 1] * delta * 0.45,
            posAttr.getZ(i) + sparkVelocities[i * 3 + 2] * delta * 0.45
          );
        }
        posAttr.needsUpdate = true;
      }

      // 6. Dust slow drift
      dustMesh.rotation.y += delta * 0.02;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    // Initial dramatic gavel strike after 1.5 seconds
    const introTimer = setTimeout(() => {
      executeStrike();
    }, 1500);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(introTimer);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []); // Run ONCE on mount

  return (
    <div className="relative w-full h-full select-none overflow-hidden touch-none" dir="rtl">
      {/* 3D WebGL Canvas Container */}
      <div 
        ref={mountRef} 
        onClick={handleTriggerStrike}
        title="انقر في أي مكان لطرق مطرقة رئاسة مجلس النواب ⚖️"
        className="absolute inset-0 cursor-pointer active:cursor-grabbing"
      />

      {/* Floating Cinematic Video HUD Bar (Bottom Control Dock - Fully Responsive Mobile & PC) */}
      <div className="absolute bottom-3 inset-x-0 z-30 pointer-events-none flex flex-col items-center justify-end px-2.5 sm:px-4">
        <div className="w-full max-w-3xl pointer-events-auto bg-[#070d1a]/90 backdrop-blur-xl border border-amber-500/35 rounded-2xl p-2 sm:p-3 shadow-2xl space-y-2">
          
          {/* Timeline & Chapter Header */}
          <div className="flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
              <span ref={chapterNameRef} className="font-black text-amber-300 text-[11px] sm:text-xs truncate">
                🏛️ المشهد 1: نظرة عامة لقاعة مجلس النواب
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span ref={timeDisplayRef} className="text-[11px] font-mono text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                00:00 / 00:15
              </span>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-xl border text-[11px] cursor-pointer transition-colors ${
                  soundEnabled 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
                title={soundEnabled ? 'صوت المطرقة مفعل 🔊' : 'صوت المطرقة مكتوم 🔇'}
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>

              {/* Eco / 60FPS Speed Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsEcoMode(!isEcoMode)}
                className={`px-2 py-1 rounded-xl border text-[10px] font-bold cursor-pointer transition-colors ${
                  isEcoMode 
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="تفعيل وضع السرعة الفائقة 60FPS للأجهزة الضعيفة والهواتف"
              >
                {isEcoMode ? '⚡ فائق السرعة' : '💎 جودة عالية'}
              </button>
            </div>
          </div>

          {/* Interactive Clickable & Draggable Video Scrubber Bar */}
          <div 
            onClick={handleTimelineClick}
            className="group relative w-full bg-slate-800/90 h-2 sm:h-2.5 rounded-full overflow-hidden cursor-pointer hover:h-3 transition-all"
            title="انقر في أي مكان لتقديم أو تأخير مقطع الفيديو 3D"
          >
            <div 
              ref={progressBarRef}
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 h-full transition-all duration-75"
              style={{ width: '0%' }}
            />
            {/* Chapter Break Points */}
            <div className="absolute top-0 bottom-0 left-[26.6%] w-0.5 bg-slate-950/60" title="المطرقة (00:04)" />
            <div className="absolute top-0 bottom-0 left-[53.3%] w-0.5 bg-slate-950/60" title="لحظة الطرق (00:08)" />
            <div className="absolute top-0 bottom-0 left-[73.3%] w-0.5 bg-slate-950/60" title="المنصة (00:11)" />
          </div>

          {/* Interactive Player Controls */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
            {/* Left: Playback & Gavel Strike Button */}
            <div className="flex items-center gap-1.5">
              {/* Strike Gavel Button */}
              <button
                type="button"
                disabled={isStrikingState}
                onClick={handleTriggerStrike}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-transform disabled:opacity-50"
              >
                <span>⚖️ طرق المطرقة</span>
                {strikeCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-slate-950/40 text-amber-100 rounded-full text-[10px] font-mono">
                    {strikeCount}
                  </span>
                )}
              </button>

              {/* Play/Pause Video Tour */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title={isPlaying ? 'إيقاف حركة الفيديو مؤقتاً' : 'تشغيل المقطع'}
              >
                <span>{isPlaying ? '❚❚' : '▶'}</span>
                <span className="hidden sm:inline">{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
              </button>

              {/* Speed 1x / 1.5x */}
              <button
                type="button"
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : 1)}
                className="px-2 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                title="سرعة حركة الفيديو 3D"
              >
                {playbackSpeed}x
              </button>
            </div>

            {/* Middle: Fast Chapter Jumping */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => handleJumpToChapter(0)}
                className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                القاعة 🏛️
              </button>
              <button
                type="button"
                onClick={() => handleJumpToChapter(4)}
                className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                المطرقة ⚖️
              </button>
              <button
                type="button"
                onClick={() => {
                  handleJumpToChapter(8);
                  handleTriggerStrike();
                }}
                className="px-2 py-0.5 rounded-lg text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                الضربة 💥
              </button>
              <button
                type="button"
                onClick={() => handleJumpToChapter(11)}
                className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                المنصة 🎖️
              </button>
            </div>

            {/* Camera Perspectives */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-[10px] sm:text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setCameraMode('cinematic');
                  setIsPlaying(true);
                }}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  cameraMode === 'cinematic' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                سينمائي 🎬
              </button>
              <button
                type="button"
                onClick={() => {
                  setCameraMode('gavel');
                  setIsPlaying(false);
                }}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  cameraMode === 'gavel' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                المطرقة ⚖️
              </button>
              <button
                type="button"
                onClick={() => {
                  setCameraMode('free');
                  setIsPlaying(false);
                }}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  cameraMode === 'free' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
                title="تحريك ثلاثي الأبعاد باللمس أو الفأرة"
              >
                حر 🌐
              </button>
            </div>

            {/* Right: Fullscreen Cinema Mode Toggle */}
            {onToggleCinemaMode && (
              <button
                type="button"
                onClick={onToggleCinemaMode}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 text-xs font-bold cursor-pointer transition-colors"
                title="مشاهدة مقطع 3D بدون ظهور كارت الدخول"
              >
                {isCinemaMode ? 'إغلاق ✕' : 'ملء الشاشة 🎥'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
