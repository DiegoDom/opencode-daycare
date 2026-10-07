-- SPEC 18 (amendment) — `parent_sees_post()` para cortar la recursión de RLS.
--
-- La política original `posts_select_parent` subqueriaba `post_children`, y
-- `post_children_insert_staff` subqueriaba `posts`: al insertar en
-- `post_children`, el WITH CHECK corría el SELECT sobre `posts`, cuyo RLS
-- (posts_select_parent) volvía a entrar en `post_children` → Postgres dispara
-- `42P17 infinite recursion detected in policy for relation "post_children"`.
--
-- Fix: la visibilidad del padre se delega en `parent_sees_post(post_id)`
-- (`SECURITY DEFINER`): corre por fuera del RLS del invocador, así ninguna
-- política de `posts` vuelve a entrar en `post_children`. Mismo patrón que
-- `my_child_rooms()` (función definer + revoke/grant en la misma migración).

-- 1. Función de visibilidad del padre ------------------------------------
create or replace function public.parent_sees_post(p_post_id uuid)
  returns boolean
  language sql
  security definer
  set search_path = ''
as $$
  -- la política original, corrida con privilegios del dueño (sin RLS encima)
  select exists (
    select 1 from public.post_children pc
    where pc.post_id = p_post_id
      and exists (
        select 1 from public.parent_children link
        where link.child_id = pc.child_id
          and link.parent_id = (select auth.uid())
      )
  )
  or exists (
    select 1 from public.posts po
    where po.id = p_post_id
      and po.room_id is not null
      and po.room_id in (select public.my_child_rooms())
  );
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto: el revoke va en la misma
-- migración (advisor `anon_security_definer_function_executable`).
revoke execute on function public.parent_sees_post(uuid) from public, anon;
grant  execute on function public.parent_sees_post(uuid) to authenticated;

-- 2. Política que lo usa -------------------------------------------------
drop policy if exists posts_select_parent on public.posts;

create policy posts_select_parent on public.posts
  for select
  to authenticated
  using (public.parent_sees_post(posts.id));