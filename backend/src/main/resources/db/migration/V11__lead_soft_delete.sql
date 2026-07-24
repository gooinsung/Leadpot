-- E4: 리드 휴지통(soft delete). deleted_at 이 NULL 이 아니면 휴지통에 있는 리드.
alter table leads add column deleted_at timestamp(6) with time zone;
create index idx_leads_form_deleted on leads (form_id, deleted_at);
