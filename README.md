# The Splash of Fighting 🥊

A browser-based 2D arcade fighting game featuring Evi, Runa, Lyra and Kai.

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

## Alpha 1.2.1 · Accurate build version labels

- Fixed the main title screen, which still displayed **Alpha 1.1.1** despite the deployed game already running 1.2.0.
- Both the main screen and pause menu now read their release version directly from `package.json` at build time, and the title screen builds its fighter list directly from the live character roster. Future character additions and version bumps no longer require separately editing these labels.
- No gameplay or fighter mechanics are changed in this patch.

## Alpha 1.8.1 · Correct crouching ABXY bindings

- **Down + B** (kick button) executes the low **sweep**. An unblocked hit trips a grounded opponent.
- **Down + X** (light button) executes the quick, weak **mid-level jab** without knockdown.
- Only the input binding is swapped: move damage, knockdown, low-block interaction, procedural animations and recovery timings remain unchanged.
- CPU now inputs Down+B for sweeps and Down+X for crouching mid strikes. Updated on-screen help and automated input-binding tests.
- The Alpha 1.8.0 section below documents the earlier, reversed bindings for historical reference.

## Alpha 1.8.0 · Crouching offense and sweep knockdowns

- **Down + X** now performs a dedicated ground-level leg sweep (5 HP; Runa 6 HP, slower). It has a longer startup than standing X, and a distinct procedural kicking animation.
- If the sweep actually hits a grounded opponent **without a successful crouching guard**, the victim trips and falls. The victim stays prone for 0.5 seconds, then rises over 0.5 seconds; a KO uses the existing permanent knockout fall. Grounded targets may be standing or crouching when hit.
- Low block **Down + A** fully negates the sweep and prevents falling. Sweep never trips jumping opponents and cannot bypass active roll invulnerability or existing knockdown protection. A **standing A block** does not protect against it.
- **Down + B** performs a quick, weaker mid jab with the forearm/weapon (4 HP; Runa 5 HP). It does not knock down and can be blocked by both standing and crouching guards.
- **Down + Y** and **Down + B+Y** do not begin high strikes or supers; crouching disallows any other attack. The two crouch moves remain low-profile throughout the animation, even if Down is released.
- Grabs, backward-input overhead throws and directional rolls retain their priority over crouching attack chords; A+X is not mistaken for a sweep. CPU now occasionally tries both crouching attacks.
- New deterministic tests cover the two allowed crouch moves, invalid chords, block stances, sweep knockdown eligibility, airborne immunity and hitbox overlap.
- Visuals are temporary procedural poses until the planned pixel-art sprite pass.

## Alpha 1.7.1 · Grabs require a standing or walking defender

- A standing grab may **start only against a grounded, upright opponent**. Walking toward or away from the attacker stays grab-eligible.
- A **crouching or airborne** opponent cannot be caught, including when Down or Up/jump is pressed on the same simulation frame as the grab attempt.
- Check target eligibility **again at the end of the reach animation**, so crouching or jumping away during the wind-up avoids the grab. Existing roll/knockdown restrictions remain.
- Rejected grabs cannot enter the caught/throw phase; no forced standing poses. The manual A+X + backward throw sequence remains unchanged after a legitimate catch.
- Added regression tests for standing, walking, crouching, jumping, early input frames, roll and knockdown, alongside existing high/mid/low hit-level tests.

## Alpha 1.7.0 · Three height lanes and tactical guarding

