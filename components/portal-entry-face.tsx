'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { getPortalEntryProfile, type PortalEntryQuality } from '@/lib/portal-entry';

type PortalEntryFaceProps = {
  quality: PortalEntryQuality;
  progress: number;
  onError?: () => void;
};

type PointerSignal = {
  x: number;
  y: number;
  lastSeenAt: number;
};

const CYAN = new THREE.Color('#aef3ff');
const TEAL = new THREE.Color('#54e7c1');
const BLUE = new THREE.Color('#4b9dff');
const ICE = new THREE.Color('#edf9ff');
const DEEP = new THREE.Color('#07101a');
const TAU = Math.PI * 2;

function gaussian2d(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  sigmaX: number,
  sigmaY: number,
) {
  const dx = x - centerX;
  const dy = y - centerY;

  return Math.exp(-((dx * dx) / (2 * sigmaX * sigmaX) + (dy * dy) / (2 * sigmaY * sigmaY)));
}

function faceWidthAt(y: number) {
  const cheekWidth = Math.exp(-((y + 0.02) ** 2) / (2 * 0.22 * 0.22)) * 0.13;
  const browWidth = Math.exp(-((y - 0.34) ** 2) / (2 * 0.18 * 0.18)) * 0.03;
  const jawTaper = Math.exp(-((y + 0.76) ** 2) / (2 * 0.16 * 0.16)) * 0.17;
  const crownTaper = Math.exp(-((y - 0.96) ** 2) / (2 * 0.14 * 0.14)) * 0.11;

  return 0.62 + cheekWidth + browWidth - jawTaper - crownTaper;
}

function faceDepthAt(x: number, y: number): number | null {
  const width = faceWidthAt(y);
  const ellipsoid = 1 - (x * x) / (width * width) - (y * y) / 1.32;
  if (ellipsoid <= 0) {
    return null;
  }

  const base = Math.sqrt(ellipsoid) * 0.82;
  const eyeSockets =
    gaussian2d(x, y, -0.3, 0.19, 0.12, 0.09) * -0.16 +
    gaussian2d(x, y, 0.3, 0.19, 0.12, 0.09) * -0.16;
  const cheekbones =
    gaussian2d(x, y, -0.43, -0.02, 0.16, 0.12) * 0.1 +
    gaussian2d(x, y, 0.43, -0.02, 0.16, 0.12) * 0.1;
  const brow =
    gaussian2d(x, y, -0.28, 0.34, 0.16, 0.07) * 0.075 +
    gaussian2d(x, y, 0.28, 0.34, 0.16, 0.07) * 0.075;
  const temples =
    gaussian2d(x, y, -0.62, 0.35, 0.12, 0.16) * -0.04 +
    gaussian2d(x, y, 0.62, 0.35, 0.12, 0.16) * -0.04;
  const forehead = gaussian2d(x, y, 0, 0.77, 0.42, 0.2) * 0.08;
  const noseBridge = gaussian2d(x, y, 0, 0.02, 0.09, 0.24) * 0.14;
  const noseTip = gaussian2d(x, y, 0, -0.14, 0.08, 0.08) * 0.18;
  const nostrils =
    gaussian2d(x, y, -0.08, -0.2, 0.05, 0.04) * -0.06 +
    gaussian2d(x, y, 0.08, -0.2, 0.05, 0.04) * -0.06;
  const philtrum = gaussian2d(x, y, 0, -0.27, 0.06, 0.06) * 0.05;
  const lips = gaussian2d(x, y, 0, -0.36, 0.24, 0.08) * 0.035;
  const mouthCrease = gaussian2d(x, y, 0, -0.42, 0.24, 0.05) * -0.05;
  const chin = gaussian2d(x, y, 0, -0.77, 0.18, 0.1) * 0.16;
  const jawTightening = Math.max(0, Math.abs(x) - 0.58) * -0.09;

  return Math.max(
    0.08,
    base +
      eyeSockets +
      cheekbones +
      brow +
      temples +
      forehead +
      noseBridge +
      noseTip +
      nostrils +
      philtrum +
      lips +
      mouthCrease +
      chin +
      jawTightening,
  );
}

