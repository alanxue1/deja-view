"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import HoverPreview3D from "@/components/three/HoverPreview3D";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomSelect?: (modelPath: string) => void;
}

// Model path mapping for spaces and products
const MODEL_PATHS: Record<string, string> = {
  "David's Bedroom": "/davidsbedroom.glb",
  "Uoft Student Dorm": "/uoft-student-dorm.glb",
  "Orange Chair": "/uoft-dorm-common-area.glb", // Placeholder - replace with actual model path
  "Purple table": "/uoft-dorm-common-area.glb", // Placeholder - replace with actual model path
  "Green Terracotta Plant": "/uoft-dorm-common-area.glb", // Placeholder - replace with actual model path
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onRoomSelect }) => {
  const router = useRouter();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const dormButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSpacesClick = () => {
    router.push("/upload");
    onClose();
  };

  const handleRoomClick = (roomName: string) => {
    const modelPath = MODEL_PATHS[roomName];
    if (modelPath && onRoomSelect) {
      // We're on /room page - switch room directly
      onRoomSelect(modelPath);
      onClose();
    } else if (modelPath) {
      // Navigate to /room with the model path as query param
      router.push(`/room?model=${encodeURIComponent(modelPath)}`);
      onClose();
    } else {
      // Fallback to upload if no model path
      router.push("/upload");
      onClose();
    }
  };

  // Disable pointer events on background canvas when sidebar is open
  React.useEffect(() => {
    if (isOpen) {
      // Find all canvas elements and disable their pointer events
      const canvases = document.querySelectorAll('canvas');
      const originalStyles: string[] = [];
      canvases.forEach((canvas, index) => {
        originalStyles[index] = (canvas as HTMLElement).style.pointerEvents || '';
        (canvas as HTMLElement).style.pointerEvents = 'none';
      });
      
      return () => {
        // Restore original pointer events when sidebar closes
        canvases.forEach((canvas, index) => {
          (canvas as HTMLElement).style.pointerEvents = originalStyles[index] || '';
        });
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-sm"
            onClick={onClose}
            style={{ pointerEvents: 'auto' }}
          />
          
          {/* Sidebar */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 40,
              mass: 1.2
            }}
            className="glass-card fixed left-0 top-0 h-full z-[100] select-none"
            style={{ borderRadius: "0 16px 16px 0", width: "312px", height: "100vh", userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', pointerEvents: 'auto', overflow: 'visible' }}
          >
        <div className="flex flex-col h-full select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', pointerEvents: 'auto', paddingLeft: '42px', paddingTop: '24px', paddingRight: '24px', paddingBottom: '24px' }}>
          {/* Spaces Section */}
          <div className="mb-12 mt-20">
            <h2 className="text-3xl font-serif font-bold text-white mb-6 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Spaces</h2>
            <ul className="space-y-4 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
              <li className="relative" style={{ pointerEvents: 'auto', zIndex: 102 }}>
                <button
                  onClick={() => handleRoomClick("David's Bedroom")}
                  onMouseEnter={() => setHoveredItem("David's Bedroom")}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="text-base cursor-pointer bg-transparent border-0 p-0 transition-colors duration-200 hover:opacity-70 select-none relative z-[102]"
                  style={{
                    color: hoveredItem === "David's Bedroom" ? "#ff7c12" : "#ffffff",
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: 'auto',
                    position: 'relative'
                  }}
                  data-cursor="hover"
                >
                  David&apos;s Bedroom
                </button>
                {hoveredItem === "David's Bedroom" && MODEL_PATHS["David's Bedroom"] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HoverPreview3D
                      modelPath={MODEL_PATHS["David's Bedroom"]}
                      visible={true}
                    />
                  </motion.div>
                )}
              </li>
              <li className="relative" style={{ pointerEvents: 'auto', zIndex: 102 }}>
                <button
                  ref={dormButtonRef}
                  onClick={() => handleRoomClick("Uoft Student Dorm")}
                  onMouseEnter={() => setHoveredItem("Uoft Student Dorm")}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="text-base cursor-pointer bg-transparent border-0 p-0 transition-colors duration-200 hover:opacity-70 select-none relative z-[102]"
                  style={{
                    color: hoveredItem === "Uoft Student Dorm" ? "#ff7c12" : "#ffffff",
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: 'auto',
                    position: 'relative'
                  }}
                  data-cursor="hover"
                >
                  Uoft Student Dorm
                </button>
                {hoveredItem === "Uoft Student Dorm" && MODEL_PATHS["Uoft Student Dorm"] && (
                  <HoverPreview3D
                    modelPath={MODEL_PATHS["Uoft Student Dorm"]}
                    visible={true}
                    parentElement={dormButtonRef.current}
                  />
                )}
              </li>
              <li className="relative" style={{ pointerEvents: 'auto', zIndex: 102 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpacesClick();
                  }}
                  className="text-white hover:opacity-70 transition-opacity flex items-center gap-2 cursor-pointer bg-transparent border-0 p-0 select-none relative z-[102]"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto', position: 'relative' }}
                  data-cursor="hover"
                >
                  <Plus size={20} />
                </button>
              </li>
            </ul>
          </div>

          {/* Products Section */}
          <div>
            <h2 className="text-3xl font-serif font-bold text-white mb-6 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Products</h2>
            <ul className="space-y-4 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
              <li className="relative">
                <button
                  onMouseEnter={() => setHoveredItem("Orange Chair")}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="text-base cursor-pointer bg-transparent border-0 p-0 transition-colors duration-200 hover:opacity-70 select-none"
                  style={{
                    color: hoveredItem === "Orange Chair" ? "#ff7c12" : "#ffffff",
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                  }}
                  data-cursor="hover"
                >
                  Orange Chair
                </button>
                {hoveredItem === "Orange Chair" && MODEL_PATHS["Orange Chair"] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HoverPreview3D
                      modelPath={MODEL_PATHS["Orange Chair"]}
                      visible={true}
                    />
                  </motion.div>
                )}
              </li>
              <li className="relative">
                <button
                  onMouseEnter={() => setHoveredItem("Purple table")}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="text-base cursor-pointer bg-transparent border-0 p-0 transition-colors duration-200 hover:opacity-70 select-none"
                  style={{
                    color: hoveredItem === "Purple table" ? "#ff7c12" : "#ffffff",
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                  }}
                  data-cursor="hover"
                >
                  Purple table
                </button>
                {hoveredItem === "Purple table" && MODEL_PATHS["Purple table"] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HoverPreview3D
                      modelPath={MODEL_PATHS["Purple table"]}
                      visible={true}
                    />
                  </motion.div>
                )}
              </li>
              <li className="relative">
                <button
                  onMouseEnter={() => setHoveredItem("Green Terracotta Plant")}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="text-base cursor-pointer bg-transparent border-0 p-0 transition-colors duration-200 hover:opacity-70 select-none"
                  style={{
                    color: hoveredItem === "Green Terracotta Plant" ? "#ff7c12" : "#ffffff",
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                  }}
                  data-cursor="hover"
                >
                  Green Terracotta Plant
                </button>
                {hoveredItem === "Green Terracotta Plant" && MODEL_PATHS["Green Terracotta Plant"] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HoverPreview3D
                      modelPath={MODEL_PATHS["Green Terracotta Plant"]}
                      visible={true}
                    />
                  </motion.div>
                )}
              </li>
            </ul>
          </div>
        </div>
      </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
