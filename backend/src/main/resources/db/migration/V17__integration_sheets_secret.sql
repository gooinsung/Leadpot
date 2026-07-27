-- 구글시트 웹훅 보호용 공유 시크릿 키. 리드팟이 payload(본문)에 담아 보내고,
-- Apps Script 가 이 값을 검사해 URL 을 아는 제3자의 무단 기록을 막는다. (개인정보 보호)
alter table integration_settings add column sheets_secret varchar(200);
