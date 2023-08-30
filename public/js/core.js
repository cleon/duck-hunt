"use strict";

class Messages {
    #el = null;
    #textEl = null;
    #title = null;

    static GetReady = 0;
    static PlayerOneWins = -63;
    static PlayerTwoWins = -126;
    static GameOver = -189;
    static FlyAway = -252;

    constructor() {
        this.#el = document.getElementById("messageContainer");
        this.#textEl = document.getElementById("messageText");
        this.#title = document.getElementById("titleContainer");
    }

    toggleTitle(visible) {
        this.#title.style.visibility = (visible) ? "visible" : "hidden";
    }

    showClickHere(callback) {
        const e = this.#el;
        const ClickHere = -309;
        e.style.pointerEvents = "auto";
        e.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        this.show(ClickHere);
        e.onclick = () => {
            e.onclick = null;
            e.style.pointerEvents = "none";
            e.style.backgroundColor = "";
            e.style.visibility = "hidden";
            callback();
        };
    }

    show(message) {
        this.#el.style.visibility = "visible";
        this.#textEl.style.backgroundPosition = `0px ${message}px`;
    }

    hide() {
        this.#el.style.visibility = "hidden";
    }
}

class Sounds {
    static #files = [
        // ducks
        'barkX3', 'bgm', 'falling', 'fly', 'ground', 'quack', 'run', 'run2', 'shoot',
        // space
        'space_fly','space_bgm', 'space_newgame', 'space_gameover', 'space_falling', 'space_ground', 'space_hit', 'space_killed', 'space_panic'
    ];
    static #context = new (window.AudioContext || window.webkitAudioContext)();
    static {
        this.#unlockAudioContext();
        const emptyBuffer = this.#context.createBuffer(1, 1, 22050);

        for (let file of this.#files) {
            let ctx = this.#context;

            let sound = {};
            sound.vol = ctx.createGain();
            sound.vol.gain.value = 1;
            sound.vol.connect(ctx.destination);
            sound.nodes = {};

            sound.play = function (endedCallback = null, loop = false) {
                let snd = ctx.createBufferSource();
                snd.id = Math.floor(Date.now() * Math.random());
                snd.buffer = sound.buffer;
                snd.loop = loop;
                sound.nodes[snd.id] = snd;
                snd.connect(sound.vol);
                snd.addEventListener("ended", () => {
                    if (endedCallback) {
                        endedCallback();
                    }
                    cleanUpBehindNode(snd);
                });

                ctx.resume();
                snd.start();
                return snd.id;
            };

            sound.loop = function () {
                return sound.play(null, true);
            };

            sound.stop = function (id) {
                const snd = sound.nodes[id];
                if (snd) { snd.stop(); }
            };

            sound.mute = function (muted = true) {
                const value = (muted) ? 0 : 1;
                sound.vol.gain.value = value;
            };

            function cleanUpBehindNode(snd) {
                snd.loop = false;
                snd.onended = null;
                snd.stop();
                snd.disconnect();
                try { snd.buffer = emptyBuffer; } catch { }
                sound.nodes[snd.id] = null;
                delete sound.nodes[snd.id];
                snd = null;
            }

            this[file] = sound;
        }
    }

    static async load() {
        await Promise.all(this.#files.map(async (file) => {
            const bytes = await fetch(`/snd/${file}.mp3`).then(res => res.arrayBuffer());
            this[file].buffer = await this.#context.decodeAudioData(bytes);
        }));
    }

    static muteAll(muted) {
        this.#files.forEach(file => this[file].mute(muted));
    }

    static #unlockAudioContext() {
        if (Sounds.#context.state !== 'suspended') { return; }
        const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
        events.forEach(e => document.body.addEventListener(e, unlock, false));
        function unlock() { Sounds.#context.resume().then(clean); }
        function clean() { events.forEach(e => document.body.removeEventListener(e, unlock)); }
    }
}

