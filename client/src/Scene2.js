import Phaser from "phaser";
import { onlinePlayers, room } from './SocketServer';

import OnlinePlayer from "./OnlinePlayer";
import Player from "./Player";

let cursors, socketKey;

export class Scene2 extends Phaser.Scene {
    constructor() {
        super("playGame");
    }

    init(data) {
        // Map data
        this.mapName = data.map;

        // Player Texture starter position
        this.playerTexturePosition = data.playerTexturePosition;

        // Track which map we came from for directional spawn points
        this.fromMap = data.fromMap || null;

        // Set container
        this.container = [];

        if (this.monsterWanderTimer) {
            this.monsterWanderTimer.remove(false);
            this.monsterWanderTimer = null;
        }
    }

    create() {
        // Scene restarts on map changes; onlinePlayers is a shared module object.
        // Clear any stale remote sprites from the previous Scene2 instance.
        Object.keys(onlinePlayers).forEach((id) => {
            try {
                if (onlinePlayers[id] && typeof onlinePlayers[id].destroy === 'function') {
                    onlinePlayers[id].destroy();
                }
            } catch (e) {
                // ignore
            }
            delete onlinePlayers[id];
        });

        room
            .then((room) => {
                if (!room || typeof room.onMessage !== 'function') {
                    console.error('Room not available or missing onMessage handler', room);
                    return;
                }
                room.onMessage("*", (type, message) => {
                    const data = message || {};
                    const event = data.event || type;

                    const ensureRemotePlayer = () => {
                        const existing = onlinePlayers[data.sessionId];
                        const invalid =
                            !existing ||
                            !existing.scene ||
                            existing.scene !== this ||
                            !existing.anims;

                        if (invalid) {
                            if (existing && typeof existing.destroy === 'function') {
                                try { existing.destroy(); } catch (e) {}
                            }
                            onlinePlayers[data.sessionId] = new OnlinePlayer({
                                scene: this,
                                playerId: data.sessionId,
                                key: data.sessionId,
                                map: data.map,
                                x: data.x,
                                y: data.y
                            });
                        }
                    };

                    if (event === 'CURRENT_PLAYERS') {
                        console.log('CURRENT_PLAYERS');

                        Object.keys(data.players || {}).forEach(playerId => {
                            const player = data.players[playerId];

                            if (playerId !== room.sessionId) {
                                onlinePlayers[player.sessionId] = new OnlinePlayer({
                                    scene: this,
                                    playerId: player.sessionId,
                                    key: player.sessionId,
                                    map: player.map,
                                    x: player.x,
                                    y: player.y
                                });
                            }
                        })
                    }

                    if (event === 'PLAYER_JOINED') {
                        console.log('PLAYER_JOINED');

                        if (!onlinePlayers[data.sessionId]) {
                            onlinePlayers[data.sessionId] = new OnlinePlayer({
                                scene: this,
                                playerId: data.sessionId,
                                key: data.sessionId,
                                map: data.map,
                                x: data.x,
                                y: data.y
                            });
                        }
                    }

                    if (event === 'PLAYER_LEFT') {
                        console.log('PLAYER_LEFT');

                        if (onlinePlayers[data.sessionId]) {
                            onlinePlayers[data.sessionId].destroy();
                            delete onlinePlayers[data.sessionId];
                        }
                    }

                    if (event === 'PLAYER_MOVED') {
                        // Ensure remote player exists (and isn't a stale destroyed sprite from a previous scene)
                        ensureRemotePlayer();

                        // Only animate if player is in same map
                        if (this.mapName === onlinePlayers[data.sessionId].map) {
                            onlinePlayers[data.sessionId].isWalking(data.position, data.x, data.y);
                        }
                    }

                    if (event === 'PLAYER_MOVEMENT_ENDED') {
                        ensureRemotePlayer();

                        if (this.mapName === onlinePlayers[data.sessionId].map) {
                            onlinePlayers[data.sessionId].stopWalking(data.position)
                        }
                    }

                    if (event === 'PLAYER_CHANGED_MAP') {
                        console.log('PLAYER_CHANGED_MAP');

                        if (onlinePlayers[data.sessionId]) {
                            onlinePlayers[data.sessionId].destroy();
                            delete onlinePlayers[data.sessionId];

                            if (data.map === this.mapName) {
                                onlinePlayers[data.sessionId] = new OnlinePlayer({
                                    scene: this,
                                    playerId: data.sessionId,
                                    key: data.sessionId,
                                    map: data.map,
                                    x: data.x,
                                    y: data.y
                                });
                            }
                        }
                    }
                });
            })
            .catch((e) => {
                console.error('Failed to join room', e);
            });

        this.input.keyboard.on('keydown-F', () => {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        });

        this.map = this.make.tilemap({key: this.mapName});

        console.log("this.mapName",this.mapName);
        console.log("this.map",this.map);


        // Set current map Bounds
        this.scene.scene.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // Parameters are the name you gave the tileset in Tiled and then the key of the tileset image in
        // Phaser's cache (i.e. the name you used in preload)
        const tileset = this.map.addTilesetImage("tuxmon-sample-32px-extruded", "TilesTown");

        // Parameters: layer name (or index) from Tiled, tileset, x, y
        this.belowLayer = this.map.createLayer("Below Player", tileset, 0, 0);
        this.worldLayer = this.map.createLayer("World", tileset, 0, 0);
        this.grassLayer = this.map.createLayer("Grass", tileset, 0, 0);
        this.aboveLayer = this.map.createLayer("Above Player", tileset, 0, 0);

        const autoFillLayerHoles = (layer) => {
            if (!layer || !layer.tilemapLayer || !layer.layer || !layer.layer.data) return;
            const width = layer.layer.width;
            const height = layer.layer.height;

            // Identify background-like tiles by frequency (grass/ground variants tend to dominate).
            // We intentionally do NOT rely on tile properties here because many decorative tiles
            // (tree tops, statue tops, roof backs) often have no collision properties.
            const countsAll = new Map();
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const t = layer.getTileAt(x, y);
                    if (!t || typeof t.index !== 'number' || t.index < 0) continue;
                    countsAll.set(t.index, (countsAll.get(t.index) || 0) + 1);
                }
            }
            const sortedCounts = Array.from(countsAll.entries()).sort((a, b) => b[1] - a[1]);
            const backgroundLike = new Set(sortedCounts.slice(0, 30).map(([idx]) => idx));
            const getTile = (tx, ty) => {
                if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
                return layer.getTileAt(tx, ty) || null;
            };
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const existing = layer.getTileAt(x, y);

