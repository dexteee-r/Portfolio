/**
 * A few lines of WebGL2, shared by the chapters' worlds — no library: a
 * full-screen quad, a program, a texture, and the chapter's colours read from
 * the page, so a shader is themed by tokens.css like everything else.
 */

/**
 * A CSS colour as the browser computes it, to 0–1 channels. Only its numbers
 * are read: 0–255 in the classic notation, already 0–1 in `color(srgb …)`.
 */
export function cssColour(value: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = (value.match(/\d*\.?\d+/g) ?? []).map(Number);
  const scale = value.trim().startsWith("color(") ? 1 : 255;
  return [r / scale, g / scale, b / scale];
}

/** The computed colour of a `--chapter-*` alias on an element: what the page paints with. */
export function chapterColour(element: Element, alias: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = `var(--chapter-${alias})`;
  probe.style.display = "none";
  element.appendChild(probe);
  const colour = cssColour(getComputedStyle(probe).color);
  probe.remove();
  return colour;
}

export const QUAD_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

export interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
  return shader;
}

export function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): Program {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "program");
  const uniforms: Program["uniforms"] = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i += 1) {
    const { name } = gl.getActiveUniform(program, i)!;
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

/** Draws a quad over the whole viewport (attribute 0). */
export function fullScreenQuad(gl: WebGL2RenderingContext): () => void {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return () => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
}

export function imageTexture(gl: WebGL2RenderingContext, image: TexImageSource): WebGLTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return texture;
}

/** Keeps a canvas's buffer at its displayed size, capped at 2× for the GPU's sake. */
export function fitCanvas(canvas: HTMLCanvasElement): [number, number] {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return [width, height];
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** A finer pointer than a finger: the effects that follow the pointer only run with one. */
export const hasFinePointer = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: fine)").matches);

/** A 0–1 ease that settles fast and lands softly. */
export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
