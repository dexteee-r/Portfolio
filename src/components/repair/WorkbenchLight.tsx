"use client";

import { useEffect, useRef } from "react";
import {
  chapterColour,
  createProgram,
  easeOutCubic,
  fitCanvas,
  fullScreenQuad,
  hasFinePointer,
  prefersReducedMotion,
  QUAD_VS,
  type Program,
} from "@/lib/webgl";

/** The pegboard's pitch, in CSS pixels: one hole every this many. */
export const PEG_PITCH = 30;

const BOARD_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_dpr;
uniform vec2 u_light;   // CSS pixels, y up
uniform float u_on;     // the lamp coming on, 0..1
uniform vec3 u_board;   // the chapter's surface
uniform vec3 u_lamp;    // the chapter's ink: a warm white
uniform vec3 u_ground;  // the chapter's ground: the holes' depth
uniform float u_pitch;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 px = gl_FragCoord.xy / u_dpr;
  float fibre = noise(px * vec2(0.9, 0.12)) * 0.5 + noise(px * 0.35) * 0.5;
  vec3 board = u_board * (0.82 + 0.3 * fibre);
  vec2 cell = mod(px, u_pitch) - u_pitch * 0.5;
  float r = length(cell);
  vec3 L = normalize(vec3(u_light - px, 260.0));
  vec3 n = vec3(0.0, 0.0, 1.0);
  float rim = smoothstep(5.6, 4.6, r) * smoothstep(3.2, 4.4, r);
  if (rim > 0.0) n = normalize(vec3(-cell / max(r, 0.001) * 0.9, 0.45));
  float hole = smoothstep(4.4, 3.6, r);
  vec2 away = normalize(px - u_light + 0.001) * 2.2;
  float shadow = smoothstep(5.6, 3.8, length(cell - away)) * (1.0 - hole) * 0.55;
  float dist = length(u_light - px);
  float falloff = 1.0 / (1.0 + pow(dist / 520.0, 2.0) * 2.4);
  float diffuse = max(dot(n, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 40.0) * 0.16;
  vec3 col = board * (0.35 + 1.15 * diffuse * falloff * u_lamp * u_on) + u_lamp * spec * falloff * u_on;
  col *= 1.0 - shadow;
  col = mix(col, u_ground * 0.6, hole);
  col *= 1.0 - 0.4 * dot(v_uv - 0.5, v_uv - 0.5) * 2.0;
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

/**
 * The workbench's pegboard, lit by a workshop lamp that follows the pointer
 * (WebGL). Decoration over a CSS pegboard that stands in for it — without
 * WebGL, without JavaScript, the board is simply there, unlit.
 *
 * On a touch screen the lamp drifts on its own; under reduced motion it stays
 * put, drawn once. Paused off screen and in a hidden tab.
 */
export default function WorkbenchLight() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const area = element?.parentElement;
    const gl = element?.getContext("webgl2", { antialias: false });
    if (!element || !area || !gl) return;

    let program: Program;
    try {
      program = createProgram(gl, QUAD_VS, BOARD_FS);
    } catch (error) {
      // No light, the CSS board stays: say why while developing.
      if (process.env.NODE_ENV !== "production") console.error(error);
      return;
    }
    const draw = fullScreenQuad(gl);
    const u = program.uniforms;
    const still = prefersReducedMotion();
    const follows = hasFinePointer();
    const colours = {
      board: chapterColour(element, "surface"),
      lamp: chapterColour(element, "ink"),
      ground: chapterColour(element, "bg"),
    };

    // At rest, the lamp hangs over the title.
    const rest = () => ({ x: element.clientWidth * 0.3, y: element.clientHeight * 0.15 });
    const lamp = rest();
    let target: { x: number; y: number } | null = null;
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      target = { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const leave = () => (target = null);
    if (follows && !still) {
      area.addEventListener("pointermove", move);
      area.addEventListener("pointerleave", leave);
    }

    let onScreen = true;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => (onScreen = entry?.isIntersecting ?? true));
    observer?.observe(element);

    const start = performance.now();
    const frame = (now: number) => {
      const seconds = (now - start) / 1000;
      // The lamp: a stutter, then on — about a third of a second.
      const on = still
        ? 1
        : seconds < 0.08
          ? 0.5
          : seconds < 0.14
            ? 0.12
            : seconds < 0.22
              ? 0.85
              : 0.85 + 0.15 * easeOutCubic((seconds - 0.22) / 0.15);
      const goal =
        target ??
        (follows || still
          ? rest()
          : // On a touch screen, a slow drift over the board.
            {
              x: element.clientWidth * (0.55 + 0.25 * Math.sin(seconds * 0.23)),
              y: element.clientHeight * (0.3 + 0.15 * Math.sin(seconds * 0.17 + 1)),
            });
      const ease = still ? 1 : 0.08;
      lamp.x += (goal.x - lamp.x) * ease;
      lamp.y += (goal.y - lamp.y) * ease;

      const [width, height] = fitCanvas(element);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program.program);
      gl.uniform2f(u.u_res!, width, height);
      gl.uniform1f(u.u_dpr!, width / element.clientWidth);
      gl.uniform2f(u.u_light!, lamp.x, element.clientHeight - lamp.y);
      gl.uniform1f(u.u_on!, on);
      gl.uniform3fv(u.u_board!, colours.board);
      gl.uniform3fv(u.u_lamp!, colours.lamp);
      gl.uniform3fv(u.u_ground!, colours.ground);
      gl.uniform1f(u.u_pitch!, PEG_PITCH);
      draw();
      element.setAttribute("data-lit", "");
    };

    let id = 0;
    if (still) {
      frame(performance.now());
    } else {
      const tick = (now: number) => {
        id = requestAnimationFrame(tick);
        if (onScreen && !document.hidden) frame(now);
      };
      id = requestAnimationFrame(tick);
    }
    const resize = () => still && frame(performance.now());
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(id);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerleave", leave);
      // The context is not forced lost: React may mount this canvas again
      // (Strict Mode does, while developing), and would get a dead one back.
    };
  }, []);

  return <canvas ref={canvas} data-workbench-light="" aria-hidden="true" className="workbench-light" />;
}
