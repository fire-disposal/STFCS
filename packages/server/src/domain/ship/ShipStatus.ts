export type ShipStatus = 'NORMAL' | 'VENTING' | 'OVERLOADED' | 'DISABLED';

export const ShipStatusValues: Readonly<Record<ShipStatus, ShipStatus>> = {
  NORMAL: 'NORMAL',
  VENTING: 'VENTING',
  OVERLOADED: 'OVERLOADED',
  DISABLED: 'DISABLED',
} as const;
