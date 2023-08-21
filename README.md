# duck-hunt
 
# Ably
1. Sign up for Ably
2. Create a new Ably API key
3. Create .env file next to server.js
4. Create a variable named ABLY_KEY, assign this variable to your API key

# NodeJS
Here's a sample .env file

    NODE_ENV=production
    PORT=8080
    CORS_PORT=9090
    CORS_HOST=127.0.0.1
    ABLY_KEY=<your Ably key>

# LaunchDarkly Setup
Create the follow flags:

    soundEnabled (bool)       // all sounds on/off
    ducksToLaunch (number)    // initial number of ducks per round
    flockMultiplier (number)  // number of ducks increased per round
    speedMultiplier (number)  // clock speed and duck flight speed multiplier
    lastDuckGoesCrazy (bool)  // makes the last living duck harder to kill an noisier  

Also, update the Features class in core.js to include your clientSideID

# TODO
1. Consider adding Helmet
2. Consider rate limiting
