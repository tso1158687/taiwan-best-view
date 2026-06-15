# MVP Plan

## 第一階段：案件草稿器

建立本機工具，先能手動建立案件草稿。

必要功能：

- 新增案件
- 選擇縣市：台北市 / 新北市
- 選擇違規類型：先以違規停車為主
- 上傳 1 到 5 張照片或影片
- 編輯車號
- 編輯違規日期時間
- 編輯行政區、路段、補充地點
- 編輯違規事實與說明
- 儲存草稿 JSON
- 偵測 HEIC/HEIF 附件並提示需先轉成 JPG

建議資料格式：

```json
{
  "jurisdiction": "taipei",
  "violationType": "illegal_parking",
  "plate": "ABC-1234",
  "occurredAt": "2026-06-15T14:32:00+08:00",
  "district": "大安區",
  "road": "信義路三段",
  "addressNote": "123號前人行道",
  "fact": "違規停車",
  "description": "車輛停放於人行道，妨礙行人通行",
  "files": ["photo1.jpg", "photo2.jpg"],
  "attachments": [
    {
      "originalName": "IMG_1234.HEIC",
      "submissionName": "IMG_1234.jpg",
      "originalExtension": "heic",
      "submissionExtension": "jpg",
      "needsConversion": true,
      "conversionStatus": "pending",
      "exifStatus": "pending"
    }
  ],
  "status": "draft"
}
```

## 第 1.5 階段：附件前處理與 HEIC 轉檔

iPhone 常產生 HEIC/HEIF 照片，但台北市與新北市網站不接受這類格式。附件模組需在進入官方表單前完成轉檔與 EXIF 保留檢查。

必要功能：

- 偵測 `.heic` / `.heif`
- 將 HEIC/HEIF 轉成 JPG 作為送件檔
- 保留或重新寫入原始 EXIF metadata
- 驗證轉檔後仍有 `DateTimeOriginal` 與 GPS 欄位候選
- 在草稿中同時記錄原始檔與送件檔
- UI 顯示轉檔狀態：待轉檔 / 已轉檔 / EXIF 已驗證 / EXIF 需人工確認

建議本機工具策略：

- macOS 可先用 `sips` 進行 HEIC 到 JPG 轉檔
- 建議搭配 `exiftool` 複製與驗證 EXIF
- 若缺少 `exiftool`，系統可轉檔但必須標示 EXIF 未驗證，不能直接視為可送件

## 第二階段：照片解析

加入自動輔助，但所有結果都要讓使用者確認。

功能：

- 讀取轉檔前後附件 metadata
- 讀取 EXIF DateTimeOriginal 作為違規時間候選
- 讀取 EXIF GPS 作為地點候選
- OCR 車牌
- OCR 路牌、門牌、店名、公車站牌等地點線索
- 檔案大小與格式檢查
- 顯示信心分數或「需人工確認」狀態

## 第三階段：地點輔助

GPS 可能飄移，所以地點模組不要只相信座標。

地點候選來源：

- EXIF GPS 反查地址
- 最近道路與路口
- OCR 辨識到的文字
- 使用者常用/曾確認地點
- 手動輸入

輸出格式建議：

- 有門牌：`台北市大安區信義路三段123號前人行道`
- 無門牌：`新北市板橋區文化路一段與民權路口，靠近東南側人行道`

## 第四階段：台北市半自動填表

用 Playwright 或 Computer Use 開啟官方網站：

- https://prsweb.tcpd.gov.tw/

自動處理：

- 開啟檢舉頁
- 填檢舉人基本資料
- 發送 Email 認證前暫停或提示
- 驗證完成後填檢舉內容
- 選行政區、路段、地點欄位
- 選違規事實
- 上傳附件
- 送出前顯示摘要並暫停

不自動處理：

- Email 收信登入
- 身分/個資真實性宣告
- 最後送出，除非使用者明確確認

## 第五階段：新北市半自動填表

用 Playwright 或 Computer Use 開啟官方網站：

- https://tvrs.ntpd.gov.tw/

自動處理：

- 開啟聲明頁
- 勾選同意聲明並進入下一步
- 填違規內容
- 填檢舉人資料
- 上傳附件
- 送出前檢查摘要

不自動處理：

- 圖形驗證碼
- Email 認證
- 最後送出，除非使用者明確確認

## 第六階段：案件紀錄

記錄：

- 草稿建立時間
- 送件狀態
- 官方案件編號
- 查詢密碼
- 送件時間
- 附件摘要
- 是否需要補正

## 建議技術選型

- Runtime：Node.js
- 自動填表：Playwright
- EXIF：exifr
- OCR：先用 OpenAI Vision 或本機 OCR 二選一
- 資料儲存：JSON 起步，後續可改 SQLite
- UI：本機 Web UI，React 或簡單 HTML 都可
- 個資：本機加密儲存，MVP 可先支援不保存或手動輸入

## 開發優先順序

1. 本機草稿 JSON schema
2. 照片上傳與檔案檢查
3. HEIC/HEIF 偵測與 JPG 轉檔管線
4. EXIF 保留驗證
5. EXIF 時間解析
6. 手動確認頁
7. 台北市 Playwright 填表 prototype
8. 新北市 Playwright 填表 prototype
9. OCR 車牌與地點候選
10. 案件紀錄與查詢資料保存
