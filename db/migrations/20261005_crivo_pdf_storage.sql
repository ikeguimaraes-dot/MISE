-- Download large reports directly from private storage, not the function payload.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('mise-crivo-reports','mise-crivo-reports',false,67108864,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;
