// Generates city3.json - Slate City, 80x60
// All 6 building types, dense city grid, central park, cross-streets
// Run: node gen-city3.js
const fs = require('fs'), path = require('path');

const W=80, H=60, TW=32, TH=32;
const GR=126, T_GRASS=143;
const P2=150, PL=173, PM=174;
const TR1=169, TR2=170, TR3=193, TR4=194;

const BLDG_A=[[601,602,603,604,605],[625,626,627,628,629],[649,650,651,652,653]];
const BLDG_B=[[606,607,608,609,610,611],[630,631,632,633,634,635],[654,655,656,657,658,659]];
const BLDG_C=[[495,496,497,498,499,503,504],[519,520,521,522,523,527,528],[543,544,545,546,547,551,552]];
const BLDG_D=[[612,613,614,615,616],[636,637,638,639,640],[660,661,662,663,664]];
const BLDG_E=[[399,400,401,402,403],[423,424,425,426,427],[447,448,449,450,451]];
const BLDG_F=[[394,395,396,397,398],[418,419,420,421,422],[442,443,444,445,446]];

// Rotation order for variety — 6 types cycling
const CYCLE=[BLDG_A,BLDG_D,BLDG_E,BLDG_F,BLDG_B,BLDG_C];
let ci=0; const T=()=>CYCLE[ci++%CYCLE.length];
// 5-wide-only cycle (for positions near right border where wide buildings would clip)
const CYCLE5=[BLDG_A,BLDG_D,BLDG_E,BLDG_F];
let ci5=0; const T5=()=>CYCLE5[ci5++%CYCLE5.length];

const below=new Array(W*H).fill(GR);
const world=new Array(W*H).fill(0);

const B  =(r,c,t)=>{ if(r>=0&&r<H&&c>=0&&c<W) below[r*W+c]=t; };
const WS =(r,c,t)=>{ if(r>=0&&r<H&&c>=0&&c<W) world[r*W+c]=t; };

// ── Border trees cols 0-1 and 78-79 ────────────────────────────────────────
for(let r=0;r<H;r+=2){
  WS(r,0,TR1);   WS(r,1,TR2);   WS(r+1,0,TR3);   WS(r+1,1,TR4);
  WS(r,W-2,TR1); WS(r,W-1,TR2); WS(r+1,W-2,TR3); WS(r+1,W-1,TR4);
}

// ── Top/bottom fence ────────────────────────────────────────────────────────
for(let c=2;c<W-2;c++){ WS(0,c,TR1); WS(H-1,c,TR1); }

// ── North corridor open (rows 0-1, cols 32-47) ─────────────────────────────
for(let r=0;r<=1;r++) for(let c=32;c<=47;c++) WS(r,c,0);
// North corridor floor = path tile
for(let r=0;r<=5;r++) for(let c=32;c<=47;c++) B(r,c,PM);

// ── Cross-streets in Below Player ──────────────────────────────────────────
const STREET_ROWS=[9,10,21,22,47,48,57,58];
for(const r of STREET_ROWS) for(let c=0;c<W;c++) B(r,c,PL);
// Vertical path through central corridor cols 38-41
for(let r=0;r<H;r++){ B(r,38,P2); B(r,39,P2); B(r,40,P2); B(r,41,P2); }

// ── Central Park (rows 24-45, cols 22-57) ──────────────────────────────────
for(let r=24;r<=45;r++) for(let c=22;c<=57;c++) B(r,c,T_GRASS);
// Park cross-paths
for(let r=24;r<=45;r++){ B(r,39,P2); B(r,40,P2); }
for(let c=22;c<=57;c++){ B(34,c,PL); B(35,c,PM); }

// ── Building placement ──────────────────────────────────────────────────────
function placeBuilding(tpl,sr,sc){
  tpl.forEach((row,dr)=>row.forEach((t,dc)=>WS(sr+dr,sc+dc,t)));
}

