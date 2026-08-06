-- 광고주 삭제 500 수정 — 리드 메모/이력의 작성자를 비울 수 있게 한다.
--
-- 문제(2026-08-06): lead_notes.owner_id 가 users(id) 를 참조하는데 on delete 절이 없어
--   기본값 NO ACTION(=RESTRICT) 였다. 광고주가 리드에 메모를 쓰거나 상태를 바꾸면
--   owner_id = 광고주 id 인 행이 쌓이므로, 그 광고주를 삭제하려 하면 FK 위반이 나고
--   DataIntegrityViolationException 이 핸들러에 없어 그대로 500 이 나갔다.
--   (한 번도 활동하지 않은 광고주만 삭제됐다)
--
-- 결정(사용자, 2026-08-06): 메모·이력은 **보존**하고 작성자만 비운다.
--   광고주가 남긴 상담 메모는 마케터의 리드 이력이라 함께 지우면 안 된다.
--
-- 삭제 경로는 AdvertiserService.delete 가 owner_id 를 먼저 null 로 바꾸므로 보통 여기까지 오지
-- 않는다. 이 FK 설정은 **다른 경로로 사용자가 지워질 때를 위한 안전망**이다.

-- 1) 작성자를 비울 수 있게 NOT NULL 해제.
alter table lead_notes alter column owner_id drop not null;

-- 2) FK 를 on delete set null 로 교체.
--    제약 이름은 인라인 references 로 만들어져 lead_notes_owner_id_fkey 일 것으로 보이지만,
--    환경에 따라 다를 수 있어 이름을 찾아서 지운다(이름을 박으면 운영에서만 실패한다).
do $$
declare
    fk_name text;
begin
    select con.conname into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any (con.conkey)
    where rel.relname = 'lead_notes'
      and con.contype = 'f'
      and att.attname = 'owner_id'
    limit 1;

    if fk_name is not null then
        execute format('alter table lead_notes drop constraint %I', fk_name);
    end if;
end $$;

alter table lead_notes
    add constraint lead_notes_owner_id_fkey
    foreign key (owner_id) references users (id) on delete set null;
