insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'response-attachments',
  'response-attachments',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.ms-powerpoint',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;