class Sprite {
    static #uid = 0;
    constructor(height = 0, width = 0, x = 0, y = 0, imgUrl, id = null) {
        this.height = height;
        this.width = width;
        this.x = x;
        this.y = y;
        this.imgUrl = imgUrl;
        this.id = id || Sprite.#uid++;

        this.el = document.createElement('div');
        this.el.id = this.id;
        this.el.classList.add("sprite");
        this.el.style.height = `${this.height}px`;
        this.el.style.width = `${this.width}px`;
        this.el.style.top = `${y}px`;
        this.el.style.left = `${x}px`;
        this.el.style.backgroundImage = this.imgUrl ? `url('${this.imgUrl}')` : "";

        this.animationTimeoutDelay = 0;
        this.animationTimeout = 0;
        this.movementEnabled = true;
    }

    animate() { // animation is simply cycling through background images on an interval
        this.animationTimeout = setTimeout(() => {
            this.animateSprite();
            this.animate();
        }, this.animationTimeoutDelay);
    }

    animateSprite() {
        throw new Error("Child classes must implement this method.");
    }

    stopAnimation() {
        clearTimeout(this.animationTimeout);
    }

    enableMovement(enabled) {
        this.movementEnabled = enabled;
    }

    placeBackgroundImage(x, y) {
        this.el.style.backgroundPosition = `${x}px -${y}px`;
    }

    setBackgroundImageUrl(imgUrl) {
        this.imgUrl = imgUrl;
        this.el.style.backgroundImage = `url('${this.imgUrl}')`;
    }

    setHeightWidth(h = this.el.style.height, w = this.el.style.width) {
        this.height = h;
        this.width = w;
        this.el.style.height = `${h}px`;
        this.el.style.width = `${w}px`;
    }

    move(x = 0, y = 0) {
        if (this.movementEnabled) {
            this.el.style.left = `${x}px`;
            this.el.style.top = `${y}px`;
            this.x = x;
            this.y = y;
        }
    }

    hide() {
        this.el.style.visibility = "hidden";
    }

    show() {
        this.el.style.visibility = "visible";
    }
}

class Cloud extends Sprite {
    constructor(x = 0, y = 0, speedFactor = 1) {
        super(78, 237, x, y, "/img/cloud.png");
        this.animationTimeoutDelay = 16;
        this.speedFactor = speedFactor;
    }

    animateSprite() {
        this.#scrollX(this.speedFactor);
    }

    #scrollX(x) {
        const xpos = this.x -= x;
        super.move(xpos, this.y);
        if (this.x < -this.width) { this.x = window.innerWidth; }
    }
}

