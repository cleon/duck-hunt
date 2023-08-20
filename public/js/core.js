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
    static #files = ['barkX3', 'bgm', 'falling', 'fly', 'ground', 'quack', 'run', 'run2', 'shoot'];
    static #context = null;
    static {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.#context = new AudioContext();
        this.#unlockAudioContext(this.#context);
        let ctx = this.#context;

        for (let file of this.#files) {
            let sound = {};
            sound.buffer = null;
            sound.nodes = [];
            sound.vol = ctx.createGain();
            sound.vol.gain.value = 1;
            sound.vol.connect(ctx.destination);

            sound.play = function (endedCallback = null) {
                let snd = ctx.createBufferSource();
                snd.buffer = sound.buffer;
                snd.connect(sound.vol);
                if (endedCallback) {
                    snd.addEventListener("ended", () => { endedCallback(); });
                }
                sound.nodes.push(snd);
                snd.start();
                return snd;
            };

            sound.loop = function () {
                let snd = ctx.createBufferSource();
                snd.buffer = sound.buffer;
                snd.connect(sound.vol);
                snd.loop = true;
                sound.nodes.push(snd);
                snd.start();
                return snd;
            }

            sound.stop = function () {
                sound.nodes.forEach(node => { node.stop(); node.disconnect(); });
            };

            sound.mute = function (muted = true) {
                const value = (muted) ? 0 : 1;
                sound.vol.gain.value = value;
            };

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
        for (const file of this.#files) {
            this[file].mute(muted);
        }
    }

    static #unlockAudioContext(ctx) {
        if (ctx.state !== 'suspended') return;
        const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
        events.forEach(e => document.body.addEventListener(e, unlock, false));
        function unlock() { ctx.resume().then(clean) }
        function clean() { events.forEach(e => document.body.removeEventListener(e, unlock)); }
    }
}

class Sprite {
    static #uid = 0;
    constructor(height = 0, width = 0, x = 0, y = 0, imgUrl, id = null) {
        this.id = id || Sprite.#uid++;
        this.height = height;
        this.width = width;
        this.x = x;
        this.y = y;

        this.el = document.createElement('div');
        this.el.id = this.id;
        this.el.classList.add("sprite");
        this.el.style.height = `${this.height}px`;
        this.el.style.width = `${this.width}px`;
        this.el.style.top = `${y}px`;
        this.el.style.left = `${x}px`;
        this.el.style.backgroundImage = `url('${imgUrl}')`;

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

class Duck extends Sprite {
    // each number is the starting y coord of a row of sprites in img/ducks.png (flying direction)
    static animationSequence = {
        FlyNorth: 0,
        FlyNorthEast: 102,
        FlyEastMouthOpen: 204,
        FlySouthEast: 306,
        FlySouth: 408,
        FlySouthWest: 510,
        FlyWest: 612,
        FlyNorthWest: 714,
        Hit: 816,
        Falling: 918,
        FlyEastMouthClosed: 1020,
        FlyAway: 1122
    };

    constructor() {
        const x = Duck.#rand(1000);
        const distanceUpFromBottom = 250; // how high (pixels) off the bottom of the screen to place the duck
        const y = window.innerHeight - distanceUpFromBottom;
        super(102, 102, x, y, "/img/duck.png");

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

        // these are x coords of the starting block of each color of sprites in ducks.png
        this.colors = [
            0,    // start black ducks
            -306, // start red ducks
            -612  // start blue ducks
        ];

        // each number is the starting y coord of a row of sprites in ducks.png (flying direction)
        this.currentAnimationSequence = Duck.animationSequence.FlyEastMouthClosed;

        // the order of which frame/x-position of ducks.png to show. it goes from frame 0 to 1 to 2 then back to 1
        this.animationFrames = [0, 1, 2, 1];
        this.currentAnimationFrame = 0;
        this.animationTimeoutDelay = 90;

        this.flyAroundTimeout = 0;
        this.flyAroundTimeoutDelay = 16;
        this.flyAroundCounter = 140;
        this.sensitivityX = 0;
        this.sensitivityY = 0;
        this.movementSpeed = 5;
        this.invincible = false;

        // init to a random color
        this.color = this.colors[Duck.#rand(2)];
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
                this.flyAroundCounter = Duck.#rand(140);
                if (this.sensitivityX == 1 || this.sensitivityX == 0.5) {
                    switch (this.sensitivityY) {
                        case 0:
                        case 0.5:
                        case -0.5:
                            this.currentAnimationSequence = Duck.animationSequence.FlyEastMouthOpen;
                            break;
                        case -1:
                        case -0.5:
                            this.currentAnimationSequence = Duck.animationSequence.FlyNorthEast;
                            break;
                        case 1:
                            this.currentAnimationSequence = Duck.animationSequence.FlySouthEast;
                            break;
                    }
                }
                if (this.sensitivityX == -1 || this.sensitivityX == -0.5) {
                    switch (this.sensitivityY) {
                        case 0:
                        case 0.5:
                        case -0.5:
                            this.currentAnimationSequence = Duck.animationSequence.FlyWest;
                            break;
                        case -1:
                        case -0.5:
                            this.currentAnimationSequence = Duck.animationSequence.FlyNorthWest;
                            break;
                        case 1:
                            this.currentAnimationSequence = Duck.animationSequence.FlySouthWest;
                            break;
                    }
                }
                if (this.sensitivityX == 0) {
                    switch (this.sensitivityY) {
                        case 0:
                        case 0.5:
                        case -0.5:
                            this.currentAnimationSequence = Duck.animationSequence.FlyEastMouthClosed;
                            break;
                        case -1:
                        case -0.5:
                            this.currentAnimationSequence = Duck.animationSequence.FlyNorth;
                            break;
                        case 1:
                            this.currentAnimationSequence = Duck.animationSequence.FlySouth;
                            break;
                    }
                }
            }
            this.flyAround(speedMultiplier);
        }, this.flyAroundTimeoutDelay);
    }

