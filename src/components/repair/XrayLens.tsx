"use client";

import { useEffect, useRef, type RefObject } from "react";
import { coverCrop } from "@/lib/scan-reel";
import {
  chapterColour,
  createProgram,
  fitCanvas,
  fullScreenQuad,
  imageTexture,
  QUAD_VS,
  type Program,
} from "@/lib/webgl";

/** The lens's radius, as a share of the frame's width. */
export const LENS_RADIUS = 0.17;

/** What the reel tells its X-ray, every frame. */
export interface ReelClock {
  /** The repair on screen. */
  index: number;
  /** The sweeping line, 0 top → 1 bottom; -1 when there is none. */
  line: number;
  /** How much of the swept X-ray remains. */
  keep: number;
  /** The lens: where (0–1 of the frame, y down), and how far it is shown, 0–1. */
  lens: { x: number; y: number; on: number };
}

export interface XrayPhoto {
  src: string;
  width: number;
  height: number;
}

const XRAY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_photo;
uniform vec2 u_texel;
uniform vec4 u_crop;     // scaleX, scaleY, offsetX, offsetY: what of the photo the frame shows
uniform float u_line;
uniform float u_keep;
uniform vec2 u_lens;
uniform float u_lensOn;
uniform float u_aspect;  // frame height / width
uniform vec3 u_trace;
uniform vec3 u_dark;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float at(vec2 uv) { return luma(texture(u_photo, uv).rgb); }

vec3 xray(vec2 uv) {
  float tl = at(uv + u_texel * vec2(-1, 1)), t = at(uv + u_texel * vec2(0, 1)), tr = at(uv + u_texel * vec2(1, 1));
  float l = at(uv + u_texel * vec2(-1, 0)), r = at(uv + u_texel * vec2(1, 0));
  float bl = at(uv + u_texel * vec2(-1, -1)), b = at(uv + u_texel * vec2(0, -1)), br = at(uv + u_texel * vec2(1, -1));
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  float edge = clamp(length(vec2(gx, gy)) * 2.2, 0.0, 1.0);
  return u_dark * 0.6 + u_trace * edge * 1.15 + u_trace * 0.12 * (1.0 - at(uv));
}

void main() {
  vec2 down = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 image = u_crop.zw + down * u_crop.xy;
  vec2 uv = vec2(image.x, 1.0 - image.y);
  float swept = u_line >= 0.0 ? step(down.y, u_line) * u_keep : 0.0;
  vec2 d = (down - u_lens) * vec2(1.0, u_aspect);
  float lens = smoothstep(${LENS_RADIUS.toFixed(3)}, ${(LENS_RADIUS - 0.008).toFixed(3)}, length(d)) * u_lensOn;
  float a = max(swept, lens);
  if (a <= 0.0) { o = vec4(0.0); return; }
  o = vec4(xray(uv) * a, a);
}`;

/**
 * The reel's X-ray (WebGL edge detection, in the chapter's brick): behind the
 * sweeping line, then under the lens. It draws nothing of its own accord —
 * it follows the reel's clock, so the X-ray and the line never drift apart.
 * Decoration over the photos, which say it all.
 */
export default function XrayLens({ photos, clock }: { photos: XrayPhoto[]; clock: RefObject<ReelClock> }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const gl = element?.getContext("webgl2", { premultipliedAlpha: true, alpha: true });
    if (!element || !gl) return;

    let program: Program;
    try {
      program = createProgram(gl, QUAD_VS, XRAY_FS);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error(error);
      return;
    }
    const draw = fullScreenQuad(gl);
    const u = program.uniforms;
    const trace = chapterColour(element, "accent");
    const dark = chapterColour(element, "bg");
    const textures: Array<WebGLTexture | null> = photos.map(() => null);
    photos.forEach((photo, i) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => (textures[i] = imageTexture(gl, image));
      image.src = photo.src;
    });
    const crops = photos.map((p) => coverCrop(p.width, p.height));

    let onScreen = true;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => (onScreen = entry?.isIntersecting ?? true));
    observer?.observe(element);

    let shown = true;
    let id = 0;
    const tick = () => {
      id = requestAnimationFrame(tick);
      if (!onScreen || document.hidden) return;
      const { index, line, keep, lens } = clock.current;
      const texture = textures[index] ?? null;
      const visible = Boolean(texture) && ((line >= 0 && keep > 0) || lens.on > 0.01);
      if (!visible) {
        if (shown) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          shown = false;
        }
        return;
      }
      shown = true;
      const [width, height] = fitCanvas(element);
      const photo = photos[index]!;
      const crop = crops[index]!;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(u.u_photo!, 0);
      gl.uniform2f(u.u_texel!, 1 / photo.width, 1 / photo.height);
      gl.uniform4f(u.u_crop!, crop.scaleX, crop.scaleY, crop.offsetX, crop.offsetY);
      gl.uniform1f(u.u_line!, line);
      gl.uniform1f(u.u_keep!, keep);
      gl.uniform2f(u.u_lens!, lens.x, lens.y);
      gl.uniform1f(u.u_lensOn!, lens.on);
      gl.uniform1f(u.u_aspect!, height / width);
      gl.uniform3fv(u.u_trace!, trace);
      gl.uniform3fv(u.u_dark!, dark);
      draw();
    };
    id = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(id);
      observer?.disconnect();
    };
  }, [photos, clock]);

  return <canvas ref={canvas} data-xray="" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />;
}
