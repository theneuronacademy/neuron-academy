-- Data-only migration: refresh the website gallery with the academy's
-- edited classroom photos (files in public/images/gallery/).
-- The earlier gallery items are HIDDEN (isActive = false), not deleted,
-- so they can be shown again from Admin -> Website -> Gallery.

UPDATE "GalleryItem"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "isActive" = true
  AND "id" NOT LIKE 'gal2026nov%';

INSERT INTO "GalleryItem" ("id", "title", "imageUrl", "altText", "mediaType", "category", "displayOrder", "isActive", "animation", "createdAt", "updatedAt") VALUES
  ('gal2026nov01', 'Junior batch in class', '/images/gallery/junior-batch-classroom.jpg', 'Junior students in a Neuron Academy classroom, raising their hands with their teacher at the back', 'image', 'Classes', 1, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gal2026nov02', 'Senior batch, winter session', '/images/gallery/winter-batch-selfie.jpg', 'Group selfie of a senior batch with their teacher at Neuron Academy', 'image', 'Classes', 2, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gal2026nov03', 'Test in progress', '/images/gallery/weekly-test.jpg', 'Students writing a test in a Neuron Academy classroom', 'image', 'Tests', 3, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gal2026nov04', 'Classroom with smart board', '/images/gallery/smart-classroom.jpg', 'Neuron Academy classroom with rows of desks and a smart board', 'image', 'Campus', 4, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gal2026nov05', 'With the senior batch', '/images/gallery/senior-batch-selfie.jpg', 'Teacher taking a selfie with a senior batch at Neuron Academy', 'image', 'Classes', 5, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gal2026nov06', 'Classroom session', '/images/gallery/classroom-session.jpg', 'Students seated with their books during a class at Neuron Academy', 'image', 'Classes', 6, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gal2026nov07', 'Exam practice session', '/images/gallery/test-session.jpg', 'Students writing an exam practice paper at Neuron Academy', 'image', 'Tests', 7, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gal2026nov08', 'Celebration with junior students', '/images/gallery/junior-celebration.jpg', 'Junior students smiling at a celebration in a classroom decorated with balloons', 'image', 'Events', 8, true, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
