export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { Buffer } = await import("node:buffer");
  // The shared buffer pool cannot be detached. Reading a Drive response transfers
  // one slab, and the page then fails to send with a network error.
  Buffer.poolSize = 0;
}
