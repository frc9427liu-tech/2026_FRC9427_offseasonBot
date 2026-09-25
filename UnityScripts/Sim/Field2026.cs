using System.Collections.Generic;

namespace FrcSim
{
    /// <summary>軸對齊方框障礙物(場地座標:公尺;x 往右、y 往下,跟舊版 physics.js 相同)。</summary>
    public struct Box
    {
        public float x0, y0, x1, y1, h;
        public bool isHub;
        public Hub hub;
    }

    public struct Hub
    {
        public float x, y;
    }

    /// <summary>
    /// 2026 場地常數,全部從舊版 physics.js / screen.js 搬來(官方 AdvantageScope 場地模型量出來的)。
    /// 座標系沿用舊版:x 往右、y 往下、th 逆時針(車頭 = (cos th, -sin th))。
    /// 放進 Unity 場景時再轉換(場景是 Y 向上):Unity 位置 = (x, 0, -y),偏航角 = th 對應繞 Y 軸。
    /// </summary>
    public static class Field2026
    {
        public const float W = 16.54f, H = 8.07f;
        public const float HubTop = 1.83f;       // HUB 入口高度(72 英寸)
        public const float BallR = 0.075f;
        public const int MaxHeld = 40;

        public const float HubHalf = 0.595f;     // HUB 本體 1.19 m 見方
        public const float TowerH = 1.99f;
        public const float TrenchH = 0.50f;

        public static readonly Hub[] Hubs =
        {
            new Hub { x = 4.625f, y = H / 2 },
            new Hub { x = W - 4.625f, y = H / 2 },
        };

        /// <summary>HUB 本體、兩座 TOWER、四個 TRENCH 底座。</summary>
        public static readonly List<Box> Obstacles = BuildObstacles();

        /// <summary>BUMP 斜坡(車開上去速度打折)。</summary>
        public static readonly List<Box> Bumps = BuildBumps();

        static List<Box> BuildObstacles()
        {
            var l = new List<Box>();
            foreach (var h in Hubs)
                l.Add(new Box { x0 = h.x - HubHalf, y0 = h.y - HubHalf, x1 = h.x + HubHalf, y1 = h.y + HubHalf, h = HubTop, isHub = true, hub = h });
            l.Add(new Box { x0 = 0, y0 = 3.695f, x1 = 1.14f, y1 = 4.945f, h = TowerH });                       // 藍方 TOWER
            l.Add(new Box { x0 = W - 1.14f, y0 = H - 4.945f, x1 = W, y1 = H - 3.695f, h = TowerH });           // 紅方 TOWER(點對稱)
            foreach (var h in Hubs)
            {
                l.Add(new Box { x0 = h.x - HubHalf, x1 = h.x + HubHalf, y0 = h.y + 2.455f, y1 = h.y + 2.755f, h = TrenchH });
                l.Add(new Box { x0 = h.x - HubHalf, x1 = h.x + HubHalf, y0 = h.y - 2.755f, y1 = h.y - 2.455f, h = TrenchH });
            }
            return l;
        }

        static List<Box> BuildBumps()
        {
            var l = new List<Box>();
            foreach (var h in Hubs)
            {
                l.Add(new Box { x0 = h.x - 0.565f, x1 = h.x + 0.565f, y0 = h.y + 0.52f, y1 = h.y + 2.75f });
                l.Add(new Box { x0 = h.x - 0.565f, x1 = h.x + 0.565f, y0 = h.y - 2.75f, y1 = h.y - 0.52f });
            }
            return l;
        }
    }
}