class ShootableSprite extends Sprite {
    constructor(imgUrl, sounds, hitsToKill) {
        const x = ShootableSprite.#rand(1000);
        const y = window.innerHeight - 250;
        super(102, 102, x, y, imgUrl);

        this.hitsToKill = hitsToKill;
        this.hitCount = 0;

        this.el.style.pointerEvents = "auto";
        this.el.onclick = () => {
            this.shoot();
        };

        // info tag/bubble
        this.infoTag = document.createElement("div");
        this.infoTag.style.visibility = "hidden";
        this.infoTag.style.bottom = "-25px";
        this.infoTag.style.padding = "3px 5px 3px 5px";
        this.infoTag.style.borderRadius = "8px";
        this.infoTag.style.display = "flex";
        this.infoTag.style.textAlign = "center";
        this.infoTag.style.justifyContent = "center";
        this.infoTag.style.alignContent = "center";
        this.infoTag.style.flexDirection = "column";
        this.infoTag.style.width = "100px";
        this.infoTag.style.height = "15px";
        this.infoTag.style.fontFamily = "sans-serif";
        this.infoTag.style.fontSize = "12px";
        this.infoTag.style.fontWeight = "bold";
        this.infoTag.style.lineHeight = "15px";

        this.el.appendChild(this.infoTag);

        // these are x coords of the starting block of each color of sprites in the sprite sheet
        this.colors = [
            0,    // start x coord of black sprite
            -306, // start x coord of red sprite
            -612  // start x coord of blue sprite
        ];

        // each number is the starting y coord of a row of sprites in the sprite sheet (flying direction)
        this.animationSequence = {
            FlyNorth: 0,
            FlyNorthEast: 102,
            FlyEastPose1: 204,
            FlySouthEast: 306,
            FlySouth: 408,
            FlySouthWest: 510,
            FlyWest: 612,
            FlyNorthWest: 714,
            Hit: 816,
            Falling: 918,
            FlyEastPose2: 1020,
            FlyAway: 1122
        };

        // each number is the starting y coord of a row of sprites in sprite sheet (flying direction)
        this.currentAnimationSequence = this.animationSequence.FlyEastPose2;

        // the order of which frame/x-position of sprite sheet to show. it goes from frame 0 to 1 to 2 then back to 1
        this.animationFrames = [0, 1, 2, 1];
        this.currentAnimationFrame = 0;
        this.animationTimeoutDelay = 90;

        this.flyAroundTimeout = 0;
        this.flyAroundTimeoutDelay = 16;
        this.flyAroundCounter = 140;
        this.sensitivityX = 0;
        this.sensitivityY = 0;
        this.defaultMovementSpeed = 5;
        this.movementSpeed = this.defaultMovementSpeed;
        this.invincible = false;

        // init to a random color
        this.color = this.colors[ShootableSprite.#rand(2)];

        // sounds
        this.sounds = sounds;

        // ptr to the looped panic sound
        this.panicSound = null;
    }

    setSounds(sounds) {
        this.sounds = sounds;
    }

    animateSprite() {
        const backgroundX = (this.width * -this.animationFrames[this.currentAnimationFrame]) + this.color;
        const backgroundY = this.currentAnimationSequence;
        this.placeBackgroundImage(backgroundX, backgroundY);
        if (++this.currentAnimationFrame >= this.animationFrames.length) { this.currentAnimationFrame = 0; }
    }

    flyAround(speedMultiplier = 1) {
        this.flyAroundTimeout = setTimeout(() => {
            this.#move(speedMultiplier);
            this.flyAroundCounter++;
            if (this.flyAroundCounter > 150) {
                this.sensitivityX = this.#positiveNegativeZeroHalf();
                this.sensitivityY = this.#positiveNegativeZeroHalf();
                this.flyAroundCounter = ShootableSprite.#rand(140);
                if (this.sensitivityX == 1 || this.sensitivityX == 0.5) {
                    switch (this.sensitivityY) {
                        case 0:
                        case 0.5:
                        case -0.5:
                            this.currentAnimationSequence = this.animationSequence.FlyEastPose1;
                            break;
                        case -1:
                        case -0.5:
                            this.currentAnimationSequence = this.animationSequence.FlyNorthEast;
                            break;
                        case 1:
                            this.currentAnimationSequence = this.animationSequence.FlySouthEast;
                            break;
                    }
                }
                if (this.sensitivityX == -1 || this.sensitivityX == -0.5) {
                    switch (this.sensitivityY) {
                        case 0:
                        case 0.5:
                        case -0.5:
                            this.currentAnimationSequence = this.animationSequence.FlyWest;
                            break;
                        case -1:
                        case -0.5:
                            this.currentAnimationSequence = this.animationSequence.FlyNorthWest;
                            break;
                        case 1:
                            this.currentAnimationSequence = this.animationSequence.FlySouthWest;
                            break;
                    }
                }
                if (this.sensitivityX == 0) {
                    switch (this.sensitivityY) {
                        case 0:
                        case 0.5:
                        case -0.5:
                            this.currentAnimationSequence = this.animationSequence.FlyEastPose2;
                            break;
                        case -1:
                        case -0.5:
                            this.currentAnimationSequence = this.animationSequence.FlyNorth;
                            break;
                        case 1:
                            this.currentAnimationSequence = this.animationSequence.FlySouth;
                            break;
                    }
                }
            }
            this.flyAround(speedMultiplier);
        }, this.flyAroundTimeoutDelay);
    }

    stopFlying() {
        clearTimeout(this.flyAroundTimeout);
        this.movementSpeed = this.defaultMovementSpeed;
    }

    fallToTheGround() {
        const threshold = window.innerHeight - 200;
        this.animationFrames = [1, 2];
        this.currentAnimationSequence = this.animationSequence.Falling;
        this.currentAnimationFrame = 0;
        this.sensitivityY = 1;
        this.sensitivityX = 0;
        this.animate();
        this.sounds.falling.play();
        let sprite = this;

        (function makeSpriteFall() {
            setTimeout(() => {
                if (sprite.y > threshold) {
                    //sprite.sounds.falling.stop();
                    sprite.#landed();
                } else {
                    sprite.#move(2); // move twice as fast when falling
                    makeSpriteFall();
                }
            }, 40); //<- changes how quickly the bird falls
        })();
    }

    flyAway() {
        let sprite = this;
        sprite.stopFlying();
        sprite.stopAnimation();
        sprite.stopPanicSound();
        sprite.sensitivityX = 0;
        sprite.sensitivityY = 0;
        sprite.el.style.pointerEvents = "none";

        let frame = 0;
        (function makeSpriteFlyAway() {
            if (frame < 7) {
                const y = sprite.animationSequence.FlyAway;
                setTimeout(() => {
                    const x = frame * -sprite.width;
                    sprite.placeBackgroundImage(x, y);
                    frame++;
                    makeSpriteFlyAway();
                }, 200);
            } else {
                sprite.#flewAway();
            }
        })();
    }

    showInfoTag(text, bgColor = "black", textColor = "white") {
        this.infoTag.style.backgroundColor = bgColor;
        this.infoTag.style.color = textColor;
        this.infoTag.style.visibility = "visible";
        this.infoTag.innerText = text;
    }

    hideInfoTag() {
        this.infoTag.style.visibility = "hidden";
    }

    #move(speedMultiplier = 1) {
        this.x += this.sensitivityX * (this.movementSpeed * speedMultiplier);
        this.y += this.sensitivityY * (this.movementSpeed * speedMultiplier);

        if ((this.y - 30) + this.height < 0) { this.y = -140 + window.innerHeight - this.height; }
        if ((this.y + 140) + this.height > window.innerHeight && this.currentAnimationSequence != this.animationSequence.Falling) { this.y = -this.height + 30; }

        if (this.x < -50) { this.x = window.innerWidth - 50; }
        if (this.x + 50 > window.innerWidth) { this.x = -50; }

        super.move(this.x, this.y);
    }

