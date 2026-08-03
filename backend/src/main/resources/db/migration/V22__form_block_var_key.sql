-- 리드폼 항목에 "변하지 않는 변수키"를 부여한다 (메시지 템플릿의 기준값).
--
-- 왜 필요한가: 리드폼을 저장하면 form_blocks 가 전부 삭제되고 새 ID 로 재생성되므로
-- (Form.replaceBlocks + orphanRemoval) 블록 ID 를 템플릿에 박을 수 없다. 항목명(label)은
-- 사용자가 언제든 바꾼다. 그래서 별도의 불변 키가 필요하다. 자세한 배경은 docs/MESSAGING-PLAN.md §5.

-- 리드폼별 변수키 발급 카운터. 항목을 지워도 되돌리지 않는다 → 지운 키를 새 항목이 물려받아
-- 과거 리드·템플릿이 엉뚱한 값을 가리키는 일을 막는다.
ALTER TABLE forms ADD COLUMN var_key_seq integer NOT NULL DEFAULT 0;

-- 답변을 만드는 블록(FIELD·CHOICE)에만 부여한다. 콘텐츠 블록은 NULL.
ALTER TABLE form_blocks ADD COLUMN var_key varchar(20);

-- 기존 항목 백필 — 리드폼별로 화면 순서대로 f1, f2, ...
WITH numbered AS (
    SELECT id,
           row_number() OVER (PARTITION BY form_id ORDER BY sort_order, id) AS rn
    FROM form_blocks
    WHERE block_type IN ('FIELD', 'CHOICE')
)
UPDATE form_blocks b
SET var_key = 'f' || n.rn
FROM numbered n
WHERE b.id = n.id;

-- 카운터를 백필한 개수에 맞춘다(다음 항목은 f{N+1} 부터).
UPDATE forms f
SET var_key_seq = (
    SELECT count(*) FROM form_blocks b
    WHERE b.form_id = f.id AND b.block_type IN ('FIELD', 'CHOICE')
);

-- 한 리드폼 안에서 변수키는 유일해야 한다(중복되면 템플릿이 어느 항목인지 알 수 없다).
CREATE UNIQUE INDEX ux_form_blocks_form_var_key
    ON form_blocks (form_id, var_key)
    WHERE var_key IS NOT NULL;
