UPDATE SystemSetting SET value='https://avaterra.pro' WHERE key IN ('site_url','nextauth_url') AND value LIKE '%localhost%';
UPDATE SystemSetting SET value='https://avaterra.pro' WHERE key='nextauth_url' AND trim(value)='';
