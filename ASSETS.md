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

## 隨遊戲分發的素材

- **3D 幾何與招牌：** `src/visuals.ts` 中的原創程式化模型。招牌使用真實字體排版；所有商店名稱屬遊戲場景設定。
- **材質及細節更新：** `src/surfaces.ts` 的原創程式化路面、地磚、灰泥及瓷磚貼圖；加入凹凸表面、車漆與玻璃反光、圓潤車身、輪圈、冷氣機及門框。樓宇高度、外牆色、露台、店面、簷篷和 24 種橫向／直向／霓虹風格招牌有不同組合。
- **音樂：** `src/audio.ts` 中的原創 158 BPM breakbeat 音序，以 Web Audio 即時合成。
- **引擎／剎車／投幣／碰撞／車門：** 原創 Web Audio 合成音效。
- **粵語：** 原創短句經 eSpeak NG 生成的 WAV 音檔，生成工具為 `scripts/generate-voices.mjs`。eSpeak NG 不隨遊戲執行時分發。語音屬合成聲，並非真人錄音。
- **字體：** Noto Sans TC（SIL Open Font License 1.1），透過 `@fontsource/noto-sans-tc` 打包。授權文字見 `public/fonts/OFL.txt`。
- **程式依賴：** Three.js（MIT）、Rapier（Apache-2.0）、Vite／TypeScript 與各自依賴遵從其原有授權。

本作沒有使用 Crazy Taxi、電影 Fast & Furious 或其他遊戲的圖像、音樂、車輛資產及程式。
