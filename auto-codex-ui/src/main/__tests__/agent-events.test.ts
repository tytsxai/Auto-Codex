import { describe, it, expect } from 'vitest';
import { AgentEvents } from '../agent/agent-events';

describe('AgentEvents', () => {
  describe('parseTaskLogMarker', () => {
    it('returns null for non-marker lines', () => {
      const events = new AgentEvents();
      expect(events.parseTaskLogMarker('hello world')).toBeNull();
    });

    it('returns null for malformed markers', () => {
      const events = new AgentEvents();
      expect(events.parseTaskLogMarker('__TASK_LOG_PHASE_START__:not-json')).toBeNull();
    });

    it('parses valid marker lines', () => {
      const events = new AgentEvents();
      const line = '__TASK_LOG_PHASE_START__:' + JSON.stringify({ phase: 'coding' });
      expect(events.parseTaskLogMarker(line)).toEqual({
        markerType: 'PHASE_START',
        data: { phase: 'coding' }
      });
    });
  });
});
