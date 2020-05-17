const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

async function createRoom() {
    let roomID = '';

    for (let i = 0; i < 10; i++) {
        roomID += characters[Math.floor(Math.random() * characters.length)];
    }

    database.ref('rooms/' + roomID).set({
        is_swapping: false,
        current_track: {
            added_by: 'NULL',
            is_playing: false,
            position_ms: 0,
            uri: "spotify:track:7GhIk7Il098yCjg4BQjzvb"
        }
    })

    return roomID;
}
