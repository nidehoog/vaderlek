(() => {
const panel = document.querySelector('#fractalPanel');
let canvas = document.querySelector('#fractalCanvas');
let gpu, context, active = false;
const palette = [[72,23,105],[61,78,138],[41,123,142],[33,165,133],[101,203,94],[216,226,25]];

function createGPU(surface) {
  const gl = surface.getContext('webgl2', {alpha:false, antialias:false, depth:false, stencil:false});
  if (!gl) return null;
  const sources = [
    [gl.VERTEX_SHADER, `#version 300 es
      void main() {
        vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
        gl_Position = vec4(p * 2.0 - 1.0, 0, 1);
      }`],
    [gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      precision highp int;
      uniform vec2 center, size, spanXY;
      uniform int limit;
      uniform vec3 colors[6];
      out vec4 pixel;
      void main() {
        // Match the top-down, integer pixel coordinates of the CPU renderer.
        vec2 pos = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) - 0.5;
        vec2 c = center + (pos / size - 0.5) * spanXY;
        float x = c.x - 0.25, yy = c.y * c.y, q = x*x + yy;
        pixel = vec4(0,0,0,1);
        if (q*(q+x) < 0.25*yy || dot(c+vec2(1,0),c+vec2(1,0)) < 0.0625) return;
        vec2 z = vec2(0);
        for (int i=1; i<limit; ++i) {
          z = vec2(z.x*z.x-z.y*z.y, 2.0*z.x*z.y) + c;
          float mag = dot(z,z);
          if (mag > 4.0) {
            float n = float(i)+1.0-log2(0.5*log2(mag));
            int band = int(floor(n*0.075));
            if (band >= 0) pixel.rgb = floor(colors[band%6]*(0.48+0.52*min(1.0,n/85.0)))/255.0;
            return;
          }
        }
      }`]
  ];
  const program = gl.createProgram();
  for (const [type, source] of sources) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    gl.attachShader(program,shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  gl.uniform3fv(gl.getUniformLocation(program,'colors[0]'),palette.flat());
  const loc = Object.fromEntries(['center','size','spanXY','limit'].map(
    name => [name,gl.getUniformLocation(program,name)]));
  return {gl, render(frame) {
    resize(surface,frame.width,frame.height);
    gl.viewport(0,0,frame.width,frame.height);
    gl.uniform2f(loc.center,frame.centerX,frame.centerY);
    gl.uniform2f(loc.size,frame.width,frame.height);
    gl.uniform2f(loc.spanXY,frame.spanX,frame.spanY);
    gl.uniform1i(loc.limit,frame.maxIter);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }};
}

function resize(surface,width,height) {
  if (surface.width !== width) surface.width = width;
  if (surface.height !== height) surface.height = height;
}

// A canvas can only have one context type. Keep both surfaces for shake/reset.
const gpuCanvas = canvas.cloneNode(false);
const cpuCanvas = canvas;
function showSurface(surface) {
  if (surface !== canvas) {
    canvas.replaceWith(surface);
    canvas = surface;
  }
}
gpuCanvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  gpu = null;
});
gpuCanvas.addEventListener('webglcontextrestored', () => { gpu = createGPU(gpuCanvas); });
let worker, neutral, dx, dy, span, centerX, centerY, speed, lastFrame, lastShake, tapTimer;
function resetView() {
  span = 3.2;
  centerX = -0.743643887037151;
  centerY = 0.131825904205330;
  speed = 1;
}
function orient(event) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  neutral ??= [event.gamma,event.beta];
  const axis = (value,base) => {
    const difference = (value-base+540)%360-180;
    return Math.sign(difference)*Math.min(1,Math.max(0,Math.abs(difference)-2)/25);
  };
  const x = axis(event.gamma,neutral[0]), y = axis(event.beta,neutral[1]);
  const angle = (screen.orientation?.angle ?? window.orientation ?? 0)*Math.PI/180;
  dx = x*Math.cos(angle)+y*Math.sin(angle);
  dy = y*Math.cos(angle)-x*Math.sin(angle);
}
function shake(event) {
  const a = event.acceleration;
  if (a && Math.hypot(a.x,a.y,a.z)>17 && performance.now()-lastShake>900) {
    resetView();
    lastShake = performance.now();
  }
}
function draw() {
  if (!active || document.hidden || !canvas.clientWidth) return;
  const now = performance.now();
  const dt = Math.min(0.2,(now-lastFrame)/1000);
  lastFrame = now;
  const ratio = canvas.clientHeight/canvas.clientWidth;
  centerX += dx*span*dt*0.48;
  centerY += dy*span*ratio*dt*0.48;
  span = Math.max(1e-13,span*Math.exp(-dt*0.12*speed));
  const steering = Math.hypot(dx,dy)>0.03;
  const width = Math.min(steering?240:820,Math.round(canvas.clientWidth*devicePixelRatio));
  const height = Math.max(1,Math.round(width*ratio));

  const frame = {width,height,yStart:0,yEnd:height,centerX,centerY,spanX:span,spanY:span*ratio,
    maxIter:Math.round((steering?70:170)+12*Math.log2(3.2/span)),palette};
  const pixelSize = Math.min(span/width,frame.spanY/height);
  const safeSpacing = Math.max(1,Math.abs(centerX),Math.abs(centerY))*2**-20;
  if (gpu && pixelSize > safeSpacing) {
    showSurface(gpuCanvas);
    gpu.render(frame);
    frameRequest = requestAnimationFrame(draw);
  } else {
    showSurface(cpuCanvas);
    if (!worker) startWorker();
    worker.postMessage(frame);
  }
}
function startWorker() {
  context ??= cpuCanvas.getContext('2d');
  worker = new Worker('./fractal-worker.js');
  worker.onmessage = ({data}) => {
    resize(cpuCanvas,data.width,data.height);
    context.putImageData(new ImageData(new Uint8ClampedArray(data.buffer),canvas.width,canvas.height),0,0);
    frameRequest = requestAnimationFrame(draw);
  };
}
let frameRequest;
function closeFractal() {
  active = false;
  worker?.terminate();
  worker = null;
  cancelAnimationFrame(frameRequest);
  clearTimeout(tapTimer);
  tapTimer = null;
  window.removeEventListener('deviceorientation',orient);
  window.removeEventListener('devicemotion',shake);
  panel.hidden = true;
  panel.classList.remove('expanded');
  document.querySelector('.studioEgg')?.setAttribute('aria-expanded','false');
}
window.toggleFractal = function toggleFractal(egg) {
  if (!panel.hidden) return closeFractal();
  for (const api of [window.DeviceOrientationEvent,window.DeviceMotionEvent]) {
    if (api?.requestPermission) api.requestPermission().catch(()=>{});
  }
  neutral = null;
  dx = dy = 0;
  lastShake = -Infinity;
  lastFrame = performance.now();
  resetView();
  panel.hidden = false;
  egg.setAttribute('aria-expanded','true');
  panel.scrollIntoView({block:'center'});
  window.addEventListener('deviceorientation',orient);
  window.addEventListener('devicemotion',shake);
  active = true;
  if (gpu === undefined) gpu = createGPU(gpuCanvas);
  draw();
};
panel.addEventListener('click', event => {
  if (event.target !== canvas) return;
  if (tapTimer) {
    clearTimeout(tapTimer);
    tapTimer = null;
    if (document.fullscreenElement === panel) document.exitFullscreen();
    else if (panel.classList.contains('expanded')) panel.classList.remove('expanded');
    else if (panel.requestFullscreen) panel.requestFullscreen().catch(()=>panel.classList.add('expanded'));
    else panel.classList.add('expanded');
  } else tapTimer = setTimeout(()=>{speed = speed%5+1; tapTimer = null;},320);
});
document.querySelector('#viewMode').addEventListener('change',closeFractal);
document.addEventListener('visibilitychange',()=>{
  if (document.hidden && active) closeFractal();
});
})();
