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

## Alpha 0.3.0 · ABXY combat controls

- **X** (left): quick light punch, **Y** (top): slower heavy punch, **B** (right): kick, **A** (bottom): hold to block.
- **B+Y** together (touch, keyboard or gamepad) triggers a special when the energy meter has at least 40 points; **R1 / RB** on a standard gamepad is an alternate direct shortcut.
- A 75 ms chord-recognition window prioritizes B+Y over its component attacks. A brief special buffer also handles near-simultaneous presses.
- A replaces automatic back-to-block. Hold A to guard; A plus down guards low. The left joystick remains independent of attack touches.
- Keyboard P1: WASD, J/X-light, K/Y-heavy, L/B-kick, H/A-block, K+L or I/special; P2: arrows, Num1/Num2/Num4/Num5; Num2+Num4 or Num6 special.
- Joystick up or up-diagonal remains jump. Space (P1) and Numpad0 (P2) are alternative jump keys; LB/L1 optional on standard gamepads.

## Alpha 0.2.3 · Reliable held-stick jumping

Jump is now driven by the **current joystick direction every game tick**, not only the first frame of an upward deflection. If the player pushes diagonally up during hitstun or while airborne, the held direction triggers a jump as soon as the character is grounded and able to act. Keeping the joystick up repeats the jump after each landing; returning it to neutral stops jumping. This works with attacks held by another finger. The mobile UI still has only four attack buttons.

## Alpha 0.2.2 · Joystick-first multitouch fix

Mobile has exactly four attack buttons (A, B, C and SP). **No separate jump button.** Slide the joystick diagonally up while running to jump. The directional pointer keeps its own position and is sampled continuously regardless of how many attack buttons are being pressed. Attacks slow movement rather than freezing directional input; jumping is evaluated before attacks and also works while attack buttons are pressed. Touch controls retain the larger safe edge margins from Alpha 0.2.1.

The keyboard retains optional **Space** (player 1) and **Numpad0** (player 2), and a standard gamepad retains **RB** as alternative jump triggers; on touchscreens jump uses only the joystick.

## Alpha 0.2 · Mobile controls

Turn the phone to **landscape**. The left thumb controls a floating **8-direction joystick** with a dead zone; the right thumb uses four **circular buttons arranged in a diamond**: **A (left) light**, **B (top) heavy**, **C (right) kick**, **SP (bottom) special**. Supports simultaneous pointers on the joystick and attacks. The virtual stick centers when released. Fullscreen button is available on supported browsers.

## Controls

| Action | Player 1 | Player 2 (press 2 to enable local versus) | Gamepad |
| --- | --- | --- | --- |
| Move / jump / crouch | WASD | Arrow keys | D-pad or left stick |
| Light attack (X) | J | Numpad 1 | X (button 2) |
| Heavy attack (Y) | K | Numpad 2 | Y (button 3) |
| Kick (B) | L | Numpad 4 | B (button 1) |
| Guard (A) | Hold H | Hold Numpad 5 | Hold A (button 0) |
| Special | K+L or I | Numpad 2+4 or Numpad 6 | B+Y or R1/RB (button 5) |

On touchscreens, move the virtual joystick and tap the **ABXY** diamond simultaneously. Press **B+Y** with two fingers for a special. Play in landscape orientation.
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
