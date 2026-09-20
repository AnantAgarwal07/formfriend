/**
 * llm.service.js
 * Optional LLM fallback for ambiguous cases.
 */

// If we had Bedrock for LLM generation, we'd use it here.
// For now, we stub it as an optional adapter.

const { GoogleGenAI, Type } = require('@google/genai');
const schema = require('../../schemas/exam-profile-schema.json');

// Dynamically generate the canonical classes from the user's exam schema
// Format: category.class (e.g. personal.name, contact.email)
const CANONICAL_CLASSES = [];
schema.categories.forEach(category => {
  category.classes.forEach(cls => {
    CANONICAL_CLASSES.push(`${category.id}.${cls.id}`);
  });
});

async function resolveAmbiguousField(fieldContext, candidates) {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    console.log('[LLM Service] GEMINI_API_KEY is missing. Returning ambiguous.');
    return { status: 'unresolved', candidates, confidence: 0.18 };
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

  const prompt = `You are the field-classification component of FormFriend.
Your ONLY task is to map this browser form field to one canonical profile class from the supplied schema.

IMPORTANT RULES:
1. Match by meaning, not exact spelling.
2. Use the field label together with placeholder, section heading, input type, and surrounding context.
3. If the requested meaning is not represented by any canonical class, return "none". Never invent a new class.

CANONICAL PROFILE SCHEMA (WITH CONTEXT):
${JSON.stringify(schema, null, 2)}

FIELD TO CLASSIFY:
${JSON.stringify({
  id: fieldContext.fieldId || fieldContext.id,
  label: fieldContext.label,
  name: fieldContext.name,
  placeholder: fieldContext.placeholder,
  section: fieldContext.section,
  controlType: fieldContext.controlType,
  options: fieldContext.options,
  required: fieldContext.required
}, null, 2)}

Return the matched class (e.g., "personal.name") or "none".`;

  try {
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        matchedClass: { type: Type.STRING, enum: [...CANONICAL_CLASSES, 'none'] },
        confidence: { type: Type.NUMBER },
        reason: { type: Type.STRING }
      },
      required: ['matchedClass', 'confidence', 'reason']
    };

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const parsed = JSON.parse(response.text);

    if (parsed.matchedClass && parsed.matchedClass !== 'none') {
      console.log(`[LLM Service] Gemini classified "${fieldContext.label}" as ${parsed.matchedClass} with ${parsed.confidence} confidence.`);
      return {
        status: 'resolved',
        profileField: parsed.matchedClass,
        entity: 'self',
        attribute: 'inferred_by_llm',
        confidence: parsed.confidence
      };
    }
  } catch (err) {
    console.error('[LLM Service] Gemini API Error:', err.message);
  }

  return { status: 'unresolved', candidates, confidence: 0.18 };
}

module.exports = {
  resolveAmbiguousField
};
