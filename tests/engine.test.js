/* Run: node tests/engine.test.js */
"use strict";
const assert=require("node:assert/strict");
require("../engine.js");
const E=globalThis.BSDataEngine;
const pts="51b2-306e-1021-d207";
const fixture={catalogue:{
 name:"Test catalogue",revision:1,
 sharedSelectionEntries:[{
  name:"Test Warriors",id:"warrior",type:"unit",categoryLinks:[{name:"Battleline"}],
  costs:[{name:"pts",typeId:pts,value:85}],
  modifiers:[
   {field:pts,type:"set",value:170,conditions:[{childId:"model",field:"selections",scope:"warrior",type:"atLeast",value:6}]},
   {field:pts,type:"increment",value:30,conditionGroups:[{type:"and",localConditionGroups:[{
     field:"selections",type:"atLeast",value:2,scope:"parent",conditions:[
      {childId:"any",field:"selections",scope:"self",type:"before",value:1},
      {childId:"warrior",field:"selections",scope:"self",type:"instanceOf",value:1}
     ]}]}]}
  ],
  selectionEntryGroups:[{
   id:"models",name:"5-10 models",
   constraints:[{field:"selections",type:"min",value:5,scope:"parent"},{field:"selections",type:"max",value:10,scope:"parent"}],
   selectionEntries:[{
    id:"trooper",name:"Trooper",type:"model",
    constraints:[{field:"selections",type:"max",value:10,scope:"parent"}],
    selectionEntryGroups:[{
     id:"weapons",name:"Weapon",defaultSelectionEntryId:"gauss",
     constraints:[{field:"selections",type:"min",value:1,scope:"parent"},{field:"selections",type:"max",value:1,scope:"parent"}],
     selectionEntries:[
      {id:"gauss",name:"Gauss",type:"upgrade",constraints:[{field:"selections",type:"max",value:1,scope:"parent"}]},
      {id:"tesla",name:"Tesla",type:"upgrade",constraints:[{field:"selections",type:"max",value:1,scope:"parent"}]}
     ]
    }]
   }]
  }]
 }],
 entryLinks:[{name:"Test Warriors",id:"root",type:"selectionEntry",targetId:"warrior"}]
}};
const c=E.makeCatalog(fixture),u=c.roots[0];
assert.equal(c.roots.length,1);
assert.equal(u.type,"unit");
const i=E.makeItem(u),j=E.makeItem(u),k=E.makeItem(u);
const modelPath=u.id+"/models/trooper";
assert.equal(E.getCount(i,modelPath),5,"5 models are selected initially");
assert.equal(E.itemPoints(c,i,[i],null),85,"initial 5-model cost");
const weap=modelPath+"/weapons",gauss=weap+"/gauss",tesla=weap+"/tesla";
assert.equal(E.getCount(i,gauss),1,"default weapon");
E.setCount(c,i,tesla,1);
assert.equal(E.getCount(i,tesla),1);
assert.equal(E.getCount(i,gauss),0,"radio selections are exclusive");
E.setCount(c,i,modelPath,6);
assert.equal(E.itemPoints(c,i,[i],null),170,"larger unit cost from points modifier");
E.setCount(c,i,modelPath,5);
assert.deepEqual([i,j,k].map(x=>E.itemPoints(c,x,[i,j,k],null)),[85,85,115],"third identical unit incurs source duplicate penalty");
const check=E.validate(c,[i,j,k],2000,null);
assert.equal(check.points,285);
assert.ok(check.warnings.some(x=>/detachment/i.test(x)));
assert.equal(check.errors.filter(x=>/5-10 models/.test(x)).length,0);
E.setCount(c,i,modelPath,1);
assert.ok(E.validate(c,[i],2000,null).errors.some(x=>/requires at least 5/.test(x)),"invalid squad sizes flagged");
console.log("BSData engine regression tests passed.");