- **High Y / heavy**: 11 HP (Runa: 14 HP), slower overhead attack that physically passes **over crouching** opponents, even if they are not guarding.
- **Middle B / kick**: 9 HP, hits both standing and crouching opponents.
- **Low X / quick light**: 5 HP, hits feet and exposes an incorrectly standing guard. Its temporary procedural attack pose also angles downward.
- **B+Y / R1 special**: special middle attack (20 HP; Runa: 23 HP), using its own longer wind-up and energy requirement.
- **Standing A** blocks high and middle strikes, but cannot block low. **Down+A** blocks middle and low strikes, while high strikes whiff overhead. These rules also work while retreating (back+down+A); guarding cannot advance or guard in midair.
- Correct blocks now negate damage completely, including heavy Y: the former 25% chip rule no longer applies. Improper guard height means a real hit, hitstun and interruption.
- The high, middle and low attacks each have a **different physical vertical hitbox** aligned to standing/crouching hurtboxes. Whiffed highs show **WHIFF!**; a low attack through a high guard shows **LOW HIT!**.
- CPU attempts low guard against low attacks and sometimes ducks a high attack. Shared defender rules apply identically to PvP and CPU.
- Combat-level regression tests cover the full three-level × three-stances block table and standing/crouching hitbox overlap, run automatically in `npm run build`.
- Earlier alpha sections below describe historical chip rules and should not be treated as the current combat behavior.

## Alpha 1.6.0 · Manual standing grabs and overhead throws

- **Standing only:** start a grab with **held A+X** (or L1 / keyboard G) while upright, grounded and close to the opponent. A crouched/down/up/rolling input cannot start a grab.
- **No automatic throw:** when the grab connects after its **0.32 s** reach, continue holding A+X/L1 and **pull the stick BACK, away from the opponent**. Either backward diagonal (back+up or back+down) performs the same overhead throw. The thrower stays standing: no jump or crouch is performed.
- A backward direction already held before the grip connects must be released and pressed again, so movement held during grab startup does not automatically throw.
- Releasing A+X/L1 cancels the grab. If no throw is performed, the defender escapes after **1.65 s**; the defender can still interrupt with A or X. Throws retain the existing 16 HP damage (21 for Runa), trajectory behind the attacker, fall and recovery.
- During an active grab, backward+down+A+X is interpreted as a **throw**, not the existing **roll**; outside a grab the roll continues to take priority. Touch X↔A swipe-held grips, keyboard, PvP and CPU inputs all use these rules.
- CPU now holds its grab and deliberately pulls backward after catching, sometimes adding an up/down diagonal. The attacker cannot jump or crouch during the throw.

## Alpha 1.5.0 · Ground rolls and evasive movement

- **Down + left/right + A + X** rolls in the chosen direction. On the touchscreen, hold a downward diagonal on the virtual stick and press X+A (including the existing one-finger X↔A swipe). The neutral X+A chord and L1 continue to grab.
- **Left/right + L2/LT** (standard gamepad button 6, including analog trigger activation) also rolls, with no need to press down.
- A roll lasts **0.46 s**, covering approximately **178 arena units** (Runa: 84% of that distance). It has vulnerable startup and recovery, and an invulnerable middle from **0.095 s to 0.31 s**. Hits during the vulnerable window interrupt the roll; attacks during evasion show **DODGE!** without dealing damage.
- A **0.88 s** cooldown (measured from starting the roll) and no attack/grab cancellations except a very early light-attack input keep this defensive move fair.
- Rolls can slip past opponents. Grabs cannot start while either fighter is already rolling; reaching grabs miss a rolling opponent. Both PvP players use identical inputs and mechanics.
- Uses a temporary procedural full-body somersault until pixel-art roll sprites arrive; no character art is permanently changed.

## Alpha 1.4.0 · Character stories and deliberate arena selection

- Tap a focused fighter in either carousel to read their **original story, weapon and combat style** in an accessible, fullscreen portrait dialog. Tap an adjacent fighter to select them. Tapping a fighter **never starts the match**.
- **Далі: арена** is the explicit way to leave fighter selection, and tapping the focused stage cannot launch combat. Use the **На арену!** button to confirm the stage.
- Changing fighters from the paused match menu now brings up the **arena selector**, instead of jumping straight into battle. Going back from the stage restores your selected fighters without modifying the paused game.
- CPU gamepad A or keyboard Enter on a focused carousel opens a biography; PvP maintains its separate Ready buttons. Escape and gamepad B close the modal.
- The existing vector art remains temporary until all original pixel-art models are ready.

