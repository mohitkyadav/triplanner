import { beforeEach, describe, expect, it, vi } from 'vitest'

const upload = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => ({ upload: (...args) => upload(...args) }) } },
}))

// The documents store, kept in memory: the fake IndexedDB of the tests does
// not keep a Blob as a Blob.
const files = new Map()
vi.mock('./idb', () => ({
  fileGet: async id => files.get(id),
  filePut: async (id, record) => void files.set(id, record),
  fileDelete: async id => void files.delete(id),
  fileEntries: async () => [...files].map(([id, r]) => ({ id, ...r })),
}))

const { uploadFiles } = await import('./files')
const { fileGet, filePut } = await import('./idb')

const doc = (id, type, size) => ({ id, name: id, type, size })
const trip = docs => ({ id: 'trip-1', days: [{ id: 'd1', items: [{ id: 'i1', attachments: docs }] }] })

async function store(ref) {
  await filePut(ref.id, { blob: new Blob([new Uint8Array(ref.size)], { type: ref.type }), ...ref, addedAt: 0 })
}

describe('uploading documents to the account', () => {
  beforeEach(async () => {
    upload.mockReset()
    files.clear()
  })

  it('skips documents the bucket will not take and carries on with the rest', async () => {
    const docs = [
      doc('old.svg', 'image/svg+xml', 4_000), // a kind the bucket does not accept: never sent
      doc('huge.pdf', 'application/pdf', 900_000), // over the limit: never sent
      doc('odd.png', 'image/png', 50_000), // the bucket turns it down
      doc('ticket.pdf', 'application/pdf', 120_000),
    ]
    for (const d of docs) await store(d)
    upload.mockImplementation(async path =>
      path.endsWith('odd.png')
        ? { error: { statusCode: '415', message: 'mime type image/png is not supported' } }
        : { error: null },
    )

    await uploadFiles([trip(docs)], 'user-1')

    expect(upload.mock.calls.map(c => c[0])).toEqual(['user-1/trip-1/odd.png', 'user-1/trip-1/ticket.pdf'])
    expect(upload.mock.calls[1][1]).toBeInstanceOf(ArrayBuffer)
    expect(upload.mock.calls[1][1].byteLength).toBe(120_000)
    expect(upload.mock.calls[1][2]).toEqual({ contentType: 'application/pdf', upsert: false })
    expect((await fileGet('ticket.pdf')).uploaded).toEqual(['user-1/trip-1'])
    expect((await fileGet('odd.png')).refused).toBe(true)

    // the next sync asks about neither again
    upload.mockClear()
    await uploadFiles([trip(docs)], 'user-1')
    expect(upload).not.toHaveBeenCalled()
  })

  it('stops when the account cannot be reached, and tries again next time', async () => {
    const docs = [doc('a.pdf', 'application/pdf', 1_000), doc('b.pdf', 'application/pdf', 1_000)]
    for (const d of docs) await store(d)
    upload.mockResolvedValue({ error: { statusCode: '403', message: 'new row violates row-level security policy' } })

    await uploadFiles([trip(docs)], 'user-1')
    expect(upload).toHaveBeenCalledTimes(1)
    expect((await fileGet('a.pdf')).refused).toBeUndefined()

    upload.mockReset().mockResolvedValue({ error: null })
    await uploadFiles([trip(docs)], 'user-1')
    expect(upload).toHaveBeenCalledTimes(2)
  })
})
