export async function loadJSON<T>(
  url: string
): Promise<T> {
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`Failed to load JSON from '${url}': ${response.statusText}`);
  }

  try {
    return await response.json();
  }
  catch (error: any) {
    throw new Error(`Failed to parse JSON from '${url}'`, {
      cause: error
    });
  }
}