## Alpha 1.3.0 · Runa, an original powerhouse concept

- Replaces the previous third-party-inspired fighter identity across selection, HUD, match defaults, gameplay IDs and title-screen copy.
- **Руна (Runa)** is a former defender of the **Мідний Бастіон / Copper Bastion**, a calm, stubborn protector. Her planned signature weapon for the pixel-art phase is a pair of **armored impact gauntlets**.
- Runa now plays differently: **20% slower** movement, a heavy strike for **14 HP** rather than 11 with a longer wind-up, special for **23 HP** rather than 20 with a longer wind-up, and successful throws for **21 HP** rather than 16. Standard interruptions, blocks and grab escapes remain in force.
- **Art has deliberately NOT been changed.** The existing vector figure, portrait and temporary weapon are placeholders. Every fighter will be redrawn in a coherent original pixel-art style later; the temporary visuals should not be presented as an independent final design.
- Available fighters: **ЕВІ · РУНА · ЛІРА · КАЙ**.

## Alpha 1.2.0 · Kai joins the four-fighter roster

- **КАЙ** joins Evi, Runa and Lyra: a silver-haired, electric-blue fighter with midnight armor, flowing energy ribbons and two energized tonfa batons.
- The fourth fighter has his own full-body vector figure, a bespoke 120×120 SVG portrait, and an actual Phaser combat model. Combat, throws, blocking, interrupts and KO all work in both player slots and CPU mode.
- Both simultaneous player-selection carousels derive their options from the shared four-character roster. Since the other player's highlighted character is excluded, **three legal choices remain per side**: center, previous and next. Swipes, keyboard, independent gamepad controls and PvP readiness keep working without extra image assets.
- CPU manual selection and random selection include Kai, and the match HUD displays his name, portrait and cyan health bar.

## Alpha 1.1.1 · Mirrored PvP ready buttons

The **✓ Готово P1** control is now anchored near the **left outside edge** of the P1 selection half, as indicated by the mobile screenshot; **✓ Готово P2** stays near the **right outside edge** of P2's half. The buttons no longer cover the center-aligned character names or subtitles. Small-screen CSS explicitly preserves the outer-edge placement and reserves room for the buttons.

## Alpha 1.1.0 · Simultaneous split-screen fighter selection

The full-screen character selection now follows the original two-fighter sketch:
**two equal side-by-side panels**, showing player 1 and their opponent at the same time. Each has its own full-body character carousel with bright center and smaller dimmed characters behind, reusing the same procedural SVG artwork and CSS transforms. Each half captures its own touch pointer, enabling **simultaneous swipes from two different fingers** with no event collision.

- In **local PvP**, player 1 and player 2 choose **in parallel**, each by swiping their own side of the display. The currently highlighted fighter is reserved immediately; the other carousel dynamically excludes it as soon as either player changes selection, so two players cannot select the same character, even briefly. Players individually press **Готово** to lock their picks (and may unlock to choose again). Once both are ready, **Далі: арена** becomes available.
- In **CPU mode**, the left carousel chooses the player fighter and the right one manually chooses the opponent. The right side additionally provides **🎲 Рандомний** to draw uniformly from all currently legal opponents (the player character is excluded). The next-step action starts with the displayed pair.
- **On-screen carousel arrows are removed** from character selection and arena selection. Both retain touch swiping, side-item taps, keyboard and gamepad support.
- **Keyboard:** player 1 uses A/D, player 2 uses Left/Right. F marks P1 ready, K marks P2 ready. Enter proceeds once ready. Esc goes back. Arena selection continues using Left/Right + Enter.
- **Gamepads:** controller 1's D-pad/left stick controls P1, controller 2's controls P2 independently; A on each marks that player's choice as ready, Start advances once ready, B goes back. With one pad, its right stick can navigate the right carousel while its D-pad/left stick handles the left.
- **Safety remains:** changing fighters from a paused match preserves the current arena. Returning without changing the pair preserves the paused round. Stage selection and the custom loss-of-progress confirmation remain intact.

