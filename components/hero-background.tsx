'use client';

import { useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
 *  WebGL Voronoi shader background — adapted from the Orbital SaaS Hero
 *  Section Template. Colours shifted from red/magma to AXE PRIME's deep
 *  blue/cyan palette.
 * ────────────────────────────────────────────────────────────────────────── */

const VERTEX_SOURCE = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT_SOURCE = `
  precision highp float;
  uniform vec2  iResolution;
  uniform float iTime;
  uniform vec2  iMouse;
  uniform float BRIGHTNESS;

  const int   POINTS     = 16;
  const float WAVE_OFFSET = 12000.0;
  const float SPEED       = 1.0 / 16.0;
  const float COLOR_SPEED = 1.0 / 10.0;

  /* ── Voronoi noise ────────────────────────── */
  void voronoi(vec2 uv, inout vec3 col) {
    vec3  voronoi = vec3(0.0);
    float time    = (iTime + WAVE_OFFSET) * SPEED;
    float best    = 999.0;
    float lastB   = best;

    for (int i = 0; i < POINTS; i++) {
      float fi = float(i);
      vec2 p = vec2(
        mod(fi, 1.0) * 0.1 + sin(fi),
        -0.05 + 0.15 * float(i / 10) + cos(fi + time * cos(uv.x * 0.025))
      );
      p.x += 0.01 * sin(iMouse.x / iResolution.x * 3.14);
      p.y += 0.01 * cos(iMouse.y / iResolution.y * 3.14);
      float d = distance(uv, p);
      if (d < best) {
        lastB  = best;
        best   = d;
        voronoi.x  = p.x;
        voronoi.yz = vec2(p.x * 0.4 + p.y, p.y) * vec2(0.9, 0.87);
      }
    }
    col *= 0.5 + 0.4 * voronoi;

    float edge = 1.0 - abs(best - lastB);
    /* Cyan core glow – replaces orange */
    col += vec3(0.05, 0.75, 0.95) * smoothstep(0.985, 1.02, edge) * 0.6;
    /* Deep blue ambient glow – replaces red */
    col += vec3(0.0, 0.25, 0.8) * smoothstep(0.94, 1.0, edge) * 0.2;
  }

  void main() {
    vec2  uv = gl_FragCoord.xy / iResolution.xy;
    float t  = iTime * COLOR_SPEED;

    /* Base colours — AXE PRIME deep blue palette */
    vec3 deepNavy  = vec3(0.01, 0.02, 0.06);
    vec3 darkBlue  = vec3(0.02, 0.08, 0.20);
    vec3 cyanGlow  = vec3(0.05, 0.35, 0.55);

    float noise = sin(uv.x * 2.0 + t) * cos(uv.y * 3.0 - t * 0.5);
    vec3 baseCol = mix(deepNavy, darkBlue, 0.5 + 0.5 * noise);
    baseCol = mix(baseCol, cyanGlow, smoothstep(0.6, 1.0, noise) * 0.4);
    baseCol *= smoothstep(-0.4, 1.1, uv.y);

    voronoi(uv * 4.0 - 1.0, baseCol);

    gl_FragColor = vec4(baseCol, 1.0) * BRIGHTNESS;
  }
`;

function compile(gl: WebGLRenderingContext, src: string, type: number) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;                      // fallback: no WebGL → invisible

    /* ── programme ─────────────────── */
    const vs  = compile(gl, VERTEX_SOURCE,   gl.VERTEX_SHADER);
    const fs  = compile(gl, FRAGMENT_SOURCE, gl.FRAGMENT_SHADER);
    const pgm = gl.createProgram()!;
    gl.attachShader(pgm, vs);
    gl.attachShader(pgm, fs);
    gl.linkProgram(pgm);

    /* ── geometry (full-screen quad) ── */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(pgm, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    /* ── uniforms ─────────────────── */
    const uRes   = gl.getUniformLocation(pgm, 'iResolution');
    const uTime  = gl.getUniformLocation(pgm, 'iTime');
    const uMouse = gl.getUniformLocation(pgm, 'iMouse');
    const uBri   = gl.getUniformLocation(pgm, 'BRIGHTNESS');

    let mouseX = 0, mouseY = 0;
    const onMove = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener('mousemove', onMove);

    /* ── resize ────────────────────── */
    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    /* ── render loop ───────────────── */
    let raf = 0;
    const start = Date.now();

    function render() {
      if (!canvas || !gl) return;
      const elapsed = (Date.now() - start) / 1000;
      gl.useProgram(pgm);
      gl.uniform2f(uRes,   canvas.width, canvas.height);
      gl.uniform1f(uTime,  elapsed);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.uniform1f(uBri,   0.85);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="aurora-canvas"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
