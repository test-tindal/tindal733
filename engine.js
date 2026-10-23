/* BSData 11e selection engine. No dependencies. */
(function (root) {
"use strict";
const PTS = "51b2-306e-1021-d207";
const asArray = v => Array.isArray(v) ? v : [];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const amount = (node, kind) => {
  const values = asArray(node.constraints).filter(c => c.field === "selections" && c.type === kind && Number(c.value) >= 0 && (!c.scope || ["parent", "self", "root-entry", "unit-self"].includes(c.scope))).map(c => Number(c.value));
  return values.length ? (kind === "min" ? Math.max(...values) : Math.min(...values)) : null;
};
const pts = node => asArray(node.costs).filter(x => x.name === "pts" || x.typeId === PTS).reduce((t, x) => t + (Number(x.value) || 0), 0);
const profileRows = p => asArray(p.characteristics).map(c => ({name:c.name, value:String(c.$text ?? "")}));
function makeCatalog(json, imports = []) {
 const main = json.catalogue || json, files = [main].concat(imports.map(x=>x.catalogue || x));
 const index = new Map(), ruleIndex = new Map();
 function scan(node) {
   if (!node || typeof node !== "object") return;
   if (Array.isArray(node)) {node.forEach(scan);return;}
   if (node.id && node.name && (["unit","model","upgrade"].includes(node.type) || node.selectionEntryGroups || node.selectionEntries || node.entryLinks || node.costs || node.profiles || node.defaultSelectionEntryId || node.name === "Warlord")) index.set(node.id,node);
   if (node.id && (node.description !== undefined || node.characteristics)) ruleIndex.set(node.id,node);
   for(const k of ["selectionEntries","selectionEntryGroups","sharedSelectionEntries","sharedSelectionEntryGroups","sharedProfiles","sharedRules","sharedInfoGroups","rules","profiles","infoGroups"]) asArray(node[k]).forEach(scan);
 }
 files.forEach(scan);
 // Index the root options and shared groups as well as nested units.
 function inflate(node, depth = 0, trail = []) {
   if (!node || depth > 16) return null;
   let src = node;
   if (node.targetId) {
     if (trail.includes(node.targetId)) return null;
     const referenced = index.get(node.targetId);
     if (!referenced) return null;
     src = Object.assign({}, referenced, node, {
       id: node.id || referenced.id,
       type: referenced.type || node.type,
       sourceId: referenced.sourceId || referenced.id,
       selectionEntries: asArray(referenced.selectionEntries).concat(asArray(node.selectionEntries)),
       selectionEntryGroups: asArray(referenced.selectionEntryGroups).concat(asArray(node.selectionEntryGroups)),
       entryLinks: asArray(referenced.entryLinks).concat(asArray(node.entryLinks)),
       profiles: asArray(referenced.profiles).concat(asArray(node.profiles)),
       modifiers: asArray(referenced.modifiers).concat(asArray(node.modifiers)),
       constraints: asArray(referenced.constraints).concat(asArray(node.constraints))
     });
     trail = trail.concat(node.targetId);
   }
   const group = node.type === "selectionEntryGroup" || (!src.type && (!!src.selectionEntries || !!src.selectionEntryGroups || !!src.entryLinks || !!src.defaultSelectionEntryId));
   const result = {
     id: src.id, sourceId: src.sourceId || src.id, name: src.name || "Unnamed selection", type: group ? "group" : (src.type || "group"),
     constraints: asArray(src.constraints), modifiers: asArray(src.modifiers), categoryLinks: asArray(src.categoryLinks),
     costs: asArray(src.costs), profiles: asArray(src.profiles), infoLinks: asArray(src.infoLinks), rules: asArray(src.rules),
     hidden: Boolean(src.hidden), defaultId: src.defaultSelectionEntryId,
     children: [], group: group
   };
   const children = [...asArray(src.selectionEntries),...asArray(src.selectionEntryGroups),...asArray(src.entryLinks).filter(x=>x.type === "selectionEntry" || x.type === "selectionEntryGroup")];
   result.children = children.map(x=>inflate(x,depth+1,trail)).filter(Boolean);
   return result;
 }
 const roots = [];
 for(const f of files) {
   asArray(f.entryLinks).filter(x=>x.type === "selectionEntry").forEach(x=>{
     const base = index.get(x.targetId);
     if(!base || !["unit","model"].includes(base.type)) return;
     const e = inflate(x);
     if(e && !roots.find(y=>y.sourceId===e.sourceId)) roots.push(e);
   });
   asArray(f.selectionEntries).filter(x=>["unit","model"].includes(x.type)).forEach(x=>{
     const e=inflate(x);if(e && !roots.find(y=>y.sourceId===e.sourceId)) roots.push(e);
   });
 }
 const detachRoot = asArray(main.sharedSelectionEntries).find(x=>x.name==="Detachment") || asArray(main.selectionEntries).find(x=>x.name==="Detachment");
 let detachments = [];
 if(detachRoot) {
   const tree = inflate(detachRoot);
   function addDetach(n) {
     if(n.type==="upgrade" && n.name!=="Detachment" && n.name!=="Crusade") detachments.push({id:n.sourceId,name:n.name});
     else n.children.forEach(addDetach);
   }
   tree.children.forEach(addDetach);
 }
 detachments = [...new Map(detachments.map(x=>[x.id,x])).values()];
 roots.sort((a,b)=>a.name.localeCompare(b.name));
 return {name:main.name, revision:main.revision, roots, units:new Map(roots.map(x=>[x.sourceId,x])), detachments,
   rules:ruleIndex, imported:files.length};
}
function keyFor(parent, child) {return parent ? parent+"/"+child.id : child.id;}
function getCount(item, path) {return Math.max(0, Number(item.counts && item.counts[path]) || 0);}
function groupSum(group,path,item) {return group.children.reduce((t,x)=>t+(x.group?groupSum(x,keyFor(path,x),item):getCount(item,keyFor(path,x))),0);}
function defaultPopulate(node,path,item,active = true) {
 if(!active) return;
 if(node.group){
   for(const c of node.children) {
     if(c.name==="Crusade" || c.name==="Order of Battle" || c.name==="Weapon Modifications")continue;
     const p=keyFor(path,c), required=amount(c,"min") || 0;
     if(!c.group && required>0 && item.counts[p]===undefined) item.counts[p]=required;
     if(c.group)defaultPopulate(c,p,item,true);
     else if(getCount(item,p)>0) defaultPopulate(c,p,item,true);
   }
   const required=amount(node,"min") || 0;
   const remaining=required-groupSum(node,path,item);
   if(remaining>0){
     const d=node.children.find(x=>x.id===node.defaultId || x.sourceId===node.defaultId)
       ||node.children.find(x=>!x.group && x.type==="model") ||node.children.find(x=>!x.group) ||node.children[0];
     if(d && d.name!=="Crusade") {
       const p=keyFor(path,d);
       if(d.group) defaultPopulate(d,p,item,true);
       else {item.counts[p]=getCount(item,p)+remaining;defaultPopulate(d,p,item,true);}
     }
   }
 }else{
   for(const c of node.children){
     if(c.name==="Crusade" || c.name==="Order of Battle" || c.name==="Weapon Modifications")continue;
     const p=keyFor(path,c);
     if(c.group)defaultPopulate(c,p,item,true);
     else {
       const mn=amount(c,"min")||0;
       if(mn && item.counts[p]===undefined)item.counts[p]=mn;
       if(getCount(item,p)>0)defaultPopulate(c,p,item,true);
     }
   }
 }
}
function makeItem(unit) {
 const item={key:uid(), unitId:unit.sourceId,counts:{}};
 defaultPopulate(unit,unit.id,item);
 return item;
}
function countNode(node,path,item) {
 if(node.group)return groupSum(node,path,item);
 return getCount(item,path);
}
function eachActive(node,path,item,callback,mult=1,depth=0){
 if(depth>20)return;
 const qty=node.group?1:(path===node.id?1:getCount(item,path));
 if(!qty)return;
 callback(node,path,qty*mult,qty);
 node.children.forEach(c=>eachActive(c,keyFor(path,c),item,callback,mult*qty,depth+1));
}
function nodeCountById(unit,item,childId) {
 let total=0;
 eachActive(unit,unit.id,item,(n,p,nqty)=>{
   if(childId==="model"){if(n.type==="model" && n!==unit)total+=nqty;}
   else if(n.sourceId===childId || n.id===childId)total+=nqty;
 });
 return total;
}
function resolveCondition(cond,context){
 if(!cond)return false;
 const field=cond.field || "selections", kind=cond.type;
 const id=cond.childId, scope=cond.scope || "";
 let val=0;
 if(field==="selections" || field==="forces"){
   if(id===context.detachment?.id || id===context.detachment?.sourceId)val=1;
   else if(field==="forces" && id) val=0;
   else if(context.unit && context.item && ["self","parent","unit-self","root-entry",context.unit.sourceId,context.unit.id].includes(scope))val=nodeCountById(context.unit,context.item,id);
   else if(id==="model" && context.unit && context.item)val=nodeCountById(context.unit,context.item,"model");
   else if(context.roster && context.catalog) {
     for(const it of context.roster) {
       const u=context.catalog.units.get(it.unitId);
       if(u && (u.sourceId===id||u.id===id))val++;
       if(u && id && u!==context.unit)val+=nodeCountById(u,it,id);
     }
   }
   if(!id && scope==="roster")val=context.roster?.length||0;
 }else if(field==="points")val=context.points||0;
 else if(field==="associations")val=0;
 else return null;
 const n=Number(cond.value);
 switch(kind){
 case "atLeast":return val>=n; case "atMost":return val<=n;
 case "greaterThan":return val>n; case "lessThan":return val<n;
 case "equalTo":return val===n; case "notEqualTo":return val!==n;
 case "instanceOf":return val>=n; case "notInstanceOf":return val<n;
 default:return null;
 }
}
function evaluateLocalGroup(g,ctx){
 if(g.field!=="selections" || !ctx.item || !ctx.roster)return null;
 const instance=asArray(g.conditions).find(x=>x.type==="instanceOf");
 const before=asArray(g.conditions).some(x=>x.type==="before");
 if(!instance || !before)return null;
 const prior=ctx.roster.slice(0,Math.max(0,ctx.roster.findIndex(x=>x.key===ctx.item.key)));
 const found=prior.filter(x=>x.unitId===instance.childId || (ctx.catalog?.units.get(x.unitId)?.sourceId===instance.childId)).length;
 const value=Number(g.value)||0;
 switch(g.type){case "atLeast":return found>=value;case "atMost":return found<=value;
 case "greaterThan":return found>value;case "lessThan":return found<value;case "equalTo":return found===value;default:return null;}
}
function evaluate(mod,ctx) {
 const xs=asArray(mod.conditions), gs=asArray(mod.conditionGroups);
 if(!xs.length && !gs.length)return true;
 function group(g){const vals=[...asArray(g.conditions).map(c=>resolveCondition(c,ctx)),...asArray(g.conditionGroups).map(group),...asArray(g.localConditionGroups).map(c=>evaluateLocalGroup(c,ctx))];
 if(vals.some(v=>v===null))return null;
 return g.type==="or" ? vals.some(Boolean) : vals.every(Boolean);}
 const results=xs.map(c=>resolveCondition(c,ctx)).concat(gs.map(group));
 if(results.includes(null))return null;
 return results.every(Boolean);
}
function isHidden(node,ctx){
 let hidden=node.hidden;
 for(const m of node.modifiers)if(m.field==="hidden" && m.type==="set"){
   const result=evaluate(m,ctx);if(result===true) hidden=m.value===true || m.value==="true";
 }
 return hidden;
}
function pointCost(node,ctx){
 let price=pts(node);
 for(const mod of node.modifiers){
   if(mod.field!==PTS && mod.field!=="pts")continue;
   if(evaluate(mod,ctx)!==true)continue;
   const n=Number(mod.value);
   if(!Number.isFinite(n))continue;
   if(mod.type==="set")price=n;
   if(mod.type==="increment" || mod.type==="add")price+=n;
   if(mod.type==="decrement" || mod.type==="subtract")price-=n;
 }
 return price;
}
function itemPoints(catalog,item,roster,detachmentId){
 const unit=catalog.units.get(item.unitId);if(!unit)return 0;
 const detachment=catalog.detachments.find(x=>x.id===detachmentId);
 const ctx={catalog,unit,item,roster,detachment};
 let total=0;
 eachActive(unit,unit.id,item,(n,p,mult)=>{
   total+=pointCost(n,ctx)*mult;
 });
 return total;
}
function validate(catalog,roster,limit,detachmentId){
 const errors=[],warnings=[],totals=new Map(),details=new Map();
 const detachment=catalog.detachments.find(x=>x.id===detachmentId);
 let points=0,characters=0,warlords=0,enhancements=0;
 function push(message,type="error"){(type==="error"?errors:warnings).push(message);}
 for(const item of roster){
  const unit=catalog.units.get(item.unitId);
  if(!unit){push("A saved unit no longer exists in this catalogue.");continue;}
  const ctx={catalog,unit,item,roster,detachment};
  totals.set(unit.sourceId,(totals.get(unit.sourceId)||0)+1);
  const ip=itemPoints(catalog,item,roster,detachmentId);points+=ip;details.set(item.key,ip);
  const tags=unit.categoryLinks.map(x=>x.name.toLowerCase());
  if(tags.includes("character"))characters++;
  function descend(node,path,active=true,depth=0,insideEnhancements=false){
   const inEnhancements=insideEnhancements||node.name==="Enhancements";
   if(!active||depth>18)return;
   if(node.group){
     const sum=groupSum(node,path,item),mn=amount(node,"min"),mx=amount(node,"max");
     if(mn!==null && sum<mn)push(unit.name+": "+node.name+" requires at least "+mn+" selection(s); has "+sum+".");
     if(mx!==null && sum>mx)push(unit.name+": "+node.name+" allows at most "+mx+" selection(s); has "+sum+".");
     if(sum>0 && isHidden(node,ctx))push(unit.name+": "+node.name+" is unavailable in the selected detachment.");
   }else if(path!==unit.id) {
     const count=getCount(item,path),mn=amount(node,"min"),mx=amount(node,"max");
     if(mn!==null && count<mn)push(unit.name+": "+node.name+" requires at least "+mn+".");
     if(mx!==null && count>mx)push(unit.name+": "+node.name+" allows at most "+mx+".");
     if(!count)return;
     if(node.name==="Warlord")warlords+=count;
     if(inEnhancements && node.type==="upgrade" && pts(node)>0)enhancements+=count;
     if(isHidden(node,ctx))push(unit.name+": "+node.name+" is unavailable in the selected detachment.");
   }
   for(const child of node.children) {
     if(child.name==="Crusade"||child.name==="Order of Battle")continue;
     descend(child,keyFor(path,child),true,depth+1,inEnhancements);
   }
  }
  descend(unit,unit.id);
  for(const mod of unit.modifiers)if(mod.field==="error" && evaluate(mod,ctx)===true)push(unit.name+": "+String(mod.value));
 }
 for(const [id,count] of totals){
   const unit=catalog.units.get(id),cats=unit.categoryLinks.map(x=>x.name.toLowerCase());
   const cap=cats.includes("battleline")?6:cats.includes("epic hero")?1:3;
   if(count>cap)push(unit.name+": "+count+" units selected (limit "+cap+").");
   const unique=unit.constraints.find(x=>x.field==="selections"&&x.scope==="force"&&x.type==="max"&&Number(x.value)===1);
   if(unique&&count>1)push(unit.name+" is limited to one per army.");
 }
 if(points>Number(limit))push("Army exceeds the points limit by "+(points-Number(limit))+" pts.");
 if(roster.length>0 && !characters)push("Army has no CHARACTER. Verify that your detachment permits this.");
 if(warlords>1)push("More than one Warlord selected.");
 if(roster.length>0 && !warlords)push("No Warlord marked. Select one in a character's options.","warning");
 if(roster.length>0 && !detachment)push("No detachment selected.","warning");
 if(enhancements>3)push("More than three enhancements selected.");
 return {errors:[...new Set(errors)],warnings:[...new Set(warnings)],points,details,characters,warlords,enhancements};
}
function findNode(unit,path){
 if(!unit||!path)return null;
 const parts=path.split("/");
 if(parts[0]!==unit.id)return null;
 let node=unit;
 for(const id of parts.slice(1)){node=node.children.find(c=>c.id===id);if(!node)return null;}
 return node;
}
function setCount(catalog,item,path,value) {
 const unit=catalog.units.get(item.unitId),node=findNode(unit,path);
 if(!node || node.group)return false;
 const parentPath=path.slice(0,path.lastIndexOf("/")),parent=findNode(unit,parentPath);
 const mx=amount(node,"max"),gm=parent&&parent.group?amount(parent,"max"):null;
 const max=Math.min(mx??99,gm??99,99);
 const next=clamp(Math.round(Number(value)||0),0,max);
 item.counts[path]=next;
 if(next>0&&parent?.group&&gm===1){
   for(const child of parent.children)if(child.id!==node.id)item.counts[keyFor(parentPath,child)]=0;
 }
 if(next>0) defaultPopulate(node,path,item,true);
 return true;
}
root.BSDataEngine={makeCatalog,makeItem,setCount,getCount,groupSum,amount,keyFor,pts,profileRows,findNode,eachActive,itemPoints,validate,isHidden,nodeCountById,evaluate};
})(typeof window!=="undefined"?window:globalThis);
