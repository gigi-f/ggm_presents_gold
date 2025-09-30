declare module 'phaser' {
  const Phaser: any;
  export default Phaser;
  
  namespace Types {
    namespace Physics {
      namespace Arcade {
        interface SpriteWithDynamicBody {
          body: any;
          setImmovable(value: boolean): this;
          setDepth(depth: number): this;
          destroy(): void;
          x: number;
          y: number;
          [key: string]: any;
        }
      }
    }
  }
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
