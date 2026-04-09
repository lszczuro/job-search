import { evaluateOffer } from "../filtering/match-offer";
import type { FilterProfile, ImportedOffer } from "../jobs/types";

type RunImportArgs = {
  offers: ImportedOffer[];
  profile: FilterProfile;
  hasUrl: (url: string) => Promise<boolean>;
  saveOffer: (
    offer: ImportedOffer & {
      priority: string;
      generatedNotes: string[];
    }
  ) => Promise<void>;
};

export async function runImport(args: RunImportArgs) {
  let added = 0;
  let rejected = 0;
  let duplicates = 0;
  let errors = 0;

  for (const offer of args.offers) {
    try {
      const decision = evaluateOffer(offer, args.profile);

      if (!decision.accepted) {
        rejected += 1;
        continue;
      }

      if (await args.hasUrl(offer.url)) {
        duplicates += 1;
        continue;
      }

      await args.saveOffer({
        ...offer,
        priority: decision.priority,
        generatedNotes: decision.generatedNotes
      });
      added += 1;
    } catch {
      errors += 1;
    }
  }

  return {
    fetched: args.offers.length,
    added,
    rejected,
    duplicates,
    errors
  };
}