    panic() {
        this.movementSpeed *= 1.5;
        this.panicSound = this.sounds.panic.loop();
    }

    stopPanicSound() {
        if (this.panicSound) {
            this.sounds.panic.stop(this.panicSound);
        }
    }

    shoot() {
        if (!this.invincible) {
            this.hitCount++;
            if (this.hitCount == this.hitsToKill) { // killed
                this.invincible = true;
                this.el.classList.remove("blink");
                this.el.style.pointerEvents = "none";
                this.#raiseEvent("killed", { sprite: this });

                this.stopPanicSound()
                this.sounds.killed.play();

                this.stopFlying();
                this.currentAnimationFrame = 0;
                this.currentAnimationSequence = this.animationSequence.Hit;

                setTimeout(() => {
                    this.stopAnimation();
                    this.fallToTheGround();
                }, 500);

            } else { // hit
                this.#raiseEvent("hit", { sprite: this });
                this.sounds.hit.play();
                this.el.classList.add("blink");
                setTimeout(() => {
                    this.el.classList.remove("blink");
                }, 1000);
            }
        }
    }

    remove() {
        this.el.remove();
    }

    #flewAway() {
        this.hide();
        this.#raiseEvent("flyAway", { sprite: this });
    }

    #landed() {
        this.sounds.landed.play();
        this.hide();
        this.stopAnimation();
        this.#raiseEvent("landed", { sprite: this });
    }

    #raiseEvent(name, detail) {
        this.el.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }

    onKilled(callback) {
        this.el.addEventListener("killed", () => { callback(this); });
    }

    onHit(callback) {
        this.el.addEventListener("hit", () => { callback(this); });
    }

    onLanded(callback) {
        this.el.addEventListener("landed", () => { callback(this); });
    }

    onFlyAway(callback) {
        this.el.addEventListener("flyAway", () => { callback(this); });
    }

    static #rand(max) {
        return Math.round(Math.random() * max);
    }

    #positiveNegativeZeroHalf() {
        // return : 1 / -1 / 0 / 0.5 / -0.5
        let r = ShootableSprite.#rand(1) ? -1 : 1;
        if (ShootableSprite.#rand(10) < 2) r = 0;
        if (ShootableSprite.#rand(10) < 4) r *= .5;
        return r;
    }
}

