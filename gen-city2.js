// Generates city2.json - Viridian City, 40x30
// All 6 building types, dense layout, central N-S corridor, 2 horizontal streets
// Run: node gen-city2.js
const fs = require('fs');

const W = 40, H = 30, TW = 32, TH = 32;
const GR = 126;                          // green grass floor
const P2 = 150, PL = 173, PM = 174;     // path tiles
const TR1 = 169, TR2 = 170, TR3 = 193, TR4 = 194; // tree trunk tiles

// All 6 building types extracted directly from town.json
const BLDG_A = [[601,602,603,604,605],[625,626,627,628,629],[649,650,651,652,653]];           // 5w
const BLDG_B = [[606,607,608,609,610,611],[630,631,632,633,634,635],[654,655,656,657,658,659]]; // 6w
const BLDG_C = [[495,496,497,498,499,503,504],[519,520,521,522,523,527,528],[543,544,545,546,547,551,552]]; // 7w
const BLDG_D = [[612,613,614,615,616],[636,637,638,639,640],[660,661,662,663,664]];           // 5w
const BLDG_E = [[399,400,401,402,403],[423,424,425,426,427],[447,448,449,450,451]];           // 5w
const BLDG_F = [[394,395,396,397,398],[418,419,420,421,422],[442,443,444,445,446]];           // 5w

const below = new Array(W*H).fill(GR);
const world = new Array(W*H).fill(0);

const B  = (r,c,t) => { if(r>=0&&r<H&&c>=0&&c<W) below[r*W+c]=t; };
const WS = (r,c,t) => { if(r>=0&&r<H&&c>=0&&c<W) world[r*W+c]=t; };

// ── Border trees: cols 0-1 and 38-39, all rows ─────────────────────────────
for(let r=0;r<H;r+=2){
  WS(r,0,TR1);   WS(r,1,TR2);   WS(r+1,0,TR3);   WS(r+1,1,TR4);
  WS(r,W-2,TR1); WS(r,W-1,TR2); WS(r+1,W-2,TR3); WS(r+1,W-1,TR4);
}

// ── Top/bottom fence (cols 2-37) ──────────────────────────────────────────
for(let c=2;c<W-2;c++){ WS(0,c,TR1); WS(H-1,c,TR1); }

// ── Open corridors: north (rows 0-1) and south (rows 28-29) at cols 14-24 ─
for(let r=0;r<=1;r++)     for(let c=14;c<=24;c++) WS(r,c,0);
for(let r=H-2;r<H;r++)    for(let c=14;c<=24;c++) WS(r,c,0);

// ── Horizontal streets in Below Player (rows 9-10 and 19-20) ──────────────
for(let c=0;c<W;c++){ B(9,c,PL); B(10,c,PM); B(19,c,PL); B(20,c,PM); }

// ── Vertical path through central corridor (cols 18-20) ───────────────────
for(let r=0;r<H;r++){ B(r,18,P2); B(r,19,P2); B(r,20,P2); }

// ── Building placement ─────────────────────────────────────────────────────
// LAYOUT: two city blocks (LEFT cols 2-13, RIGHT cols 25-37) separated by
// central corridor (cols 14-24). 6 building rows, alternating types.
// Buildings never reach col 14+ on left or col 24- on right.
function placeBuilding(tpl,sr,sc){
  tpl.forEach((row,dr)=>row.forEach((t,dc)=>WS(sr+dr,sc+dc,t)));
}

// ── ROW 1 (rows 2-4) ─────────────
placeBuilding(BLDG_A, 2,  2); placeBuilding(BLDG_D, 2,  9);  // LEFT:  2-6 , 9-13
placeBuilding(BLDG_D, 2, 25); placeBuilding(BLDG_A, 2, 32);  // RIGHT: 25-29, 32-36

// ── ROW 2 (rows 6-8) ─────────────
placeBuilding(BLDG_B, 6,  2); placeBuilding(BLDG_A, 6,  9);  // LEFT:  2-7 , 9-13
placeBuilding(BLDG_A, 6, 25); placeBuilding(BLDG_B, 6, 31);  // RIGHT: 25-29, 31-36

