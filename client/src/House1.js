import Phaser from "phaser";

export class House1 extends Phaser.Scene {
    constructor() {
        super("house1");
    }

    init(data) {
        this.returnMap = (data && data.returnMap) || "town";
        this.returnPlayerTexturePosition = (data && data.returnPlayerTexturePosition) || "front";
    }

    create() {
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, 0x6f6a5b).setOrigin(0).setDepth(0);
        this.add.rectangle(0, 0, width, 48, 0x4a463c).setOrigin(0).setDepth(1);
        this.add.rectangle(0, height - 96, width, 96, 0x1a1a1a).setOrigin(0).setDepth(10);

        this.physics.world.setBounds(0, 0, width, height);

        // Colliders (simple furniture)
        const table = this.add.rectangle(140, 170, 140, 70, 0xa06b2a).setOrigin(0.5).setDepth(2);
        table.setStrokeStyle(3, 0x000000, 0.5);
        const tableTop = this.add.rectangle(140, 170, 130, 60, 0xb37b35).setOrigin(0.5).setDepth(3);
        tableTop.setStrokeStyle(2, 0x000000, 0.35);
        const couch = this.add.rectangle(610, 210, 180, 90, 0x2f79c8).setOrigin(0.5).setDepth(2);
        couch.setStrokeStyle(3, 0x000000, 0.5);
        const couchSeat = this.add.rectangle(610, 210, 170, 80, 0x3b8fe0).setOrigin(0.5).setDepth(3);
        couchSeat.setStrokeStyle(2, 0x000000, 0.35);

        this.physics.add.existing(table, true);
        this.physics.add.existing(couch, true);

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
        this.npc = this.physics.add.staticSprite(420, 210, 'players', 'nurse_left.png');
        this.npc.setDepth(5);
        this.npc.setScale(2.5);
        this.npcName = 'Nurse';

        this.physics.add.collider(this.player, table);
        this.physics.add.collider(this.player, couch);
        this.physics.add.collider(this.player, this.npc);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.talkKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        this.dialogue = this.add.text(16, height - 88, "", {
            font: "18px monospace",
            fill: "#ffffff",
            wordWrap: { width: width - 32 },
        }).setDepth(11);

        this.help = this.add.text(16, 12, "House 1  |  Arrows: move  |  E: talk  |  SPACE: exit", {
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
                    `${this.npcName}: Welcome!\n` +
                    `Rest here before battling.\n` +
                    `Outside: press E near NPCs to battle.`
                );
            }
        }
    }
}
