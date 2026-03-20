import { FluxState, FluxStateValues } from './FluxState';

export interface IFluxSystem {
  readonly current: number;
  readonly capacity: number;
  readonly dissipation: number;
  readonly softFlux: number;
  readonly hardFlux: number;
  readonly state: FluxState;
}

export interface FluxSystemConfig {
  capacity: number;
  dissipation: number;
  initialSoftFlux?: number;
  initialHardFlux?: number;
}

export class FluxSystem implements IFluxSystem {
  private _softFlux: number;
  private _hardFlux: number;
  private readonly _capacity: number;
  private readonly _dissipation: number;
  private _state: FluxState;

  constructor(config: FluxSystemConfig) {
    if (config.capacity <= 0) {
      throw new Error('Flux capacity must be positive');
    }
    if (config.dissipation < 0) {
      throw new Error('Flux dissipation cannot be negative');
    }

    this._capacity = config.capacity;
    this._dissipation = config.dissipation;
    this._softFlux = config.initialSoftFlux ?? 0;
    this._hardFlux = config.initialHardFlux ?? 0;
    this._state = FluxStateValues.NORMAL;
    this._validateAndClamp();
    this._updateState();
  }

  get current(): number {
    return this._softFlux + this._hardFlux;
  }

  get capacity(): number {
    return this._capacity;
  }

  get dissipation(): number {
    return this._dissipation;
  }

  get softFlux(): number {
    return this._softFlux;
  }

  get hardFlux(): number {
    return this._hardFlux;
  }

  get state(): FluxState {
    return this._state;
  }

  get isOverloaded(): boolean {
    return this._state === FluxStateValues.OVERLOADED;
  }

  get isVenting(): boolean {
    return this._state === FluxStateValues.VENTING;
  }

  get isNormal(): boolean {
    return this._state === FluxStateValues.NORMAL;
  }

  addSoftFlux(amount: number): void {
    if (amount < 0) {
      throw new Error('Cannot add negative soft flux');
    }
    this._softFlux += amount;
    this._validateAndClamp();
    this._updateState();
  }

  addHardFlux(amount: number): void {
    if (amount < 0) {
      throw new Error('Cannot add negative hard flux');
    }
    this._hardFlux += amount;
    this._validateAndClamp();
    this._updateState();
  }

  vent(): void {
    if (this._state === FluxStateValues.OVERLOADED) {
      return;
    }
    this._state = FluxStateValues.VENTING;
  }

  endVent(): void {
    if (this._state === FluxStateValues.VENTING) {
      this._softFlux = 0;
      this._state = FluxStateValues.NORMAL;
    }
  }

  triggerOverload(): void {
    this._state = FluxStateValues.OVERLOADED;
  }

  endOverload(): void {
    if (this._state === FluxStateValues.OVERLOADED) {
      this._softFlux = this._capacity * 0.5;
      this._hardFlux = 0;
      this._state = FluxStateValues.NORMAL;
    }
  }

  dissipate(): void {
    if (this._state === FluxStateValues.OVERLOADED || this._state === FluxStateValues.VENTING) {
      return;
    }
    this._softFlux = Math.max(0, this._softFlux - this._dissipation);
  }

  /**
   * 散发指定数量的软辐能
   */
  dissipateSoftFlux(amount: number): void {
    if (this._state === FluxStateValues.OVERLOADED) {
      return;
    }
    this._softFlux = Math.max(0, this._softFlux - amount);
  }

  /**
   * 清空所有辐能
   */
  clearFlux(): void {
    this._softFlux = 0;
    this._hardFlux = 0;
    this._state = FluxStateValues.NORMAL;
  }

  /**
   * 设置辐能值
   */
  setFlux(softFlux: number, hardFlux: number): void {
    this._softFlux = Math.max(0, Math.min(softFlux, this._capacity));
    this._hardFlux = Math.max(0, Math.min(hardFlux, this._capacity - this._softFlux));
    this._updateState();
  }

  copy(): FluxSystem {
    const copy = new FluxSystem({
      capacity: this._capacity,
      dissipation: this._dissipation,
      initialSoftFlux: this._softFlux,
      initialHardFlux: this._hardFlux,
    });
    copy._state = this._state;
    return copy;
  }

  private _validateAndClamp(): void {
    const total = this._softFlux + this._hardFlux;
    if (total > this._capacity) {
      const ratio = this._capacity / total;
      this._softFlux *= ratio;
      this._hardFlux *= ratio;
    }
    this._softFlux = Math.max(0, this._softFlux);
    this._hardFlux = Math.max(0, this._hardFlux);
  }

  private _updateState(): void {
    if (this.current >= this._capacity) {
      this._state = FluxStateValues.OVERLOADED;
    } else if (this._state !== FluxStateValues.OVERLOADED && this._state !== FluxStateValues.VENTING) {
      this._state = FluxStateValues.NORMAL;
    }
  }
}
