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
const WS_HOSTNAME = (() => {
    if (typeof window === 'undefined' || !window.location) return 'localhost';
    const pageHost = window.location.hostname;
    const isLocal = pageHost === 'localhost' || pageHost === '127.0.0.1';

    // Safe-by-default: in production, connect to api.<your-domain>.
    // Allow overriding wsHost only during local development.
    let host = isLocal ? pageHost : `api.${pageHost}`;

    try {
        const url = new URL(window.location.href);
        const override = url.searchParams.get('wsHost');
        if (isLocal && override && /^[a-z0-9.-]+$/i.test(override)) {
            host = override;
        }
    } catch (_) {
        // ignore
    }

    return host;
})();
const WS_PORT = (() => {
    if (typeof window === 'undefined' || !window.location) return '3000';
    try {
        const url = new URL(window.location.href);
        return url.searchParams.get('wsPort') || '3000';
    } catch (_) {
        return '3000';
    }
})();
const COLYSEUS_PORT = (() => {
    // Avoid explicit default ports (cleaner + matches common reverse-proxy setups)
    if (WS_PROTOCOL === 'wss://' && WS_PORT === '443') return '';
    if (WS_PROTOCOL === 'ws://' && WS_PORT === '80') return '';
    return WS_PORT;
})();
const COLYSEUS_ENDPOINT = COLYSEUS_PORT
    ? `${WS_PROTOCOL}${WS_HOSTNAME}:${COLYSEUS_PORT}`
    : `${WS_PROTOCOL}${WS_HOSTNAME}`;
var client = new Colyseus.Client(COLYSEUS_ENDPOINT);
let room = client.joinOrCreate("poke_world").then(room => {
    console.log(room.sessionId, "joined", room.name);
    return room
}).catch(e => {
    console.log("JOIN ERROR", e);
    throw e;
});

export {onlinePlayers, room};
