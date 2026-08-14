/**
 * User Builder - Test Fixture Builder
 * 
 * Use this to create test users with sensible defaults.
 * Chain methods to customize specific fields.
 * 
 * @example
 * const user = new UserBuilder().withName('John').asAdmin().build();
 * const primeUser = new UserBuilder().withPlan('prime').build();
 */

import type { User } from '../../src/features/auth';

export class UserBuilder {
  private data: Partial<User> = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    planInterest: 'prime',
    sponsorId: null,
    referralCode: 'REFCODE1',
    createdAt: new Date().toISOString(),
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withPlan(plan: 'start' | 'prime' | 'elite'): this {
    this.data.planInterest = plan;
    return this;
  }

  asStart(): this {
    this.data.planInterest = 'start';
    return this;
  }

  asPrime(): this {
    this.data.planInterest = 'prime';
    return this;
  }

  asElite(): this {
    this.data.planInterest = 'elite';
    return this;
  }

  createdAt(date: string): this {
    this.data.createdAt = date;
    return this;
  }

  build(): User {
    return this.data as User;
  }
}