## Alpha 1.0.0 · Fullscreen animated character and arena carousel

The two cramped selection windows are replaced with **true fullscreen arcade selection scenes**. All three fighters are displayed as **full-body procedural SVGs**, matching their current in-game color schemes and gear, instead of small headshot cards. The centered fighter appears at full brightness and size, while the previous/next fighters remain **behind at 76% scale, dimmed by a CSS filter**. Changing the selection smoothly animates the exact same three SVG elements across the screen, without loading additional duplicated images.

- **Touch:** swipe directly across the fighters to rotate the carousel (a tap on a side fighter brings them to the center, and a tap on the centered fighter confirms).
- **Keyboard:** left/right arrows rotate, Enter/Space confirms, Esc goes back.
- **Gamepad:** D-pad or left stick left/right rotates; **A** confirms, **B** goes back. Held directions repeat at a controlled speed rather than racing through the roster.
- **PvP:** first player chooses and confirms, then the second player chooses from the remaining fighters. The taken fighter is marked and cannot be confirmed again. Back returns from player 2 to player 1. CPU still chooses randomly from the other fighters; reselecting the unchanged character/opponent during an active round does not discard progress.
- **Arna selection:** the same fullscreen carousel approach now shows a large original CSS-rendered neon city or moonlit lagoon, with the inactive arena receding behind. Swipe, arrows, gamepad and click/confirm all work. No extra image files are created.
- The **pause/settings interface also fills the screen**, replacing its centered window. The user-requested small custom **loss-of-progress warning** remains deliberately separate for destructive actions, and all existing confirmation safety and reversible navigation rules remain intact.

## Alpha 0.9.4 · In-game confirmation before losing round progress

A custom, touch-friendly **unsaved progress** warning appears before **Рестарт**, **Змінити персонажа**, **Змінити арену** and **Вийти** in the fight menu. There is no browser `window.confirm()`. Each action has a specific warning that accurately describes what changes and what stays unchanged.

- **Скасувати** returns to the paused fight menu, preserving HP, meter, round time and current opponents.
- **Підтвердити** performs only the requested action. Changing fighters/stages still preserves the unchanged dimension, and backing out of either selection without a new choice leaves the current match intact.
- Game time, AI and fighter movement remain paused until the player resumes, and the warning blocks interaction with the underlying menu.
- **Escape / P / gamepad Start** cancels the warning. The quick shortcuts **R**, **1**, **2** also ask for confirmation when invoked in the middle of a fight.

## Alpha 0.9.3 · Universal menu close button

A prominent, touch-friendly **✕** in the top-right of the settings/pause panel closes it **from any tab**: when opened from the title screen, it returns to the title; when opened during battle, it resumes the paused match immediately. This avoids having to open the **Бій** tab just to continue playing. Existing Escape/P/Start shortcuts and character-select back navigation remain unchanged.

## Alpha 0.9.2 · Correct settings tabs and character-select navigation

- Opening **Налаштування** from the title screen shows **Керування**, **Графіка** and **Довідка**, with no **Бій** tab. These three tabs expand to fill the width. Opening the pause menu during a match restores all four tabs and its five battle actions.
- **Назад** is now visible in character selection at all times. In a new game it returns to the **title screen**, while choosing new fighters from a paused fight returns to the **fight's pause menu** without resetting the current match.
- Keyboard **Escape / P** follows the same back navigation when the character selector is open.

## Alpha 0.9.1 · Landscape title-screen layout and larger menu controls

