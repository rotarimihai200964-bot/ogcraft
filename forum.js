(()=>{
 "use strict";
 const STORAGE_KEY="ogcraft-forum-posts";
 const PROFILE_KEY="ogcraft-forum-profile";
 const cfg=window.OGC_CONFIG||{};
 let remotePosts=[];
 const categories={
  announcements:"Anunțuri și noutăți",
  factions:"Facțiuni și alianțe",
  events:"Evenimente și povești",
  help:"Sugestii și ajutor"
 };
 const severityLabels={info:"Informativă",normal:"Normală",important:"Importantă",urgent:"Urgentă"};
 const categorySeverities={announcements:"info",factions:"important",events:"normal",help:"urgent"};
 const $=id=>document.getElementById(id);
 const profileForm=$("profileForm"),profileName=$("profileName"),profileRank=$("profileRank");
 const form=$("discussionForm");
 const messageInput=$("discussionMessage"),imageInput=$("discussionImages");
 const chatMessages=$("chatMessages"),chatSection=$("chatSection");
 const formError=$("formError"),publishButton=$("publishButton");
 const attachmentStatus=$("attachmentStatus");
 const landingSections=[
  document.querySelector(".page-title"),
  $("profileNote").closest(".panel"),
  document.querySelector(".category-panel"),
  document.querySelector(".local-forum-note"),
  document.querySelector("footer")
 ];
 let selectedCategory="";
 const maxImageBytes=400*1024,maxImages=3;
 const chatApiUrl=typeof cfg.chatApiUrl==="string"?cfg.chatApiUrl.trim(): "";

 const refreshRemotePosts=async category=>{
  if(!chatApiUrl)return;
  try{
   const url=new URL(chatApiUrl,location.href);
   if(category)url.searchParams.set("category",category);
   const response=await fetch(url.toString(),{headers:{Accept:"application/json"}});
   if(!response.ok)throw new Error(`Chat API returned ${response.status}`);
   const data=await response.json();
   if(!data||!Array.isArray(data.messages))throw new Error("Chat API returned invalid data");
   remotePosts=data.messages.map(post=>{
    if(post.createdAt)return post;
    return {...post,createdAt:post.created_at||new Date().toISOString()};
   });
  }catch(error){
   console.error("Mesajele comune nu au putut fi încărcate:",error);
  }
 };

 const readJson=(key,fallback)=>{
  try{
   const value=localStorage.getItem(key);
   return value?JSON.parse(value):fallback;
  }catch(error){
   console.error(`Nu s-au putut citi datele forumului (${key}):`,error);
   return fallback;
  }
 };
 const saveProfile=profile=>{
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));return true;}
  catch(error){console.error("Nu s-a putut salva profilul:",error);return false;}
 };
 const getPosts=()=>{
  const posts=readJson(STORAGE_KEY,[]);
  const localPosts=Array.isArray(posts)?posts.filter(post=>post&&typeof post==="object"&&typeof post.id==="string"):[];
  const merged=new Map();
  localPosts.forEach(post=>merged.set(post.id,post));
  remotePosts.forEach(post=>merged.set(post.id,post));
  return [...merged.values()];
 };
 const setFormError=message=>{
  formError.textContent=message;
  formError.hidden=!message;
 };

 const profile=readJson(PROFILE_KEY,{name:"",rank:""});
 profileName.value=profile.name||"";
 profileRank.value=profile.rank||"";
 updateMessagePlaceholder();
 profileForm.addEventListener("submit",event=>{
  event.preventDefault();
  const name=profileName.value.trim(),rank=profileRank.value.trim();
  if(!/^[A-Za-z0-9_]{3,16}$/.test(name)){
   profileName.setCustomValidity("Folosește 3-16 litere, cifre sau underscore.");
   profileName.reportValidity();
   return;
  }
  profileName.setCustomValidity("");
  if(!saveProfile({name,rank:rank.slice(0,24)})){
   $("profileNote").textContent="Profilul nu a putut fi salvat. Verifică spațiul disponibil în browser.";
   return;
  }
  $("profileNote").textContent="Profil salvat pe acest dispozitiv. Rangul este introdus de tine și nu este verificat.";
 updateMessagePlaceholder();
 });
 profileName.addEventListener("input",()=>profileName.setCustomValidity(""));

 const setSeverity=severity=>{
  ["info","normal","important","urgent"].forEach(value=>{
   publishButton.classList.remove(`severity-${value}`);
  });
  publishButton.classList.add(`severity-${severity}`);
  publishButton.setAttribute("aria-label",`Trimite mesaj ${severityLabels[severity].toLocaleLowerCase("ro")}`);
  chatSection.classList.add(`composer-severity-${severity}`);
 };
  function updateMessagePlaceholder(){
  const currentProfile=readJson(PROFILE_KEY,{name:"",rank:""});
  messageInput.placeholder=currentProfile.name?`Message @${currentProfile.name}`:"Message";
  }
 const setRoomVisible=visible=>{
  landingSections.forEach(section=>{section.hidden=visible;});
  chatSection.hidden=!visible;
 };

 document.querySelectorAll(".discuss-button").forEach(button=>{
  button.addEventListener("click",()=>{
   selectedCategory=button.dataset.category;
    setSeverity(categorySeverities[selectedCategory]||button.dataset.severity);
   $("chatTitle").textContent=categories[selectedCategory];
   $("chatCategoryDescription").textContent=`Chat · ${categories[selectedCategory]}`;
   setRoomVisible(true);
   setSeverity(categorySeverities[selectedCategory]||"normal");
   history.replaceState(null,"",`#discutii-${selectedCategory}`);
   renderMessages();
   chatSection.scrollIntoView({behavior:"smooth",block:"start"});
  });
 });

 $("backToCategories").addEventListener("click",()=>{
  selectedCategory="";
  setRoomVisible(false);
  history.replaceState(null,"",location.pathname);
  window.scrollTo({top:0,behavior:"smooth"});
 });

 $("attachButton").addEventListener("click",()=>imageInput.click());
 imageInput.addEventListener("change",()=>{
  const count=imageInput.files.length;
  attachmentStatus.hidden=count===0;
  attachmentStatus.textContent=count?`${count} imagini selectate`:"";
 });
 $("emojiButton").addEventListener("click",()=>{messageInput.setRangeText("☺ ",messageInput.selectionStart,messageInput.selectionEnd,"end");messageInput.focus();});
 $("gifButton").addEventListener("click",()=>{messageInput.setRangeText("[GIF] ",messageInput.selectionStart,messageInput.selectionEnd,"end");messageInput.focus();});
 $("giftButton").addEventListener("click",()=>{messageInput.setRangeText("🎁 ",messageInput.selectionStart,messageInput.selectionEnd,"end");messageInput.focus();});
 $("peopleButton").addEventListener("click",()=>{
  const currentProfile=readJson(PROFILE_KEY,{name:"",rank:""});
  messageInput.setRangeText(currentProfile.name?`@${currentProfile.name} `:"@",messageInput.selectionStart,messageInput.selectionEnd,"end");
  messageInput.focus();
 });
 const readImage=file=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.addEventListener("load",()=>resolve(reader.result));
  reader.addEventListener("error",()=>reject(reader.error||new Error("Imaginea nu a putut fi citită.")));
  reader.readAsDataURL(file);
 });

 form.addEventListener("submit",async event=>{
  event.preventDefault();
  setFormError("");
  if(!selectedCategory){
   setFormError("Alege o categorie înainte să trimiți un mesaj.");
   return;
  }
  const currentProfile=readJson(PROFILE_KEY,{name:"",rank:""});
  if(!currentProfile.name){
   setFormError("Salvează-ți numele și rangul în profilul din pagina de categorii.");
   return;
  }
  const files=Array.from(imageInput.files||[]);
  if(files.length>maxImages){
   setFormError(`Poți atașa cel mult ${maxImages} imagini.`);
   return;
  }
  if(files.some(file=>!["image/jpeg","image/png","image/gif","image/webp"].includes(file.type)||file.size>maxImageBytes)){
   setFormError("Alege poze JPEG, PNG, GIF sau WebP, fiecare de maximum 400 KB.");
   return;
  }

  publishButton.disabled=true;
  try{
   const images=await Promise.all(files.map(readImage));
    const post={
    id:window.crypto&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category:selectedCategory,
    severity:categorySeverities[selectedCategory]||"normal",
    message:messageInput.value.trim(),
    author:currentProfile.name,
    rank:currentProfile.rank||"Jucător",
    createdAt:new Date().toISOString(),
    images
    };
    if(chatApiUrl){
     const response=await fetch(chatApiUrl,{
      method:"POST",
      headers:{Accept:"application/json","Content-Type":"application/json"},
      body:JSON.stringify(post)
     });
     if(!response.ok){
      let detail="";
      try{detail=(await response.json()).error||"";}catch(error){}
      throw new Error(detail||`Chat API returned ${response.status}`);
     }
     const data=await response.json();
     if(data&&data.message)remotePosts=[...remotePosts.filter(item=>item.id!==data.message.id),data.message];
    }else{
     const posts=getPosts();
     posts.push(post);
     localStorage.setItem(STORAGE_KEY,JSON.stringify(posts.slice(-100)));
    }
   renderMessages();
   form.reset();
   setSeverity(categorySeverities[selectedCategory]||"normal");
  }catch(error){
   console.error("Mesajul nu a putut fi salvat:",error);
   setFormError("Mesajul nu a putut fi salvat. Spațiul local al browserului poate fi plin; încearcă să elimini poze.");
  }finally{publishButton.disabled=false;}
 });

 const formatDate=value=>{
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "Dată necunoscută";
  return new Intl.DateTimeFormat("ro-RO",{dateStyle:"medium",timeStyle:"short"}).format(date);
 };
 const renderMessages=async()=>{
  await refreshRemotePosts(selectedCategory);
  const posts=getPosts()
   .filter(post=>post.category===selectedCategory&&categories[post.category])
   .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  chatMessages.replaceChildren();
  if(!posts.length){
   const empty=document.createElement("p");
   empty.className="muted empty-discussions";
   empty.textContent="Chatul este gol. Scrie primul mesaj mai jos.";
   chatMessages.appendChild(empty);
   return;
  }
  const currentProfile=readJson(PROFILE_KEY,{name:"",rank:""});
  posts.forEach(post=>{
   const severity=severityLabels[post.severity]?post.severity:"normal";
   const article=document.createElement("article");
   article.className=`chat-message severity-border-${severity}${post.author===currentProfile.name?" is-own":""}`;
   const meta=document.createElement("div");
   meta.className="chat-message-meta";
   const identity=document.createElement("strong");
   identity.textContent=`${post.author} · ${post.rank||"Jucător"}`;
   const category=document.createElement("span");
   category.textContent=categories[post.category];
   const level=document.createElement("span");
   level.className=`severity-label severity-${severity}`;
   level.textContent=severityLabels[severity];
   meta.append(identity,category,level);
   const message=document.createElement("p");
   message.className="chat-message-text";
   message.textContent=post.message||[post.title,post.description].filter(Boolean).join("\n");
   const footer=document.createElement("time");
   footer.dateTime=post.createdAt;
   footer.textContent=formatDate(post.createdAt);
   article.append(meta,message);
   if(Array.isArray(post.images)&&post.images.length){
    const gallery=document.createElement("div");
    gallery.className="discussion-images";
    post.images.slice(0,maxImages).forEach((source,index)=>{
     if(typeof source!=="string"||!source.startsWith("data:image/"))return;
     const image=document.createElement("img");
     image.src=source;
     image.alt=`Imagine ${index+1} atașată la mesaj`;
     image.loading="lazy";
     gallery.appendChild(image);
    });
    if(gallery.childElementCount)article.appendChild(gallery);
   }
   article.appendChild(footer);
   chatMessages.appendChild(article);
  });
  chatMessages.scrollTop=chatMessages.scrollHeight;
 };

  const refreshServerStatus=async()=>{
   const text=$("serverStatusText"),dot=$("serverStatusDot");
   const serverIp=cfg.serverIP||"";
   if(!serverIp){
    text.textContent="Configurează IP-ul serverului.";
    dot.className="server-status-dot is-offline";
    return;
   }
   try{
    const response=await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(serverIp)}`);
    if(!response.ok)throw new Error(`Status API returned ${response.status}`);
    const data=await response.json();
    if(!data.online){
     text.textContent="Server offline";
     dot.className="server-status-dot is-offline";
     return;
    }
    const online=data.players&&typeof data.players.online==="number"?data.players.online:0;
    text.textContent=`Server online · ${online} ${online===1?"jucător":"jucători"}`;
    dot.className="server-status-dot is-online";
   }catch(error){
    console.error("Starea serverului nu a putut fi încărcată:",error);
    text.textContent="Starea serverului indisponibilă";
    dot.className="server-status-dot";
   }
  };
  const serverStatusIp=$("serverStatusIp");
  if(serverStatusIp){
   serverStatusIp.textContent=cfg.serverIP||"IP nesetat";
   serverStatusIp.addEventListener("click",async()=>{
    try{
     await navigator.clipboard.writeText(cfg.serverIP||"");
     serverStatusIp.textContent="IP COPIAT";
     setTimeout(()=>serverStatusIp.textContent=cfg.serverIP||"IP nesetat",1200);
    }catch(error){window.prompt("IP-ul serverului:",cfg.serverIP||"");}
   });
  }
  refreshServerStatus();
  const serverInterval=Number.isFinite(cfg.serverRefreshInterval)&&cfg.serverRefreshInterval>=10000
   ?cfg.serverRefreshInterval:30000;
  window.setInterval(refreshServerStatus,serverInterval);

 window.addEventListener("storage",event=>{
  if(event.key===STORAGE_KEY)renderMessages();
  if(event.key===PROFILE_KEY){
   const updated=readJson(PROFILE_KEY,{name:"",rank:""});
   profileName.value=updated.name||"";
   profileRank.value=updated.rank||"";
   updateMessagePlaceholder();
   renderMessages();
  }
 });

 const initialCategory=location.hash.startsWith("#discutii-")?location.hash.slice("#discutii-".length):"";
 if(categories[initialCategory]){
  const categoryButton=document.querySelector(`.discuss-button[data-category="${initialCategory}"]`);
  if(categoryButton)categoryButton.click();
 }
 renderMessages();
})();
