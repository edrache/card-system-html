export const ANIM = {
  liftScale: 1.15,           // scale factor when card is picked up (1.0 = no change)
  tiltMax: 40,               // maximum rotation in degrees during drag
  tiltVelocityScale: 130,     // higher value = less sensitive tilt (px of drag per full tilt)
  snapDuration: 0.05,        // duration of snap-to-slot/card animation in seconds
  snapEase: 'sine.in',       // easing for snap animation (GSAP easing string)
  liftDuration: 0.55,        // duration of lift and drop animations in seconds
  liftEase: 'elastic.out',         // easing when picking up a card
  dropEase: 'power3.in',     // easing when card falls back down after a click
  slotSnapRadius: 100,        // distance in px at which a card snaps to a slot
  cardSnapRadius: 100,        // distance in px at which a card snaps to another card
  wiggleAngle: 2,            // max rotation angle in degrees during hover wiggle
  wiggleCount: 1,            // number of back-and-forth oscillations in the wiggle
  wiggleDuration: 0.03,      // duration of a single wiggle step in seconds
  wiggleEase: 'sine.inOut',  // easing for each wiggle step (GSAP easing string)
  resolveFlashDuration: 0.45, // reveal duration for a single combat result
  resolvePauseDuration: 0.22, // short settle time before Continue becomes active
  resolveTiltAngle: 30,       // destroyed cards lean to make the loss readable
  cleanupDuration: 0.55,      // board-to-hand / refill transition duration
  flavorTypeSpeed: 20,        // ms per character for slot flavor text typing animation
}