class Sight extends Sprite {
    constructor() {
        super(32, 32, 0, 0, "/img/sight.png", "sight");
        this.el.style.zIndex = -2;
        this.animationTimeoutDelay = 50;
        this.backgroundPosition = 0;
        this.animate();
    }

    animateSprite() {
        this.el.style.backgroundPosition = (this.backgroundPosition++ == 0 ? "0px 0px" : "-33px 0px");
        if (this.backgroundPosition == 2) { this.backgroundPosition = 0; }
    }

    move(x, y) {
        super.move(x - 16, y - 16);
    }

    shoot(x, y) {
        this.stopAnimation();
        this.move(x, y);
        this.el.style.backgroundPosition = "-66px 0px";
        Sounds.shoot.play();
        this.animate();
    }
}

class Dog extends Sprite {
    static #distanceUpFromBottom = 345;

    constructor(imgUrl = null) {
        super(150, 90, 0, 0, imgUrl, "dog");
        this.el.style.bottom = "200px";
        this.el.style.removeProperty("top");
        this.el.style.removeProperty("left");
        this.animationSequence = {
            Running: 0,
            Fetching: 225
        };
        this.animationTimeoutDelay = 70;
        this.isFetching = false;
        this.isRunning = false;
        this.barkSound = Sounds.barkX3;
    }

    animateSprite() {
        const backgroundX = (this.width * -this.animationFrames[this.currentAnimationFrame]);
        const backgroundY = this.currentAnimationSequence;
        this.placeBackgroundImage(backgroundX, backgroundY);
        if (++this.currentAnimationFrame >= this.animationFrames.length) { this.currentAnimationFrame = 0; }
    }

    showRunning() {
        if (!this.isRunning) {
            this.hide();
            this.setHeightWidth(150, 90);
            this.el.style.bottom = "200px";
            this.el.style.removeProperty("top");
            this.el.style.removeProperty("left");
            this.animationFrames = [0, 1, 2, 3, 4, 5];
            this.currentAnimationFrame = 0;
            this.currentAnimationSequence = this.animationSequence.Running;
            this.animate();
            this.show();
            this.isRunning = true;
        }
    }

    hide() {
        super.hide();
        this.stopAnimation();
    }

    fetchSpritesAtX(spriteCount, x, callback) {
        if (spriteCount < 1) {
            if (callback) { callback(); }
            return;
        }

        this.isRunning = false
        this.isFetching = true;
        this.hide();

        let y = this.animationSequence.Fetching;
        if (spriteCount < 2) {
            this.setHeightWidth(this.height, 145);
            this.placeBackgroundImage(0, y);
        } else {
            this.setHeightWidth(this.height, 170);
            this.placeBackgroundImage(-192, y);
        }

        y = window.innerHeight + this.height - Dog.#distanceUpFromBottom;

        this.move(x, y);
        this.show();

        let frameCount = 0;
        let increment = 5;
        const dog = this;

        (function animateFetch() {
            setTimeout(() => {
                increment = (frameCount++ < 30) ? 5 : -5;
                if (frameCount == 30) { if (spriteCount > 1) { dog.bark(); } }
                if (frameCount > 30 && frameCount < 90) { increment = 0; }
                if (frameCount < 120) {
                    y -= increment;
                    dog.move(x, y);
                    animateFetch();
                } else {
                    increment = 0;
                    dog.isFetching = false;
                    if (callback) { callback(); }
                }
            }, 14); //<- changes how quickly the dog springs up and back down during fetch
        })();
    }

    bark() {
        this.barkSound.play();
    }

    stopBarking() {
        //this.barkSound.stop();
    }
}

