(() => {
  "use strict";
  const vertex = `
    attribute vec2 position;
    varying vec2 uv;
    void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
  `;
  const fragment = `
    precision highp float;
    varying vec2 uv;
    uniform sampler2D paper;
    uniform sampler2D nextMap;
    uniform float time;
    uniform float progress;
    uniform vec2 resolution;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
        mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float value = 0., weight = .5;
      for (int i = 0; i < 5; i++) {
        value += noise(p) * weight;
        p = mat2(.8, -.6, .6, .8) * p * 2.04 + 7.13;
        weight *= .5;
      }
      return value;
    }
    float arrival(vec2 p) {
      // Independent ignition points merge into torn, asymmetric islands.
      vec2 aspect = vec2(1.25, 1.);
      float d = length((p - vec2(.49, .47)) * aspect);
      d = min(d, length((p - vec2(.18, .18)) * aspect) + .09);
      d = min(d, length((p - vec2(.83, .77)) * aspect) + .16);
      float large = fbm(p * 8.);
      float fibres = noise(p * vec2(175., 95.));
      return d + (large - .48) * .23 + (fibres - .5) * .014;
    }
    void main() {
      vec2 p = vec2(uv.x, 1. - uv.y);
      if (progress <= .0001) { gl_FragColor = texture2D(paper, p); return; }
      if (progress >= .9999) { gl_FragColor = texture2D(nextMap, p); return; }
      float amount = mix(-.055, .66, progress);
      float edge = arrival(p) - amount;
      float burning = smoothstep(0., .045, progress) * (1. - smoothstep(.85, 1., progress));
      float grain = hash(floor(p * resolution));
      float turbulence = fbm(p * vec2(28., 13.) + vec2(0., time * 2.3));
      float hot = exp(-abs(edge) * 185.) * burning;
      float nearEdge = exp(-abs(edge) * 24.) * burning;
      float paperMask = smoothstep(-.0015, .002, edge);
      float charMask = 1. - smoothstep(.002, .048 + noise(p * 49.) * .024, edge);
      vec3 old = texture2D(paper, p).rgb;
      // Wide brown scorching, then matte carbon with fractured hot fibres.
      vec3 scorch = old * vec3(.33, .16, .065);
      vec3 carbon = vec3(.028, .021, .017) + grain * .037;
      old = mix(old, scorch, charMask * .9);
      old = mix(old, carbon, (1. - smoothstep(.004, .021, edge)) * .98);
      float fissure = pow(noise(p * vec2(330., 190.)), 13.);
      old += vec3(1.7, .34, .025) * fissure * charMask * burning;

      // Flames lean upward. Sampling the burn front below each fragment
      // creates tongues of different heights instead of a glowing contour.
      vec2 flow = vec2((turbulence - .5) * .018, .01 + turbulence * .07);
      float flameEdge = arrival(p + flow) - amount;
      float flame = (1. - smoothstep(.0, .042, abs(flameEdge))) * burning;
      flame *= smoothstep(.24, .72, turbulence) * (1. - paperMask * .55);
      float glow = hot * (1. + noise(p * 90. + time * 6.) * .7);
      vec3 fire = vec3(1.8, .26, .012) * flame;
      fire += vec3(1.3, .67, .12) * pow(flame, 2.);
      fire += vec3(1.15, .47, .08) * glow;
      // Heat shimmer affects only the freshly exposed part of the new map.
      vec2 distortion = vec2(sin(p.y * 160. + time * 16.), cos(p.x * 120. + time * 10.)) * nearEdge * .0015;
      vec3 next = texture2D(nextMap, clamp(p + distortion, 0., 1.)).rgb;
      next *= .76 + .24 * smoothstep(0., .15, -edge);
      vec3 color = mix(next, old, paperMask);

      float smoke = fbm(p * vec2(8., 11.) + vec2(time * .14, time * .6));
      float smokeFront = exp(-abs(arrival(p + vec2(0., .065)) - amount) * 14.) * burning;
      float soot = smoothstep(.35, .72, smoke) * smokeFront * .7;
      color = mix(color, vec3(.075, .065, .06), soot);
      color += fire;
      color += vec3(.33, .075, .012) * nearEdge * turbulence;
      gl_FragColor = vec4(color, 1.);
    }
  `;

  function create(canvas, oldImage, newImage) {
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    const shaders = [], textures = [];
    let program, buffer;
    const dispose = () => {
      textures.forEach(texture => gl.deleteTexture(texture));
      shaders.forEach(shader => gl.deleteShader(shader));
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    try {
      const compile = (type, source) => {
        const shader = gl.createShader(type); shaders.push(shader);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      };
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      [oldImage, newImage].forEach((image, index) => {
        const texture = gl.createTexture(); textures.push(texture);
        gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.uniform1i(gl.getUniformLocation(program, index ? "nextMap" : "paper"), index);
      });
      const timeUniform = gl.getUniformLocation(program, "time");
      const progressUniform = gl.getUniformLocation(program, "progress");
      const resolutionUniform = gl.getUniformLocation(program, "resolution");
      return {
        draw(time, progress) {
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform1f(timeUniform, time);
          gl.uniform1f(progressUniform, progress);
          gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
        dispose,
      };
    } catch (error) {
      console.warn("Burning paper renderer unavailable", error);
      dispose();
      return null;
    }
  }
  window.KF_BURNING_PAPER = { create };
})();