- The main screen no longer uses a three-row grid that could push the game title off the top of short landscape displays. Title, subtitle and primary buttons now form one centered, height-aware column.
- The decorative background glow is clipped inside the screen; page-level horizontal and vertical scrollbars are disabled. The entire game frame stays fixed to the visible viewport in landscape.
- The three home-screen buttons now have larger, explicit spacing and comfortable minimum touch heights.
- Paused-game tab buttons, all five actions on the **Бій** tab, display options and control-settings actions have substantially larger tap areas. On exceptionally small viewports only the **pause panel's content** may scroll, never the title screen or full webpage.

## Alpha 0.9.0 · Title screen, three fighters, two arenas and tabbed pause menu

A complete game flow is now available:

1. **Title screen:** THE SPLASH OF FIGHTING with centered **Почати**, **Налаштування**, **На весь екран**. Settings opens the same tabbed controls/display menu without beginning a match.
2. **Character select:** choose one of **Evi**, **Runa** or the new fire-themed fighter **Lyra**, wearing a navy/gold outfit and carrying an amber fan blade. Portraits and the fight HUD support all three.
3. **Stage select:** choose **Неонове місто** or the new **Місячна лагуна**, a moonlit seaside arena with distant islands, stars, rippling water and shoreline lights.
4. **Fight:** the selected pair enters the chosen stage. CPU randomly selects from all other available roster members, and PvP forbids mirror matches.

During a fight, **☰ Меню** freezes all animation and combat. Settings are split into tabs:
- **Бій:** **Продовжити**, **Рестарт**, **Змінити персонажа**, **Змінити арену**, **Вийти**.
- **Керування:** independent joystick/ABXY scaling, draggable positions and reset.
- **Графіка:** hitbox display and fullscreen control.
- **Довідка:** controls and combat instructions.

Changing characters **restarts the round but keeps the current arena**. Confirming an unchanged pair returns to the pause menu without restarting. Changing arenas **restarts the round with the same fighters**; selecting the same arena doesn't restart. Restart preserves both fighters and arena. Exit returns to the title screen. A fresh title-screen start always proceeds through character and arena selection.

Both worlds share the same fighter physics, hitbox, counterattack and block rules. Lethal throws leave their victims down through the final result.

## Alpha 0.8.0 · Fighter portraits and character select

- **Character selection on launch:** no match timer or CPU logic runs until the player explicitly chooses a fighter and starts the match.
- A small, data-driven character roster in `src/characters/Roster.ts` currently offers **Evi** and **Runa**, each with an original stylized portrait. New characters can be added to the roster as their gameplay visuals and `FighterId` implementations become available.
- **CPU:** player 1 selects a fighter; the game picks a **uniform random** opponent from all remaining roster characters. The player's own character is excluded. With only two fighters available, the other is necessarily picked.
- **Local PvP:** player 1 chooses first, then player 2 chooses from the remaining fighters. Mirror matches are disabled; the same character cannot fill both slots.
- The chosen fighter may now occupy **either side** of the arena. Keyboard/gamepad/touch input follows the player slot, not the character's name. CPU always controls slot 2.
- Rounded fighter avatars appear adjacent to **both health and energy bars**, with labels and health-bar accents matching the chosen roster identities.
- From **☰ Меню**, use **Змінити бійців** to select a fresh pair; changing CPU/PvP mode also opens the selector. Restarting a round preserves the current matchup.
- **Lethal throws are permanent KOs**: a thrown fighter who reaches 0 HP lands on the ground and never enters the prone/rising recovery loop until a new round. Nonlethal throws still use 0.5 s prone + 0.5 s rising.

## Alpha 0.7.0 · Impact frames, counterattacks, permanent KO falls

**Damage timing:** Each punch, kick and special has one true impact at the **end of its strike animation**, not at the first frame of the wind-up. The target must still overlap the strike hitbox at that exact moment. Missing an attack consumes the impact (it cannot hit late during the follow-through). A 0.12 s non-damaging recovery follows.