// LEFT of corridor: cols 2-31 (corridor at 32). 4 buildings per row.
// Positions: 2,9,16,23  widths 5,5,6,5 → ends: 6,13,21,27 — all < 32 ✓
const L=[2,9,16,23];
// RIGHT of corridor: cols 49-77 (corridor ends at 47). 4 buildings per row.
// Positions: 49,56,63,71  widths 5,6,5,5 → ends: 53,61,67,75 — all < 78 ✓
const R=[49,56,63,71];

// Full-width block rows (both sides of main corridor, avoid park rows 24-45)
const FULL_ROWS=[2,6,11,15,49,53];
for(const br of FULL_ROWS){
  for(const c of L) placeBuilding(T(),br,c);
  for(const c of R) placeBuilding(T(),br,c);
}

// Park-side buildings (beside park, cols 2-19 left, cols 61-77 right)
// Sub-rows within park band rows 24-45, at rows 24,28,32,36,40,44
const PARK_ROWS=[24,28,32,36,40,44];
const PL_COLS=[2,8,14];    // LEFT park side: 2-6, 8-12, 14-18 (ends at 18, park at 22 ✓)
const PR_COLS=[61,67,73];  // RIGHT park side: 61-65, 67-71, 73-77 ✓
for(const pr of PARK_ROWS){
  for(const c of PL_COLS) placeBuilding(T(),pr,c);
  // cols 61,67 can use any type; col 73 is max 5-wide (tree border at 78)
  placeBuilding(T(),pr,61);
  placeBuilding(T(),pr,67);
  placeBuilding(T5(),pr,73);  // 5-wide only: ends at 77, safe from tree at 78
}

// ── Tileset reference ───────────────────────────────────────────────────────
const tileset=JSON.parse(fs.readFileSync(
  path.join(__dirname,'client/src/assets/tilemaps/town.json'),'utf8'
)).tilesets[0];

const mapCX=W*TW/2;
const makeL=(name,data,id)=>({data:[...data],height:H,id,name,opacity:1,type:'tilelayer',visible:true,width:W,x:0,y:0});

const tilemap={
  height:H, infinite:false,
  layers:[
    makeL('Below Player',below,1),
    makeL('World',world,2),
    {data:new Array(W*H).fill(0),height:H,id:3,name:'Grass',opacity:1,type:'tilelayer',visible:true,width:W,x:0,y:0},
    {data:new Array(W*H).fill(0),height:H,id:4,name:'Above Player',opacity:1,type:'tilelayer',visible:true,width:W,x:0,y:0},
    {draworder:'topdown',id:5,name:'SpawnPoints',objects:[
      {height:0,id:1,name:'Spawn Point',point:true,rotation:0,type:'',visible:true,width:0,x:mapCX,y:256},
      {height:0,id:2,name:'FromCity2',  point:true,rotation:0,type:'',visible:true,width:0,x:mapCX,y:256}
    ],opacity:1,type:'objectgroup',visible:true,x:0,y:0},
    {draworder:'topdown',id:6,name:'Doors',objects:[],opacity:1,type:'objectgroup',visible:true,x:0,y:0},
    {draworder:'topdown',id:7,name:'Worlds',objects:[
      {height:80,id:3,name:'city2',
       properties:[{name:'playerTexturePosition',type:'string',value:'front'}],
       rotation:0,type:'',visible:true,width:W*TW,x:0,y:-30}
    ],opacity:1,type:'objectgroup',visible:true,x:0,y:0}
  ],
  nextlayerid:8, nextobjectid:10,
  orientation:'orthogonal', renderorder:'right-down',
  tiledversion:'1.3.1', tileheight:TH, tilesets:[tileset],
  tilewidth:TW, type:'map', version:1.4, width:W
};

fs.writeFileSync(
  path.join(__dirname,'client/src/assets/tilemaps/city3.json'),
  JSON.stringify(tilemap,null,1)
);
const bldgCount=FULL_ROWS.length*8+PARK_ROWS.length*6;
console.log('Generated city3.json:',W+'x'+H,'|',bldgCount,'buildings');
