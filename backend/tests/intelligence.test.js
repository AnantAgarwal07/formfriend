const { normalizeField } = require('../src/intelligence/fieldNormalizer');
const { classify } = require('../src/intelligence/deterministicClassifier');
const { checkConstraints } = require('../src/intelligence/constraintChecker');

describe('Backend Intelligence Module', () => {

  describe('Deterministic Classifier', () => {
    it('Father Name resolves deterministically to family.father_name', () => {
      const field = normalizeField({ label: "Father's Name" });
      const result = classify(field);
      expect(result.status).toBe('resolved');
      expect(result.profileField).toBe('family.father_name');
      expect(result.entity).toBe('father');
      expect(result.attribute).toBe('name');
    });

    it("Father's Full Name resolves to family.father_name", () => {
      const field = normalizeField({ label: "Father's Full Name", section: "Parent Details" });
      const result = classify(field);
      expect(result.status).toBe('resolved');
      expect(result.profileField).toBe('family.father_name');
    });

    it('Father Phone Number resolves to family.father_phone', () => {
      const field = normalizeField({ label: "Father's Phone Number" });
      const result = classify(field);
      expect(result.status).toBe('resolved');
      expect(result.profileField).toBe('family.father_phone');
    });

    it('Student Name resolves to personal.full_name when context supports it', () => {
      const field = normalizeField({ label: "Name", section: "Student Details" });
      const result = classify(field);
      expect(result.status).toBe('resolved');
      expect(result.profileField).toBe('personal.full_name');
    });

    it('Bare "Name" remains ambiguous in family context', () => {
      const field = normalizeField({ label: "Name", section: "Family Information" });
      const result = classify(field);
      expect(result.status).toBe('ambiguous');
    });

    it('Conflicting label/section returns conflict/ambiguous (e.g. Father in spouse section)', () => {
      const field = normalizeField({ label: "Father Name", section: "Spouse Information" });
      const result = classify(field);
      expect(result).toBeDefined();
    });
  });

  describe('Constraint Checker', () => {
    it('Validates correct candidates', () => {
      const normalized = normalizeField({ label: "Name", section: "Father Details" }); // resolves entity: father, attribute: name
      const candidate = { profileField: 'family.father_name', entity: 'father', attribute: 'name' };
      const valid = checkConstraints(candidate, 'father', 'name', normalized);
      expect(valid).toBe(true);
    });

    it('Rejects candidate mapping to different definitive entity', () => {
      const normalized = normalizeField({ label: "Name", section: "Father Details" });
      const candidate = { profileField: 'family.mother_name', entity: 'mother', attribute: 'name' };
      const valid = checkConstraints(candidate, 'father', 'name', normalized);
      expect(valid).toBe(false);
    });

    it('Rejects candidate profileField not in canonical registry', () => {
      const normalized = normalizeField({ label: "Father Name" });
      const candidate = { profileField: 'family.father_nickname', entity: 'father', attribute: 'name' };
      const valid = checkConstraints(candidate, 'father', 'name', normalized);
      expect(valid).toBe(false);
    });
  });
});
