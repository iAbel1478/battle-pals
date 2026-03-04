import Phaser from "phaser";
import { room } from './SocketServer';


export default class Player extends Phaser.GameObjects.Sprite {
    constructor(config) {
        super(config.scene, config.x, config.y, config.key);

        this.scene.add.existing(this);
        this.scene.physics.world.enableBody(this);
        this.scene.physics.add.collider(this, config.worldLayer);

        this.setTexture("currentPlayer", `misa-${this.scene.playerTexturePosition}`);

        this.setScale(1);

        // Register cursors for player movement
        this.cursors = this.scene.input.keyboard.createCursorKeys();

        // Player Offset
        const footOffset = 24;
        this.body.setSize(this.width, this.height - footOffset, true);
        this.body.setOffset(0, footOffset);

        // Player can't go out of the world
        this.body.setCollideWorldBounds(true)

        // Set depth (z-index)
        this.setDepth(5);

        // Container to store old data
        this.container = [];

        // Player speed
        this.speed = 150;

        this.canChangeMap = true;

        // Player nickname text
        this.playerNickname = this.scene.add.text((this.x - this.displayWidth * 0.7), (this.y - (this.displayHeight / 2)), 'Player');

        // Add spacebar input
        this.spacebar = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    update(time, delta) {
        const prevVelocity = this.body.velocity.clone();

        // Show player nickname above player
        this.showPlayerNickname();

        // Player door interaction
        this.doorInteraction();

        // Player world interaction
        this.worldInteraction();

        // Stop any previous movement from the last frame
        this.body.setVelocity(0);

        // Horizontal movement
        if (this.cursors.left.isDown) {
            this.body.setVelocityX(-this.speed);
        } else if (this.cursors.right.isDown) {
            this.body.setVelocityX(this.speed);
        }

        // Vertical movement
        if (this.cursors.up.isDown) {
            this.body.setVelocityY(-this.speed);
        } else if (this.cursors.down.isDown) {
            this.body.setVelocityY(this.speed);
        }

        // Normalize and scale the velocity so that player can't move faster along a diagonal
        this.body.velocity.normalize().scale(this.speed);

        // Update the animation last and give left/right animations precedence over up/down animations
        if (this.cursors.left.isDown) {
            this.anims.play("misa-left-walk", true);
        } else if (this.cursors.right.isDown) {
            this.anims.play("misa-right-walk", true);
        } else if (this.cursors.up.isDown) {
            this.anims.play("misa-back-walk", true);
        } else if (this.cursors.down.isDown) {
            this.anims.play("misa-front-walk", true);
        } else {
            this.anims.stop();

            // If we were moving, pick and idle frame to use
            if (prevVelocity.x < 0) this.setTexture("currentPlayer", "misa-left");
            else if (prevVelocity.x > 0) this.setTexture("currentPlayer", "misa-right");
            else if (prevVelocity.y < 0) this.setTexture("currentPlayer", "misa-back");
            else if (prevVelocity.y > 0) this.setTexture("currentPlayer", "misa-front");
        }
    }

    showPlayerNickname() {
        this.playerNickname.x = this.x - (this.playerNickname.width / 2);
        this.playerNickname.y = this.y - (this.displayHeight / 2);
    }

    isMoved() {
        if (this.container.oldPosition && (this.container.oldPosition.x !== this.x || this.container.oldPosition.y !== this.y)) {
            this.container.oldPosition = {x: this.x, y: this.y};
            return true;
        } else {
            this.container.oldPosition = {x: this.x, y: this.y};
            return false;
        }
    }

    doorInteraction() {
        this.scene.map.findObject("Doors", obj => {
            if ((this.y >= obj.y && this.y <= (obj.y + obj.height)) && (this.x >= obj.x && this.x <= (obj.x + obj.width))) {
                console.log('Player is by ' + obj.name);
                if (!this.canChangeMap) return;
                if (Phaser.Input.Keyboard.JustDown(this.spacebar)) {
                    const targetMapProp = obj.properties && obj.properties.find((p) => p.name === 'targetMap');
                    const targetSceneProp = obj.properties && obj.properties.find((p) => p.name === 'targetScene');
                    const targetXProp = obj.properties && obj.properties.find((p) => p.name === 'targetX');
                    const targetYProp = obj.properties && obj.properties.find((p) => p.name === 'targetY');
                    const playerTexturePositionProp = obj.properties && obj.properties.find((p) => p.name === 'playerTexturePosition');

                    let targetScene = targetSceneProp && targetSceneProp.value;
                    let targetMap = targetMapProp && targetMapProp.value;

                    if (!targetScene && !targetMap && this.scene.mapName === 'town') {
                        if (obj.name === 'DoorA') targetScene = 'house1';
                        if (obj.name === 'DoorB') targetScene = 'house2';
                    }

                    if (!targetScene && !targetMap) {
                        console.warn('Door missing targetMap/targetScene property:', obj.name);
                        return;
                    }

                    this.canChangeMap = false;
                    const playerTexturePosition = (playerTexturePositionProp && playerTexturePositionProp.value) || 'front';
                    if (targetScene) {
                        this.scene.scene.start(targetScene, {
                            returnMap: this.scene.mapName,
                            returnPlayerTexturePosition: playerTexturePosition,
                        });
                    } else {
                        this.scene.registry.destroy();
                        this.scene.events.off();
                        this.scene.scene.restart({
                            map: targetMap,
                            playerTexturePosition: playerTexturePosition,
                        });

                        room
                            .then((room) => room && room.send(
                                "PLAYER_CHANGED_MAP",
                                { map: targetMap }
                            ))
                            .catch(() => {});
                    }

                    if (!targetScene && targetXProp && targetYProp) {
                        this.x = targetXProp.value;
                        this.y = targetYProp.value;
                    }
                    setTimeout(() => {
                        this.canChangeMap = true;
                    }, 500);
                }
            }
        });
    }

    worldInteraction() {
        this.scene.map.findObject("Worlds", world => {
            // Use physics body bounds for accurate detection (body can reach map edges even when sprite center can't)
            const bodyOverlaps =
                this.body.right  > world.x &&
                this.body.left   < world.x + world.width &&
                this.body.bottom > world.y &&
                this.body.top    < world.y + world.height;

            // Only trigger if pressing toward the zone (cursor keys, not velocity — physics zeros velocity at world bounds)
            const zoneCenterY = world.y + world.height / 2;
            const zoneCenterX = world.x + world.width / 2;
            const mapMidY = this.scene.map.heightInPixels / 2;
            const mapMidX = this.scene.map.widthInPixels / 2;
            const movingToward =
                (zoneCenterY > mapMidY && this.cursors.down.isDown) ||
                (zoneCenterY < mapMidY && this.cursors.up.isDown) ||
                (zoneCenterX > mapMidX && this.cursors.right.isDown) ||
                (zoneCenterX < mapMidX && this.cursors.left.isDown);

            if (bodyOverlaps && movingToward) {
                if (!this.canChangeMap) return;
                console.log('Player is by world entry: ' + world.name);
                this.canChangeMap = false;

                // Get playerTexturePosition from Worlds object property
                let playerTexturePosition;
                if (world.properties) playerTexturePosition = world.properties.find((property) => property.name === 'playerTexturePosition');
                if (playerTexturePosition) this.playerTexturePosition = playerTexturePosition.value;

                const fromMap = this.scene.mapName;
                const targetMap = world.name;
                const texturePos = this.playerTexturePosition;

                // Pokemon-style: fade to black, then switch map
                this.scene.cameras.main.fadeOut(350, 0, 0, 0, (cam, progress) => {
                    if (progress < 1) return;
                    room.then((r) => r && r.send("PLAYER_CHANGED_MAP", { map: targetMap })).catch(() => {});
                    this.scene.registry.destroy();
                    this.scene.events.off();
                    this.scene.scene.restart({ map: targetMap, playerTexturePosition: texturePos, fromMap });
                });

                setTimeout(() => { this.canChangeMap = true; }, 1200);
            }
        });
    }
}
