(() => {
const panel = document.querySelector('#fractalPanel');
const canvas = document.querySelector('#fractalCanvas');
const context = canvas.getContext('2d');
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
  if (!worker || document.hidden || !canvas.clientWidth) return;
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

  worker.postMessage({width,height,yStart:0,yEnd:height,centerX,centerY,spanX:span,spanY:span*ratio,
    maxIter:Math.round((steering?70:170)+12*Math.log2(3.2/span)),palette:[[72,23,105],[61,78,138],[41,123,142],[33,165,133],[101,203,94],[216,226,25]]});
}
let frameRequest;
function closeFractal() {
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
  worker = new Worker('./fractal-worker.js');
  worker.onmessage = ({data}) => {
    canvas.width = data.width;
    canvas.height = data.height;
    context.putImageData(new ImageData(new Uint8ClampedArray(data.buffer),canvas.width,canvas.height),0,0);
    frameRequest = requestAnimationFrame(draw);
  };
  draw();
};
canvas.addEventListener('click', () => {
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
  if (document.hidden && worker) closeFractal();
});
})();
