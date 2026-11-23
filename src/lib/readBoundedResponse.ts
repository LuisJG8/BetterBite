export async function readBoundedResponseText(response: Response, maxBytes: number, service: string): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error(`${service} response was too large.`);
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error(`Could not read ${service} response.`);
  }

  const decoder = new TextDecoder();
  let text = "";
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return text + decoder.decode();
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new Error(`${service} response was too large.`);
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
