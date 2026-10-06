// Gallery catalogue. Categories drive the homepage filter pills.
// Phase 10: placeholder photos removed. Upload real photos via
// /admin/website/gallery (database) — empty state shows until then.

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  image: string;
}

export const GALLERY_CATEGORIES = ["Academy", "Classes", "Faculty", "Events", "Workshops", "Achievements"] as const;

export const GALLERY: GalleryItem[] = [];
