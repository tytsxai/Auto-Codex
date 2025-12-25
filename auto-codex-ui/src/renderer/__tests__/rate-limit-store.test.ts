/**
 * Unit tests for Rate Limit Store
 * Tests Zustand store state management for terminal and SDK rate limits
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useRateLimitStore } from '../stores/rate-limit-store';
import type { RateLimitInfo, SDKRateLimitInfo } from '../../shared/types';

const createRateLimitInfo = (overrides: Partial<RateLimitInfo> = {}): RateLimitInfo => ({
  terminalId: 'term-1',
  resetTime: 'Dec 17 at 6am (Europe/Oslo)',
  detectedAt: new Date('2024-12-17T06:00:00.000Z'),
  ...overrides
});

const createSDKRateLimitInfo = (overrides: Partial<SDKRateLimitInfo> = {}): SDKRateLimitInfo => ({
  source: 'task',
  profileId: 'profile-1',
  detectedAt: new Date('2024-12-17T06:00:00.000Z'),
  ...overrides
});

describe('Rate Limit Store', () => {
  beforeEach(() => {
    useRateLimitStore.setState({
      isModalOpen: false,
      rateLimitInfo: null,
      isSDKModalOpen: false,
      sdkRateLimitInfo: null,
      hasPendingRateLimit: false,
      pendingRateLimitType: null
    });
  });

  describe('state management', () => {
    it('initializes with closed modals and no pending rate limit', () => {
      const state = useRateLimitStore.getState();
      expect(state.isModalOpen).toBe(false);
      expect(state.isSDKModalOpen).toBe(false);
      expect(state.rateLimitInfo).toBeNull();
      expect(state.sdkRateLimitInfo).toBeNull();
      expect(state.hasPendingRateLimit).toBe(false);
      expect(state.pendingRateLimitType).toBeNull();
    });

    it('shows terminal rate limit modal and sets pending state', () => {
      const info = createRateLimitInfo({ terminalId: 'term-42' });

      useRateLimitStore.getState().showRateLimitModal(info);

      const state = useRateLimitStore.getState();
      expect(state.isModalOpen).toBe(true);
      expect(state.rateLimitInfo).toEqual(info);
      expect(state.hasPendingRateLimit).toBe(true);
      expect(state.pendingRateLimitType).toBe('terminal');
      expect(state.isSDKModalOpen).toBe(false);
    });

    it('hides terminal modal but keeps pending data', () => {
      const info = createRateLimitInfo();

      useRateLimitStore.getState().showRateLimitModal(info);
      useRateLimitStore.getState().hideRateLimitModal();

      const state = useRateLimitStore.getState();
      expect(state.isModalOpen).toBe(false);
      expect(state.rateLimitInfo).toEqual(info);
      expect(state.hasPendingRateLimit).toBe(true);
      expect(state.pendingRateLimitType).toBe('terminal');
    });

    it('shows SDK rate limit modal and sets pending state', () => {
      const info = createSDKRateLimitInfo({ source: 'changelog' });

      useRateLimitStore.getState().showSDKRateLimitModal(info);

      const state = useRateLimitStore.getState();
      expect(state.isSDKModalOpen).toBe(true);
      expect(state.sdkRateLimitInfo).toEqual(info);
      expect(state.hasPendingRateLimit).toBe(true);
      expect(state.pendingRateLimitType).toBe('sdk');
      expect(state.isModalOpen).toBe(false);
    });

    it('hides SDK modal but keeps pending data', () => {
      const info = createSDKRateLimitInfo();

      useRateLimitStore.getState().showSDKRateLimitModal(info);
      useRateLimitStore.getState().hideSDKRateLimitModal();

      const state = useRateLimitStore.getState();
      expect(state.isSDKModalOpen).toBe(false);
      expect(state.sdkRateLimitInfo).toEqual(info);
      expect(state.hasPendingRateLimit).toBe(true);
      expect(state.pendingRateLimitType).toBe('sdk');
    });

    it('reopens the terminal modal when a terminal rate limit is pending', () => {
      const info = createRateLimitInfo();

      useRateLimitStore.getState().showRateLimitModal(info);
      useRateLimitStore.getState().hideRateLimitModal();
      useRateLimitStore.getState().reopenRateLimitModal();

      const state = useRateLimitStore.getState();
      expect(state.isModalOpen).toBe(true);
      expect(state.isSDKModalOpen).toBe(false);
    });

    it('reopens the SDK modal when an SDK rate limit is pending', () => {
      const info = createSDKRateLimitInfo();

      useRateLimitStore.getState().showSDKRateLimitModal(info);
      useRateLimitStore.getState().hideSDKRateLimitModal();
      useRateLimitStore.getState().reopenRateLimitModal();

      const state = useRateLimitStore.getState();
      expect(state.isSDKModalOpen).toBe(true);
      expect(state.isModalOpen).toBe(false);
    });

    it('does not reopen modals when pending data is missing', () => {
      useRateLimitStore.setState({
        isModalOpen: false,
        isSDKModalOpen: false,
        hasPendingRateLimit: true,
        pendingRateLimitType: 'terminal',
        rateLimitInfo: null,
        sdkRateLimitInfo: null
      });

      useRateLimitStore.getState().reopenRateLimitModal();

      const state = useRateLimitStore.getState();
      expect(state.isModalOpen).toBe(false);
      expect(state.isSDKModalOpen).toBe(false);
    });

    it('clears pending rate limit info', () => {
      const terminalInfo = createRateLimitInfo();
      const sdkInfo = createSDKRateLimitInfo();

      useRateLimitStore.getState().showRateLimitModal(terminalInfo);
      useRateLimitStore.getState().showSDKRateLimitModal(sdkInfo);
      useRateLimitStore.getState().clearPendingRateLimit();

      const state = useRateLimitStore.getState();
      expect(state.hasPendingRateLimit).toBe(false);
      expect(state.pendingRateLimitType).toBeNull();
      expect(state.rateLimitInfo).toBeNull();
      expect(state.sdkRateLimitInfo).toBeNull();
    });
  });
});