function createHeadSurfacePoints(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  let cursor = 0;

  while (cursor < count) {
    const x = THREE.MathUtils.randFloatSpread(1.44);
    const y = THREE.MathUtils.randFloat(-1.05, 1.12);
    const z = faceDepthAt(x, y);

    if (z === null) {
      continue;
    }

    const noise = (Math.random() - 0.5) * 0.025;
    positions[cursor * 3] = x;
    positions[cursor * 3 + 1] = y;
    positions[cursor * 3 + 2] = z + noise;
    cursor += 1;
  }

  return positions;
}

function createAmbientPoints(count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const radius = 2.2 + Math.random() * 1.65;
    const theta = Math.random() * TAU;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[index * 3 + 2] = radius * Math.cos(phi);
  }

  return positions;
}

function createEllipseLine(
  center: [number, number, number],
  radiusX: number,
  radiusY: number,
  segments: number,
  startAngle = 0,
  endAngle = TAU,
): Float32Array {
  const points: number[] = [];
  const [centerX, centerY, centerZ] = center;

  for (let index = 0; index <= segments; index += 1) {
    const t = startAngle + ((endAngle - startAngle) * index) / segments;
    points.push(centerX + Math.cos(t) * radiusX, centerY + Math.sin(t) * radiusY, centerZ);
  }

  return new Float32Array(points);
}

function createFrontCurveFromY(y: number, xMin: number, xMax: number, segments: number, zBoost = 0) {
  const points: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const x = THREE.MathUtils.lerp(xMin, xMax, index / segments);
    const z = faceDepthAt(x, y);

    if (z === null) {
      continue;
    }

    points.push(x, y, z + zBoost);
  }

  return new Float32Array(points);
}

function createFrontCurveFromX(x: number, yMin: number, yMax: number, segments: number, zBoost = 0) {
  const points: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const y = THREE.MathUtils.lerp(yMin, yMax, index / segments);
    const z = faceDepthAt(x, y);

    if (z === null) {
      continue;
    }

    points.push(x, y, z + zBoost);
  }

  return new Float32Array(points);
}

function createEarContour(sign: -1 | 1, inner = false) {
  const points: number[] = [];
  const baseX = sign * (inner ? 0.88 : 0.96);
  const radiusX = inner ? 0.11 : 0.17;
  const radiusY = inner ? 0.2 : 0.31;
  const baseZ = inner ? 0.12 : 0.08;

  for (let index = 0; index <= 34; index += 1) {
    const t = THREE.MathUtils.lerp(-Math.PI * 0.58, Math.PI * 0.74, index / 34);
    const x = baseX + Math.cos(t) * radiusX * sign;
    const y = 0.02 + Math.sin(t) * radiusY;
    const z = baseZ + Math.sin(t * 1.8) * 0.05 + (inner ? 0.04 : 0);
    points.push(x, y, z);
  }

  return new Float32Array(points);
}

function createFeaturePoints() {
  const points: number[] = [];

  const append = (buffer: Float32Array) => {
    for (let index = 0; index < buffer.length; index += 3) {
      points.push(buffer[index] ?? 0, buffer[index + 1] ?? 0, buffer[index + 2] ?? 0);
    }
  };

  append(createEllipseLine([-0.32, 0.18, 0.98], 0.12, 0.05, 26));
  append(createEllipseLine([0.32, 0.18, 0.98], 0.12, 0.05, 26));
  append(createEllipseLine([-0.31, 0.34, 0.9], 0.18, 0.05, 22, Math.PI * 0.12, Math.PI * 0.88));
  append(createEllipseLine([0.31, 0.34, 0.9], 0.18, 0.05, 22, Math.PI * 0.12, Math.PI * 0.88));
  append(createFrontCurveFromY(-0.04, -0.58, -0.24, 18, 0.05));
  append(createFrontCurveFromY(-0.04, 0.24, 0.58, 18, 0.05));
  append(createFrontCurveFromY(-0.74, -0.56, 0.56, 40, 0.03));
  append(createFrontCurveFromX(0, 0.18, -0.24, 20, 0.18));
  append(createEllipseLine([0, -0.18, 1.08], 0.08, 0.045, 18, Math.PI * 0.08, Math.PI * 0.92));

  return new Float32Array(points);
}

