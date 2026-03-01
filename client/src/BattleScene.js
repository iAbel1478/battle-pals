import Phaser from "phaser";
import { room } from "./SocketServer";

export class BattleScene extends Phaser.Scene {
    constructor() {
        super("battle");
    }

    init(data) {
        this.returnMap = (data && data.returnMap) || "town";
        this.returnPlayerTexturePosition = (data && data.returnPlayerTexturePosition) || "front";
        this.enemyName = (data && data.enemyName) || "Trainer";
        this.enemySpriteData = (data && data.enemySprite) || null;

        this.playerHp = 25;
        this.enemyHp = 20;
        this.playerMaxHp = 25;
        this.enemyMaxHp = 20;
        this.inTurn = false;
        this.promptOpen = false;
        this.pendingAction = null;
        this.currentQuestion = null;
        this.answerBuffer = "";
        this.questionToken = null;
        this.usingServerQuestions = true;
        this.logLines = [];
    }

    create() {
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, 0x0b1020).setOrigin(0);
        this.add.rectangle(width / 2, height / 2 + 40, width - 80, 220, 0x203a2b).setOrigin(0.5);
        this.add.rectangle(width / 2, height / 2 + 40, width - 110, 190, 0x2d4b36).setOrigin(0.5);
        this.add.rectangle(width * 0.75, height / 2 - 30, width / 2, height, 0x1a1222, 0.25).setOrigin(0.5);

        this.add.rectangle(0, 0, width, 60, 0x111111).setOrigin(0);
        this.add.rectangle(0, height - 120, width, 120, 0x111111).setOrigin(0);

        this.titleText = this.add.text(16, 18, `Battle vs ${this.enemyName}` , {
            font: "18px monospace",
            fill: "#ffffff",
        });

        room
            .then((r) => {
                if (!r || typeof r.onMessage !== "function") {
                    this.usingServerQuestions = false;
                    return;
                }

                r.onMessage((data) => {
                    if (data && data.event === "BATTLE_QUESTION") {
                        this.questionToken = data.token || null;
                        this.currentQuestion = { text: data.text, answer: null };
                        this.renderPrompt();
                        return;
                    }
                    if (data && data.event === "BATTLE_QUESTION_RESULT") {
                        const action = data.action;
                        const correct = !!data.correct;
                        this.onServerQuestionResult(action, correct);
                    }
                });
            })
            .catch(() => {
                this.usingServerQuestions = false;
            });

        // Sprites
        this.playerSprite = this.add.sprite(160, 210, 'currentPlayer', `misa-${this.returnPlayerTexturePosition}`);
        this.playerSprite.setScale(3);

        if (this.enemySpriteData && this.enemySpriteData.textureKey) {
            this.enemySprite = this.add.sprite(width - 160, 180, this.enemySpriteData.textureKey, this.enemySpriteData.frame);
            this.enemySprite.setScale(3);
        } else {
            this.enemySprite = this.add.sprite(width - 160, 180, 'players', 'boss_right_walk.002.png');
            this.enemySprite.setScale(3);
        }

        this.playerSprite.setData('baseX', this.playerSprite.x);
        this.enemySprite.setData('baseX', this.enemySprite.x);

        this.hpText = this.add.text(16, 60, "", {
            font: "18px monospace",
            fill: "#ffffff",
        });

        this.helpText = this.add.text(16, height - 110, "A: Attack   H: Heal   R: Run", {
            font: "18px monospace",
            fill: "#ffffff",
        });

        this.logText = this.add.text(16, height - 86, "", {
            font: "18px monospace",
            fill: "#ffffff",
            wordWrap: { width: width - 32 },
        });

        this.promptBackdrop = this.add.rectangle(width / 2, height / 2, Math.min(520, width - 40), 220, 0x000000, 0.72);
        this.promptBackdrop.setStrokeStyle(2, 0xffffff, 0.15);
        this.promptBackdrop.setDepth(50);
        this.promptBackdrop.setVisible(false);

        this.promptTitle = this.add.text(width / 2, height / 2 - 80, "", {
            font: "20px monospace",
            fill: "#ffffff",
            align: "center",
        }).setOrigin(0.5);
        this.promptTitle.setDepth(51);
        this.promptTitle.setVisible(false);