                    const existingIndex = existing && typeof existing.index === 'number' ? existing.index : null;
                    const isEmpty = existingIndex === null;
                    const isBackgroundLike = existingIndex !== null && backgroundLike.has(existingIndex);
                    if (!isEmpty && !isBackgroundLike) continue;

                    const lT = getTile(x - 1, y);
                    const rT = getTile(x + 1, y);
                    const uT = getTile(x, y - 1);
                    const dT = getTile(x, y + 1);
                    const ulT = getTile(x - 1, y - 1);
                    const urT = getTile(x + 1, y - 1);
                    const dlT = getTile(x - 1, y + 1);
                    const drT = getTile(x + 1, y + 1);

                    const candidates4 = [lT, rT, uT, dT]
                        .filter((t) => t && typeof t.index === 'number' && t.index >= 0 && !backgroundLike.has(t.index))
                        .map((t) => t.index);
                    const candidates8 = [lT, rT, uT, dT, ulT, urT, dlT, drT]
                        .filter((t) => t && typeof t.index === 'number' && t.index >= 0 && !backgroundLike.has(t.index))
                        .map((t) => t.index);
                    if (candidates8.length < 2) continue;

                    const pickMajority = (arr, minCount, minRatio) => {
                        const counts = new Map();
                        for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
                        let best = null;
                        let bestCount = 0;
                        for (const [k, c] of counts.entries()) {
                            if (c > bestCount) {
                                best = k;
                                bestCount = c;
                            }
                        }
                        if (best === null) return null;
                        if (bestCount < minCount) return null;
                        if (bestCount / arr.length < minRatio) return null;
                        return best;
                    };

