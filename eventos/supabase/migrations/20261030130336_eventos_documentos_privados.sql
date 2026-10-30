-- Target: Eventos project rpavxnjchfmeiacnumpk. Private contracts, server access only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mise-eventos-documentos', 'mise-eventos-documentos', false, 3145728, ARRAY['application/pdf', 'image/jpeg', 'image/png']);
-- No anon/authenticated policies: MISE validates its session server-side;
-- the service role uploads and generates a short-lived signed URL for viewing.
