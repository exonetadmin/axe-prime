/**
 * Shared Event Types
 * 
 * This file contains all event types used across the application.
 * It breaks circular dependencies between features.
 */

// Auth events
export type AuthEvents = {
  'auth:login': { user: { id: string; name: string; email: string; planInterest: string | null; createdAt: string } };
  'auth:logout': { userId: string };
  'auth:registered': { user: { id: string; name: string; email: string; planInterest: string | null; createdAt: string } };
  'auth:password-reset': { userId: string };
};

// App-level events
export type AppEvents = AuthEvents & {
  'app:error': { error: Error; context: string };
  'app:initialized': { timestamp: Date };
};
