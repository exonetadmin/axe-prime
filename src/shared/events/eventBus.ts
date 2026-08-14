/**
 * Event Bus - Cross-Feature Communication
 * 
 * Responsibilities:
 * - Enable loose coupling between features
 * - Publish-subscribe pattern for events
 * - Type-safe event handling
 * 
 * Usage:
 * ```ts
 * // Feature A emits
 * eventBus.emit('order:created', order);
 * 
 * // Feature B reacts (doesn't know about Feature A)
 * eventBus.on('order:created', async (order) => {
 *   await emailService.sendConfirmation(order);
 * });
 * ```
 */

import type { AppEvents } from './events.types';

type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  /**
   * Subscribe to an event
   */
  on<K extends keyof AppEvents>(
    event: K,
    handler: EventHandler<AppEvents[K]>
  ): () => void {
    const eventKey = event as string;
    
    if (!this.handlers.has(eventKey)) {
      this.handlers.set(eventKey, []);
    }
    
    this.handlers.get(eventKey)!.push(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof AppEvents>(
    event: K,
    handler: EventHandler<AppEvents[K]>
  ): void {
    const eventKey = event as string;
    const handlers = this.handlers.get(eventKey);
    
    if (handlers) {
      const index = handlers.indexOf(handler as EventHandler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<K extends keyof AppEvents>(
    event: K,
    data: AppEvents[K]
  ): Promise<void> {
    const eventKey = event as string;
    const handlers = this.handlers.get(eventKey) || [];

    // Execute all handlers concurrently
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(data);
        } catch (error) {
          console.error(`[EventBus] Error in handler for "${eventKey}":`, error);
        }
      })
    );
  }

  /**
   * Emit an event without waiting for handlers (fire and forget)
   */
  emitSync<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
    this.emit(event, data).catch((error) => {
      console.error(`[EventBus] Error emitting "${String(event)}":`, error);
    });
  }

  /**
   * Get number of subscribers for an event
   */
  subscriberCount<K extends keyof AppEvents>(event: K): number {
    const eventKey = event as string;
    return this.handlers.get(eventKey)?.length ?? 0;
  }

  /**
   * Remove all handlers for an event
   */
  clear<K extends keyof AppEvents>(event: K): void {
    const eventKey = event as string;
    this.handlers.delete(eventKey);
  }

  /**
   * Remove all handlers for all events
   */
  clearAll(): void {
    this.handlers.clear();
  }
}

// Export singleton instance
export const eventBus = new EventBus();

// Export types
export type { AppEvents, EventHandler };