    stopFlying() {
        clearTimeout(this.flyAroundTimeout);
    }

    fallToTheGround() {
        const threshold = window.innerHeight - 200;//135
        this.animationFrames = [1, 2];
        this.currentAnimationSequence = Duck.animationSequence.Falling;
        this.currentAnimationFrame = 0;
        this.sensitivityY = 1;
        this.sensitivityX = 0;
        this.animate();
        Sounds.falling.play();
        let duck = this;

        (function makeDuckFall() {
            setTimeout(() => {
                if (duck.y > threshold) {
                    Sounds.falling.stop();
                    duck.#landed();
                } else {
                    duck.#move(2); // move twice as fast when falling
                    makeDuckFall();
                }
            }, 40); //<- changes how quickly the bird falls //16, frenchie is 100
        })();
    }

    flyAway() {
        let duck = this;
        duck.stopFlying();
        duck.stopAnimation();
        duck.sensitivityX = 0;
        duck.sensitivityY = 0;
        duck.el.style.pointerEvents = "none";

        let frame = 0;
        (function makeDuckFlyAway() {
            if (frame < 7) {
                const y = Duck.animationSequence.FlyAway;
                setTimeout(() => {
                    const x = frame * -duck.width;
                    duck.placeBackgroundImage(x, y);
                    frame++;
                    makeDuckFlyAway();
                }, 200);
            } else {
                duck.#flewAway();
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
        if ((this.y + 140) + this.height > window.innerHeight && this.currentAnimationSequence != Duck.animationSequence.Falling) { this.y = -this.height + 30; }

        if (this.x < -50) { this.x = window.innerWidth - 50; }
        if (this.x + 50 > window.innerWidth) { this.x = -50; }

        super.move(this.x, this.y);
    }

    shoot() {
        if (!this.invincible) {
            this.invincible = true;

            this.#raiseEvent("shot", { duck: this });
            this.el.style.pointerEvents = "none";

            this.stopFlying();
            this.currentAnimationFrame = 0;
            this.currentAnimationSequence = Duck.animationSequence.Hit;

            Sounds.quack.play();

            setTimeout(() => {
                this.stopAnimation();
                this.fallToTheGround();
            }, 500);
        }
    }

    remove() {
        this.el.remove();
    }

    #flewAway() {
        this.hide();
        this.#raiseEvent("flyAway", { duck: this });
    }

    #landed() {
        Sounds.ground.play();
        this.hide();
        this.stopAnimation();
        this.#raiseEvent("landed", { duck: this });
    }

    #raiseEvent(name, detail) {
        this.el.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }

