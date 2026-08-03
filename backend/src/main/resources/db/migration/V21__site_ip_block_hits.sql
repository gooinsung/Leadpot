-- 전역 접속 차단에 걸린 시도 로그.
-- 규칙만 있으면 "정말 막히고 있는지 / 누가 두드리는지"를 알 수 없어 확인용으로 남긴다.
-- source: LANDING(랜딩 열람) · FORM(공개 리드폼 열람) · SUBMIT(리드 제출) 중 하나.
create table site_ip_block_hits (
    id              bigserial primary key,
    user_id         bigint       not null references users (id) on delete cascade,
    ip              varchar(64)  not null,
    matched_pattern varchar(64),
    source          varchar(16)  not null,
    user_agent      varchar(1024),
    created_at      timestamptz  not null default now()
);

create index idx_site_ip_block_hits_user_created on site_ip_block_hits (user_id, created_at desc);
