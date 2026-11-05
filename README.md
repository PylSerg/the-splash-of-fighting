# The Splash of Fighting 🥊

A browser-based 2D fighting game prototype featuring Evi and Nara.

**Stack:** Phaser 4.2.1, TypeScript, Vite, GitHub Pages.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. To validate a production build:

```bash
npm run check
npm run build
npm run preview
```

## Alpha 0.2.1 · Mobile jump & spacing fix

The **↑ JUMP** button is separate from the directional joystick. Hold the joystick horizontally and tap JUMP to leap without releasing movement; diagonal jump on the stick also works. The independent jump action is mapped to **Space** (player 1), **Numpad0** (player 2) and **RB** (standard gamepad). Touch controls now have larger safe edge margins in landscape and fullscreen, including phones with display cutouts.

## Alpha 0.2 · Mobile controls

Turn the phone to **landscape**. The left thumb controls a floating **8-direction joystick** with a dead zone; the right thumb uses four **circular buttons arranged in a diamond**: **A (left) light**, **B (top) heavy**, **C (right) kick**, **SP (bottom) special**. Supports simultaneous pointers on the joystick and attacks. The virtual stick centers when released. Fullscreen button is available on supported browsers.

## Controls

| Action | Player 1 | Player 2 (press 2 to enable local versus) | Gamepad |
| --- | --- | --- | --- |
| Move / jump / crouch | WASD | Arrow keys | D-pad or left stick |
| Light attack | J | Numpad 1 | X (button 2) |
| Heavy attack | K | Numpad 2 | Y (button 3) |
| Kick | U | Numpad 4 | A (button 0) |
| Special | I | Numpad 5 | B (button 1) |
| Guard | Hold back | Hold back | Hold back |

On touchscreens, move the virtual joystick and tap circular attack buttons simultaneously. Play in landscape orientation.
Press **1** for CPU opponent, **2** for local versus, **R** to restart, **H** for hitbox debug overlay.

## Features in the first milestone

- A playable arena with two **procedural stand-in fighters** (not yet sprites from the reference images).
- Fixed-time-step combat, basic hitboxes, hitstun, blocking, four attacks and special energy.
- Keyboard, Gamepad API and multi-touch on-screen controls.
- Round timer, health bars, victory state and optional hitbox visualisation.
- GitHub Actions workflow for Vite build + GitHub Pages deployment.

## Sprites / assets (planned)

Reference images will be used to produce **original** pixel sprites later. Keep source PNGs and frame atlases under `public/assets/fighters/{evi,nara}/`. Animation metadata should be defined separately from collision boxes and attack frame data.

## GitHub Pages

1. In **Settings → Pages → Build and deployment**, set **Source: GitHub Actions**.
2. Push to `main` (workflow `.github/workflows/deploy.yml`).
3. Site URL (once enabled): https://pylserg.github.io/the-splash-of-fighting/

Vite `base` is configured for the repository subpath. **Note:** GitHub Free Pages generally requires a public repository; private Pages availability depends on plan and settings. Publishing a Pages website makes the site publicly reachable.

This is a gameplay prototype: no online multiplayer or finished sprite atlases yet.
