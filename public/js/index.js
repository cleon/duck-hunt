"use strict";

import { Game, Sounds } from "./core.js";

class KioskGame extends Game {
  constructor() {
    super();
    this.players = new Map();
    this.logoAreaContainer = document.getElementById("logoAreaContainer");
    this.gameInfoContainer = document.getElementById("gameInfoContainer");
    this.logContainer = document.getElementById("infoText");
    this.leadersContainer = document.getElementById("leaderText");
    this.setupQRCodes();
  }

  main() {
    this.messages.toggleTitle(true);
    this.toggleLogoArea(false);
    this.toggleTitleSprites(true);
    this.toggleGameInfo(false);
    this.toggleScrollingScenery(true);
    this.animateClouds();
    this.dog.showRunning();

    this.gameChannel.subscribe("enter", (msg) => {
      console.log(`${msg.data.player.nickname} entered`)

      if (this.players.size == 0) { // first player in 
        this.showKioskUI();
      }
      const player = msg.data.player;
      player.sprites = [];
      this.players.set(player.nickname, player);
      this.logPlayerJoined(player);
    });

    this.gameChannel.subscribe("leave", (msg) => {
      const key = msg.data.player.nickname;
      if (this.players.size > 0 && this.players.has(key)) {
        const player = this.players.get(key);
        this.playerSpritesFlyAway(player.sprites);
        this.logPlayerLeft(player);
        this.players.delete(player.nickname);
      }
    });

    this.gameChannel.subscribe("launchSprites", (msg) => {
      this.messages.hide();
      let player = this.players.get(msg.data.player.nickname);
      this.launchSprites(msg.data.count, player);
      console.log(`launching ${msg.data.count} sprites for ${player.nickname}`);
    });

    this.gameChannel.subscribe("hit", (msg) => {
      const player = this.players.get(msg.data.player.nickname);
      if (player) {
        this.hitSprite(player);
      }
    });

    this.gameChannel.subscribe("gameOver", (msg) => {
      const key = msg.data.player.nickname;
      const player = this.players.get(key);
      if (player) {
        Sounds.fly.play();
        this.playerSpritesFlyAway(player.sprites);
        player.sprites = [];
        this.logPlayerGameOver(player);
      }
    });

    this.gameChannel.subscribe("leaderboard", (msg) => {
      this.updateLeaderboard(msg.data.leaderboard);
    });
  }

  showKioskUI() {
    this.messages.toggleTitle(false);
    this.toggleLogoArea(true);
    this.toggleTitleSprites(false);
    this.toggleGameInfo(true);
    this.toggleScrollingScenery(false);
    this.dog.stopAnimation();
    this.dog.hide();
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