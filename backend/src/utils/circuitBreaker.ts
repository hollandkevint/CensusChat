export interface CircuitBreakerOptions {
  threshold: number;          // Number of failures before opening circuit
  timeout: number;           // Time in ms to wait before attempting to close circuit
  resetTimeout: number;      // Time in ms to wait before fully resetting circuit
  monitorWindow: number;     // Time window in ms to monitor failures
}

export enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',         // Circuit is open, rejecting calls
  HALF_OPEN = 'half-open' // Testing if service is back up
}

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: CircuitState = CircuitState.CLOSED;
  private nextAttemptTime: number = 0;
  private readonly options: CircuitBreakerOptions;
  private readonly name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = {
      threshold: 5,
      timeout: 10000,
      resetTimeout: 60000,
      monitorWindow: 120000,
      ...options
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN && now >= this.nextAttemptTime) {
      this.state = CircuitState.HALF_OPEN;
      console.log(`🔧 Circuit breaker [${this.name}] transitioning to HALF_OPEN`);
    }

    // Reject calls if circuit is open
    if (this.state === CircuitState.OPEN) {
      console.warn(`🚫 Circuit breaker [${this.name}] is OPEN, rejecting call`);
      throw new Error(`Circuit breaker [${this.name}] is open. Service temporarily unavailable.`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    const now = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      console.log(`✅ Circuit breaker [${this.name}] successful call in HALF_OPEN, transitioning to CLOSED`);
      this.reset();
    } else {
      // Reset failure count if we're outside the monitor window
      if (now - this.lastFailureTime > this.options.monitorWindow) {
        this.failures = 0;
      }
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.failures++;
    this.lastFailureTime = now;

    console.warn(`⚠️ Circuit breaker [${this.name}] recorded failure ${this.failures}/${this.options.threshold}`);

    if (this.failures >= this.options.threshold || this.state === CircuitState.HALF_OPEN) {
      this.tripCircuit();
    }
  }

  private tripCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.options.timeout;

    console.error(`🚨 Circuit breaker [${this.name}] OPENED due to ${this.failures} failures. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`);

    // Schedule automatic reset
    setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        console.log(`🔄 Circuit breaker [${this.name}] auto-transitioning to HALF_OPEN for testing`);
        this.state = CircuitState.HALF_OPEN;
      }
    }, this.options.timeout);
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      isHealthy: this.state === CircuitState.CLOSED
    };
  }

  // Force open for testing/maintenance
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.options.timeout;
    console.warn(`🔧 Circuit breaker [${this.name}] manually opened`);
  }

  // Force closed for testing/recovery
  forceClose(): void {
    this.reset();
    console.log(`🔧 Circuit breaker [${this.name}] manually closed`);
  }
}