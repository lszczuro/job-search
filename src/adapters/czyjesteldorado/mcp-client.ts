import type { ImportedOffer } from "../../core/jobs/types";

type McpJobOffer = {
  title: string;
  keywords: string[];
  company: string;
  cities: string[];
  work_modes: string[];
  contract_types: string[];
  employment_types: string[];
  seniority: string;
  salary_from: number | null;
  salary_to: number | null;
  url: string;
};

type McpInitializeResponse = {
  jsonrpc: string;
  id: number;
  result?: unknown;
};

type McpToolCallResponse = {
  jsonrpc: string;
  id: number;
  result?: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
};

function mapWorkMode(workModes: string[]): ImportedOffer["workMode"] {
  if (workModes.includes("remote")) {
    return "Remote";
  }

  if (workModes.includes("hybrid")) {
    return "Hybrid";
  }

  return "Office";
}

function mapContract(contractTypes: string[]): ImportedOffer["contract"] {
  const hasB2B = contractTypes.includes("b2b");
  const hasEmployment = contractTypes.includes("employment_contract");

  if (hasB2B && hasEmployment) {
    return "Oba";
  }

  if (hasB2B) {
    return "B2B";
  }

  if (hasEmployment) {
    return "UoP";
  }

  return "Oba";
}

export function mapMcpJobOffer(offer: McpJobOffer): ImportedOffer {
  return {
    title: offer.title,
    description: offer.keywords.join(" "),
    location: offer.cities[0] ?? "Remote",
    workMode: mapWorkMode(offer.work_modes),
    company: offer.company,
    url: offer.url,
    contract: mapContract(offer.contract_types),
    technologies: offer.keywords,
    salaryFrom: offer.salary_from,
    salaryTo: offer.salary_to
  };
}

export async function searchJobsViaMcp(args: {
  phrase: string;
  sortOrder?: "newest" | "best_paid" | "recommended";
  minSalary?: number | null;
}) {
  const initializeResponse = await fetch("https://czyjesteldorado.pl/_mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "job-search",
          version: "0.1.0"
        }
      }
    })
  });

  if (!initializeResponse.ok) {
    throw new Error(`MCP initialize failed with status ${initializeResponse.status}`);
  }

  const _initJson = (await initializeResponse.json()) as McpInitializeResponse;
  const sessionId = initializeResponse.headers.get("mcp-session-id");

  if (!sessionId) {
    throw new Error("MCP initialize response did not include session id");
  }

  const toolCallResponse = await fetch("https://czyjesteldorado.pl/_mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "mcp-session-id": sessionId
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "search_jobs",
        arguments: {
          phrase: args.phrase,
          sortOrder: args.sortOrder ?? "newest",
          minSalary: args.minSalary ?? null
        }
      }
    })
  });

  if (!toolCallResponse.ok) {
    throw new Error(`MCP tool call failed with status ${toolCallResponse.status}`);
  }

  const toolJson = (await toolCallResponse.json()) as McpToolCallResponse;

  if (toolJson.error) {
    throw new Error(toolJson.error.message);
  }

  const textPayload = toolJson.result?.content?.find((entry) => entry.type === "text")?.text;

  if (!textPayload) {
    return [];
  }

  const parsed = JSON.parse(textPayload) as McpJobOffer[];
  return parsed.map(mapMcpJobOffer);
}
