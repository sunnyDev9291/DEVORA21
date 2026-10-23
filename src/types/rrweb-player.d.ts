declare module "rrweb-player" {
  type RrwebPlayerProps = {
    events: unknown[];
    width?: number;
    height?: number;
    autoPlay?: boolean;
    showController?: boolean;
    speed?: number;
    speedOption?: number[];
    skipInactive?: boolean;
    showWarning?: boolean;
    [key: string]: unknown;
  };

  export default class rrwebPlayer {
    constructor(options: { target: HTMLElement; props: RrwebPlayerProps });
    $destroy(): void;
    pause(): void;
    play(): void;
    toggle(): void;
    setSpeed(speed: number): void;
    goto(timeOffset: number, play?: boolean): void;
    triggerResize(): void;
    getMetaData(): { totalTime: number };
  }
}

declare module "rrweb-player/dist/style.css";
