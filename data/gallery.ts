// Gallery catalogue. Categories drive the homepage filter pills.

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  image: string;
}

export const GALLERY_CATEGORIES = ["Academy", "Classes", "Faculty", "Events", "Workshops", "Achievements"] as const;

export const GALLERY: GalleryItem[] = [
  { id: "g1", title: "Academy Campus (placeholder)", category: "Academy", image: "/images/gallery-g1.jpg" },
  { id: "g2", title: "Classroom Session (placeholder)", category: "Classes", image: "/images/gallery-g2.jpg" },
  { id: "g3", title: "Faculty Interaction (placeholder)", category: "Faculty", image: "/images/gallery-g3.jpg" },
  { id: "g4", title: "Annual Event (placeholder)", category: "Events", image: "/images/gallery-g4.jpg" },
  { id: "g5", title: "Workshop (placeholder)", category: "Workshops", image: "/images/gallery-g5.jpg" },
  { id: "g6", title: "Achievement Wall (placeholder)", category: "Achievements", image: "/images/gallery-g6.jpg" },
  { id: "g7", title: "Library Block (placeholder)", category: "Academy", image: "/images/gallery-g7.jpg" },
  { id: "g8", title: "Lab Session (placeholder)", category: "Classes", image: "/images/gallery-g8.jpg" },
];
