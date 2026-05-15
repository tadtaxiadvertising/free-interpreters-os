import { InterpreterInput } from '@/lib/validators';
import { InterpreterWithStatus } from '@/lib/types';

/**
 * SERVICE: Interpreters
 * Handles all frontend communication with the /api/interpreters endpoint.
 */
export const interpreterService = {
  /**
   * Fetch all interpreters with optional filters
   */
  async getAll(params?: { status?: string; search?: string }): Promise<InterpreterWithStatus[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    const response = await fetch(`/api/interpreters?${query.toString()}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch interpreters');
    }
    return response.json();
  },

  /**
   * Get a single interpreter by ID
   */
  async getById(id: number): Promise<InterpreterWithStatus> {
    const response = await fetch(`/api/interpreters/${id}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch interpreter');
    }
    return response.json();
  },

  /**
   * Create a new interpreter
   */
  async create(data: InterpreterInput): Promise<InterpreterWithStatus> {
    const response = await fetch('/api/interpreters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create interpreter');
    }
    return response.json();
  },

  /**
   * Update an existing interpreter
   */
  async update(id: number, data: Partial<InterpreterInput>): Promise<InterpreterWithStatus> {
    const response = await fetch(`/api/interpreters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update interpreter');
    }
    return response.json();
  },

  /**
   * Delete an interpreter
   */
  async delete(id: number): Promise<void> {
    const response = await fetch(`/api/interpreters/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete interpreter');
    }
  },
};
