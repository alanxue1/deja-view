/**
 * Shortens a long description for Shopify product search.
 * Extracts key furniture terms while keeping the query concise.
 */

const FURNITURE_KEYWORDS = [
  "chair", "armchair", "stool", "sofa", "couch", "sectional",
  "table", "desk", "lamp", "sconce", "bed", "dresser", "nightstand",
  "bench", "rug", "mirror", "shelf", "bookcase", "cabinet", "ottoman",
  "console", "credenza", "sideboard", "wardrobe", "vanity", "chandelier",
  "pendant", "headboard", "footstool", "loveseat", "recliner"
];

const COLOR_TERMS = [
  "beige", "white", "black", "gray", "grey", "brown", "tan", "cream",
  "ivory", "navy", "blue", "green", "red", "orange", "yellow", "pink",
  "purple", "gold", "silver", "bronze", "brass", "copper", "walnut",
  "oak", "mahogany", "teak", "natural", "charcoal", "slate", "cognac"
];

const MATERIAL_TERMS = [
  "leather", "velvet", "linen", "cotton", "wool", "silk", "suede",
  "wood", "wooden", "metal", "glass", "marble", "stone", "ceramic",
  "rattan", "wicker", "bamboo", "fabric", "upholstered", "chrome",
  "steel", "iron", "brass", "acrylic", "lacquered", "painted"
];

const STYLE_TERMS = [
  "modern", "contemporary", "vintage", "antique", "mid-century",
  "minimalist", "industrial", "rustic", "bohemian", "scandinavian",
  "traditional", "coastal", "farmhouse", "art deco", "transitional"
];

/**
 * Extracts key terms from a description string
 */
function extractKeyTerms(text: string): {
  furniture: string[];
  colors: string[];
  materials: string[];
  styles: string[];
} {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  
  const furniture = FURNITURE_KEYWORDS.filter(term => 
    words.some(w => w.includes(term) || term.includes(w))
  );
  const colors = COLOR_TERMS.filter(term => lower.includes(term));
  const materials = MATERIAL_TERMS.filter(term => lower.includes(term));
  const styles = STYLE_TERMS.filter(term => lower.includes(term));
  
  return { furniture, colors, materials, styles };
}

/**
 * Shortens a description to a concise search query.
 * 
 * @param description - The full description text
 * @param mainItem - The main item name (e.g., "beige sofa")
 * @param maxWords - Maximum words in the result (default: 6)
 * @returns A shortened search query string
 */
export function shortenDescription(
  description: string,
  mainItem?: string,
  maxWords: number = 6
): string {
  // If description is already short, use it directly
  const descWords = description.trim().split(/\s+/);
  if (descWords.length <= maxWords) {
    return description.trim();
  }

  // If we have a mainItem, start with it
  if (mainItem && mainItem.trim()) {
    const mainWords = mainItem.trim().split(/\s+/);
    if (mainWords.length <= maxWords) {
      // Try to enhance mainItem with key descriptors from description
      const extracted = extractKeyTerms(description);
      const additionalTerms: string[] = [];
      
      // Add color if not already in mainItem
      const mainLower = mainItem.toLowerCase();
      for (const color of extracted.colors) {
        if (!mainLower.includes(color) && additionalTerms.length < 2) {
          additionalTerms.push(color);
        }
      }
      
      // Add material if not already in mainItem
      for (const material of extracted.materials) {
        if (!mainLower.includes(material) && additionalTerms.length < 2) {
          additionalTerms.push(material);
        }
      }
      
      // Combine: "beige sofa" + ["leather"] = "beige leather sofa"
      if (additionalTerms.length > 0) {
        const combined = [...additionalTerms, mainItem].join(" ");
        const combinedWords = combined.split(/\s+/);
        if (combinedWords.length <= maxWords) {
          return combined;
        }
      }
      
      return mainItem.trim();
    }
  }

  // Fall back to extracting key terms from description
  const extracted = extractKeyTerms(description);
  const parts: string[] = [];
  
  // Priority: color + material + furniture type
  if (extracted.colors.length > 0) {
    parts.push(extracted.colors[0]);
  }
  if (extracted.materials.length > 0 && parts.length < 3) {
    parts.push(extracted.materials[0]);
  }
  if (extracted.furniture.length > 0) {
    parts.push(extracted.furniture[0]);
  } else {
    // No furniture keyword found, take first few meaningful words
    const meaningfulWords = descWords.filter(w => 
      w.length > 3 && !["with", "and", "the", "for", "from", "that", "this"].includes(w.toLowerCase())
    );
    parts.push(...meaningfulWords.slice(0, 3));
  }
  
  // If still too long, truncate
  const result = parts.slice(0, maxWords).join(" ");
  return result || description.split(/\s+/).slice(0, maxWords).join(" ");
}

export default shortenDescription;
