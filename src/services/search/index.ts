import { productsFn, suggestionsFn } from "@/functions/catalogue.functions";
import { unwrap } from "../rpc";

export const searchService = {
  search: (term: string) => unwrap(() => productsFn({ data: { search: term } }), false),
  suggest: (term: string) => unwrap(() => suggestionsFn({ data: term }), false),
};
