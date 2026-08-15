import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Sun,
  Cloud,
  Globe,
  Heart,
  Plus,
  Home,
  CloudSun,
  GripHorizontal,
  Maximize2,
} from "lucide-react";
import { motion } from "motion/react";

interface GlassWeatherWidgetProps {
  className?: string;
  enableDrag?: boolean;
  enableResize?: boolean;
}

export function GlassWeatherWidget({
  className = "",
  enableDrag = true,
  enableResize = true,
}: GlassWeatherWidgetProps) {
  const [activeTab, setActiveTab] = useState<"home" | "weather" | "globe" | "heart">("weather");
  const [liked, setLiked] = useState(false);
  const [currentTime, setCurrentTime] = useState("11:21 AM");

  // Resize state (default width: 340, height: 390)
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 340,
    height: 390,
  });
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 340,
    height: 390,
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      const newWidth = Math.max(260, Math.min(600, startPos.current.width + deltaX));
      const newHeight = Math.max(300, Math.min(650, startPos.current.height + deltaY));

      setSize({ width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const resetSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSize({ width: 340, height: 390 });
  };

  return (
    <motion.div
      drag={enableDrag && !isResizing}
      dragSnapToOrigin={false}
      dragElastic={0.15}
      whileHover={isResizing ? undefined : { scale: 1.01 }}
      whileDrag={{ scale: 1.03, rotate: -1, zIndex: 50, boxShadow: "0 25px 40px rgba(0,0,0,0.25)" }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: `linear-gradient(175deg, #4b8cd9 0%, #7db0ee 28%, #b8d7fb 52%, #eaf2fc 78%, #f4f8fe 100%)`,
      }}
      className={`relative rounded-[36px] overflow-hidden p-5 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/60 select-none cursor-grab active:cursor-grabbing group transition-all duration-75 ${className}`}
    >
      {/* Drag handle indicator */}
      {enableDrag && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-40 transition-opacity flex items-center justify-center pointer-events-none z-30">
          <GripHorizontal className="w-4 h-4 text-white" />
        </div>
      )}
      {/* Sun glow effect top left */}
      <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-gradient-to-br from-amber-300/80 via-yellow-200/50 to-transparent blur-2xl pointer-events-none" />

      {/* Glass overlay background lighting */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px] pointer-events-none" />

      {/* TOP HEADER */}
      <div className="relative z-10 flex items-center justify-between">
        {/* Top Left Glowing 3D Sun */}
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-100 shadow-[0_0_25px_rgba(251,191,36,0.8)] border border-yellow-100/60" />
          <div className="absolute inset-0 rounded-full bg-amber-300/40 animate-pulse blur-sm" />
        </div>

        {/* Top Center Location */}
        <div className="flex items-center gap-1.5 text-white/90 text-xs font-medium tracking-wide drop-shadow-xs">
          <MapPin className="w-3.5 h-3.5 fill-white/30 text-white" />
          <span>Calicut, Kerala</span>
        </div>

        {/* Top Right Avatar */}
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/80 shadow-sm shrink-0">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            alt="Profile Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* MIDDLE SECTION: TEMPERATURE & PARABOLIC SUN TRAJECTORY */}
      <div className="relative z-10 my-auto py-2">
        <div className="grid grid-cols-12 items-center">
          {/* Left: Temp & Condition */}
          <div className="col-span-4 space-y-0.5">
            <div className="text-5xl font-extralight text-white tracking-tighter drop-shadow-sm font-sans">
              28°
            </div>
            <div className="text-xs font-medium text-white/90 tracking-wide">
              Pretty Sunny
            </div>
          </div>

          {/* Right: Parabolic Dotted Arc with Sun Dot */}
          <div className="col-span-8 relative h-24 flex items-center justify-center">
            {/* SVG Parabolic Curve */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 180 80">
              <path
                d="M 10 70 Q 90 -10 170 70"
                fill="none"
                stroke="rgba(255, 255, 255, 0.65)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </svg>

            {/* Sun Orb on Path */}
            <div
              className="absolute w-5 h-5 rounded-full bg-white/40 border border-white/90 backdrop-blur-md shadow-md flex items-center justify-center"
              style={{ top: "22%", left: "28%" }}
            >
              <div className="w-2 h-2 rounded-full bg-white shadow-xs" />
            </div>

            {/* Time label under apex */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/85 tracking-wider">
              {currentTime}
            </div>

            {/* Date on right */}
            <div className="absolute bottom-1 right-0 text-[11px] font-medium text-white/85 tracking-wider">
              Feb 2, 2025
            </div>
          </div>
        </div>
      </div>

      {/* METRIC CARDS SECTION */}
      <div className="relative z-10 grid grid-cols-2 gap-3 mb-3">
        {/* Card 1: Air Quality Index */}
        <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-[22px] p-3.5 shadow-[0_8px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Air Quality Index</span>
            <Sun className="w-4 h-4 text-slate-600" />
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none">
                72
              </div>
              <div className="text-[10px] font-medium text-slate-500 mt-1">
                Moderate
              </div>
            </div>

            {/* Gradient Rainbow Slider Bar */}
            <div className="relative w-20 h-2.5 rounded-full overflow-hidden bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 to-purple-600 shadow-inner">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-3.5 bg-white/90 rounded-full border border-slate-300 shadow-sm"
                style={{ left: "45%" }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Cloud Cover */}
        <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-[22px] p-3.5 shadow-[0_8px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Cloud Cover</span>
            <Cloud className="w-4 h-4 text-slate-600" />
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none">
                5%
              </div>
              <div className="text-[10px] font-medium text-slate-500 mt-1">
                Clean
              </div>
            </div>

            {/* Blue Progress Bar */}
            <div className="relative w-20 h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
              <div className="h-full w-[20%] bg-sky-500 rounded-full shadow-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION DOCK */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        {/* Main Glass Pill Dock */}
        <div className="flex-1 bg-white/75 backdrop-blur-lg border border-white/90 rounded-full h-12 px-4 flex items-center justify-around shadow-[0_8px_25px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setActiveTab("home")}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              activeTab === "home"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Home className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={() => setActiveTab("weather")}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              activeTab === "weather"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <CloudSun className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab("globe")}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              activeTab === "globe"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setActiveTab("heart");
              setLiked(!liked);
            }}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              activeTab === "heart" || liked
                ? "text-rose-500"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-rose-500" : ""}`} />
          </button>
        </div>

        {/* Plus Action Button */}
        <button
          className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-lg border border-white/90 shadow-[0_8px_25px_rgba(0,0,0,0.06)] flex items-center justify-center text-slate-800 hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          title="Add location / widget"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* RESIZE HANDLE BOTTOM-RIGHT */}
      {enableResize && (
        <div
          onPointerDown={handleResizeStart}
          onDoubleClick={resetSize}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-br-3xl flex items-center justify-center cursor-se-resize opacity-20 group-hover:opacity-80 hover:opacity-100 transition-opacity z-30"
          title="Drag to resize card, double click to reset"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-800 rotate-90 stroke-[2.5]" />
        </div>
      )}
    </motion.div>
  );
}
