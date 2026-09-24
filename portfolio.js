(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let motion=!reduced.matches;
const canvas=$('#growth-system'),ctx=canvas.getContext('2d'),graph=$('#graph'),length=graph.getTotalLength(),work=$('#work'),profile=$('.profile');
let W=innerWidth,H=innerHeight,D=0,queued=false,start=performance.now(),metrics={},points=[],branches=[];
document.documentElement.classList.add('js');
function curve(a,b,c,d,n=90){let out=[];for(let i=0;i<=n;i++){let t=i/n,u=1-t;out.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]])}return out}
function measure(){
 W=innerWidth;H=innerHeight;D=document.documentElement.scrollHeight;
 const dpr=Math.min(devicePixelRatio||1,2);canvas.style.position='fixed';canvas.style.height=H+'px';canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
 // Measure the actual headline text, not the full-width span box.
 const textRange=document.createRange();textRange.selectNodeContents($('.hero h1 .serif'));
 const label=textRange.getBoundingClientRect(),explanation=$('.hero-explanation').getBoundingClientRect();
 const top=el=>el.getBoundingClientRect().top+scrollY;
 const root=$('.root-field'),rootY=top(root)+8,rootH=root.offsetHeight-20;
 const a=[label.left+label.width*.24,Math.min(label.bottom+4,explanation.top-18)+scrollY];
 metrics={x:a[0],y:a[1],work:top(work),workHeight:work.offsetHeight,about:top(profile),title:top($('#profile-title')),studies:top($('#studies')),rootY,rootH};
 const wy=metrics.work,wh=metrics.workHeight,ay=metrics.about;
 const course=$('.course-name').getBoundingClientRect();
 const pad=W<760?17:27;
 const l=course.left-pad,r=course.right+pad,t=course.top+scrollY-18,b=course.bottom+scrollY+18;
 const cy=(t+b)/2,rr=20;
 const rail=Math.min(W-12,Math.max(label.right+18,r+24));
 const junction=[W*.53,rootY];
 // Keep the descent outside the paragraph. The loop surrounds the measured course label,
 // with straight outer edges and softly rounded corners, so no arc cuts through the glyphs.
 const segments=[
  [[a[0]+(rail-a[0])*.4,a[1]],[rail-25,a[1]+2],[rail,a[1]+2]],
  [[rail,explanation.bottom+scrollY+35],[rail,cy-45],[r,cy]],
  [[r,cy+10],[r,b-rr],[r,b-rr]],
  [[r,b],[r,b],[r-rr,b]],
  [[r-(r-l)*.32,b+3],[l+(r-l)*.32,b+3],[l+rr,b]],
  [[l,b],[l,b],[l,b-rr]],
  [[l,cy+5],[l,cy-5],[l,t+rr]],
  [[l,t],[l,t],[l+rr,t]],
  [[l+(r-l)*.32,t-4],[r-(r-l)*.32,t-4],[r-rr,t]],
  [[r,t],[r,t],[r,t+rr]],
  [[r,cy-8],[r,cy-2],[r,cy]],
  [[rail,cy+12],[rail,ay+20],[W*.91,ay+profile.offsetHeight*.20]],
  [[W*.94,ay+profile.offsetHeight*.35],[W*.94,ay+profile.offsetHeight*.52],[W*.91,ay+profile.offsetHeight*.72]],
  [[W*.89,wy-35],[W*.87,wy+wh*.02],[W*.76,wy+wh*.12]],
  [[W*.70,wy+wh*.40],[W*.13,wy+wh*.10],[W*.18,wy+wh*.52]],
  [[W*.22,wy+wh*.90],[W*.86,wy+wh*.54],[W*.80,wy+wh*.87]],
  [[W*.92,rootY-150],[W*.53,rootY-120],junction]
 ];
 points=[];let prev=a;
 for(const [b,c,d] of segments){points.push(...curve(prev,b,c,d));prev=d;}
 metrics.frameCount=91;
 // Asymmetric calligraphic stems: two broad S-curves, with a few curled offshoots.
 branches=[];
 for(const [i,id] of ['#contact-email','#contact-linkedin'].entries()){
  const r=$(id).getBoundingClientRect(),side=i===0?-1:1;
  const end=[r.left+r.width*.5,r.top+scrollY-12];
  const mid=[W*(i===0?.33:.74),rootY+rootH*.43];
  const main=[...curve(junction,[W*(i===0?.55:.65),rootY+rootH*.12],[W*(i===0?.19:.91),rootY+rootH*.18],mid,90),
   ...curve(mid,[W*(i===0?.44:.61),rootY+rootH*.65],[end[0]+side*W*.12,end[1]-rootH*.12],end,90).slice(1)];
  const parent=branches.length,begin=i*.045,finish=i===0?.92:1;
  branches.push({pts:main,width:i===0?4.4:3.6,begin,finish,level:0,phase:i*2.1});
  for(const [j,t] of (i===0?[[0,.28],[1,.59]]:[[0,.41],[1,.65]])){
   const attachment=Math.floor(t*(main.length-1)),origin=main[attachment];
   const dx=side*W*(j===0?.10:.065),dy=rootH*(j===0?.21:.15);
   const tip=[clamp(origin[0]+dx,30,W-30),origin[1]+dy];
   const curlEnd=[tip[0]-side*W*.023,tip[1]-rootH*.018];
   const leaf=[...curve(origin,[origin[0]+dx*.6,origin[1]+dy*.05],[tip[0]+dx*.22,tip[1]-dy*.2],tip,55),
    ...curve(tip,[tip[0]-side*W*.017,tip[1]+12],[curlEnd[0]-side*8,curlEnd[1]+6],curlEnd,25).slice(1)];
   const birth=lerp(begin,finish,t);
   branches.push({pts:leaf,width:j===0?1.65:1.3,begin:birth,finish:Math.min(1,birth+.26),level:1,parent,attachment,phase:1.3+i*2+j});
  }
 }
 request();
}
function stroke(pts,width,alpha,y,count=pts.length,taper=false){
 const n=Math.min(pts.length,Math.floor(count));if(n<2)return;
 ctx.strokeStyle=`rgba(255,112,79,${alpha})`;ctx.lineCap='round';ctx.lineJoin='round';
 if(!taper){ctx.beginPath();ctx.lineWidth=width;ctx.moveTo(pts[0][0],pts[0][1]-y);for(let i=1;i<n;i++)ctx.lineTo(pts[i][0],pts[i][1]-y);ctx.stroke();return;}
 for(let i=1;i<n;i++){ctx.lineWidth=Math.max(.45,width*(.7+.45*Math.sin(Math.PI*i/(pts.length-1)))*Math.pow(1-i/(pts.length-1),.65));ctx.beginPath();ctx.moveTo(pts[i-1][0],pts[i-1][1]-y);ctx.lineTo(pts[i][0],pts[i][1]-y);ctx.stroke();}
}
// Slow movement keeps stems and contour leaves connected; contact endpoints stay fixed.
function livingBranches(now){
 if(!motion)return branches.map(b=>b.pts);
 const time=now*.00038,shapes=[];
 for(const b of branches){
  let attachX=0,attachY=0;
  if(b.parent!==undefined){
   const p=shapes[b.parent][b.attachment],original=branches[b.parent].pts[b.attachment];
   attachX=p[0]-original[0];attachY=p[1]-original[1];
  }
  shapes.push(b.pts.map((p,i)=>{
   const t=i/(b.pts.length-1),envelope=b.level===0?Math.sin(Math.PI*t):Math.sin(Math.PI*t*.78);
   const wave=Math.sin(time+b.phase+t*4.2)+.25*Math.sin(time*1.5-t*5+b.phase);
   const amplitude=W<760?5:9;
   return [p[0]+attachX*(1-t)+envelope*wave*amplitude,
    p[1]+attachY*(1-t)+envelope*Math.cos(time*.8+t*3+b.phase)*2.8];
  }));
 }
 return shapes;
}
// Botanical contours are traced by scroll, with no fill or scaling.
function drawLeaves(shape,branch,index,progress,y){
 const positions=branch.level===0?[.25,.58]:[.54];
 positions.forEach((t,k)=>{
  const reveal=motion?smooth((progress-t)/.16):1;if(reveal<=0)return;
  const i=Math.floor(t*(shape.length-1)),p=shape[i],q=shape[Math.min(i+2,shape.length-1)];
  const side=(index+k)%2?1:-1;
  const angle=Math.atan2(q[1]-p[1],q[0]-p[0])+side*(branch.level===0?.95:1.2);
  const size=Math.min(W*.077,110)*(branch.level===0?1:.68)*(k?.82:1);
  const outline=[...curve([0,0],[size*.24,-size*.22],[size*.76,-size*.27],[size,0],44),
   ...curve([size,0],[size*.62,size*.07],[size*.29,size*.22],[0,0],44).slice(1)];
  const vein=curve([size*.03,0],[size*.30,-size*.025],[size*.60,-size*.035],[size*.82,-size*.008],36);
  const place=pts=>pts.map(([x,v])=>[p[0]+x*Math.cos(angle)-v*Math.sin(angle),p[1]+x*Math.sin(angle)+v*Math.cos(angle)]);
  stroke(place(outline),branch.level===0?1.35:1.05,.83,y,1+reveal*(outline.length-1));
  const veinReveal=smooth((reveal-.5)*2);
  stroke(place(vein),.65,.38,y,1+veinReveal*(vein.length-1));
 });
}
function render(now){queued=false;let y=scrollY,intro=motion?clamp((now-start)/2300):1;graph.style.strokeDasharray=length;graph.style.strokeDashoffset=length*(1-intro);$('.crossbar').style.opacity=clamp((intro-.7)*8);$('#graph-arrow').style.opacity=clamp((intro-.94)*18);document.documentElement.style.setProperty('--progress',clamp(y/Math.max(1,D-H))*100+'%');
for(const [i,key] of ['a','b','c'].entries()){$('#profile-title').style.setProperty('--title-'+key,motion?smooth((y+H*(.86-i*.085)-metrics.title)/(H*.31)):1)}
const studyProgress=motion?smooth((y+H*.88-metrics.studies)/(H*.55)):1;
const courseProgress=motion?smooth((y+H*.70-metrics.studies)/(H*.42)):1;
$('#studies').style.setProperty('--study-progress',studyProgress);
$('#studies').style.setProperty('--course-progress',courseProgress);
// Both cases stay visible and interactive; only a small difference in scroll speed.
const drift=clamp((y-metrics.work+H*.35)/Math.max(1,H),-1,1);
$('.case-one').style.transform=motion?`translateY(${drift*-22}px) rotate(-2deg)`:'none';
$('.case-two').style.transform=motion?`translateY(${drift*-42}px) rotate(2deg)`:'none';
$('.case-one').inert=false;$('.case-two').inert=false;
ctx.clearRect(0,0,W,H);
// Draw to a position in the viewport, not a percentage of the document's path length.
// This keeps the visible tip moving with the reader through both the cases and the bio.
const front=motion?lerp(metrics.y,y+H*.78,smooth(y/(H*.4))):D;
const frameIntro=motion?clamp((now-start-2200)/1300):1;
let count=points.length;
if(motion){count=1;while(count<points.length && points[count][1]<=front)count++;}
count=Math.max(count,Math.floor(metrics.frameCount*frameIntro));
if(intro>.95){
 stroke(points,W<760?3.3:4.2,.94,y,count);
 const rootTravel=Math.max(1,Math.min(metrics.rootH,D-H*.22-metrics.rootY));
 const growth=motion?clamp((front-metrics.rootY)/rootTravel):1;
 if(count>=points.length){
  const shapes=livingBranches(now);
  branches.forEach((b,i)=>{
   const progress=clamp((growth-b.begin)/(b.finish-b.begin)),n=Math.floor(progress*(b.pts.length-1))+1;
   stroke(shapes[i],b.width,b.level===0?.96:.82,y,n,true);
   drawLeaves(shapes[i],b,i,progress,y);
  });
 }
}
const contactVisible=y+H>metrics.rootY && y<metrics.rootY+metrics.rootH;
if(!document.hidden&&(intro<1||frameIntro<1||(motion&&contactVisible)))request()}
function request(){if(!queued){queued=true;requestAnimationFrame(render)}}
function setMotion(value){motion=value;document.body.classList.toggle('no-motion',!motion);document.body.classList.toggle('motion-on',motion);$('.motion').textContent='Motion: '+(motion?'on':'off');$('.motion').setAttribute('aria-pressed',String(!motion));if(!motion){$$('.floating-case').forEach(e=>e.inert=false);$('.scene-heading').style.opacity=1;$('.scene-heading').style.transform='none'}measure()}
$$('.experience-detail').forEach(detail=>detail.addEventListener('toggle',()=>{
 if(detail.open)$$('.experience-detail').forEach(other=>{if(other!==detail)other.open=false});
 requestAnimationFrame(measure);
}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)request()});
$('.motion').addEventListener('click',()=>setMotion(!motion));reduced.addEventListener('change',e=>setMotion(!e.matches));
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');observer.unobserve(e.target)}}),{threshold:.1});$$('.reveal').forEach(e=>observer.observe(e));
addEventListener('scroll',request,{passive:true});addEventListener('resize',measure);addEventListener('load',measure);$('#portrait-slot img').addEventListener('load',measure);setMotion(motion);
})();

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-dl-event]').forEach(function (el) {
    el.addEventListener('click', function () {
      var payload = { event: el.getAttribute('data-dl-event') };
      Array.from(el.attributes).forEach(function (attr) {
        if (attr.name.startsWith('data-dl-') && attr.name !== 'data-dl-event') {
          payload[attr.name.replace('data-dl-', '')] = attr.value;
        }
      });
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
    });
  });
});
