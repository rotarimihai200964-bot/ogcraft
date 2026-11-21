/* Lightweight copy discouragement, not real protection. Content can still be copied. */
(()=>{"use strict";
 document.addEventListener("contextmenu",e=>{if(e.target.closest("img,.hero-logo"))e.preventDefault();});
 document.querySelectorAll("img").forEach(img=>{img.draggable=false;});
 document.addEventListener("dragstart",e=>{if(e.target.tagName==="IMG")e.preventDefault();});
})();