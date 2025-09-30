declare module 'phaser' {
  const Phaser: any;
  export default Phaser;
}

declare module 'vite' {
  export function defineConfig(config: any): any;
}

// Ambient module shims for JS modules consumed by TS
// Note: local JS modules are typed via colocated .d.ts files in src/

// Phaser types for common game objects
declare global {
  namespace Phaser {
    interface Scene {
      physics: any;
      add: any;
      input: any;
      cameras: any;
      sound: any;
      scene: any;
      load: any;
      cache: any;
      registry: any;
      events: any;
      time: any;
      tweens: any;
      children: any;
      textures: any;
      rexUI?: any;
    }
    
    interface GameObjects {
      Sprite: any;
      Image: any;
      Container: any;
      Graphics: any;
      Text: any;
      Rectangle: any;
      Group: any;
    }
  }
}

declare module 'phaser3-rex-plugins/templates/ui/ui-plugin.js' {
  const RexUIPlugin: any;
  export default RexUIPlugin;
}
