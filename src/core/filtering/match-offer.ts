import type { FilterProfile, ImportedOffer } from "../jobs/types";
import { normalizeToken } from "../../config/profile";

export function evaluateOffer(offer: ImportedOffer, profile: FilterProfile) {
  const haystack = `${offer.title} ${offer.description}`.toLowerCase();
  const matchesProfile = profile.profileKeywords.some((keyword) =>
    haystack.includes(keyword.toLowerCase())
  );

  if (!matchesProfile) {
    return {
      accepted: false,
      rejectionReason: "profile",
      priority: "👀 Obserwuj",
      generatedNotes: []
    };
  }

  const normalizedLocation = offer.location.toLowerCase();
  const locationAllowed =
    offer.workMode === "Remote" ||
    profile.allowedCities.some((city) =>
      normalizedLocation.includes(city.toLowerCase())
    );

  if (!locationAllowed) {
    return {
      accepted: false,
      rejectionReason: "location",
      priority: "👀 Obserwuj",
      generatedNotes: []
    };
  }

  const normalizedKnownStack = new Set(
    profile.knownStack.map((item) => normalizeToken(item))
  );
  const unknownTech = offer.technologies.filter(
    (item) => !normalizedKnownStack.has(normalizeToken(item))
  );
  const knownTechCount = offer.technologies.length - unknownTech.length;

  const priority =
    knownTechCount >= unknownTech.length + 1
      ? "🔥 Teraz"
      : knownTechCount >= 1
        ? "⏳ Za miesiąc"
        : "👀 Obserwuj";

  return {
    accepted: true,
    rejectionReason: null,
    priority,
    generatedNotes: unknownTech
  };
}
