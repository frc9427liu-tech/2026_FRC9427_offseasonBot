# 舊版模擬器 → Unity 移植清單(2026-09-25)

來源:`C:\FRC\VirtualJoystick`(Electron + three.js,v2.0.2,保留當備份,不動)。

## 可重用資產(公開,已在舊版 assets/)
| 檔案 | 大小 | 用途 |
|---|---|---|
| `assets/Field3d_2026FRCFieldV2/model.glb` + `config.json` | 18 MB | 2026 場地(AdvantageScope 官方場地模型) |
| `assets/Robot_2026FRCKitBotV2/model.glb` + `config.json` | 21 MB | KitBot,測試機器人 |

Unity 匯入 GLB:用 glTFast 套件(Unity Package Manager 裝)。

## 邏輯模組 → Unity 對應
| 舊檔 | 內容 | 移植方式 |
|---|---|---|
| `physics.js`(324 行) | 底盤馬達模型(TAU、A_MAX 抓地力、輪距、SCRUB)、方形車 vs 障礙物 SAT 碰撞、球滾動/球對球碰撞、飛行球(重力+空氣阻力)、HUB/網子/TOWER/TRENCH/BUMP 幾何 | 常數與公式直接搬成 C#;正式版改用 Unity 物理(Rigidbody/WheelCollider 或自寫底盤),但這份數值(HUB 1.19 m、入口 1.83 m、TRENCH 高 0.50 m…)是從官方模型量的,保留當校準基準。「示意」標記的參數(V_FREE、TAU、BALL_M…)之後用真機 log 校準 |
| `robotmap.js` | 機構對應:訊號來源(NT 路徑或 HAL SimDevice)→ 機構(driveL/R、arm、turret、flywheel、indexer、intake、orbit),存 `.robot-sim.json`;手臂擋塊模型;出球速度 = 輪周長 × 效率 | 資料格式(`.robot-sim.json`)原樣沿用,C# 端 `RobotMap` 類別讀同一個檔,舊專案設定不用重做 |
| `server.js` | 小 HTTP 伺服器 + `/api/project`(讀寫專案設定) | Unity 不需要;改成直接讀寫專案資料夾 |
| `view3d.js`(79 KB) | 場地/機器人載入、相機、後製 | **機器人載入寫死 KitBot(1455–1546 行)**:通用化 = 模型資料夾 + `robot-model.json`,Unity 用 Prefab/動態載入 GLB |
| `screen.js`、`keyboard.js` | 搖桿/鍵盤 UI | Unity 用 Input System |

## WPILib 連線(最關鍵,要能接真機/機器人程式)
- **HAL 模擬**:WebSocket `ws://host:3300/wpilibws`(WPILib `sim-ws.gradle` 開的伺服器)。送搖桿與啟用/停用,收 HAL 裝置資料(`halData['裝置種類 編號'] = {欄位:值}`,例如 SPARK MAX、Talon FX、PWM)
- **NetworkTables 4**:WebSocket `ws://host:5810/nt/<client>`,subprotocol `v4.1.networktables.first.wpi.edu`,MessagePack 編碼,讀 SmartDashboard 顯示機器人狀態
- Unity C#:`System.Net.WebSockets.ClientWebSocket` + MessagePack-CSharp;實作參考 `index.html` 第 606–760 行
- 訊號字串格式沿用:`nt:/SmartDashboard/xxx`、`hal:SimDevice SPARK MAX [6]|Applied Output`

## 建議 Unity 專案結構
```
Assets/
  Scenes/         Lobby(大廳,英雄聯盟風)、Field
  Scripts/
    Sim/          ChassisPhysics, Ball, Hub, Field2026(常數)
    Robot/        RobotMap, Mechanisms(Arm/Turret/Flywheel/Indexer/Intake)
    Net/          HalClient(3300), NtClient(5810)
    UI/           大廳、HUD、設定
  Models/         Field3d_2026FRCFieldV2, Robot_*(GLB)
  StreamingAssets/ .robot-sim.json 範例
```

## 第一個里程碑(建議)
1. 空 3D(URP)專案 + glTFast,載入場地與 KitBot GLB
2. 用 `physics.js` 的底盤公式做鍵盤開車 + 牆/HUB 碰撞
3. 接 WPILib HAL WebSocket(3300),機器人程式的 driveL/R 驅動車
4. 之後再做球、射球、大廳 UI

## 待你決定
- 賣給 FIRST:場地 CAD/資產授權要先問(AdvantageScope 資產的授權要確認)
- 線上對戰 netcode(Unity Netcode / Mirror / Photon)之後再選
