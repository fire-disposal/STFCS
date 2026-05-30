import { z } from "zod";

export const CursorPayloadSchema = z.object({
  playerId: z.string(), x: z.number(), y: z.number(), color: z.string(),
});
export type CursorPayload = z.infer<typeof CursorPayloadSchema>;

export const PingPayloadSchema = z.object({
  pingId: z.string(), playerId: z.string(), x: z.number(), y: z.number(),
  color: z.string(), timestamp: z.number(),
});
export type PingPayload = z.infer<typeof PingPayloadSchema>;

export const DrawStreamPayloadSchema = z.object({
  strokeId: z.string(), playerId: z.string(), x: z.number(), y: z.number(),
  color: z.string(), lineWidth: z.number(),
});
export type DrawStreamPayload = z.infer<typeof DrawStreamPayloadSchema>;

export const DrawTool = { PEN: "pen", LINE: "line", ARROW: "arrow" } as const;
export type DrawToolType = (typeof DrawTool)[keyof typeof DrawTool];

export const DrawCommitPayloadSchema = z.object({
  strokeId: z.string(), playerId: z.string(),
  tool: z.enum([DrawTool.PEN, DrawTool.LINE, DrawTool.ARROW]),
  color: z.string(), lineWidth: z.number(),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
});
export type DrawCommitPayload = z.infer<typeof DrawCommitPayloadSchema>;

export const NotePayloadSchema = z.object({
  op: z.enum(["create", "move", "delete"]),
  id: z.string(), playerId: z.string(), x: z.number(), y: z.number(),
  text: z.string().optional(), color: z.string(),
});
export type NotePayload = z.infer<typeof NotePayloadSchema>;

export const ViewportPayloadSchema = z.object({
  playerId: z.string(), cx: z.number(), cy: z.number(),
  zoom: z.number(), rotation: z.number(), sw: z.number(), sh: z.number(),
  color: z.string(),
});
export type ViewportPayload = z.infer<typeof ViewportPayloadSchema>;

export const ClearPayloadSchema = z.object({
  scope: z.enum(["all", "player"]), targetId: z.string().optional(),
});
export type ClearPayload = z.infer<typeof ClearPayloadSchema>;

export const OverlaySyncPayloadSchema = z.object({
  drawings: z.array(DrawCommitPayloadSchema),
  notes: z.array(NotePayloadSchema),
  viewports: z.array(ViewportPayloadSchema),
  pings: z.array(PingPayloadSchema),
});
export type OverlaySyncPayload = z.infer<typeof OverlaySyncPayloadSchema>;

export const PLAYER_OVERLAY_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
] as const;

export const DM_OVERLAY_COLOR = "#FFD700";
