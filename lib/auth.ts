/**
 * Auth Utilities - Backward Compatibility Layer
 * 
 * This file maintains backward compatibility with existing code
 * while delegating to the new feature-based auth service.
 * 
 * New code should import directly from '@/features/auth'
 */

import { authService } from '../src/features/auth';
import type { User } from '../src/features/auth';

// Re-export for backward compatibility
export { authService };
export type { User };

/**
 * Get authenticated user from session
 * @deprecated Use authService.getCurrentUser() directly
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  return authService.getCurrentUser();
}

/**
 * Check if user is authenticated
 * @deprecated Use authService.isAuthenticated() directly
 */
export async function isAuthenticated(): Promise<boolean> {
  return authService.isAuthenticated();
}
