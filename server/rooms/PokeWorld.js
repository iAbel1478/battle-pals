const colyseus = require('colyseus');

const players = {};
exports.PokeWorld = class extends colyseus.Room {
    onCreate(options) {
        console.log('ON CREATE');

        const pendingQuestions = {};

        const generateArithmeticQuestion = () => {
            const mode = Math.floor(Math.random() * 4) + 1;
            if (mode === 1) {
                const a = Math.floor(Math.random() * 191) + 10;
                const b = Math.floor(Math.random() * 191) + 10;
                return { text: `${a} + ${b}`, answer: a + b };
            }
            if (mode === 2) {
                const a = Math.floor(Math.random() * 181) + 20;
                const b = Math.floor(Math.random() * (a - 4)) + 5;
                return { text: `${a} - ${b}`, answer: a - b };
            }
            if (mode === 3) {
                const a = Math.floor(Math.random() * 11) + 2;
                const b = Math.floor(Math.random() * 11) + 2;
                return { text: `${a} × ${b}`, answer: a * b };
            }
            const b = Math.floor(Math.random() * 11) + 2;
            const ans = Math.floor(Math.random() * 11) + 2;
            const a = b * ans;
            return { text: `${a} ÷ ${b}`, answer: ans };
        };

        this.onMessage("PLAYER_MOVED", (player, data) => {

            console.log("PLAYER_MOVED",data);

            players[player.sessionId].x = data.x;
            players[player.sessionId].y = data.y;

            this.broadcast("PLAYER_MOVED",{
                ...players[player.sessionId],
                position: data.position
            }, {except: player})
          });

        this.onMessage("REQUEST_BATTLE_QUESTION", (player, data) => {
            const action = (data && data.action) || "attack";
            const q = generateArithmeticQuestion();
            const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            pendingQuestions[player.sessionId] = {
                token,
                action,
                answer: q.answer,
                expiresAt: Date.now() + 60_000,
            };
            player.send("BATTLE_QUESTION", {
                event: "BATTLE_QUESTION",
                action,
                token,
                text: q.text,
            });
        });

        this.onMessage("ANSWER_BATTLE_QUESTION", (player, data) => {
            const action = data && data.action;
            const token = data && data.token;
            const answer = data && data.answer;
            const pending = pendingQuestions[player.sessionId];

            let correct = false;
            if (pending && pending.token === token && pending.action === action && pending.expiresAt > Date.now()) {
                correct = Number(answer) === pending.answer;
            }

            delete pendingQuestions[player.sessionId];
            player.send("BATTLE_QUESTION_RESULT", {
                event: "BATTLE_QUESTION_RESULT",
                action: action || (pending && pending.action) || "attack",
                correct,
            });
        });


          this.onMessage("PLAYER_MOVEMENT_ENDED", (player, data) => {
            this.broadcast("PLAYER_MOVEMENT_ENDED",{
                  
                sessionId: player.sessionId,
                map: players[player.sessionId].map,
                position: data.position
            }, {except: player})
          });


          this.onMessage("PLAYER_CHANGED_MAP", (player, data) => {
          
            players[player.sessionId].map = data.map;
    
            player.send( "CURRENT_PLAYERS",{players: players})

            this.broadcast("PLAYER_CHANGED_MAP",{
               
                sessionId: player.sessionId,
                map: players[player.sessionId].map,
                x: 300,
                y: 75,
                players: players
            })
          });

         
    }

    onJoin(player, options) {
        console.log('ON JOIN');

        players[player.sessionId] = {
            sessionId: player.sessionId,
            map: 'town',
            x: 352,
            y: 1216
        };

        setTimeout(() => player.send("CURRENT_PLAYERS",{players: players}), 500);
        this.broadcast("PLAYER_JOINED",{...players[player.sessionId]}, {except: player});
    }

   

    onLeave(player, consented) {
        console.log('ON LEAVE')

        this.broadcast("PLAYER_LEFT",{ sessionId: player.sessionId, map: players[player.sessionId].map });
        delete players[player.sessionId];
    }

    onDispose() {
        console.log('ON DISPOSE')
    }
};
