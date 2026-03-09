-- Create media bucket for mediatheque uploads (images, PDFs, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;