class Timebar {
    static #el = null;
    static #redbar = null;
    static #timeout = 0;
    static #startPos = 342;
    static #pos = 0;

    static {
        this.#el = document.getElementById("timebarContainer");
        this.#redbar = document.getElementById("redTimebar");
        if (this.#redbar) {
            this.#setLeft(this.#startPos);
        }
        this.#pos = this.#startPos;
    }

    static #setLeft(left) {
        this.#redbar.style.left = `${left}px`;
    }

    static toggleVisible(visible) {
        this.#el.style.visibility = (visible) ? "visible" : "hidden";
    }

    static start(factor = 1) {
        const speed = 500 / factor;
        this.#pos -= 6;
        this.#setLeft(this.#pos);
        if (this.#pos <= 0) {
            this.#el.dispatchEvent(new CustomEvent("timesup", { detail: null }));
        } else {
            this.#timeout = setTimeout(() => {
                this.start(factor);
            }, speed)
        }
    }

    static timesUp() {
        return this.#pos <= 0;
    }

    static add(time = 0) {
        if (this.#pos <= 324) {
            this.#pos += (time * 6);
            this.#setLeft(this.#pos);
        }
    }

    static pause() {
        clearTimeout(this.#timeout);
    }

    static reset() {
        clearTimeout(this.#timeout);
        this.#pos = this.#startPos;
        this.#setLeft(this.#pos);
    }

    static onTimesUp(callback) {
        this.#el.addEventListener("timesup", (e) => { callback(e); });
    }
}

class Features {
    static #clientSideID = "64e7df086c126013090fd6c5";
    static #flags = {                 // feature flags + fallback values
        "gameTheme": "ducks",         // the theme of the game
        "soundEnabled": true,         // all sounds on/off
        "spritesToLaunch": 5,         // initial number of sprites per round
        "flockMultiplier": 1.5,       // number of sprites increased per round
        "speedMultiplier": 0.2,       // clock speed and sprite flight speed multiplier
        "lastSpriteGoesCrazy": true,  // make the last sprte harder to kill and noisier
        "hitsToKill": 1               // the number of hits it takes to kill a sprite 
    };
    static #ldclient = null;
    static {
        this.#ldclient = LDClient.initialize(this.#clientSideID, { kind: "user", key: "launch-duckly-app" });
        for (let key of Object.keys(this.#flags)) {
            let feature = {};
            feature.key = key;
            feature.fallback = this.#flags[key];
            feature.value = async () => {
                let val = feature.fallback;
                try { val = this.#ldclient.variation(feature.key, feature.fallback); }
                catch (e) { console.error("Unable to get flag value", e); }
                finally { return val; }
            };
            feature.onChange = (callback) => {
                this.#ldclient.on(`change:${feature.key}`, (current, previous) => {
                    callback(current, previous);
                });
            };
            this[key] = feature;
        }
    }
}

class Game {
    static {
        window.addEventListener("resize", Game.appHeight);
        document.addEventListener("DOMContentLoaded", Game.appHeight);
    }

    constructor() {
        // game cover
        this.gameCoverContainer = document.getElementById("gameCoverContainer");

        // sprites
        this.spritesContainer = document.getElementById("spritesContainer");

        // clouds
        this.clouds = [new Cloud(window.innerWidth - 400, 50, 0.25), new Cloud(window.innerWidth - 250, 150, 0.1)];
        this.clouds.forEach(cloud => this.spritesContainer.appendChild(cloud.el));

        // dog
        this.dog = new Dog();
        this.spritesContainer.appendChild(this.dog.el);

        // title screen sprites
        this.titleScreenSprites = [];

        // scenery
        this.scenery = document.getElementById("scenery");
        this.scrollSceneryTimeout = 0;
        this.scrollSceneryInterval = 16;
        this.scrollSceneryX = 0;
        this.sceneryIsScrolling = false;

        // mountains
        this.mountains = document.getElementById("mountains");

        // messages
        this.messages = new Messages();

        // images
        this.images = [
            "/img/blueTimeBar.png",
            "/img/cloud.png",
            "/img/cover.png",
            "/img/dog.png",
            "/img/duck.png",
            "/img/messagesBackground.png",
            "/img/messagesText.png",
            "/img/mountains.png",
            "/img/redTimeBar.png",
            "/img/scenery.png",
            "/img/sight.png",
            "/img/timeBackground.png",
            "/img/title.png"
        ];

        // real-time communication
        this.RT = null;

        // game channel messages:
        //   - players entering/leaving
        this.gameChannel = null;

        // general game sounds
        this.sounds = {
            flyAway: null
        };

        // game music
        this.music = {
            bgm: null,
            bgmId: null,
            gameOver: null,
            newGame: null
        };
    }

