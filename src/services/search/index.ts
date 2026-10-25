import { productsFn, suggestionsFn } from "@/functions/catalogue.functions";
import { unwrap } from "../rpc";

<<<<<<< HEAD
export const searchService = {
  search: (term: string) => unwrap(() => productsFn({ data: { search: term } }), false),
  suggest: (term: string) => unwrap(() => suggestionsFn({ data: term }), false),
=======
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
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
};
