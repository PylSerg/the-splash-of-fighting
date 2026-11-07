/** Arena art and fighter placement are deliberately different layers.
 * The painted rear lip of the 2.5D platform is NOT where fighters stand.
 * Their feet belong a short distance inside the visible foreground floor.
 *
 * Layout only: combat hitboxes still use Fighter.GROUND_Y and all existing
 * attack ranges/timings stay unchanged relative to each fighter's feet.
 */
export const STAGE_FLOOR_BACK_EDGE_Y=443;
export const FIGHTER_GROUND_Y=470;
export const FIGHTER_VISUAL_SCALE=1.12;

/** How far toward the viewer the feet sit beyond the platform's rear edge. */
export const FIGHTER_FLOOR_DEPTH=FIGHTER_GROUND_Y-STAGE_FLOOR_BACK_EDGE_Y;
