# TPS Signature Theme: Sleek Architect & Sovereign Halftone Ribbon

This document outlines the design system, color guidelines, spatial structure, and core assets that compose the premium **Sovereign Halftone & Wavy Ribbon** theme for the **Ta'ang Population System (TPS)**, administered by the **Immigration Department of Ta'ang Land (IDTL)**.

---

## 🎨 1. Core Color System

The system adheres strictly to a clean, high-contrast, technical grayscale palette. This conveys a high-end "architectural blueprint" look that guarantees readability, authoritative weight, and official prestige.

| CSS Variable | Color Value | Description / Usage |
| :--- | :--- | :--- |
| `--n-bg` | `#FFFFFF` | Core application and card background. |
| `--n-sidebar` | `#FAFAFA` | Off-white background for sidebars and top bars. |
| `--n-text` | `#1A1A1A` | Main technical text and title colors. |
| `--n-text-2` | `#737373` | Sub-titles, labels, placeholders, and neutral descriptors. |
| `--n-border` | `#E5E7EB` | Fine lines separating tables, grid panels, and inputs. |
| `--n-hover` | `#F3F4F6` | Interactive hover states on secondary buttons and items. |
| `--n-active` | `#E5E7EB` | Clicked/active button states. |
| `--n-accent` | `#000000` | Solid black accent for dominant system actions. |
| `--n-accent-bg` | `#F3F4F6` | Background shading behind active pills or badges. |

---

## 📐 2. Geometry & Spatial Rules

To reinforce the **Architect** aesthetic, the theme avoids circular pill layouts or heavy soft dropshadows in favor of sharp, technical lines.

- **Border Radii**: 
  - `var(--radius)`: `0px` (Sharp-corner styling for forms, panels, buttons, and badges).
  - `var(--radius-sm)`: `0px`
- **Shadows**:
  - `var(--shadow)` to `var(--shadow-lg)`: `none` (Relies on crisp, solid `1px` borders instead of atmospheric blurs, which avoids visual noise on crowded data tables).
- **Typography Hierarchy**:
  - **Headlines & Body**: `Inter` font family (optimized with `MyanmarCustom` for native Myanmar script).
  - **Technical Values**: `JetBrains Mono` for tabular figures, population statistics, weekly tokens, and NRC card numbers to ensure uniform tabular layout.

---

## 🌊 3. Signature Theme Background (`src/assets/theme-bg.svg`)

The central branding asset is a programmatically generated, lightweight vector SVG (`src/assets/theme-bg.svg`). It combines technical particle arrays and fluid security ribbon wave geometries:

1. **Halftone Dot Matrix Dispersion**:
   - Centered radially at `(72% Width, 38% Height)` on the canvas.
   - The dot radii and opacities fade smoothly according to distance, creating a high-tech dispersion effect that sits elegantly in the upper-right region of pages.
2. **Slate Parallel Ribbon**:
   - An array of 18 fine, mathematically parallel lines following a multi-frequency wave path:
     `y = height * 0.74 + (sin(u * 1.7) * 115 + cos(u * 2.6) * 35) * edgeFade + offsetY`
   - Rendered in slate gray (`#1f2937` to `#737373`) to act as the primary structural design.
3. **White Highlight Sweeps**:
   - 10 parallel white lines (`#ffffff`) flowing underneath the slate ribbon to create a high-contrast glowing contour.
4. **Architectural Radial Backdrop**:
   - A soft background gradient in the SVG transitioning from pure white (`#ffffff`) at the halftone focus center to light gray (`#f3f4f6`) at the boundaries, ensuring layout elements merge smoothly into the backdrop.

---

## 📱 4. Mobile Responsive & Layout Rules

To prevent the background from collapsing into a narrow horizontal strip on portrait screens, specific responsive overrides are applied in `src/index.css`:

```css
body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  width: 100%;
  background-color: var(--n-bg);
  background-image: url('./assets/theme-bg.svg');
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover; /* Guarantees full-screen viewport coverage without white gaps */
  background-attachment: fixed; /* Keeps the background stationary on scroll */
}

@media (max-width: 767px) {
  body {
    background-position: 70% center; /* Portrait focus-shifting: moves the halftone matrix to the center of mobile screens */
  }
}
```

---

## ✨ 5. Purposeful Micro-Animations

Animations are engineered to be extremely fast and responsive, following professional interaction design guidelines:

- **Page Entrance (`.tps-page-enter`)**:
  - `animation: tps-page-in 160ms var(--ease-out) both;`
  - A fast fade and subtle `6px` vertical slide-in to feel instant but smooth.
- **Button Click State (`button:active`)**:
  - `transform: scale(0.97);`
  - Fast visual feedback upon press.
- **Easing Curves**:
  - `var(--ease-out)`: `cubic-bezier(0.23, 1, 0.32, 1)` (Strong deceleration for elements arriving on-screen).
  - `var(--ease-panel)`: `cubic-bezier(0.32, 0.72, 0, 1)` (iOS-style friction curve for mobile sheets and menus).
