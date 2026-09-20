const fs = require('fs');
const file = './postman/team-b-backend.postman_collection.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

data.item.push({
  name: '9. Intelligence Resolve',
  request: {
    method: 'POST',
    header: [
      { key: 'Authorization', value: 'Bearer {{token}}', type: 'text' },
      { key: 'Content-Type', value: 'application/json', type: 'text' }
    ],
    url: {
      raw: '{{base_url}}/intelligence/resolve',
      host: ['{{base_url}}'],
      path: ['intelligence', 'resolve']
    },
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        formFingerprint: 'demo-registration-001',
        field: {
          fieldId: 'f1',
          label: 'Father\'s Full Name',
          section: 'Parent Details',
          fieldset: 'Parent Details',
          headings: ['Application Form'],
          placeholder: '',
          autocomplete: '',
          name: 'fatherName',
          id: 'fatherName',
          tag: 'input',
          type: 'text'
        }
      }, null, 2)
    }
  }
});

data.item.push({
  name: '10. Intelligence Feedback',
  request: {
    method: 'POST',
    header: [
      { key: 'Authorization', value: 'Bearer {{token}}', type: 'text' },
      { key: 'Content-Type', value: 'application/json', type: 'text' }
    ],
    url: {
      raw: '{{base_url}}/intelligence/feedback',
      host: ['{{base_url}}'],
      path: ['intelligence', 'feedback']
    },
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        mappingId: 'seed_map_0',
        accepted: true,
        correctProfileField: 'parent.father.name'
      }, null, 2)
    }
  }
});

data.item.push({
  name: '11. Intelligence Metrics',
  request: {
    method: 'GET',
    header: [
      { key: 'Authorization', value: 'Bearer {{token}}', type: 'text' }
    ],
    url: {
      raw: '{{base_url}}/intelligence/metrics',
      host: ['{{base_url}}'],
      path: ['intelligence', 'metrics']
    }
  }
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Postman collection updated successfully.');
