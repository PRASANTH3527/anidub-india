# Performance Acceleration Plan (Full-App Speed Optimization)

Accelerate the entire web application to provide instant page navigation, fluid scrolling, and immediate database responses based on user preferences.

---

## 1. User Selections & Root Cause Analysis

- **Focus Area**: Overall performance across the entire application (Home catalog, Airing schedule, Detail view, Modals).
- **Core Bottlenecks Identified**:
  1. **Heavy Canvas Analysis & 3D Math**: `ParallaxCard` runs mouse tracking with multiple springs and 3D tilts for every card on screen; `DynamicAmbientGlow` extracts colors via HTML5 canvas and loops continuous CSS blur animations.
  2. **Expensive Blurs & Overdraw**: Layered `blur-3xl`, `backdrop-blur-2xl`, and multiple transparent gradients force the browser to trigger continuous composite repaints on scrolling.
  3. **Redundant Network & State Computations**: Tab transitions and filter adjustments trigger repeated database queries and full array scans.
  4. **Off-Screen Layout Overhead**: Rendering all catalog cards at once forces the browser layout engine to paint off-screen elements without containment.

---

## 2. Proposed Changes & Technical Architecture

### Component 1: Reduce Heavy Blur & Ambient Glow Overheads
- **`src/components/ParallaxCard.tsx`**:
  - Replace JavaScript spring physics and mousemove listeners with lightweight, GPU-composited CSS transforms (`transition: transform 0.2s ease-out`).
  - Eliminate continuous 3D tilt math (`rotateX`, `rotateY`, `glareX`, `glareY`) that taxes lower-end devices and mobile screens.
- **`src/components/DynamicAmbientGlow.tsx`**:
  - Replace repetitive canvas-based `FastAverageColor` calls with lightweight cached dominant palette extraction and a clean, non-animating ambient gradient.
  - Simplify blur radius from multiple nested `blur-3xl` layers to a single lightweight gradient container with hardware acceleration (`will-change: transform`).
- **`src/components/Hero.tsx` & `src/components/AnimeDetailPage.tsx`**:
  - Tame excessively large radial blur blobs (`blur-3xl`) to optimized subtle gradients (`blur-lg` / `blur-md`) to eliminate mobile GPU thermal throttling.

### Component 2: Aggressive In-Memory Caching for Supabase Data
- **`src/services/databaseService.ts`**:
  - Implement an in-memory cache map with high-efficiency memory lookup (`memoryQueryCache = new Map<string, { data: any, timestamp: number }>()`).
  - Short-circuit redundant Supabase queries if live catalog data is already cached in memory within a 10-minute freshness window.
  - Optimize `getAllAnimeRecords()` and `getApprovedAnime()` with memoized lookup maps so filtering doesn't re-parse JSON records on every render.
- **`src/components/ScheduleView.tsx` & `src/components/AdminAnalyticsDashboard.tsx`**:
  - Use memory-cached Supabase data on mount and only re-fetch when cache expires or when explicitly mutated (like an admin submission/approval).

### Component 3: Fast Image Delivery & Layout Containment
- **`src/components/AnimeCard.tsx`**:
  - Add CSS layout containment (`content-visibility: auto; contain-intrinsic-size: 320px 420px;`) to catalog cards so offscreen cards do not consume CPU/GPU paint cycles.
  - Enforce `decoding="async"` and `loading="lazy"` on all image tags with strict fixed aspect ratio containers (`aspect-[3/4.2]`) to prevent layout shifts (CLS).
  - Streamline card internal DOM hierarchy, removing redundant backdrop layers.
- **`src/App.tsx`**:
  - Memoize filter calculations (`filteredAnime`, `catalogStats`) with `useMemo` so searching and filtering run at 60fps without unnecessary component re-renders.

---

## 3. Files Impacted

| File | Change Description |
|------|--------------------|
| `src/components/ParallaxCard.tsx` | Simplify 3D mouse spring listeners to lightweight GPU CSS hover transitions. |
| `src/components/DynamicAmbientGlow.tsx` | Optimize canvas color extraction and remove continuous heavy blur animations. |
| `src/services/databaseService.ts` | Add in-memory query cache with TTL to eliminate redundant Supabase API roundtrips. |
| `src/components/AnimeCard.tsx` | Add CSS `content-visibility: auto` and optimized image decoding. |
| `src/components/ScheduleView.tsx` | Connect to cached database responses to prevent redundant requests on tab switching. |
| `src/App.tsx` | Memoize filtering pipelines and reduce re-render propagation. |

---

## 4. Verification Plan

1. **Automated Verification**:
   - Run `lint_applet` (`npm run lint` / `tsc --noEmit`) to verify zero TypeScript errors.
   - Run `compile_applet` (`npm run build`) to ensure production build compiles cleanly.
2. **Runtime & Performance Verification**:
   - Inspect network tab to verify Supabase requests are cached and not fired repeatedly on switching tabs.
   - Test scrolling through the full catalog to verify 60fps fluid scroll without frame drops.
   - Confirm Airing schedule and detail modals open instantly without layout shifts.
