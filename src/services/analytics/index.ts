export interface AnalyticsService {
  track(event: string, properties?: Record<string, unknown>): void;
  pageView(path: string): void;
}

/**
 * AWS LEARNING ZONE — Amazon CloudWatch RUM / Kinesis Firehose / Pinpoint
 * Batch events client-side, ship them to an API Gateway endpoint, and let a
 * Lambda write to Firehose -> S3 -> Athena for product analytics.
 */
export const mockAnalyticsService: AnalyticsService = {
  track(event, properties) { console.debug("[analytics]", event, properties ?? {}); },
  pageView(path) { console.debug("[analytics] page_view", path); },
};

export const analyticsService: AnalyticsService = mockAnalyticsService;
