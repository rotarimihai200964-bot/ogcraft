(()=>{
 "use strict";
 const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 const aura=document.createElement("div");
 aura.className="cursor-aura";
 if(reducedMotion)aura.classList.add("is-reduced-motion");
 aura.setAttribute("aria-hidden","true");
 document.body.appendChild(aura);

 let previousX=0,previousY=0,lastSpark=0,sparkIndex=0;
 const handleMouseMove=event=>{
  if(event.pointerType&&event.pointerType!=="mouse")return;
  aura.style.setProperty("--cursor-x",`${event.clientX}px`);
  aura.style.setProperty("--cursor-y",`${event.clientY}px`);
  aura.classList.add("is-visible");

  const distance=Math.hypot(event.clientX-previousX,event.clientY-previousY);
  const now=performance.now();
  if(reducedMotion||distance<24||now-lastSpark<32)return;
  previousX=event.clientX;
  previousY=event.clientY;
  lastSpark=now;

  const spark=document.createElement("span");
  spark.className=`cursor-spark${sparkIndex++%2?" is-gold":""}`;
  spark.setAttribute("aria-hidden","true");
  spark.style.left=`${event.clientX}px`;
  spark.style.top=`${event.clientY}px`;
  document.body.appendChild(spark);
  if(document.querySelectorAll(".cursor-spark").length>24){
   document.querySelector(".cursor-spark").remove();
  }
  spark.addEventListener("animationend",()=>spark.remove(),{once:true});
 };
 if(window.PointerEvent){
  document.addEventListener("pointermove",handleMouseMove,{passive:true});
 }else{
  document.addEventListener("mousemove",handleMouseMove,{passive:true});
 }

 document.addEventListener("pointerover",event=>{
  if(event.pointerType==="mouse"&&event.target.closest("a,button,input,textarea,select,label")){
   aura.classList.add("is-hovering");
  }
 });
 document.addEventListener("pointerout",event=>{
  if(event.pointerType==="mouse"&&event.target.closest("a,button,input,textarea,select,label")){
   aura.classList.remove("is-hovering");
  }
 });
 document.addEventListener("pointerdown",event=>{
  if(event.pointerType==="mouse")aura.classList.add("is-pressed");
 });
 document.addEventListener("pointerup",()=>aura.classList.remove("is-pressed"));
})();
