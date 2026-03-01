import TownJSON from "./assets/tilemaps/town.json";
import TilesTown from "./assets/tilesets/tuxmon-sample-32px-extruded.png";

import Route1JSON from "./assets/tilemaps/route1.json";
import City2JSON from "./assets/tilemaps/city2.json";
import City3JSON from "./assets/tilemaps/city3.json";

import AtlasJSON from "./assets/atlas/atlas";
import AtlasPNG from "./assets/atlas/atlas.png";
import PlayersAtlasJSON from "./assets/atlas/players";
import PlayersAtlasPNG from "./assets/images/players/players.png";

import MonstersBasePNG from "../../Free ver 2/Mons 24(v2) base spritesheet.png";
import MonstersNyx8PNG from "../../Free ver 2/Mons 24(v2) Nyx8 spritesheet.png";
import MonstersZughy32PNG from "../../Free ver 2/Mons 24(v2) zughy32 spritesheet.png";

export class Scene1 extends Phaser.Scene {
    constructor() {
        super("bootGame");
    }

    preload() {
        // Load Town
        this.load.image("TilesTown", TilesTown);
        this.load.tilemapTiledJSON("town", TownJSON);

        // Load Route1
        this.load.tilemapTiledJSON("route1", Route1JSON);

        // Load City2
        this.load.tilemapTiledJSON("city2", City2JSON);

        // Load City3
        this.load.tilemapTiledJSON("city3", City3JSON);

        // Load atlas
        this.load.atlas("currentPlayer", AtlasPNG, AtlasJSON);
        this.load.atlas("players", PlayersAtlasPNG, PlayersAtlasJSON);

        // Load monsters (24x24 frames, 8 columns x 12 rows)
        this.load.spritesheet("monstersBase", MonstersBasePNG, { frameWidth: 24, frameHeight: 24 });
        this.load.spritesheet("monstersNyx8", MonstersNyx8PNG, { frameWidth: 24, frameHeight: 24 });
        this.load.spritesheet("monstersZughy32", MonstersZughy32PNG, { frameWidth: 24, frameHeight: 24 });
    }

    create() {
        this.add.text(20, 20, "Loading game...");

        this.scene.start("playGame", {map: 'town', playerTexturePosition: 'front'});

        // Create the player's walking animations from the texture currentPlayer. These are stored in the global
        // animation manager so any sprite can access them.
        this.anims.create({
            key: "misa-left-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-left-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "misa-right-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-right-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "misa-front-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-front-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "misa-back-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-back-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });

        // onlinePlayer animations
        this.anims.create({
            key: "onlinePlayer-left-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_left_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
        this.anims.create({
            key: "onlinePlayer-right-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_right_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
        this.anims.create({
            key: "onlinePlayer-front-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_front_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
        this.anims.create({
            key: "onlinePlayer-back-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_back_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
    }
}
