export interface AnalyticsService {
  track(event: string, properties?: Record<string, unknown>): void;
  pageView(path: string): void;
}

/**
 * Demo console events only. Operational monitoring will use server-side
 * CloudWatch logs/metrics; a separate browser analytics pipeline is deferred.
 */
export const mockAnalyticsService: AnalyticsService = {
  track(event, properties) {
    console.debug("[analytics]", event, properties ?? {});
  },
  pageView(path) {
    console.debug("[analytics] page_view", path);
  },
};

export const analyticsService: AnalyticsService = mockAnalyticsService;
