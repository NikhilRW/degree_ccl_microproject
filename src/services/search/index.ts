import type { Product } from "@/types";
import { productService } from "../products";

export interface SearchService {
  search(term: string): Promise<Product[]>;
  suggest(term: string): Promise<string[]>;
}

/**
 * Search currently filters the local server-backed demo catalogue.
 * Planned: bounded/paginated DynamoDB catalogue access through server functions.
 * OpenSearch is not needed for the initial small lab dataset.
 */
export const mockSearchService: SearchService = {
  async search(term) {
    return productService.list({ search: term });
  },
  async suggest(term) {
    const results = await productService.list({ search: term });
    return results.slice(0, 6).map((p) => p.name);
  },
};

export const searchService: SearchService = mockSearchService;
