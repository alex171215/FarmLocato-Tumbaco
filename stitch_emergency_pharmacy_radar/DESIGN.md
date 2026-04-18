# Design System Document: The Vital Canvas

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Vital Canvas**. 

In medical emergencies, cognitive load must be zero. This system moves beyond the "standard app" aesthetic by adopting a high-end editorial approach. We treat information as architecture. By utilizing aggressive typography scales, intentional asymmetry, and "Zero-Click Discovery" layouts, we ensure that the user’s eye is immediately pulled to the most critical data—the location and status of life-saving medicine. This is not a utility; it is a clinical instrument wrapped in a premium, minimalist aesthetic. 

We break the "template" look by avoiding traditional grids in favor of a layered, tonal hierarchy that feels like a physical, high-quality medical report.

---

## 2. Colors
Our palette is rooted in a high-contrast grayscale for the environment, allowing our functional colors to serve as "beacons."

*   **Primary (`#bc0100`)**: Reserved exclusively for "Traffic Red" emergency pins and critical alerts.
*   **Secondary (`#0058bc`)**: Used for navigation and primary informational actions.
*   **Tertiary (`#006b27`)**: Used for "Open" status or successful discovery.

### The "No-Line" Rule
To achieve a signature, high-end feel, **this design system prohibits the use of 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` card should sit on a `surface` background. If you need to separate content, use white space or a change in tonal value, never a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to create depth:
1.  **Background (`#fcf9f8`)**: The base layer.
2.  **Surface Container Low**: For large secondary sections.
3.  **Surface Container High**: For interactive elements like cards or search bars.
4.  **Surface Container Highest**: For elements that require immediate focus.

### The "Glass & Gradient" Rule
Floating elements (such as map controls or bottom sheets) must use **Glassmorphism**. Apply a semi-transparent `surface` color with a `backdrop-filter: blur(20px)`. To add "soul" to the primary actions, use a subtle vertical gradient transitioning from `primary` to `primary_container` for hero buttons.

---

## 3. Typography
We utilize **Inter** to bridge the gap between technical precision and editorial elegance.

*   **Display Scales (`display-lg` to `display-sm`)**: Used for "Zero-Click" data points, such as the distance to a pharmacy (e.g., "0.4km"). These should be set with tight letter-spacing (-0.02em).
*   **Headline & Title**: Used for pharmacy names and status headers. These provide the structural anchor of the page.
*   **Body & Labels**: Focused on WCAG 2.2 accessibility. `label-md` is used for metadata (e.g., "Last updated 2m ago") and must always maintain high contrast against its container.

The hierarchy is "Top-Heavy": Large display sizes for the "What" (Pharmacy) and "Where" (Distance), with significantly smaller, high-contrast labels for the "How" (Directions).

---

## 4. Elevation & Depth
In this system, depth is achieved through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle**: Stack containers of different surface values. A `surface-container-lowest` card placed on a `surface-container-low` section creates a soft, natural lift that feels integrated into the UI.
*   **Ambient Shadows**: If an element must "float" (e.g., a critical emergency button), use a shadow with a 24px blur, 0px offset, and 6% opacity. The shadow color must be a tinted version of `on-surface`, never pure black.
*   **The "Ghost Border" Fallback**: If a border is required for accessibility, it must be a "Ghost Border"—the `outline-variant` token at 15% opacity. Full-opacity borders are strictly forbidden.
*   **Glassmorphism**: Use for map overlays. This allows the medical "radar" map to bleed through the UI, ensuring the user never loses their sense of place.

---

## 5. Components

### Buttons
*   **Primary**: Solid `primary` or `secondary` fill. No border. 44px height minimum. 12px (`xl`) corner radius.
*   **Secondary**: `surface-container-high` fill with `on-surface` text.
*   **States**: On hover/active, increase the tonal value of the background by 10%.

### Emergency Pins
*   **Visual**: A 40px circle of `primary` red with a white cross icon.
*   **Signature Detail**: Use a 10% opacity `primary` pulse animation radiating from the pin to indicate "Live" data.

### Cards & Lists
*   **No Dividers**: Forbid 1px divider lines. Separate list items using 12px of vertical white space or alternating `surface-container-low` and `surface-container-lowest` backgrounds.
*   **Asymmetry**: Align text to the left, but place "Action" metadata (like "OPEN NOW") in a high-contrast `tertiary` chip in the top-right corner to break the grid.

### Radar Map (The Signature Component)
*   The map should be grayscale with high-contrast labels. 
*   **Focus Ring**: A subtle, semi-transparent circle radiating from the user's location to indicate the "search radius."

### Input Fields
*   **Style**: No bottom line or box. Use `surface-container-highest` with a 4px (`md`) radius.
*   **Labeling**: Place labels inside the field as `label-sm` to save vertical space.

---

## 6. Do's and Don'ts

### Do
*   **Do** prioritize the "Primary Action" (Call or Route) with the largest touch targets (48px+).
*   **Do** use extreme contrast for text—ensure all body copy exceeds a 7:1 contrast ratio.
*   **Do** embrace negative space; let the distance between elements define the grouping.

### Don't
*   **Don't** use icons as purely decorative elements. If an icon doesn't assist in discovery, remove it.
*   **Don't** use 100% black (#000000). Use `inverse_surface` (#313030) for dark modes to maintain a premium, ink-like feel.
*   **Don't** use standard "drop shadows." If it looks like a default software shadow, it is too heavy.