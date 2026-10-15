/* Zapsite motion layer: decorative only. Content never depends on this file. */
(function(){
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;if(RM)return;
var fine=matchMedia('(hover:hover) and (pointer:fine)').matches,d=document,root=d.documentElement;
root.classList.add('mo');
/* scroll progress bar */
var bar=d.createElement('div');bar.className='sprog';d.body.appendChild(bar);
/* cursor glow (desktop) */
var cg=null;if(fine){cg=d.createElement('div');cg.className='cglow';d.body.appendChild(cg);var cx=innerWidth/2,cy=innerHeight/3,tx=cx,ty=cy;
 addEventListener('pointermove',function(e){tx=e.clientX;ty=e.clientY},{passive:true})}
/* parallax targets */
var par=[].slice.call(d.querySelectorAll('[data-par]'));
var dev=d.querySelector('.dev');if(dev){dev.dataset.par=innerWidth>900?'-0.12':'-0.05';par.push(dev)}
var dph=d.querySelector('.dph');if(dph&&innerWidth>900){dph.dataset.par='-0.18';par.push(dph)}
var cs=d.querySelector('.csimg');if(cs){cs.dataset.par='0.05';par.push(cs)}
/* 3D tilt */
var tilt=[].slice.call(d.querySelectorAll('.tc2,.plan,.ad,.card'));
if(fine)tilt.forEach(function(el){el.classList.add('tilt');el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.setProperty('--rx',(-y*8).toFixed(2)+'deg');el.style.setProperty('--ry',(x*10).toFixed(2)+'deg');el.style.setProperty('--mx',((x+.5)*100).toFixed(1)+'%');el.style.setProperty('--my',((y+.5)*100).toFixed(1)+'%')});
 el.addEventListener('pointerleave',function(){el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')})});
else{var io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('sway',e.isIntersecting)})},{threshold:.2});tilt.forEach(function(el){io.observe(el)})}
/* pause CSS loops offscreen */
var loops=[].slice.call(d.querySelectorAll('.mq,.live,.tci2,.steps3,.dev'));
var lo=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('paused',!e.isIntersecting)})});loops.forEach(function(el){lo.observe(el)});
/* main loop */
var lastY=-1;
function frame(t){var y=scrollY,vh=innerHeight;
 if(y!==lastY){lastY=y;var max=root.scrollHeight-vh;bar.style.transform='scaleX('+(max>0?y/max:0)+')';
  par.forEach(function(el){var r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;var c=(r.top+r.height/2-vh/2);el.style.translate='0 '+(c*parseFloat(el.dataset.par)).toFixed(1)+'px'})}
 if(cg){cx+=(tx-cx)*.12;cy+=(ty-cy)*.12;cg.style.transform='translate3d('+(cx-300)+'px,'+(cy-300)+'px,0)'}
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
})();
