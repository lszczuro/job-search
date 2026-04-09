export type EldoradoApiOffer = {
  title: string;
  body: string;
  location: string;
  work_mode: "Remote" | "Hybrid" | "Office";
  company: string;
  url: string;
  contract_type: "B2B" | "UoP" | "Oba";
  technologies: string[];
};

export function mapApiOffer(input: EldoradoApiOffer) {
  return {
    title: input.title,
    description: input.body,
    location: input.location,
    workMode: input.work_mode,
    company: input.company,
    url: input.url,
    contract: input.contract_type,
    technologies: input.technologies
  };
}
