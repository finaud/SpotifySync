async function queueSong(uri) {
    const id = uri.split(":")[2];

    const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${access_token}`
        },
    });

    response.json().then(data => {
        roomRef.child('queue').push({
            uri: data.uri,
            name: data.name,
            artist: data.artists[0].name,
            added_by: 'antoine'
        });
    });
}

async function getQueue() {
    const snapshot = await roomRef.child('/queue').orderByKey().limitToFirst(15).once('value');

    let queue = [];

    snapshot.forEach(function(trackSnap) {
        const data = trackSnap.val();
        queue.push({
            uri: data.uri,
            name: data.name,
            artist: data.artist,
            added_by: data.added_by
        })
    });

    return queue;
}
