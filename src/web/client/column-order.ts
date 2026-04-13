export const OFFERS_TABLE_COLUMN_ORDER_STORAGE_KEY = "offers-table-column-order";

export function reconcileColumnOrder(savedIds: string[], currentIds: string[]) {
  const currentIdSet = new Set(currentIds);
  const reconciled: string[] = [];
  const seen = new Set<string>();

  for (const id of savedIds) {
    if (currentIdSet.has(id) && !seen.has(id)) {
      reconciled.push(id);
      seen.add(id);
    }
  }

  for (const id of currentIds) {
    if (!seen.has(id)) {
      reconciled.push(id);
      seen.add(id);
    }
  }

  return reconciled;
}

export function moveColumnOrder(order: string[], sourceId: string, targetId: string) {
  const sourceIndex = order.indexOf(sourceId);
  const targetIndex = order.indexOf(targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return order;
  }

  const nextOrder = order.filter((id) => id !== sourceId);
  const insertionIndex = nextOrder.indexOf(targetId);
  nextOrder.splice(insertionIndex, 0, sourceId);
  return nextOrder;
}

export function parseStoredColumnOrder(rawValue: string | null, currentIds: string[]) {
  if (rawValue === null) {
    return currentIds;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return currentIds;
    }

    return reconcileColumnOrder(
      parsed.filter((id): id is string => typeof id === "string"),
      currentIds
    );
  } catch {
    return currentIds;
  }
}
