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
    }

    create() {
        room
            .then((room) => {
                if (!room || typeof room.onMessage !== 'function') {
                    console.error('Room not available or missing onMessage handler', room);
                    return;
                }
                room.onMessage((data) => {
                    if (data.event === 'CURRENT_PLAYERS') {
                        console.log('CURRENT_PLAYERS');

                        Object.keys(data.players).forEach(playerId => {
                            let player = data.players[playerId];

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
                    if (data.event === 'PLAYER_JOINED') {
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
                    if (data.event === 'PLAYER_LEFT') {
                        console.log('PLAYER_LEFT');

                        if (onlinePlayers[data.sessionId]) {
                            onlinePlayers[data.sessionId].destroy();
                            delete onlinePlayers[data.sessionId];
                        }
                    }
                    if (data.event === 'PLAYER_MOVED') {
                        //console.log('PLAYER_MOVED');

                        // If player is in same map
                        if (this.mapName === onlinePlayers[data.sessionId].map) {

                            // If player isn't registered in this scene (map changing bug..)
                            if (!onlinePlayers[data.sessionId].scene) {
                                onlinePlayers[data.sessionId] = new OnlinePlayer({
                                    scene: this,
                                    playerId: data.sessionId,
                                    key: data.sessionId,
                                    map: data.map,
                                    x: data.x,
                                    y: data.y
                                });
                            }
                            // Start animation and set sprite position
                            onlinePlayers[data.sessionId].isWalking(data.position, data.x, data.y);
                        }
                    }
                    if (data.event === 'PLAYER_MOVEMENT_ENDED') {
                        // If player is in same map
                        if (this.mapName === onlinePlayers[data.sessionId].map) {

                            // If player isn't registered in this scene (map changing bug..)
                            if (!onlinePlayers[data.sessionId].scene) {
                                onlinePlayers[data.sessionId] = new OnlinePlayer({
                                    scene: this,
                                    playerId: data.sessionId,
                                    key: data.sessionId,
                                    map: data.map,
                                    x: data.x,
                                    y: data.y
                                });
                            }
                            // Stop animation & set sprite texture
                            onlinePlayers[data.sessionId].stopWalking(data.position)
                        }
                    }
                    if (data.event === 'PLAYER_CHANGED_MAP') {
                        console.log('PLAYER_CHANGED_MAP');

                        if (onlinePlayers[data.sessionId]) {
                            onlinePlayers[data.sessionId].destroy();

                            if (data.map === this.mapName && !onlinePlayers[data.sessionId].scene) {
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
                })
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

        cursors = this.input.keyboard.createCursorKeys();
        this.battleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        // Help text that has a "fixed" position on the screen
        const mapLabel = this.mapName === 'town' ? 'Pallet Town' : this.mapName === 'route1' ? 'Route 1' : this.mapName === 'city2' ? 'Viridian City' : this.mapName === 'city3' ? 'Slate City' : this.mapName;
        this.add
            .text(16, 16, `[${mapLabel}]\nArrow keys to move\nSPACE: doors / exit house\nE: battle nearby NPC\nF: fullscreen | D: hitboxes`, {
                font: "18px monospace",
                fill: "#000000",
                padding: {x: 20, y: 10},
                backgroundColor: "#ffffff"
            })
            .setScrollFactor(0)
            .setDepth(30);

        this.npcs = [];
        if (this.mapName === 'town') {
            this.createNpcs();
        } else if (this.mapName === 'route1') {
            this.createRoute1Npcs();
        } else if (this.mapName === 'city2') {
            this.createCity2Npcs();
        } else if (this.mapName === 'city3') {
            this.createCity3Npcs();
        }

        this.debugGraphics();

        this.movementTimer();

        // Pokemon-style fade in when entering a new map
        this.cameras.main.fadeIn(400, 0, 0, 0);
    }

    createRoute1Npcs() {
        // Wild monsters roaming Route 1
        const route1Monsters = [
            { name: 'Thornvine', textureKey: 'monstersBase', frame: 24, x: 200, y: 180 },
            { name: 'Pebblefang', textureKey: 'monstersBase', frame: 36, x: 700, y: 280 },
            { name: 'Gloomoth', textureKey: 'monstersNyx8', frame: 6,  x: 400, y: 350 },
            { name: 'Frostpaw', textureKey: 'monstersNyx8', frame: 18, x: 900, y: 200 },
            { name: 'Cindermaw', textureKey: 'monstersZughy32', frame: 0, x: 550, y: 450 },
            { name: 'Bogslug',   textureKey: 'monstersZughy32', frame: 12, x: 1050, y: 380 },
        ];
        route1Monsters.forEach((m) => {
            const sprite = this.physics.add.staticSprite(m.x, m.y, m.textureKey, m.frame);
            sprite.setDepth(6);
            sprite.name = m.name;
            sprite.battleSprite = { textureKey: m.textureKey, frame: m.frame };
            sprite.isMonster = true;
            this.npcs.push(sprite);
        });
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
        const city2Monsters = [
            { name: 'Ironclad',   textureKey: 'monstersBase',    frame: 48, x: 250,  y: 200 },
            { name: 'Voidshade',  textureKey: 'monstersNyx8',    frame: 42, x: 950,  y: 220 },
            { name: 'Emberstorm', textureKey: 'monstersZughy32', frame: 24, x: 400,  y: 700 },
            { name: 'Crystalix',  textureKey: 'monstersBase',    frame: 60, x: 800,  y: 700 },
            { name: 'Tidecaller', textureKey: 'monstersNyx8',    frame: 54, x: 640,  y: 800 },
            { name: 'Stoneback',  textureKey: 'monstersZughy32', frame: 36, x: 300,  y: 500 },
        ];
        city2Monsters.forEach((m) => {
            const sprite = this.physics.add.staticSprite(m.x, m.y, m.textureKey, m.frame);
            sprite.setDepth(6);
            sprite.name = m.name;
            sprite.battleSprite = { textureKey: m.textureKey, frame: m.frame };
            sprite.isMonster = true;
            this.npcs.push(sprite);
        });
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
        const city3Monsters = [
            { name: 'Neonshade',  textureKey: 'monstersNyx8',    frame: 60, x: 350,  y: 400  },
            { name: 'Steelclaw', textureKey: 'monstersBase',    frame: 72, x: 900,  y: 300  },
            { name: 'Smogwing', textureKey: 'monstersZughy32', frame: 48, x: 1280, y: 900  },
            { name: 'Gravelon', textureKey: 'monstersBase',    frame: 84, x: 1700, y: 1100 },
            { name: 'Thunderpaw', textureKey: 'monstersNyx8',  frame: 66, x: 600,  y: 1400 },
            { name: 'Ironveil',  textureKey: 'monstersZughy32',frame: 60, x: 2000, y: 1600 },
            { name: 'Asphaltus', textureKey: 'monstersBase',   frame: 96, x: 1400, y: 500  },
            { name: 'Darkspire', textureKey: 'monstersNyx8',   frame: 72, x: 2100, y: 700  },
        ];
        city3Monsters.forEach((m) => {
            const sprite = this.physics.add.staticSprite(m.x, m.y, m.textureKey, m.frame);
            sprite.setDepth(6); sprite.name = m.name;
            sprite.battleSprite = { textureKey: m.textureKey, frame: m.frame };
            sprite.isMonster = true;
            this.npcs.push(sprite);
        });
        this.autoScaleNpcs();
    }

    autoScaleNpcs() {
        if (this.player && this.player.displayHeight) {
            this.npcs.forEach((npc) => {
                const baseHeight = npc.displayHeight || npc.height;
                if (!baseHeight) return;
                const scale = this.player.displayHeight / baseHeight;
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

        const monsters = [
            { name: 'Emberfox', textureKey: 'monstersBase', frame: 0, x: 460, y: 1120 },
            { name: 'Mossjaw', textureKey: 'monstersBase', frame: 12, x: 560, y: 1120 },
            { name: 'Shadebat', textureKey: 'monstersNyx8', frame: 30, x: 640, y: 1120 },
            { name: 'Lavarock', textureKey: 'monstersZughy32', frame: 42, x: 720, y: 1120 },
        ];

        monsters.forEach((m) => {
            const sprite = this.physics.add.staticSprite(m.x, m.y, m.textureKey, m.frame);
            sprite.setDepth(6);
            sprite.name = m.name;
            sprite.battleSprite = { textureKey: m.textureKey, frame: m.frame };
            sprite.isMonster = true;
            this.npcs.push(sprite);
        });

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