    makeShootableSprite() {
        let config = this.#makeNewSpriteConfig();
        return new ShootableSprite(config.imgUrl, config.sounds, config.hitsToKill);
    }

    playNewGameMusic(callback) {
        this.music.newGame.play(callback);
    }

    playGameOverBGM(callback) {
        this.music.gameOver.play(callback);
    }

    playBGM() {
        this.music.bgmId = this.music.bgm.loop();
    }

    stopBGM() {
        this.music.bgm.stop(this.music.bgmId);
    }

    playFlyAwaySound() {
        this.sounds.flyAway.play();
    }

    #makeNewSpriteConfig() {
        let config = { hitsToKill: this.hitsToKill, sounds: {} };
        switch (this.gameTheme) {
            case "space":
                config.imgUrl = "/img/duck.png";
                config.sounds.hit = Sounds.space_hit;
                config.sounds.killed = Sounds.space_killed;
                config.sounds.falling = Sounds.space_falling;
                config.sounds.flyAway = Sounds.space_fly;
                config.sounds.landed = Sounds.space_ground;
                config.sounds.panic = Sounds.space_panic;
                break;
            case "ducks":
            default:
                config.imgUrl = "/img/duck.png";
                config.sounds.hit = Sounds.quack;
                config.sounds.killed = Sounds.quack;
                config.sounds.falling = Sounds.falling;
                config.sounds.flyAway = Sounds.fly;
                config.sounds.landed = Sounds.ground;
                config.sounds.panic = Sounds.quack;
                break;
        }
        return config;
    }

    // let subclasses know the theme changed
    onGameThemeChanged() { // update existing sprites
    }

    #gameThemeChanged(newTheme) {
        this.gameTheme = newTheme;
        switch (this.gameTheme) {
            case "space":
                this.sounds.flyAway = Sounds.space_fly;
                this.music.bgm = Sounds.space_bgm;
                this.music.gameOver = Sounds.space_gameover;
                this.music.newGame = Sounds.space_newgame;

                this.mountains.style.backgroundImage = `url('/img/mountains.png')`;
                this.scenery.style.backgroundImage = `url('/img/scenery.png')`;

                this.dog.setBackgroundImageUrl("/img/dog.png");
                break;
            case "ducks":
            default:
                this.sounds.flyAway = Sounds.fly;
                this.music.bgm = Sounds.bgm;
                this.music.gameOver = Sounds.run2;
                this.music.newGame = Sounds.run;

                this.mountains.style.backgroundImage = `url('/img/mountains.png')`;
                this.scenery.style.backgroundImage = `url('/img/scenery.png')`;

                this.dog.setBackgroundImageUrl("/img/dog.png");
                break;
        }

        this.onGameThemeChanged();
    }

    #soundEnabledChanged(enabled) {
        Sounds.muteAll(!enabled);
    }

    showGameCover(callback) {
        const el = this.gameCoverContainer;
        el.style.cursor = "pointer";
        el.style.pointerEvents = "auto";
        el.style.visibility = "visible";
        el.onclick = () => {
            el.style.cursor = "none";
            el.style.pointerEvents = "none";
            el.style.visibility = "hidden";
            callback();
        };
    }

    makeTitleScreenSprites() {
        const titleSpritesXYPositions = [
            [150, window.innerHeight - 350],
            [window.innerWidth - 300, 50],
            [window.innerWidth - 200, 150],
            [window.innerWidth - 350, 350]
        ];

        for (let i = 0; i < 3; i++) {
            let sprite = this.makeShootableSprite();
            sprite.invincible = true;
            sprite.move(titleSpritesXYPositions[i][0], titleSpritesXYPositions[i][1]);

            if (i == 0) { // make the sprite being chased move faster than the others
                sprite.animationTimeoutDelay = 40;
            }
            this.titleScreenSprites.push(sprite);
            this.spritesContainer.appendChild(sprite.el);
        }
    }

    toggleTitleSprites(visible) {
        for (let sprite of this.titleScreenSprites) {
            if (visible) {
                sprite.animate();
                sprite.show();
            } else {
                sprite.stopAnimation();
                sprite.hide();
            }
        }
    }

    animateClouds() {
        this.clouds.forEach(cloud => {
            cloud.show();
            cloud.enableMovement(true);
            cloud.animate();
        });
    }

    stopClouds() {
        this.clouds.forEach(cloud => cloud.enableMovement(false));
    }

    hideClouds() {
        this.clouds.forEach(cloud => cloud.hide());
    }

    #scrollScenery() {
        this.sceneryIsScrolling = true;
        const width = -1736;
        this.scrollSceneryX -= 3;
        if (this.scrollSceneryX <= width) { this.scrollSceneryX = 0; }
        this.scenery.style.left = `${this.scrollSceneryX}px`;
        this.scrollSceneryTimeout = setTimeout(() => { this.#scrollScenery(); }, this.scrollSceneryInterval);
    }

    toggleScrollingScenery(enabled) {
        if (enabled && !this.sceneryIsScrolling) {
            this.#scrollScenery();
        }
        if (!enabled) {
            this.sceneryIsScrolling = false;
            clearTimeout(this.scrollSceneryTimeout);
        }
    }

    async loadFlaggableFeatures() {
        this.gameTheme = await Features.gameTheme.value();
        this.soundEnabled = await Features.soundEnabled.value();
        this.spritesToLaunch = await Features.spritesToLaunch.value();
        this.flockMultiplier = await Features.flockMultiplier.value();
        this.speedMultiplier = await Features.speedMultiplier.value();
        this.lastSpriteGoesCrazy = await Features.lastSpriteGoesCrazy.value();
        this.hitsToKill = await Features.hitsToKill.value();

        Features.gameTheme.onChange(current => this.#gameThemeChanged(current));
        Features.soundEnabled.onChange(current => this.#soundEnabledChanged(current));
        Features.spritesToLaunch.onChange(current => this.spritesToLaunch = current);
        Features.flockMultiplier.onChange(current => this.flockMultiplier = current);
        Features.speedMultiplier.onChange(current => this.speedMultiplier = current);
        Features.lastSpriteGoesCrazy.onChange(current => this.lastSpriteGoesCrazy = current);
        Features.hitsToKill.onChange(current => this.hitsToKill = current);

        this.#gameThemeChanged(this.gameTheme);
        this.#soundEnabledChanged(this.soundEnabled);
    }

    async initRT() {
        this.RT = new Ably.Realtime.Promise({ authUrl: "/auth", transportParams: { remainPresentFor: 1000 } });
        await this.RT.connection.once("connected");
        this.gameChannel = this.RT.channels.get("launch-duckly");
    }

    async loadImages() {
        await Promise.all(this.images.map(src => new Promise(resolve => {
            let img = document.createElement("img");
            img.onload = () => { resolve({ value: src }); };
            img.onerror = (e) => { console.error('image load error', e); };
            img.src = src;
        })));
    }

    async loadFonts() {
        await document.fonts.ready;
    }

    async loadAssets() {
        try {
            await Sounds.load();
            await this.initRT();
            await this.loadImages();
            await this.loadFonts();
            await this.loadFlaggableFeatures();
        } catch (e) {
            console.error('Unable to load assets', e);
        }
    }

    static appHeight() {
        document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    }

    // external method to start the game after assets and components load/initialize
    run() {
        this.loadAssets().then(() => this.main());
    }

    main() {
        throw new Error("Child classes must implement this method.");
    }
}

export { Game, Messages, Sounds as Sounds, Sight, Timebar };