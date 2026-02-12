# Background Animation Spec

## 1) Conceptual Foundation

This app is not an accounting ledger. It is a personal/professional instrument for agency.

Core idea:
- Time is alive, continuous, and directional.
- The screen should never feel dead-static.
- Motion should quietly remind the user: life is moving, your attention has value, choose deliberately.

Desired emotional tone:
- Calm, intentional, premium.
- Present but non-distracting.
- Never frantic, never gamified, never nagging.

---

## 2) Why Animation Matters Here

The ambient motion is not decorative filler. It is narrative infrastructure.

It reinforces:
- Personal agency: you are actively shaping where your time goes.
- Temporal awareness: moments are passing whether or not they are tracked.
- Signal over noise: the interface stays pared back while still feeling alive.

If motion disappears, the experience collapses toward “static spreadsheet.”

---

## 3) Visual Language

Design references:
- Cursor.com: clean, modern, high-polish minimal.
- Raycast: subtle depth, premium restraint.

Animation characteristics:
- Soft atmospheric color masses (green/blue/warm neutral family).
- Very low-frequency drift across large areas.
- Gentle pulse via scale/position, not flashing opacity.
- Diffused edges (blurred), no hard geometric blocks in final mode.

What to avoid:
- Strobe/flicker.
- Obvious loop seams.
- High-contrast movement that competes with content.
- Motion that reads as loading or error.

---

## 4) Intended Motion Behavior

### Baseline behavior
- Always-on ambient movement behind content.
- Continuous drift in X/Y with long cycles (20s-60s+).
- Minimal amplitude on production settings; higher amplitude allowed for debug mode.

### Layer behavior
- 2-3 large blurred gradient fields.
- Slightly different speeds/phases so motion feels organic.
- Optional subtle blend-mode interaction to create living color overlap.

### Intensity
- Production: subtle enough to read as “breathing room.”
- Debug: intentionally obvious to confirm runtime movement and rendering path.

---

## 5) Technical Approach (Target)

Single-source motion system:
- One dedicated ambient component controls all moving layers.
- Avoid multiple independent ambient systems running in parallel (prevents visual cancellation/conflicts).

Implementation model:
- Runtime transform updates (e.g., `requestAnimationFrame`) on a few large layers.
- Animate `transform` primarily (`translate3d`, slight `scale`, slight `rotate`).
- Keep opacity mostly stable to avoid perceived flicker.
- Place ambient stack below all interactive content with predictable z-index.

Diagnostics model:
- Include a temporary motion probe (small visible marker) tied to the same animation loop.
- If probe moves and ambient does not read as moving, issue is visual tuning.
- If probe does not move, issue is runtime execution/rendering path.

---

## 6) Accessibility + Performance Rules

- Respect `prefers-reduced-motion`: reduce amplitude/speed or disable non-essential movement.
- Maintain text contrast and legibility at all times.
- Motion must not interfere with tapping, scrolling, or editing.
- Avoid heavy repaints (limit number of moving layers; use transform-based motion).

---

## 7) Product Fit Criteria (Definition of Done)

Animation is successful when:
1. User can immediately perceive that background is alive.
2. Motion feels calming and premium, not gimmicky.
3. Primary tasks (quick add, week edits, calendar approvals) stay visually dominant.
4. Mobile and desktop both show clear but tasteful movement.
5. No flicker/seizure-like behavior under normal use.

---

## 8) Iteration Strategy

1. Prove movement with obvious debug mode.
2. Validate user can see movement reliably on target device/browser.
3. Reduce intensity in controlled increments to "subtle but unmistakable."
4. Keep a toggle/constant for debug intensity so regressions are easy to test later.

---

## 9) Implementation Log (2026-02-11)

### What We Tried

**Attempt 1: CSS animations on body + JS AmbientMotion component**
- Problem: Two competing animation systems cancelled each other out visually
- Body had `canvasDrift` keyframe animation, AmbientMotion had requestAnimationFrame
- Layers used `mixBlendMode: "multiply"` which made them invisible on light backgrounds

**Attempt 2: Removed body animation, fixed blend mode, increased opacity**
- Removed multiply blend mode
- Bumped opacity to 0.5-0.7
- Result: Still not visible

**Attempt 3: Solid color debug circles (no blur, no gradient)**
- Used solid #22c55e, #3b82f6, #f59e0b
- High opacity (0.6-0.8), no blur
- Result: Finally visible! Confirmed rendering pipeline works

**Attempt 4: Bouncing orbs with blur and pulsing opacity**
- Added velocity-based bouncing off screen edges
- Gaussian blur 50-60px
- Subtle opacity pulsing
- Result: Too subtle, user couldn't perceive movement

**Attempt 5: Atmospheric drift with scale breathing**
- Large gradient fields (65-80vw)
- Compound sine waves for organic motion
- Scale breathing (1.0-1.15)
- Gentle rotation
- Blur 35-45px
- Result: Still too subtle

### Core Problem Identified

The blur + gradient + low contrast approach consistently fails to create perceivable motion. Even with:
- Large movement amplitude (18-22vw)
- Scale changes (15%)
- Rotation
- Higher opacity (0.4-0.5)

The visual effect remains imperceptible or barely noticeable.

### Questions to Resolve

1. Is blur fundamentally incompatible with perceivable motion at this scale?
2. Do we need sharper edges or more defined shapes to see movement?
3. Should we try a completely different approach (CSS gradients, canvas, SVG)?
4. Are the reference sites (Cursor, Raycast) using a different technique entirely?
5. Does the light canvas background (#f5f6f3) wash out everything?

### Next Steps to Consider

- Study Cursor.com and Raycast implementations in browser devtools
- Try reduced blur (10-20px) with more defined color regions
- Consider darker/richer canvas background to increase contrast
- Try animated SVG or canvas-based approach
- Test on multiple devices - maybe it's visible on some screens but not others

