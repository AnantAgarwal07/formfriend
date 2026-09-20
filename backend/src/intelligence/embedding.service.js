/**
 * embedding.service.js
 * Creates embeddings using Amazon Bedrock (if configured)
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

let client = null;

function getClient() {
  if (!client) {
    client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || 'ap-south-1'
    });
  }
  return client;
}

async function getEmbedding(safeSemanticText) {
  if (process.env.SEMANTIC_EMBEDDINGS_ENABLED !== 'true') {
    return null;
  }

  const modelId = process.env.BEDROCK_EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v1';

  try {
    const input = {
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: safeSemanticText
      })
    };

    const command = new InvokeModelCommand(input);
    const response = await getClient().send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding || null;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Don't fail the system if embeddings fail
    return null;
  }
}

module.exports = {
  getEmbedding
};
