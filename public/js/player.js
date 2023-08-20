"use strict";

import { Game, Duck, Messages, Sight, Sounds, Timebar } from "./core.js";

class PlayerGame extends Game {
  constructor() {
    super();

    // player game-specific stuff
    this.gameCoverContainer = document.getElementById("gameCoverContainer");
    this.playerInfoContainer = document.getElementById("playerInfoContainer");
    this.playerName = document.getElementById("playerName");
    this.playerScore = document.getElementById("playerScore");
    this.roundNumber = document.getElementById("roundNumber");

    //this.shootingEnabled = false;
    this.toggleShootingEnabled(false);
    this.sight = new Sight();
    this.sprites.appendChild(this.sight.el);

    this.ducks = new Map();
    this.landedDuckCount = 0;
    this.ducksInCurrentRound = 0;
    this.ducksToFetch = 0;
    this.score = 0;
    this.round = 0;

    this.timerRoundSpeedFactor = 1;
    this.duckFlightSpeedFactor = 1;
    this.timeRewardFactor = 1;

    this.player = {
      nickname: null,
      color: { bg: "#000000", text: "#ffffff" }
    };

    // player channel used to publish messages:
    //    - launching ducks
    //    - hit a duck, send current score 
    //    - game over
    this.playerChannel = null;
  }

  run() {
    this.messages.toggleTitle(true);
    this.initPlayerInteractions();
    Timebar.onTimesUp(() => { this.timesUp(); });
    this.#generateGamerTag().then(super.run());
  }

  main() {
    this.gameChannel.presence.enter({ player: this.player }).then(() => {
      this.playerChannel = this.RT.channels.get(`player-${this.RT.auth.clientId}`);
      this.setPlayerName(this.player.nickname);
      this.newGame();
    });
  }

  newGame() {
    this.messages.toggleTitle(true);
    this.toggleScrollingScenery(true);
    this.hideClouds();
    this.toggleTitleDucks(true);
    this.dog.showRunning();

    Sounds.run.play(() => { // dont do ish until that jam ends. let the music play on play on play on...
      this.messages.showClickHere(() => {
        Sounds.bgm.loop();
        setTimeout(() => { Sounds.barkX3.play(); }, 1500);
        this.prepareNewGame();
        this.startRound();
      });
    });
  }

  prepareNewRound() {
    this.ducksToFetch = 0;
    this.landedDuckCount = 0;
    this.round++;
    this.messages.show(Messages.GetReady);
    this.setRoundNumber(this.round);
    this.toggleScrollingScenery(true);
    this.toggleShootingEnabled(false);
    this.sight.hide();
    this.dog.showRunning();
    this.ducks.clear();
  }

  prepareNewGame() {
    //reset game state
    this.score = 0;
    this.round = 0;
    this.landedDuckCount = 0;
    this.timerRoundSpeedFactor = 1;
    this.duckFlightSpeedFactor = 1;
    this.timeRewardFactor = 1;

    Timebar.reset();

    //setup the UI
    this.messages.toggleTitle(false);
    this.toggleTitleDucks(false);
    Timebar.toggleVisible(true);
    this.togglePlayerInfo(true);
    this.setPlayerScore(this.score);
    this.animateClouds();

    this.prepareNewRound();
  }

  startRound() {
    setTimeout(() => {
      this.toggleShootingEnabled(true);
      this.sight.show();
      this.dog.hide();
      this.messages.hide();
      this.toggleScrollingScenery(false);

      this.ducksInCurrentRound = this.ducksToLaunch;
      this.adjustDifficulty();
      this.launchDucks(this.ducksInCurrentRound, this.duckFlightSpeedFactor);

      Timebar.start(this.timerRoundSpeedFactor);
    }, 2500);
  }

  adjustDifficulty() {
    if (this.round > 1) {
      this.ducksInCurrentRound = this.ducksToLaunch + Math.floor(this.flockMultiplier * this.round);
      this.timerRoundSpeedFactor = this.timerRoundSpeedFactor + (this.timerRoundSpeedFactor * this.speedMultiplier);
      this.duckFlightSpeedFactor = this.duckFlightSpeedFactor + (this.duckFlightSpeedFactor * this.speedMultiplier);
      this.timeRewardFactor = this.timeRewardFactor + Math.round(this.timeRewardFactor * this.speedMultiplier);
    }
  }

