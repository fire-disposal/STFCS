export type FluxState = 'NORMAL' | 'VENTING' | 'OVERLOADED';

export const FluxStateValues: Readonly<Record<FluxState, FluxState>> = {
  NORMAL: 'NORMAL',
  VENTING: 'VENTING',
  OVERLOADED: 'OVERLOADED',
} as const;
