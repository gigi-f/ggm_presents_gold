import Phaser from 'phaser';
import { MainScene } from './main.js';
import { UIScene } from './scenes/UIScene.js';
import { TestScene } from './scenes/TestScene.js';

const config = {
  type: Phaser.AUTO,
  width: 384,
  height: 352,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      fps: 60,
      fixedStep: true
    }
  },
  scene: [MainScene, UIScene, TestScene],
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 2
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
    deltaHistory: 10,
    panicMax: 0,
    smoothStep: true
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true
  },
  loader: {
    maxParallelDownloads: 10
  }
};

new Phaser.Game(config);
