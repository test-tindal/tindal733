/* Client-side army builder, powered by BSData 11e JSON. */
(() => {
"use strict";
const E=window.BSDataEngine;
const $=id=>document.getElementById(id);
const SOURCE="https://raw.githubusercontent.com/BSData/wh40k-11e/main/";
const FACTIONS=[
["Necrons","Necrons.json"],["Aeldari - Craftworlds","Aeldari - Craftworlds.json"],["Aeldari - Drukhari","Aeldari - Drukhari.json"],
["Chaos Daemons","Chaos - Chaos Daemons.json"],["Chaos Knights","Chaos - Chaos Knights.json"],["Chaos Space Marines","Chaos - Chaos Space Marines.json"],["Death Guard","Chaos - Death Guard.json"],["Emperor's Children","Chaos - Emperor's Children.json"],["Thousand Sons","Chaos - Thousand Sons.json"],["World Eaters","Chaos - World Eaters.json"],
["Genestealer Cults","Genestealer Cults.json"],["Adepta Sororitas","Imperium - Adepta Sororitas.json"],["Adeptus Custodes","Imperium - Adeptus Custodes.json"],["Adeptus Mechanicus","Imperium - Adeptus Mechanicus.json"],["Agents of the Imperium","Imperium - Agents of the Imperium.json"],["Astra Militarum","Imperium - Astra Militarum.json"],["Black Templars","Imperium - Black Templars.json"],["Blood Angels","Imperium - Blood Angels.json"],["Dark Angels","Imperium - Dark Angels.json"],["Deathwatch","Imperium - Deathwatch.json"],["Grey Knights","Imperium - Grey Knights.json"],["Imperial Knights","Imperium - Imperial Knights.json"],["Space Marines","Imperium - Space Marines.json"],["Space Wolves","Imperium - Space Wolves.json"],["Leagues of Votann","Leagues of Votann.json"],["Orks","Orks.json"],["T'au Empire","T'au Empire.json"],["Tyranids","Tyranids.json"]
];
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stamp=()=>new Date().toISOString().slice(0,10);
const STORAGE="dynastic-command-v2";
let state={faction:"Necrons",detachment:null,limit:2000,items:[],selected:null,tab:"configure",search:"",category:"All",legends:false,loading:true,expanded:{},catalogCollapsed:{}};
let saved={},catalog=null,lastResult=null,history=[],cachedPrices=new Map();
function safeSaved(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return {}}}
function persist(){
 saved[state.faction]={items:state.items,detachment:state.detachment,limit:state.limit,modified:stamp()};
 try{localStorage.setItem(STORAGE,JSON.stringify(saved));}catch(e){notify("Browser storage is full. Export the list for safekeeping.",true)}
}
function snapshot(){history.push(JSON.stringify({items:state.items,detachment:state.detachment,limit:state.limit,selected:state.selected}));if(history.length>30)history.shift()}
function mutate(fn){if(!catalog)return;snapshot();fn();persist();render()}
function notify(message,isError=false){const el=$("toast");el.textContent=message;el.style.borderColor=isError?"#e27d72":"#43bd72";el.style.display="block";clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.style.display="none",3400)}
function safeName(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
const ctxFor=(unit,item)=>({catalog,unit,item,roster:state.items,detachment:catalog.detachments.find(d=>d.id===state.detachment)});
async function loadFaction(name){
 if(!FACTIONS.some(x=>x[0]===name))return;
 $("faction").value=name; $("sourceStatus").textContent="Retrieving "+name+" catalogue from BSData...";$("catalogList").innerHTML='<div class="empty">Receiving dynastic records...</div>';
 state.loading=true;renderBusy();
 try{
   const filename=FACTIONS.find(x=>x[0]===name)[1];
   const response=await fetch(SOURCE+encodeURIComponent(filename),{cache:"no-cache"});
   if(!response.ok)throw Error("Source returned HTTP "+response.status);
   const json=await response.json();
   // Follow BSData catalogue references (e.g. Dark Angels -> Space Marines).
   const imports=[], pending=[...(json.catalogue?.catalogueLinks||[]).map(x=>x.name)], seen=new Set([filename]), missing=[];
   while(pending.length && seen.size<12){
     const importName=pending.shift();
     const importFile=(FACTIONS.find(x=>x[0]===importName)?.[1] || importName+".json");
     if(seen.has(importFile))continue;
     seen.add(importFile);
     try{
       const r=await fetch(SOURCE+encodeURIComponent(importFile),{cache:"no-cache"});
       if(!r.ok)throw Error("HTTP "+r.status);
       const j=await r.json();imports.push(j);
       for(const link of j.catalogue?.catalogueLinks||[])if(!seen.has(link.name+".json"))pending.push(link.name);
     }catch(e){missing.push(importName)}
   }
   const newCatalog=E.makeCatalog(json,imports);
   newCatalog.missingImports=missing;
   if(!newCatalog.roots.length)throw Error("No selectable units were found in this catalogue.");
   catalog=newCatalog;cachedPrices=new Map();history=[];
   state.faction=name;const old=saved[name]||{};
   state.items=Array.isArray(old.items)?old.items.filter(x=>x&&catalog.units.has(x.unitId)&&x.counts&&typeof x.counts==="object"): [];
   state.limit=Number(old.limit)||2000;
   state.detachment=catalog.detachments.some(d=>d.id===old.detachment)?old.detachment:(catalog.detachments[0]?.id||null);
   state.selected=state.items[0]?.key||null;state.tab="configure";state.loading=false;
   $("faction").value=name;$("limit").value=state.limit;
   $("sourceStatus").textContent=name+" • BSData revision "+String(catalog.revision??"?")+" • "+catalog.roots.length+" unit entries • "+catalog.imported+" source files"+(catalog.missingImports.length?" • missing: "+catalog.missingImports.join(", "):"");
   persist();render();
 }catch(e){
   state.loading=false;$("sourceStatus").textContent="Source unavailable: "+e.message;
   $("catalogList").innerHTML='<div class="empty">Could not load BSData.<p>'+escapeHTML(e.message)+'</p><button id="retry">Retry</button></div>';
   $("retry")?.addEventListener("click",()=>loadFaction(name));
   notify("Could not load "+name+". Try again.",true);
 }
}
function renderBusy(){ $("catalogList").innerHTML='<div class="empty">Loading catalogue...</div>'; }
function currentItem(){return state.items.find(x=>x.key===state.selected)||null}
function limitText(n){return n===null?"unrestricted":String(n)}
function modelSummary(unit,item){
 let models=0;E.eachActive(unit,unit.id,item,(n,p,count)=>{if(n!==unit&&n.type==="model")models+=count});
 return models>0?models+" models":(unit.type==="model"?"1 model":"unit");
}
function unitCategory(unit){
 const cats=unit.categoryLinks.map(x=>x.name);
 if(cats.includes("Character"))return "Character";
 if(cats.includes("Battleline"))return "Battleline";
 if(cats.includes("Aircraft"))return "Aircraft";
 if(cats.includes("Vehicle"))return "Vehicle";
 if(cats.includes("Monster"))return "Monster";
 if(cats.includes("Mounted"))return "Mounted";
 if(cats.includes("Infantry"))return "Infantry";
 if(cats.includes("Aircraft"))return "Aircraft";
 return cats.find(c=>!c.startsWith("Faction:"))||"Other";
}
function unitBasePrice(unit){
 if(cachedPrices.has(unit.sourceId))return cachedPrices.get(unit.sourceId);
 const cost=E.itemPoints(catalog,E.makeItem(unit),[],state.detachment);
 cachedPrices.set(unit.sourceId,cost);return cost;
}
function renderCatalog(){
 if(!catalog)return;
 const q=state.search.toLowerCase().trim();
 const entries=catalog.roots.filter(x=>{
   if(!state.legends&&/\[Legends\]/i.test(x.name))return false;
   if(state.category!=="All"&&unitCategory(x)!==state.category)return false;
   return !q||x.name.toLowerCase().includes(q)||x.categoryLinks.some(c=>c.name.toLowerCase().includes(q));
 });
 const order=["Character","Battleline","Infantry","Mounted","Vehicle","Monster","Aircraft","Other"];
 const groups=new Map();
 for(const unit of entries){
   const category=unitCategory(unit);
   if(!groups.has(category))groups.set(category,[]);
   groups.get(category).push(unit);
 }
 $("catalogInfo").textContent=entries.length+" / "+catalog.roots.length+" entries";
 $("catalogList").innerHTML=order.filter(group=>groups.has(group)).concat([...groups.keys()].filter(k=>!order.includes(k))).map(group=>{
   const entries=groups.get(group);
   const open=q.length>0 || state.category!=="All" || state.catalogCollapsed[group]!==true;
   const cards=entries.map(x=>'<div class="catalog-entry"><div class="catalog-name"><strong>'+escapeHTML(x.name)+'</strong><small>'+escapeHTML(unitCategory(x))+'</small></div><span class="catalog-price">'+unitBasePrice(x)+' pts</span><button class="tiny primary" data-action="add" data-unit="'+escapeHTML(x.sourceId)+'" title="Add unit">+</button></div>').join("");
   return '<details class="catalog-group" data-catalog-group="'+escapeHTML(group)+'"'+(open?" open":"")+'><summary><span>'+escapeHTML(group)+'</span><span class="group-counter">'+entries.length+'</span></summary><div class="catalog-entries">'+cards+'</div></details>';
 }).join("")||'<div class="empty">No matching units.</div>';
}
function renderRoster(){
 if(!catalog)return;
 $("armyList").innerHTML=state.items.map((item,idx)=>{
  const u=catalog.units.get(item.unitId);if(!u)return "";
  const ip=lastResult.details.get(item.key)||0;
  return '<div class="army-entry '+(state.selected===item.key?"selected":"")+'" data-action="select" data-key="'+escapeHTML(item.key)+'">'+
   '<div><strong>'+escapeHTML(u.name)+'</strong><div class="army-meta">'+escapeHTML(unitCategory(u))+' • '+escapeHTML(modelSummary(u,item))+'</div></div>'+
   '<span class="army-price">'+ip+' pts</span>'+
   '<div class="army-actions"><button class="tiny" data-action="copy" data-key="'+escapeHTML(item.key)+'" title="Duplicate">Duplicate</button>'+
   '<button class="tiny danger" data-action="remove" data-key="'+escapeHTML(item.key)+'" title="Remove unit">Remove</button></div></div>';
 }).join("")||'<div class="empty">Your legion is empty.<p>Choose a unit from the archives on the left.</p></div>';
 $("pointsDisplay").textContent=lastResult.points+" / "+state.limit+" pts";
 $("pointsDisplay").classList.toggle("over",lastResult.points>state.limit);
 $("unitCount").textContent=state.items.length+" units";
 $("validationBadge").className="badge "+(lastResult.errors.length?"error":lastResult.warnings.length?"warning":"");
 $("validationBadge").textContent=lastResult.errors.length?" "+lastResult.errors.length+" errors":lastResult.warnings.length?" "+lastResult.warnings.length+" warnings":"Checks passed";
 $("messages").innerHTML=lastResult.errors.map(x=>'<li class="error">'+escapeHTML(x)+'</li>').concat(lastResult.warnings.map(x=>'<li>'+escapeHTML(x)+'</li>')).join("");
 $("undo").disabled=history.length===0;
}
function optionRow(node,path,item,unit,isEnhancement=false){
 const value=E.getCount(item,path),ctx=ctxFor(unit,item),max=E.amount(node,"max",ctx);
 const min=E.amount(node,"min",ctx);
 const fixed=min!==null&&max!==null&&min===max;
 const price=E.pts(node);
 const info=isEnhancement?'<button type="button" class="info-mark" data-action="info" data-path="'+escapeHTML(path)+'" title="Show enhancement effect" aria-label="Show effect of '+escapeHTML(node.name)+'">?</button>':"";
 if(node.name==="Warlord"){
   const control='<label class="checkline"><input type="checkbox" data-field="warlord" data-path="'+escapeHTML(path)+'" '+(value?"checked":"")+'><span>Designate</span></label>';
   return '<div class="option-row"><div class="option-label">Warlord</div>'+control+'</div>';
 }
 const control=fixed ? '<span class="option-static">Fixed ×'+value+'</span>':
  '<div class="option-controls"><button class="tiny" data-action="down" data-path="'+escapeHTML(path)+'" '+(!value?"disabled":"")+'>−</button>'+
  '<input aria-label="Quantity '+escapeHTML(node.name)+'" type="number" data-path="'+escapeHTML(path)+'" data-field="qty" min="0" max="'+(max===null?99:max)+'" value="'+value+'">'+
  '<button class="tiny" data-action="up" data-path="'+escapeHTML(path)+'" '+(max!==null&&value>=max?"disabled":"")+'>+</button></div>';
 return '<div class="option-row"><div class="option-label">'+escapeHTML(node.name)+info+(price>0?'<small>+'+price+' pts each</small>':"")+'</div>'+control+'</div>';
}
function showOptionInfo(node) {
 const parts=[];
 for(const p of node.profiles||[]) {
   const lines=E.profileRows(p).map(row=>'<div class="info-description">'+(row.name==="Description"?"":'<strong>'+escapeHTML(row.name)+': </strong>')+escapeHTML(row.value)+'</div>').join("");
   parts.push('<div class="info-effect"><h4>'+escapeHTML(p.name||node.name)+'</h4>'+lines+'</div>');
 }
 for(const link of node.infoLinks||[]) {
   const linked=catalog?.rules.get(link.targetId);
   if(linked)parts.push('<div class="info-effect"><h4>'+escapeHTML(link.name||linked.name)+'</h4><div class="info-description">'+escapeHTML(linked.description||E.profileRows(linked).map(r=>r.value).join("\n"))+'</div></div>');
 }
 for(const rule of node.rules||[])parts.push('<div class="info-effect"><h4>'+escapeHTML(rule.name)+'</h4><div class="info-description">'+escapeHTML(rule.description||"")+'</div></div>');
 $("infoTitle").textContent=node.name;
 $("infoContent").innerHTML=parts.join("")||'<p class="muted">No effect description is available in this BSData entry.</p>';
 const dialog=$("infoDialog");
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}
function renderOptionTree(node,path,item,unit,depth=0,insideEnhancements=false){
 const enhancements=insideEnhancements||node.name==="Enhancements";
 if(depth>12)return "";
 if(["Crusade","Order of Battle","Weapon Modifications"].includes(node.name))return "";
 const ctx=ctxFor(unit,item);
 if(E.isHidden(node,ctx)&&E.getCount(item,path)===0 && !node.group)return "";
 if(node.group){
   const children=node.children.map(child=>renderOptionTree(child,E.keyFor(path,child),item,unit,depth+1,enhancements)).join("");
   if(!children)return "";
   if(E.isHidden(node,ctx))return "";
   const mn=E.amount(node,"min",ctx),mx=E.amount(node,"max",ctx),sum=E.groupSum(node,path,item);
   const range=(mn===null&&mx===null)?"":'<span class="group-limits">'+sum+' / '+(mn??0)+'-'+limitText(mx)+'</span>';
   const id=item.key+":"+path;
   const expanded=(state.expanded[id]===true || (state.expanded[id]===undefined && depth<2))?" open":"";
   return '<details class="option-group" data-group-key="'+escapeHTML(id)+'"'+expanded+'><summary>'+escapeHTML(node.name)+range+'</summary><div class="option-level">'+children+'</div></details>';
 }
 const value=E.getCount(item,path);
 const leaf=optionRow(node,path,item,unit,enhancements);
 const inner=node.children.length&&value?node.children.map(child=>renderOptionTree(child,E.keyFor(path,child),item,unit,depth+1,enhancements)).join(""):"";
 if(!inner)return leaf;
 return '<div>'+leaf+'<div class="option-level">'+inner+'</div></div>';
}
function gatherProfiles(unit,item){
 const profiles=new Map();
 E.eachActive(unit,unit.id,item,(n,path,count)=>{
   for(const p of n.profiles){
     if(!p.typeName || !["Unit","Ranged Weapons","Melee Weapons","Abilities","C'tan Powers","Invulnerable Save"].includes(p.typeName))continue;
     const id=p.id||p.name;
     if(profiles.has(id))continue;
     profiles.set(id,{...p,occurrences:count});
   }
 });
 return [...profiles.values()];
}
function renderDatasheet(unit,item){
 const profiles=gatherProfiles(unit,item);
 const top=profiles.filter(x=>x.typeName==="Unit"),weapons=profiles.filter(x=>/Weapons|Powers/.test(x.typeName)),abilities=profiles.filter(x=>x.typeName==="Abilities"||x.typeName==="Invulnerable Save");
 let html='<p class="small-note">Source datasheet profiles. Some conditional BSData stat modifiers are not yet applied.</p>';
 if(top.length){
  const p=top[0],rows=E.profileRows(p);
  html+='<div class="record"><h3>'+escapeHTML(p.name)+' - Unit characteristics</h3><table class="profile-grid"><tr>'+rows.map(r=>'<th>'+escapeHTML(r.name)+'</th>').join("")+'</tr><tr>'+rows.map(r=>'<td>'+escapeHTML(r.value)+'</td>').join("")+'</tr></table></div>';
 }
 for(const p of weapons){
  html+='<div class="record"><h3>'+escapeHTML(p.name)+' <span class="minor muted">('+escapeHTML(p.typeName)+')</span></h3>'+
  '<table class="profile-grid">'+E.profileRows(p).map(r=>'<tr><th>'+escapeHTML(r.name)+'</th><td>'+escapeHTML(r.value)+'</td></tr>').join("")+'</table></div>';
 }
 for(const p of abilities){
  html+='<div class="record"><h3>'+escapeHTML(p.name)+'</h3><div class="record-body">'+E.profileRows(p).map(r=>r.name==="Description"?escapeHTML(r.value):'<b>'+escapeHTML(r.name)+':</b> '+escapeHTML(r.value)).join(" ")+'</div></div>';
 }
 return html||'<div class="empty">No datasheet profiles available.</div>';
}
function renderRules(unit,item){
 const map=new Map();
 E.eachActive(unit,unit.id,item,(node)=>{
   for(const r of node.rules){
     map.set(r.id||r.name,{name:r.name,description:r.description||r.$text||""});
   }
   for(const link of node.infoLinks){
     if(link.hidden || link.type!=="rule")continue;
     const def=catalog.rules.get(link.targetId);
     if(def)map.set(link.targetId,{name:link.name||def.name,description:def.description||def.$text||""});
   }
 });
 let html='<p class="small-note">Rules referenced by the selected unit in the BSData catalogue.</p>';
 for(const rule of map.values())html+='<div class="record"><h3>'+escapeHTML(rule.name)+'</h3><div class="record-body">'+escapeHTML(rule.description||"Rule reference without a local description.")+'</div></div>';
 return html+(map.size?"":'<div class="empty">No linked rules found.</div>');
}
function renderInspector(){
 const item=currentItem(),box=$("inspectorBody");
 if(!catalog||!item){$("inspectorTitle").textContent="No unit selected";$("inspectorMeta").textContent="";$("inspectorTabs").classList.add("hidden");box.innerHTML='<div class="empty">Select a unit in the legion manifest to configure equipment, inspect profiles and view rules.</div>';return;}
 const unit=catalog.units.get(item.unitId);if(!unit)return;
 $("inspectorTitle").textContent=unit.name;
 $("inspectorMeta").textContent=modelSummary(unit,item)+"  •  "+lastResult.details.get(item.key)+" pts  •  "+unitCategory(unit);
 $("inspectorTabs").classList.remove("hidden");
 for(const b of $("inspectorTabs").querySelectorAll("button"))b.classList.toggle("active",b.dataset.tab===state.tab);
 if(state.tab==="datasheet"){box.innerHTML=renderDatasheet(unit,item);return;}
 if(state.tab==="rules"){box.innerHTML=renderRules(unit,item);return;}
 const optionHtml=unit.children.map(child=>renderOptionTree(child,E.keyFor(unit.id,child),item,unit)).join("");
 box.innerHTML='<div class="small-note">Set model quantities and select equipment. Changes update the roster points immediately.</div>'+
 (optionHtml||'<div class="empty">This entry has no configurable options.</div>')+
 '<p class="small-note">Red warnings in the legion manifest indicate constraints that still need attention.</p>';
}
function render(){
 if(!catalog || state.loading)return;
 lastResult=E.validate(catalog,state.items,state.limit,state.detachment);
 $("detachment").innerHTML='<option value="">Select detachment...</option>'+catalog.detachments.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join("");
 $("detachment").value=state.detachment||"";
 renderCatalog();renderRoster();renderInspector();
}
function loadLegacy(parsed){
 if(Array.isArray(parsed)){
   return parsed.map(x=>{
     const u=catalog.roots.find(y=>y.name===x.name||y.sourceId===x.unitId);
     return u?E.makeItem(u):null;
   }).filter(Boolean);
 }
 if(!parsed||!Array.isArray(parsed.items))throw Error("No army entries in JSON.");
 if(parsed.version===2){
   const faction=parsed.faction||"Necrons";
   if(faction!==state.faction)throw Error("This file is for "+faction+". Choose that faction first.");
   return parsed.items.filter(x=>x&&catalog.units.has(x.unitId)&&x.counts&&typeof x.counts==="object").map(x=>({...x,key:crypto.randomUUID?crypto.randomUUID():String(Math.random())}));
 }
 throw Error("Unsupported army file format.");
}
function exportJSON(){
 const obj={version:2,app:"Dynastic Command",faction:state.faction,source:"BSData/wh40k-11e",sourceRevision:catalog.revision,detachment:state.detachment,limit:state.limit,items:state.items,exported:new Date().toISOString()};
 download(JSON.stringify(obj,null,2),"application/json",safeName(state.faction)+"-army-"+stamp()+".json");
}
function exportText(){
 const r=E.validate(catalog,state.items,state.limit,state.detachment);
 const d=catalog.detachments.find(x=>x.id===state.detachment);
 const lines=[state.faction+" - "+(d?.name||"No detachment"),r.points+" / "+state.limit+" pts",""];
 state.items.forEach(it=>{const u=catalog.units.get(it.unitId);if(!u)return;lines.push(u.name+" - "+r.details.get(it.key)+" pts ("+modelSummary(u,it)+")");
  E.eachActive(u,u.id,it,(n,p,count)=>{if(n!==u&&!n.group&&n.type!=="model"&&n.name!=="Battle Tallies"&&n.name!=="Warlord")lines.push("  "+count+"x "+n.name);if(n.name==="Warlord")lines.push("  WARLORD")});
 });
 lines.push("","Validation:",...r.errors.map(x=>"ERROR: "+x),...r.warnings.map(x=>"NOTE: "+x));
 download(lines.join("\n"),"text/plain",safeName(state.faction)+"-army-"+stamp()+".txt");
}
function download(body,mime,filename){
 const url=URL.createObjectURL(new Blob([body],{type:mime})),a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
document.addEventListener("toggle",event=>{
 const details=event.target;
 if(details.tagName==="DETAILS" && details.dataset.groupKey)state.expanded[details.dataset.groupKey]=details.open;
 if(details.tagName==="DETAILS" && details.dataset.catalogGroup && !state.search.trim() && state.category==="All")state.catalogCollapsed[details.dataset.catalogGroup]=!details.open;
},true);
document.addEventListener("click",event=>{
 const el=event.target.closest("[data-action]");if(!el||!catalog||state.loading)return;
 const action=el.dataset.action,key=el.dataset.key;
 if(action==="info"){
   const item=currentItem(),unit=item&&catalog.units.get(item.unitId),node=E.findNode(unit,el.dataset.path);
   if(node)showOptionInfo(node);
 }else if(action==="add"){
   const unit=catalog.units.get(el.dataset.unit);if(!unit)return;
   mutate(()=>{const item=E.makeItem(unit);state.items.push(item);state.selected=item.key;state.tab="configure"});
 }else if(action==="select"){state.selected=key;state.tab="configure";render()}
 else if(action==="copy"){
   mutate(()=>{const at=state.items.findIndex(x=>x.key===key);if(at<0)return;const copy=structuredClone(state.items[at]);copy.key=crypto.randomUUID?crypto.randomUUID():String(Date.now());state.items.splice(at+1,0,copy);state.selected=copy.key});
 }else if(action==="remove"){
   mutate(()=>{state.items=state.items.filter(x=>x.key!==key);if(state.selected===key)state.selected=state.items[0]?.key||null});
 }else if(action==="up"||action==="down"){
   mutate(()=>{const it=currentItem();if(!it)return;const path=el.dataset.path;E.setCount(catalog,it,path,E.getCount(it,path)+(action==="up"?1:-1))});
 }
});
document.addEventListener("change",event=>{
 const el=event.target;
 if(el.dataset.field==="qty"){
   mutate(()=>{const it=currentItem();if(it)E.setCount(catalog,it,el.dataset.path,el.value)});
 }else if(el.dataset.field==="warlord"){
   const enabled=el.checked;
   mutate(()=>{
     const selected=currentItem();if(!selected)return;
     if(enabled)for(const item of state.items){
       const u=catalog.units.get(item.unitId),w=u?.children.find(x=>x.name==="Warlord");
       if(w)E.setCount(catalog,item,E.keyFor(u.id,w),0);
     }
     E.setCount(catalog,selected,el.dataset.path,enabled?1:0);
   });
 }
});
$("search").addEventListener("input",e=>{state.search=e.target.value;renderCatalog()});
$("closeInfo").addEventListener("click",()=>$("infoDialog").close());
$("category").addEventListener("change",e=>{state.category=e.target.value;renderCatalog()});
$("legends").addEventListener("change",e=>{state.legends=e.target.checked;renderCatalog()});
$("faction").addEventListener("change",e=>{saved[state.faction]={items:state.items,detachment:state.detachment,limit:state.limit};loadFaction(e.target.value)});
$("detachment").addEventListener("change",e=>mutate(()=>{state.detachment=e.target.value;cachedPrices.clear()}));
$("limit").addEventListener("change",e=>mutate(()=>{state.limit=Math.max(0,Number(e.target.value)||2000);$("limit").value=state.limit}));
$("inspectorTabs").addEventListener("click",e=>{const btn=e.target.closest("[data-tab]");if(!btn)return;state.tab=btn.dataset.tab;renderInspector()});
$("save").addEventListener("click",()=>{persist();notify("Legion stored in this browser.")});
$("exportJSON").addEventListener("click",exportJSON);
$("exportText").addEventListener("click",exportText);
$("import").addEventListener("click",()=>$("file").click());
$("file").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{const parsed=JSON.parse(await file.text());const items=loadLegacy(parsed);
   mutate(()=>{state.items=items;state.selected=items[0]?.key||null;if(parsed.version===2){state.detachment=parsed.detachment;state.limit=Number(parsed.limit)||2000;$("limit").value=state.limit}});
   notify("Imported "+items.length+" units.");
 }catch(err){notify("Import failed: "+err.message,true)}
 e.target.value="";
});
$("undo").addEventListener("click",()=>{
 if(!history.length)return;
 const last=JSON.parse(history.pop());Object.assign(state,last);$("limit").value=state.limit;persist();render();
});
$("clear").addEventListener("click",()=>{
 if(!state.items.length)return;
 if(!confirm("Clear every unit from the current army?"))return;
 mutate(()=>{state.items=[];state.selected=null});
});
$("refreshData").addEventListener("click",()=>{persist();loadFaction(state.faction)});
function start(){
 saved=safeSaved();
 $("faction").innerHTML=FACTIONS.map(([name])=>'<option value="'+escapeHTML(name)+'">'+escapeHTML(name)+'</option>').join("");
 state.faction=localStorage.getItem("dynastic-current-faction")||"Necrons";
 if(!FACTIONS.some(x=>x[0]===state.faction))state.faction="Necrons";
 $("faction").addEventListener("change",()=>localStorage.setItem("dynastic-current-faction",$("faction").value));
 loadFaction(state.faction);
}
start();
})();