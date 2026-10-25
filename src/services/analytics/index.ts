import { analyticsFn } from "@/functions/customer.functions";
import { unwrap, ServiceError } from "../rpc";

export const analyticsService = {
  track(event: string, properties?: Record<string, string | number | boolean | null>) {
    void unwrap(() => analyticsFn({ data: { event, properties } }), false).catch(error => {
      if (!(error instanceof ServiceError && error.status === 401)) console.error("Analytics request failed", error);
    });
  },
  pageView(path: string) { this.track("page_view", { path }); },
};
