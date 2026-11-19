-- 광고 매체 연동 · 자동화 규칙(조건 → 동작), 2026-11-19. 설계: docs/AD-AUTOMATION-PLAN.md
--
-- ⚠️ 기존 테이블은 하나도 건드리지 않는다(새 테이블만). 이 기능은 리드팟 본 서비스와 철저히 무관해야 한다.
--
-- 마케터가 자기 광고 계정(당근·메타·구글 …)을 연결해 두면, 리드폼에 들어온 리드 수 같은 '조건'을 만족했을 때
-- 선택한 '동작'(캠페인 끄기 등)을 리드팟이 대신 실행한다. 조건·동작·매체 종류는 계속 늘어날 수 있어
-- 종류는 문자열 + 설정은 JSON 으로 둔다(새 종류를 추가해도 스키마를 바꾸지 않게).

-- 매체 연결(인증 단위). 당근은 키 1개 = 광고계정 1개, 메타는 토큰 1개 = 광고계정 여러 개.
CREATE TABLE ad_connections (
    id              bigserial PRIMARY KEY,
    owner_id        bigint       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- KARROT / META / GOOGLE …
    platform        varchar(20)  NOT NULL,
    -- 마케터가 붙인 이름(예: "OO치과 당근")
    label           varchar(100) NOT NULL,
    -- 자격증명(JSON)을 AES-256-GCM 으로 암호화한 값. 키는 환경변수 APP_AD_CREDENTIALS_KEY 에만 있다.
    credentials_enc text         NOT NULL,
    -- 화면 표시용 힌트(키의 마지막 4자리 등). 원문은 절대 두지 않는다.
    credentials_hint varchar(40),
    -- ACTIVE / INVALID(매체가 인증을 거절 — 키 재발급·토큰 폐기 등)
    status          varchar(16)  NOT NULL DEFAULT 'ACTIVE',
    status_message  varchar(500),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_ad_connections_owner ON ad_connections (owner_id);

-- 자동화 규칙 = 리드폼 1개 + 조건 1개 + 동작 1개 + 대상 캠페인 N개.
-- form_id 에 FK 를 걸지 않는 것은 의도다: 걸면 리드폼 삭제가 규칙 때문에 막히거나(RESTRICT) 규칙이 조용히
-- 사라진다(CASCADE). 결정(2026-11-19)대로 '일시정지 + 화면 표시'를 하려고 엔진이 존재를 확인한다.
CREATE TABLE ad_rules (
    id                bigserial PRIMARY KEY,
    owner_id          bigint       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    form_id           bigint       NOT NULL,
    name              varchar(100) NOT NULL,
    enabled           boolean      NOT NULL DEFAULT true,
    -- 자동 일시정지 사유(리드폼 삭제·연결 삭제 등). null 이면 정상.
    paused_reason     varchar(200),
    -- 조건 종류(DAILY_LEAD_COUNT …)와 설정(JSON, 예: {"limit": 5})
    condition_type    varchar(40)  NOT NULL,
    condition_config  jsonb        NOT NULL DEFAULT '{}'::jsonb,
    -- 동작 종류(PAUSE_CAMPAIGNS …)와 설정(JSON)
    action_type       varchar(40)  NOT NULL,
    action_config     jsonb        NOT NULL DEFAULT '{}'::jsonb,
    -- 동작 성공도 텔레그램으로 알릴지(실패는 항상 알린다)
    notify_success    boolean      NOT NULL DEFAULT true,
    -- 마지막으로 발동한 조건 기간(예: 일 수량이면 '2026-11-19'). 기간당 한 번만 발동하는 선점 키.
    last_fired_period varchar(40),
    last_fired_at     timestamptz,
    created_at        timestamptz  NOT NULL DEFAULT now(),
    updated_at        timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_ad_rules_form ON ad_rules (form_id);
CREATE INDEX ix_ad_rules_owner ON ad_rules (owner_id);

-- 규칙이 조작할 대상(1차: 캠페인). 연결을 지우면 대상도 지워지고 규칙은 일시정지된다(코드).
CREATE TABLE ad_rule_targets (
    id            bigserial PRIMARY KEY,
    rule_id       bigint       NOT NULL REFERENCES ad_rules (id) ON DELETE CASCADE,
    connection_id bigint       NOT NULL REFERENCES ad_connections (id) ON DELETE CASCADE,
    account_id    varchar(64)  NOT NULL,
    campaign_id   varchar(64)  NOT NULL,
    -- 화면·알림용 스냅샷(매체에서 이름을 바꿔도 여기는 등록 당시 이름)
    campaign_name varchar(300)
);
CREATE INDEX ix_ad_rule_targets_rule ON ad_rule_targets (rule_id);

-- 실행 이력(규칙 발동·수동 조작 모두). 연결·규칙을 지워도 이력은 남긴다(FK 없음).
CREATE TABLE ad_action_logs (
    id            bigserial PRIMARY KEY,
    owner_id      bigint       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rule_id       bigint,
    rule_name     varchar(100),
    -- RULE / MANUAL
    trigger_type  varchar(16)  NOT NULL,
    connection_id bigint,
    platform      varchar(20)  NOT NULL,
    account_id    varchar(64),
    campaign_id   varchar(64),
    campaign_name varchar(300),
    -- PAUSE_CAMPAIGN / RESUME_CAMPAIGN …
    action        varchar(40)  NOT NULL,
    success       boolean      NOT NULL,
    message       varchar(1000),
    created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_ad_action_logs_owner ON ad_action_logs (owner_id, created_at DESC);
