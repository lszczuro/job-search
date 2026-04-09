export type ImportedOffer = {
  title: string;
  description: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "Office";
  company: string;
  url: string;
  contract: "B2B" | "UoP" | "Oba";
  technologies: string[];
  salaryFrom?: number | null;
  salaryTo?: number | null;
};

export type FilterProfile = {
  knownStack: string[];
  profileKeywords: string[];
  allowedCities: string[];
};
