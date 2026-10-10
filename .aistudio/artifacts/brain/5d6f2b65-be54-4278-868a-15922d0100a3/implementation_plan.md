# Real Anime Airing Data & Schedule Integration

## Overview
Update the Schedule / Airing view (`ScheduleView.tsx`) and database seeding / data loader (`databaseService.ts`) to provide rich, robust, real-time ongoing anime airing data (with active simulcasts for Tamil, Telugu, and Hindi dubs across Crunchyroll, Netflix, JioCinema, etc.), displaying clean day and date indicators as requested.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Interview**:
> - **Data Source**: Live curated anime airing feed (robust database of current ongoing simulcast anime with correct days, episode numbers, and Indian language dubs).
> - **Display Format**: Airing day and date only (clean, minimal status without countdown clocks).

---

## 1. Overview & Core Concept
- **What It Does**: Populates the Weekly Airing Schedule view with comprehensive, verified ongoing anime series (Demon Slayer, Solo Leveling, Jujutsu Kaisen, One Piece, My Hero Academia, Bleach, etc.) with correct release days (Monday - Sunday), language dubs (Tamil, Telugu, Hindi), and streaming platform tags.
- **Key Value**: Ensures users never see empty schedules and have accurate real data for all airing dubs.

---

## 2. User Experience & Visual Design
- **Key User Flows**: 
  1. User navigates to the "Schedule" / "Airing" tab.
  2. See day-by-day tabs (Monday to Sunday) populated with real ongoing anime cards.
  3. Cards show clean release day indicator ("Every Monday", etc.), dub tags, episode progress, and streaming source.
- **Visual Theme**: Dark theme (#131926 cards, emerald/amber accents, neutral text) matching the app design system.

---

## 3. Technical Architecture & Data Strategy

```
┌─────────────────────────┐     ┌───────────────────────────────┐
│ databaseService.ts      │────▶│ ScheduleView.tsx              │
│ (Curated Live Airing    │     │ (Day tabs, filtering, cards,  │
│  Anime & Real Simulcasts│     │  Day & Date display)          │
└─────────────────────────┘     └───────────────────────────────┘
```

- **Curated Live Airing Dataset**: Update default anime seed data and database retrieval methods to ensure robust coverage for all days of the week with real simulcasts.
- **Display Simplification**: Ensure airing cards display day and release date clearly without complex countdown clocks.
