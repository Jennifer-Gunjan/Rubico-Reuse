-- Photos: JPG or PNG, 2 MB each, readable by everyone signed in, writable only in your own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy listing_images_read on storage.objects for select to authenticated
  using (bucket_id = 'listing-images');
create policy listing_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy listing_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
