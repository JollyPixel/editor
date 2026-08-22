// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { truncate } from "../theme/styles/mixins.ts";

export const loadingStyles = css`
  :host {
    display: block;
    position: absolute;
    inset: 0;
    transition: opacity 0.5s ease-out;
  }
  :host([completed]) {
    opacity: 0;
  }
  #loading {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    color: var(--jolly-loading-color, #444);
    font-size: 24px;
    font-family: sans-serif;
    display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center;
    background: var(--jolly-loading-background, #eee);
  }
  :host(:not([started])) #loading {
    opacity: 0;
  }
  #loading a {
    transition: opacity 0.3s ease-out;
    position: relative;
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
  }
  #loading a > * {
    pointer-events: none;
  }
  #loading .logo {
    width: 480px;
    height: 280px;
    max-width: 100%;
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
    animation: logo-fade-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: 0.2s;
  }
  #loading .logo.hidden {
    display: none;
  }
  @keyframes logo-fade-in {
    0% {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  :host([completed]) #loading .logo {
    animation: logo-fade-out 0.4s ease-out forwards;
  }
  @keyframes logo-fade-out {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-10px) scale(0.98);
    }
  }
  #loading .asset {
    margin-top: 20px;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--jolly-loading-asset-color, #282e38);
    opacity: 0;
    animation: fade-slide-in 0.6s ease-out forwards;
    animation-delay: 0.5s;
    padding: 0 2em;
    max-width: 100%;
    ${truncate}
    /* Transition douce lors du changement d'asset */
    transition: opacity 0.2s ease-out;
  }
  /* Effet subtil de "pulse" pendant le chargement */
  @keyframes fade-slide-in {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 0.8;
      transform: translateY(0);
    }
  }
  #loading .progress-container {
    --jolly-progress-height: 6px;
    --jolly-progress-duration: 400ms;
    --jolly-progress-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    --jolly-progress-track: linear-gradient(
      180deg,
      var(--jolly-loading-progress-track-start, #b8bfb0) 0%,
      var(--jolly-loading-progress-track-middle, #d0d4c3) 50%,
      var(--jolly-loading-progress-track-end, #b8bfb0) 100%
    );
    --jolly-progress-track-shadow:
      inset 0 1px 2px rgb(0 0 0 / 0.1),
      0 1px 0 rgb(255 255 255 / 0.5);
    --jolly-progress-fill: linear-gradient(
      90deg,
      var(--jolly-loading-progress-start, #2a5d8f) 0%,
      var(--jolly-loading-progress-middle, #3e7cb8) 50%,
      var(--jolly-loading-progress-end, #4a8fd8) 100%
    );
    --jolly-progress-shadow:
      0 0 10px
        var(--jolly-loading-progress-glow, rgba(62, 124, 184, 0.5)),
      0 0 20px
        var(--jolly-loading-progress-glow-subtle, rgba(62, 124, 184, 0.3)),
      inset 0 1px 0 rgb(255 255 255 / 0.3);
    --jolly-progress-shadow-active:
      0 0 15px
        var(--jolly-loading-progress-glow-strong, rgba(62, 124, 184, 0.7)),
      0 0 30px
        var(--jolly-loading-progress-glow, rgba(62, 124, 184, 0.5)),
      inset 0 1px 0 rgb(255 255 255 / 0.4);

    width: 100%;
    position: relative;
    opacity: 0;
    animation: fade-slide-in 0.6s ease-out forwards;
    animation-delay: 0.7s;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
  #loading div.error {
    text-align: center;
    padding: 0 2em;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 0.5px;
    font-family: Monaco, "DejaVu Sans Mono", "Lucida Console", "Andale Mono", monospace;
    color: var(--jolly-loading-error-color, #bf360c);
    text-transform: uppercase;
  }
  #loading pre.error {
    text-align: left;
    overflow: auto;
    padding: 1em;
    margin-top: 1em;
    background: var(--jolly-loading-error-background, #cfd8dc);
    color: var(--jolly-loading-error-text-color, #182024);
    font-size: 15px;
    border-radius: 4px;
  }
  #loading button.dismiss {
    margin-top: 1.5em;
    padding: 0.5em 1.5em;
    font-size: 14px;
    font-family: sans-serif;
    text-transform: none;
    letter-spacing: normal;
    color: var(--jolly-loading-error-color, #bf360c);
    background: transparent;
    border: 1px solid var(--jolly-loading-error-color, #bf360c);
    border-radius: 4px;
    cursor: pointer;
    pointer-events: auto;
  }
  #loading button.dismiss:hover {
    background: var(--jolly-loading-error-color, #bf360c);
    color: var(--jolly-loading-error-background, #cfd8dc);
  }
  /* Media queries pour mobile */
  @media (max-width: 600px) {
    #loading {
      padding: 15px;
    }
    #loading .asset {
      font-size: 11px;
      letter-spacing: 1px;
      margin-top: 15px;
    }
    #loading div.error {
      font-size: 16px;
      padding: 0 1em;
    }
    #loading pre.error {
      font-size: 13px;
      padding: 0.8em;
    }
  }
  @media (max-width: 400px) {
    #loading {
      padding: 10px;
    }
    #loading .asset {
      font-size: 10px;
      letter-spacing: 0.5px;
      margin-top: 12px;
    }
    #loading .progress-container {
      --jolly-progress-height: 5px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :host,
    #loading a,
    #loading .logo,
    #loading .asset,
    #loading .progress-container {
      animation: none;
      transition-duration: 0ms;
    }

    #loading .logo,
    #loading .asset,
    #loading .progress-container {
      opacity: 1;
      transform: none;
    }
  }
`;
