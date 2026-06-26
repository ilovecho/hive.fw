-------------------------------------------------------
-- documents
-------------------------------------------------------
CREATE TABLE documents (
  oid        INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id     INTEGER NOT NULL,
  doc_type   TEXT NOT NULL,
  doc_class  TEXT,
  sequence   INTEGER,
  md5key     TEXT NOT NULL,
  sizeof     INTEGER NOT NULL,
  docname    TEXT NOT NULL,
  created    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  UNIQUE(md5key),
  UNIQUE(doc_id, sequence)
);


-------------------------------------------------------
-- hivecode
-------------------------------------------------------
CREATE TABLE hivecode (
  oid      INTEGER PRIMARY KEY AUTOINCREMENT,
  type     TEXT NOT NULL,
  code     TEXT NOT NULL,
  name     TEXT NOT NULL,
  memo     TEXT,
  created  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hivecode_type_code ON hivecode(type, code);

-------------------------------------------------------
-- member
-- (MySQL에서는 PRIMARY KEY(member_id, case_id)이었지만
--  SQLite에서 AUTO INCREMENT를 위해 member_id 단일 PK로 단순화)
-------------------------------------------------------
CREATE TABLE member (
  member_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id    INTEGER NOT NULL,
  userid     TEXT,
  role       TEXT,
  status     INTEGER,
  memo       TEXT,
  created    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed     TEXT
);

CREATE INDEX idx_member_case_id ON member(case_id);

-------------------------------------------------------
-- notices
-------------------------------------------------------
CREATE TABLE notices (
  oid       INTEGER PRIMARY KEY AUTOINCREMENT,
  nid       INTEGER NOT NULL,
  ngroup    INTEGER NOT NULL DEFAULT 0,
  language  TEXT NOT NULL DEFAULT '*',
  nclass    TEXT NOT NULL,
  title     TEXT NOT NULL,
  content   TEXT NOT NULL,
  publish   TEXT NOT NULL,
  viewes    INTEGER NOT NULL DEFAULT 0,
  openat    TEXT,
  expired   TEXT,
  created   TEXT DEFAULT CURRENT_TIMESTAMP,
  manager   TEXT DEFAULT 'admin'
);

CREATE INDEX idx_notices_ngroup_lang ON notices(ngroup, language);
CREATE INDEX idx_notices_nid         ON notices(nid);

-------------------------------------------------------
-- queries
-------------------------------------------------------
CREATE TABLE queries (
  oid      INTEGER PRIMARY KEY AUTOINCREMENT,
  queryid  TEXT NOT NULL,
  queryname TEXT NOT NULL,
  sqlstat  TEXT,
  param    TEXT,
  graph    TEXT,
  used     INTEGER,
  memo     TEXT,
  recored  TEXT DEFAULT CURRENT_TIMESTAMP,
  dbname   TEXT,
  UNIQUE(queryid)
);

-------------------------------------------------------
-- users
-------------------------------------------------------
CREATE TABLE users (
  oid        INTEGER PRIMARY KEY AUTOINCREMENT,
  userid     TEXT NOT NULL,
  name       TEXT NOT NULL,
  md5id      TEXT NOT NULL,
  password   TEXT NOT NULL,
  temppass   TEXT,
  md5digest  TEXT NOT NULL,
  provider   TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  email      TEXT,
  birth      TEXT,
  gender     TEXT,
  country    TEXT,
  language   TEXT,
  groupid    TEXT,
  rolecode   TEXT NOT NULL,
  enrolled   TEXT,
  withdrawed TEXT,
  masterkey  INTEGER NOT NULL,
  state      TEXT,
  UNIQUE(userid),
  UNIQUE(md5id)
);

-------------------------------------------------------
-- usersignin
-- (스크립트에 두 번 있었지만 한 번만 생성)
-------------------------------------------------------
CREATE TABLE usersignin (
  oid           INTEGER PRIMARY KEY AUTOINCREMENT,
  userid        TEXT NOT NULL,
  signedin      TEXT DEFAULT CURRENT_TIMESTAMP,
  ipaddress     TEXT,
  browser       TEXT,
  phpsessid     TEXT,
  referer       TEXT,
  gps_ratitude  TEXT,
  gps_langutitude TEXT,
  gps_altitude  TEXT,
  rolecode      TEXT
);

-------------------------------------------------------
-- company
-------------------------------------------------------
CREATE TABLE company (
  oid         INTEGER PRIMARY KEY AUTOINCREMENT,
  biz_no      TEXT,
  biz_name    TEXT NOT NULL,
  biz_ceo     TEXT,
  ceo_phone   TEXT,
  biz_phone   TEXT,
  biz_address TEXT,
  biz_class   TEXT,
  biz_type    TEXT,
  biz_email   TEXT,
  biz_charge  TEXT,
  biz_contact TEXT,
  memo        TEXT,
  closed      TEXT,   -- date
  created     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(biz_no)
);

-------------------------------------------------------
-- workdorder
-------------------------------------------------------
CREATE TABLE workorder (
  oid           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no      TEXT NOT NULL UNIQUE,
  receive_date  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date      TEXT NOT NULL,
  customer_name TEXT,
  order_title   TEXT,
  product_code  TEXT,
  product_name  TEXT,
  specification TEXT,
  color         TEXT,
  quantity      TEXT,
  is_inventory_issue TEXT,
  is_procurement_sticker TEXT,
  status        TEXT,
  shipped_at    TEXT,
  shipped_by    TEXT,
  delivery_type TEXT,
  memo          TEXT,
  created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_no)
)

