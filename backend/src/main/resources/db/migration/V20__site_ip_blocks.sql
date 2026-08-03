-- 계정 전역 '접속 차단' IP 규칙.
-- 기존 ip_blocks(K2)는 **리드폼별 제출 차단**이라 목적이 다르므로 건드리지 않고 따로 둔다.
--  · ip_blocks       : 특정 리드폼에 '제출'을 막는다
--  · site_ip_blocks  : 이 계정의 공개 화면(랜딩·리드폼)에 '접속' 자체를 막는다
create table site_ip_blocks (
    id          bigserial primary key,
    user_id     bigint       not null references users (id) on delete cascade,
    pattern     varchar(64)  not null,
    reason      varchar(255),
    created_at  timestamptz  not null default now()
);

create index idx_site_ip_blocks_user on site_ip_blocks (user_id);
