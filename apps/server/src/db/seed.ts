import { seedDefaultWordsIfEmpty, seedWordtrapWordsIfEmpty } from "./index";

const undercoverCount = seedDefaultWordsIfEmpty();
const wordtrapCount = seedWordtrapWordsIfEmpty();
console.log(
  `[db:seed] word_pairs ready (${undercoverCount} pasangan kata), wordtrap_words ready (${wordtrapCount} kata).`,
);
