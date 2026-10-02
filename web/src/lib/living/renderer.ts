// The living dragon's WebGL2 drawing (spec 2026-10-02 living dragon, "Technique"), ported from the
// spike: the sprite on the 64 x 64 mesh, skinned in the vertex shader with the per-vertex weights; the
// tint in the fragment shader on the dragon only (a TINT_SPECS entry in OKLCH, at full strength: the
// steps of tint.ts's CPU reference; alpha below about 4 % dropped so the cut-out's background haze
// never smears into streaks); then each worn piece as its own quad from the atlas, back to front, skinned rigidly with uniform weights and never
// tinted. Every failure throws: the caller shows the still picture. No unit test (no GL in node):
// living-dragon.spec.ts proves it.
import type { PieceDraw } from './atlas';
import type { Rig } from './rigs';
import { FRAME, MARGIN, buildMesh } from './skin';
import { GAMUT_STEPS, type OklchSpec } from './tint';

const VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aW0;
layout(location = 3) in vec2 aW1;
uniform mat3 uB[6];
uniform float uMargin;
uniform bool uRigid;
uniform float uW[6];
out vec2 vUv;
out vec4 vW0;
void main() {
  float w[6];
  if (uRigid) {
    for (int i = 0; i < 6; i++) w[i] = uW[i];
  } else {
    w[0] = aW0.x; w[1] = aW0.y; w[2] = aW0.z; w[3] = aW0.w; w[4] = aW1.x; w[5] = aW1.y;
  }
  vec2 d = vec2(0.0);
  for (int i = 0; i < 6; i++) d += w[i] * ((uB[i] * vec3(aPos, 1.0)).xy - aPos);
  vec2 q = (aPos + d) / ${FRAME}.0;
  vec2 ndc = (q - 0.5) * 2.0 / (1.0 + 2.0 * uMargin);
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  vUv = aUv;
  vW0 = uRigid ? vec4(0.0) : aW0;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vW0;
uniform sampler2D uTex;
uniform int uLayer;
uniform bool uTinted;
uniform float uShift;
uniform float uChroma;
uniform float uLightness;
uniform bool uShowWeights;
out vec4 o;

vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 oklab(vec3 c) {
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}
vec3 oklchLinear(float L, float C, float h) {
  vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * vec3(L, C * cos(h), C * sin(h));
  lms = lms * lms * lms;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * lms;
}
bool inGamut(vec3 c) { return all(greaterThanEqual(c, vec3(-1e-4))) && all(lessThanEqual(c, vec3(1.0 + 1e-4))); }

// The tint of one straight colour (tint.ts, tintOklch, is its CPU reference).
vec3 tint(vec3 rgb) {
  vec3 lab = oklab(toLinear(rgb));
  float L = clamp(lab.x * uLightness, 0.0, 1.0);
  float C0 = length(lab.yz);
  float C = C0 * uChroma;
  // atan(0, 0) is undefined in GLSL: a grey has no hue to turn.
  float h = C0 > 1e-7 ? atan(lab.z, lab.y) + radians(uShift) : 0.0;
  if (!inGamut(oklchLinear(L, C, h))) {
    float lo = 0.0;
    float hi = C;
    for (int i = 0; i < ${GAMUT_STEPS}; i++) {
      float mid = 0.5 * (lo + hi);
      if (inGamut(oklchLinear(L, mid, h))) lo = mid; else hi = mid;
    }
    C = lo;
  }
  return toSrgb(clamp(oklchLinear(L, C, h), 0.0, 1.0));
}

void main() {
  vec4 c = texture(uTex, vUv);
  if (uLayer == 1) { o = c; return; }
  c *= smoothstep(0.02, 0.05, c.a);
  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  if (uTinted) rgb = tint(rgb);
  o = vec4(rgb * c.a, c.a);
  if (uShowWeights && o.a > 0.0) {
    vec3 wc = vW0.x * vec3(1.0, 0.2, 0.2) + vW0.y * vec3(0.2, 0.8, 0.2) + vW0.z * vec3(0.2, 0.45, 1.0) + vW0.w * vec3(1.0, 0.8, 0.0);
    float s = min(1.0, vW0.x + vW0.y + vW0.z + vW0.w);
    vec3 g = vec3(dot(o.rgb / o.a, vec3(0.3, 0.59, 0.11)));
    o.rgb = mix(g, wc, 0.6 * s) * o.a;
  }
}`;

const UNIFORMS = ['uB', 'uMargin', 'uRigid', 'uW', 'uTex', 'uLayer', 'uTinted', 'uShift', 'uChroma', 'uLightness', 'uShowWeights'] as const;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('createShader failed');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s) ?? 'failed'}`);
  return s;
}