function createContourBuffers() {
  return [
    { buffer: createEllipseLine([-0.32, 0.18, 0.995], 0.135, 0.058, 32), color: ICE },
    { buffer: createEllipseLine([0.32, 0.18, 0.995], 0.135, 0.058, 32), color: ICE },
    {
      buffer: createEllipseLine([-0.31, 0.35, 0.92], 0.19, 0.05, 24, Math.PI * 0.12, Math.PI * 0.88),
      color: BLUE,
    },
    {
      buffer: createEllipseLine([0.31, 0.35, 0.92], 0.19, 0.05, 24, Math.PI * 0.12, Math.PI * 0.88),
      color: BLUE,
    },
    { buffer: createFrontCurveFromX(0, 0.18, -0.24, 20, 0.2), color: TEAL },
    { buffer: createEllipseLine([0, -0.18, 1.08], 0.09, 0.048, 20, Math.PI * 0.08, Math.PI * 0.92), color: TEAL },
    { buffer: createFrontCurveFromY(-0.75, -0.56, 0.56, 42, 0.045), color: CYAN },
  ] as const;
}

function createOrbitalNodeAngles(nodeCount: number) {
  return Array.from({ length: nodeCount }, (_, index) => (index / nodeCount) * TAU);
}

function createHeadGeometry() {
  const geometry = new THREE.SphereGeometry(1, 76, 76);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);

    const frontInfluence = THREE.MathUtils.smoothstep(vertex.z, -0.36, 0.96);
    const targetDepth = faceDepthAt(vertex.x * 0.96, vertex.y * 1.04);

    if (targetDepth !== null) {
      const desiredZ = THREE.MathUtils.lerp(vertex.z * 0.72, targetDepth - 0.08, frontInfluence);
      vertex.z = desiredZ;
    } else {
      vertex.z *= 0.76;
    }

    const jawNarrowing =
      vertex.y < -0.28 ? 1 - Math.min(0.14, Math.abs(vertex.y + 0.28) * 0.12) : 1;
    const templeCompression =
      vertex.y > 0.18 ? 1 - Math.min(0.08, Math.abs(vertex.x) * 0.025) : 1;

    vertex.x *= jawNarrowing * templeCompression;
    vertex.y *= 1.05;

    if (vertex.z < -0.1) {
      vertex.z *= 0.84;
    }

    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

