/**
 * intelligence.controller.js
 */

const intelligenceService = require('../intelligence/intelligence.service');
const { getMetrics } = require('../intelligence/semanticCache.service');

async function resolve(req, res) {
  try {
    const { formFingerprint, field } = req.body;
    
    // safe input policy check
    if (!field || typeof field !== 'object') {
      return res.status(400).json({ error: 'Invalid field metadata' });
    }

    // reject dangerous payload keys
    const dangerousKeys = ['value', 'currentValue', 'enteredValue', 'formData', 'profile', 'plaintextProfile', 'password', 'userData'];
    for (const key of dangerousKeys) {
      if (field.hasOwnProperty(key)) {
        return res.status(400).json({ error: 'Payload contains restricted values' });
      }
    }

    const result = await intelligenceService.resolveField(field, formFingerprint);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Resolve error:', error);
    return res.status(500).json({ error: 'Failed to resolve field' });
  }
}

async function feedback(req, res) {
  try {
    const { mappingId, accepted, correctProfileField } = req.body;
    
    if (!mappingId || typeof accepted !== 'boolean') {
      return res.status(400).json({ error: 'Invalid feedback payload' });
    }

    try {
      await intelligenceService.processFeedback(mappingId, accepted, correctProfileField);
      return res.status(200).json({ message: 'Feedback processed' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } catch (error) {
    console.error('Feedback error:', error);
    return res.status(500).json({ error: 'Failed to process feedback' });
  }
}

async function metrics(req, res) {
  try {
    const metricsData = await getMetrics();
    return res.status(200).json(metricsData);
  } catch (error) {
    console.error('Metrics error:', error);
    return res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
}

module.exports = {
  resolve,
  feedback,
  metrics
};
