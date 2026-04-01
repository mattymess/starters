import {describe, expect, it} from 'vitest'
import {resolvePathValue} from './useTranslateFieldAction'

/**
 * resolvePathValue was extracted to fix a bug where useTranslateFieldAction
 * used doc[path[0]] to read internationalized array values. For fields nested
 * inside an object type (e.g. seo.metaTitle), path[0] returns the parent
 * object instead of the array, causing .filter() to crash.
 *
 * These tests use realistic document shapes from the studio schema.
 */
describe('resolvePathValue', () => {
  const personDoc = {
    _type: 'person',
    name: 'Elena Vasquez',
    bio: [
      {_key: 'a', _type: 'internationalizedArrayTextValue', language: 'en-US', value: 'Bio text'},
    ],
    seo: {
      _type: 'seo',
      metaTitle: [
        {
          _key: 'b',
          _type: 'internationalizedArrayStringValue',
          language: 'en-US',
          value: 'Meta title',
        },
      ],
      metaDescription: [
        {
          _key: 'c',
          _type: 'internationalizedArrayTextValue',
          language: 'en-US',
          value: 'Meta description',
        },
      ],
    },
  }

  it('resolves a top-level internationalizedArray field', () => {
    expect(resolvePathValue(personDoc, ['bio'])).toBe(personDoc.bio)
  })

  it('resolves an internationalizedArray field nested inside an object', () => {
    expect(resolvePathValue(personDoc, ['seo', 'metaTitle'])).toBe(personDoc.seo.metaTitle)
  })

  it('resolves a sibling nested field at the same depth', () => {
    expect(resolvePathValue(personDoc, ['seo', 'metaDescription'])).toBe(
      personDoc.seo.metaDescription,
    )
  })

  it('returns undefined for a field that does not exist on the object', () => {
    expect(resolvePathValue(personDoc, ['seo', 'ogImage'])).toBeUndefined()
  })

  it('returns undefined when the parent object does not exist', () => {
    const docWithoutSeo = {_type: 'person', name: 'Test'}
    expect(resolvePathValue(docWithoutSeo, ['seo', 'metaTitle'])).toBeUndefined()
  })

  it('does not traverse into arrays (guards against accidental array indexing)', () => {
    // bio is an array — resolving ['bio', '0'] should not index into it,
    // since the path segments represent object field names, not array indices
    expect(resolvePathValue(personDoc, ['bio', '0'])).toBeUndefined()
  })
})