- **X light punch:** 0.27 s to impact; **B kick:** 0.40 s; **Y heavy punch:** 0.48 s; **B+Y / R1 special:** 0.82 s.
- If an opponent's quick X connects before the heavy Y or special reaches its impact frame, hitstun **cancels the unfinished attack**, its damage never triggers, and **INTERRUPT!** appears over the fighter. The same rule works for both Evi and Runa.
- Successful blocking still uses the established tactical stance constraints, and a guarded Y still deals 25% chip damage.
- Defeat by depleted health starts a fall with an airborne tumble and ends in a **permanent prone KO pose**. Winner text appears once the loser actually lands.
- Time-out also causes the fighter with less HP to fall and remain down while the winner result is shown. Ties remain a draw.
- Existing throws retain the temporary 0.5 s prone + 0.5 s get-up behavior when nonlethal; lethal throws end in the same permanent KO pose.

## Alpha 0.6.0 · Edge-to-edge arena and custom mobile controls

The arena now fills the **entire landscape screen**, even on extra-wide phones. Phaser renders a wider logical viewport around the unchanged central world rather than stretching fighter artwork or cropping the HP HUD. Ground, city skyline and combat bounds extend into the additional space; health/energy bars stay anchored at the outer edges. Fullscreen and orientation changes resize the view.

In **☰ Меню → 🎛️ Сенсорне керування**:
- Set the joystick and ABXY diamond **scales independently** (65–160%).
- Select **✥ Перемістити на екрані**, then drag the joystick and **entire ABXY diamond together**, while combat stays paused. Use **✓ Готово** to return to the pause menu.
- **↺ Скинути** restores reasonable default positions and scales. Dragging cannot push a control entirely off-screen.
- Positions use proportional coordinates and are stored in localStorage, so they survive reloading and adjust to screen size. The game is paused for the whole layout-editing session; no accidental attacks are sent.

## Alpha 0.5.0 · Single-screen pause menu

The whole game now fits on one 16:9 screen. A centered **☰ Меню** button inside the arena opens a glass-like overlay for **CPU / 2 players**, hitbox debugging, full-screen toggle, new round and an expandable controls guide. There is no longer a separate toolbar, controls text or footer below the stage.

Opening the menu **pauses the Phaser Arena scene**. Gameplay, round time, AI, animations and tweens stop completely, and held touch / keyboard states are cleared so no attack or movement leaks through the menu. Press **▶ Продовжити**, **Escape**, **P**, or **Start** (gamepad) to resume. Switching modes or restarting also resumes. Switching away from the tab pauses automatically.

Phone landscape layout uses the full available viewport height for the game and menu. Controls and the menu work from inside the game frame even in fullscreen.

## Alpha 0.4.1 · L1 throw and grounded recovery

- **L1 / LB (button 4)** now starts a grab directly; **X+A**, the one-finger swipe **X↔A**, **G** and **Numpad3** remain available. Gamepad jump stays on **up** with the stick or D-pad, while keyboard Space/Numpad0 still jump.
- A completed throw launches the opponent **behind the thrower**, farther than before, with a visible rotating tumble in flight.
- **After landing:** the thrown fighter lies prone for **0.5 s**, then spends another **0.5 s** standing back up. They cannot move, block, attack, or start a new grab during either knockdown or recovery.
- Downed fighters cannot be struck or grabbed mid-recovery. A throw knockout completes the falling animation before announcing the winner.
- The defender can still interrupt the *grab attempt* or *hold* with **A** or **X** before the throw is executed.

## Alpha 0.4.0 · Two-stage grapples and throws

**New grapple:** press **X+A** together (or swipe from X into A, or from A into X, on mobile). Optional keyboard shortcuts: **G** for player 1, **Numpad3** for player 2. The input is universal for the gamepad and touchscreen without adding another on-screen button.

This is intentionally **slow and counterable**:

1. **Reach / grab attempt** (0.32 seconds): start within 135 world pixels of a grounded opponent. They can move out of the 90-pixel catch radius, hold **A** to interrupt, or press **X** for a quick counter.
2. **Hold / throw preparation** (0.62 seconds): both fighters are locked close together; defender may still press **A** to break free or **X** to interrupt with a quick counter. If neither reacts, the attacker throws for **16 HP**, plus knockback and a short airborne knockdown.