    onShot(callback) {
        this.el.addEventListener("shot", () => { callback(this); });
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
        let r = Duck.#rand(1) ? -1 : 1;
        if (Duck.#rand(10) < 2) r = 0;
        if (Duck.#rand(10) < 4) r *= .5;
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
        this.el.style.backgroundPosition = (this.backgroundPosition++ === 0 ? "0px 0px" : "-33px 0px");
        if (this.backgroundPosition === 2) { this.backgroundPosition = 0; }
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

    constructor() {
        super(150, 90, 0, 0, "/img/dog.png", "dog");
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

    fetchDucksAtX(duckCount, x, callback) {
        if (duckCount < 1) {
            if (callback) { callback(); }
            return;
        }

        this.isRunning = false
        this.isFetching = true;
        this.hide();

        let y = this.animationSequence.Fetching;
        if (duckCount < 2) {
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
                if (frameCount == 30) { if (duckCount > 1) { Sounds.barkX3.play(); } }
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

class Game {
    static {
        window.addEventListener("resize", Game.appHeight);
        document.addEventListener("DOMContentLoaded", Game.appHeight);
    }

    constructor() {
        //sprites
        this.sprites = document.getElementById("spritesContainer");

        //clouds
        this.clouds = [new Cloud(window.innerWidth - 400, 50, 0.25), new Cloud(window.innerWidth - 250, 150, 0.1)];
        this.clouds.forEach(cloud => this.sprites.appendChild(cloud.el));

        //dog
        this.dog = new Dog();
        this.sprites.appendChild(this.dog.el);

        //title ducks
        this.titleScreenDucks = [];
        this.#makeTitleScreenDucks();

        //scenery
        this.scenery = document.getElementById("scenery");
        this.scrollSceneryTimeout = 0;
        this.scrollSceneryInterval = 16;
        this.scrollSceneryX = 0;
        this.sceneryIsScrolling = false;

        //messages
        this.messages = new Messages();

        //images
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
        //   - feature toggles: sound on/off, recharge timer on/off, duck counts, etc
        this.gameChannel = null;

        // feature flags + fallback values
        this.soundEnabled = true; // all sounds on/off
        this.ducksToLaunch = 5; // initial num of ducks per round
        this.flockMultiplier = 1.5; // number of ducks increased per round
        this.speedMultiplier = 0.2; // clock speed and duck flight speed multiplier
        this.lastDuckGoesCrazy = true; // make the last duck harder to kill and quack a lot
    }

    #makeTitleScreenDucks() {
        const titleDucksXYPositions = [
            [150, window.innerHeight - 350],
            [window.innerWidth - 300, 50],
            [window.innerWidth - 200, 150],
            [window.innerWidth - 350, 350]
        ];

        for (let i = 0; i < 3; i++) {
            let duck = new Duck();
            duck.invincible = true;
            duck.move(titleDucksXYPositions[i][0], titleDucksXYPositions[i][1]);

            if (i == 0) { // make the duck being chased flap faster than the others
                duck.animationTimeoutDelay = 40;
                duck.animationSequence = Duck.animationSequence.FlyEastMouthOpen;
            }
            this.titleScreenDucks.push(duck);
            this.sprites.appendChild(duck.el);
        }
    }

    toggleTitleDucks(visible) {
        for (let duck of this.titleScreenDucks) {
            if (visible) {
                duck.animate();
                duck.show();
            } else {
                duck.stopAnimation();
                duck.hide();
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

    async initRT() {
        this.RT = new Ably.Realtime.Promise({ authUrl: "/auth", transportParams: { remainPresentFor: 1000 } });
        await this.RT.connection.once("connected");
        this.gameChannel = this.RT.channels.get("ld-duck-hunt");
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
            await this.initRT();
            await this.loadImages();
            await Sounds.load();
            await this.loadFonts();
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

export { Game, Messages, Sounds, Duck, Sight, Timebar };