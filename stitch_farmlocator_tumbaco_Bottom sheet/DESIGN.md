# Design System Document: The Clinical Precision Framework

## 1. Overview & Creative North Star
**Creative North Star: "The Architectural Map"**
This design system moves beyond the "app-like" aesthetic to embrace an editorial, architectural approach to medical utility. In the context of FarmLocator Tumbaco, we are not just building a directory; we are creating a high-trust, high-clarity navigation tool. 

The framework rejects "default" UI behaviors. Instead of a flat grid of buttons, we utilize **Intentional Asymmetry** and **Tonal Depth**. By removing images entirely, the design relies on the rhythmic tension of typography and the physical layering of surfaces. It is a "Living Map" where information is revealed through movement and elevation, rather than static containers.

---

## 2. Colors: Tonal Architecture
The palette is built on a sophisticated range of greys and medical-grade accents. We use color not as decoration, but as a functional beacon.

### Core Tokens
*   **Surface Base (`surface`):** `#fbf9f8` — A warm, clinical off-white that prevents screen glare.
*   **Primary Action (`primary`):** `#005dac` — A deep, authoritative blue for primary navigation and critical paths.
*   **Urgency & Medical (`tertiary`):** `#b7181f` — Used exclusively for pharmacy markers and emergency states.
*   **Accessibility Action (`secondary`):** `#006d2f` — Reserved for WhatsApp integrations and "Open Now" status indicators.

### The "No-Line" Rule
**Explicit Instruction:** Traditional 1px solid borders are strictly prohibited for defining sections. 
Boundaries must be defined solely through:
1.  **Background Shifts:** Place a `surface-container-low` component on a `surface` background.
2.  **Negative Space:** Use the Spacing Scale to create "gutters" of air that act as invisible dividers.

### The Glass & Gradient Rule
To elevate the "Minimalist" requirement into a "Premium" experience, floating UI elements (like the Bottom Sheet handle area) should utilize **Glassmorphism**. Use `surface` at 80% opacity with a `20px` backdrop blur. This allows the map colors to bleed through, ensuring the UI feels like a transparent overlay on the physical world.

---

## 3. Typography: Editorial Utility
We pair **Manrope** (Display/Headline) for its geometric, modern authority with **Public Sans** (Body/Labels) for its exceptional legibility in high-stress medical contexts.

*   **Display-LG (Manrope, 3.5rem):** Used for large distance indicators (e.g., "500m").
*   **Headline-SM (Manrope, 1.5rem):** Pharmacy names. High weight, low tracking.
*   **Body-LG (Public Sans, 1rem):** Address details and opening hours. 
*   **Label-MD (Public Sans, 0.75rem):** Status tags (e.g., "OPEN 24/7"). Always Uppercase with +5% letter spacing for a "technical" feel.

---

## 4. Elevation & Depth: The Layering Principle
Hierarchy is achieved through **Tonal Layering**, mimicking stacked sheets of fine medical paper.

*   **Stacking:** 
    *   Level 0: Map Interface.
    *   Level 1: `surface-container-low` (The background for the search bar).
    *   Level 2: `surface-container-highest` (The Bottom Sheet or active Pharmacy card).
*   **Ambient Shadows:** For floating action buttons, use a shadow with a 24px blur, 0px offset, and 6% opacity of the `on-surface` color. It should feel like a soft glow of depth, not a harsh drop-shadow.
*   **Ghost Borders:** In high-density lists where contrast is critical for WCAG 2.2, use a "Ghost Border": the `outline-variant` token at **15% opacity**.

---

## 5. Components

### Circular Floating Buttons (FAB)
*   **Styling:** Perfect circles, `xl` roundedness. 
*   **Specs:** 56x56px minimum (surpassing the 44px requirement).
*   **Interaction:** On-tap, the button scales to 0.95x to provide tactile feedback without needing a color change.
*   **Color:** Use `primary_container` for secondary actions and `primary` for the main "Locate Me" function.

### Bottom Sheets & Drag Handles
*   **The Handle:** 32x4px, `full` roundedness. Color: `outline-variant`.
*   **The Surface:** Top corners use `xl` (3rem) roundedness to create a friendly, organic feel.
*   **Behavior:** Use "Elastic Snap"—the sheet should feel weighted, snapping to 40% or 95% of screen height.

### Map Markers (The Medical Pin)
*   **Geometry:** A sharp-bottomed teardrop with a white cross (Swiss-style) in the center.
*   **Color:** `tertiary` (#b7181f).
*   **Scale:** Active markers grow by 20% in size and gain an `ambient shadow` to appear closer to the user.

### Inputs & Search
*   **Visuals:** No bottom line. Use `surface-container-high` as a solid fill with `sm` (0.5rem) corners.
*   **Focus:** The border transitions to a 2px `primary` stroke only upon interaction.

### Cards & Lists
*   **Forbidden:** Horizontal dividers.
*   **Solution:** Use a 24px vertical gap between list items. Each pharmacy "item" sits on a `surface-container-low` background that turns to `surface-container-highest` on hover or touch.

---

## 6. Do's and Don'ts

### Do
*   **Do** prioritize touch targets. Every interactive element must have a 44px x 44px hit area, even if the visual icon is smaller.
*   **Do** use "Breathing Room." If the layout feels crowded, increase the `surface` spacing rather than adding a line.
*   **Do** ensure a 4.5:1 contrast ratio for all text against its specific surface-container tier.

### Don't
*   **Don't** use images or icons with fills. Use "Outlined" stroke icons (1.5pt weight) to maintain the minimalist architectural aesthetic.
*   **Don't** use pure black (#000). Use `on-surface` (#1b1c1c) to maintain a premium, ink-on-paper look.
*   **Don't** use standard "Blue" links. Use `primary` text with a 15% opacity `primary` underline to signify interactivity.