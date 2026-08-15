import { useState, useEffect, useRef } from "react";
import { Circle, CheckCircle2, GripHorizontal, Maximize2 } from "lucide-react";
import { motion } from "motion/react";

interface MeetingReminderWidgetProps {
  className?: string;
  enableDrag?: boolean;
  enableResize?: boolean;
}

export function MeetingReminderWidget({
  className = "",
  enableDrag = true,
  enableResize = true,
}: MeetingReminderWidgetProps) {
  const [hours, setHours] = useState("20");
  const [minutes, setMinutes] = useState("56");
  const [completed, setCompleted] = useState(false);

  // Resize state (default width: 220, height: 268)
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 220,
    height: 268,
  });
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 220,
    height: 268,
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setHours(now.getHours().toString().padStart(2, "0"));
      setMinutes(now.getMinutes().toString().padStart(2, "0"));
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // Handle pointer drag for resizing
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
      
      const newWidth = Math.max(160, Math.min(480, startPos.current.width + deltaX));
      const newHeight = Math.max(195, Math.min(580, startPos.current.height + deltaY));
      
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

  // Reset to default size
  const resetSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSize({ width: 220, height: 268 });
  };

  // Compute responsive scales based on size
  const scale = Math.min(size.width / 220, size.height / 268);
  const fontSizeTime = Math.round(50 * Math.max(0.8, Math.min(2.0, scale)));
  const avatarSize = Math.round(36 * Math.max(0.85, Math.min(1.8, scale)));
  const titleSize = Math.max(11, Math.min(22, 13.5 * scale));

  return (
    <motion.div
      drag={enableDrag && !isResizing}
      dragSnapToOrigin={false}
      dragElastic={0.15}
      whileHover={isResizing ? undefined : { scale: 1.015 }}
      whileDrag={{ scale: 1.03, rotate: 1, zIndex: 50, boxShadow: "0 25px 40px rgba(0,0,0,0.2)" }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      className={`relative rounded-[28px] bg-[#F8E728] text-black p-5 flex flex-col justify-between shadow-[0_12px_32px_rgba(248,231,40,0.35)] border border-yellow-300/50 select-none overflow-hidden cursor-grab active:cursor-grabbing group transition-all duration-75 ${className}`}
    >
      {/* Drag handle indicator top */}
      {enableDrag && !isResizing && (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-40 transition-opacity flex items-center justify-center pointer-events-none">
          <GripHorizontal className="w-4 h-4 text-black" />
        </div>
      )}

      {/* TOP HEADER */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {/* Yarn Ball / Icon Avatar Circle */}
          <div
            style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, fontSize: `${avatarSize * 0.55}px` }}
            className="rounded-full bg-[#E3D11E] flex items-center justify-center shadow-inner shrink-0 leading-none transition-all"
          >
            🧶
          </div>

          {/* Meeting Title Header */}
          <div
            style={{ fontSize: `${titleSize}px` }}
            className="flex flex-col text-black font-extrabold leading-[1.12] tracking-tight transition-all"
          >
            <span>You Have</span>
            <span>a Meeting</span>
          </div>
        </div>

        {/* Top Right Ring Status Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCompleted(!completed);
          }}
          className="p-0.5 hover:scale-110 active:scale-95 transition-transform cursor-pointer text-black/60 hover:text-black mt-0.5 z-20"
          title={completed ? "Mark incomplete" : "Mark completed"}
        >
          {completed ? (
            <CheckCircle2 className="w-4 h-4 text-black fill-black/20" />
          ) : (
            <Circle className="w-4 h-4 stroke-[2.5]" />
          )}
        </button>
      </div>

      {/* MIDDLE SPACER / BREATHING ROOM */}
      <div className="flex-1" />

      {/* BOTTOM SECTION */}
      <div className="relative z-10 space-y-1">
        {/* Time display: hours in solid black, minutes in translucent olive-black */}
        <div
          style={{ fontSize: `${fontSizeTime}px` }}
          className="flex items-baseline font-sans font-black tracking-tight leading-none select-none transition-all"
        >
          <span className="text-black font-black">{hours}</span>
          <span className="text-[#847B1A] font-extrabold">:{minutes}</span>
        </div>

        {/* Meeting Event Name */}
        <div
          style={{ fontSize: `${Math.max(12, Math.min(22, 14.5 * scale))}px` }}
          className="font-extrabold text-black tracking-tight pt-0.5 transition-all"
        >
          Development call
        </div>
      </div>

      {/* RESIZE HANDLE BOTTOM-RIGHT */}
      {enableResize && (
        <div
          onPointerDown={handleResizeStart}
          onDoubleClick={resetSize}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-br-2xl flex items-center justify-center cursor-se-resize opacity-20 group-hover:opacity-80 hover:opacity-100 transition-opacity z-30"
          title="Drag to resize card, double click to reset"
        >
          <Maximize2 className="w-3.5 h-3.5 text-black rotate-90 stroke-[2.5]" />
        </div>
      )}
    </motion.div>
  );
}


