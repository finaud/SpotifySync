const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://spotifysync-e4839.firebaseio.com/"
});

const db = admin.database();

const roomsRef = db.ref('rooms');

/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

const client_id = functions.config().spotify.id; // Your client id
const client_secret = functions.config().spotify.secret; // Your secret
const redirect_uri = functions.config().spotify.redirect; // Redirect URI

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = function (length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const stateKey = 'spotify_auth_state';

const app = express();

app.use(express.static(__dirname + '/public'))
    .use(cors())
    .use(cookieParser());

app.get('/helloWorld', function (req, res) {
    console.log(client_id);
    console.log(client_secret);
    res.send("Hello from Firebase!");
});

app.get('/login', function (req, res) {

    const state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    const scope = 'user-read-private user-read-email streaming user-modify-playback-state user-read-playback-state user-read-currently-playing';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

app.get('/callback', function (req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.query.state //TODO fix auth: req.cookies ? req.cookies[stateKey] : null;

    console.log('state ' + state);
    console.log('stored state ' + storedState);


    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                const access_token = body.access_token,
                    refresh_token = body.refresh_token;

                res.redirect('/player.html?' + querystring.stringify({access_token: access_token}));
            } else {
                res.redirect('/player.html?' + querystring.stringify({error: 'invalid_token'}));
            }
        });
    }
});

app.get('/refresh_token', function (req, res) {

    // requesting access token from refresh token
    const refresh_token = req.query.refresh_token;
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))},
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;
            res.send({
                'access_token': access_token
            });
        }
    });
});

exports.app = functions.https.onRequest(app);

exports.playNext = functions.https.onCall((data, context) => {
    const room = data.room;

    if (!(typeof room === 'string')) {
        return { message: "Provide a valid room key" };
    } else {
        return roomsRef.child(room).once('value').then((snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();

                if (val.is_swapping_tracks) {
                    return { message: 'Server is already swapping tracks' };
                } else {
                    roomsRef.child(room + '/is_swapping_tracks').set(true);

                    return roomsRef.child(room + '/queue').orderByKey().limitToFirst(1).once('value').then((snap) => {

                        for (const queue_key in snap.val()) {
                            data = snap.val()[queue_key];

                            roomsRef.child(room + '/queue/' + queue_key).remove();

                            roomsRef.child(room +'/current_track').update({
                                uri: data.uri,
                                added_by: data.added_by,
                                is_playing: true,
                                position_ms: 0
                            });
                        }

                        return roomsRef.child(room + '/is_swapping_tracks').set(false).then(async () => {
                            await sleep(1000);
                            return { message: 'Playing next track' };
                        });
                    });
                }
            } else {
                //TODO: prevent users from guessing room keys

                return { message: 'Room does not exist' };
            }

        });
    }
});