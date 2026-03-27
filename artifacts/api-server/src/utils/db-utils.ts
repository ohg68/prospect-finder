/**
 * Utility to convert snake_case keys to camelCase.
 * Useful for mapping raw SQL query results from Drizzle db.execute().
 */
export function snakeToCamel<T = any>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map(v => snakeToCamel(v)) as any;
  } else if (obj !== null && typeof obj === "object" && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/(_\w)/g, m => m[1].toUpperCase());
      (result as any)[camelKey] = snakeToCamel(obj[key]);
      return result;
    }, {} as T);
  }
  return obj;
}

/**
 * Specifically maps a row that might contain prefixed columns (e.g., from a join: p_name -> name)
 * and ensures dates are handled correctly if needed.
 */
export function mapRawRow<T = any>(row: any, prefixMappings?: Record<string, string>): T {
  const camelRow = snakeToCamel(row);
  
  if (!prefixMappings) return camelRow;

  const result: any = { ...camelRow };
  
  for (const [prefix, targetKey] of Object.entries(prefixMappings)) {
    for (const key of Object.keys(result)) {
      if (key.startsWith(prefix) && key.length > prefix.length) {
        const actualKey = key.slice(prefix.length);
        const finalKey = actualKey.charAt(0).toLowerCase() + actualKey.slice(1);
        
        // If targetKey is provided, put it inside that object
        if (targetKey) {
          result[targetKey] = result[targetKey] || {};
          result[targetKey][finalKey] = result[key];
        } else {
          result[finalKey] = result[key];
        }
        delete result[key];
      }
    }
  }

  return result;
}