  timesUp() {
    this.messages.show(Messages.FlyAway);
    this.stopClouds();
    this.dog.hide();
    this.toggleShootingEnabled(false);
    this.sight.hide();

    Timebar.pause();

    Sounds.barkX3.stop();
    Sounds.bgm.stop();
    Sounds.quack.stop();
    Sounds.fly.play();

    this.ducks.forEach(duck => duck.flyAway());
    this.playerChannel.publish("gameOver", {});

    setTimeout(() => {
      this.messages.show(Messages.GameOver);
      Sounds.run2.play(() => {
        setTimeout(() => {
          this.messages.hide();
          Timebar.toggleVisible(false);
          this.togglePlayerInfo(false);
          this.newGame();
        }, 3000);
      });
    }, 3000);
  }

  setPlayerName(name) {
    this.playerName.innerHTML = name.toString().toUpperCase();
  }

  setPlayerScore(score) {
    let num = "000" + score;
    this.playerScore.innerHTML = num.substring(num.length - 4);
  }

  setRoundNumber(round) {
    this.roundNumber.innerHTML = `R=${round}`;
  }

  togglePlayerInfo(visible) {
    this.playerInfoContainer.style.visibility = (visible) ? "visible" : "hidden";
  }

  toggleShootingEnabled(enabled) {
    this.shootingEnabled = enabled;
    //this.sprites.style.cursor = (enabled) ? "pointer" : "none";
    //(enabled) ? this.sprites.addEventListener("click", void (0)) : this.sprites.removeEventListener("click", void (0));
  }

  launchDucks(numberOfDucks, speedFactor) {
    this.playerChannel.publish("launchDucks", { count: numberOfDucks });
    for (let i = 0; i < numberOfDucks; i++) {
      let duck = new Duck();
      this.sprites.appendChild(duck.el);
      this.wireUpDuckEvents(duck);
      this.ducks.set(duck.id, duck);
      duck.show();
      duck.animate();
      duck.flyAround(speedFactor);
    }
  }

  wireUpDuckEvents(duck) {
    duck.onShot((d) => {
      if (this.shootingEnabled) {
        if (this.round > 1) {
          Timebar.add(this.timeRewardFactor);
        }
        this.ducks.delete(d.id);
        this.score++;
        this.setPlayerScore(this.score);
        this.playerChannel.publish("hit", {});
        if (this.ducks.size == 0) {
          if (!Timebar.timesUp()) {
            Timebar.pause();
            if (this.lastDuckGoesCrazy) {
              Sounds.quack.stop();
            }
          }
        } else if (this.ducks.size == 1 && this.lastDuckGoesCrazy) {
          const lastDuck = this.ducks.values().next().value;
          lastDuck.movementSpeed *= 1.5;
          Sounds.quack.loop();
        }
      }
    });

    duck.onLanded((d) => {
      d.remove();
      this.ducks.delete(d.id);
      this.ducksToFetch++;
      this.landedDuckCount++;
      if (!this.dog.isFetching && !Timebar.timesUp()) {
        setTimeout(() => {
          const count = this.ducksToFetch;
          if (!this.dog.isFetching && !Timebar.timesUp()) {
            this.dog.fetchDucksAtX(count, d.x, () => {
              this.ducksToFetch = 0;
              if (this.landedDuckCount == this.ducksInCurrentRound) {
                setTimeout(() => {
                  this.ducksToFetch = 0;
                  this.prepareNewRound();
                  this.startRound();
                }, 1200);
              }
            });
          }
        }, 400);
      }
    });
  }

  initPlayerInteractions() {
    window.onmousedown = (e) => {
      if (this.shootingEnabled) {
        this.sight.move(e.clientX, e.clientY);
        this.sight.shoot(e.clientX, e.clientY);
      }
    };

    window.onmousemove = (e) => {
      if (this.shootingEnabled) { this.sight.move(e.clientX, e.clientY); }
    };

    // HACK for iOS Safari
    window.ontouchstart = (e) => {
      if (this.shootingEnabled) {
        this.sight.move(e.pageX, e.pageY);
        this.sight.shoot(e.pageX, e.pageY);
      }
    };
  }

  showGameCover(callback) {
    const el = this.gameCoverContainer;
    el.style.pointerEvents = "auto";
    el.style.visibility = "visible";
    el.onclick = () => {
      el.style.pointerEvents = "none";
      el.style.visibility = "hidden";
      callback();
    };
  }

  async #generateGamerTag() {
    const localStorageKey = "ld-duckhunt-tag";
    let nickname = localStorage.getItem(localStorageKey);
    if (nickname) {
      this.player.nickname = nickname;
    } else {
      try {
        const resp = await fetch("/nickname");
        const json = await resp.json();
        this.player.nickname = json.nickname;
        this.player.color = json.color;
      } catch (e) {
        console.error("Unable to fetch /nickname", e);
      }
    }
    localStorage.setItem(localStorageKey, this.player.nickname);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const game = new PlayerGame();
  game.showGameCover(() => {
    game.run();
  });
});