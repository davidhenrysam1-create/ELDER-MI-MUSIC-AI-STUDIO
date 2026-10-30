/**
 * Storage drivers — the shapes behind the two seams.
 *
 * The studio ships with a laptop filesystem (`.data/`). That is fine locally but
 * it is *not* durable: a container restart, a reset sandbox or a redeploy takes
 * the database and every uploaded stem with it. These interfaces are what lets
 * the same code run against object storage and a hosted Postgres instead, with
 * no change in any route handler.
 *
 * Two rules keep this honest:
 *  - a driver never pretends. `get()` returns null for a missing object instead
 *    of an empty buffer, and a failed request throws with the provider's status.
 *  - keys are flat, predictable paths (`audio/<assetId>.wav`, `exports/<name>`),
 *    deliberately identical to the local layout, so a migration is a copy and
 *    the two drivers stay comparable in tests.
 */

/** One stored file. Keys are `audio/…` or `exports/…`. */
export interface BlobStore {
  readonly kind: "local" | "supabase";
  readonly label: string;
  /** Write (or overwrite) one object. */
  put(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  /** Read one object, or null when it does not exist. */
  get(key: string): Promise<{ data: Buffer; key: string } | null>;
  /** Delete one object. Missing is not an error — deletion is idempotent. */
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Total bytes held, for the storage meter. Best effort. */
  usage(): Promise<{ audioBytes: number; exportBytes: number }>;
}

/**
 * One whole database snapshot.
 *
 * The studio's data model is a single JSON document, so the driver's job is
 * "read the document, write the document". Writes are serialised upstream in
 * `mutateDb()`, which is what makes a last-write-wins remote store safe for the
 * single-instance deployment this build targets (a laptop, one server).
 */
export interface SnapshotStore {
  readonly kind: "local" | "supabase";
  readonly label: string;
  /** The stored document, or null when the store is still empty. */
  load(): Promise<unknown | null>;
  /** Replace the document. */
  save(document: unknown): Promise<void>;
}

/** Status of one seam, for the UI to label honestly. */
export interface DriverStatus {
  kind: "local" | "supabase";
  label: string;
  /** True when the durable, off-machine driver is in use. */
  durable: boolean;
  /** One sentence a human can act on. */
  reason: string;
}
