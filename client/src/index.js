import Phaser from "phaser";
import { Scene1 } from "./Scene1";
import { Scene2 } from "./Scene2";
import { House1 } from "./House1";
import { House2 } from "./House2";
import { BattleScene } from "./BattleScene";

const Config = {
    type: Phaser.AUTO,
    parent: "game-container",
    pixelArt: true,
    backgroundColor: "#000000",
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 450,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: {y: 0}
        }
    },
    scene: [Scene1, Scene2, House1, House2, BattleScene],
};

export default new Phaser.Game(Config);