A successful defensive X counter damages the attacker for 3 HP. Failed grabs leave the attacker open briefly. The CPU can attempt grabs and occasionally break free. The debug hitbox overlay also shows grab reach.

Existing tactical guarding rules remain: valid blocking requires standing still, retreating or retreating while crouched; heavy Y still deals 25% chip damage on a successful guard. **Inside a grapple**, pressing A or X is a dedicated escape action.

## Alpha 0.3.2 · Tactical guard and heavy chip damage

Hold **A** to guard only while **standing still on the ground**, **retreating backward**, or **holding backward + down to crouch**. Backward is relative to the opponent, including when the fighters switch sides. Guard does not work while approaching, jumping, crouching without backward, stunned, or committed to a special. Guarding can cancel an ordinary attack.

Guard absorbs **100%** of X, B and special attacks, but **75%** of a heavy Y attack. Heavy Y deals 11 HP normally, so its exact guarded chip damage is **2.75 HP**. Defensive retreat is slower; the CPU obeys the same directional restrictions.

## Alpha 0.3.1 · Guard and one-finger B+Y

- Holding **A** guards on the ground, while walking and in the air. Guarding interrupts a regular punch or kick, but cannot be activated during hitstun or a committed special move.
- Guarding absorbs **100% of normal damage** and shows a turquoise shield. Movement while guarding is slower; crouching guard works with down+A.
- Swipe **from B into Y**, or **from Y into B**, while maintaining one finger on the screen. This triggers the same special as simultaneous B+Y with two fingers (or R1 on a gamepad), without adding a fifth button.
- The B+Y special buffer is extended for swipe recognition and can cancel an ongoing B or Y normal attack. A special requires at least 40 energy.

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
| Grab | G or J+H (X+A) | Numpad3 or Num1+Num5 | X+A (buttons 2+0) |
| Light attack (X) | J | Numpad 1 | X (button 2) |
| Heavy attack (Y) | K | Numpad 2 | Y (button 3) |
| Kick (B) | L | Numpad 4 | B (button 1) |
| Guard (A) | Hold H | Hold Numpad 5 | Hold A (button 0) |
| Special | K+L or I | Numpad 2+4 or Numpad 6 | B+Y or R1/RB (button 5) |

On touchscreens, move the virtual joystick and tap the **ABXY** diamond simultaneously. Press **B+Y** with two fingers for a special. Play in landscape orientation.
Press **1** for CPU opponent, **2** for local versus, **R** to restart. Toggle hitbox debug using the pause menu (keyboard H remains the block key for player one).

## Features in the first milestone

- A playable arena with two **procedural stand-in fighters** (not yet sprites from the reference images).
- Fixed-time-step combat, basic hitboxes, hitstun, blocking, four attacks and special energy.
- Keyboard, Gamepad API and multi-touch on-screen controls.
- Round timer, health bars, victory state and optional hitbox visualisation.
- GitHub Actions workflow for Vite build + GitHub Pages deployment.

## Sprites / assets (planned)

Reference images will be used to produce **original** pixel sprites later. Keep source PNGs and frame atlases under `public/assets/fighters/{evi,runa}/`. Animation metadata should be defined separately from collision boxes and attack frame data.

## GitHub Pages

1. In **Settings → Pages → Build and deployment**, set **Source: GitHub Actions**.
2. Push to `main` (workflow `.github/workflows/deploy.yml`).
3. Site URL (once enabled): https://pylserg.github.io/the-splash-of-fighting/

Vite `base` is configured for the repository subpath. **Note:** GitHub Free Pages generally requires a public repository; private Pages availability depends on plan and settings. Publishing a Pages website makes the site publicly reachable.

This is a gameplay prototype: no online multiplayer or finished sprite atlases yet.
