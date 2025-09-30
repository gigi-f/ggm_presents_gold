/*
 AI-INDEX
 - Tags: engine.validation
 - See: docs/ai/index.json
*/

// Lightweight shim; real implementation can import Ajv when installed
export type ValidationResult = { valid: boolean; errors?: any[] };

export function validateItems(_data: any): ValidationResult {
  // TODO: Integrate Ajv with /src/data/schemas/items.schema.json
  return { valid: true };
}

export function validateMaps(_data: any): ValidationResult {
  // TODO: Integrate Ajv with /src/data/schemas/maps.schema.json
  return { valid: true };
}