                    // Prefer strict 4-neighbor fill (very safe)
                    const best4 = candidates4.length >= 3 ? pickMajority(candidates4, 3, 1.0) : null;
                    if (best4 !== null) {
                        layer.putTileAt(best4, x, y);
                        continue;
                    }

                    // Fallback: 8-neighbor majority (catches diagonal-only tree gaps)
                    const best8 = pickMajority(candidates8, 2, 0.4);
                    if (best8 !== null) {
                        layer.putTileAt(best8, x, y);
                        continue;
                    }

                    const candidatesR2 = [];
                    for (let oy = -2; oy <= 2; oy++) {
                        for (let ox = -2; ox <= 2; ox++) {
                            if (ox === 0 && oy === 0) continue;
                            const t = getTile(x + ox, y + oy);
                            if (!t || typeof t.index !== 'number' || t.index < 0) continue;
                            if (backgroundLike.has(t.index)) continue;
                            candidatesR2.push(t.index);
                        }
                    }

                    const bestR2 = candidatesR2.length >= 3 ? pickMajority(candidatesR2, 3, 0.25) : null;
                    if (bestR2 !== null) {
                        layer.putTileAt(bestR2, x, y);
                    }
                }
            }
        };

        for (let pass = 0; pass < 15; pass++) {
            autoFillLayerHoles(this.belowLayer);
            autoFillLayerHoles(this.worldLayer);
            autoFillLayerHoles(this.grassLayer);
            autoFillLayerHoles(this.aboveLayer);
        }

        const pruneLonelyStructureTiles = (layer) => {
            if (!layer || !layer.layer || !layer.layer.data) return;
            const width = layer.layer.width;
            const height = layer.layer.height;

            const countsAll = new Map();
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const t = layer.getTileAt(x, y);
                    if (!t || typeof t.index !== 'number' || t.index < 0) continue;
                    countsAll.set(t.index, (countsAll.get(t.index) || 0) + 1);
                }
            }
            const sortedCounts = Array.from(countsAll.entries()).sort((a, b) => b[1] - a[1]);
            const backgroundLike = new Set(sortedCounts.slice(0, 20).map(([idx]) => idx));

            const getTile = (tx, ty) => {
                if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
                return layer.getTileAt(tx, ty) || null;
            };

            const toRemove = [];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const t = layer.getTileAt(x, y);
                    if (!t || typeof t.index !== 'number' || t.index < 0) continue;
                    if (backgroundLike.has(t.index)) continue;

                    const neighbors = [
                        getTile(x - 1, y), getTile(x + 1, y),
                        getTile(x, y - 1), getTile(x, y + 1),
                        getTile(x - 1, y - 1), getTile(x + 1, y - 1),
                        getTile(x - 1, y + 1), getTile(x + 1, y + 1),
                    ].filter((n) => n && typeof n.index === 'number' && n.index >= 0 && !backgroundLike.has(n.index));

                    // If a structure-like tile is basically isolated, it's usually a stray cut-off tree/top.
                    if (neighbors.length <= 1) {
                        toRemove.push({ x, y });
                    }
                }
            }

            toRemove.forEach(({ x, y }) => layer.removeTileAt(x, y));
        };

        // Remove stray single-tile artifacts (commonly cut tree fragments).
        pruneLonelyStructureTiles(this.grassLayer);
        pruneLonelyStructureTiles(this.aboveLayer);

        const mostCommonTileIndex = (layer) => {
            if (!layer || !layer.layer || !layer.layer.data) return null;
            const width = layer.layer.width;
            const height = layer.layer.height;
            const counts = new Map();
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const t = layer.getTileAt(x, y);
                    if (!t || typeof t.index !== 'number' || t.index < 0) continue;
                    counts.set(t.index, (counts.get(t.index) || 0) + 1);
                }
            }
            let best = null;
            let bestCount = 0;
            for (const [idx, c] of counts.entries()) {
                if (c > bestCount) {
                    best = idx;
                    bestCount = c;
                }
            }
            return best;
        };

        const setBottomRowsToIndex = (layer, rows, index) => {
            if (!layer || !layer.layer || !layer.layer.data || index === null) return;
            const width = layer.layer.width;
            const height = layer.layer.height;
            const startY = Math.max(0, height - rows);
            for (let y = startY; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    layer.putTileAt(index, x, y);
                }
            }
        };

        const setTopRowsToIndex = (layer, rows, index) => {
            if (!layer || !layer.layer || !layer.layer.data || index === null) return;
            const width = layer.layer.width;
            const height = layer.layer.height;
            const endY = Math.min(height, rows);
            for (let y = 0; y < endY; y++) {
                for (let x = 0; x < width; x++) {
                    layer.putTileAt(index, x, y);
                }
            }
        };

        const clearBottomRows = (layer, rows) => {
            if (!layer || !layer.layer || !layer.layer.data) return;
            const width = layer.layer.width;
            const height = layer.layer.height;
            const startY = Math.max(0, height - rows);
            for (let y = startY; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    layer.removeTileAt(x, y);
                }
            }
        };

        const clearTopRows = (layer, rows) => {
            if (!layer || !layer.layer || !layer.layer.data) return;
            const width = layer.layer.width;
            const height = layer.layer.height;
            const endY = Math.min(height, rows);
            for (let y = 0; y < endY; y++) {
                for (let x = 0; x < width; x++) {
                    layer.removeTileAt(x, y);
                }
            }
        };

        if (this.mapName === 'route1') {
            const baseGrass = mostCommonTileIndex(this.belowLayer);
            const bottomBandRows = 6;
            setBottomRowsToIndex(this.belowLayer, bottomBandRows, baseGrass);
            setBottomRowsToIndex(this.worldLayer, bottomBandRows, baseGrass);

            // No bushes / no leftover tree tops in the bottom band.
            clearBottomRows(this.grassLayer, bottomBandRows);
            clearBottomRows(this.aboveLayer, bottomBandRows);
        }

        if (this.mapName === 'city2') {
            const baseGrass = mostCommonTileIndex(this.belowLayer);
            const edgeBandRows = 6;

            setTopRowsToIndex(this.belowLayer, edgeBandRows, baseGrass);
            setTopRowsToIndex(this.worldLayer, edgeBandRows, baseGrass);
            clearTopRows(this.grassLayer, edgeBandRows);
            clearTopRows(this.aboveLayer, edgeBandRows);

            setBottomRowsToIndex(this.belowLayer, edgeBandRows, baseGrass);
            setBottomRowsToIndex(this.worldLayer, edgeBandRows, baseGrass);
            clearBottomRows(this.grassLayer, edgeBandRows);
            clearBottomRows(this.aboveLayer, edgeBandRows);
        }

        this.worldLayer.setCollisionByProperty({collides: true});

        // By default, everything gets depth sorted on the screen in the order we created things. Here, we
        // want the "Above Player" layer to sit on top of the player, so we explicitly give it a depth.
        // Higher depths will sit on top of lower depth objects.
        this.aboveLayer.setDepth(10);

        // Get spawn point — prefer a directional one matching where we came from
        const fromSpawnName = this.fromMap
            ? 'From' + this.fromMap.charAt(0).toUpperCase() + this.fromMap.slice(1)
            : null;
        const spawnPoint =
            (fromSpawnName && this.map.findObject("SpawnPoints", obj => obj.name === fromSpawnName))
            || this.map.findObject("SpawnPoints", obj => obj.name === "Spawn Point");

        // Set player
        this.player = new Player({
            scene: this,
            worldLayer: this.worldLayer,
            key: 'player',
            x: spawnPoint.x,
            y: spawnPoint.y
        });

        const camera = this.cameras.main;
        camera.startFollow(this.player);
        camera.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        const computeFitZoom = () => {
            const minZoomX = this.scale.width / this.map.widthInPixels;
            const minZoomY = this.scale.height / this.map.heightInPixels;
            return Math.max(minZoomX, minZoomY);
        };

        const zoomIn = 2;
        const zoomOut = computeFitZoom();
        const savedZoomMode = this.registry.get('cameraZoomMode');
        const initialMode = savedZoomMode === 'out' ? 'out' : 'in';
        camera.setZoom(initialMode === 'out' ? zoomOut : zoomIn);

        const zoomToggleEl = document.getElementById('zoom-toggle');
        const legendEl = document.getElementById('legend-text');
        const setZoomLabel = () => {
            if (!zoomToggleEl) return;
            const outNow = Math.abs(camera.zoom - zoomOut) < 0.0001;
            zoomToggleEl.textContent = outNow ? 'Zoom: OUT' : 'Zoom: IN';
        };

        setZoomLabel();

        if (legendEl) {
            const mapLabel = this.mapName === 'town' ? 'Pallet Town' : this.mapName === 'route1' ? 'Route 1' : this.mapName === 'city2' ? 'Viridian City' : this.mapName === 'city3' ? 'Slate City' : this.mapName;
            legendEl.textContent = `Map: ${mapLabel}\nArrow keys: move\nSPACE: doors / exit\nE: battle nearby\nF: fullscreen`;
        }

        this.onZoomToggleClick = () => {
            const outNow = Math.abs(camera.zoom - zoomOut) < 0.0001;
            const nextMode = outNow ? 'in' : 'out';
            const nextZoom = nextMode === 'out' ? computeFitZoom() : zoomIn;
            camera.setZoom(nextZoom);
            this.registry.set('cameraZoomMode', nextMode);
            setZoomLabel();
        };

        if (zoomToggleEl) {
            zoomToggleEl.removeEventListener('click', this.onZoomToggleClick);
            zoomToggleEl.addEventListener('click', this.onZoomToggleClick);
        }

        this.scale.on('resize', () => {
            const mode = this.registry.get('cameraZoomMode') === 'out' ? 'out' : 'in';
            if (mode === 'out') {
                camera.setZoom(computeFitZoom());
            }
            setZoomLabel();
        });

        cursors = this.input.keyboard.createCursorKeys();
        this.battleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        this.npcs = [];
        this.monsters = [];
        this.monsterGroup = this.physics.add.group();
        if (this.mapName === 'town') {
            this.createNpcs();
        } else if (this.mapName === 'route1') {
            this.createRoute1Npcs();
        } else if (this.mapName === 'city2') {
            this.createCity2Npcs();
        } else if (this.mapName === 'city3') {
            this.createCity3Npcs();
        }

        this.playerMonsterCollider = this.physics.add.collider(this.player, this.monsterGroup);

        this.events.once('shutdown', () => {
            if (this.playerMonsterCollider) this.playerMonsterCollider.destroy();
            if (zoomToggleEl && this.onZoomToggleClick) zoomToggleEl.removeEventListener('click', this.onZoomToggleClick);
        });

        this.startMonsterWander();

        this.debugGraphics();

        this.movementTimer();

        // Pokemon-style fade in when entering a new map
        this.cameras.main.fadeIn(400, 0, 0, 0);
    }

    createRoute1Npcs() {
        // Wild monsters roaming Route 1
        const route1Spawns = [
            { x: 200, y: 180 },
            { x: 700, y: 280 },
            { x: 400, y: 350 },
            { x: 900, y: 200 },
            { x: 550, y: 450 },
            { x: 1050, y: 380 },
            { x: 840, y: 420 },
            { x: 320, y: 220 },
            { x: 260, y: 460 },
            { x: 460, y: 240 },
            { x: 620, y: 520 },
            { x: 760, y: 160 },
            { x: 980, y: 460 },
            { x: 1120, y: 240 },
            { x: 920, y: 320 },
            { x: 520, y: 360 },
        ];
        route1Spawns.forEach((p) => this.createMonster(this.randomMonsterDef(p.x, p.y)));
        // Travelling trainer NPC
        const trainer = this.physics.add.staticSprite(640, 300, 'players', 'boss_right_walk.002.png');
        trainer.setDepth(6);
        trainer.name = 'Route Trainer';
        this.npcs.push(trainer);
        this.autoScaleNpcs();
    }

    createCity2Npcs() {
        // City residents / gym trainers
        const nurse2 = this.physics.add.staticSprite(520, 288, 'players', 'nurse_left.png');
        nurse2.setDepth(6);
        nurse2.name = 'Nurse Joy';

        const gymLeader = this.physics.add.staticSprite(640, 480, 'players', 'boss_right_walk.002.png');
        gymLeader.setDepth(6);
        gymLeader.name = 'Gym Leader';

        this.npcs.push(nurse2, gymLeader);

        // Stronger monsters in City 2
        const city2Spawns = [
            { x: 250,  y: 200 },
            { x: 950,  y: 220 },
            { x: 400,  y: 700 },
            { x: 800,  y: 700 },
            { x: 640,  y: 800 },
            { x: 300,  y: 500 },
            { x: 980,  y: 640 },
            { x: 520,  y: 540 },
            { x: 720,  y: 560 },
            { x: 860,  y: 360 },
            { x: 560,  y: 260 },
            { x: 360,  y: 320 },
            { x: 460,  y: 860 },
            { x: 920,  y: 820 },
            { x: 680,  y: 420 },
            { x: 1040, y: 420 },
        ];
        city2Spawns.forEach((p) => this.createMonster(this.randomMonsterDef(p.x, p.y)));
        this.autoScaleNpcs();
    }

    createCity3Npcs() {
        // Urban residents — spread across the large NYC-style grid
        const npcDefs = [
            { frame: 'nurse_left.png',          x: 1300, y: 150,  name: 'City Nurse'      },
            { frame: 'boss_right_walk.002.png', x: 400,  y: 450,  name: 'Street Boss'     },
            { frame: 'nurse_left.png',          x: 1900, y: 800,  name: 'Park Ranger'     },
            { frame: 'boss_right_walk.002.png', x: 700,  y: 1200, name: 'City Trainer'    },
            { frame: 'nurse_left.png',          x: 2200, y: 1500, name: 'Metro Guard'     },
            { frame: 'boss_right_walk.002.png', x: 1050, y: 1700, name: 'Elite Trainer'   },
        ];
        npcDefs.forEach(({ frame, x, y, name }) => {
            const spr = this.physics.add.staticSprite(x, y, 'players', frame);
            spr.setDepth(6); spr.name = name;
            this.npcs.push(spr);
        });

        // Powerful urban monsters scattered across the city blocks and park
        const city3Spawns = [
            { x: 350,  y: 400 },
            { x: 900,  y: 300 },
            { x: 1280, y: 900 },
            { x: 1700, y: 1100 },
            { x: 600,  y: 1400 },
            { x: 2000, y: 1600 },
            { x: 1400, y: 500 },
            { x: 2100, y: 700 },
            { x: 1860, y: 420 },
            { x: 560,  y: 980 },
            { x: 1040, y: 1680 },
            { x: 760,  y: 760 },
            { x: 1160, y: 520 },
            { x: 1520, y: 820 },
            { x: 1760, y: 640 },
            { x: 420,  y: 1220 },
            { x: 920,  y: 1240 },
            { x: 1360, y: 1420 },
            { x: 1880, y: 1280 },
        ];
        city3Spawns.forEach((p) => this.createMonster(this.randomMonsterDef(p.x, p.y)));
        this.autoScaleNpcs();
    }

    randomMonsterDef(x, y) {
        const sheets = ["monstersBase", "monstersNyx8", "monstersZughy32"];
        const textureKey = Phaser.Math.RND.pick(sheets);
        const frame = Phaser.Math.Between(0, 95);
        const name = `Mob-${textureKey}-${frame}`;
        return { name, textureKey, frame, x, y };
    }

    createMonster(m) {
        const sprite = this.physics.add.sprite(m.x, m.y, m.textureKey, m.frame);
        sprite.setDepth(6);
        sprite.name = m.name;
        sprite.battleSprite = { textureKey: m.textureKey, frame: m.frame };
        sprite.isMonster = true;
        sprite.setScale(2);
        sprite.setImmovable(true);
        if (sprite.body) {
            sprite.body.immovable = true;
            if (typeof sprite.body.setPushable === 'function') {
                sprite.body.setPushable(false);
            } else if (Object.prototype.hasOwnProperty.call(sprite.body, 'pushable')) {
                sprite.body.pushable = false;
            }
            if (typeof sprite.body.setMass === 'function') {
                sprite.body.setMass(1000000);
            } else if (Object.prototype.hasOwnProperty.call(sprite.body, 'mass')) {
                sprite.body.mass = 1000000;
            }
            sprite.body.setCollideWorldBounds(true);
            sprite.body.setDrag(260, 260);
            sprite.body.setMaxVelocity(70, 70);
            sprite.body.setSize(sprite.width * 0.6, sprite.height * 0.6, true);
        }

        if (this.worldLayer) {
            this.physics.add.collider(sprite, this.worldLayer);
        }

        this.npcs.push(sprite);
        this.monsters.push(sprite);
        this.monsterGroup.add(sprite);
        return sprite;
    }

    startMonsterWander() {
        if (this.monsterWanderTimer) {
            this.monsterWanderTimer.remove(false);
            this.monsterWanderTimer = null;
        }
        if (!this.monsters || this.monsters.length === 0) return;

        const chooseDir = (monster, now) => {
            const speed = Phaser.Math.Between(18, 46);
            const diag = Math.round(speed * 0.72);
            const dirs = [
                { x: 0, y: 0 },
                { x: -speed, y: 0 },
                { x: speed, y: 0 },
                { x: 0, y: -speed },
                { x: 0, y: speed },
                { x: -diag, y: -diag },
                { x: diag, y: -diag },
                { x: -diag, y: diag },
                { x: diag, y: diag },
            ];

            const pauseChance = 0.25;
            const pick = Math.random() < pauseChance ? dirs[0] : Phaser.Math.RND.pick(dirs.slice(1));
            const duration = pick.x === 0 && pick.y === 0
                ? Phaser.Math.Between(450, 1100)
                : Phaser.Math.Between(900, 2200);

            monster.setData("wanderUntil", now + duration);

            if (monster.body) {
                monster.body.setVelocity(pick.x, pick.y);
            }
        };

        const now = this.time.now;
        this.monsters.forEach((m) => {
            if (!m || !m.active) return;
            chooseDir(m, now);
        });

        this.monsterWanderTimer = this.time.addEvent({
            delay: 300,
            loop: true,
            callback: () => {
                if (!this.monsters) return;
                const t = this.time.now;
                this.monsters.forEach((monster) => {
                    if (!monster || !monster.active || !monster.body) return;

                    const b = monster.body;
                    const blocked = b.blocked && (b.blocked.left || b.blocked.right || b.blocked.up || b.blocked.down);
                    const touching = b.touching && (b.touching.left || b.touching.right || b.touching.up || b.touching.down);
                    const expired = !monster.getData("wanderUntil") || t >= monster.getData("wanderUntil");

                    if (blocked || touching || expired) {
                        chooseDir(monster, t);
                    }
                });
            },
        });
    }

    autoScaleNpcs() {
        if (this.player && this.player.displayHeight) {
            this.npcs.forEach((npc) => {
                if (npc && npc.isMonster) return;
                const baseHeight = npc.displayHeight || npc.height;
                if (!baseHeight) return;
                const raw = this.player.displayHeight / baseHeight;
                const scale = Math.max(1, Math.round(raw));
                npc.setScale(scale);
            });
        }
    }

    createNpcs() {
        // Using existing loaded atlas ("players") from Scene1 preload
        const nurse = this.physics.add.staticSprite(420, 1180, 'players', 'nurse_left.png');
        nurse.setDepth(6);
        nurse.name = 'Nurse';

        const boss = this.physics.add.staticSprite(520, 1180, 'players', 'boss_right_walk.002.png');
        boss.setDepth(6);
        boss.name = 'Boss';

        this.npcs.push(nurse, boss);

        const townSpawns = [
            { x: 460, y: 1120 },
            { x: 560, y: 1120 },
            { x: 640, y: 1120 },
            { x: 720, y: 1120 },
            { x: 520, y: 1060 },
            { x: 680, y: 1060 },
            { x: 600, y: 1040 },
            { x: 740, y: 1040 },
            { x: 460, y: 1040 },
            { x: 360, y: 1120 },
        ];

        townSpawns.forEach((p) => this.createMonster(this.randomMonsterDef(p.x, p.y)));

        this.autoScaleNpcs();
    }

    update(time, delta) {
        // Loop the player update method
        this.player.update(time, delta);

        if (this.npcs && this.npcs.length && Phaser.Input.Keyboard.JustDown(this.battleKey)) {
            const nearNpc = this.npcs.find((npc) => Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) < 40);
            if (nearNpc) {
                this.scene.start('battle', {
                    returnMap: this.mapName,
                    returnPlayerTexturePosition: this.playerTexturePosition,
                    enemyName: nearNpc.name || 'Trainer',
                    enemySprite: nearNpc.battleSprite || null,
                });
                return;
            }
        }

        // console.log('PlayerX: ' + this.player.x);
        // console.log('PlayerY: ' + this.player.y);

        // Horizontal movement
        if (cursors.left.isDown) {
            if (socketKey) {
                if (this.player.isMoved()) {
                    room.then((room) => room && room.send(
                         "PLAYER_MOVED",{
                        position: 'left',
                        x: this.player.x,
                        y: this.player.y
                    })).catch(() => {})
                }
                socketKey = false;
            }
        } else if (cursors.right.isDown) {
            if (socketKey) {
                if (this.player.isMoved()) {
                    room.then((room) => room && room.send(
                         "PLAYER_MOVED",{
                        position: 'right',
                        x: this.player.x,
                        y: this.player.y
                    })).catch(() => {})
                }
                socketKey = false;
            }
        }

        // Vertical movement
        if (cursors.up.isDown) {
            if (socketKey) {
                if (this.player.isMoved()) {
                    room.then((room) => room && room.send(
                        "PLAYER_MOVED",{
                        position: 'back',
                        x: this.player.x,
                        y: this.player.y
                    })).catch(() => {})
                }
                socketKey = false;
            }
        } else if (cursors.down.isDown) {
            if (socketKey) {
                if (this.player.isMoved()) {
                    room.then((room) => room && room.send(
                         "PLAYER_MOVED",{
                        position: 'front',
                        x: this.player.x,
                        y: this.player.y
                    })).catch(() => {})
                }
                socketKey = false;
            }
        }

        // Horizontal movement ended
        if (Phaser.Input.Keyboard.JustUp(cursors.left) === true) {
            room.then((room) => room && room.send( "PLAYER_MOVEMENT_ENDED",{ position: 'left'})).catch(() => {});
        } else if (Phaser.Input.Keyboard.JustUp(cursors.right) === true) {
            room.then((room) => room && room.send( "PLAYER_MOVEMENT_ENDED",{ position: 'right'})).catch(() => {});
        }

        // Vertical movement ended
        if (Phaser.Input.Keyboard.JustUp(cursors.up) === true) {
            room.then((room) => room && room.send( "PLAYER_MOVEMENT_ENDED", {position: 'back'})).catch(() => {});
        } else if (Phaser.Input.Keyboard.JustUp(cursors.down) === true) {
            room.then((room) => room && room.send( "PLAYER_MOVEMENT_ENDED", {position: 'front'})).catch(() => {});
        }
    }

    movementTimer() {
        setInterval(() => {
            socketKey = true;
        }, 50)
    }

    debugGraphics() {
        // Debug graphics
        this.input.keyboard.once("keydown_D", event => {
            // Turn on physics debugging to show player's hitbox
            this.physics.world.createDebugGraphic();

            // Create worldLayer collision graphic above the player, but below the help text
            const graphics = this.add
                .graphics()
                .setAlpha(0.75)
                .setDepth(20);
            this.worldLayer.renderDebug(graphics, {
                tileColor: null, // Color of non-colliding tiles
                collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255), // Color of colliding tiles
                faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Color of colliding face edges
            });
        });
    }
}
