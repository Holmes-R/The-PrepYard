begin;
-- Keep historical account IDs and owned records; disable Google registration.
drop function private.register_google_student(text,text,text);
commit;
