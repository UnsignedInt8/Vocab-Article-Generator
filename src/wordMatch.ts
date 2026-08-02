/**
 * Checks whether vocabulary words appear in generated article text, allowing
 * for grammatical inflection (plural, past tense, comparative, etc.) since
 * the prompt explicitly permits any grammatical form.
 *
 * A plain `article.includes(word)` only catches inflections that are formed
 * by appending a suffix to the unchanged base word (e.g. walk -> walked).
 * It misses irregular forms (go -> went, man -> men) and regular forms that
 * modify the word's ending before adding a suffix (try -> tried, like ->
 * liking, leaf -> leaves). This module generates the regular inflected forms
 * and falls back to a lookup table for common irregular ones.
 */

// Common irregular verbs/nouns/adjectives whose inflected forms can't be
// derived by simple suffix rules.
const IRREGULAR_FORMS: Record<string, string[]> = {
  be: ["is", "am", "are", "was", "were", "been", "being"],
  go: ["went", "gone", "goes", "going"],
  do: ["did", "done", "does", "doing"],
  have: ["has", "had", "having"],
  say: ["said", "says", "saying"],
  make: ["made", "making", "makes"],
  take: ["took", "taken", "taking", "takes"],
  see: ["saw", "seen", "seeing", "sees"],
  get: ["got", "gotten", "getting", "gets"],
  know: ["knew", "known", "knowing", "knows"],
  think: ["thought", "thinking", "thinks"],
  come: ["came", "coming", "comes"],
  give: ["gave", "given", "giving", "gives"],
  find: ["found", "finding", "finds"],
  tell: ["told", "telling", "tells"],
  become: ["became", "becoming", "becomes"],
  leave: ["left", "leaving", "leaves"],
  feel: ["felt", "feeling", "feels"],
  bring: ["brought", "bringing", "brings"],
  begin: ["began", "begun", "beginning", "begins"],
  keep: ["kept", "keeping", "keeps"],
  hold: ["held", "holding", "holds"],
  write: ["wrote", "written", "writing", "writes"],
  stand: ["stood", "standing", "stands"],
  hear: ["heard", "hearing", "hears"],
  mean: ["meant", "meaning", "means"],
  meet: ["met", "meeting", "meets"],
  run: ["ran", "running", "runs"],
  pay: ["paid", "paying", "pays"],
  sit: ["sat", "sitting", "sits"],
  speak: ["spoke", "spoken", "speaking", "speaks"],
  lie: ["lay", "lain", "lying", "lies"],
  lead: ["led", "leading", "leads"],
  grow: ["grew", "grown", "growing", "grows"],
  lose: ["lost", "losing", "loses"],
  fall: ["fell", "fallen", "falling", "falls"],
  send: ["sent", "sending", "sends"],
  build: ["built", "building", "builds"],
  understand: ["understood", "understanding", "understands"],
  draw: ["drew", "drawn", "drawing", "draws"],
  break: ["broke", "broken", "breaking", "breaks"],
  spend: ["spent", "spending", "spends"],
  rise: ["rose", "risen", "rising", "rises"],
  drive: ["drove", "driven", "driving", "drives"],
  buy: ["bought", "buying", "buys"],
  wear: ["wore", "worn", "wearing", "wears"],
  choose: ["chose", "chosen", "choosing", "chooses"],
  eat: ["ate", "eaten", "eating", "eats"],
  fly: ["flew", "flown", "flying", "flies"],
  sing: ["sang", "sung", "singing", "sings"],
  swim: ["swam", "swum", "swimming", "swims"],
  drink: ["drank", "drunk", "drinking", "drinks"],
  ride: ["rode", "ridden", "riding", "rides"],
  fight: ["fought", "fighting", "fights"],
  catch: ["caught", "catching", "catches"],
  teach: ["taught", "teaching", "teaches"],
  sell: ["sold", "selling", "sells"],
  forget: ["forgot", "forgotten", "forgetting", "forgets"],
  child: ["children"],
  man: ["men"],
  woman: ["women"],
  person: ["people"],
  mouse: ["mice"],
  foot: ["feet"],
  tooth: ["teeth"],
  goose: ["geese"],
  good: ["better", "best"],
  bad: ["worse", "worst"],
  far: ["further", "furthest", "farther", "farthest"],
  little: ["less", "least"],
  many: ["more", "most"],
  much: ["more", "most"],
};

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function isConsonant(ch: string | undefined): boolean {
  return !!ch && /[a-z]/.test(ch) && !VOWELS.has(ch);
}

/** Generates plausible regularly-inflected forms of a base word. */
function regularForms(word: string): string[] {
  const w = word.toLowerCase();
  const forms = new Set<string>();
  const endsInConsonantY = w.endsWith("y") && isConsonant(w[w.length - 2]);

  // Plurals / third-person singular.
  forms.add(w + "s");
  forms.add(w + "es");
  if (endsInConsonantY) forms.add(w.slice(0, -1) + "ies");
  if (w.endsWith("f")) forms.add(w.slice(0, -1) + "ves");
  else if (w.endsWith("fe")) forms.add(w.slice(0, -2) + "ves");

  // Past tense / -ing forms.
  if (w.endsWith("e") && !w.endsWith("ee")) {
    forms.add(w + "d");
    forms.add(w.slice(0, -1) + "ing");
  } else if (endsInConsonantY) {
    forms.add(w.slice(0, -1) + "ied");
    forms.add(w + "ing");
  } else {
    forms.add(w + "ed");
    forms.add(w + "ing");
    // Double the final consonant for short CVC words (e.g. run -> running).
    if (
      w.length > 2 &&
      isConsonant(w[w.length - 1]) &&
      !isConsonant(w[w.length - 2]) &&
      isConsonant(w[w.length - 3]) &&
      !"wxy".includes(w[w.length - 1] ?? "")
    ) {
      const doubled = w + w[w.length - 1];
      forms.add(doubled + "ed");
      forms.add(doubled + "ing");
    }
  }

  // Comparative / superlative.
  if (w.endsWith("e")) {
    forms.add(w + "r");
    forms.add(w + "st");
  } else if (endsInConsonantY) {
    forms.add(w.slice(0, -1) + "ier");
    forms.add(w.slice(0, -1) + "iest");
  } else {
    forms.add(w + "er");
    forms.add(w + "est");
  }

  return Array.from(forms);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

function wordAppears(tokens: Set<string>, word: string): boolean {
  const w = word.toLowerCase();
  if (w.includes(" ")) {
    // Multi-word entries (e.g. phrasal verbs) aren't single tokens — fall
    // back to substring matching over the joined token stream.
    return Array.from(tokens).join(" ").includes(w);
  }

  if (tokens.has(w)) return true;
  if (regularForms(w).some((form) => tokens.has(form))) return true;
  if (IRREGULAR_FORMS[w]?.some((form) => tokens.has(form))) return true;

  return false;
}

/** Returns the subset of `words` that do not appear (in any inflected form) in `article`. */
export function findMissingWords(article: string, words: string[]): string[] {
  const tokens = new Set(tokenize(article));
  return words.filter((w) => !wordAppears(tokens, w));
}
