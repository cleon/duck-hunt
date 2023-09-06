"use strict";

import { Game, Messages, Sight, Sounds, Timebar } from "./core.js";

class PlayerGame extends Game {
  constructor() {
    super();

    // player game-specific stuff
    this.playerInfoContainer = document.getElementById("playerInfoContainer");
    this.playerName = document.getElementById("playerName");
    this.playerScore = document.getElementById("playerScore");
    this.roundNumber = document.getElementById("roundNumber");
    this.gameSummaryContainer = document.getElementById("gameSummaryContainer");
    this.gameSummaryShotsFired = document.getElementById("gameSummaryShotsFired");
    this.gameSummaryHits = document.getElementById("gameSummaryHits");
    this.gameSummaryHitMissRatio = document.getElementById("gameSummaryHitMissRatio");
    this.gameSummaryScore = document.getElementById("gameSummaryScore");
    this.gameSummaryPlayerName = document.getElementById("gameSummaryPlayerName");

    this.shootingEnabled = false;
    this.sight = new Sight();
    this.spritesContainer.appendChild(this.sight.el);

    this.sprites = new Map();
    this.landedSpriteCount = 0;
    this.spritesInCurrentRound = 0;
    this.spritesToFetch = 0;

    this.score = 0;
    this.round = 0;
    this.shotsFired = 0;
    this.killCount = 0;
    this.hitCount = 0;
    this.gameInProgress = false;

    this.timerRoundSpeedFactor = 1;
    this.spriteFlightSpeedFactor = 1;
    this.timeRewardFactor = 1;

    this.player = {
      nickname: null,
      color: { bg: "#000000", text: "#ffffff" }
    };

    // player channel used to publish messages
    this.playerChannel = null;

    this.gameMessages = {
      Enter: "enter",
      Leave: "leave",
      StartGame: "startGame",
      LaunchSprites: "launchSprites",
      Hit: "hit",
      GameOver: "gameOver"
    };
  }

  run() {
    this.messages.toggleTitle(true);
    this.initPlayerInteractions();
    this.#generateGamerTag().then(super.run());
  }

  main() {
    this.makeTitleScreenSprites();
    Timebar.onTimesUp(() => { this.timesUp(); });
    Timebar.onTimesRunningOut(() => { this.timesRunningOut(); });

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
    this.dog.showRunning();
    this.toggleTitleSprites(true);
    this.playNewGameMusic(() => { // dont do ish until that jam ends. let the music play on play on play on...
      this.messages.showClickHere(() => {
        this.gameInProgress = true;
        this.loopBGM();
        setTimeout(() => { this.dog.bark(); }, 1500);
        this.prepareNewGame();
        this.startNewRound();
      });
    });
  }

  prepareNewRound() {
    this.spritesToFetch = 0;
    this.landedSpriteCount = 0;
    this.round++;
    this.messages.show(Messages.GetReady);
    this.setRoundNumber(this.round);
    this.toggleScrollingScenery(true);
    this.toggleShootingEnabled(false);
    this.sight.hide();
    this.dog.showRunning();
    this.sprites.clear();
  }

  prepareNewGame() {
    //reset game state
    this.score = 0;
    this.hitCount = 0;
    this.killCount = 0;
    this.shotsFired = 0;

    this.round = 0;
    this.landedSpriteCount = 0;
    this.timerRoundSpeedFactor = 1;
    this.spriteFlightSpeedFactor = 1;
    this.timeRewardFactor = 1;

    Timebar.reset();

    //setup the UI
    this.messages.toggleTitle(false);
    this.toggleTitleSprites(false);
    Timebar.toggleVisible(true);
    this.togglePlayerInfo(true);
    this.setPlayerScore(this.score);
    this.animateClouds();

    this.prepareNewRound();
  }

  startNewRound() {
    setTimeout(() => {
      this.messages.hide();
      this.dog.hide();
      this.toggleScrollingScenery(false);

      this.toggleShootingEnabled(true);
      this.sight.show();

      this.spritesInCurrentRound = this.spritesToLaunch;
      this.adjustDifficulty();
      this.launchSprites(this.spritesInCurrentRound, this.spriteFlightSpeedFactor);

      Timebar.start(this.timerRoundSpeedFactor);
    }, 2500);
  }

  adjustDifficulty() {
    if (this.round > 1) {
      this.spritesInCurrentRound = this.spritesToLaunch + Math.floor(this.flockMultiplier * this.round);
      this.timerRoundSpeedFactor = this.timerRoundSpeedFactor + (this.timerRoundSpeedFactor * this.speedMultiplier);
      this.spriteFlightSpeedFactor = this.spriteFlightSpeedFactor + (this.spriteFlightSpeedFactor * this.speedMultiplier);
      this.timeRewardFactor = this.timeRewardFactor + Math.round(this.timeRewardFactor * this.speedMultiplier);
    }
  }

