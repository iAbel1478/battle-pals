import Phaser from "phaser";

export class House2 extends Phaser.Scene {
    constructor() {
        super("house2");
    }

    init(data) {
        this.returnMap = (data && data.returnMap) || "town";
        this.returnPlayerTexturePosition = (data && data.returnPlayerTexturePosition) || "front";
    }

    create() {
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, 0x6a7fa3).setOrigin(0).setDepth(0);
        this.add.rectangle(0, 0, width, 48, 0x334760).setOrigin(0).setDepth(1);
        this.add.rectangle(0, height - 96, width, 96, 0x121212).setOrigin(0).setDepth(10);

        this.physics.world.setBounds(0, 0, width, height);

        // Colliders (simple furniture)
        const rug = this.add.rectangle(180, 240, 220, 110, 0x5a5a5a).setOrigin(0.5).setDepth(2);
        rug.setStrokeStyle(3, 0x000000, 0.4);
        const rugInner = this.add.rectangle(180, 240, 200, 90, 0x6b6b6b).setOrigin(0.5).setDepth(3);
        rugInner.setStrokeStyle(2, 0x000000, 0.25);
        const shelf = this.add.rectangle(620, 170, 120, 160, 0xc28b3a).setOrigin(0.5).setDepth(2);
        shelf.setStrokeStyle(3, 0x000000, 0.4);
        const shelfInner = this.add.rectangle(620, 170, 110, 150, 0xd69a44).setOrigin(0.5).setDepth(3);
        shelfInner.setStrokeStyle(2, 0x000000, 0.25);

        this.physics.add.existing(rug, true);
        this.physics.add.existing(shelf, true);

        // Exit zone
        this.exitZone = this.add.rectangle(width / 2, height - 40, 220, 50, 0xffffff, 0.15).setOrigin(0.5).setDepth(9);
        this.exitZone.setStrokeStyle(2, 0xffffff, 0.25);
        this.physics.add.existing(this.exitZone, true);

        // Player
        this.player = this.physics.add.sprite(width / 2, height - 140, 'currentPlayer', `misa-${this.returnPlayerTexturePosition}`);
        this.player.setDepth(6);
        this.player.setScale(2.5);
        this.player.body.setCollideWorldBounds(true);

        // NPC
        this.npc = this.physics.add.staticSprite(420, 210, 'players', 'knight_back_walk.002.png');
        this.npc.setDepth(5);
        this.npc.setScale(2.5);
        this.npcName = 'Knight';

        this.physics.add.collider(this.player, rug);
        this.physics.add.collider(this.player, shelf);
        this.physics.add.collider(this.player, this.npc);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.talkKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        this.dialogue = this.add.text(16, height - 88, "", {
            font: "18px monospace",
            fill: "#ffffff",
            wordWrap: { width: width - 32 },
        }).setDepth(11);

        this.help = this.add.text(16, 12, "House 2  |  Arrows: move  |  E: talk  |  SPACE: exit", {
            font: "18px monospace",
            fill: "#ffffff",
        }).setDepth(12);

        this.input.keyboard.on("keydown-SPACE", () => {
            this.scene.start("playGame", {
                map: this.returnMap,
                playerTexturePosition: this.returnPlayerTexturePosition,
            });
        });
    }

    update() {
        if (this.cursors.left.isDown) {
            this.player.setVelocity(-130, 0);
            this.player.setTexture('currentPlayer', 'misa-left');
        } else if (this.cursors.right.isDown) {
            this.player.setVelocity(130, 0);
            this.player.setTexture('currentPlayer', 'misa-right');
        } else if (this.cursors.up.isDown) {
            this.player.setVelocity(0, -130);
            this.player.setTexture('currentPlayer', 'misa-back');
        } else if (this.cursors.down.isDown) {
            this.player.setVelocity(0, 130);
            this.player.setTexture('currentPlayer', 'misa-front');
        } else {
            this.player.setVelocity(0, 0);
        }

        const inExit = this.physics.overlap(this.player, this.exitZone);
        if (inExit) {
            this.dialogue.setText("Exit: Press SPACE to return outside.");
        }

        if (Phaser.Input.Keyboard.JustDown(this.talkKey)) {
            const nearNpc = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) < 60;
            if (nearNpc) {
                this.dialogue.setText(
                    `${this.npcName}: The arena awaits.\n` +
                    `Outside: battle NPCs with E.\n` +
                    `In battle: A=attack, H=heal, R=run.`
                );
            }
        }
    }
}