        this.promptQuestion = this.add.text(width / 2, height / 2 - 42, "", {
            font: "22px monospace",
            fill: "#ffffff",
            align: "center",
        }).setOrigin(0.5);
        this.promptQuestion.setDepth(51);
        this.promptQuestion.setVisible(false);

        this.promptAnswer = this.add.text(width / 2, height / 2 + 2, "", {
            font: "24px monospace",
            fill: "#22c55e",
            align: "center",
        }).setOrigin(0.5);
        this.promptAnswer.setDepth(51);
        this.promptAnswer.setVisible(false);

        this.promptHelp = this.add.text(width / 2, height / 2 + 54, "Type answer, ENTER to submit, ESC to cancel", {
            font: "16px monospace",
            fill: "#cbd5e1",
            align: "center",
        }).setOrigin(0.5);
        this.promptHelp.setDepth(51);
        this.promptHelp.setVisible(false);

        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.healKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
        this.runKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.backspaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);

        this.input.keyboard.on("keydown", (ev) => {
            if (!this.promptOpen) return;
            if (ev.key >= "0" && ev.key <= "9") {
                if (this.answerBuffer.length < 6) {
                    this.answerBuffer += ev.key;
                    this.renderPrompt();
                }
            }
            if (ev.key === "-") {
                if (this.answerBuffer.length === 0) {
                    this.answerBuffer = "-";
                    this.renderPrompt();
                }
            }
        });

        this.renderHp();
        this.pushLog(`A wild ${this.enemyName} challenges you!`);
    }

    renderHp() {
        this.hpText.setText(
            `You HP: ${this.playerHp}/${this.playerMaxHp}    ` +
            `${this.enemyName} HP: ${this.enemyHp}/${this.enemyMaxHp}`
        );
    }

    pushLog(line) {
        this.logLines.push(line);
        if (this.logLines.length > 3) this.logLines.shift();
        this.logText.setText(this.logLines.join("\n"));
    }

    endBattle(message) {
        this.pushLog(message);
        this.time.delayedCall(600, () => {
            this.scene.start("playGame", {
                map: this.returnMap,
                playerTexturePosition: this.returnPlayerTexturePosition,
            });
        });
    }

    generateArithmeticQuestion() {
        const mode = Phaser.Math.Between(1, 4);
        if (mode === 1) {
            const a = Phaser.Math.Between(10, 200);
            const b = Phaser.Math.Between(10, 200);
            return { text: `${a} + ${b}`, answer: a + b };
        }
        if (mode === 2) {
            const a = Phaser.Math.Between(20, 200);
            const b = Phaser.Math.Between(5, a);
            return { text: `${a} - ${b}`, answer: a - b };
        }
        if (mode === 3) {
            const a = Phaser.Math.Between(2, 12);
            const b = Phaser.Math.Between(2, 12);
            return { text: `${a} × ${b}`, answer: a * b };
        }
        const b = Phaser.Math.Between(2, 12);
        const ans = Phaser.Math.Between(2, 12);
        const a = b * ans;
        return { text: `${a} ÷ ${b}`, answer: ans };
    }

    openPrompt(action) {
        if (this.promptOpen) return;
        this.pendingAction = action;
        this.questionToken = null;
        this.currentQuestion = null;
        this.answerBuffer = "";
        this.promptOpen = true;

        if (this.usingServerQuestions) {
            room
                .then((r) => r && r.send("REQUEST_BATTLE_QUESTION", { action }))
                .catch(() => {
                    this.usingServerQuestions = false;
                    this.currentQuestion = this.generateArithmeticQuestion();
                    this.renderPrompt();
                });
        } else {
            this.currentQuestion = this.generateArithmeticQuestion();
        }

        this.renderPrompt();

        this.promptBackdrop.setVisible(true);
        this.promptTitle.setVisible(true);
        this.promptQuestion.setVisible(true);
        this.promptAnswer.setVisible(true);
        this.promptHelp.setVisible(true);
    }

    closePrompt() {
        this.promptOpen = false;
        this.pendingAction = null;
        this.currentQuestion = null;
        this.answerBuffer = "";
        this.questionToken = null;

        this.promptBackdrop.setVisible(false);
        this.promptTitle.setVisible(false);
        this.promptQuestion.setVisible(false);
        this.promptAnswer.setVisible(false);
        this.promptHelp.setVisible(false);
    }

    renderPrompt() {
        const actionLabel = this.pendingAction === "heal" ? "Heal" : "Attack";
        this.promptTitle.setText(`${actionLabel} locked! Solve to use it`);
        this.promptQuestion.setText(this.currentQuestion ? this.currentQuestion.text : "Loading question...");
        this.promptAnswer.setText(`Answer: ${this.answerBuffer || "_"}`);
    }

    resolvePromptSubmission() {
        if (!this.promptOpen || !this.currentQuestion) return;
        const action = this.pendingAction;

        if (this.usingServerQuestions) {
            const token = this.questionToken;
            const answer = Number(this.answerBuffer);

            if (!token || !Number.isFinite(answer)) {
                this.closePrompt();
                this.pushLog("Invalid answer. You lose your turn.");
                this.enemyTurn();
                return;
            }

            this.closePrompt();
            this.inTurn = true;
            room
                .then((r) => r && r.send("ANSWER_BATTLE_QUESTION", { action, token, answer }))
                .catch(() => {
                    this.inTurn = false;
                    this.pushLog("Server not available. Switching to offline questions.");
                    this.usingServerQuestions = false;
                });
            return;
        }

        const userNum = Number(this.answerBuffer);
        const correct = Number.isFinite(userNum) && userNum === this.currentQuestion.answer;
        this.closePrompt();

        if (!correct) {
            this.pushLog("Incorrect! You lose your turn.");
            this.enemyTurn();
            return;
        }

        if (action === "heal") {
            this.playerHealTurn();
            return;
        }
        this.playerAttackTurn();
    }

    onServerQuestionResult(action, correct) {
        if (correct) {
            if (action === "heal") {
                this.playerHealTurn();
                return;
            }
            this.playerAttackTurn();
            return;
        }

        this.pushLog("Incorrect! You lose your turn.");
        this.enemyTurn();
    }

    enemyTurn() {
        this.inTurn = true;
        this.time.delayedCall(450, () => {
            const enemyDmg = Phaser.Math.Between(3, 6);
            this.playerHp = Math.max(0, this.playerHp - enemyDmg);
            this.renderHp();

            this.tweens.add({
                targets: this.playerSprite,
                x: this.playerSprite.getData('baseX') - 8,
                duration: 60,
                yoyo: true,
                repeat: 2,
            });

            if (this.playerHp <= 0) {
                this.endBattle("You fainted...");
                return;
            }

            this.pushLog(`${this.enemyName} hits you for ${enemyDmg}.`);
            this.inTurn = false;
        });
    }

    playerHealTurn() {
        this.inTurn = true;

        const heal = Phaser.Math.Between(4, 8);
        const prev = this.playerHp;
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + heal);
        this.renderHp();
        this.pushLog(`Correct! You heal ${this.playerHp - prev} HP.`);

        this.enemyTurn();
    }

    playerAttackTurn() {
        this.inTurn = true;

        const playerDmg = Phaser.Math.Between(4, 7);
        this.enemyHp = Math.max(0, this.enemyHp - playerDmg);
        this.renderHp();

        this.tweens.add({
            targets: this.enemySprite,
            x: this.enemySprite.getData('baseX') + 8,
            duration: 60,
            yoyo: true,
            repeat: 2,
        });

        if (this.enemyHp <= 0) {
            this.endBattle(`You defeated ${this.enemyName}!`);
            return;
        }

        this.pushLog(`Correct! You attack for ${playerDmg}.`);
        this.enemyTurn();
    }

    update() {
        if (this.promptOpen) {
            if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
                this.closePrompt();
            }
            if (Phaser.Input.Keyboard.JustDown(this.backspaceKey)) {
                this.answerBuffer = this.answerBuffer.slice(0, -1);
                this.renderPrompt();
            }
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.resolvePromptSubmission();
            }
            return;
        }

        if (this.inTurn) return;

        if (Phaser.Input.Keyboard.JustDown(this.runKey)) {
            this.endBattle("You ran away!");
            return;
        }

        if (Phaser.Input.Keyboard.JustDown(this.healKey)) {
            this.openPrompt("heal");
            return;
        }

        if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.openPrompt("attack");
        }
    }
}
