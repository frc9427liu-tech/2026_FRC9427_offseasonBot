// UI language. The interface is written in Traditional Chinese; t() swaps each visible string for its
// translation when another language is selected (keyed by the Chinese text itself, so a string without an
// entry just stays Chinese instead of breaking). The choice is remembered in the browser.
export const LANGS = ['繁體中文', 'English'];
const STORE = 'sim.lang';

let lang = (() => { try { const l = localStorage.getItem(STORE); return LANGS.includes(l) ? l : LANGS[0]; } catch { return LANGS[0]; } })();
export const getLang = () => lang;
export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  try { localStorage.setItem(STORE, l); } catch { /* no storage: this session only */ }
  document.documentElement.lang = l === 'English' ? 'en' : 'zh-Hant';
}
document.documentElement.lang = lang === 'English' ? 'en' : 'zh-Hant';

const EN = {
  // dock / lobby
  機器人: 'Robot', 場地: 'Field', 操作: 'Controls', 設定: 'Settings',
  新手教學: 'Tutorial', '5 分鐘學會操作': 'Learn the controls in 5 minutes', 'Fuel / Hub / Tower 規則': 'Fuel / Hub / Tower rules',
  線上房間: 'Online rooms', 離開: 'Exit', 自由: 'Free', 駕駛員: 'Driver', 跟車: 'Follow', 即將開放: 'Coming soon', 模式選擇: 'Select mode',
  // modes
  比賽: 'Match', 正式比賽: 'Official match', 資格賽: 'Qualification', '3v3 · 完整計分 · 2:40': '3v3 · full scoring · 2:40',
  單機器人: 'Solo robot', '1v0 · 練習計分': '1v0 · practice scoring',
  練習: 'Practice', 自由練習: 'Free practice', '空場 · 無時限': 'Empty field · no time limit',
  投射訓練: 'Shooting drill', 'Hub 靶 · 統計命中率': 'Hub target · hit rate', 爬升訓練: 'Climb drill', 'Tower 三段': 'Tower, 3 levels',
  自動: 'Auto', 路徑測試: 'Path test', '自動賽 20s': 'Autonomous 20s', 完整自動階段: 'Full autonomous period',
  線上: 'Online', 快速配對: 'Quick match', '房間 ID': 'Room ID',
  // robot
  外觀模型: 'Model', 目前模型: 'Current model', 之後匯入: 'Imported later', '之後匯入 Onshape': 'Onshape import coming later',
  簡化方塊: 'Simple block', 顏色: 'Colour', 聯盟色: 'Alliance colour',
  程式與按鍵: 'Code & bindings', 換一個專案: 'Change project', 選擇專案資料夾: 'Choose project folder', '等待選擇…': 'Waiting for a folder…', 切換: 'Switch', 無法載入: 'Could not load', 未選擇: 'None selected', '見「操作」頁': 'See the Controls page',
  導入程式碼: 'Import code', '選擇中…': 'Selecting…',
  '跳出資料夾視窗，選有 gradlew 的那一層；選好會自動重新啟動機器人程式': 'Opens a folder dialog - pick the folder with gradlew; the robot program restarts automatically', 機器人程式: 'Robot program', 目前使用: 'In use', 按鍵綁定: 'Button bindings',
  '自動從 RobotContainer 讀取': 'Read automatically from RobotContainer', 尚未連線: 'Not connected',
  機構描述: 'Mechanisms', 狀態: 'Status', 等待橋接程式: 'Waiting for the bridge', 說明: 'About',
  '吸球、發射、碰撞都照這裡算；訊號從機器人程式實際送出的數值挑。改了立刻存檔（sim-app/mechanisms/）':
    'Intake, shooting and collisions all use these values; signals are picked from what the robot code actually publishes. Changes save immediately (sim-app/mechanisms/).',
  車身: 'Chassis', 長度: 'Length', 寬度: 'Width', 高度: 'Height', 最多存球: 'Max stored fuel', 顆: 'balls',
  'm，含保險桿': 'm, including bumpers', 'm，球從上面彈開的高度': 'm, height fuel bounces off',
  吸球: 'Intake', 吸球訊號: 'Intake signal', '超過門檻時吸球口開啟；數值同時當作吸球口伸出量': 'Intake is open above the threshold; the value also sets how far it extends',
  門檻: 'Threshold', 吸球口寬: 'Intake width', 吸球口伸出: 'Intake reach', 'm，保險桿前方': 'm, in front of the bumper',
  伸出倍率: 'Extension scale', '訊號每 1 單位多伸出幾 m': 'metres of extension per unit of signal',
  發射: 'Shooter', 送球訊號: 'Feed signal', '超過門檻時一顆顆送進飛輪（建議選把球推進飛輪的馬達）': 'Fuel is fed one by one above the threshold (pick the motor that pushes fuel into the flywheel)',
  '馬達為 rev/s': 'rev/s for a motor', 飛輪轉速: 'Flywheel speed', 'Hood 角度': 'Hood angle', 度: 'deg',
  仰角基準: 'Elevation base', '出射仰角 = 基準 − 倍率 × hood 角度（度）': 'launch elevation = base − scale × hood angle (deg)', 'Hood 倍率': 'Hood scale', 'hood 每轉 1 度，出射仰角變幾度': 'degrees of launch elevation per degree of hood',
  飛輪半徑: 'Flywheel radius', 球速效率: 'Speed efficiency', '球速 = 效率 × 輪緣速度': 'fuel speed = efficiency × wheel surface speed',
  射速: 'Fire rate', '顆/秒': 'balls/s', 左右散布: 'Spread', '發射點 前後': 'Launch point X', '發射點 左右': 'Launch point Y', '發射點 高度': 'Launch point height',
  'm，車身中心往前為正': 'm, forward from robot centre is +', 'm，往左為正': 'm, left is +',
  '視覺（Limelight 模擬，名稱從程式自動找）': 'Vision (Limelight sim, names found in the code)',
  '鏡頭位置 前後': 'Camera X', '鏡頭位置 左右': 'Camera Y', 鏡頭高度: 'Camera height', 鏡頭朝向: 'Camera yaw',
  '度，0 = 朝車頭，180 = 朝車尾': 'deg, 0 = facing front, 180 = facing back', 水平視角: 'Horizontal FOV', '度（LL3 約 62.5）': 'deg (LL3 ≈ 62.5)',
  最遠辨識距離: 'Max detection range', '（未設定）': '(not set)', 目前沒有數值: 'no value right now',
  // field
  規則: 'Rules', 賽季: 'Season', 計分: 'Scoring', '官方（可自訂）': 'Official (customisable)', 官方: 'Official',
  'Fuel 球': 'Fuel', 直徑: 'Diameter', 質量: 'Mass', 總數: 'Total',
  鏡頭: 'Camera', 預設鏡頭: 'Default camera', 總覽: 'Overview', 俯視: 'Top down', 藍方: 'Blue', 紅方: 'Red',
  // controls
  程式的操作: 'From the code', '從機器人原始碼自動分析,程式一改就更新': 'Analysed from the robot source; updates whenever the code changes',
  尚未連線橋接程式: 'Bridge not connected', 尚未分析: 'Not analysed yet', 控制器: 'Controllers', 未找到: 'None found',
  恢復預設按鍵: 'Restore default keys', 重設: 'Reset', '按下按鍵…': 'Press a key…',
  鍵盤: 'Keyboard', 重新綁鍵: 'Rebind keys', '在「程式的操作」頁點按鍵按鈕,再按新的鍵(Esc 取消)': 'On the "From the code" page click a key button, then press the new key (Esc cancels)',
  已存在瀏覽器: 'Saved in this browser', 手把: 'Gamepad', 移動: 'Move', 旋轉: 'Rotate', 左搖桿: 'Left stick', 右搖桿: 'Right stick',
  觸控: 'Touch', 螢幕操作: 'On-screen controls', 版面依機器人程式用到的搖桿與按鈕自動產生: 'Layout generated from the sticks and buttons the robot code uses',
  開: 'On', 關: 'Off',
  '左搖桿 左右': 'Left stick X', '左搖桿 前後': 'Left stick Y', '右搖桿 左右': 'Right stick X', '右搖桿 前後': 'Right stick Y',
  左板機: 'Left trigger', 右板機: 'Right trigger', 'A 鍵': 'A', 'B 鍵': 'B', 'X 鍵': 'X', 'Y 鍵': 'Y', '左肩鍵 LB': 'LB', '右肩鍵 RB': 'RB',
  '十字鍵 上': 'D-pad up', '十字鍵 下': 'D-pad down', '十字鍵 左': 'D-pad left', '十字鍵 右': 'D-pad right',
  按下時: 'On press', 按住時: 'While held', 放開時: 'On release', 未按時: 'While released', 按一下切換: 'Toggle on press',
  前後移動: 'Drive forward/back', 左右平移: 'Strafe left/right',
  // settings
  畫面: 'Display', 畫質: 'Quality', 影響效能: 'Affects performance', 人群密度: 'Crowd density', 自動會依流暢度調整: 'Auto adjusts to keep it smooth',
  陰影: 'Shadows', 垂直同步: 'V-sync', 低: 'Low', 中: 'Medium', 高: 'High',
  介面: 'Interface', 語言: 'Language', Language: '', 提示文字: 'Hints', 顯示操作提示: 'Show control hints', 單位: 'Units', 英制: 'Imperial', 公制: 'Metric',
  音效: 'Audio', 音量: 'Volume', 靜音: 'Mute', 網路: 'Network', 伺服器: 'Server', 線上功能開放後設定: 'Set up once online play opens', 未設定: 'Not set',
};

export function t(s) {
  if (lang === LANGS[0] || s == null) return s;
  return EN[s] ?? s;
}
// strings with a value inside
export const tf = {
  scanned: (n) => (lang === 'English' ? `${n} source files scanned` : `共掃描 ${n} 個原始檔`),
  readIn: (where) => (lang === 'English' ? `read in ${where}` : `讀取於 ${where}`),
  motor: (name) => (lang === 'English' ? `Motor ${name}` : `馬達 ${name}`),
  current: (v) => (lang === 'English' ? `now ${v}` : `目前 ${v}`),
};
