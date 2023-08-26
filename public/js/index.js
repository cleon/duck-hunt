"use strict";

import { Game, Sounds } from "./core.js";

class KioskGame extends Game {
  constructor() {
    super();
    this.players = new Map();
    this.kioskVisible = false;
    this.logoAreaContainer = document.getElementById("logoAreaContainer");
    this.gameInfoContainer = document.getElementById("gameInfoContainer");
    this.logContainer = document.getElementById("infoText");
    this.leadersContainer = document.getElementById("leaderText");
  }

  main() {
    this.makeTitleScreenSprites();
    this.setupQRCodes();
    this.toggleKioskGameUI(false);

    this.gameChannel.publish("kiosk", {});
    this.gameChannel.subscribe("players", msg => {
      const count = msg.data.count;
      //console.log(`${count} players`);
      if (count > 0) {
        if (!this.kioskVisible) {
          this.toggleKioskGameUI(true);
        }
      } else {
        this.toggleKioskGameUI(false);
      }
    });

    this.gameChannel.presence.subscribe("enter", msg => {
      const player = msg.data.player;
      //console.log(`${player.nickname} joined`);
      if (this.players.size == 0) { // first player in 
        this.toggleKioskGameUI(true);
      }
      player.sprites = [];
      this.players.set(player.nickname, player);
      this.logPlayerJoined(player);
    });

    this.gameChannel.subscribe("leave", (msg) => {
      const key = msg.data.player.nickname;
      //console.log(`${key} left`);

      if (this.players.size > 0 && this.players.has(key)) {
        //console.log(`deleting ${key} from players`);
        const player = this.players.get(key);
        this.playerSpritesFlyAway(player.sprites);
        this.logPlayerLeft(player);
        this.players.delete(player.nickname);
      }

      //console.log('players.size', this.players.size);
      if (this.players.size == 0) {
        this.toggleKioskGameUI(false);
      }
    });

    this.gameChannel.subscribe("launchSprites", (msg) => {
      const player = msg.data.player;
      const count = msg.data.count;
      //console.log(`launching ${count} sprites for ${player.nickname}`);

      if (!this.players.has(player.nickname)) {
        //console.log(`${player.nickname} not found`);
        player.sprites = [];
        this.players.set(player.nickname, player);
        this.logPlayerJoined(player);
      }

      let gamePlayer = this.players.get(player.nickname);
      this.launchSprites(msg.data.count, gamePlayer);
    });

    this.gameChannel.subscribe("hit", (msg) => {
      //console.log('hit');
      const player = this.players.get(msg.data.player.nickname);
      if (player) {
        this.hitSprite(player);
      }
    });

    this.gameChannel.subscribe("gameOver", (msg) => {
      const key = msg.data.player.nickname;
      //console.log(`game over ${key}`);
      if (this.players.has(key)) {
        const player = this.players.get(key);
        Sounds.fly.play();
        this.playerSpritesFlyAway(player.sprites);
        player.sprites = [];
        this.logPlayerGameOver(player);
      }
    });

    this.gameChannel.subscribe("leaderboard", (msg) => {
      const leaderboard = msg.data.leaderboard;
      //console.log("leaderboard", leaderboard);
      this.updateLeaderboard(leaderboard);
    });

  }

  toggleKioskGameUI(visible) {
    this.messages.toggleTitle(!visible);
    this.toggleLogoArea(visible);
    this.toggleTitleSprites(!visible);
    this.toggleGameInfo(visible);
    this.toggleScrollingScenery(!visible);
    if (visible) {
      this.dog.stopAnimation();
      this.dog.hide();
    } else {
      this.dog.showRunning();
      this.animateClouds();
    }
    this.kioskVisible = visible;
  }

  logPlayerJoined(player) {
    const message = `&#x2713; ${player.nickname} joined`;
    this.logInfoMessage(message);
  }

  logPlayerLeft(player) {
    const message = `&#x2717; ${player.nickname} left`;
    this.logInfoMessage(message);
  }

  logPlayerGameOver(player) {
    const message = `- Game over ${player.nickname}`;
    this.logInfoMessage(message);
  }

  logInfoMessage(message) {
    const log = this.logContainer;
    if (log.childElementCount > 6) {
      log.firstChild.remove();
      this.logInfoMessage(message);
    } else {
      let messageDiv = document.createElement("div");
      messageDiv.innerHTML = message;
      log.append(messageDiv);
    }
  }

  updateLeaderboard(leaders) {
    while (this.leadersContainer.firstChild) {
      this.leadersContainer.removeChild(this.leadersContainer.firstChild);
    }
    leaders.forEach(leader => {
      let num = "000" + leader.score;
      let leaderDiv = document.createElement("div");
      leaderDiv.innerHTML = `${leader.nickname}...${num.substring(num.length - 4)}`;
      this.leadersContainer.append(leaderDiv);
    });
  }

  setupQRCodes() {
    const URL = `${window.location.protocol}//${window.location.host}/player.html`;
    this.titleQRCode = new QRCode(document.getElementById("titleQRCode"));
    this.logoQRCode = new QRCode(document.getElementById("logoQRCode"));
    this.titleQRCode.makeCode(URL);
    this.logoQRCode.makeCode(URL);
  }

  toggleGameInfo(visible) {
    this.gameInfoContainer.style.visibility = (visible) ? "visible" : "hidden";
  }

  toggleLogoArea(visible) {
    this.logoAreaContainer.style.visibility = (visible) ? "visible" : "hidden";
  }

  hitSprite(player) {
    if (player.sprites.length > 0) {
      player.sprites[0].shoot();
      player.sprites.shift();
    } else {
      console.error('no sprites, shouldnt be here');
    }
  }

  launchSprites(numberOfSprites, player) {
    //console.log(`launching ${numberOfSprites} sprites for ${player.nickname}`);
    for (let i = 0; i < numberOfSprites; i++) {
      let sprite = this.makeShootableSprite();
      this.spritesContainer.appendChild(sprite.el);
      sprite.showInfoTag(player.nickname, player.color.bg, player.color.text);
      sprite.show();
      sprite.animate();
      sprite.flyAround();
      sprite.onLanded(d => { d.remove(); });
      player.sprites.push(sprite);
    }
  }

  playerSpritesFlyAway(sprites) {
    sprites.forEach(sprite => {
      sprite.onFlyAway(s => s.remove());
      sprite.flyAway();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const game = new KioskGame();
  game.showGameCover(() => {
    game.run();
  });
});