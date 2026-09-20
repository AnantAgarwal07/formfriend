# FormFriend — LLM Fallback Standalone Test

This is a standalone local test for Part 3. It does NOT use Team B's backend, AWS, Redis, DynamoDB, or the browser extension.

The program:

1. Loads the canonical profile schema from `schemas/profile-schema.json`.
2. Loads a batch of realistic form fields from `tests/test-fields.json`.
3. Sends all unresolved fields in ONE Gemini request.
4. Forces Gemini to return only one of the canonical classes or `none` using structured JSON output.
5. Prints each mapping and compares it with the local `expectedClass` used only for testing.

## 1. Get a Gemini API key

Create an API key in Google AI Studio:

https://aistudio.google.com/app/apikey

The script uses `gemini-2.5-flash-lite` by default because it is a stable model optimized for fast, lightweight classification. Change `GEMINI_MODEL` in `.env` if you want to test another supported model.

## 2. Install

```bash
npm install
```

## 3. Configure the key

Copy:

```text
.env.example
```

to:

```text
.env
```

Then set:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
```

Never commit `.env`.

## 4. Run

```bash
npm test
```

The script sends all 12 test fields as ONE batch.

## 5. What the test is checking

The default test set contains:

- `name` → `name`
- `naaaame` → `name`
- `Full Legal Name` → `name`
- `gennndderr` → `gender`
- `Gender` → `gender`
- `Father's Name` → `none`
- `Mother's Name` → `none`
- `Date of Birth` → `dob`
- `DOB` → `dob`
- `E-mail address` → `email`
- `phon number` → `phone`
- `How old are you?` → `age`

The father/mother cases are intentionally important: the schema contains `name` for the user's own name but does not contain `father_name` or `mother_name`, so the model should return `none` rather than incorrectly mapping them to `name`.

## 6. Changing the schema

Edit only:

```text
schemas/profile-schema.json
```

Add/remove canonical classes there. The code automatically builds the allowed output enum from that file.

Example:

```json
{
  "id": "father_name",
  "description": "The user's father's name."
}
```

If you add that class, change the expected test result for the father field from `none` to `father_name` to test the new schema.

## 7. Production architecture later

This standalone program is intentionally not the production backend. Later:

```text
Team A
  ↓
unresolved fields
  ↓
Team B backend
  ↓
matching service
  ↓
Gemini
```

The backend should load the same canonical schema (or a versioned schema from a controlled source) and batch unresolved fields into one request.

For a small schema, reading the schema JSON and including it as prompt context is simpler than uploading it as a Gemini File. Gemini's File API is more useful for larger/reused documents and stores uploaded files temporarily.
