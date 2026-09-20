require('dotenv').config();
const { saveMapping } = require('../intelligence/semanticCache.service');
const { generateSemanticKey } = require('../intelligence/semanticKey');
const { normalizeField } = require('../intelligence/fieldNormalizer');

const SEED_DATA = [
  {
    field: { label: "Father's Name", type: "text", section: "Parent Details" },
    entity: "father",
    attribute: "name",
    profileField: "parent.father.name"
  },
  {
    field: { label: "Name of Dad", type: "text", section: "Family" },
    entity: "father",
    attribute: "name",
    profileField: "parent.father.name"
  },
  {
    field: { label: "Mother's Name", type: "text", section: "Parent Details" },
    entity: "mother",
    attribute: "name",
    profileField: "parent.mother.name"
  },
  {
    field: { label: "Spouse Name", type: "text", section: "Marital" },
    entity: "spouse",
    attribute: "name",
    profileField: "spouse.name"
  },
  {
    field: { label: "Emergency Contact Number", type: "text", section: "Emergency" },
    entity: "emergencyContact",
    attribute: "phone",
    profileField: "emergencyContact.phone"
  }
];

async function seed() {
  console.log('Seeding semantic cache...');
  for (let i = 0; i < SEED_DATA.length; i++) {
    const item = SEED_DATA[i];
    const normalized = normalizeField(item.field);
    const { rawKey, hash } = generateSemanticKey(normalized, item.entity, item.attribute);
    
    const mapping = {
      mappingId: `seed_map_${i}`,
      semanticKey: hash,
      formFingerprint: "synthetic-seed-001",
      safeFieldText: `${normalized.label} ${normalized.section}`.trim(),
      entity: item.entity,
      attribute: item.attribute,
      profileField: item.profileField,
      contextTerms: normalized.contextTerms,
      fieldType: normalized.fieldType,
      confidence: 0.99,
      validatedCount: 100,
      validationState: 'validated',
      ruleVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastValidatedAt: new Date().toISOString()
    };
    
    await saveMapping(mapping);
    console.log(`Seeded mapping for: ${item.field.label} -> ${item.profileField}`);
  }
  console.log('Seeding complete.');
}

if (require.main === module) {
  seed().catch(console.error);
}

module.exports = { seed };
