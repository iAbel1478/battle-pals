/*================================================
| Array with current online players
*/
let onlinePlayers = {};

/*================================================
| Colyseus connection with server
*/
let room = Promise.resolve(null);

export {onlinePlayers, room};
