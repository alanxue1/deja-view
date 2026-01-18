# Deja View

A production-quality hackathon project for experiencing rooms in 3D before you visit.

## Stack

- **Next.js 14** (App Router) + React + TypeScript
- **Tailwind CSS** + Custom CSS design tokens
- **Framer Motion** for animations
- **Three.js** for 3D rendering (raw Three.js, no R3F)
- Custom cursor and smooth scrolling effects

## Run Locally

1. Install dependencies:
```bash
npm install
```

2. Set up Clerk authentication. Create `.env.local` in the project root with:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```
Get your keys from [Clerk Dashboard](https://dashboard.clerk.com) → API Keys.  
Optional: set `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/loading` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/loading` to send users to the loading page after sign-in.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/app
  layout.tsx          # Root layout with fonts and global providers
  page.tsx            # Landing page
  globals.css         # Imports global styles
  /room
    page.tsx          # Room viewer page

/components
  /layout
    NavBar.tsx        # Top navigation bar
    FooterHints.tsx   # Bottom hint row
  /ui
    Button.tsx        # Button component (primary/soft/ghost variants)
    Card.tsx          # Card container component
    Container.tsx     # Responsive container component
    Divider.tsx       # Horizontal/vertical divider
    Text.tsx          # Typography component
  /effects
    CustomCursor.tsx  # Custom cursor (desktop only)
    SmoothScroll.tsx  # Smooth scroll wrapper
  /three
    RoomPreview.tsx   # Three.js room preview component

/lib
  cn.ts               # className utility (clsx + tailwind-merge)
  motion.ts           # Framer Motion helpers
  device.ts           # Device detection utilities
  /three
    init.ts           # Three.js scene initialization
    controls.ts       # Orbit controls for camera
    resize.ts         # Resize handler

/styles
  globals.css         # Global styles + Tailwind imports
  tokens.css          # CSS design tokens (colors, radius, shadows)
```

## Design Tokens

The project uses CSS custom properties defined in `/styles/tokens.css`:

- **Colors**: `--bg`, `--ink`, `--muted`, `--accent`, `--sage`, `--border`
- **Border Radius**: `--radius-card` (16px), `--radius-pill` (999px)
- **Shadows**: `--shadow-soft`

These are referenced in Tailwind classes using arbitrary values: `bg-[var(--bg)]`, `rounded-card`, etc.

## Fonts

- **Serif (Headlines)**: Playfair Display via `next/font/google`
- **Sans (Body)**: Inter via `next/font/google`

Fonts are set up in `app/layout.tsx` and applied via CSS variables.

## Adding a New Page

1. Create a new file in `/app` directory:
   - For `/about`: create `/app/about/page.tsx`
   - For nested routes: create `/app/about/team/page.tsx`

2. Use the shared components:
   ```tsx
   import Container from "@/components/ui/Container";
   import NavBar from "@/components/layout/NavBar";
   ```

3. Follow the existing patterns for layout and styling.

## Adding a GLB Model to Room Preview

To replace the placeholder geometry with a GLB model:

1. Add your GLB file to `/public/models/` (e.g., `room.glb`)

2. Update `/components/three/RoomPreview.tsx`:

```tsx
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// In the useEffect:
const loader = new GLTFLoader();
loader.load("/models/room.glb", (gltf) => {
  const model = gltf.scene;
  scene.scene.add(model);
  
  // Center and scale the model
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 4 / maxDim;
  
  model.scale.multiplyScalar(scale);
  model.position.sub(center.multiplyScalar(scale));
}, undefined, (error) => {
  console.error("Error loading GLB:", error);
});
```

3. Make sure to dispose of the loaded model in cleanup:
```tsx
// In cleanup:
if (model) {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
```

## Features

### Custom Cursor
- Desktop-only custom cursor with outer ring and inner dot
- Automatically disabled on touch devices and when `prefers-reduced-motion` is enabled
- Hover effects on elements with `data-cursor="hover"` attribute

### Smooth Scrolling
- RequestAnimationFrame-based smooth scrolling
- Respects `prefers-reduced-motion` preference
- Disabled on touch devices

### Three.js Room Preview
- Pure Three.js implementation (no React Three Fiber)
- Orbit controls (drag to rotate camera)
- Responsive resize handling
- Proper cleanup on unmount
- SSR-safe (client-only rendering)

### Accessibility
- All interactive elements have focus states
- Respects `prefers-reduced-motion` for animations
- Semantic HTML structure
- Keyboard navigation support

## Development Guidelines

- **TypeScript**: Strict mode enabled, avoid `any` types
- **Styling**: Use Tailwind classes with CSS token references
- **Components**: Keep components modular and reusable
- **Motion**: Always check `shouldUseMotion()` before adding animations
- **Three.js**: Always dispose geometries, materials, and renderers on cleanup

## Next Steps

1. **Backend Integration**: Add API routes for room data
2. **GLB Models**: Replace placeholder geometry with actual room models
3. **Item Selection**: Implement item highlighting in the 3D viewer
4. **Room Library**: Build a gallery/browse page for available rooms
5. **User Authentication**: Implement login functionality
6. **Room Customization**: Allow users to modify room items

## Team Collaboration

This project is structured for parallel development:
- UI components are isolated in `/components/ui`
- Layout components in `/components/layout`
- Effects in `/components/effects`
- Three.js logic separated into utilities in `/lib/three`
- Each developer can work on different pages/routes independently
