type OfferRecord = {
  stanowisko: string;
  firma: string;
  url: string;
  lokalizacja: string;
  trybPracy: string;
  kontrakt: string;
  statusOgloszenia: string;
  statusAplikacji: string;
  priorytet: string;
  notatki: string;
  dataDodania: string;
  source: string;
};

export function createInMemoryRepositories() {
  const offers = new Map<string, OfferRecord>();

  return {
    reset() {
      offers.clear();
    },
    offers: {
      async insert(record: OfferRecord) {
        if (offers.has(record.url)) {
          return false;
        }

        offers.set(record.url, record);
        return true;
      },
      async count() {
        return offers.size;
      }
    }
  };
}
