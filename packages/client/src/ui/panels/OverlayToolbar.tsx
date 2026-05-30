import { Box, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { Pencil, MoveRight, MapPin, StickyNote, Trash2 } from "lucide-react";
import { useUIStore } from "@/state/stores/uiStore";
import { PLAYER_OVERLAY_COLORS, DM_OVERLAY_COLOR } from "@vt/data";
import React from "react";

const TOOLS = [
  { id: "pen" as const, icon: Pencil, label: "画笔 (D)", shortcut: "D" },
  { id: "arrow" as const, icon: MoveRight, label: "箭头 (A)", shortcut: "A" },
  { id: "ping" as const, icon: MapPin, label: "信标 (P)", shortcut: "P" },
  { id: "note" as const, icon: StickyNote, label: "标注 (T)", shortcut: "T" },
];

const COLORS = [...PLAYER_OVERLAY_COLORS, DM_OVERLAY_COLOR];

interface OverlayToolbarProps {
  onClearMyAnnotations?: () => void;
}

export const OverlayToolbar: React.FC<OverlayToolbarProps> = ({ onClearMyAnnotations }) => {
  const overlayMode = useUIStore((s) => s.overlayMode);
  const overlayColor = useUIStore((s) => s.overlayColor);
  const setOverlayMode = useUIStore((s) => s.setOverlayMode);
  const setOverlayColor = useUIStore((s) => s.setOverlayColor);

  return (
    <Box style={{
      position: "absolute", top: 8, left: 8, zIndex: 100,
      background: "rgba(10, 14, 20, 0.85)", borderRadius: 8,
      border: "1px solid rgba(74, 158, 255, 0.15)",
      padding: "4px 8px",
    }}>
      <Flex align="center" gap="1">
        {TOOLS.map((tool) => {
          const active = overlayMode === tool.id;
          return (
            <Tooltip key={tool.id} content={tool.label}>
              <IconButton
                size="1" variant={active ? "solid" : "ghost"}
                color={active ? "blue" : "gray"}
                onClick={() => setOverlayMode(active ? "none" : tool.id)}
              >
                <tool.icon size={14} />
              </IconButton>
            </Tooltip>
          );
        })}
        <Box style={{ width: 1, height: 20, background: "rgba(74,158,255,0.15)", margin: "0 4px" }} />
        {COLORS.map((c) => (
          <Box
            key={c} onClick={() => setOverlayColor(c)}
            style={{
              width: 16, height: 16, borderRadius: 4, background: c,
              border: overlayColor === c ? "2px solid white" : "2px solid transparent",
              cursor: "pointer",
            }}
          />
        ))}
        <Box style={{ width: 1, height: 20, background: "rgba(74,158,255,0.15)", margin: "0 4px" }} />
        <Tooltip content="清除我的标注">
          <IconButton
            size="1" variant="ghost" color="gray"
            onClick={onClearMyAnnotations}
          >
            <Trash2 size={14} />
          </IconButton>
        </Tooltip>
      </Flex>
    </Box>
  );
};
