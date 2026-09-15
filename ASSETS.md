# 素材與街景參考

本作採用虛構街道配置及商店名稱，以網上街景照片研究香港的建築密度、小巴比例、路邊設施、招牌及街道氛圍。遊戲內的模型、招牌圖像及音樂均由本專案製作，沒有把參考照片貼入場景。

## 網上圖片參考

| 題材 | 來源 | 用途 |
| --- | --- | --- |
| 旺角紅Van及密集街景 | [Red Minibuses and Urban Density Mong Kok Hong Kong — David Kernan](https://commons.wikimedia.org/wiki/File:Red_Minibuses_and_Urban_Density_Mong_Kok_Hong_Kong.jpg) | 紅頂／米白車身、車窗比例、街道密度及招牌分布 |
| 深水埗東京街夜景 | [Tonkin Street night — ZHyamenadnou](https://commons.wikimedia.org/wiki/File:HK_Shum_Shui_Po_東京街_Tonkin_Street_night_KMBus_2A_stop_sign_view_MTR_residential_building_high-rises_Oct-2013_Cheung_Sha_Wan_Road_元州邨_Un_Chau_Estate.JPG) | 行人路、燈光、街道設施及樓宇比例 |
| 深水埗店舖招牌 | [Shop signs in Sham Shui Po](https://commons.wikimedia.org/wiki/Category:Shop_signs_in_Sham_Shui_Po) | 橫向及懸臂招牌、色彩、繁體中文排版 |
| 香港橙色垃圾桶 | [Hong Kong Orange Rubbish Bin — Blacktc](https://commons.wikimedia.org/wiki/File:Hong_Kong_Orange_Rubbish_Bin_Food_and_Environmental_Hygiene_Department.jpg) | 圓筒外形、橙色、頂蓋及投入口 |

照片權利及授權以各來源頁面為準；本版只用作研究參考，未分發照片本身。

## 2026-09-15 新一輪視覺參考

- 玩家提供的 19 張香港街景、小巴、欄杆、行人路及報紙檔照片已在工作區讀取並作美術參考；未把照片加入遊戲或儲存庫。
- [M+：香港明生大押霓虹招牌照片，約 1970 年](https://www.mplus.org.hk/en/collection/objects/photograph-neon-sign-for-ming-seng-pawn-shop-hong-kong-ca13-4-38/)：懸臂招牌、霓虹邊框及押店圖形語言。
- [香港路政署：街景美化](https://www.hyd.gov.hk/en/our_services/streetscape/streetscape/index.html)及[街道設施小冊子](https://www.hyd.gov.hk/en/our_services/streetscape/streetscape/doc/leaflet.pdf)：欄杆、路磚及燈柱參考。
- [香港路政署：元朗行人天橋照片](https://www.hyd.gov.hk/en/our_services/streetscape/streetscape/doc/streetscape_yl.jpg)：有蓋橋面、欄杆及樓梯比例。
- [Wikimedia Commons：九龍公園與中港城行人天橋](https://commons.wikimedia.org/wiki/File:Footbridge_connecting_Kowloon_Park_and_China_Hong_Kong_City_(Hong_Kong).jpg)：公園與街區連接的參考資料。

場景為虛構香港街區，招牌圖案及建築皆為原創程式模型；沒有重製真實商標或把原相片作貼圖。

## 隨遊戲分發的素材

- **3D 幾何與招牌：** `src/visuals.ts` 及 `src/streetscape.ts` 中的原創程式化模型。招牌使用真實字體排版；所有商店名稱屬遊戲場景設定。
- **材質及細節更新：** `src/surfaces.ts` 的原創程式化路面、地磚、灰泥及瓷磚貼圖；加入凹凸表面、車漆與玻璃反光、圓潤車身、輪圈、冷氣機及門框。樓宇高度、外牆色、露台、店面、簷篷和 24 種橫向／直向／霓虹風格招牌有不同組合。
- **音樂：** `src/audio.ts` 中的原創 158 BPM breakbeat 音序，以 Web Audio 即時合成。
- **引擎／剎車／投幣／落車鐘／碰撞／車門／輪胎：** 原創 Web Audio 合成音效。
- **無語句驚呼：** `src/surprise-sound.ts` 產生四種原創短促合成音效，混合呼氣噪音、音高變化與共振音色。沒有中文語句，也不是真人錄音。本輪已移除所有 eSpeak NG WAV、生成腳本及瀏覽器語音合成呼叫。
- **交通燈及停站光效：** `src/glow.ts` 的原創 Canvas 漸層貼圖，使用加色混合；沒有使用 Crazy Taxi 的光效素材。
- **字體：** Noto Sans TC（SIL Open Font License 1.1），透過 `@fontsource/noto-sans-tc` 打包。授權文字見 `public/fonts/OFL.txt`。
- **程式依賴：** Three.js（MIT）、Rapier（Apache-2.0）、Vite／TypeScript 與各自依賴遵從其原有授權。

本作沒有使用 Crazy Taxi、電影 Fast & Furious 或其他遊戲的圖像、音樂、車輛資產及程式。
