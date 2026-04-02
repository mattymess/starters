/**
 * Reproduce: Agent Actions Translate API treats conditionally hidden fields as
 * unconditionally hidden, even when the hidden callback evaluates to false.
 *
 * Creates a person doc with showTagline: true and an English tagline, then
 * attempts to translate via the Agent API. Expected: succeeds. Actual: 400
 * "The path 'tagline' is hidden from the instruction."
 *
 * Usage:
 *   NODE_OPTIONS='--import tsx/esm' sanity exec scripts/test-hidden-translate.ts --with-user-token
 */

import {randomBytes} from 'node:crypto'
import {getCliClient} from 'sanity/cli'

function randomKey(length: number): string {
  return randomBytes(length).toString('hex').slice(0, length)
}

const AGENT_API_VERSION = 'vX'
const TEST_DOC_ID = 'test-hidden-translate'

const client = getCliClient().withConfig({apiVersion: AGENT_API_VERSION})

async function setup() {
  const taglineKey = randomKey(12)

  await client.createOrReplace({
    _id: TEST_DOC_ID,
    _type: 'person',
    name: 'Hidden Translate Test',
    showTagline: true,
    tagline: [
      {
        _key: taglineKey,
        _type: 'internationalizedArrayStringValue',
        language: 'en-US',
        value: 'Test tagline for translation',
      },
    ],
  })

  return {taglineKey, path: ['tagline', {_key: taglineKey}, 'value']}
}

async function publish() {
  const draft = await client.getDocument(`drafts.${TEST_DOC_ID}`)
  const published = await client.getDocument(TEST_DOC_ID)

  if (draft && !published) {
    const {_id, ...rest} = draft
    await client.createOrReplace({...rest, _id: TEST_DOC_ID})
  }

  const doc = await client.getDocument(TEST_DOC_ID)
  console.log('\n📄 Document state:')
  console.log(JSON.stringify(doc, null, 2))
  return doc
}

async function translate(path: Array<string | {_key: string}>) {
  const params = {
    schemaId: '_.schemas.default',
    documentId: TEST_DOC_ID,
    fromLanguage: {id: 'en-US'},
    toLanguage: {id: 'de-DE', title: 'German (Germany)'},
    target: {path},
    noWrite: true,
  }

  console.log('\n🔄 Translate request:')
  console.log(JSON.stringify(params, null, 2))

  try {
    const result = await (client as any).agent.action.translate(params)
    console.log('\n✅ Translation succeeded:')
    console.log(JSON.stringify(result, null, 2))
    return {success: true, result}
  } catch (err: any) {
    console.log('\n❌ Translation failed:')
    console.log(`Status: ${err.statusCode ?? 'unknown'}`)
    console.log(`Message: ${err.message}`)
    if (err.body) console.log(`Body: ${JSON.stringify(err.body, null, 2)}`)
    return {success: false, error: err.message}
  }
}

async function cleanup() {
  try {
    await client.delete(TEST_DOC_ID)
    await client.delete(`drafts.${TEST_DOC_ID}`)
  } catch {
    // Ignore — may not exist
  }
}

async function main() {
  console.log('\n🧪 Test: conditionally hidden top-level field')
  console.log('─'.repeat(60))

  try {
    const {path} = await setup()
    await publish()
    const result = await translate(path)

    console.log('\n' + '─'.repeat(60))
    console.log(`Result: ${result.success ? 'PASS' : 'FAIL'}`)
  } finally {
    await cleanup()
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  cleanup().finally(() => process.exit(1))
})