-------------------------------------------------------
-- process
-------------------------------------------------------
CREATE TABLE "process" (
  "oid" INTEGER PRIMARY KEY AUTOINCREMENT,
  "doc_type" TEXT NOT NULL,
  "doc_id" TEXT NOT NULL,
  "doc_process" TEXT NOT NULL,
  "worker" TEXT,
  "memo" TEXT,
  "created" TEXT DEFAULT CURRENT_TIMESTAMP
);

-------------------------------------------------------
-- VIEW: users_active
-------------------------------------------------------
CREATE VIEW users_active AS
SELECT
   users.oid        AS oid,
   users.userid     AS userid,
   users.name       AS name,
   users.md5id      AS md5id,
   users.password   AS password,
   users.md5digest  AS md5digest,
   users.temppass   AS temppass,
   users.address    AS address,
   users.phone      AS phone,
   users.email      AS email,
   users.birth      AS birth,
   users.gender     AS gender,
   users.country    AS country,
   users.language   AS language,
   users.groupid    AS groupid,
   users.enrolled   AS enrolled,
   users.withdrawed AS withdrawed,
   users.masterkey  AS masterkey,
   users.state      AS state,
   users.rolecode   AS rolecode,
   users.provider   AS provider
FROM users
WHERE users.state < '9';

-------------------------------------------------------
-- 초기 데이터 (users)
-------------------------------------------------------
INSERT INTO users
  (oid, userid, name, md5id, password, md5digest, provider,
   phone, email, birth, gender, country, language, groupid,
   rolecode, enrolled, masterkey, state)
VALUES
  (1, 'system_admin', '시스템',
   '68ed1c7decda36085c86df62823cde17',
   'bc0484053556313db22ade0315a867a9337a27de1ecc725537a685d5251df3e2',
   '862eb370ad9c5c6a2f298ce6c5d55ad4',
   'id',
   '010-9035-1795',
   'anhive@gmail.com',
   '20190801',
   'M',
   'ko',
   'ko',
   'anhive',
   'A',
   '2019-08-01 00:00:00',
   1564408013,
   '1'
  );

INSERT INTO users
  (oid, userid, name, md5id, password, md5digest, provider,
   address, phone, email, birth, gender, country, language, groupid,
   rolecode, enrolled, masterkey, state)
VALUES
  (2, 'yshan', '한용수',
   'de1da2c4b783cea08c271fa9ccea88bb',
   'f336f5ae843d0def85f289f6a0e83db60bf3ee59943d7b3aaf1cda947bfe0ad1',
   '7d21d0c7100e28b6067eccb7ce02d8bd',
   'id',
   '',
   '010-9035-1795',
   'ilovecho@gmail.com',
   '19661221',
   'M',
   'KR',
   'ko',
   'anhive',
   'A',
   '2018-08-21 12:00:10',
   1563370260,
   '4'
  );
