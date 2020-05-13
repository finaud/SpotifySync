# SpotifySync
A simple app for listening to Spotify synchronously with friends. 

## Local Testing
Run `firebase functions:config:get > .runtimeconfig.json` to save the config variables, and change the value of 
`redirect` to `"http://localhost:5000/callback"`. This needs to be done only once.

To run the emulator, use the following command:  
`firebase emulators:start`