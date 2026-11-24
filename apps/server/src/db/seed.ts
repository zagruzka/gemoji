import { seedDefaultWordsIfEmpty } from "./index";

const count = seedDefaultWordsIfEmpty();
console.log(`[db:seed] word_pairs ready (${count} pasangan kata Bahasa Indonesia).`);