// ── ROW 3 (rows 11-13) ───────────  (after 1st cross-street at rows 9-10)
placeBuilding(BLDG_E, 11, 2); placeBuilding(BLDG_F, 11, 9);  // LEFT:  2-6 , 9-13
placeBuilding(BLDG_F, 11,25); placeBuilding(BLDG_E, 11,32);  // RIGHT: 25-29, 32-36

// ── ROW 4 (rows 15-17) ───────────
placeBuilding(BLDG_B, 15, 2); placeBuilding(BLDG_D, 15, 9);  // LEFT:  2-7 , 9-13
placeBuilding(BLDG_C, 15,25);                                  // RIGHT: 25-31 (7w)
placeBuilding(BLDG_A, 15,33);                                  // RIGHT: 33-37

// ── ROW 5 (rows 21-23) ───────────  (after 2nd cross-street at rows 19-20)
placeBuilding(BLDG_F, 21, 2); placeBuilding(BLDG_E, 21, 9);  // LEFT:  2-6 , 9-13
placeBuilding(BLDG_E, 21,25); placeBuilding(BLDG_F, 21,32);  // RIGHT: 25-29, 32-36

// ── ROW 6 (rows 25-27) ───────────
placeBuilding(BLDG_A, 25, 2); placeBuilding(BLDG_D, 25, 9);  // LEFT:  2-6 , 9-13
placeBuilding(BLDG_D, 25,25); placeBuilding(BLDG_A, 25,33);  // RIGHT: 25-29, 33-37

// ── Tileset reference from town.json ──────────────────────────────────────
const tileset = JSON.parse(fs.readFileSync('./client/src/assets/tilemaps/town.json','utf8')).tilesets[0];
const mapCX = W * TW / 2;

const map = {
  compressionlevel:0, height:H, infinite:false,
  layers:[
    { data:[...below], height:H, id:1, name:"Below Player", opacity:1, type:"tilelayer", visible:true, width:W, x:0, y:0 },
    { data:[...world], height:H, id:2, name:"World",        opacity:1, type:"tilelayer", visible:true, width:W, x:0, y:0 },
    { data:new Array(W*H).fill(0), height:H, id:7, name:"Grass", opacity:1, type:"tilelayer", visible:true, width:W, x:0, y:0 },
    { data:new Array(W*H).fill(0), height:H, id:3, name:"Above Player", opacity:1, type:"tilelayer", visible:true, width:W, x:0, y:0 },
    { draworder:"topdown", id:4, name:"SpawnPoints",
      objects:[
        { height:0, id:1,  name:"Spawn Point", point:true, rotation:0, type:"", visible:true, width:0, x:mapCX, y:480 },
        { height:0, id:10, name:"FromRoute1",  point:true, rotation:0, type:"", visible:true, width:0, x:mapCX, y:64  },
        { height:0, id:11, name:"FromCity3",   point:true, rotation:0, type:"", visible:true, width:0, x:mapCX, y:H*TH-96 }
      ],
      opacity:1, type:"objectgroup", visible:true, x:0, y:0 },
    { draworder:"topdown", id:5, name:"Doors", objects:[], opacity:1, type:"objectgroup", visible:true, x:0, y:0 },
    { draworder:"topdown", id:6, name:"Worlds",
      objects:[
        { height:80, id:2,  name:"route1",
          properties:[{name:"playerTexturePosition",type:"string",value:"front"}],
          rotation:0, type:"", visible:true, width:W*TW, x:0, y:-30 },
        { height:80, id:12, name:"city3",
          properties:[{name:"playerTexturePosition",type:"string",value:"front"}],
          rotation:0, type:"", visible:true, width:W*TW, x:0, y:H*TH-50 }
      ],
      opacity:1, type:"objectgroup", visible:true, x:0, y:0 }
  ],
  nextlayerid:9, nextobjectid:13,
  orientation:"orthogonal", renderorder:"right-down",
  tiledversion:"1.3.1", tileheight:TH, tilesets:[tileset],
  tilewidth:TW, type:"map", version:1.4, width:W
};

fs.writeFileSync('./client/src/assets/tilemaps/city2.json', JSON.stringify(map,null,1));
console.log('city2.json written:',W+'x'+H,'— 24 buildings, 6 types');
