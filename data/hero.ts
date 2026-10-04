// Hero content model (admin-ready). The Hero component consumes this
// shape; Phase 2 replaces the import with getHero() from services/siteApi.

import { ACADEMY } from "@/data/site";

export const HERO = ACADEMY.hero;

export type HeroContent = typeof HERO;
