export function mapCsvRow(row: Record<string, string>) {
  return {
    title: row["Stanowisko"],
    description: row["Notatki"] ?? "",
    location: row["Lokalizacja"],
    workMode: row["Tryb pracy"] as "Remote" | "Hybrid" | "Office",
    company: row["Firma"],
    url: row["URL"],
    contract: row["Kontrakt"] as "B2B" | "UoP" | "Oba",
    technologies: []
  };
}
