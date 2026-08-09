-- 마케터 열람 표시(V32) — '미확인'을 리드 상태에서 떼어낸다.
--
-- 그전까지 마케터 화면의 '미확인'은 status = NEW 였다. 그런데 상태는 광고주도 바꾸는 축이라
-- (광고주가 '유효'로 옮기면 마케터 화면에서 미확인이 저절로 사라졌다),
-- "내가 이 리드를 봤는가"와 뒤섞여 있었다. 게다가 마케터가 확인 표시를 하려면 상태를 바꿔야 했는데
-- 'VALID' 는 광고주 잔액 차감 트리거라 함부로 누를 수 없었다. (2026-08-10 사용자 지적)
--
-- 이제 열람 여부는 이 컬럼 하나로만 판단한다. NULL = 아직 안 봄.
-- 광고주 열람은 advertiser_seen_at 으로 따로 있다 — 둘은 서로 독립이다.
alter table leads
    add column seen_at timestamptz;

-- 미확인 목록·뱃지 카운트가 이 조건으로 조회된다(삭제되지 않은 것 중 seen_at is null).
create index idx_leads_seen_at on leads(form_id, seen_at);

comment on column leads.seen_at is
    '마케터가 이 리드를 열람한 시각. NULL 이면 미확인. 리드 상태(status)와 무관하다(V32).';