function createFaceMeshGeometry() {
  const geometry = new THREE.PlaneGeometry(1.42, 2.08, 26, 34);
  const position = geometry.attributes.position as THREE.BufferAttribute;

  for (let index = 0; index < position.count; index += 1) {
    const normalizedX = position.getX(index) / 0.71;
    const normalizedY = position.getY(index) / 1.04;
    const y = normalizedY * 1.04;
    const width = faceWidthAt(y) * 0.98;
    const x = normalizedX * width;
    const z = faceDepthAt(x, y) ?? 0.02;

    position.setXYZ(index, x, y, z - 0.02);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

const headVertexShader = `
  uniform float uTime;
  uniform float uProgress;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec3 pos = position;
    float reveal = smoothstep(0.06, 0.34, uProgress);
    float shimmer = sin(uTime * 0.65 + pos.y * 7.0) * 0.015;
    float resolve = sin(uTime * 2.8 + pos.y * 10.0 + pos.x * 4.0) * 0.008 * smoothstep(0.52, 0.84, uProgress);

    pos *= mix(1.32, 1.0, reveal);
    pos += normal * (shimmer + resolve);

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const headFragmentShader = `
  uniform float uTime;
  uniform float uProgress;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 2.7);
    float scanline = pow(sin(vUv.y * 86.0 + uTime * 2.3) * 0.5 + 0.5, 7.0) * 0.22;
    float reveal = smoothstep(0.06, 0.32, uProgress);
    float identity = smoothstep(0.5, 0.82, uProgress);

    vec3 base = vec3(0.018, 0.12, 0.21);
    vec3 edge = vec3(0.48, 0.83, 0.95);
    vec3 accent = vec3(0.28, 0.9, 0.82);
    vec3 color = mix(base, edge, fresnel);
    color += accent * scanline * (0.22 + identity * 0.7);

    float alpha = reveal * (0.012 + fresnel * 0.18 + scanline * 0.03);

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function HeadShell({ progress }: { progress: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => createHeadGeometry(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) {
      return;
    }

    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uProgress.value = progress;
  });

  return (
    <mesh geometry={geometry} scale={[0.98, 1.18, 0.94]}>
      <shaderMaterial
        ref={materialRef}
        fragmentShader={headFragmentShader}
        vertexShader={headVertexShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function FaceMeshLattice({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => createFaceMeshGeometry(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const reveal = THREE.MathUtils.smoothstep(progress, 0.08, 0.44);
    const settle = THREE.MathUtils.smoothstep(progress, 0.28, 0.68);
    const material = mesh.material as THREE.MeshBasicMaterial;

    mesh.scale.setScalar(1.08 - settle * 0.08);
    mesh.position.z = -0.01 + Math.sin(clock.elapsedTime * 0.4) * 0.008;
    material.opacity = reveal * 0.22;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        color={BLUE}
        wireframe
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function FaceSurfacePoints({ progress, count }: { progress: number; count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => createHeadSurfacePoints(count), [count]);

  useFrame(() => {
    const points = pointsRef.current;
    if (!points) {
      return;
    }

    const reveal = THREE.MathUtils.smoothstep(progress, 0.04, 0.32);
    const settle = THREE.MathUtils.smoothstep(progress, 0.16, 0.52);
    const identity = THREE.MathUtils.smoothstep(progress, 0.56, 0.84);
    const material = points.material as THREE.PointsMaterial;

    points.scale.setScalar(1.22 - reveal * 0.22);
    material.opacity = 0.08 + reveal * 0.22 + identity * 0.1;
    material.size = 0.016 + settle * 0.004;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={CYAN}
        size={0.018}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function FeatureLandmarks({ progress }: { progress: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => createFeaturePoints(), []);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points) {
      return;
    }

    const reveal = THREE.MathUtils.smoothstep(progress, 0.14, 0.58);
    const pulse = 0.76 + Math.sin(clock.elapsedTime * 2.8) * 0.12;
    const material = points.material as THREE.PointsMaterial;

    material.opacity = reveal * pulse * 1.2;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={TEAL}
        size={0.026}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function ContourLines({ progress }: { progress: number }) {
  const refs = useRef<Array<THREE.Line | null>>([]);
  const curves = useMemo(() => createContourBuffers(), []);

  useFrame(({ clock }) => {
    const reveal = THREE.MathUtils.smoothstep(progress, 0.12, 0.5);
    const pulse = 0.88 + Math.sin(clock.elapsedTime * 1.8) * 0.08;

    refs.current.forEach((line, index) => {
      if (!line) {
        return;
      }

      const baseOpacity = index < 2 ? 0.56 : 0.38;
      (line.material as THREE.LineBasicMaterial).opacity = reveal * baseOpacity * pulse;
    });
  });

  return (
    <>
      {curves.map((curve, index) => (
        <line
          key={index}
          ref={node => {
            refs.current[index] = node as unknown as THREE.Line | null;
          }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[curve.buffer, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color={curve.color}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </line>
      ))}
    </>
  );
}

function MouthSpline({ progress }: { progress: number }) {
  const upperRef = useRef<THREE.Points>(null);
  const lowerRef = useRef<THREE.Points>(null);
  const upperLip = useMemo(
    () => createEllipseLine([0, -0.37, 0.98], 0.25, 0.06, 34, Math.PI * 0.08, Math.PI * 0.92),
    [],
  );
  const lowerLip = useMemo(
    () => createEllipseLine([0, -0.45, 0.95], 0.2, 0.05, 32, Math.PI * 1.08, Math.PI * 1.92),
    [],
  );

  useFrame(({ clock }) => {
    const open = THREE.MathUtils.smoothstep(progress, 0.42, 0.76);
    const speech = (Math.sin(clock.elapsedTime * 6.2) * 0.5 + 0.5) * open;

    if (upperRef.current) {
      upperRef.current.position.y = speech * 0.014;
      (upperRef.current.material as THREE.PointsMaterial).opacity = Math.max(0.24, open * 0.92);
    }

    if (lowerRef.current) {
      lowerRef.current.position.y = -speech * 0.04;
      (lowerRef.current.material as THREE.PointsMaterial).opacity = Math.max(0.2, open * 0.86);
    }
  });

  return (
    <group>
      <points ref={upperRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[upperLip, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={TEAL}
          size={0.028}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <points ref={lowerRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lowerLip, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={CYAN}
          size={0.026}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

function EarContours({ progress }: { progress: number }) {
  const refs = useRef<Array<THREE.Points | null>>([]);
  const leftOuter = useMemo(() => createEarContour(-1), []);
  const rightOuter = useMemo(() => createEarContour(1), []);
  const leftInner = useMemo(() => createEarContour(-1, true), []);
  const rightInner = useMemo(() => createEarContour(1, true), []);

  useFrame(() => {
    const reveal = THREE.MathUtils.smoothstep(progress, 0.34, 0.74);
    refs.current.forEach(pointCloud => {
      if (!pointCloud) {
        return;
      }

      (pointCloud.material as THREE.PointsMaterial).opacity = reveal * 0.68;
    });
  });

  return (
    <>
      {[leftOuter, rightOuter, leftInner, rightInner].map((buffer, index) => (
        <points
          key={index}
          ref={node => {
            refs.current[index] = node as unknown as THREE.Points | null;
          }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[buffer, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color={index < 2 ? BLUE : CYAN}
            size={index < 2 ? 0.024 : 0.018}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      ))}
    </>
  );
}

function EyeAssembly({
  progress,
  pointerSignalRef,
}: {
  progress: number;
  pointerSignalRef: React.MutableRefObject<PointerSignal>;
}) {
  const leftPupilRef = useRef<THREE.Mesh>(null);
  const rightPupilRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const reveal = THREE.MathUtils.smoothstep(progress, 0.42, 0.78);
    const pointerAge = performance.now() - pointerSignalRef.current.lastSeenAt;
    const pointerActive = pointerAge < 1400;
    const targetX = pointerActive
      ? pointerSignalRef.current.x * 0.04
      : Math.sin(clock.elapsedTime * 0.55) * 0.022;
    const targetY = pointerActive
      ? pointerSignalRef.current.y * 0.02
      : Math.cos(clock.elapsedTime * 0.42) * 0.01;
    const blinkPulse = Math.pow(Math.max(0, Math.sin(clock.elapsedTime * 0.78 - 0.4)), 28);
    const blinkScale = 1 - blinkPulse * 0.85;

    [leftEyeRef.current, rightEyeRef.current].forEach(eye => {
      if (!eye) {
        return;
      }

      eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, blinkScale, 0.18);
      eye.scale.x = 0.96 + reveal * 0.04;
    });

    [leftPupilRef.current, rightPupilRef.current].forEach(pupil => {
      if (!pupil) {
        return;
      }

      pupil.position.x = THREE.MathUtils.lerp(pupil.position.x, targetX, 0.1);
      pupil.position.y = THREE.MathUtils.lerp(pupil.position.y, targetY, 0.1);
      (pupil.material as THREE.MeshBasicMaterial).opacity = reveal;
    });
  });

  return (
    <>
      {[
        { x: -0.31, eyeRef: leftEyeRef, pupilRef: leftPupilRef },
        { x: 0.31, eyeRef: rightEyeRef, pupilRef: rightPupilRef },
      ].map(({ x, eyeRef, pupilRef }) => (
        <group key={x} ref={eyeRef} position={[x, 0.18, 0.96]}>
          <mesh scale={[1.06, 0.74, 1]}>
            <sphereGeometry args={[0.085, 24, 24]} />
            <meshBasicMaterial
              color={ICE}
              transparent
              opacity={0.42}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={pupilRef} position={[0, 0, 0.046]}>
            <sphereGeometry args={[0.036, 20, 20]} />
            <meshBasicMaterial
              color={TEAL}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0.026, 0.018, 0.082]}>
            <sphereGeometry args={[0.012, 18, 18]} />
            <meshBasicMaterial
              color={ICE}
              transparent
              opacity={0.58}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function MolecularOrbit({
  progress,
  radius,
  rotation,
  nodeCount,
  speed,
  color,
}: {
  progress: number;
  radius: number;
  rotation: [number, number, number];
  nodeCount: number;
  speed: number;
  color: THREE.ColorRepresentation;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const nodeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const nodeAngles = useMemo(() => createOrbitalNodeAngles(nodeCount), [nodeCount]);

  useFrame(({ clock }) => {
    const reveal = THREE.MathUtils.smoothstep(progress, 0.18, 0.78);
    const fade = 1 - THREE.MathUtils.smoothstep(progress, 0.86, 0.98);
    const group = groupRef.current;
    const ring = ringRef.current;

    if (group) {
      group.rotation.z += speed * 0.0025;
      group.rotation.y += speed * 0.0014;
    }

    if (ring) {
      (ring.material as THREE.MeshBasicMaterial).opacity = reveal * fade * 0.14;
    }

    nodeRefs.current.forEach((node, index) => {
      if (!node) {
        return;
      }

      const angle = nodeAngles[index] + clock.elapsedTime * speed;
      node.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      (node.material as THREE.MeshBasicMaterial).opacity = reveal * fade * 0.88;
    });
  });

  return (
    <group ref={groupRef} rotation={rotation}>
      <mesh ref={ringRef}>
        <torusGeometry args={[radius, 0.008, 12, 160]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {nodeAngles.map((angle, index) => (
        <mesh
          key={index}
          ref={node => {
            nodeRefs.current[index] = node;
          }}
          position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}
        >
          <sphereGeometry args={[0.03, 14, 14]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function MolecularOrbitals({ progress }: { progress: number }) {
  return (
    <>
      <MolecularOrbit
        progress={progress}
        radius={1.28}
        rotation={[0.26, 0.34, 0.14]}
        nodeCount={3}
        speed={0.72}
        color={CYAN}
      />
      <MolecularOrbit
        progress={progress}
        radius={1.62}
        rotation={[1.06, -0.32, 0.84]}
        nodeCount={3}
        speed={-0.58}
        color={TEAL}
      />
      <MolecularOrbit
        progress={progress}
        radius={1.9}
        rotation={[0.18, 0.86, 1.18]}
        nodeCount={4}
        speed={0.44}
        color={BLUE}
      />
    </>
  );
}

function AmbientParticles({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => createAmbientPoints(count), [count]);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points) {
      return;
    }

    points.rotation.y = clock.elapsedTime * 0.05;
    points.rotation.x = clock.elapsedTime * 0.018;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={DEEP}
        size={0.04}
        transparent
        opacity={0.82}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function SentinelFace({
  quality,
  progress,
  pointerSignalRef,
}: {
  quality: PortalEntryQuality;
  progress: number;
  pointerSignalRef: React.MutableRefObject<PointerSignal>;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const profile = useMemo(() => getPortalEntryProfile(quality), [quality]);

  useFrame(({ clock }) => {
    const group = rootRef.current;
    if (!group) {
      return;
    }

    const settle = THREE.MathUtils.smoothstep(progress, 0.12, 0.42);
    const identity = THREE.MathUtils.smoothstep(progress, 0.56, 0.84);
    const pointerAge = performance.now() - pointerSignalRef.current.lastSeenAt;
    const pointerActive = pointerAge < 1400;
    const idleYaw = Math.sin(clock.elapsedTime * 0.34) * 0.16 + Math.sin(clock.elapsedTime * 0.12) * 0.04;
    const idlePitch = Math.cos(clock.elapsedTime * 0.28) * 0.07;
    const targetYaw = pointerActive ? pointerSignalRef.current.x * 0.28 : idleYaw;
    const targetPitch = pointerActive ? pointerSignalRef.current.y * 0.16 : idlePitch;
    const floatY = Math.sin(clock.elapsedTime * 0.52) * 0.08;
    const floatX = Math.sin(clock.elapsedTime * 0.24) * 0.03;

    group.position.y = floatY + identity * 0.02;
    group.position.x = floatX;
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetYaw, 0.055);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetPitch, 0.055);
    group.scale.setScalar(0.82 + settle * 0.22);
  });

  return (
    <group ref={rootRef}>
      <ambientLight intensity={0.26} />
      <pointLight position={[0, 1.8, 4.1]} intensity={3.1} color={CYAN} />
      <pointLight position={[-2.4, 0.2, 2.8]} intensity={1.26} color={BLUE} />
      <pointLight position={[2.6, 0.26, 2.6]} intensity={1.12} color={TEAL} />
      <pointLight position={[0, -1.8, 2.2]} intensity={0.55} color={ICE} />

      <AmbientParticles count={profile.ambientParticleCount} />
      <MolecularOrbitals progress={progress} />

      <group>
        <HeadShell progress={progress} />
        <FaceMeshLattice progress={progress} />
        <FaceSurfacePoints count={profile.particleCount} progress={progress} />
        <FeatureLandmarks progress={progress} />
        <ContourLines progress={progress} />
        <EyeAssembly progress={progress} pointerSignalRef={pointerSignalRef} />
        <EarContours progress={progress} />
        <MouthSpline progress={progress} />
      </group>
    </group>
  );
}

class FaceErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('portal-entry-face error:', error);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export default function PortalEntryFace({ quality, progress, onError }: PortalEntryFaceProps) {
  const pointerSignalRef = useRef<PointerSignal>({ x: 0, y: 0, lastSeenAt: 0 });

  useEffect(() => {
    if (quality === 'skip') {
      onError?.();
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointerSignalRef.current.x = ((event.clientX / window.innerWidth) - 0.5) * 2;
      pointerSignalRef.current.y = ((event.clientY / window.innerHeight) - 0.5) * -2;
      pointerSignalRef.current.lastSeenAt = performance.now();
    };

    const handlePointerLeave = () => {
      pointerSignalRef.current.lastSeenAt = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('blur', handlePointerLeave);
    window.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('blur', handlePointerLeave);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [onError, quality]);

  if (quality === 'skip') {
    return null;
  }

  return (
    <FaceErrorBoundary onError={onError}>
      <Canvas
        dpr={quality === 'full' ? [1, 1.2] : [1, 1.1]}
        camera={{ position: [0, 0.02, 5.2], fov: 33 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#020812', 5.4, 10.8]} />
        <SentinelFace quality={quality} progress={progress} pointerSignalRef={pointerSignalRef} />
      </Canvas>
    </FaceErrorBoundary>
  );
}
