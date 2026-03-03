import * as Colyseus from "colyseus.js";

/*================================================
| Array with current online players
*/
let onlinePlayers = {};

/*================================================
| Colyseus connection with server
*/
const WS_PROTOCOL = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:')
    ? 'wss://'
    : 'ws://';
const WS_HOSTNAME = (typeof window !== 'undefined' && window.location)
    ? window.location.hostname
    : 'localhost';
const WS_PORT = (() => {
    if (typeof window === 'undefined' || !window.location) return '3000';
    try {
        const url = new URL(window.location.href);
        return url.searchParams.get('wsPort') || '3000';
    } catch (_) {
        return '3000';
    }
})();
const COLYSEUS_ENDPOINT = `${WS_PROTOCOL}${WS_HOSTNAME}:${WS_PORT}`;
var client = new Colyseus.Client(COLYSEUS_ENDPOINT);
let room = client.joinOrCreate("poke_world").then(room => {
    console.log(room.sessionId, "joined", room.name);
    return room
}).catch(e => {
    console.log("JOIN ERROR", e);
    throw e;
});

export {onlinePlayers, room};
