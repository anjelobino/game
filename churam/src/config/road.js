// Editable road description. Change values here – vehicle physics never reads this file directly.
export const ROAD_CONFIG = {
  halfWidth: 4,            // road is 8 m wide
  shoulder: 0.6,
  barrierOffset: 0.45,     // barrier plane = halfWidth + offset
  sampleSpacing: 2,
  hairpinRadius: 20,
  hairpinGrade: 0.058,     // steeper climbing slope through hairpins
  climbGrade: 0.075,       // mountain climb grade
  legLengths: [110, 125, 95, 130, 115, 100, 125, 105], // straights between the 9 hairpins
  leadIn: 70,
  wobble: 0.12,            // natural serpentine winding curves along the mountain face
  maxBank: 0.16,           // steep banking slope on hairpins (inward cross-slope)
  bankK: 3.0,              // fast, smooth curve banking transition
  lane: 2.0,               // lane centre offset (India: drive on the left)
  bench: 11,               // flat terrain width around the road
  seed: 11,
  viewpoint: { length: 70, depth: 13, taper: 14 },
};
export const HAIRPIN_COUNT = 9;
