/* Gemini Notebook (formerly NotebookLM) audio overviews, one public notebook per lesson.
   Shared as "anyone with the link"; each notebook's only source is its lesson page. */
const AUDIO_BASE = 'https://notebook.google.com/notebook/';
const AUDIO = {
  roles: 'db175b0e-7b07-410e-bf74-678b9fb4415d',
  primitives: '5ce8d73d-cb30-4092-8181-aa89a7f4fbe3',
  'tool-call': 'f90b3831-603f-4c7c-9608-8f257467279c',
  'client-asks': 'fe47f201-f4bd-468a-b6fd-403fa660a90c',
  transports: '5e0ba1be-d681-44c7-9dff-acbf6043ace0',
  authz: 'e08c45de-89c9-45bb-9dff-203bf8f47225',
  attacks: 'a2f56e9d-257b-4b43-b9dc-cf4e8d458ef1',
  consent: '572d8974-3f58-4264-bccb-160f003837d2',
  ecosystem: '2aeaaf58-63cf-48bf-af30-5e7f57546864',
  start: '70a1f922-8854-4e3e-b267-410a83880118',
  handshake: '0640ba1c-fc5e-42a5-a2bf-db57ce7c1687',
  discover: '1011512a-ffe3-40b0-b646-7fabf1f3176d',
  headers: '2485b98b-9c44-4ea1-9d28-945e6be3be25',
  sessions: '1cef3d6e-d0cd-464c-ae6e-e599c863bdd8',
  mrtr: '97703ae8-cd6a-4dd5-932a-d9cbdc74de8a',
  results: '8e0ded9e-174a-4ad0-badd-b735085c3a30',
  listen: '1d7702e5-5a16-4ef3-8d5c-75229a1efc38',
  streams: 'ffb31413-d1de-4690-af69-dcb3f30817e8',
  removed: 'e45a5984-fe13-4ade-86a3-a48664e03333',
  tasks: '13a1c3ed-5710-4eb2-bb4a-06893255458a',
  deprecated: '99a9478e-a9e5-4991-9e20-3012f3aead7d',
  auth: '5ee42567-ad64-46c3-b179-34935a5fee61',
  wrap: 'aaf67b71-307b-44de-ad5c-3bfe45921eb4',
};
const audioUrl = l => AUDIO[l.id] ? AUDIO_BASE + AUDIO[l.id] : null;
