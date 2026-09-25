using System;

namespace FrcSim
{
    /// <summary>
    /// 底盤物理,從舊版 physics.js 的 drive() 原樣移植(不依賴 Unity,純 C#,可單元測試)。
    /// 馬達特性 + 抓地力加速度上限 + 坦克式原地轉的輪胎打滑;方形車跟牆/HUB/TOWER/TRENCH 用分離軸定理擋住。
    /// 標「示意」的參數之後要用真機 log 校準。
    /// </summary>
    public class ChassisPhysics
    {
        // ---------- 參數 ----------
        public float RobotHalf = 0.43f;   // 含保險桿半邊長(m)
        public float VFree = 4.4f;        // 示意:全出力極速 m/s
        public float Tau = 0.28f;         // 示意:馬達加速時間常數 s
        public float AMax = 7.5f;         // 輪胎抓地力上限 m/s²(約 0.75 g)
        public float Track = 0.62f;       // 左右輪距
        public float Scrub = 1.3f;        // 原地轉的輪胎側滑
        public float BumpSlow = 0.7f;     // 上 BUMP 速度打折

        // ---------- 狀態 ----------
        public float X, Y, Th;            // 場地座標(m)、朝向(rad,逆時針)
        public float VL, VR, V, W;        // 左右輪速、車速、角速度
        public bool Blocked;

        public ChassisPhysics(float x, float y, float th) { X = x; Y = y; Th = th; }

        public bool OnBump()
        {
            foreach (var b in Field2026.Bumps)
                if (X > b.x0 && X < b.x1 && Y > b.y0 && Y < b.y1) return true;
            return false;
        }

        struct Contact { public float nx, ny, depth; }

        // 方形車(會轉)跟方框:分離軸定理,回傳要把車推出去的方向和深度;沒碰到回 null
        Contact? ObbVsBox(float cx, float cy, float th, in Box o)
        {
            float ux = MathF.Cos(th), uy = -MathF.Sin(th), vx = MathF.Sin(th), vy = MathF.Cos(th);
            float bx = (o.x0 + o.x1) / 2, by = (o.y0 + o.y1) / 2, hx = (o.x1 - o.x0) / 2, hy = (o.y1 - o.y0) / 2;
            float dx = bx - cx, dy = by - cy;
            Contact? best = null;
            var axes = new (float, float)[] { (1, 0), (0, 1), (ux, uy), (vx, vy) };
            foreach (var (ax, ay) in axes)
            {
                float rR = RobotHalf * (MathF.Abs(ux * ax + uy * ay) + MathF.Abs(vx * ax + vy * ay));
                float rB = hx * MathF.Abs(ax) + hy * MathF.Abs(ay);
                float d = dx * ax + dy * ay;
                float ov = rR + rB - MathF.Abs(d);
                if (ov <= 0) return null;
                if (best == null || ov < best.Value.depth)
                {
                    float sg = d == 0 ? 1 : MathF.Sign(d);
                    best = new Contact { nx = -sg * ax, ny = -sg * ay, depth = ov };
                }
            }
            return best;
        }

        /// <summary>L、R = 左右輪出力 −1~1;dt 秒。呼叫一次推進一步。</summary>
        public void Drive(float L, float R, float dt)
        {
            float slow = OnBump() ? BumpSlow : 1f;
            // 馬達:目標速度 = 出力 × 極速,越接近越難加速;再被抓地力上限卡住
            float Acc(float target, float v) => Math.Clamp((target - v) / Tau, -AMax, AMax);
            VL += Acc(L * VFree * slow, VL) * dt;
            VR += Acc(R * VFree * slow, VR) * dt;
            float v = (VL + VR) / 2, w = (VR - VL) / (Track * Scrub);
            Th += w * dt;
            X += v * MathF.Cos(Th) * dt;
            Y -= v * MathF.Sin(Th) * dt;

            // 碰撞:牆 + 障礙物,推出去後把「往障礙物裡鑽」的速度吃掉(輪子打滑)
            Blocked = false;
            var hitN = new System.Collections.Generic.List<(float, float)>();
            float ext = RobotHalf * (MathF.Abs(MathF.Cos(Th)) + MathF.Abs(MathF.Sin(Th)));
            if (X < ext) { X = ext; hitN.Add((1, 0)); }
            if (X > Field2026.W - ext) { X = Field2026.W - ext; hitN.Add((-1, 0)); }
            if (Y < ext) { Y = ext; hitN.Add((0, 1)); }
            if (Y > Field2026.H - ext) { Y = Field2026.H - ext; hitN.Add((0, -1)); }
            foreach (var o in Field2026.Obstacles)
            {
                var c = ObbVsBox(X, Y, Th, o);
                if (c.HasValue) { X += c.Value.nx * c.Value.depth; Y += c.Value.ny * c.Value.depth; hitN.Add((c.Value.nx, c.Value.ny)); }
            }
            if (hitN.Count > 0)
            {
                Blocked = true;
                float hx = MathF.Cos(Th), hy = -MathF.Sin(Th);
                foreach (var (nx, ny) in hitN)
                {
                    float c = hx * nx + hy * ny;              // 車頭跟牆面法線的夾角
                    if (v * c < 0) v *= 1 - c * c;            // 正面撞 = 停住;斜擦 = 保留大部分速度
                }
                VL = v - w * Track * Scrub / 2;
                VR = v + w * Track * Scrub / 2;
            }
            V = v; W = w;
        }
    }
}
