export type OfferListItem = {
  id: number;
  stanowisko: string;
  statusAplikacji?: string;
  dataDodania?: string;
  firma: string;
  url?: string;
  kontrakt?: string;
  lokalizacja?: string;
  statusOgloszenia?: string;
  notatki?: string;
  widełkiOd?: number | null;
  widełkiDo?: number | null;
  ostatniaWeryfikacja?: string | null;
  priorytet?: string;
  trybPracy?: string;
};

export function getOfferNoteLabels(offer: OfferListItem) {
  return (offer.notatki ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getOfferLabels(offer: OfferListItem) {
  const notes = getOfferNoteLabels(offer);

  return [
    offer.priorytet,
    offer.statusAplikacji,
    offer.statusOgloszenia,
    ...notes
  ].filter((value): value is string => Boolean(value));
}

export function serializeOffersForHtml(offers: OfferListItem[]) {
  return JSON.stringify(offers).replace(/</g, "\\u003c");
}
