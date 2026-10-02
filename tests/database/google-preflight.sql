-- Legacy record fixture, before ownership migration, in this disposable DB only.
insert into auth.users(id) values ('99999999-9999-4999-8999-999999999999');
insert into public.notes(user_id,question_id,content)
select '99999999-9999-4999-8999-999999999999',id,'Legacy note preserved' from public.questions;