export class DragonRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  private readonly meshVao: WebGLVertexArrayObject;
  private readonly meshCount: number;
  private readonly quadVao: WebGLVertexArrayObject;
  private readonly quadBuffer: WebGLBuffer;
  private readonly baseTex: WebGLTexture;
  private atlasTex: WebGLTexture | null = null;
  private pieces: readonly PieceDraw[] = [];
  private readonly buffers: WebGLBuffer[] = [];
  private shaders: WebGLShader[] = [];

  constructor(private readonly canvas: HTMLCanvasElement, sprite: TexImageSource, rig: Rig) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false });
    if (!gl) throw new Error('no WebGL2');
    this.gl = gl;
    // A throw past this point (a shader, a link) loses the context it made: failed tries never pile up.
    try {
      const program = gl.createProgram();
      if (!program) throw new Error('createProgram failed');
      this.shaders = [compile(gl, gl.VERTEX_SHADER, VS), compile(gl, gl.FRAGMENT_SHADER, FS)];
      for (const s of this.shaders) gl.attachShader(program, s);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(program) ?? 'failed'}`);
      this.program = program;
      gl.useProgram(program);
      this.u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as DragonRenderer['u'];

      const mesh = buildMesh(rig.weights);
      this.meshVao = this.vao();
      this.attribute(0, mesh.pos, 2);
      this.attribute(1, mesh.uv, 2);
      this.attribute(2, mesh.w0, 4);
      this.attribute(3, mesh.w1, 2);
      const ib = this.buffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      this.meshCount = mesh.indices.length;
      gl.bindVertexArray(null);

      this.quadVao = this.vao();
      this.quadBuffer = this.buffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.bindVertexArray(null);

      this.baseTex = this.texture(0, sprite);
      gl.uniform1f(this.u.uMargin, MARGIN);
      this.setTint(null);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL error while setting up');
    } catch (e) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw e;
    }
  }

  private vao(): WebGLVertexArrayObject {
    const v = this.gl.createVertexArray();
    if (!v) throw new Error('createVertexArray failed');
    this.gl.bindVertexArray(v);
    return v;
  }

  private buffer(): WebGLBuffer {
    const b = this.gl.createBuffer();
    if (!b) throw new Error('createBuffer failed');
    this.buffers.push(b);
    return b;
  }

  private attribute(loc: number, data: Float32Array, size: number): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  private texture(unit: number, src: TexImageSource, into?: WebGLTexture): WebGLTexture {
    const gl = this.gl;
    const t = into ?? gl.createTexture();
    if (!t) throw new Error('createTexture failed');
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** The dragon's tint: a TINT_SPECS entry (OKLCH, full strength), or null for none (the bronze). */
  setTint(spec: OklchSpec | null): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform1i(this.u.uTinted, spec ? 1 : 0);
    gl.uniform1f(this.u.uShift, spec?.shift ?? 0);
    gl.uniform1f(this.u.uChroma, spec?.chroma ?? 1);
    gl.uniform1f(this.u.uLightness, spec?.lightness ?? 1);
  }

  setPieces(atlas: TexImageSource | null, pieces: readonly PieceDraw[]): void {
    const gl = this.gl;
    this.pieces = atlas ? pieces : [];
    if (!atlas) return;
    this.atlasTex = this.texture(1, atlas, this.atlasTex ?? undefined);
    const data = new Float32Array(pieces.length * 16);
    pieces.forEach((p, n) => {
      const [x0, y0, x1, y1] = p.frame;
      const [u0, v0, u1, v1] = p.atlasUv;
      data.set([x0, y0, u0, v0, x1, y0, u1, v0, x0, y1, u0, v1, x1, y1, u1, v1], n * 16);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  /** The canvas's backing size in px (square). */
  resize(px: number): void {
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
  }

  draw(bones: Float32Array, showWeights = false): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.u.uB, false, bones);
    gl.uniform1i(this.u.uRigid, 0);
    gl.uniform1i(this.u.uLayer, 0);
    gl.uniform1i(this.u.uShowWeights, showWeights ? 1 : 0);
    gl.uniform1i(this.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.bindVertexArray(this.meshVao);
    gl.drawElements(gl.TRIANGLES, this.meshCount, gl.UNSIGNED_SHORT, 0);
    if (this.atlasTex && this.pieces.length) {
      gl.uniform1i(this.u.uRigid, 1);
      gl.uniform1i(this.u.uLayer, 1);
      gl.uniform1i(this.u.uTex, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
      gl.bindVertexArray(this.quadVao);
      this.pieces.forEach((p, n) => {
        gl.uniform1fv(this.u.uW, p.weights);
        gl.drawArrays(gl.TRIANGLE_STRIP, n * 4, 4);
      });
    }
    gl.bindVertexArray(null);
  }

  /** Frees everything and the context itself, so many visits never reach the browser's context cap. */
  dispose(): void {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      for (const b of this.buffers) gl.deleteBuffer(b);
      gl.deleteVertexArray(this.meshVao);
      gl.deleteVertexArray(this.quadVao);
      gl.deleteTexture(this.baseTex);
      if (this.atlasTex) gl.deleteTexture(this.atlasTex);
      for (const s of this.shaders) gl.deleteShader(s);
      gl.deleteProgram(this.program);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
