import type { Product } from "@/types";
import { productService } from "../products";

export interface SearchService {
  search(term: string): Promise<Product[]>;
  suggest(term: string): Promise<string[]>;
}

/**
 * AWS LEARNING ZONE — Amazon OpenSearch Service (or Kendra)
 * Today search is a client-side filter over the mock catalogue. Later, index
 * products into OpenSearch from a DynamoDB stream and query through Lambda.
 */
export const mockSearchService: SearchService = {
  async search(term) { return productService.list({ search: term }); },
  async suggest(term) {
    const results = await productService.list({ search: term });
    return results.slice(0, 6).map((p) => p.name);
  },
};

export const searchService: SearchService = mockSearchService;