  timesRunningOut() {
    this.stopBGM();
    this.playHurryUp(() => {
      this.loopBGM(Sounds.HurryUpSpeed);
    });
  }

  timesUp() {
    this.gameInProgress = false;
    Timebar.pause();
    this.stopBGM();

    this.toggleShootingEnabled(false);
    this.sight.hide();

    this.dog.hide();
    this.stopClouds();

    this.messages.show(Messages.FlyAway);

    this.playFlyAwaySound();
    this.sprites.forEach(sprite => sprite.flyAway());

    this.playerChannel.publish("gameOver", {});

    setTimeout(() => {
      this.messages.show(Messages.GameOver);
      this.playGameOverBGM(() => {
        setTimeout(() => {
          this.messages.hide();
          Timebar.toggleVisible(false);
          this.togglePlayerInfo(false);
          this.showGameSummary(() => {
            this.hideGameSummary();
            this.newGame();
          });
        }, 2000);
      });
    }, 3000);
  }

  launchSprites(numberOfSprites, speedFactor) {
    this.playerChannel.publish("launchSprites", { count: numberOfSprites });

    for (let i = 0; i < numberOfSprites; i++) {
      const sprite = this.makeShootableSprite();
      this.spritesContainer.appendChild(sprite.el);
      this.wireUpSpriteEvents(sprite);
      this.sprites.set(sprite.id, sprite);
      sprite.show();
      sprite.animate();
      sprite.flyAround(speedFactor);
    }
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
  }

  hideGameSummary() {
    this.gameSummaryContainer.style.visibility = "hidden";
    this.gameSummaryContainer.style.pointerEvents = "none";
  }

  showGameSummary(callback) {
    const gsc = this.gameSummaryContainer;
    gsc.style.visibility = "visible";
    gsc.style.pointerEvents = "auto";

    const shots = this.shotsFired;
    const hits = this.hitCount;
    const ratio = shots > 0 ? ((hits / shots) * 100).toFixed(1) : 0;

    this.gameSummaryPlayerName.innerText = this.player.nickname;
    this.gameSummaryScore.innerText = this.score;
    this.gameSummaryShotsFired.innerText = shots;
    this.gameSummaryHits.innerText = hits;
    this.gameSummaryHitMissRatio.innerText = ratio + "%";

    gsc.onclick = (e) => {
      this.hideGameSummary();
      callback();
    };
  }

  updateExistingSpritesTheme() {
    const config = this.makeNewSpriteConfig();
    this.sprites.forEach(sprite => {
      sprite.setBackgroundImageUrl(config.imgUrl);
      sprite.setSounds(config.sounds);
    });
  }

  toggleExistingSpritesMute(mute) {
    this.sprites.forEach(sprite => {
      this.toggleSFX(sprite.sounds, !mute);
    });
  }

  wireUpSpriteEvents(sprite) {
    sprite.onHit(s => {
      if (this.shootingEnabled) {
        this.hitCount++;
        if (this.round > 1) {
          //Timebar.add(this.timeRewardFactor);
        }
      }
    });

    sprite.onKilled(s => {
      this.sprites.delete(s.id);
      this.score++;
      this.killCount++;
      this.setPlayerScore(this.score);

      this.playerChannel.publish("kill", {});

      if (this.sprites.size == 0) {
        if (!Timebar.timesUp()) {
          Timebar.pause();
        }
      } else if (this.sprites.size == 1 && this.lastSpriteGoesCrazy) {
        const lastSprite = this.sprites.values().next().value;
        lastSprite.panic();
      }
    });

    sprite.onLanded(s => {
      s.remove();
      this.sprites.delete(s.id);
      this.spritesToFetch++;
      this.landedSpriteCount++;
      if (!this.dog.isFetching && !Timebar.timesUp()) {
        setTimeout(() => {
          const count = this.spritesToFetch;
          if (!this.dog.isFetching && !Timebar.timesUp()) {
            this.dog.fetchSpritesAtX(count, s.x, () => {
              this.spritesToFetch = 0;
              if (this.landedSpriteCount == this.spritesInCurrentRound) {
                setTimeout(() => {
                  this.spritesToFetch = 0;
                  this.prepareNewRound();
                  this.startNewRound();
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
        this.shotsFired++;
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
        this.shotsFired++;
        this.sight.move(e.pageX, e.pageY);
        this.sight.shoot(e.pageX, e.pageY);
      }
    };
  }

  onGameThemeChanged() {
    if (this.gameInProgress) {
      this.updateExistingSpritesTheme();
    }
  }

  onSFXEnabledChanged(enabled) {
    this.sight.toggleSFX(enabled);
    this.toggleExistingSpritesMute(!enabled);
  }

  async #generateGamerTag() {
    const localStorageKey = "launch-duckly-tag";
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