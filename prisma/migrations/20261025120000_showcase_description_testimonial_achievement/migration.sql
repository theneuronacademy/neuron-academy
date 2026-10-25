-- Website audit fixes: toppers-wall description + testimonial achievement line.
-- Non-destructive, additive-only: existing rows keep working (legacy rows show
-- their previous fallbacks). Apply with `prisma migrate deploy` — never with
-- db push/migrate dev against the production database.
ALTER TABLE "ResultShowcase" ADD COLUMN "description" TEXT;
ALTER TABLE "Testimonial" ADD COLUMN "achievement" TEXT;
