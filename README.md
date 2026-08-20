# 公司巴菲特式分析报告

基于巴菲特价值投资框架，对上市公司进行系统性的财务与业务分析。

## 报告列表

| 公司 | 最新报告日期 | 文件 |
|------|------------|------|
| 阿里巴巴 (Alibaba) | 2026-08-20 | [`reports/alibaba/alibaba-buffett-analysis-20260820.html`](reports/alibaba/alibaba-buffett-analysis-20260820.html)（v2 · Q1 FY2027 财报更新）|
| ING | 2026-08-19 | [`reports/ing/ing-buffett-analysis-20260819.html`](reports/ing/ing-buffett-analysis-20260819.html)（v2 · 2Q2026 财报更新）|
| 腾讯 (Tencent) | 2026-08-16 | [`reports/tencent/tencent-buffett-analysis-20260816.html`](reports/tencent/tencent-buffett-analysis-20260816.html)（v2 · Q2 财报更新）|
| 贵州茅台 (Moutai) | 2026-08-16 | [`reports/moutai/moutai-buffett-analysis-20260816.html`](reports/moutai/moutai-buffett-analysis-20260816.html)（v2 · 半年报更新）|
| 小米 (Xiaomi) | 2026-07-26 | [`reports/xiaomi/xiaomi-buffett-analysis-20260726.html`](reports/xiaomi/xiaomi-buffett-analysis-20260726.html) |
| 百汇生命产业信托 (ParkwayLife REIT) | 2026-08-17 | [`reports/parkwaylife/parkwaylife-buffett-analysis-20260817.html`](reports/parkwaylife/parkwaylife-buffett-analysis-20260817.html)（v2 · 1H2026 财报 + REIT 专属模板）|
| 凯德综合商业信托 (CICT) | 2026-08-17 | [`reports/cict/cict-buffett-analysis-20260817.html`](reports/cict/cict-buffett-analysis-20260817.html)（v1 · 1H2026 财报）|
| 丰树工业信托 (MIT) | 2026-08-17 | [`reports/mit/mit-buffett-analysis-20260817.html`](reports/mit/mit-buffett-analysis-20260817.html)（v1 · 2026 Q2 财报）|

> 每份研报含 v1/v2 版本切换器：历史版本保留在 `reports/<company>/` 目录下（文件名含日期），v1 页面底部可切换至最新版。所有研报基准货币 = 公司财报本位币（阿里/腾讯/茅台：CNY；REIT：SGD；ING：EUR），股价按交易市场标注（HKD/SGD 等）。

## 目录结构

```
reports/
├── <company-name>/
│   └── <company-name>-buffett-analysis-YYYYMMDD.html
│   └── ... (可追加更多日期的报告)
└── ...
```

## 关于分析框架

每份报告涵盖以下维度：
- 护城河（品牌、成本优势、网络效应、转换成本）
- 财务健康（净资产收益率 ROE、负债水平、自由现金流）
- 成长性（营收增长、盈利增长趋势）
- 管理层质量
- 估值合理性
- 投资风险评估

> 六维量化评分（100 分制加权）：护城河 25% · 盈利质量 20% · 估值/安全边际 20% · 管理层/资本配置 15% · 现金流 10% · 确定性/风险 10%。
