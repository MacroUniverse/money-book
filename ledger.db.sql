PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "assets" (
	"account"	TEXT,
	"time"	TEXT,
	"currency"	TEXT,
	"amount"	TEXT,
	"to_rmb"	TEXT
, "tag"	TEXT);
INSERT INTO assets VALUES('BTC','260301','btc','0.569957',NULL,'coin');
INSERT INTO assets VALUES('ETH','260301','eth','6.25412',NULL,'coin');
INSERT INTO assets VALUES('chase bank','260301','usd (1e4)','0.1703.83',NULL,'现金');
INSERT INTO assets VALUES('commerce bank','260301','usd (1e4)','0.336878',NULL,'现金');
INSERT INTO assets VALUES('webull','260301','usd (1e4)','3.68482',NULL,'股票');
INSERT INTO assets VALUES('中信银行-基金','260301','rmb (1e4)','10.040399',NULL,'基金');
INSERT INTO assets VALUES('中信银行-活期+','260301','rmb (1e4)','0.154443',NULL,'零钱理财');
INSERT INTO assets VALUES('哥哥投资','260301','rmb (1e4)','-5',NULL,'别人的');
INSERT INTO assets VALUES('工商银行-基金','260301','rmb (1e4)','19.861872',NULL,'基金');
INSERT INTO assets VALUES('工商银行-现金','260301','rmb (1e4)','33.508549',NULL,'现金');
INSERT INTO assets VALUES('工商银行-理财','260301','rmb (1e4)','27.963154',NULL,'基金');
INSERT INTO assets VALUES('微信-零钱','260301','rmb (1e4)','0.00641',NULL,'现金');
INSERT INTO assets VALUES('微信-零钱通','260301','rmb (1e4)','3.313522',NULL,'零钱理财');
INSERT INTO assets VALUES('支付宝-余额宝','260301','rmb (1e4)','19.509691',NULL,'零钱理财');
INSERT INTO assets VALUES('支付宝-基金','260301','rmb (1e4)','9.995819',NULL,'基金');
INSERT INTO assets VALUES('支付宝-现金','260301','rmb (1e4)','0',NULL,'现金');
INSERT INTO assets VALUES('爸爸投资','260301','rmb (1e4)','-18',NULL,'别人的');
CREATE TABLE IF NOT EXISTS "accounts" (
	"name"	TEXT NOT NULL UNIQUE,
	"currency"	TEXT,
	PRIMARY KEY("name")
);
INSERT INTO accounts VALUES('BTC','btc');
INSERT INTO accounts VALUES('ETH','eth');
INSERT INTO accounts VALUES('apple card','usd');
INSERT INTO accounts VALUES('chase credit','usd');
INSERT INTO accounts VALUES('chase debit','usd');
INSERT INTO accounts VALUES('commerce bank','usd');
INSERT INTO accounts VALUES('discover','usd');
INSERT INTO accounts VALUES('paypal','usd');
INSERT INTO accounts VALUES('中信','rmb');
INSERT INTO accounts VALUES('工行','rmb');
INSERT INTO accounts VALUES('建行','rmb');
INSERT INTO accounts VALUES('微信','rmb');
INSERT INTO accounts VALUES('微信小','rmb');
INSERT INTO accounts VALUES('支付宝','rmb');
CREATE TABLE IF NOT EXISTS "main" (
	"ID"	INTEGER NOT NULL UNIQUE,
	"日期"	TEXT,
	"描述"	TEXT,
	"RMB"	TEXT,
	"USD"	TEXT,
	"对方"	TEXT,
	"账户"	TEXT,
	"备注"	TEXT,
	"备忘"	TEXT,
	"标签1"	TEXT,
	"标签2"	TEXT,
	"标签3"	TEXT,
	"关联1"	INTEGER,
	FOREIGN KEY("账户") REFERENCES "accounts"("name"),
	FOREIGN KEY("标签1") REFERENCES "tags"("名称"),
	FOREIGN KEY("标签2") REFERENCES "tags"("名称"),
	FOREIGN KEY("对方") REFERENCES "targets"("名称"),
	FOREIGN KEY("标签3") REFERENCES "tags"("名称"),
	FOREIGN KEY("关联1") REFERENCES "main"("ID"),
	PRIMARY KEY("ID" AUTOINCREMENT)
);
INSERT INTO main VALUES(1,'240513','换 $1383.67','-10000',NULL,'kush','微信',NULL,NULL,'换汇',NULL,NULL,23);
INSERT INTO main VALUES(10,'240401','4 月亲情卡','1838.14',NULL,'宝贝','支付宝',NULL,NULL,'送宝贝',NULL,NULL,NULL);
INSERT INTO main VALUES(100,'240531','Lyft 打车',NULL,'9.8',NULL,'paypal',NULL,NULL,'生活',NULL,NULL,NULL);
INSERT INTO main VALUES(1000,'260111','北京龙泉驾校（手动挡补差价）','400',NULL,NULL,'微信',NULL,NULL,'车',NULL,NULL,NULL);
INSERT INTO main VALUES(1002,'260118','请宝贝吃 Papa Danilo 意大利餐厅 190+76','266',NULL,NULL,'微信',NULL,NULL,'送宝贝',NULL,NULL,NULL);
INSERT INTO main VALUES(995,'260101','1 月生活杂费（支付宝）','210.79',NULL,NULL,'支付宝','37.32+34.8+12+3+51+20+20+14.67+3+15',NULL,'生活',NULL,NULL,NULL);
INSERT INTO main VALUES(996,'260101','1 月正常饮食（微信）','123.88',NULL,NULL,'微信','18.98+26.4+18.8+19.9+17.9+21.9',NULL,'吃喝',NULL,NULL,NULL);
INSERT INTO main VALUES(997,'260101','1 月生活杂费（微信）','78.6',NULL,NULL,'微信','16.8+39+16.8+6',NULL,'生活',NULL,NULL,NULL);
INSERT INTO main VALUES(999,'251130','GitKraken 一年会员',NULL,'25.44',NULL,'discover',NULL,NULL,'软件',NULL,NULL,NULL);
CREATE TABLE IF NOT EXISTS "tags" (
	"名称"	TEXT NOT NULL UNIQUE,
	"说明"	TEXT,
	PRIMARY KEY("名称")
);
INSERT INTO tags VALUES('安置',NULL);
INSERT INTO tags VALUES('亲人',NULL);
INSERT INTO tags VALUES('还钱',NULL);
INSERT INTO tags VALUES('退款',NULL);
INSERT INTO tags VALUES('送宝贝',NULL);
CREATE TABLE IF NOT EXISTS "target_tags" (
	"名称"	TEXT NOT NULL UNIQUE,
	"说明"	TEXT,
	PRIMARY KEY("名称")
);
INSERT INTO target_tags VALUES('亲人',NULL);
INSERT INTO target_tags VALUES('修车',NULL);
INSERT INTO target_tags VALUES('超市',NULL);
INSERT INTO target_tags VALUES('餐饮',NULL);
CREATE TABLE IF NOT EXISTS "targets" (
	"名称"	TEXT NOT NULL UNIQUE,
	"别名"	TEXT,
	"备注"	TEXT,
	"联系方式"	TEXT,
	"tag1"	TEXT,
	"tag2"	TEXT,
	FOREIGN KEY("tag1") REFERENCES "target_tags"("名称"),
	FOREIGN KEY("tag2") REFERENCES "target_tags"("名称"),
	PRIMARY KEY("名称")
);
INSERT INTO targets VALUES('IRS',NULL,'退税',NULL,NULL,NULL);
INSERT INTO targets VALUES('淘宝',NULL,NULL,NULL,NULL,NULL);
INSERT INTO targets VALUES('爱一帆','','盗版电影','',NULL,NULL);
INSERT INTO targets VALUES('爸爸',NULL,NULL,NULL,NULL,NULL);
INSERT INTO targets VALUES('闲鱼',NULL,NULL,NULL,NULL,NULL);
INSERT INTO targets VALUES('麦当劳',NULL,NULL,NULL,NULL,NULL);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('main',1034);
COMMIT;
